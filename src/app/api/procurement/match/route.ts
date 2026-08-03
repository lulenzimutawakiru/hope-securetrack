import { z } from "zod";
import { apiError, apiOk, createApiHandler } from "@/lib/api/handler";
import { createClient } from "@/lib/supabase/server";
import { performThreeWayMatch } from "@/lib/procurement/match-service";
import { evaluateThreeWayMatch } from "@/lib/procurement/three-way-match";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const schema = z.object({
  purchase_order_id: z.string().uuid().optional().nullable(),
  grn_id: z.string().uuid().optional().nullable(),
  ap_invoice_id: z.string().uuid().optional().nullable(),
  supplier_id: z.string().uuid().optional().nullable(),
  po_amount: z.number(),
  grn_amount: z.number(),
  invoice_amount: z.number(),
  absolute_tolerance: z.number().optional(),
  relative_tolerance: z.number().optional(),
  notes: z.string().max(500).optional(),
  dry_run: z.boolean().optional(),
});

/** Three-way match evaluation (+ optional persist) */
export const POST = createApiHandler(
  {
    auth: true,
    permissions: ["procurement.view", "procurement.manage", "finance.view"],
    allowPlatformAdmin: true,
    bodySchema: schema,
    rateLimit: { limit: 40, windowMs: 60_000 },
    module: "procurement",
  },
  async ({ ctx, body }) => {
    if (!ctx) return apiError("UNAUTHORIZED", "Sign in required", 401);
    const data = body as z.infer<typeof schema>;

    const result = evaluateThreeWayMatch({
      poAmount: data.po_amount,
      grnAmount: data.grn_amount,
      invoiceAmount: data.invoice_amount,
      absoluteTolerance: data.absolute_tolerance,
      relativeTolerance: data.relative_tolerance,
    });

    if (data.dry_run) {
      return apiOk({ result, persisted: false });
    }

    try {
      const sb = await createClient();
      const { log } = await performThreeWayMatch(sb, {
        companyId: ctx.companyId,
        actorId: ctx.user.id,
        supplierId: data.supplier_id,
        purchaseOrderId: data.purchase_order_id,
        grnId: data.grn_id,
        apInvoiceId: data.ap_invoice_id,
        poAmount: data.po_amount,
        grnAmount: data.grn_amount,
        invoiceAmount: data.invoice_amount,
        absoluteTolerance: data.absolute_tolerance,
        relativeTolerance: data.relative_tolerance,
        notes: data.notes,
      });
      return apiOk({ result, log, persisted: true });
    } catch (e) {
      return apiError(
        "INTERNAL",
        e instanceof Error ? e.message : "Match failed",
        500
      );
    }
  }
);
