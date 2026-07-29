import { createClient } from "@/lib/supabase/client";

export type AttInsight = {
  id?: string;
  insight_type: string;
  title: string;
  summary: string;
  severity: string;
  score?: number;
  recommendations?: string[];
};

export async function generateAttendanceInsights(companyId: string): Promise<AttInsight[]> {
  const sb = createClient();
  const insights: AttInsight[] = [];
  const today = new Date().toISOString().slice(0, 10);

  const [
    { data: events },
    { data: violations },
    { data: devices },
    { data: records },
  ] = await Promise.all([
    sb
      .from("att_events")
      .select("event_type,verification_status,fraud_flags,employee_name,distance_m")
      .eq("company_id", companyId)
      .eq("work_date", today)
      .is("deleted_at", null)
      .limit(200),
    sb
      .from("att_violations")
      .select("violation_type,severity,status")
      .eq("company_id", companyId)
      .eq("status", "open")
      .is("deleted_at", null)
      .limit(50),
    sb
      .from("att_devices")
      .select("status,name,last_heartbeat_at")
      .eq("company_id", companyId)
      .is("deleted_at", null)
      .limit(50),
    sb
      .from("attendance_records")
      .select("late_minutes,overtime_minutes,status")
      .eq("company_id", companyId)
      .eq("work_date", today)
      .is("deleted_at", null)
      .limit(200),
  ]);

  const rejected = (events || []).filter((e) => e.verification_status === "rejected").length;
  if (rejected > 0) {
    insights.push({
      insight_type: "security",
      title: `${rejected} rejected clock attempts today`,
      summary: "Geofence or multi-factor verification blocked unauthorized punches.",
      severity: rejected >= 5 ? "warning" : "info",
      score: 70,
      recommendations: ["Review violation log", "Coach staff on authorized sites"],
    });
  }

  const openVio = violations || [];
  if (openVio.length > 0) {
    insights.push({
      insight_type: "fraud",
      title: `${openVio.length} open fraud/compliance violations`,
      summary: "Investigate mock GPS, duplicates, or geofence breaches promptly.",
      severity: "critical",
      score: 90,
      recommendations: ["Escalate to security", "Tighten device trust policy"],
    });
  }

  const offline = (devices || []).filter((d) => d.status === "offline").length;
  if (offline > 0) {
    insights.push({
      insight_type: "device",
      title: `${offline} attendance terminal(s) offline`,
      summary: "Offline devices may backlog punches — enable mobile geofence fallback.",
      severity: offline >= 2 ? "critical" : "warning",
      score: 85,
      recommendations: ["Check network/power", "Manual sync when online"],
    });
  }

  const late = (records || []).filter((r) => Number(r.late_minutes || 0) > 0).length;
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

  const ot = (records || []).reduce((s, r) => s + Number(r.overtime_minutes || 0), 0);
  if (ot > 120) {
    insights.push({
      insight_type: "overtime",
      title: `Overtime ~${Math.round(ot / 60)}h accrued today`,
      summary: "Elevated OT — validate against production demand and approvals.",
      severity: "warning",
      score: 72,
      recommendations: ["Manager OT review", "Sync payroll allowances"],
    });
  }

  try {
    for (const ins of insights.slice(0, 6)) {
      await sb.from("att_ai_insights").insert({
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

export async function listAttendanceInsights(companyId: string) {
  const { data, error } = await createClient()
    .from("att_ai_insights")
    .select("*")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false })
    .limit(40);
  if (error) throw error;
  return data || [];
}
