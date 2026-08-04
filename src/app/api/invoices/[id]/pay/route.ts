import { z } from "zod";
import { apiError, apiOk, createApiHandler } from "@/lib/api/handler";
import {
  adminGetById,
  adminInsert,
  adminUpdateById,
  assertScopedRow,
  createScopedAdminFromAuth,
} from "@/lib/supabase/scoped-admin";
import { writeServerAudit } from "@/lib/api/audit";
import { assertDualControl } from "@/lib/security/dual-control";
import { enqueueJob } from "@/lib/jobs/queue";

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
  dual_control_id: z.string().uuid().optional().nullable(),
});

/** Record a payment against an invoice (money path — dual-control in production). */
export const POST = createApiHandler(
  {
    auth: true,
    permissions: [
      "invoices.manage",
      "finance.manage",
      "finance.post",
      "finance.admin",
    ],
    allowPlatformAdmin: true,
    requireMfa: "privileged",
    bodySchema: schema,
    idempotent: true,
    rateLimit: { limit: 30, windowMs: 60_000 },
    module: "sales",
  },
  async ({ req, ctx, body, params, ip }) => {
    if (!ctx) return apiError("UNAUTHORIZED", "Sign in required", 401);
    const id = params.id;
    if (!id) return apiError("VALIDATION", "Invoice id required");
    const data = body as z.infer<typeof schema>;

    const dc = await assertDualControl({
      company_id: ctx.companyId,
      action: "billing.invoice_pay",
      actor_id: ctx.user.id,
      request_id: data.dual_control_id,
    });
    if (!dc.ok) return apiError("FORBIDDEN", dc.error, 403);

    const scoped = createScopedAdminFromAuth(ctx);
    const companyId = ctx.companyId;

    try {
      // invoices are company-scoped; tenant_id filter is optional (legacy rows)
      const inv = await adminGetById(scoped, "invoices", id);
      if (!inv) return apiError("NOT_FOUND", "Invoice not found", 404);
      assertScopedRow(
        scoped,
        { company_id: inv.company_id as string, tenant_id: inv.tenant_id as string | null },
        "invoice"
      );
      if (inv.status === "void" || inv.status === "cancelled") {
        return apiError(
          "VALIDATION",
          `Cannot pay a ${String(inv.status)} invoice`,
          400
        );
      }

      const amount = Math.round(data.amount * 100) / 100;
      const paidSoFar = Number(inv.amount_paid ?? 0);
      const total = Number(inv.total_amount ?? 0);
      if (paidSoFar + amount > total + 0.005) {
        return apiError(
          "VALIDATION",
          `Payment ${amount.toFixed(2)} exceeds outstanding balance ${Math.max(total - paidSoFar, 0).toFixed(2)}`,
          400
        );
      }

      const payment = await adminInsert(scoped, "invoice_payments", {
        invoice_id: inv.id,
        amount,
        payment_date:
          data.payment_date ?? new Date().toISOString().slice(0, 10),
        method: data.method,
        reference: data.reference ?? null,
        notes: data.notes ?? null,
        recorded_by: ctx.user.id,
      });

      const newPaid = Math.round((paidSoFar + amount) * 100) / 100;
      const status =
        newPaid >= total - 0.005
          ? "paid"
          : newPaid > 0
            ? "partially_paid"
            : String(inv.status);

      await adminUpdateById(scoped, "invoices", String(inv.id), {
        amount_paid: newPaid,
        status,
      });

      await writeServerAudit(scoped.client, {
        company_id: companyId,
        user_id: ctx.user.id,
        action: "invoice.payment_recorded",
        module: "sales",
        entity_type: "invoice_payments",
        entity_id: payment.id as string,
        entity_reference: inv.invoice_number as string,
        before_state: { amount_paid: paidSoFar, status: inv.status },
        after_state: {
          amount_paid: newPaid,
          status,
          payment_amount: amount,
        },
        metadata: {
          source: "api/invoices/[id]/pay",
          dual_control_id: data.dual_control_id ?? null,
        },
        ip_address: ip,
        user_agent: req.headers.get("user-agent"),
      });

      // Fan-out domain event via job queue (durable consumer)
      await enqueueJob(scoped.client, {
        companyId: ctx.companyId,
        tenantId: ctx.tenantId,
        jobType: "domain_event.consume",
        idempotencyKey: `invoice.paid:${payment.id}`,
        payload: {
          id: `synthetic-${payment.id}`,
          event_type: "invoice.paid",
          company_id: ctx.companyId,
          tenant_id: ctx.tenantId,
          payload: {
            invoice_id: inv.id,
            payment_id: payment.id,
            amount,
          },
        },
      });

      return apiOk({
        payment,
        invoice: { id: inv.id, amount_paid: newPaid, status },
      });
    } catch (e) {
      return apiError(
        "INTERNAL",
        e instanceof Error ? e.message : "Payment recording failed",
        500
      );
    }
  }
);
