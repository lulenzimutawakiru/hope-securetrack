import { NextRequest } from "next/server";
import { requireApiAuth } from "@/lib/security/api-auth";
import {
  apiError,
  apiOk,
  clientIp,
  rateLimitStrict,
} from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";
import { writeServerAudit } from "@/lib/api/audit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const DELETABLE_STATUSES = ["draft", "void", "cancelled"];

/**
 * Permanently delete an invoice and its children (money path).
 *
 * Only draft/void/cancelled invoices can be deleted. Children (invoice_lines,
 * invoice_payments) are removed with the admin client so the cascade is
 * explicit and audited; the browser never deletes directly.
 */
export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiAuth({
    permissions: ["invoices.manage", "finance.manage", "finance.admin"],
    allowPlatformAdmin: true,
    requireMfa: "privileged",
  });
  if ("response" in auth) return auth.response;

  const ip = clientIp(req);
  const rl = await rateLimitStrict(
    `invoice-delete:${auth.ctx.user.id}:${ip}`,
    20,
    60_000
  );
  if (!rl.allowed) return apiError("RATE_LIMIT", "Rate limit exceeded", 429);

  const { id } = await ctx.params;
  const admin = createAdminClient();
  const companyId = auth.ctx.companyId;

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
      user_id: auth.ctx.user.id,
      action: "invoice.delete",
      module: "sales",
      entity_type: "invoices",
      entity_id: inv.id,
      entity_reference: inv.invoice_number,
      before_state: { invoice_number: inv.invoice_number, status: inv.status },
      metadata: { source: "api/invoices/[id]" },
      ip_address: ip,
      user_agent: req.headers.get("user-agent"),
    });

    return apiOk({ deleted: true, id: inv.id });
  } catch (e) {
    return apiError(
      "INTERNAL",
      e instanceof Error ? e.message : "Invoice deletion failed",
      500
    );
  }
}
