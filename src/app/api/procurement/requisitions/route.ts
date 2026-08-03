import { z } from "zod";
import { apiError, apiOk, createApiHandler } from "@/lib/api/handler";
import { createAdminClient } from "@/lib/supabase/admin";
import { writeServerAudit } from "@/lib/api/audit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const schema = z.object({
  product_id: z.string().uuid().optional().nullable(),
  quantity: z.number().positive(),
  department: z.string().max(100).optional(),
  request_type: z.string().max(50).optional(),
  priority: z.string().max(20).optional(),
  justification: z.string().max(2000).optional(),
  required_by: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .nullable(),
  warehouse_id: z.string().uuid().optional().nullable(),
  uom: z.string().max(30).optional(),
  suggested_supplier: z.string().max(255).optional().nullable(),
  dual_control_id: z.string().uuid().optional().nullable(),
});

function nextPrNumber(count: number): string {
  return `PR-${new Date().getFullYear()}-${String(count + 1).padStart(6, "0")}`;
}

/**
 * Submit a purchase requisition (money path).
 * Totals from product standard cost; company_id from session.
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
      let unitCost = 0;
      if (data.product_id) {
        const { data: product, error: prodErr } = await admin
          .from("products")
          .select("id,standard_cost")
          .eq("id", data.product_id)
          .eq("company_id", companyId)
          .maybeSingle();
        if (prodErr) return apiError("INTERNAL", prodErr.message, 500);
        if (!product) {
          return apiError("NOT_FOUND", "Product not found in this company", 404);
        }
        unitCost = Number(product.standard_cost) || 0;
      }

      const qty = data.quantity;
      const estimatedTotal = Math.round(unitCost * qty * 100) / 100;

      const { count, error: countErr } = await admin
        .from("purchase_requisitions")
        .select("id", { count: "exact", head: true })
        .eq("company_id", companyId);
      if (countErr) return apiError("INTERNAL", countErr.message, 500);

      const { data: pr, error: prErr } = await admin
        .from("purchase_requisitions")
        .insert({
          company_id: companyId,
          requisition_number: nextPrNumber(count ?? 0),
          product_id: data.product_id ?? null,
          warehouse_id: data.warehouse_id ?? null,
          quantity: qty,
          uom: data.uom || "EA",
          suggested_supplier: data.suggested_supplier ?? null,
          estimated_unit_cost: unitCost,
          estimated_total: estimatedTotal,
          department: data.department || "Production",
          request_type: data.request_type || "material",
          priority: data.priority || "medium",
          justification: data.justification || null,
          reason: data.justification || "Procurement request",
          required_by: data.required_by ?? null,
          status: "submitted",
          source: "manual",
          budget_ok: true,
          created_by: ctx.user.id,
        })
        .select("*")
        .single();
      if (prErr || !pr) {
        return apiError(
          "INTERNAL",
          prErr?.message ?? "Failed to create requisition",
          500
        );
      }

      await writeServerAudit(admin, {
        company_id: companyId,
        user_id: ctx.user.id,
        action: "procurement.requisition_submitted",
        module: "procurement",
        entity_type: "purchase_requisitions",
        entity_id: pr.id,
        entity_reference: pr.requisition_number,
        after_state: {
          product_id: pr.product_id,
          quantity: qty,
          estimated_total: estimatedTotal,
        },
        metadata: { source: "api/procurement/requisitions" },
        ip_address: ip,
        user_agent: req.headers.get("user-agent"),
      });

      return apiOk({ requisition: pr }, { status: 201 });
    } catch (e) {
      return apiError(
        "INTERNAL",
        e instanceof Error ? e.message : "Requisition creation failed",
        500
      );
    }
  }
);
