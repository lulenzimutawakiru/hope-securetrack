import { createClient } from "@/lib/supabase/crud-compat";
import type { SalesDashboardStats } from "./types";

export async function getSalesDashboardStats(companyId: string): Promise<SalesDashboardStats> {
  const sb = createClient();
  const monthStart = new Date().toISOString().slice(0, 8) + "01";

  const [
    customers,
    openLeads,
    openOpps,
    { data: opps },
    openQuotes,
    { data: quotes },
    openOrders,
    { data: orders },
    returnsOpen,
    creditHolds,
    { data: commissions },
    contractsActive,
    { data: forecasts },
    { data: targets },
  ] = await Promise.all([
    sb.from("customers").select("*", { count: "exact", head: true }).eq("company_id", companyId).is("deleted_at", null),
    sb.from("sales_leads").select("*", { count: "exact", head: true }).eq("company_id", companyId).in("status", ["new", "contacted", "qualified"]).is("deleted_at", null),
    sb.from("sales_opportunities").select("*", { count: "exact", head: true }).eq("company_id", companyId).not("stage", "in", '("won","lost")').is("deleted_at", null),
    sb.from("sales_opportunities").select("expected_value,probability,stage").eq("company_id", companyId).not("stage", "in", '("won","lost")').is("deleted_at", null),
    sb.from("quotations").select("*", { count: "exact", head: true }).eq("company_id", companyId).in("status", ["draft", "sent"]).is("deleted_at", null),
    sb.from("quotations").select("total_amount,status").eq("company_id", companyId).in("status", ["draft", "sent"]).is("deleted_at", null),
    sb.from("sales_orders").select("*", { count: "exact", head: true }).eq("company_id", companyId).in("status", ["confirmed", "picking", "dispatched", "draft"]).is("deleted_at", null),
    sb.from("sales_orders").select("total_amount,status").eq("company_id", companyId).in("status", ["confirmed", "picking", "dispatched"]).is("deleted_at", null),
    sb.from("sales_returns").select("*", { count: "exact", head: true }).eq("company_id", companyId).in("status", ["requested", "approved", "received"]).is("deleted_at", null),
    sb.from("customers").select("*", { count: "exact", head: true }).eq("company_id", companyId).in("credit_status", ["hold", "blocked"]),
    sb.from("sales_commissions").select("commission_amount,status").eq("company_id", companyId).in("status", ["accrued", "approved"]).is("deleted_at", null),
    sb.from("sales_contracts").select("*", { count: "exact", head: true }).eq("company_id", companyId).eq("status", "active").is("deleted_at", null),
    sb.from("sales_forecasts").select("forecast_amount,committed_amount").eq("company_id", companyId).gte("created_at", monthStart).is("deleted_at", null),
    sb.from("sales_targets").select("target_amount,actual_amount,achievement_pct").eq("company_id", companyId).eq("status", "active").is("deleted_at", null).limit(20),
  ]);

  const pipelineValue = (opps || []).reduce((s, r) => s + Number(r.expected_value || 0), 0);
  const weightedPipeline = (opps || []).reduce(
    (s, r) => s + Number(r.expected_value || 0) * (Number(r.probability || 0) / 100),
    0
  );
  const quoteValue = (quotes || []).reduce((s, r) => s + Number(r.total_amount || 0), 0);
  const orderValue = (orders || []).reduce((s, r) => s + Number(r.total_amount || 0), 0);
  const commissionsDue = (commissions || []).reduce((s, r) => s + Number(r.commission_amount || 0), 0);
  const forecastMonth = (forecasts || []).reduce((s, r) => s + Number(r.forecast_amount || 0), 0);
  const targetSum = (targets || []).reduce((s, r) => s + Number(r.target_amount || 0), 0);
  const actualSum = (targets || []).reduce((s, r) => s + Number(r.actual_amount || 0), 0);
  const targetAchievement =
    targetSum > 0 ? Math.round((actualSum / targetSum) * 1000) / 10 : 0;

  return {
    customers: customers.count ?? 0,
    openLeads: openLeads.count ?? 0,
    openOpps: openOpps.count ?? 0,
    pipelineValue,
    weightedPipeline,
    openQuotes: openQuotes.count ?? 0,
    quoteValue,
    openOrders: openOrders.count ?? 0,
    orderValue,
    returnsOpen: returnsOpen.count ?? 0,
    creditHolds: creditHolds.count ?? 0,
    commissionsDue,
    contractsActive: contractsActive.count ?? 0,
    forecastMonth,
    targetAchievement,
  };
}
