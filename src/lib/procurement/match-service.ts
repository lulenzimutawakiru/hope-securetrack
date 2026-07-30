/**
 * Persist three-way match results into srm_match_logs (server or client Supabase).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { evaluateThreeWayMatch, type ThreeWayMatchResult } from "./three-way-match";

export type PerformMatchInput = {
  companyId: string;
  actorId?: string | null;
  supplierId?: string | null;
  purchaseOrderId?: string | null;
  grnId?: string | null;
  apInvoiceId?: string | null;
  poAmount: number;
  grnAmount: number;
  invoiceAmount: number;
  absoluteTolerance?: number;
  relativeTolerance?: number;
  notes?: string;
};

export async function performThreeWayMatch(
  sb: SupabaseClient,
  input: PerformMatchInput
): Promise<{ result: ThreeWayMatchResult; log: Record<string, unknown> }> {
  const result = evaluateThreeWayMatch({
    poAmount: input.poAmount,
    grnAmount: input.grnAmount,
    invoiceAmount: input.invoiceAmount,
    absoluteTolerance: input.absoluteTolerance,
    relativeTolerance: input.relativeTolerance,
  });

  const noteText = [
    input.notes,
    ...result.notes,
    `tolerance=${result.toleranceUsed}`,
    result.canPay ? "can_pay=true" : "can_pay=false",
  ]
    .filter(Boolean)
    .join(" · ");

  const { data, error } = await sb
    .from("srm_match_logs")
    .insert({
      company_id: input.companyId,
      supplier_id: input.supplierId || null,
      purchase_order_id: input.purchaseOrderId || null,
      grn_id: input.grnId || null,
      ap_invoice_id: input.apInvoiceId || null,
      match_status: result.status,
      po_amount: input.poAmount,
      grn_amount: input.grnAmount,
      invoice_amount: input.invoiceAmount,
      variance: result.variance,
      notes: noteText,
      matched_by: input.actorId || null,
      matched_at: result.status === "matched" || result.status === "partial"
        ? new Date().toISOString()
        : null,
    })
    .select("*")
    .single();

  if (error) throw error;

  // Flag AP invoice when matched (best-effort — column may vary)
  if (input.apInvoiceId && (result.status === "matched" || result.status === "partial")) {
    try {
      await sb
        .from("ap_invoices")
        .update({
          three_way_matched: result.status === "matched",
          status: result.canPay ? "matched" : undefined,
          updated_at: new Date().toISOString(),
        })
        .eq("id", input.apInvoiceId)
        .eq("company_id", input.companyId);
    } catch {
      /* non-blocking */
    }
  }

  return { result, log: data as Record<string, unknown> };
}
