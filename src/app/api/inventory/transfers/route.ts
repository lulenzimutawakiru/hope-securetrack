import { z } from "zod";
import { apiError, apiOk, createApiHandler } from "@/lib/api/handler";
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

function nextTransferNumber(count: number): string {
  return `TRF-${new Date().getFullYear()}-${String(count + 1).padStart(6, "0")}`;
}

const INVENTORY_PERMS = [
  "inventory.manage",
  "inventory.move",
  "inventory.transfer",
  "inventory.adjust",
  "inventory.grn",
  "inventory.qc",
  "inventory.valuation",
] as const;

/**
 * Ship an inter-warehouse stock transfer (stock-moving path).
 * company_id from session; source stock must cover qty (fail-closed).
 */
export const POST = createApiHandler(
  {
    auth: true,
    permissions: [...INVENTORY_PERMS],
    allowPlatformAdmin: true,
    requireMfa: "privileged",
    bodySchema: schema,
    idempotent: true,
    rateLimit: { limit: 20, windowMs: 60_000 },
    module: "inventory",
  },
  async ({ req, ctx, body, ip }) => {
    if (!ctx) return apiError("UNAUTHORIZED", "Sign in required", 401);
    const data = body as z.infer<typeof schema>;
    const qty = Math.round(data.quantity * 10000) / 10000;
    if (data.from_warehouse_id === data.to_warehouse_id) {
      return apiError("VALIDATION", "From and to warehouses must differ");
    }

    const admin = createAdminClient();
    const companyId = ctx.companyId;

    try {
      const { data: whs, error: whErr } = await admin
        .from("warehouses")
        .select("id")
        .in("id", [data.from_warehouse_id, data.to_warehouse_id])
        .eq("company_id", companyId);
      if (whErr) return apiError("INTERNAL", whErr.message, 500);
      const whIds = new Set((whs ?? []).map((w) => w.id));
      if (
        !whIds.has(data.from_warehouse_id) ||
        !whIds.has(data.to_warehouse_id)
      ) {
        return apiError("NOT_FOUND", "Warehouse not found in this company", 404);
      }

      const { data: product, error: prodErr } = await admin
        .from("products")
        .select("id,name,product_code,average_cost,standard_cost")
        .eq("id", data.product_id)
        .eq("company_id", companyId)
        .maybeSingle();
      if (prodErr) return apiError("INTERNAL", prodErr.message, 500);
      if (!product) {
        return apiError("NOT_FOUND", "Product not found in this company", 404);
      }

      const cost =
        Math.round(
          (Number(product.average_cost || product.standard_cost || 0) || 0) * 100
        ) / 100;

      let balQuery = admin
        .from("stock_balances")
        .select(
          "id, quantity_on_hand, unit_cost, total_value, bin_id, batch_number"
        )
        .eq("product_id", data.product_id)
        .eq("warehouse_id", data.from_warehouse_id);
      if (data.batch_number) {
        balQuery = balQuery.eq("batch_number", data.batch_number);
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
          from_warehouse_id: data.from_warehouse_id,
          to_warehouse_id: data.to_warehouse_id,
          transfer_date: now.slice(0, 10),
          status: "in_transit",
          reason: data.reason ?? null,
          shipped_at: now,
          shipped_by: ctx.user.id,
          created_by: ctx.user.id,
        })
        .select("*")
        .single();
      if (trErr || !tr) {
        return apiError(
          "INTERNAL",
          trErr?.message ?? "Failed to create transfer",
          500
        );
      }

      const { error: lineErr } = await admin.from("stock_transfer_lines").insert({
        transfer_id: tr.id,
        company_id: companyId,
        product_id: data.product_id,
        item_description: product.name ?? "Product",
        batch_number: data.batch_number ?? null,
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
        product_id: data.product_id,
        batch_number: data.batch_number ?? null,
        from_warehouse_id: data.from_warehouse_id,
        to_warehouse_id: data.to_warehouse_id,
        quantity: Math.round(qty),
        qty_decimal: qty,
        unit_cost: cost,
        total_value: Math.round(qty * cost * 100) / 100,
        document_type: "transfer",
        document_id: tr.id,
        reference_number: number,
        performed_by: ctx.user.id,
        notes: data.reason || "Inter-warehouse transfer",
      });
      if (movErr) {
        await admin.from("stock_transfers").delete().eq("id", tr.id).select();
        return apiError("INTERNAL", movErr.message, 500);
      }

      await writeServerAudit(admin, {
        company_id: companyId,
        user_id: ctx.user.id,
        action: "inventory.transfer_shipped",
        module: "inventory",
        entity_type: "stock_transfers",
        entity_id: tr.id,
        entity_reference: tr.transfer_number,
        after_state: {
          product_id: data.product_id,
          from_warehouse_id: data.from_warehouse_id,
          to_warehouse_id: data.to_warehouse_id,
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
);
