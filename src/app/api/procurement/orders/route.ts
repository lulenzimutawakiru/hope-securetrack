import { z } from "zod";
import { apiError, apiOk, createApiHandler } from "@/lib/api/handler";
import { createAdminClient } from "@/lib/supabase/admin";
import { writeServerAudit } from "@/lib/api/audit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const lineSchema = z.object({
  product_id: z.string().uuid(),
  quantity: z.number().positive(),
  unit_price: z.number().min(0).optional(),
  description: z.string().max(255).optional(),
  uom: z.string().max(30).optional(),
  tax_rate: z.number().min(0).max(100).optional(),
});

const schema = z.object({
  supplier_id: z.string().uuid(),
  warehouse_id: z.string().uuid().optional().nullable(),
  expected_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .nullable(),
  currency: z.string().max(10).optional(),
  po_type: z.string().max(50).optional(),
  payment_terms: z.string().max(100).optional(),
  notes: z.string().max(2000).optional().nullable(),
  lines: z.array(lineSchema).min(1).max(200),
  dual_control_id: z.string().uuid().optional().nullable(),
});

function nextPoNumber(count: number): string {
  return `PO-${new Date().getFullYear()}-${String(count + 1).padStart(6, "0")}`;
}

/**
 * Create a purchase order with lines (money path).
 * Totals computed server-side; company_id from session.
 */
export const POST = createApiHandler(
  {
    auth: true,
    permissions: ["procurement.manage", "procurement.approve"],
    allowPlatformAdmin: true,
    requireMfa: "privileged",
    bodySchema: schema,
    idempotent: true,
    rateLimit: { limit: 20, windowMs: 60_000 },
    module: "procurement",
  },
  async ({ req, ctx, body, ip }) => {
    if (!ctx) return apiError("UNAUTHORIZED", "Sign in required", 401);
    const data = body as z.infer<typeof schema>;

    const admin = createAdminClient();
    const companyId = ctx.companyId;

    try {
      const { data: supplier, error: supErr } = await admin
        .from("suppliers")
        .select("id")
        .eq("id", data.supplier_id)
        .eq("company_id", companyId)
        .maybeSingle();
      if (supErr) return apiError("INTERNAL", supErr.message, 500);
      if (!supplier) {
        return apiError("NOT_FOUND", "Supplier not found in this company", 404);
      }

      const productIds = [...new Set(data.lines.map((l) => l.product_id))];
      const { data: products, error: prodErr } = await admin
        .from("products")
        .select("id,name,product_code,standard_cost")
        .in("id", productIds)
        .eq("company_id", companyId);
      if (prodErr) return apiError("INTERNAL", prodErr.message, 500);
      const productMap = new Map((products ?? []).map((p) => [p.id, p]));
      for (const pid of productIds) {
        if (!productMap.has(pid)) {
          return apiError("NOT_FOUND", "Product not found in this company", 404);
        }
      }

      let subtotal = 0;
      const lineRows = data.lines.map((l, i) => {
        const product = productMap.get(l.product_id)!;
        const price =
          Math.round(
            ((l.unit_price ?? Number(product.standard_cost)) || 0) * 100
          ) / 100;
        const qty = l.quantity;
        const lineTotal = Math.round(qty * price * 100) / 100;
        const taxRate = l.tax_rate ?? 18;
        subtotal += lineTotal;
        return {
          line_number: i + 1,
          product_id: l.product_id,
          description: l.description || product.name || "Item",
          quantity: qty,
          uom: l.uom || "EA",
          unit_price: price,
          tax_rate: taxRate,
          line_total: lineTotal,
        };
      });
      subtotal = Math.round(subtotal * 100) / 100;
      const taxAmount = Math.round(subtotal * 0.18 * 100) / 100;
      const total = Math.round((subtotal + taxAmount) * 100) / 100;

      const { count, error: countErr } = await admin
        .from("purchase_orders")
        .select("id", { count: "exact", head: true })
        .eq("company_id", companyId);
      if (countErr) return apiError("INTERNAL", countErr.message, 500);

      const { data: po, error: poErr } = await admin
        .from("purchase_orders")
        .insert({
          company_id: companyId,
          po_number: nextPoNumber(count ?? 0),
          supplier_id: data.supplier_id,
          warehouse_id: data.warehouse_id ?? null,
          order_date: new Date().toISOString().slice(0, 10),
          expected_date: data.expected_date ?? null,
          currency: data.currency || "UGX",
          subtotal,
          tax_amount: taxAmount,
          total_amount: total,
          status: "approved",
          po_type: data.po_type || "standard",
          payment_terms: data.payment_terms || "Net 30",
          notes: data.notes ?? null,
          approved_by: ctx.user.id,
          approved_at: new Date().toISOString(),
          created_by: ctx.user.id,
        })
        .select("*")
        .single();
      if (poErr || !po) {
        return apiError(
          "INTERNAL",
          poErr?.message ?? "Failed to create purchase order",
          500
        );
      }

      const { error: linesErr } = await admin.from("purchase_order_lines").insert(
        lineRows.map((l) => ({ ...l, po_id: po.id, company_id: companyId }))
      );
      if (linesErr) {
        await admin.from("purchase_orders").delete().eq("id", po.id).select();
        return apiError("INTERNAL", linesErr.message, 500);
      }

      await writeServerAudit(admin, {
        company_id: companyId,
        user_id: ctx.user.id,
        action: "procurement.po_created",
        module: "procurement",
        entity_type: "purchase_orders",
        entity_id: po.id,
        entity_reference: po.po_number,
        after_state: {
          supplier_id: po.supplier_id,
          lines: lineRows.length,
          total,
        },
        metadata: { source: "api/procurement/orders" },
        ip_address: ip,
        user_agent: req.headers.get("user-agent"),
      });

      return apiOk({ po }, { status: 201 });
    } catch (e) {
      return apiError(
        "INTERNAL",
        e instanceof Error ? e.message : "Purchase order creation failed",
        500
      );
    }
  }
);
