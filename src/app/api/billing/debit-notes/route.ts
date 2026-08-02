import { NextRequest } from "next/server";
import { z } from "zod";
import { requireApiAuth } from "@/lib/security/api-auth";
import {
  apiError,
  apiOk,
  clientIp,
  parseJson,
  rateLimitStrict,
} from "@/lib/api";
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
  debit_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  dual_control_id: z.string().uuid().optional().nullable(),
});

/**
 * Issue a billing debit note (money path).
 *
 * Document number and totals are computed server-side; customer/invoice must
 * belong to the caller's company; company_id comes from the session.
 */
export async function POST(req: NextRequest) {
  const auth = await requireApiAuth({
    permissions: ["billing.manage", "billing.credit"],
    allowPlatformAdmin: true,
    requireMfa: "privileged",
  });
  if ("response" in auth) return auth.response;

  const ip = clientIp(req);
  const rl = await rateLimitStrict(
    `billing-debit-notes:${auth.ctx.user.id}:${ip}`,
    20,
    60_000
  );
  if (!rl.allowed) return apiError("RATE_LIMIT", "Rate limit exceeded", 429);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("VALIDATION", "Invalid JSON");
  }
  const parsed = parseJson(schema, body);
  if (!parsed.success) return apiError("VALIDATION", parsed.error);

  const admin = createAdminClient();
  const companyId = auth.ctx.companyId;

  try {
    if (parsed.data.customer_id) {
      const { data: cust, error: custErr } = await admin
        .from("customers")
        .select("id")
        .eq("id", parsed.data.customer_id)
        .eq("company_id", companyId)
        .maybeSingle();
      if (custErr) return apiError("INTERNAL", custErr.message, 500);
      if (!cust) return apiError("NOT_FOUND", "Customer not found in this company", 404);
    }
    if (parsed.data.invoice_id) {
      const { data: inv, error: invErr } = await admin
        .from("invoices")
        .select("id")
        .eq("id", parsed.data.invoice_id)
        .eq("company_id", companyId)
        .maybeSingle();
      if (invErr) return apiError("INTERNAL", invErr.message, 500);
      if (!inv) return apiError("NOT_FOUND", "Invoice not found in this company", 404);
    }

    const debit_note_number = await nextBillNumberServer(admin, companyId, "DBN");
    const sub = Math.round(parsed.data.amount * 100) / 100;
    const tax = Math.round((parsed.data.tax || 0) * 100) / 100;
    const total = Math.round((sub + tax) * 100) / 100;

    const { data: note, error: noteErr } = await admin
      .from("bill_debit_notes")
      .insert({
        company_id: companyId,
        debit_note_number,
        customer_id: parsed.data.customer_id ?? null,
        invoice_id: parsed.data.invoice_id ?? null,
        debit_date: parsed.data.debit_date ?? new Date().toISOString().slice(0, 10),
        reason: parsed.data.reason ?? null,
        subtotal: sub,
        tax_amount: tax,
        total_amount: total,
        status: "issued",
        lines_json: [
          {
            description: parsed.data.reason || "Additional charge",
            quantity: 1,
            unit_price: sub,
          },
        ],
        created_by: auth.ctx.user.id,
      })
      .select("*")
      .single();
    if (noteErr || !note) {
      return apiError("INTERNAL", noteErr?.message ?? "Failed to issue debit note", 500);
    }

    await writeServerAudit(admin, {
      company_id: companyId,
      user_id: auth.ctx.user.id,
      action: "billing.debit_note_issued",
      module: "billing",
      entity_type: "bill_debit_notes",
      entity_id: note.id,
      entity_reference: note.debit_note_number,
      after_state: { customer_id: note.customer_id, invoice_id: note.invoice_id, total },
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
