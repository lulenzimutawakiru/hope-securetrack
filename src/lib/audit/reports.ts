/** Audit report runners & score calculators */

import { createClient } from "@/lib/supabase/client";

function sb() {
  return createClient();
}

export interface SecurityScores {
  securityScore: number;
  complianceScore: number;
  activeIncidents: number;
  openAlerts: number;
  highRiskUsers: Array<{ email: string; name: string; risk: number; events: number }>;
  failedLogins24h: number;
  mfaCoverage: number;
  chainHealthy: boolean;
}

export async function computeSecurityScores(companyId?: string): Promise<SecurityScores> {
  const client = sb();
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();

  let eventsQ = client.from("eal_events").select("user_email, full_name, risk_score, event_type, severity");
  let failedQ = client.from("eal_events").select("*", { count: "exact", head: true }).eq("event_type", "login_failed").gte("created_at", since);
  let alertsQ = client.from("eal_alerts").select("*", { count: "exact", head: true }).eq("status", "open");
  let incQ = client.from("eal_incidents").select("*", { count: "exact", head: true }).in("status", ["open", "investigating"]);
  let sessQ = client.from("eal_sessions").select("mfa_verified").eq("status", "active");
  let ctrlQ = client.from("eal_controls").select("status");
  let findQ = client.from("eal_findings").select("*", { count: "exact", head: true }).eq("status", "open");

  if (companyId) {
    eventsQ = eventsQ.eq("company_id", companyId);
    failedQ = failedQ.eq("company_id", companyId);
    alertsQ = alertsQ.eq("company_id", companyId);
    incQ = incQ.eq("company_id", companyId);
    sessQ = sessQ.eq("company_id", companyId);
    ctrlQ = ctrlQ.eq("company_id", companyId);
    findQ = findQ.eq("company_id", companyId);
  }

  const [
    { data: events },
    { count: failed },
    { count: openAlerts },
    { count: activeIncidents },
    { data: sessions },
    { data: controls },
    { count: openFindings },
  ] = await Promise.all([
    eventsQ.limit(500),
    failedQ,
    alertsQ,
    incQ,
    sessQ,
    ctrlQ,
    findQ,
  ]);

  const list = events || [];
  const byUser = new Map<string, { email: string; name: string; risk: number; events: number }>();
  for (const e of list) {
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

  const sess = sessions || [];
  const mfaCoverage =
    sess.length === 0
      ? 100
      : Math.round((sess.filter((s) => s.mfa_verified).length / sess.length) * 100);

  const ctrls = controls || [];
  const implemented = ctrls.filter((c) => c.status === "implemented").length;
  const complianceScore =
    ctrls.length === 0
      ? 70
      : Math.round((implemented / ctrls.length) * 100) -
        Math.min(20, (openFindings ?? 0) * 3);

  let securityScore = 100;
  securityScore -= Math.min(30, (failed ?? 0) * 2);
  securityScore -= Math.min(25, (openAlerts ?? 0) * 5);
  securityScore -= Math.min(25, (activeIncidents ?? 0) * 10);
  securityScore -= Math.max(0, 100 - mfaCoverage) * 0.2;
  securityScore = Math.max(0, Math.min(100, Math.round(securityScore)));

  return {
    securityScore,
    complianceScore: Math.max(0, Math.min(100, complianceScore)),
    activeIncidents: activeIncidents ?? 0,
    openAlerts: openAlerts ?? 0,
    highRiskUsers,
    failedLogins24h: failed ?? 0,
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
  const client = sb();
  const start = input.period_start || new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
  const end = input.period_end || new Date().toISOString();

  let rows: Array<Record<string, unknown>> = [];
  let summary: Record<string, unknown> = {};

  switch (input.report_code) {
    case "LOGIN-HISTORY": {
      const { data } = await client
        .from("eal_events")
        .select("*")
        .eq("company_id", input.company_id)
        .eq("module", "authentication")
        .gte("created_at", start)
        .lte("created_at", end)
        .order("created_at", { ascending: false })
        .limit(500);
      rows = (data as Array<Record<string, unknown>>) || [];
      summary = {
        total: rows.length,
        failed: rows.filter((r) => String(r.event_type).includes("failed")).length,
      };
      break;
    }
    case "PERM-CHANGES": {
      const { data } = await client
        .from("eal_events")
        .select("*")
        .eq("company_id", input.company_id)
        .in("module", ["iam", "identity", "users"])
        .gte("created_at", start)
        .lte("created_at", end)
        .order("created_at", { ascending: false })
        .limit(500);
      rows = (data as Array<Record<string, unknown>>) || [];
      summary = { total: rows.length };
      break;
    }
    case "FIN-TRAIL": {
      const { data } = await client
        .from("eal_events")
        .select("*")
        .eq("company_id", input.company_id)
        .in("module", ["finance", "gl", "invoicing", "billing"])
        .gte("created_at", start)
        .lte("created_at", end)
        .order("created_at", { ascending: false })
        .limit(500);
      rows = (data as Array<Record<string, unknown>>) || [];
      summary = { total: rows.length };
      break;
    }
    case "INV-TRAIL": {
      const { data } = await client
        .from("eal_events")
        .select("*")
        .eq("company_id", input.company_id)
        .in("module", ["inventory", "warehouse"])
        .gte("created_at", start)
        .lte("created_at", end)
        .order("created_at", { ascending: false })
        .limit(500);
      rows = (data as Array<Record<string, unknown>>) || [];
      summary = { total: rows.length };
      break;
    }
    case "PROD-TRAIL": {
      const { data } = await client
        .from("eal_events")
        .select("*")
        .eq("company_id", input.company_id)
        .in("module", ["production", "packaging", "qr"])
        .gte("created_at", start)
        .lte("created_at", end)
        .order("created_at", { ascending: false })
        .limit(500);
      rows = (data as Array<Record<string, unknown>>) || [];
      summary = { total: rows.length };
      break;
    }
    case "PAY-TRAIL": {
      const { data } = await client
        .from("eal_events")
        .select("*")
        .eq("company_id", input.company_id)
        .in("module", ["payroll", "hr"])
        .gte("created_at", start)
        .lte("created_at", end)
        .order("created_at", { ascending: false })
        .limit(500);
      rows = (data as Array<Record<string, unknown>>) || [];
      summary = { total: rows.length, high_risk: rows.filter((r) => Number(r.risk_score) >= 70).length };
      break;
    }
    case "DOC-ACCESS": {
      const { data } = await client
        .from("eal_file_audit")
        .select("*")
        .eq("company_id", input.company_id)
        .gte("created_at", start)
        .lte("created_at", end)
        .order("created_at", { ascending: false })
        .limit(500);
      rows = (data as Array<Record<string, unknown>>) || [];
      summary = { total: rows.length };
      break;
    }
    case "DATA-EXPORT": {
      const { data } = await client
        .from("eal_exports")
        .select("*")
        .eq("company_id", input.company_id)
        .gte("created_at", start)
        .lte("created_at", end)
        .order("created_at", { ascending: false })
        .limit(500);
      rows = (data as Array<Record<string, unknown>>) || [];
      summary = {
        total: rows.length,
        sensitive: rows.filter((r) => r.contains_sensitive).length,
        after_hours: rows.filter((r) => r.after_hours).length,
      };
      break;
    }
    case "PRINT-USAGE": {
      const { data } = await client
        .from("eal_print_audit")
        .select("*")
        .eq("company_id", input.company_id)
        .gte("created_at", start)
        .lte("created_at", end)
        .order("created_at", { ascending: false })
        .limit(500);
      rows = (data as Array<Record<string, unknown>>) || [];
      summary = { total: rows.length, copies: rows.reduce((s, r) => s + Number(r.copies || 1), 0) };
      break;
    }
    case "EXEC-SUMMARY": {
      const scores = await computeSecurityScores(input.company_id);
      rows = scores.highRiskUsers as unknown as Array<Record<string, unknown>>;
      summary = scores as unknown as Record<string, unknown>;
      break;
    }
    case "USER-ACTIVITY":
    default: {
      const { data } = await client
        .from("eal_events")
        .select("*")
        .eq("company_id", input.company_id)
        .gte("created_at", start)
        .lte("created_at", end)
        .order("created_at", { ascending: false })
        .limit(500);
      rows = (data as Array<Record<string, unknown>>) || [];
      summary = { total: rows.length };
      break;
    }
  }

  const { data: run } = await client
    .from("eal_report_runs")
    .insert({
      company_id: input.company_id,
      report_code: input.report_code,
      name: input.report_code,
      period_start: start,
      period_end: end,
      row_count: rows.length,
      run_by: input.run_by,
      status: "completed",
      result_summary: summary,
    })
    .select("*")
    .single();

  return { rows, summary, run };
}

export function exportRowsCsv(rows: Array<Record<string, unknown>>, filename: string) {
  if (rows.length === 0) return;
  const keys = Object.keys(rows[0]).filter((k) => typeof rows[0][k] !== "object");
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
  const blob = new Blob([header + "\n" + body], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
}
