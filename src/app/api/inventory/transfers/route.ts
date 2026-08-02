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
  from_warehouse_id: z.string().uuid(),
  to_warehouse_id: z.string().uuid(),
  product_id: z.string().uuid(),
  quantity: z.number().positive(),
  batch_number: z.string().max(100).optional().nullable(),
  reason: z.string().max(2000).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});

/** Count-based transfer number, mirroring the page's TRF-YYYY-###### pattern. */
function nextTransferNumber(count: number): string {
  return `TRF-${new Date().getFullYear()}-${String(count + 1).padStart(6, "0")}`;
}

/**
 * Ship an inter-warehouse stock transfer (stock-moving path).
 *
 * From/to warehouses must belong to the caller's company and differ; the
 * source stock balance must cover the shipped quantity (fail-closed, unlike
 * the legacy page which silently skipped the decrement). company_id comes from
 * the session, never the body.
 */
export async function POST(req: NextRequest) {
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
    `inventory-transfers:${auth.ctx.user.id}:${ip}`,
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

  const qty = Math.round(parsed.data.quantity * 10000) / 10000;
  if (parsed.data.from_warehouse_id === parsed.data.to_warehouse_id) {
    return apiError("VALIDATION", "From and to warehouses must differ");
  }

  const admin = createAdminClient();
  const companyId = auth.ctx.companyId;

  try {
    const { data: whs, error: whErr } = await admin
      .from("warehouses")
      .select("id")
      .in("id", [parsed.data.from_warehouse_id, parsed.data.to_warehouse_id])
      .eq("company_id", companyId);
    if (whErr) return apiError("INTERNAL", whErr.message, 500);
    const whIds = new Set((whs ?? []).map((w) => w.id));
    if (!whIds.has(parsed.data.from_warehouse_id) || !whIds.has(parsed.data.to_warehouse_id)) {
      return apiError("NOT_FOUND", "Warehouse not found in this company", 404);
    }

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
      .eq("warehouse_id", parsed.data.from_warehouse_id);
    if (parsed.data.batch_number) {
      balQuery = balQuery.eq("batch_number", parsed.data.batch_number);
    }
    const { data: bal, error: balErr } = await balQuery.limit(1).maybeSingle();
    if (balErr) return apiError("INTERNAL", balErr.message, 500);

    const onHand = Number(bal?.quantity_on_hand || 0);
    if (!bal || onHand < qty) {
      return apiError(
        "VALIDATION",
        "Insufficient stock in source warehouse",
        400
      );
    }

    const { count, error: countErr } = await admin
      .from("stock_transfers")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId);
    if (countErr) return apiError("INTERNAL", countErr.message, 500);

    const number = nextTransferNumber(count ?? 0);
    const now = new Date().toISOString();

    const { data: tr, error: trErr } = await admin
      .from("stock_transfers")
      .insert({
        company_id: companyId,
        transfer_number: number,
        from_warehouse_id: parsed.data.from_warehouse_id,
        to_warehouse_id: parsed.data.to_warehouse_id,
        transfer_date: now.slice(0, 10),
        status: "in_transit",
        reason: parsed.data.reason ?? null,
        shipped_at: now,
        shipped_by: auth.ctx.user.id,
        created_by: auth.ctx.user.id,
      })
      .select("*")
      .single();
    if (trErr || !tr) {
      return apiError("INTERNAL", trErr?.message ?? "Failed to create transfer", 500);
    }

    const { error: lineErr } = await admin.from("stock_transfer_lines").insert({
      transfer_id: tr.id,
      company_id: companyId,
      product_id: parsed.data.product_id,
      item_description: product.name ?? "Product",
      batch_number: parsed.data.batch_number ?? null,
      qty_sent: qty,
      unit_cost: cost,
    });
    if (lineErr) {
      await admin.from("stock_transfers").delete().eq("id", tr.id).select();
      return apiError("INTERNAL", lineErr.message, 500);
    }

    const newQty = Math.round((onHand - qty) * 10000) / 10000;
    const unitCost = Number(bal.unit_cost || cost) || cost;
    const { error: updErr } = await admin
      .from("stock_balances")
      .update({
        quantity_on_hand: newQty,
        total_value: Math.round(newQty * unitCost * 100) / 100,
        last_movement_at: now,
      })
      .eq("id", bal.id);
    if (updErr) {
      await admin.from("stock_transfers").delete().eq("id", tr.id).select();
      return apiError("INTERNAL", updErr.message, 500);
    }

    const { error: movErr } = await admin.from("inventory_movements").insert({
      company_id: companyId,
      movement_type: "warehouse_transfer",
      item_type: "product",
      product_id: parsed.data.product_id,
      batch_number: parsed.data.batch_number ?? null,
      from_warehouse_id: parsed.data.from_warehouse_id,
      to_warehouse_id: parsed.data.to_warehouse_id,
      quantity: Math.round(qty),
      qty_decimal: qty,
      unit_cost: cost,
      total_value: Math.round(qty * cost * 100) / 100,
      document_type: "transfer",
      document_id: tr.id,
      reference_number: number,
      performed_by: auth.ctx.user.id,
      notes: parsed.data.reason || "Inter-warehouse transfer",
    });
    if (movErr) {
      await admin.from("stock_transfers").delete().eq("id", tr.id).select();
      return apiError("INTERNAL", movErr.message, 500);
    }

    await writeServerAudit(admin, {
      company_id: companyId,
      user_id: auth.ctx.user.id,
      action: "inventory.transfer_shipped",
      module: "inventory",
      entity_type: "stock_transfers",
      entity_id: tr.id,
      entity_reference: tr.transfer_number,
      after_state: {
        product_id: parsed.data.product_id,
        from_warehouse_id: parsed.data.from_warehouse_id,
        to_warehouse_id: parsed.data.to_warehouse_id,
        qty_sent: qty,
      },
      metadata: { source: "api/inventory/transfers" },
      ip_address: ip,
      user_agent: req.headers.get("user-agent"),
    });

    return apiOk({ transfer: tr }, { status: 201 });
  } catch (e) {
    return apiError(
      "INTERNAL",
      e instanceof Error ? e.message : "Stock transfer failed",
      500
    );
  }
}
