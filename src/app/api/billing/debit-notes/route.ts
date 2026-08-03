import { z } from "zod";
import { apiError, apiOk, createApiHandler } from "@/lib/api/handler";
import { createAdminClient } from "@/lib/supabase/admin";
import { writeServerAudit } from "@/lib/api/audit";
import { nextBillNumberServer } from "@/lib/api/bill-number";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const schema = z.object({
  customer_id: z.string().uuid().optional().nullable(),
  invoice_id: z.string().uuid().optional().nullable(),
  reason: z.string().max(2000).optional().nullable(),
  amount: z.number().positive(),
  tax: z.number().min(0).optional(),
  debit_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  dual_control_id: z.string().uuid().optional().nullable(),
});

/** Issue a billing debit note (money path). */
export const POST = createApiHandler(
  {
    auth: true,
    permissions: ["billing.manage", "billing.credit"],
    allowPlatformAdmin: true,
    requireMfa: "privileged",
    bodySchema: schema,
    idempotent: true,
    rateLimit: { limit: 20, windowMs: 60_000 },
    module: "billing",
  },
  async ({ req, ctx, body, ip }) => {
    if (!ctx) return apiError("UNAUTHORIZED", "Sign in required", 401);
    const data = body as z.infer<typeof schema>;
    const admin = createAdminClient();
    const companyId = ctx.companyId;

    try {
      if (data.customer_id) {
        const { data: cust, error: custErr } = await admin
          .from("customers")
          .select("id")
          .eq("id", data.customer_id)
          .eq("company_id", companyId)
          .maybeSingle();
        if (custErr) return apiError("INTERNAL", custErr.message, 500);
        if (!cust) {
          return apiError(
            "NOT_FOUND",
            "Customer not found in this company",
            404
          );
        }
      }
      if (data.invoice_id) {
        const { data: inv, error: invErr } = await admin
          .from("invoices")
          .select("id")
          .eq("id", data.invoice_id)
          .eq("company_id", companyId)
          .maybeSingle();
        if (invErr) return apiError("INTERNAL", invErr.message, 500);
        if (!inv) {
          return apiError(
            "NOT_FOUND",
            "Invoice not found in this company",
            404
          );
        }
      }

      const debit_note_number = await nextBillNumberServer(
        admin,
        companyId,
        "DBN"
      );
      const sub = Math.round(data.amount * 100) / 100;
      const tax = Math.round((data.tax || 0) * 100) / 100;
      const total = Math.round((sub + tax) * 100) / 100;

      const { data: note, error: noteErr } = await admin
        .from("bill_debit_notes")
        .insert({
          company_id: companyId,
          debit_note_number,
          customer_id: data.customer_id ?? null,
          invoice_id: data.invoice_id ?? null,
          debit_date:
            data.debit_date ?? new Date().toISOString().slice(0, 10),
          reason: data.reason ?? null,
          subtotal: sub,
          tax_amount: tax,
          total_amount: total,
          status: "issued",
          lines_json: [
            {
              description: data.reason || "Additional charge",
              quantity: 1,
              unit_price: sub,
            },
          ],
          created_by: ctx.user.id,
        })
        .select("*")
        .single();
      if (noteErr || !note) {
        return apiError(
          "INTERNAL",
          noteErr?.message ?? "Failed to issue debit note",
          500
        );
      }

      await writeServerAudit(admin, {
        company_id: companyId,
        user_id: ctx.user.id,
        action: "billing.debit_note_issued",
        module: "billing",
        entity_type: "bill_debit_notes",
        entity_id: note.id,
        entity_reference: note.debit_note_number,
        after_state: {
          customer_id: note.customer_id,
          invoice_id: note.invoice_id,
          total,
        },
        metadata: { source: "api/billing/debit-notes" },
        ip_address: ip,
        user_agent: req.headers.get("user-agent"),
      });

      return apiOk({ note }, { status: 201 });
    } catch (e) {
      return apiError(
        "INTERNAL",
        e instanceof Error ? e.message : "Debit note issuance failed",
        500
      );
    }
  }
);
