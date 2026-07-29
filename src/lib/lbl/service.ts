import { createClient } from "@/lib/supabase/client";
import type { LblDashboardStats } from "./types";

export async function getLabelsDashboardStats(companyId: string): Promise<LblDashboardStats> {
  const sb = createClient();

  const [
    templates,
    formats,
    materials,
    lowStock,
    openBatches,
    labelsReady,
    labelsPrinted,
    queuedJobs,
    failedJobs,
    pendingReprints,
    shippingReady,
    palletReady,
  ] = await Promise.all([
    sb.from("lbl_templates").select("*", { count: "exact", head: true }).eq("company_id", companyId).is("deleted_at", null),
    sb.from("lbl_formats").select("*", { count: "exact", head: true }).eq("company_id", companyId).is("deleted_at", null),
    sb.from("lbl_materials").select("*", { count: "exact", head: true }).eq("company_id", companyId).is("deleted_at", null),
    sb.from("lbl_stock").select("*", { count: "exact", head: true }).eq("company_id", companyId).eq("status", "low").is("deleted_at", null),
    sb.from("lbl_batches").select("*", { count: "exact", head: true }).eq("company_id", companyId).in("status", ["draft", "ready", "printing", "paused"]).is("deleted_at", null),
    sb.from("lbl_instances").select("*", { count: "exact", head: true }).eq("company_id", companyId).eq("status", "ready").is("deleted_at", null),
    sb.from("lbl_instances").select("*", { count: "exact", head: true }).eq("company_id", companyId).eq("status", "printed").is("deleted_at", null),
    sb.from("lbl_jobs").select("*", { count: "exact", head: true }).eq("company_id", companyId).eq("status", "queued").is("deleted_at", null),
    sb.from("lbl_jobs").select("*", { count: "exact", head: true }).eq("company_id", companyId).eq("status", "failed").is("deleted_at", null),
    sb.from("lbl_reprints").select("*", { count: "exact", head: true }).eq("company_id", companyId).eq("status", "pending").is("deleted_at", null),
    sb.from("lbl_shipping").select("*", { count: "exact", head: true }).eq("company_id", companyId).eq("status", "ready").is("deleted_at", null),
    sb.from("lbl_pallet").select("*", { count: "exact", head: true }).eq("company_id", companyId).eq("status", "ready").is("deleted_at", null),
  ]);

  return {
    templates: templates.count ?? 0,
    formats: formats.count ?? 0,
    materials: materials.count ?? 0,
    lowStock: lowStock.count ?? 0,
    openBatches: openBatches.count ?? 0,
    labelsReady: labelsReady.count ?? 0,
    labelsPrinted: labelsPrinted.count ?? 0,
    queuedJobs: queuedJobs.count ?? 0,
    failedJobs: failedJobs.count ?? 0,
    pendingReprints: pendingReprints.count ?? 0,
    shippingReady: shippingReady.count ?? 0,
    palletReady: palletReady.count ?? 0,
  };
}
