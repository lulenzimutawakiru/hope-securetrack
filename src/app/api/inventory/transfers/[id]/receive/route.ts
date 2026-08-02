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
 * Receive an in-transit stock transfer into the destination warehouse.
 *
 * The transfer must belong to the caller's company and be in-transit.
 * Destination stock_balances are incremented (or created), lines are marked
 * received, and the transfer is closed. company_id comes from the session.
 */
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiAuth({
    permissions: [
      "inventory.manage",
      "inventory.move",
      "inventory.transfer",
      "inventory.adjust",
      "inventory.grn",
      "inventory.qc",
      "inventory.valuation",
    ],
    allowPlatformAdmin: true,
    requireMfa: "privileged",
  });
  if ("response" in auth) return auth.response;

  const ip = clientIp(req);
  const rl = await rateLimitStrict(
    `inventory-transfer-receive:${auth.ctx.user.id}:${ip}`,
    20,
    60_000
  );
  if (!rl.allowed) return apiError("RATE_LIMIT", "Rate limit exceeded", 429);

  const { id } = await ctx.params;
  const admin = createAdminClient();
  const companyId = auth.ctx.companyId;

  try {
    const { data: tr, error: trErr } = await admin
      .from("stock_transfers")
      .select("*")
      .eq("id", id)
      .eq("company_id", companyId)
      .maybeSingle();
    if (trErr) return apiError("INTERNAL", trErr.message, 500);
    if (!tr) return apiError("NOT_FOUND", "Transfer not found", 404);
    if (tr.status !== "in_transit") {
      return apiError(
        "VALIDATION",
        `Only in-transit transfers can be received (status: ${tr.status})`,
        400
      );
    }

    const { data: lines, error: linesErr } = await admin
      .from("stock_transfer_lines")
      .select("*")
      .eq("transfer_id", id);
    if (linesErr) return apiError("INTERNAL", linesErr.message, 500);

    const now = new Date().toISOString();
    const received: Array<{ product_id: string; qty_received: number }> = [];

    for (const line of lines ?? []) {
      const productId = line.product_id as string | null;
      if (!productId) continue;
      const qty = Math.round(Number(line.qty_sent || 0) * 10000) / 10000;
      const cost = Math.round(Number(line.unit_cost || 0) * 100) / 100;
      const batch = (line.batch_number as string | null) ?? null;

      let destQuery = admin
        .from("stock_balances")
        .select("id, quantity_on_hand, total_value, unit_cost")
        .eq("product_id", productId)
        .eq("warehouse_id", tr.to_warehouse_id);
      if (batch) destQuery = destQuery.eq("batch_number", batch);
      const { data: dest, error: destErr } = await destQuery.limit(1).maybeSingle();
      if (destErr) return apiError("INTERNAL", destErr.message, 500);

      if (dest) {
        const newQty = Math.round((Number(dest.quantity_on_hand || 0) + qty) * 10000) / 10000;
        const totalValue = Math.round((Number(dest.total_value || 0) + qty * cost) * 100) / 100;
        const { error: updErr } = await admin
          .from("stock_balances")
          .update({ quantity_on_hand: newQty, total_value: totalValue, last_movement_at: now })
          .eq("id", dest.id);
        if (updErr) return apiError("INTERNAL", updErr.message, 500);
      } else {
        const { error: insErr } = await admin.from("stock_balances").insert({
          company_id: companyId,
          product_id: productId,
          warehouse_id: tr.to_warehouse_id,
          batch_number: batch,
          quantity_on_hand: qty,
          unit_cost: cost,
          total_value: Math.round(qty * cost * 100) / 100,
          last_movement_at: now,
        });
        if (insErr) return apiError("INTERNAL", insErr.message, 500);
      }

      const { error: lineUpdErr } = await admin
        .from("stock_transfer_lines")
        .update({ qty_received: qty })
        .eq("id", line.id);
      if (lineUpdErr) return apiError("INTERNAL", lineUpdErr.message, 500);

      received.push({ product_id: productId, qty_received: qty });
    }

    const { data: updated, error: updErr } = await admin
      .from("stock_transfers")
      .update({
        status: "received",
        received_at: now,
        received_by: auth.ctx.user.id,
      })
      .eq("id", id)
      .select("*")
      .single();
    if (updErr || !updated) {
      return apiError("INTERNAL", updErr?.message ?? "Failed to receive transfer", 500);
    }

    await writeServerAudit(admin, {
      company_id: companyId,
      user_id: auth.ctx.user.id,
      action: "inventory.transfer_received",
      module: "inventory",
      entity_type: "stock_transfers",
      entity_id: tr.id,
      entity_reference: tr.transfer_number,
      before_state: { status: "in_transit" },
      after_state: { status: "received", lines_received: received.length },
      metadata: { source: "api/inventory/transfers/[id]/receive", received },
      ip_address: ip,
      user_agent: req.headers.get("user-agent"),
    });

    return apiOk({ transfer: updated });
  } catch (e) {
    return apiError(
      "INTERNAL",
      e instanceof Error ? e.message : "Transfer receive failed",
      500
    );
  }
}
