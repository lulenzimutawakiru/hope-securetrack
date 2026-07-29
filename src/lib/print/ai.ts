/** AI Print Assistant */

export interface PrintAiInsight {
  type: "queue" | "device" | "media" | "security" | "cost";
  severity: "info" | "low" | "medium" | "high";
  title: string;
  detail: string;
  actions: string[];
}

export function generatePrintInsights(params: {
  offlinePrinters?: number;
  queuedJobs?: number;
  failedJobs?: number;
  lowMedia?: number;
  openService?: number;
  noDefaultPrinter?: boolean;
  lowToner?: number;
  openAlerts?: number;
  quotaNearLimit?: boolean;
  duplicateJobs?: number;
  heldSecure?: number;
  labelsPrintedMonth?: number;
}): PrintAiInsight[] {
  const insights: PrintAiInsight[] = [];

  if ((params.offlinePrinters || 0) > 0) {
    insights.push({
      type: "device",
      severity: "high",
      title: `${params.offlinePrinters} printer(s) offline`,
      detail: "Enable automatic failover and check agent heartbeat on print servers.",
      actions: ["Open registry", "Print servers", "Rediscover Niimbot"],
    });
  }

  if ((params.failedJobs || 0) > 0) {
    insights.push({
      type: "queue",
      severity: "medium",
      title: `${params.failedJobs} failed print job(s)`,
      detail: "Retry with failover printer or partial reprint for remaining labels.",
      actions: ["Open queue", "Reprint failed"],
    });
  }

  if ((params.queuedJobs || 0) > 20) {
    insights.push({
      type: "queue",
      severity: "medium",
      title: "Queue backlog high",
      detail: `${params.queuedJobs} jobs waiting — load-balance to warehouse industrial printers.`,
      actions: ["Open queue", "Print servers"],
    });
  }

  if ((params.lowMedia || 0) > 0 || (params.lowToner || 0) > 0) {
    insights.push({
      type: "media",
      severity: "low",
      title: "Consumables need attention",
      detail: `${params.lowMedia || 0} low media · ${params.lowToner || 0} low toner/ribbon. Predict replacement before production peak.`,
      actions: ["Consumables", "Open media", "Create PO"],
    });
  }

  if ((params.openAlerts || 0) > 0) {
    insights.push({
      type: "device",
      severity: "medium",
      title: `${params.openAlerts} open print alert(s)`,
      detail: "Review offline, maintenance-due, and quota warnings.",
      actions: ["Alerts", "Maintenance"],
    });
  }

  if (params.quotaNearLimit) {
    insights.push({
      type: "cost",
      severity: "medium",
      title: "Print quota near limit",
      detail: "Department or company monthly page/label quota is ≥85% used.",
      actions: ["Quotas", "Analytics"],
    });
  }

  if ((params.duplicateJobs || 0) > 0) {
    insights.push({
      type: "queue",
      severity: "high",
      title: `${params.duplicateJobs} possible duplicate job(s)`,
      detail: "Same document/serial submitted twice — cancel duplicates before print.",
      actions: ["Open queue"],
    });
  }

  if ((params.heldSecure || 0) > 0) {
    insights.push({
      type: "security",
      severity: "info",
      title: `${params.heldSecure} secure-release job(s) waiting`,
      detail: "Users must enter PIN at device or release from mobile for confidential docs.",
      actions: ["Secure release", "Queue"],
    });
  }

  if (params.noDefaultPrinter) {
    insights.push({
      type: "device",
      severity: "info",
      title: "No default printer set",
      detail: "Set a default Niimbot or Zebra for faster label queueing.",
      actions: ["Open registry"],
    });
  }

  if ((params.labelsPrintedMonth || 0) > 0) {
    const forecast = Math.round((params.labelsPrintedMonth || 0) * 1.15);
    insights.push({
      type: "cost",
      severity: "info",
      title: "Label volume forecast",
      detail: `Based on ${params.labelsPrintedMonth} labels this period, next month ~${forecast.toLocaleString()} (+15%).`,
      actions: ["Analytics", "Media"],
    });
  }

  insights.push({
    type: "security",
    severity: "info",
    title: "Security paper tip",
    detail: "Use anti-copy backgrounds + microtext + SIG hash for Hope security certificates and product auth labels.",
    actions: ["Secure PDF", "Security profiles"],
  });

  return insights;
}

export function suggestPrinterForDocument(docType: string): string {
  const map: Record<string, string> = {
    qr_auth: "Niimbot B21 / thermal label (50×30)",
    shipping: "Zebra industrial (100×150)",
    invoice: "HP/Canon A4 laser",
    receipt: "Epson TM series",
    id_card: "Evolis / HID Fargo card printer",
    shelf: "Zebra / TSC warehouse label",
  };
  return map[docType] || "Default office or label printer per routing rules";
}
