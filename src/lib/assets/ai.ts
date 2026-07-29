/** AI Asset Assistant */

export interface AssetAiInsight {
  type: "maintenance" | "movement" | "utilization" | "budget" | "duplicate" | "lifecycle";
  severity: "info" | "low" | "medium" | "high";
  title: string;
  detail: string;
  actions: string[];
}

export function generateAssetInsights(params: {
  totalAssets?: number;
  assigned?: number;
  missing?: number;
  maintenanceDue?: number;
  warrantyExpiring?: number;
  openAlerts?: number;
  underutilized?: number;
  totalValue?: number;
}): AssetAiInsight[] {
  const insights: AssetAiInsight[] = [];

  if ((params.missing || 0) > 0) {
    insights.push({
      type: "movement",
      severity: "high",
      title: `${params.missing} asset(s) marked missing`,
      detail: "Run RFID/QR audit sweeps in last known locations.",
      actions: ["Start audit", "Open missing list"],
    });
  }

  if ((params.maintenanceDue || 0) > 0) {
    insights.push({
      type: "maintenance",
      severity: "medium",
      title: `${params.maintenanceDue} asset(s) due for maintenance/calibration`,
      detail: "Schedule preventive work before production impact.",
      actions: ["Maintenance", "Create WO"],
    });
  }

  if ((params.warrantyExpiring || 0) > 0) {
    insights.push({
      type: "lifecycle",
      severity: "medium",
      title: `${params.warrantyExpiring} warranty/AMC expiring soon`,
      detail: "Renew AMC or plan replacements in capital budget.",
      actions: ["Warranty alerts", "Finance"],
    });
  }

  if ((params.openAlerts || 0) > 0) {
    insights.push({
      type: "movement",
      severity: "medium",
      title: `${params.openAlerts} open asset alert(s)`,
      detail: "Review unauthorized movement, duplicates, and overdue returns.",
      actions: ["Alerts"],
    });
  }

  if (params.totalAssets && params.assigned != null) {
    const util = params.assigned / Math.max(1, params.totalAssets);
    if (util < 0.5) {
      insights.push({
        type: "utilization",
        severity: "low",
        title: "Low assignment utilization",
        detail: `Only ${Math.round(util * 100)}% of assets assigned. Reallocate idle IT/fleet assets.`,
        actions: ["Register", "Assignments"],
      });
    }
  }

  if ((params.underutilized || 0) > 0) {
    insights.push({
      type: "utilization",
      severity: "info",
      title: `${params.underutilized} underutilized asset(s)`,
      detail: "Consider reassignment or disposal to free capital.",
      actions: ["Analytics"],
    });
  }

  if ((params.totalValue || 0) > 0) {
    insights.push({
      type: "budget",
      severity: "info",
      title: "Asset portfolio value",
      detail: `Tracked current value ≈ UGX ${Math.round(params.totalValue || 0).toLocaleString()}. Forecast 5% refresh budget.`,
      actions: ["Analytics", "Finance assets"],
    });
  }

  insights.push({
    type: "duplicate",
    severity: "info",
    title: "Duplicate detection tip",
    detail: "Scan serial numbers on registration; system flags matching manufacturer serials.",
    actions: ["Register", "Import"],
  });

  return insights;
}

export function estimateRemainingLife(
  purchaseDate: string | null,
  usefulMonths: number
): { remainingMonths: number; pct: number } {
  if (!purchaseDate) return { remainingMonths: usefulMonths, pct: 100 };
  const start = new Date(purchaseDate).getTime();
  const now = Date.now();
  const used = Math.max(0, (now - start) / (30.44 * 24 * 3600 * 1000));
  const remaining = Math.max(0, usefulMonths - used);
  return {
    remainingMonths: Math.round(remaining),
    pct: Math.round((remaining / Math.max(1, usefulMonths)) * 100),
  };
}
