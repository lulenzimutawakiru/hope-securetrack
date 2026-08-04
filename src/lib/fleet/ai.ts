import { mustList, persistInsights, type RuleInsight } from "@/lib/crud/ai-insights";

export type FleetInsight = RuleInsight & { id?: string; created_at?: string };

export async function generateFleetInsights(
  companyId: string
): Promise<FleetInsight[]> {
  void companyId;
  const insights: FleetInsight[] = [];

  const [vehicles, fuelTxns, workOrders, drivers, insurance, trips] =
    await Promise.all([
      mustList<Record<string, unknown>>("fleet_vehicles", { pageSize: 100 }),
      mustList<Record<string, unknown>>("fleet_fuel_transactions", {
        pageSize: 100,
        sort: "created_at",
        order: "desc",
      }),
      mustList<Record<string, unknown>>("fleet_work_orders", { pageSize: 100 }),
      mustList<Record<string, unknown>>("fleet_drivers", { pageSize: 100 }),
      mustList<Record<string, unknown>>("fleet_insurance_policies", {
        pageSize: 100,
      }),
      mustList<Record<string, unknown>>("fleet_trips", { pageSize: 100 }),
    ]);

  const inMaint = vehicles.filter((v) => String(v.status) === "maintenance")
    .length;
  const available = vehicles.filter((v) => String(v.status) === "available")
    .length;
  if (inMaint > 0) {
    insights.push({
      insight_type: "maintenance",
      title: `${inMaint} vehicle(s) in maintenance`,
      summary:
        "Capacity impact on dispatch — rebalance assignments and open work orders.",
      severity: inMaint >= 3 ? "warning" : "info",
      score: Math.min(95, 50 + inMaint * 10),
      recommendations: [
        "Prioritize open work orders by age",
        "Notify dispatch of temporary capacity",
      ],
    });
  }

  const pmDue = vehicles.filter((v) => {
    const cur = Number(v.current_odometer || 0);
    const next = Number(v.next_service_odometer || 0);
    return next > 0 && cur >= next - 500;
  });
  if (pmDue.length > 0) {
    insights.push({
      insight_type: "maintenance",
      title: `Preventive service due — ${pmDue.length} vehicle(s)`,
      summary:
        "Odometer thresholds approaching PM interval.",
      severity: "warning",
      score: 80,
      recommendations: ["Generate preventive work orders", "Book workshop capacity"],
    });
  }

  const anomalies = fuelTxns.filter((t) => t.anomaly_flag);
  if (anomalies.length > 0) {
    insights.push({
      insight_type: "fuel",
      title: `Fuel anomaly flags: ${anomalies.length}`,
      summary:
        "Abnormal consumption detected — possible theft, leak, or incorrect odometer.",
      severity: "critical",
      score: 88,
      recommendations: ["Cross-check GPS idle vs fuel", "Audit fuel card holders"],
    });
  }

  const openWo = workOrders.filter((w) =>
    ["open", "in_progress"].includes(String(w.status))
  ).length;
  if (openWo >= 5) {
    insights.push({
      insight_type: "workshop",
      title: `${openWo} open work orders`,
      summary: "Workshop backlog may delay vehicle availability.",
      severity: "warning",
      score: 70,
      recommendations: ["Triage by priority", "Add shift capacity"],
    });
  }

  const lowSafety = drivers.filter(
    (d) => Number(d.safety_score || 100) < 60
  ).length;
  if (lowSafety > 0) {
    insights.push({
      insight_type: "safety",
      title: `${lowSafety} driver(s) below safety threshold`,
      summary: "Coaching and ride-alongs recommended.",
      severity: "high",
      score: 75,
      recommendations: ["Schedule defensive driving", "Review trip exceptions"],
    });
  }

  void insurance;
  void trips;
  void available;

  await persistInsights("fleet_ai_insights", insights);
  return insights;
}

export async function listFleetInsights(companyId: string) {
  void companyId;
  const { listModuleInsights } = await import("@/lib/crud/ai-insights");
  return listModuleInsights("fleet_ai_insights");
}
