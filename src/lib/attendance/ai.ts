/**
 * Attendance AI insights — reads/writes via /api/v2/crud (no browser Supabase client).
 */

import {
  crudCount,
  mustCreate,
  mustList,
} from "@/lib/crud/domain-helpers";

export type AttInsight = {
  id?: string;
  insight_type: string;
  title: string;
  summary: string;
  severity: string;
  score?: number;
  recommendations?: string[];
};

export async function generateAttendanceInsights(
  companyId: string
): Promise<AttInsight[]> {
  void companyId; // session-scoped on CRUD path
  const insights: AttInsight[] = [];
  const today = new Date().toISOString().slice(0, 10);

  const [events, violations, devices, records] = await Promise.all([
    mustList<Record<string, unknown>>("att_events", {
      pageSize: 200,
      filters: { work_date: today },
    }),
    mustList<Record<string, unknown>>("att_violations", {
      pageSize: 50,
      filters: { status: "open" },
    }),
    mustList<Record<string, unknown>>("att_devices", {
      pageSize: 50,
    }),
    mustList<Record<string, unknown>>("attendance_records", {
      pageSize: 200,
      filters: { work_date: today },
    }),
  ]);

  const rejected = events.filter(
    (e) => e.verification_status === "rejected"
  ).length;
  if (rejected > 0) {
    insights.push({
      insight_type: "security",
      title: `${rejected} rejected clock attempts today`,
      summary:
        "Geofence or multi-factor verification blocked unauthorized punches.",
      severity: rejected >= 5 ? "warning" : "info",
      score: 70,
      recommendations: [
        "Review violation log",
        "Coach staff on authorized sites",
      ],
    });
  }

  if (violations.length > 0) {
    insights.push({
      insight_type: "fraud",
      title: `${violations.length} open fraud/compliance violations`,
      summary:
        "Investigate mock GPS, duplicates, or geofence breaches promptly.",
      severity: "critical",
      score: 90,
      recommendations: [
        "Escalate to security",
        "Tighten device trust policy",
      ],
    });
  }

  const offline = devices.filter((d) => d.status === "offline").length;
  if (offline > 0) {
    insights.push({
      insight_type: "device",
      title: `${offline} attendance terminal(s) offline`,
      summary:
        "Offline devices may backlog punches — enable mobile geofence fallback.",
      severity: offline >= 2 ? "critical" : "warning",
      score: 85,
      recommendations: ["Check network/power", "Manual sync when online"],
    });
  }

  const late = records.filter((r) => Number(r.late_minutes || 0) > 0).length;
  if (late > 3) {
    insights.push({
      insight_type: "late",
      title: `${late} late arrivals today`,
      summary: "Late pattern may affect shift coverage and OT cost.",
      severity: "info",
      score: 60,
      recommendations: ["Review transport", "Adjust grace if systemic"],
    });
  }

  const ot = records.reduce(
    (s, r) => s + Number(r.overtime_minutes || 0),
    0
  );
  if (ot > 120) {
    insights.push({
      insight_type: "overtime",
      title: `Overtime ~${Math.round(ot / 60)}h accrued today`,
      summary:
        "Elevated OT — validate against production demand and approvals.",
      severity: "warning",
      score: 72,
      recommendations: ["Manager OT review", "Sync payroll allowances"],
    });
  }

  // Also surface offline device count via head when no device rows returned
  if (offline === 0) {
    const offlineCount = await crudCount("att_devices", { status: "offline" });
    if (offlineCount > 0) {
      insights.push({
        insight_type: "device",
        title: `${offlineCount} attendance terminal(s) offline`,
        summary:
          "Offline devices may backlog punches — enable mobile geofence fallback.",
        severity: offlineCount >= 2 ? "critical" : "warning",
        score: 85,
        recommendations: ["Check network/power", "Manual sync when online"],
      });
    }
  }

  try {
    for (const ins of insights.slice(0, 6)) {
      await mustCreate("att_ai_insights", {
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

export async function listAttendanceInsights(companyId: string) {
  void companyId;
  return mustList("att_ai_insights", {
    pageSize: 40,
    sort: "created_at",
    order: "desc",
  });
}
