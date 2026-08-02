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
  amount: z.number().positive(),
  method: z.string().min(1).max(50).default("bank_transfer"),
  reference: z.string().max(100).optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
  payment_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "payment_date must be YYYY-MM-DD")
    .optional(),
});

/**
 * Record a payment against an invoice (money path).
 *
 * The invoice is fetched server-side and scoped to the caller's company.
 * Overpayment is rejected before the payment row is written. The payment and
 * the invoice amount_paid/status update happen with the admin client so the
 * money state stays consistent.
 */
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiAuth({
    permissions: ["invoices.manage", "finance.manage", "finance.post", "finance.admin"],
    allowPlatformAdmin: true,
    requireMfa: "privileged",
  });
  if ("response" in auth) return auth.response;

  const ip = clientIp(req);
  const rl = await rateLimitStrict(
    `invoice-pay:${auth.ctx.user.id}:${ip}`,
    30,
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
    if (inv.status === "void" || inv.status === "cancelled") {
      return apiError("VALIDATION", `Cannot pay a ${inv.status} invoice`, 400);
    }

    const amount = Math.round(parsed.data.amount * 100) / 100;
    const paidSoFar = Number(inv.amount_paid ?? 0);
    const total = Number(inv.total_amount ?? 0);
    if (paidSoFar + amount > total + 0.005) {
      return apiError(
        "VALIDATION",
        `Payment ${amount.toFixed(2)} exceeds outstanding balance ${Math.max(total - paidSoFar, 0).toFixed(2)}`,
        400
      );
    }

    const { data: payment, error: payErr } = await admin
      .from("invoice_payments")
      .insert({
        invoice_id: inv.id,
        company_id: companyId,
        amount,
        payment_date: parsed.data.payment_date ?? new Date().toISOString().slice(0, 10),
        method: parsed.data.method,
        reference: parsed.data.reference ?? null,
        notes: parsed.data.notes ?? null,
        recorded_by: auth.ctx.user.id,
      })
      .select("*")
      .single();
    if (payErr || !payment) {
      return apiError("INTERNAL", payErr?.message ?? "Failed to record payment", 500);
    }

    const newPaid = Math.round((paidSoFar + amount) * 100) / 100;
    const status =
      newPaid >= total - 0.005
        ? "paid"
        : newPaid > 0
          ? "partially_paid"
          : inv.status;

    const { error: updErr } = await admin
      .from("invoices")
      .update({ amount_paid: newPaid, status })
      .eq("id", inv.id);
    if (updErr) return apiError("INTERNAL", updErr.message, 500);

    await writeServerAudit(admin, {
      company_id: companyId,
      user_id: auth.ctx.user.id,
      action: "invoice.payment_recorded",
      module: "sales",
      entity_type: "invoice_payments",
      entity_id: payment.id,
      entity_reference: inv.invoice_number,
      before_state: { amount_paid: paidSoFar, status: inv.status },
      after_state: { amount_paid: newPaid, status, payment_amount: amount },
      metadata: { source: "api/invoices/[id]/pay" },
      ip_address: ip,
      user_agent: req.headers.get("user-agent"),
    });

    return apiOk({ payment, invoice: { id: inv.id, amount_paid: newPaid, status } });
  } catch (e) {
    return apiError(
      "INTERNAL",
      e instanceof Error ? e.message : "Payment recording failed",
      500
    );
  }
}
