import type { EmployeeProfile } from "./types";
import { calculateProfileCompletion, type CompletionContext } from "./completion";

export interface ProfileAiInsight {
  type: "completion" | "training" | "skill_gap" | "career" | "retention" | "duplicate" | "summary";
  severity: "info" | "low" | "medium" | "high";
  title: string;
  detail: string;
  actions: string[];
}

export function generateProfileInsights(params: {
  employee: EmployeeProfile;
  ctx?: CompletionContext;
  skills?: Array<{ skill_name: string; skill_category: string; level_score: number }>;
  certs?: Array<{ certificate_name: string; expiry_date?: string | null }>;
  attendanceRate?: number;
  leaveBalance?: number;
  openTickets?: number;
}): ProfileAiInsight[] {
  const insights: ProfileAiInsight[] = [];
  const { employee } = params;
  const completion = calculateProfileCompletion(employee, params.ctx || {});

  if (completion.pct < 85) {
    insights.push({
      type: "completion",
      severity: completion.pct < 50 ? "high" : "medium",
      title: `Profile ${completion.pct}% complete`,
      detail: `Missing: ${completion.missing.slice(0, 5).join(", ")}${completion.missing.length > 5 ? "…" : ""}`,
      actions: completion.missing.slice(0, 3).map((m) => `Complete ${m}`),
    });
  }

  const skills = params.skills || [];
  const tech = skills.filter((s) => s.skill_category === "technical");
  const soft = skills.filter((s) => s.skill_category === "soft");
  if (tech.length < 2) {
    insights.push({
      type: "skill_gap",
      severity: "medium",
      title: "Technical skill gap",
      detail: "Fewer than 2 technical skills recorded. Recommend skill assessment.",
      actions: ["Add technical skills", "Enroll in domain training"],
    });
  }
  if (soft.length === 0) {
    insights.push({
      type: "skill_gap",
      severity: "low",
      title: "Soft skills not recorded",
      detail: "Leadership and communication skills improve promotion readiness.",
      actions: ["Add soft skills", "Nominate for leadership program"],
    });
  }

  const expiring = (params.certs || []).filter((c) => {
    if (!c.expiry_date) return false;
    const days = (new Date(c.expiry_date).getTime() - Date.now()) / 864e5;
    return days >= 0 && days <= 30;
  });
  if (expiring.length) {
    insights.push({
      type: "training",
      severity: "high",
      title: `${expiring.length} certificate(s) expiring within 30 days`,
      detail: expiring.map((c) => c.certificate_name).join(", "),
      actions: ["Renew certification", "Upload renewed document"],
    });
  }

  if ((params.attendanceRate ?? 100) < 90) {
    insights.push({
      type: "retention",
      severity: "medium",
      title: "Attendance below 90%",
      detail: `Attendance rate ${params.attendanceRate}%. May indicate engagement risk.`,
      actions: ["Manager 1:1", "Review leave balance"],
    });
  }

  if ((params.leaveBalance ?? 21) > 15 && employee.hire_date) {
    const tenureYears =
      (Date.now() - new Date(employee.hire_date).getTime()) / (365.25 * 864e5);
    if (tenureYears > 1) {
      insights.push({
        type: "retention",
        severity: "info",
        title: "High leave balance",
        detail: `${params.leaveBalance} days remaining — encourage planned leave to prevent burnout.`,
        actions: ["Plan annual leave"],
      });
    }
  }

  // Career path heuristic
  const grade = employee.job_grade || "";
  if (completion.pct >= 80 && tech.some((s) => s.level_score >= 4)) {
    insights.push({
      type: "career",
      severity: "info",
      title: "Promotion readiness signal",
      detail: `Strong profile + advanced skills${grade ? ` (grade ${grade})` : ""}. Consider succession path.`,
      actions: ["Schedule performance calibration", "Assign stretch project"],
    });
  }

  insights.push({
    type: "summary",
    severity: "info",
    title: "Employee summary",
    detail: buildSummary(employee, completion.pct, skills.length),
    actions: ["Export profile PDF", "Share with manager"],
  });

  if ((params.openTickets ?? 0) > 3) {
    insights.push({
      type: "retention",
      severity: "low",
      title: "Elevated support tickets",
      detail: `${params.openTickets} open helpdesk items linked to this user.`,
      actions: ["Review ticket themes"],
    });
  }

  return insights;
}

export function suggestMissingFields(employee: EmployeeProfile, ctx?: CompletionContext): string[] {
  return calculateProfileCompletion(employee, ctx).missing;
}

export function extractFromDocumentName(fileName: string): {
  doc_type: string;
  title: string;
} {
  const lower = fileName.toLowerCase();
  if (lower.includes("passport")) return { doc_type: "passport", title: "Passport" };
  if (lower.includes("national") || lower.includes("nin") || lower.includes("id"))
    return { doc_type: "national_id", title: "National ID" };
  if (lower.includes("contract")) return { doc_type: "contract", title: "Employment Contract" };
  if (lower.includes("cert")) return { doc_type: "certificate", title: "Certificate" };
  if (lower.includes("degree") || lower.includes("diploma") || lower.includes("transcript"))
    return { doc_type: "academic", title: "Academic Document" };
  if (lower.includes("medical") || lower.includes("fit"))
    return { doc_type: "medical", title: "Medical Certificate" };
  return { doc_type: "other", title: fileName.replace(/\.[^.]+$/, "") };
}

function buildSummary(e: EmployeeProfile, pct: number, skillCount: number): string {
  const name = [e.first_name, e.last_name].filter(Boolean).join(" ");
  return `${name} (${e.employee_number}) — ${e.job_title || "Staff"} in ${e.department || "General"}. Profile ${pct}% complete with ${skillCount} skill(s). Status: ${e.status || "active"}.`;
}
