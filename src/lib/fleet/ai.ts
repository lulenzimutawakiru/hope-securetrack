import { createClient } from "@/lib/supabase/client";

export type FleetInsight = {
  id?: string;
  insight_type: string;
  title: string;
  summary: string;
  severity: string;
  score?: number;
  recommendations?: string[];
  status?: string;
  created_at?: string;
};

/** Rule-based AI insights from live fleet data (extendable to LLM). */
export async function generateFleetInsights(companyId: string): Promise<FleetInsight[]> {
  const sb = createClient();
  const insights: FleetInsight[] = [];

  const [
    { data: vehicles },
    { data: fuelTxns },
    { data: workOrders },
    { data: drivers },
    { data: insurance },
    { data: trips },
  ] = await Promise.all([
    sb
      .from("fleet_vehicles")
      .select("id,registration,status,current_odometer,next_service_odometer,insurance_expiry")
      .eq("company_id", companyId)
      .is("deleted_at", null)
      .limit(200),
    sb
      .from("fleet_fuel_transactions")
      .select("litres,total_cost,anomaly_flag,registration")
      .eq("company_id", companyId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(100),
    sb
      .from("fleet_work_orders")
      .select("status,total_cost,work_type")
      .eq("company_id", companyId)
      .is("deleted_at", null)
      .limit(100),
    sb
      .from("fleet_drivers")
      .select("status,safety_score,performance_score,license_expiry")
      .eq("company_id", companyId)
      .is("deleted_at", null)
      .limit(100),
    sb
      .from("fleet_insurance_policies")
      .select("expiry_date,status,registration")
      .eq("company_id", companyId)
      .is("deleted_at", null)
      .limit(100),
    sb
      .from("fleet_trips")
      .select("status,planned_distance_km,actual_distance_km")
      .eq("company_id", companyId)
      .is("deleted_at", null)
      .limit(100),
  ]);

  const vList = vehicles || [];
  const inMaint = vList.filter((v) => String(v.status) === "maintenance").length;
  const available = vList.filter((v) => String(v.status) === "available").length;
  const util =
    vList.length > 0
      ? Math.round(((vList.length - available) / vList.length) * 100)
      : 0;

  if (inMaint > 0) {
    insights.push({
      insight_type: "maintenance",
      title: `${inMaint} vehicle(s) in maintenance`,
      summary: "Capacity impact on dispatch — rebalance assignments and open work orders.",
      severity: inMaint >= 3 ? "warning" : "info",
      score: Math.min(95, 50 + inMaint * 10),
      recommendations: [
        "Prioritize open work orders by age",
        "Notify dispatch of temporary capacity",
        "Pull spares for active WO lines",
      ],
    });
  }

  const pmDue = vList.filter((v) => {
    const cur = Number(v.current_odometer || 0);
    const next = Number(v.next_service_odometer || 0);
    return next > 0 && cur >= next - 500;
  });
  if (pmDue.length > 0) {
    insights.push({
      insight_type: "maintenance",
      title: `Preventive service due — ${pmDue.length} vehicle(s)`,
      summary: "Odometer thresholds approaching PM interval. Auto-create work orders recommended.",
      severity: "warning",
      score: 80,
      recommendations: [
        "Generate preventive work orders",
        "Book workshop capacity",
        "Pre-order lubricants and filters",
      ],
    });
  }

  const anomalies = (fuelTxns || []).filter((t) => t.anomaly_flag);
  if (anomalies.length > 0) {
    insights.push({
      insight_type: "fuel",
      title: `Fuel anomaly flags: ${anomalies.length}`,
      summary: "Abnormal consumption detected — possible theft, leak, or incorrect odometer.",
      severity: "critical",
      score: 88,
      recommendations: [
        "Cross-check GPS idle vs fuel",
        "Audit fuel card holders",
        "Inspect tanks for siphoning",
      ],
    });
  }

  const fuelCost = (fuelTxns || []).reduce((s, t) => s + Number(t.total_cost || 0), 0);
  if (fuelCost > 0) {
    insights.push({
      insight_type: "cost",
      title: "Fuel cost pressure",
      summary: `Recent fuel postings total ${Math.round(fuelCost).toLocaleString()}. Optimize routes and idling.`,
      severity: "info",
      score: 62,
      recommendations: [
        "Consolidate multi-stop routes",
        "Coach high-idle drivers",
        "Compare station unit prices",
      ],
    });
  }

  const openWo = (workOrders || []).filter((w) =>
    ["open", "assigned", "in_progress", "waiting_parts"].includes(String(w.status))
  );
  if (openWo.length > 5) {
    insights.push({
      insight_type: "maintenance",
      title: `Workshop backlog: ${openWo.length} open orders`,
      summary: "Queue building — risk of extended downtime and missed deliveries.",
      severity: "warning",
      score: 74,
      recommendations: [
        "Escalate waiting_parts orders",
        "Add overtime mechanics if critical",
        "Outsource non-core jobs",
      ],
    });
  }

  const lowSafety = (drivers || []).filter((d) => Number(d.safety_score || 100) < 70);
  if (lowSafety.length > 0) {
    insights.push({
      insight_type: "safety",
      title: `${lowSafety.length} driver(s) below safety threshold`,
      summary: "Unsafe driving patterns require coaching and possible temporary reassignment.",
      severity: "critical",
      score: 90,
      recommendations: [
        "Schedule defensive driving training",
        "Enable speed alerts",
        "Pair with senior driver mentor",
      ],
    });
  }

  const soon = new Date();
  soon.setDate(soon.getDate() + 30);
  const expiringIns = (insurance || []).filter((p) => {
    if (!p.expiry_date) return false;
    return new Date(String(p.expiry_date)) <= soon;
  });
  if (expiringIns.length > 0) {
    insights.push({
      insight_type: "compliance",
      title: `${expiringIns.length} insurance polic(ies) expiring in 30 days`,
      summary: "Compliance risk — vehicles may be grounded if not renewed.",
      severity: "warning",
      score: 82,
      recommendations: [
        "Start renewal with insurers",
        "Block dispatch for expired units",
        "Notify finance for premium budget",
      ],
    });
  }

  const delayed = (trips || []).filter((t) => String(t.status) === "delayed").length;
  if (delayed > 0) {
    insights.push({
      insight_type: "operations",
      title: `${delayed} delayed trip(s)`,
      summary: "ETA slippage impacts customer SLAs and warehouse dock schedules.",
      severity: "warning",
      score: 70,
      recommendations: [
        "Recalculate ETAs from GPS",
        "Notify customers via Communications Hub",
        "Reassign nearby available vehicles",
      ],
    });
  }

  insights.push({
    insight_type: "utilization",
    title: `Fleet utilization ~${util}%`,
    summary:
      util < 40
        ? "Under-utilized fleet — consolidate routes or reassign idle units."
        : util > 90
          ? "High utilization — consider rental surge capacity."
          : "Utilization within healthy band.",
    severity: util > 90 || util < 35 ? "warning" : "info",
    score: util,
    recommendations:
      util < 40
        ? ["Share capacity with production transport", "Park high-cost idle trucks"]
        : ["Maintain balanced dispatch windows", "Track cost per km by vehicle"],
  });

  // Persist open insights snapshot
  try {
    for (const ins of insights.slice(0, 6)) {
      await sb.from("fleet_ai_insights").insert({
        company_id: companyId,
        insight_type: ins.insight_type,
        title: ins.title,
        summary: ins.summary,
        severity: ins.severity,
        score: ins.score,
        recommendations: ins.recommendations || [],
        status: "open",
      });
    }
  } catch {
    /* non-blocking */
  }

  return insights;
}

export async function listFleetInsights(companyId: string) {
  const { data, error } = await createClient()
    .from("fleet_ai_insights")
    .select("*")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return data || [];
}
