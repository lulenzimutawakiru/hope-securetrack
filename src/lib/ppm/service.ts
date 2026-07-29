import { createClient } from "@/lib/supabase/client";

export async function getPpmDashboardStats(companyId: string) {
  const sb = createClient();
  const today = new Date().toISOString().slice(0, 10);
  const soon = new Date();
  soon.setDate(soon.getDate() + 14);
  const soonStr = soon.toISOString().slice(0, 10);

  const [
    active,
    delayed,
    completed,
    milestones,
    openRisks,
    openIssues,
    pendingApprovals,
    { data: projects },
    { data: tasks },
    { data: timesheets },
  ] = await Promise.all([
    sb.from("ppm_projects").select("*", { count: "exact", head: true }).eq("company_id", companyId).eq("status", "active").is("deleted_at", null),
    sb.from("ppm_projects").select("*", { count: "exact", head: true }).eq("company_id", companyId).eq("status", "delayed").is("deleted_at", null),
    sb.from("ppm_projects").select("*", { count: "exact", head: true }).eq("company_id", companyId).in("status", ["completed", "closed"]).is("deleted_at", null),
    sb.from("ppm_milestones").select("*", { count: "exact", head: true }).eq("company_id", companyId).eq("status", "pending").lte("due_date", soonStr).is("deleted_at", null),
    sb.from("ppm_risks").select("*", { count: "exact", head: true }).eq("company_id", companyId).eq("status", "open").is("deleted_at", null),
    sb.from("ppm_issues").select("*", { count: "exact", head: true }).eq("company_id", companyId).eq("status", "open").is("deleted_at", null),
    sb.from("ppm_approvals").select("*", { count: "exact", head: true }).eq("company_id", companyId).eq("status", "pending").is("deleted_at", null),
    sb.from("ppm_projects").select("budget_planned,budget_actual,planned_value,earned_value,actual_cost,spi,cpi,percent_complete,status,health").eq("company_id", companyId).is("deleted_at", null).limit(200),
    sb.from("ppm_tasks").select("status,estimated_hours,actual_hours").eq("company_id", companyId).is("deleted_at", null).limit(500),
    sb.from("ppm_timesheets").select("hours,status").eq("company_id", companyId).is("deleted_at", null).limit(300),
  ]);

  const plist = projects || [];
  const budgetPlanned = plist.reduce((s, p) => s + Number(p.budget_planned || 0), 0);
  const budgetActual = plist.reduce((s, p) => s + Number(p.budget_actual || 0), 0);
  const pv = plist.reduce((s, p) => s + Number(p.planned_value || 0), 0);
  const ev = plist.reduce((s, p) => s + Number(p.earned_value || 0), 0);
  const ac = plist.reduce((s, p) => s + Number(p.actual_cost || 0), 0);
  const avgSpi =
    plist.length > 0
      ? plist.reduce((s, p) => s + Number(p.spi || 1), 0) / plist.length
      : 1;
  const avgCpi =
    plist.length > 0
      ? plist.reduce((s, p) => s + Number(p.cpi || 1), 0) / plist.length
      : 1;
  const util =
    budgetPlanned > 0 ? Math.round((budgetActual / budgetPlanned) * 1000) / 10 : 0;
  const profitability = ev - ac;
  const tlist = tasks || [];
  const doneTasks = tlist.filter((t) => t.status === "done").length;
  const productivity =
    tlist.length > 0 ? Math.round((doneTasks / tlist.length) * 1000) / 10 : 0;
  const hoursLogged = (timesheets || []).reduce((s, t) => s + Number(t.hours || 0), 0);
  const estHours = tlist.reduce((s, t) => s + Number(t.estimated_hours || 0), 0);
  const resourceUtil = estHours > 0 ? Math.round((hoursLogged / estHours) * 1000) / 10 : 0;

  return {
    activeProjects: active.count ?? 0,
    delayedProjects: delayed.count ?? 0,
    completedProjects: completed.count ?? 0,
    upcomingMilestones: milestones.count ?? 0,
    budgetUtilization: util,
    spi: Math.round(avgSpi * 100) / 100,
    cpi: Math.round(avgCpi * 100) / 100,
    plannedValue: pv,
    earnedValue: ev,
    actualCost: ac,
    openRisks: openRisks.count ?? 0,
    openIssues: openIssues.count ?? 0,
    pendingApprovals: pendingApprovals.count ?? 0,
    profitability,
    teamProductivity: productivity,
    resourceUtilization: resourceUtil,
    totalProjects: plist.length,
    hoursLogged,
    asOf: today,
  };
}

export async function getPpmGanttData(companyId: string, projectCode?: string) {
  const sb = createClient();
  let tq = sb
    .from("ppm_tasks")
    .select("task_code,name,start_date,due_date,finish_date,percent_complete,status,assignee_name,project_code,priority")
    .eq("company_id", companyId)
    .is("deleted_at", null)
    .order("start_date", { ascending: true })
    .limit(300);
  if (projectCode) tq = tq.eq("project_code", projectCode);
  const { data: tasks } = await tq;

  let mq = sb
    .from("ppm_milestones")
    .select("milestone_code,name,due_date,status,project_code")
    .eq("company_id", companyId)
    .is("deleted_at", null)
    .limit(100);
  if (projectCode) mq = mq.eq("project_code", projectCode);
  const { data: milestones } = await mq;

  return { tasks: tasks || [], milestones: milestones || [] };
}

export async function getPpmKanbanTasks(companyId: string, projectCode?: string) {
  const sb = createClient();
  let q = sb
    .from("ppm_tasks")
    .select("*")
    .eq("company_id", companyId)
    .is("deleted_at", null)
    .order("updated_at", { ascending: false })
    .limit(200);
  if (projectCode) q = q.eq("project_code", projectCode);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}
