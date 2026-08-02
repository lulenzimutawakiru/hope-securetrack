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
  sales_order_id: z.string().uuid(),
  dual_control_id: z.string().uuid().optional().nullable(),
});

const ISSUABLE_STATUSES = ["confirmed", "picking", "dispatched", "completed"];

/**
 * Issue an invoice from a confirmed sales order (money path).
 *
 * Runs in a single server-side flow with the admin client so invoice + lines
 * + order status stay consistent. Company/tenant are derived from the session;
 * the sales_order_id is validated to belong to the caller's company.
 */
export async function POST(req: NextRequest) {
  const auth = await requireApiAuth({
    permissions: ["invoices.manage", "finance.manage", "finance.post", "finance.admin"],
    allowPlatformAdmin: true,
    requireMfa: "privileged",
  });
  if ("response" in auth) return auth.response;

  const ip = clientIp(req);
  const rl = await rateLimitStrict(
    `invoices-issue:${auth.ctx.user.id}:${ip}`,
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
    const { data: order, error: orderErr } = await admin
      .from("sales_orders")
      .select("*")
      .eq("id", parsed.data.sales_order_id)
      .eq("company_id", companyId)
      .maybeSingle();
    if (orderErr) return apiError("INTERNAL", orderErr.message, 500);
    if (!order) return apiError("NOT_FOUND", "Sales order not found", 404);
    if (!ISSUABLE_STATUSES.includes(String(order.status))) {
      return apiError(
        "VALIDATION",
        `Sales order status ${order.status} cannot be invoiced`,
        400
      );
    }

    const { data: orderLines, error: linesErr } = await admin
      .from("sales_order_lines")
      .select("*")
      .eq("order_id", order.id);
    if (linesErr) return apiError("INTERNAL", linesErr.message, 500);

    const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const random = Math.floor(Math.random() * 9000 + 1000);
    const invoiceNumber = `INV-${today}-${random}`;
    const due = new Date();
    due.setDate(due.getDate() + 30);

    const { data: inv, error: invErr } = await admin
      .from("invoices")
      .insert({
        company_id: companyId,
        invoice_number: invoiceNumber,
        sales_order_id: order.id,
        customer_id: order.customer_id ?? null,
        status: "issued",
        invoice_date: new Date().toISOString().slice(0, 10),
        due_date: due.toISOString().slice(0, 10),
        currency: order.currency ?? "UGX",
        subtotal: Number(order.subtotal ?? 0),
        tax_amount: Number(order.tax_amount ?? 0),
        discount_amount: Number(order.discount_amount ?? 0),
        total_amount: Number(order.total_amount ?? 0),
        amount_paid: 0,
        issued_by: auth.ctx.user.id,
      })
      .select("*")
      .single();
    if (invErr || !inv) {
      return apiError(
        "INTERNAL",
        invErr?.message ?? "Failed to create invoice",
        500
      );
    }

    if (orderLines?.length) {
      const { error: insErr } = await admin.from("invoice_lines").insert(
        orderLines.map((l) => ({
          invoice_id: inv.id,
          product_id: l.product_id ?? null,
          description: l.description ?? null,
          quantity: Number(l.quantity ?? 1),
          unit: l.unit ?? "carton",
          unit_price: Number(l.unit_price ?? 0),
          tax_rate: Number(l.tax_rate ?? 0),
        }))
      );
      if (insErr) {
        // Roll back the invoice so a partial write never persists.
        await admin.from("invoices").delete().eq("id", inv.id);
        return apiError("INTERNAL", insErr.message, 500);
      }
    }

    const { error: updErr } = await admin
      .from("sales_orders")
      .update({ status: "invoiced" })
      .eq("id", order.id);
    if (updErr) return apiError("INTERNAL", updErr.message, 500);

    await writeServerAudit(admin, {
      company_id: companyId,
      user_id: auth.ctx.user.id,
      action: "invoice.issue",
      module: "sales",
      entity_type: "invoices",
      entity_id: inv.id,
      entity_reference: invoiceNumber,
      after_state: {
        invoice_id: inv.id,
        sales_order_id: order.id,
        total_amount: inv.total_amount,
        line_count: orderLines?.length ?? 0,
      },
      metadata: { source: "api/invoices/issue" },
      ip_address: ip,
      user_agent: req.headers.get("user-agent"),
    });

    return apiOk({ invoice: inv, line_count: orderLines?.length ?? 0 });
  } catch (e) {
    return apiError(
      "INTERNAL",
      e instanceof Error ? e.message : "Invoice issue failed",
      500
    );
  }
}
