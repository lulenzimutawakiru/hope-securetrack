/** Audit report runners & score calculators — CRUD-backed (no browser client). */

import {
  crudCount,
  mustCreate,
  mustList,
} from "@/lib/crud/domain-helpers";

export interface SecurityScores {
  securityScore: number;
  complianceScore: number;
  activeIncidents: number;
  openAlerts: number;
  highRiskUsers: Array<{
    email: string;
    name: string;
    risk: number;
    events: number;
  }>;
  failedLogins24h: number;
  mfaCoverage: number;
  chainHealthy: boolean;
}

export async function computeSecurityScores(
  companyId?: string
): Promise<SecurityScores> {
  void companyId;
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();

  const [
    events,
    failedLogins24h,
    openAlerts,
    openIncidents,
    investigating,
    sessions,
    controls,
    openFindings,
  ] = await Promise.all([
    mustList<Record<string, unknown>>("eal_events", { pageSize: 100 }),
    crudCount("eal_events", {
      event_type: "login_failed",
      created_at: { gte: since },
    }),
    crudCount("eal_alerts", { status: "open" }),
    crudCount("eal_incidents", { status: "open" }),
    crudCount("eal_incidents", { status: "investigating" }),
    mustList<Record<string, unknown>>("eal_sessions", {
      pageSize: 100,
      filters: { status: "active" },
    }),
    mustList<Record<string, unknown>>("eal_controls", { pageSize: 100 }),
    crudCount("eal_findings", { status: "open" }),
  ]);

  const byUser = new Map<
    string,
    { email: string; name: string; risk: number; events: number }
  >();
  for (const e of events) {
    const email = String(e.user_email || "unknown");
    const cur = byUser.get(email) || {
      email,
      name: String(e.full_name || email),
      risk: 0,
      events: 0,
    };
    cur.events += 1;
    cur.risk = Math.max(cur.risk, Number(e.risk_score || 0));
    byUser.set(email, cur);
  }
  const highRiskUsers = Array.from(byUser.values())
    .filter((u) => u.risk >= 50 || u.events >= 20)
    .sort((a, b) => b.risk - a.risk)
    .slice(0, 10);

  const mfaCoverage =
    sessions.length === 0
      ? 100
      : Math.round(
          (sessions.filter((s) => s.mfa_verified).length / sessions.length) *
            100
        );

  const implemented = controls.filter((c) => c.status === "implemented").length;
  const complianceScore =
    controls.length === 0
      ? 70
      : Math.round((implemented / controls.length) * 100) -
        Math.min(20, openFindings * 3);

  const activeIncidents = openIncidents + investigating;
  let securityScore = 100;
  securityScore -= Math.min(30, failedLogins24h * 2);
  securityScore -= Math.min(25, openAlerts * 5);
  securityScore -= Math.min(25, activeIncidents * 10);
  securityScore -= Math.max(0, 100 - mfaCoverage) * 0.2;
  securityScore = Math.max(0, Math.min(100, Math.round(securityScore)));

  return {
    securityScore,
    complianceScore: Math.max(0, Math.min(100, complianceScore)),
    activeIncidents,
    openAlerts,
    highRiskUsers,
    failedLogins24h,
    mfaCoverage,
    chainHealthy: true,
  };
}

export type ReportCode =
  | "USER-ACTIVITY"
  | "LOGIN-HISTORY"
  | "PERM-CHANGES"
  | "FIN-TRAIL"
  | "INV-TRAIL"
  | "PROD-TRAIL"
  | "PAY-TRAIL"
  | "DOC-ACCESS"
  | "DATA-EXPORT"
  | "PRINT-USAGE"
  | "EXEC-SUMMARY";

export async function runAuditReport(input: {
  company_id: string;
  report_code: string;
  period_start?: string;
  period_end?: string;
  run_by?: string | null;
}) {
  const start =
    input.period_start ||
    new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
  const end = input.period_end || new Date().toISOString();
  const periodFilter = { created_at: { gte: start, lte: end } };

  let rows: Array<Record<string, unknown>> = [];
  let summary: Record<string, unknown> = {};

  const listEvents = async (extra?: Record<string, unknown>) =>
    mustList<Record<string, unknown>>("eal_events", {
      pageSize: 100,
      sort: "created_at",
      order: "desc",
      filters: { ...periodFilter, ...extra },
    });

  switch (input.report_code) {
    case "LOGIN-HISTORY":
      rows = await listEvents({ event_type: "login_failed" });
      // also attempt login_success if present
      rows = rows.concat(
        await listEvents({ event_type: "login_success" }).catch(() => [])
      );
      summary = { total: rows.length };
      break;
    case "PERM-CHANGES":
      rows = await listEvents({ module: "iam" });
      summary = { total: rows.length };
      break;
    case "FIN-TRAIL":
      rows = await listEvents({ module: "finance" });
      summary = { total: rows.length };
      break;
    case "INV-TRAIL":
      rows = await listEvents({ module: "inventory" });
      summary = { total: rows.length };
      break;
    case "PROD-TRAIL":
      rows = await listEvents({ module: "production" });
      summary = { total: rows.length };
      break;
    case "PAY-TRAIL":
      rows = await listEvents({ module: "payroll" });
      summary = { total: rows.length };
      break;
    case "DOC-ACCESS":
      rows = await mustList("eal_file_audit", {
        pageSize: 100,
        sort: "created_at",
        order: "desc",
        filters: periodFilter,
      });
      summary = { total: rows.length };
      break;
    case "DATA-EXPORT":
      rows = await mustList("eal_exports", {
        pageSize: 100,
        sort: "created_at",
        order: "desc",
        filters: periodFilter,
      });
      summary = { total: rows.length };
      break;
    case "PRINT-USAGE":
      rows = await mustList("eal_print_audit", {
        pageSize: 100,
        sort: "created_at",
        order: "desc",
        filters: periodFilter,
      });
      summary = { total: rows.length };
      break;
    case "EXEC-SUMMARY": {
      const scores = await computeSecurityScores(input.company_id);
      rows = [
        {
          metric: "security_score",
          value: scores.securityScore,
        },
        {
          metric: "compliance_score",
          value: scores.complianceScore,
        },
        {
          metric: "open_alerts",
          value: scores.openAlerts,
        },
        {
          metric: "active_incidents",
          value: scores.activeIncidents,
        },
        {
          metric: "failed_logins_24h",
          value: scores.failedLogins24h,
        },
        {
          metric: "mfa_coverage",
          value: scores.mfaCoverage,
        },
      ];
      summary = scores as unknown as Record<string, unknown>;
      break;
    }
    case "USER-ACTIVITY":
    default:
      rows = await listEvents();
      summary = { total: rows.length };
      break;
  }

  let run: Record<string, unknown> | null = null;
  try {
    run = await mustCreate("eal_report_runs", {
      report_code: input.report_code,
      name: input.report_code,
      period_start: start,
      period_end: end,
      row_count: rows.length,
      run_by: input.run_by,
      status: "completed",
      result_summary: summary,
    });
  } catch {
    run = null;
  }

  return { rows, summary, run };
}

export function exportRowsCsv(
  rows: Array<Record<string, unknown>>,
  filename: string
) {
  if (rows.length === 0) return;
  const keys = Object.keys(rows[0]).filter(
    (k) => typeof rows[0][k] !== "object"
  );
  const header = keys.join(",");
  const body = rows
    .map((r) =>
      keys
        .map((k) => {
          const v = String(r[k] ?? "").replace(/"/g, '""');
          return `"${v}"`;
        })
        .join(",")
    )
    .join("\n");
  const blob = new Blob([`${header}\n${body}`], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
