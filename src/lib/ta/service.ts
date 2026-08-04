import { createClient } from "@/lib/supabase/crud-compat";
import type { TaDashboardStats } from "./types";

export async function getTalentDashboardStats(companyId: string): Promise<TaDashboardStats> {
  const sb = createClient();
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const monthStart = new Date().toISOString().slice(0, 8) + "01";

  const [
    openVacancies,
    applications,
    interviews,
    offersPending,
    hires,
    requisitionsPending,
    { data: scores },
    onboardingOpen,
  ] = await Promise.all([
    sb.from("ta_vacancies").select("*", { count: "exact", head: true }).eq("company_id", companyId).eq("status", "open").is("deleted_at", null),
    sb.from("ta_applications").select("*", { count: "exact", head: true }).eq("company_id", companyId).eq("status", "open").is("deleted_at", null),
    sb.from("ta_interviews").select("*", { count: "exact", head: true }).eq("company_id", companyId).gte("scheduled_at", weekAgo.toISOString()).is("deleted_at", null),
    sb.from("ta_offers").select("*", { count: "exact", head: true }).eq("company_id", companyId).in("status", ["draft", "issued"]).is("deleted_at", null),
    sb.from("ta_applications").select("*", { count: "exact", head: true }).eq("company_id", companyId).eq("stage_code", "hired").gte("updated_at", monthStart).is("deleted_at", null),
    sb.from("ta_requisitions").select("*", { count: "exact", head: true }).eq("company_id", companyId).eq("approval_status", "pending").is("deleted_at", null),
    sb.from("ta_applications").select("match_score").eq("company_id", companyId).is("deleted_at", null).limit(200),
    sb.from("ta_onboarding_tasks").select("*", { count: "exact", head: true }).eq("company_id", companyId).in("status", ["pending", "in_progress"]).is("deleted_at", null),
  ]);

  const scoreList = scores || [];
  const avgMatchScore =
    scoreList.length > 0
      ? Math.round(
          (scoreList.reduce((s, r) => s + Number(r.match_score || 0), 0) / scoreList.length) * 10
        ) / 10
      : 0;

  return {
    openVacancies: openVacancies.count ?? 0,
    applications: applications.count ?? 0,
    interviewsThisWeek: interviews.count ?? 0,
    offersPending: offersPending.count ?? 0,
    hiresThisMonth: hires.count ?? 0,
    requisitionsPending: requisitionsPending.count ?? 0,
    avgMatchScore,
    onboardingOpen: onboardingOpen.count ?? 0,
  };
}

export async function listPublicVacancies(companyId?: string) {
  const sb = createClient();
  let q = sb
    .from("ta_vacancies")
    .select(
      "id,vacancy_code,title,department,branch_name,location_name,country,employment_type,work_mode,positions,salary_min,salary_max,currency,description,requirements,benefits,is_featured,application_deadline,published_at,status"
    )
    .eq("status", "open")
    .eq("publish_external", true)
    .is("deleted_at", null)
    .order("is_featured", { ascending: false })
    .order("published_at", { ascending: false })
    .limit(100);
  if (companyId) q = q.eq("company_id", companyId);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

/** Simple keyword match score 0–100 */
export function scoreCandidateMatch(opts: {
  requirements?: string | null;
  skills?: string | null;
  candidateSkills?: string | null;
  yearsExperience?: number;
  requiredYears?: number;
}): { score: number; summary: string; missing: string[] } {
  const req = (opts.requirements || "").toLowerCase();
  const skillsText = `${opts.skills || ""} ${opts.candidateSkills || ""}`.toLowerCase();
  const tokens = req
    .split(/[^a-z0-9+#.]/i)
    .map((t) => t.trim())
    .filter((t) => t.length > 3)
    .slice(0, 20);
  const unique = Array.from(new Set(tokens));
  const missing: string[] = [];
  let hits = 0;
  for (const t of unique) {
    if (skillsText.includes(t) || (opts.candidateSkills || "").toLowerCase().includes(t)) hits += 1;
    else missing.push(t);
  }
  let score = unique.length ? Math.round((hits / unique.length) * 80) : 50;
  const years = Number(opts.yearsExperience || 0);
  const need = Number(opts.requiredYears || 0);
  if (need > 0) {
    score += years >= need ? 20 : Math.round((years / need) * 20);
  } else {
    score += 10;
  }
  score = Math.max(0, Math.min(100, score));
  const summary =
    score >= 75
      ? "Strong match against vacancy requirements."
      : score >= 50
        ? "Partial match — review missing skills."
        : "Weak match — significant requirement gaps.";
  return { score, summary, missing: missing.slice(0, 8) };
}
