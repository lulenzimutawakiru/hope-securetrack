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

/**
 * Delete a purchase order (money path).
 *
 * Only draft or cancelled POs can be deleted; lines are removed with the PO.
 * company_id comes from the session, never the request.
 */
export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiAuth({
    permissions: ["procurement.manage", "procurement.approve"],
    allowPlatformAdmin: true,
    requireMfa: "privileged",
  });
  if ("response" in auth) return auth.response;

  const ip = clientIp(req);
  const rl = await rateLimitStrict(
    `procurement-order-delete:${auth.ctx.user.id}:${ip}`,
    30,
    60_000
  );
  if (!rl.allowed) return apiError("RATE_LIMIT", "Rate limit exceeded", 429);

  const { id } = await ctx.params;
  const admin = createAdminClient();
  const companyId = auth.ctx.companyId;

  try {
    const { data: po, error: poErr } = await admin
      .from("purchase_orders")
      .select("id,po_number,status")
      .eq("id", id)
      .eq("company_id", companyId)
      .maybeSingle();
    if (poErr) return apiError("INTERNAL", poErr.message, 500);
    if (!po) return apiError("NOT_FOUND", "Purchase order not found", 404);
    if (!["draft", "cancelled"].includes(po.status)) {
      return apiError(
        "VALIDATION",
        "Only draft or cancelled purchase orders can be deleted",
        400
      );
    }

    await admin.from("purchase_order_lines").delete().eq("po_id", id);
    const { error: delErr } = await admin.from("purchase_orders").delete().eq("id", id);
    if (delErr) return apiError("INTERNAL", delErr.message, 500);

    await writeServerAudit(admin, {
      company_id: companyId,
      user_id: auth.ctx.user.id,
      action: "procurement.po_deleted",
      module: "procurement",
      entity_type: "purchase_orders",
      entity_id: id,
      entity_reference: po.po_number,
      before_state: { status: po.status },
      metadata: { source: "api/procurement/orders/[id]" },
      ip_address: ip,
      user_agent: req.headers.get("user-agent"),
    });

    return apiOk({ id, deleted: true });
  } catch (e) {
    return apiError(
      "INTERNAL",
      e instanceof Error ? e.message : "Purchase order deletion failed",
      500
    );
  }
}
