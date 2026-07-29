/** AI Packaging Assistant */

export interface PkgAiInsight {
  type: "waste" | "material" | "line" | "cost" | "layout" | "green";
  severity: "info" | "low" | "medium" | "high";
  title: string;
  detail: string;
  actions: string[];
}

export function generatePackagingInsights(params: {
  openWorkOrders?: number;
  lowMaterials?: number;
  lineDowntime?: number;
  defectsToday?: number;
  cartonUtilization?: number;
  pendingQc?: number;
  unitsPackedToday?: number;
}): PkgAiInsight[] {
  const insights: PkgAiInsight[] = [];

  if ((params.openWorkOrders || 0) > 0) {
    insights.push({
      type: "line",
      severity: "medium",
      title: `${params.openWorkOrders} open packing work order(s)`,
      detail: "Release and assign lines to clear production backlog.",
      actions: ["Work orders", "Packing floor"],
    });
  }

  if ((params.lowMaterials || 0) > 0) {
    insights.push({
      type: "material",
      severity: "high",
      title: `${params.lowMaterials} packaging material(s) below reorder`,
      detail: "Cartons, labels, or seals may stock-out mid-shift.",
      actions: ["Materials", "Create PR"],
    });
  }

  if ((params.lineDowntime || 0) > 0) {
    insights.push({
      type: "line",
      severity: "medium",
      title: `${params.lineDowntime} packing line(s) in downtime`,
      detail: "Check labor, materials, or equipment before next WO.",
      actions: ["Lines"],
    });
  }

  if ((params.defectsToday || 0) > 0) {
    insights.push({
      type: "waste",
      severity: "high",
      title: `${params.defectsToday} packing defect(s) today`,
      detail: "Review QC fail reasons — labels, seals, weight, QR scans.",
      actions: ["QC", "Floor"],
    });
  }

  if (params.cartonUtilization != null && params.cartonUtilization < 0.7) {
    insights.push({
      type: "layout",
      severity: "low",
      title: "Carton utilization under 70%",
      detail: "Consider smaller carton size or mixed packs to cut waste.",
      actions: ["Cartonization", "Rules"],
    });
  }

  if ((params.pendingQc || 0) > 0) {
    insights.push({
      type: "line",
      severity: "info",
      title: `${params.pendingQc} items awaiting packing QC`,
      detail: "Clear QC to release pallets to warehouse.",
      actions: ["QC"],
    });
  }

  insights.push({
    type: "green",
    severity: "info",
    title: "Sustainability tip",
    detail: "Prefer recycled carton stock for export pallets; optimize to 40 cartons/pallet for A4 to reduce wood pallets.",
    actions: ["Materials", "Rules"],
  });

  if ((params.unitsPackedToday || 0) > 0) {
    insights.push({
      type: "cost",
      severity: "info",
      title: "Today's packing volume",
      detail: `${params.unitsPackedToday} units packed. Forecast materials for tomorrow at +10%.`,
      actions: ["Analytics", "Materials"],
    });
  }

  return insights;
}

export function recommendPackaging(units: number, product = "Premium A4"): string {
  const cartons = Math.ceil(units / 5);
  const pallets = Math.ceil(cartons / 40);
  return `${product}: pack ${units} reams → ${cartons} cartons (5/ream) → ${pallets} pallet(s) @ 40 cartons. Use CTN-A4-5 + security seal + dual QR (ream + carton).`;
}
