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
export async function POST(req: NextRequest) {
  // Authenticated company users may evaluate match (RLS scopes writes).
  const auth = await requireApiAuth({ allowPlatformAdmin: true });
  if ("response" in auth) return auth.response;

  const ip = clientIp(req);
  const rl = await rateLimitStrict(
    `proc-match:${auth.ctx.user.id}:${ip}`,
    40,
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

  const result = evaluateThreeWayMatch({
    poAmount: parsed.data.po_amount,
    grnAmount: parsed.data.grn_amount,
    invoiceAmount: parsed.data.invoice_amount,
    absoluteTolerance: parsed.data.absolute_tolerance,
    relativeTolerance: parsed.data.relative_tolerance,
  });

  if (parsed.data.dry_run) {
    return apiOk({ result, persisted: false });
  }

  try {
    const sb = await createClient();
    const { log } = await performThreeWayMatch(sb, {
      companyId: auth.ctx.companyId,
      actorId: auth.ctx.user.id,
      supplierId: parsed.data.supplier_id,
      purchaseOrderId: parsed.data.purchase_order_id,
      grnId: parsed.data.grn_id,
      apInvoiceId: parsed.data.ap_invoice_id,
      poAmount: parsed.data.po_amount,
      grnAmount: parsed.data.grn_amount,
      invoiceAmount: parsed.data.invoice_amount,
      absoluteTolerance: parsed.data.absolute_tolerance,
      relativeTolerance: parsed.data.relative_tolerance,
      notes: parsed.data.notes,
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
