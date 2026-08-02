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

const ORDER_TYPES = [
  "standard",
  "blanket",
  "contract",
  "repeat",
  "rush",
  "government",
  "export",
] as const;

const schema = z.object({
  customer_id: z.string().uuid(),
  product_id: z.string().uuid(),
  quantity: z.number().int().positive(),
  unit_price: z.number().finite().nonnegative(),
  unit: z.string().max(20).default("carton"),
  order_type: z.enum(ORDER_TYPES).default("standard"),
  requires_production: z.boolean().default(false),
  notes: z.string().max(2000).optional().nullable(),
});

const TAX_RATE = 18; // UGX VAT, mirrors the legacy page

function dateStamp(d: Date): string {
  return d.toISOString().slice(0, 10).replace(/-/g, "");
}

function orderNumber(count: number): string {
  return `SO-${dateStamp(new Date())}-${String(count + 1).padStart(4, "0")}`;
}

async function rollbackOrder(
  admin: Awaited<ReturnType<typeof createAdminClient>>,
  orderId: string
): Promise<void> {
  await admin.from("sales_commissions").delete().eq("sales_order_id", orderId);
  await admin.from("credit_reviews").delete().eq("sales_order_id", orderId);
  await admin.from("sales_orders").delete().eq("id", orderId);
}

/**
 * Create a sales order (money path).
 *
 * Order amounts, credit review, and commission accrual are all computed
 * server-side. company_id / sales_rep_id come from the session, never the
 * body. Customer and product must belong to the caller's company.
 */
export async function POST(req: NextRequest) {
  const auth = await requireApiAuth({
    permissions: ["sales.view", "sales.manage"],
    allowPlatformAdmin: true,
    requireMfa: "privileged",
  });
  if ("response" in auth) return auth.response;

  const ip = clientIp(req);
  const rl = await rateLimitStrict(
    `sales-orders:${auth.ctx.user.id}:${ip}`,
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
  const now = new Date();
  const today = now.toISOString().slice(0, 10);

  try {
    const { data: customer, error: cusErr } = await admin
      .from("customers")
      .select("id, name, code, credit_limit, credit_status")
      .eq("id", parsed.data.customer_id)
      .eq("company_id", companyId)
      .maybeSingle();
    if (cusErr) return apiError("INTERNAL", cusErr.message, 500);
    if (!customer) {
      return apiError("NOT_FOUND", "Customer not found in this company", 404);
    }

    const { data: product, error: prodErr } = await admin
      .from("products")
      .select("id, name, product_code")
      .eq("id", parsed.data.product_id)
      .eq("company_id", companyId)
      .maybeSingle();
    if (prodErr) return apiError("INTERNAL", prodErr.message, 500);
    if (!product) {
      return apiError("NOT_FOUND", "Product not found in this company", 404);
    }

    const qty = parsed.data.quantity;
    const price = Math.round(parsed.data.unit_price * 100) / 100;
    const subtotal = Math.round(qty * price * 100) / 100;
    const tax = Math.round(subtotal * (TAX_RATE / 100) * 100) / 100;
    const total = Math.round((subtotal + tax) * 100) / 100;

    // Credit check: hold when the order would exceed the customer limit
    let creditApproved = true;
    let outstanding = 0;
    const limit = Number(customer.credit_limit || 0);
    if (limit > 0) {
      const { data: openInv, error: invErr } = await admin
        .from("invoices")
        .select("total_amount, amount_paid")
        .eq("customer_id", customer.id)
        .not("status", "in", '("paid","void","cancelled")');
      if (invErr) return apiError("INTERNAL", invErr.message, 500);
      outstanding = (openInv ?? []).reduce(
        (s, i) => s + (Number(i.total_amount) - Number(i.amount_paid)),
        0
      );
      creditApproved = outstanding + total <= limit;
    }

    const { count, error: countErr } = await admin
      .from("sales_orders")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId);
    if (countErr) return apiError("INTERNAL", countErr.message, 500);

    // Insert with count-based number; retry once on rare sequence collision.
    let order:
      | { id: string; order_number: string }
      | undefined;
    for (let attempt = 0; attempt < 2 && !order; attempt++) {
      const number = orderNumber((count ?? 0) + attempt);
      const { data: ins, error: insErr } = await admin
        .from("sales_orders")
        .insert({
          company_id: companyId,
          order_number: number,
          customer_id: customer.id,
          status: creditApproved ? "confirmed" : "draft",
          order_type: parsed.data.order_type,
          order_date: today,
          subtotal,
          tax_amount: tax,
          total_amount: total,
          currency: "UGX",
          credit_approved: creditApproved,
          requires_production: parsed.data.requires_production,
          sales_rep_id: auth.ctx.user.id,
          created_by: auth.ctx.user.id,
          notes: parsed.data.notes ?? null,
        })
        .select("id, order_number")
        .single();
      if (!insErr && ins) {
        order = ins;
      } else if (insErr && !String(insErr.code).startsWith("23")) {
        return apiError("INTERNAL", insErr.message, 500);
      }
    }
    if (!order) {
      return apiError("INTERNAL", "Failed to create sales order", 500);
    }

    const { error: lineErr } = await admin.from("sales_order_lines").insert({
      company_id: companyId,
      tenant_id: auth.ctx.tenantId,
      order_id: order.id,
      product_id: product.id,
      description: product.name ?? "Product",
      quantity: qty,
      unit: parsed.data.unit,
      unit_price: price,
      tax_rate: TAX_RATE,
    });
    if (lineErr) {
      await rollbackOrder(admin, order.id);
      return apiError("INTERNAL", lineErr.message, 500);
    }

    if (!creditApproved) {
      const { error: revErr } = await admin.from("credit_reviews").insert({
        company_id: companyId,
        customer_id: customer.id,
        sales_order_id: order.id,
        decision: "pending",
        status: "pending",
        credit_limit: limit,
        outstanding: Math.round(outstanding * 100) / 100,
        notes: "Auto-hold: order would exceed credit limit",
      });
      if (revErr) {
        await rollbackOrder(admin, order.id);
        return apiError("INTERNAL", revErr.message, 500);
      }
    } else {
      const { error: commErr } = await admin
        .from("sales_commissions")
        .insert({
          company_id: companyId,
          sales_rep_id: auth.ctx.user.id,
          sales_order_id: order.id,
          basis_amount: total,
          commission_pct: 3,
          commission_amount: Math.round(total * 0.03 * 100) / 100,
          currency: "UGX",
          status: "accrued",
          period_month: today,
          order_number: order.order_number,
        });
      if (commErr) {
        await rollbackOrder(admin, order.id);
        return apiError("INTERNAL", commErr.message, 500);
      }
    }

    await writeServerAudit(admin, {
      company_id: companyId,
      user_id: auth.ctx.user.id,
      action: "sales.order_created",
      module: "sales",
      entity_type: "sales_orders",
      entity_id: order.id,
      entity_reference: order.order_number,
      after_state: {
        customer_id: customer.id,
        product_id: product.id,
        quantity: qty,
        unit_price: price,
        subtotal,
        tax_amount: tax,
        total_amount: total,
        credit_approved: creditApproved,
        requires_production: parsed.data.requires_production,
      },
      metadata: { source: "api/sales/orders" },
      ip_address: ip,
      user_agent: req.headers.get("user-agent"),
    });

    return apiOk(
      {
        id: order.id,
        order_number: order.order_number,
        total_amount: total,
        credit_approved: creditApproved,
        status: creditApproved ? "confirmed" : "draft",
      },
      { status: 201 }
    );
  } catch (e) {
    return apiError(
      "INTERNAL",
      e instanceof Error ? e.message : "Sales order creation failed",
      500
    );
  }
}
