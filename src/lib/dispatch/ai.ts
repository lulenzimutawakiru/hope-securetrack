/** AI Dispatch Assistant */

export interface DispatchAiInsight {
  type: "delay" | "fleet" | "route" | "maintenance" | "loading" | "fraud" | "schedule";
  severity: "info" | "low" | "medium" | "high";
  title: string;
  detail: string;
  actions: string[];
}

export function generateDispatchInsights(params: {
  pendingRequests?: number;
  inTransit?: number;
  failed?: number;
  availableVehicles?: number;
  availableDrivers?: number;
  openExceptions?: number;
  onTimePct?: number;
  idleVehicles?: number;
  loadingMismatches?: number;
}): DispatchAiInsight[] {
  const insights: DispatchAiInsight[] = [];

  if ((params.pendingRequests || 0) > 5) {
    insights.push({
      type: "schedule",
      severity: "medium",
      title: `${params.pendingRequests} pending dispatch requests`,
      detail: "Batch plan metro routes and assign vans for light parcels first.",
      actions: ["Planning", "Optimize routes"],
    });
  }

  if ((params.availableVehicles || 0) === 0 && (params.pendingRequests || 0) > 0) {
    insights.push({
      type: "fleet",
      severity: "high",
      title: "No vehicles available",
      detail: "Engage third-party transporter or free vehicles from completed trips.",
      actions: ["Fleet", "Exceptions"],
    });
  }

  if ((params.availableDrivers || 0) < (params.availableVehicles || 0)) {
    insights.push({
      type: "schedule",
      severity: "medium",
      title: "Driver shortage vs fleet",
      detail: "More vehicles than drivers — schedule OT or reallocate.",
      actions: ["Drivers", "HR"],
    });
  }

  if ((params.failed || 0) > 0) {
    insights.push({
      type: "delay",
      severity: "high",
      title: `${params.failed} failed delivery(ies)`,
      detail: "Open exceptions, notify customers, schedule reattempts.",
      actions: ["Exceptions", "Returns"],
    });
  }

  if ((params.openExceptions || 0) > 0) {
    insights.push({
      type: "delay",
      severity: "medium",
      title: `${params.openExceptions} open delivery exception(s)`,
      detail: "SLA risk — escalate to Service Desk if unresolved >4h.",
      actions: ["Exceptions", "Service desk"],
    });
  }

  if (params.onTimePct != null && params.onTimePct < 90) {
    insights.push({
      type: "route",
      severity: "medium",
      title: `On-time delivery ${params.onTimePct}%`,
      detail: "Re-optimize multi-stop sequences; avoid peak Kampala Road windows.",
      actions: ["Routes", "Analytics"],
    });
  }

  if ((params.idleVehicles || 0) > 0) {
    insights.push({
      type: "fleet",
      severity: "info",
      title: `${params.idleVehicles} idle vehicle(s)`,
      detail: "Assign pending light deliveries to improve utilization.",
      actions: ["Fleet", "Requests"],
    });
  }

  if ((params.loadingMismatches || 0) > 0) {
    insights.push({
      type: "loading",
      severity: "high",
      title: "Loading scan mismatches",
      detail: "Block dispatch until QR/carton counts match the packing list.",
      actions: ["Loading", "Packaging"],
    });
  }

  if ((params.inTransit || 0) > 0) {
    insights.push({
      type: "route",
      severity: "info",
      title: `${params.inTransit} shipment(s) in transit`,
      detail: "Monitor GPS ETAs and proactively notify customers of delays >15 min.",
      actions: ["Tracking", "Notifications"],
    });
  }

  if (insights.length === 0) {
    insights.push({
      type: "schedule",
      severity: "info",
      title: "Dispatch operations nominal",
      detail: "No critical constraints in current sample window.",
      actions: ["Dashboard", "Analytics"],
    });
  }

  return insights;
}

export function predictDelayMinutes(input: {
  distanceKm: number;
  stops: number;
  hourOfDay: number;
  rain?: boolean;
}): number {
  let d = input.distanceKm * 0.9 + input.stops * 8;
  if (input.hourOfDay >= 7 && input.hourOfDay <= 9) d += 18;
  if (input.hourOfDay >= 16 && input.hourOfDay <= 19) d += 22;
  if (input.rain) d += 15;
  return Math.round(d);
}
