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

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const schema = z.object({
  warehouse_id: z.string().uuid(),
  product_id: z.string().uuid(),
  adjustment_type: z
    .enum([
      "cycle_count",
      "write_off",
      "damage",
      "theft",
      "found",
      "revaluation",
      "correction",
      "other",
    ])
    .default("correction"),
  qty_delta: z.number().finite(),
  reason: z.string().max(2000).optional().nullable(),
  batch_number: z.string().max(100).optional().nullable(),
  bin_id: z.string().uuid().optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});

/** Count-based adjustment number, mirroring the page's ADJ-YYYY-###### pattern. */
function nextAdjustmentNumber(count: number): string {
  return `ADJ-${new Date().getFullYear()}-${String(count + 1).padStart(6, "0")}`;
}

/**
 * Post a stock adjustment (stock-moving path).
 *
 * Product and warehouse must belong to the caller's company; the resulting
 * stock balance can never go negative; stock_balances and inventory_movements
 * are updated server-side. company_id comes from the session, never the body.
 */
export async function POST(req: NextRequest) {
  const auth = await requireApiAuth({
    permissions: [
      "inventory.manage",
      "inventory.adjust",
      "inventory.move",
      "inventory.transfer",
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
    `inventory-adjustments:${auth.ctx.user.id}:${ip}`,
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

  const delta = parsed.data.qty_delta;
  if (delta === 0) {
    return apiError("VALIDATION", "Quantity delta cannot be zero");
  }

  const admin = createAdminClient();
  const companyId = auth.ctx.companyId;

  try {
    const { data: wh, error: whErr } = await admin
      .from("warehouses")
      .select("id")
      .eq("id", parsed.data.warehouse_id)
      .eq("company_id", companyId)
      .maybeSingle();
    if (whErr) return apiError("INTERNAL", whErr.message, 500);
    if (!wh) return apiError("NOT_FOUND", "Warehouse not found in this company", 404);

    const { data: product, error: prodErr } = await admin
      .from("products")
      .select("id,name,product_code,average_cost,standard_cost")
      .eq("id", parsed.data.product_id)
      .eq("company_id", companyId)
      .maybeSingle();
    if (prodErr) return apiError("INTERNAL", prodErr.message, 500);
    if (!product) return apiError("NOT_FOUND", "Product not found in this company", 404);

    const cost =
      Math.round(
        (Number(product.average_cost || product.standard_cost || 0) || 0) * 100
      ) / 100;

    let balQuery = admin
      .from("stock_balances")
      .select("id, quantity_on_hand, unit_cost, total_value, bin_id, batch_number")
      .eq("product_id", parsed.data.product_id)
      .eq("warehouse_id", parsed.data.warehouse_id);
    if (parsed.data.batch_number) {
      balQuery = balQuery.eq("batch_number", parsed.data.batch_number);
    }
    const { data: bal, error: balErr } = await balQuery.limit(1).maybeSingle();
    if (balErr) return apiError("INTERNAL", balErr.message, 500);

    const qtyBefore = Number(bal?.quantity_on_hand || 0);
    const qtyAfter = Math.round((qtyBefore + delta) * 10000) / 10000;
    if (qtyAfter < 0) {
      return apiError(
        "VALIDATION",
        "Adjustment would make stock negative",
        400
      );
    }
    if (!bal && delta < 0) {
      return apiError(
        "VALIDATION",
        "No stock balance exists for this product in the warehouse",
        400
      );
    }

    const { count, error: countErr } = await admin
      .from("stock_adjustments")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId);
    if (countErr) return apiError("INTERNAL", countErr.message, 500);

    const number = nextAdjustmentNumber(count ?? 0);
    const now = new Date().toISOString();

    const { data: adj, error: adjErr } = await admin
      .from("stock_adjustments")
      .insert({
        company_id: companyId,
        adjustment_number: number,
        warehouse_id: parsed.data.warehouse_id,
        adjustment_type: parsed.data.adjustment_type,
        adjustment_date: now.slice(0, 10),
        status: "posted",
        reason: parsed.data.reason ?? null,
        approved_by: auth.ctx.user.id,
        approved_at: now,
        created_by: auth.ctx.user.id,
      })
      .select("*")
      .single();
    if (adjErr || !adj) {
      return apiError("INTERNAL", adjErr?.message ?? "Failed to create adjustment", 500);
    }

    const { error: lineErr } = await admin.from("stock_adjustment_lines").insert({
      adjustment_id: adj.id,
      company_id: companyId,
      product_id: parsed.data.product_id,
      item_description: product.name ?? "Product",
      batch_number: parsed.data.batch_number ?? null,
      bin_id: parsed.data.bin_id ?? bal?.bin_id ?? null,
      qty_before: qtyBefore,
      qty_after: qtyAfter,
      qty_delta: delta,
      unit_cost: cost,
      notes: parsed.data.notes ?? parsed.data.reason ?? null,
    });
    if (lineErr) {
      await admin.from("stock_adjustments").delete().eq("id", adj.id).select();
      return apiError("INTERNAL", lineErr.message, 500);
    }

    const unitCost = Number(bal?.unit_cost || cost) || cost;
    if (bal) {
      const { error: updErr } = await admin
        .from("stock_balances")
        .update({
          quantity_on_hand: qtyAfter,
          total_value: Math.round(qtyAfter * unitCost * 100) / 100,
          last_movement_at: now,
        })
        .eq("id", bal.id);
      if (updErr) {
        await admin.from("stock_adjustments").delete().eq("id", adj.id).select();
        return apiError("INTERNAL", updErr.message, 500);
      }
    } else {
      const { error: insErr } = await admin.from("stock_balances").insert({
        company_id: companyId,
        product_id: parsed.data.product_id,
        warehouse_id: parsed.data.warehouse_id,
        bin_id: parsed.data.bin_id ?? null,
        batch_number: parsed.data.batch_number ?? null,
        quantity_on_hand: qtyAfter,
        unit_cost: cost,
        total_value: Math.round(qtyAfter * cost * 100) / 100,
        last_movement_at: now,
      });
      if (insErr) {
        await admin.from("stock_adjustments").delete().eq("id", adj.id).select();
        return apiError("INTERNAL", insErr.message, 500);
      }
    }

    const { error: movErr } = await admin.from("inventory_movements").insert({
      company_id: companyId,
      movement_type: parsed.data.adjustment_type,
      item_type: "product",
      product_id: parsed.data.product_id,
      batch_number: parsed.data.batch_number ?? null,
      to_warehouse_id: delta > 0 ? parsed.data.warehouse_id : null,
      from_warehouse_id: delta < 0 ? parsed.data.warehouse_id : null,
      quantity: Math.abs(Math.round(delta)),
      qty_decimal: Math.abs(delta),
      unit_cost: cost,
      total_value: Math.round(Math.abs(delta) * cost * 100) / 100,
      document_type: "adjustment",
      document_id: adj.id,
      reference_number: number,
      performed_by: auth.ctx.user.id,
      notes: parsed.data.reason || "Stock adjustment",
    });
    if (movErr) {
      await admin.from("stock_adjustments").delete().eq("id", adj.id).select();
      return apiError("INTERNAL", movErr.message, 500);
    }

    await writeServerAudit(admin, {
      company_id: companyId,
      user_id: auth.ctx.user.id,
      action: "inventory.adjustment_posted",
      module: "inventory",
      entity_type: "stock_adjustments",
      entity_id: adj.id,
      entity_reference: adj.adjustment_number,
      after_state: {
        product_id: parsed.data.product_id,
        warehouse_id: parsed.data.warehouse_id,
        qty_before: qtyBefore,
        qty_after: qtyAfter,
        delta,
      },
      metadata: { source: "api/inventory/adjustments" },
      ip_address: ip,
      user_agent: req.headers.get("user-agent"),
    });

    return apiOk({ adjustment: adj }, { status: 201 });
  } catch (e) {
    return apiError(
      "INTERNAL",
      e instanceof Error ? e.message : "Stock adjustment failed",
      500
    );
  }
}
