import { apiError, apiOk, createApiHandler } from "@/lib/api/handler";
import { createAdminClient } from "@/lib/supabase/admin";
import { writeServerAudit } from "@/lib/api/audit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const DELETABLE_STATUSES = ["draft", "void", "cancelled"];

/** Permanently delete a draft/void/cancelled invoice and children. */
export const DELETE = createApiHandler(
  {
    auth: true,
    permissions: ["invoices.manage", "finance.manage", "finance.admin"],
    allowPlatformAdmin: true,
    requireMfa: "privileged",
    rateLimit: { limit: 20, windowMs: 60_000 },
    module: "sales",
  },
  async ({ req, ctx, params, ip }) => {
    if (!ctx) return apiError("UNAUTHORIZED", "Sign in required", 401);
    const id = params.id;
    if (!id) return apiError("VALIDATION", "Invoice id required");

    const admin = createAdminClient();
    const companyId = ctx.companyId;

    try {
      const { data: inv, error: invErr } = await admin
        .from("invoices")
        .select("*")
        .eq("id", id)
        .eq("company_id", companyId)
        .maybeSingle();
      if (invErr) return apiError("INTERNAL", invErr.message, 500);
      if (!inv) return apiError("NOT_FOUND", "Invoice not found", 404);
      if (!DELETABLE_STATUSES.includes(String(inv.status))) {
        return apiError(
          "VALIDATION",
          `Only draft/void/cancelled invoices can be deleted (status: ${inv.status})`,
          400
        );
      }
      if (Number(inv.amount_paid ?? 0) > 0) {
        return apiError(
          "VALIDATION",
          "Invoices with recorded payments cannot be deleted; void the invoice instead",
          400
        );
      }

      const { error: linesErr } = await admin
        .from("invoice_lines")
        .delete()
        .eq("invoice_id", inv.id);
      if (linesErr) return apiError("INTERNAL", linesErr.message, 500);

      const { error: payErr } = await admin
        .from("invoice_payments")
        .delete()
        .eq("invoice_id", inv.id);
      if (payErr) return apiError("INTERNAL", payErr.message, 500);

      const { error: delErr } = await admin
        .from("invoices")
        .delete()
        .eq("id", inv.id);
      if (delErr) return apiError("INTERNAL", delErr.message, 500);

      await writeServerAudit(admin, {
        company_id: companyId,
        user_id: ctx.user.id,
        action: "invoice.delete",
        module: "sales",
        entity_type: "invoices",
        entity_id: inv.id,
        entity_reference: inv.invoice_number,
        before_state: {
          invoice_number: inv.invoice_number,
          status: inv.status,
        },
        metadata: { source: "api/invoices/[id]" },
        ip_address: ip,
        user_agent: req.headers.get("user-agent"),
      });

      return apiOk({ id, deleted: true });
    } catch (e) {
      return apiError(
        "INTERNAL",
        e instanceof Error ? e.message : "Invoice delete failed",
        500
      );
    }
  }
);
