/** AI Security Analytics Engine */

export interface AuditAiInsight {
  type:
    | "fraud"
    | "access"
    | "export"
    | "privilege"
    | "anomaly"
    | "compliance"
    | "api";
  severity: "info" | "low" | "medium" | "high" | "critical";
  title: string;
  detail: string;
  risk_score: number;
  actions: string[];
}

export function generateAuditInsights(params: {
  failedLogins24h?: number;
  highRiskEvents?: number;
  openAlerts?: number;
  openIncidents?: number;
  sensitiveExports?: number;
  afterHoursExports?: number;
  salaryChanges?: number;
  massDeletes?: number;
  activeSessions?: number;
  apiRateLimited?: number;
  chainBroken?: boolean;
  nightActivity?: number;
}): AuditAiInsight[] {
  const insights: AuditAiInsight[] = [];

  if ((params.failedLogins24h || 0) >= 5) {
    insights.push({
      type: "access",
      severity: params.failedLogins24h! >= 15 ? "critical" : "high",
      title: `${params.failedLogins24h} failed login(s) in 24h`,
      detail: "Possible brute-force or credential stuffing. Consider lockouts and MFA enforcement.",
      risk_score: Math.min(95, 40 + params.failedLogins24h! * 3),
      actions: ["View failed logins", "Lock accounts", "Open incident"],
    });
  }

  if ((params.salaryChanges || 0) > 0) {
    insights.push({
      type: "fraud",
      severity: "high",
      title: `${params.salaryChanges} payroll/salary change event(s)`,
      detail: "High-value HR changes require dual control and before/after evidence review.",
      risk_score: 75,
      actions: ["Review salary events", "Approval chain"],
    });
  }

  if ((params.sensitiveExports || 0) > 0 || (params.afterHoursExports || 0) > 0) {
    insights.push({
      type: "export",
      severity: (params.afterHoursExports || 0) > 0 ? "high" : "medium",
      title: "Sensitive or after-hours data exports detected",
      detail: `${params.sensitiveExports || 0} sensitive · ${params.afterHoursExports || 0} after-hours. Monitor for exfiltration.`,
      risk_score: 70,
      actions: ["Export monitor", "Alert user"],
    });
  }

  if ((params.massDeletes || 0) > 0) {
    insights.push({
      type: "anomaly",
      severity: "critical",
      title: `${params.massDeletes} mass-delete pattern(s)`,
      detail: "Bulk deletions may indicate sabotage or compromised account.",
      risk_score: 90,
      actions: ["Investigate", "Suspend session"],
    });
  }

  if ((params.apiRateLimited || 0) > 0) {
    insights.push({
      type: "api",
      severity: "medium",
      title: `${params.apiRateLimited} rate-limit violation(s)`,
      detail: "API abuse or misconfigured integration clients.",
      risk_score: 50,
      actions: ["API audit", "Rotate keys"],
    });
  }

  if (params.chainBroken) {
    insights.push({
      type: "compliance",
      severity: "critical",
      title: "Audit integrity chain broken",
      detail: "Hash chain verification failed — treat as potential tampering; freeze exports and escalate.",
      risk_score: 99,
      actions: ["Verify chain", "Incident", "Legal hold"],
    });
  }

  if ((params.openAlerts || 0) > 0) {
    insights.push({
      type: "anomaly",
      severity: "medium",
      title: `${params.openAlerts} open security alert(s)`,
      detail: "Triage alerts before SLA breach; auto-create incidents for critical severity.",
      risk_score: 55,
      actions: ["Alerts", "Incidents"],
    });
  }

  if ((params.nightActivity || 0) > 10) {
    insights.push({
      type: "access",
      severity: "low",
      title: "Elevated night-time activity",
      detail: `${params.nightActivity} events outside business hours. Validate shift workers vs anomalies.`,
      risk_score: 35,
      actions: ["Live dashboard", "Filter night events"],
    });
  }

  if ((params.activeSessions || 0) > 0) {
    insights.push({
      type: "access",
      severity: "info",
      title: `${params.activeSessions} active session(s)`,
      detail: "Review concurrent sessions and MFA coverage on live security dashboard.",
      risk_score: 10,
      actions: ["Sessions"],
    });
  }

  if (insights.length === 0) {
    insights.push({
      type: "compliance",
      severity: "info",
      title: "Security posture nominal",
      detail: "No high-priority anomalies in current sample window. Continue continuous monitoring.",
      risk_score: 5,
      actions: ["Compliance", "Live dashboard"],
    });
  }

  return insights.sort((a, b) => b.risk_score - a.risk_score);
}

export function scoreEventRisk(input: {
  event_type?: string;
  severity?: string;
  crud_op?: string;
  module?: string;
  after_hours?: boolean;
  failed?: boolean;
}): number {
  let score = 5;
  const sev = input.severity || "info";
  if (sev === "low") score = 20;
  if (sev === "medium") score = 45;
  if (sev === "high") score = 70;
  if (sev === "critical") score = 90;

  if (input.failed || input.event_type?.includes("failed")) score += 20;
  if (input.crud_op === "delete") score += 15;
  if (input.module === "payroll" || input.module === "finance") score += 10;
  if (input.event_type?.includes("salary") || input.event_type?.includes("permission"))
    score += 20;
  if (input.after_hours) score += 15;

  return Math.min(100, score);
}

/** AI Audit Assistant — summarize, correlate, explain, executive brief */
export function summarizeAuditTrail(
  events: Array<Record<string, unknown>>
): string {
  if (!events.length) return "No events in the selected window.";
  const byModule = new Map<string, number>();
  const byUser = new Map<string, number>();
  let high = 0;
  for (const e of events) {
    const m = String(e.module || "other");
    byModule.set(m, (byModule.get(m) || 0) + 1);
    const u = String(e.user_email || e.username || "system");
    byUser.set(u, (byUser.get(u) || 0) + 1);
    if (Number(e.risk_score || 0) >= 70) high += 1;
  }
  const topModules = [...byModule.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  const topUsers = [...byUser.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  return [
    `Analyzed ${events.length} audit event(s).`,
    `High-risk events: ${high}.`,
    `Top modules: ${topModules.map(([k, v]) => `${k}(${v})`).join(", ") || "n/a"}.`,
    `Most active users: ${topUsers.map(([k, v]) => `${k}(${v})`).join(", ") || "n/a"}.`,
    high > 0
      ? "Recommend reviewing high-risk items in Alerts and opening investigations where dual-control is missing."
      : "Activity appears within normal risk thresholds for this sample.",
  ].join(" ");
}

export function correlateEvents(
  events: Array<Record<string, unknown>>
): Array<{ title: string; detail: string; event_ids: string[] }> {
  const groups = new Map<string, Array<Record<string, unknown>>>();
  for (const e of events) {
    const key =
      String(e.correlation_id || "") ||
      `${e.user_email || ""}|${e.module || ""}|${String(e.created_at || "").slice(0, 13)}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(e);
  }
  const out: Array<{ title: string; detail: string; event_ids: string[] }> = [];
  for (const [key, list] of groups) {
    if (list.length < 2) continue;
    out.push({
      title: `Correlated cluster (${list.length} events)`,
      detail: `Key ${key.slice(0, 48)} · modules: ${[...new Set(list.map((x) => x.module))].join(", ")}`,
      event_ids: list.map((x) => String(x.audit_id || x.id)),
    });
  }
  return out.slice(0, 15);
}

export function explainUnusualActivity(event: Record<string, unknown>): string {
  const parts: string[] = [];
  const risk = Number(event.risk_score || 0);
  parts.push(`Event ${event.audit_id || event.event_type} scored risk ${risk}/100.`);
  if (String(event.event_type).includes("failed") || String(event.event_type).includes("login_failed")) {
    parts.push("Failed authentication may indicate credential stuffing or a mistyped password.");
  }
  if (String(event.event_type).includes("salary") || event.module === "payroll") {
    parts.push("Payroll changes are high-value; verify dual approval and before/after amounts.");
  }
  if (event.crud_op === "delete") {
    parts.push("Deletes are irreversible from a business perspective; confirm authorization and soft-delete policy.");
  }
  if (Array.isArray(event.changed_fields) && event.changed_fields.length) {
    parts.push(`Changed fields: ${(event.changed_fields as string[]).join(", ")}.`);
  }
  if (risk >= 70) {
    parts.push("AI recommendation: open a security incident and freeze related sessions if compromise is suspected.");
  } else {
    parts.push("No critical anomaly heuristics triggered beyond baseline scoring.");
  }
  return parts.join(" ");
}

export function generateExecutiveSummary(input: {
  securityScore: number;
  complianceScore: number;
  activeIncidents: number;
  openAlerts: number;
  failedLogins24h: number;
  highRiskUserCount: number;
}): string {
  return [
    `Executive Security Brief`,
    `Security score: ${input.securityScore}/100 · Compliance score: ${input.complianceScore}/100.`,
    `Active incidents: ${input.activeIncidents} · Open alerts: ${input.openAlerts} · Failed logins (24h): ${input.failedLogins24h}.`,
    `High-risk users under watch: ${input.highRiskUserCount}.`,
    input.securityScore < 70
      ? "Posture: ATTENTION REQUIRED — escalate to IT Security and Compliance."
      : input.securityScore < 85
        ? "Posture: STABLE WITH GAPS — remediate open findings this sprint."
        : "Posture: HEALTHY — continue continuous monitoring and quarterly control reviews.",
    "Evidence packages available under Audit → Packages for ISO 27001 / SOC 2 / Uganda DPA.",
  ].join("\n");
}

export function recommendInvestigations(
  insights: Array<{ title: string; severity: string; risk_score?: number }>
): string[] {
  return insights
    .filter((i) => i.severity === "high" || i.severity === "critical" || (i.risk_score || 0) >= 70)
    .map((i) => `Investigate: ${i.title}`)
    .slice(0, 8);
}

export function generateComplianceEvidenceHints(frameworkCode: string): string[] {
  const common = [
    "Export period-scoped eal_events as control evidence",
    "Attach integrity checkpoint root hash",
    "Include approval chain for privileged changes",
  ];
  const map: Record<string, string[]> = {
    ISO27001: ["A.12.4.1 event logging samples", "A.12.4.2 log protection (immutability proof)"],
    SOC2: ["CC7.2 monitoring evidence", "CC6.1 access change samples"],
    GDPR: ["Art.30 processing access logs", "Art.32 security of processing — encryption/hash"],
    "UG-DPA": ["Safeguards evidence", "Data subject access fulfilment logs"],
    "FIN-AUDIT": ["Journal/invoice before-after trails", "Payment approval chains"],
  };
  return [...(map[frameworkCode] || []), ...common];
}

