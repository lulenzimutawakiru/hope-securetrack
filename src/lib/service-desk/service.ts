import { createClient } from "@/lib/supabase/client";
import { calculateSlaDue, slaMinutesForPriority } from "./sla";
import { routeTicket, detectDuplicate } from "./routing";
import { analyzeRequest } from "./ai";
import type { TicketInput } from "./types";

function sb() {
  return createClient();
}

function pad(n: number, w = 5) {
  return String(n).padStart(w, "0");
}

export async function nextTicketNumber(companyId: string): Promise<string> {
  const year = new Date().getFullYear();
  const { count } = await sb()
    .from("support_tickets")
    .select("*", { count: "exact", head: true })
    .eq("company_id", companyId);
  return `HDG-SD-${year}-${pad((count ?? 0) + 1)}`;
}

export async function nextNumber(
  companyId: string,
  table: string,
  prefix: string
): Promise<string> {
  const year = new Date().getFullYear();
  const { count } = await sb()
    .from(table)
    .select("*", { count: "exact", head: true })
    .eq("company_id", companyId);
  return `HDG-${prefix}-${year}-${pad((count ?? 0) + 1)}`;
}

export async function logTicketEvent(input: {
  company_id: string;
  ticket_id: string;
  event_type: string;
  message?: string | null;
  old_value?: string | null;
  new_value?: string | null;
  is_public?: boolean;
  actor_id?: string | null;
  actor_name?: string | null;
}) {
  await sb().from("sd_ticket_events").insert({
    company_id: input.company_id,
    ticket_id: input.ticket_id,
    event_type: input.event_type,
    message: input.message,
    old_value: input.old_value,
    new_value: input.new_value,
    is_public: input.is_public ?? true,
    actor_id: input.actor_id,
    actor_name: input.actor_name,
  });
}

async function loadSlaPolicy(companyId: string, priority: string) {
  const { data } = await sb()
    .from("sd_sla_policies")
    .select("*")
    .eq("company_id", companyId)
    .eq("priority", priority === "critical" ? "critical" : priority)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();
  if (data) return data;
  // fallback by code
  const code =
    priority === "critical"
      ? "SLA-P1"
      : priority === "high"
        ? "SLA-P2"
        : priority === "low"
          ? "SLA-P4"
          : "SLA-P3";
  const { data: byCode } = await sb()
    .from("sd_sla_policies")
    .select("*")
    .eq("company_id", companyId)
    .eq("policy_code", code)
    .maybeSingle();
  return byCode;
}

export async function createTicket(input: {
  company_id: string;
  ticket: TicketInput;
  created_by?: string | null;
  actor_name?: string | null;
  auto_route?: boolean;
}) {
  const ticket_number = await nextTicketNumber(input.company_id);
  const priority = input.ticket.priority || "medium";
  const policy = await loadSlaPolicy(input.company_id, priority);
  const mins = policy
    ? {
        responseMinutes: Number(policy.response_minutes),
        resolveMinutes: Number(policy.resolve_minutes),
      }
    : slaMinutesForPriority(priority);
  const sla = calculateSlaDue(priority, new Date(), mins);

  let team_id = input.ticket.team_id || null;
  let assigned_to = input.ticket.assigned_to || null;
  let routeReason = "";

  if (input.auto_route !== false) {
    const [{ data: teams }, { data: agents }] = await Promise.all([
      sb().from("sd_teams").select("*").eq("company_id", input.company_id).eq("is_active", true),
      sb().from("sd_agents").select("*").eq("company_id", input.company_id).eq("is_active", true),
    ]);
    const routed = routeTicket({
      category: input.ticket.category,
      service_type: input.ticket.service_type,
      teams: (teams || []) as Array<{
        id: string;
        team_code: string;
        name: string;
        service_types?: string[] | null;
        categories?: string[] | null;
      }>,
      agents: (agents || []).map((a: Record<string, unknown>) => ({
        id: String(a.id),
        user_id: String(a.user_id),
        team_id: (a.team_id as string) || null,
        skills: a.skills as string[] | null,
        max_open_tickets: a.max_open_tickets as number | null,
        is_available: a.is_available as boolean | null,
        open_count: 0,
        display_name: a.display_name as string | null,
      })),
    });
    if (!team_id) team_id = routed.teamId;
    if (!assigned_to) assigned_to = routed.agentUserId;
    routeReason = routed.reason;
  }

  const status = assigned_to ? "assigned" : "new";

  const { data, error } = await sb()
    .from("support_tickets")
    .insert({
      company_id: input.company_id,
      ticket_number,
      subject: input.ticket.subject,
      description: input.ticket.description,
      category: input.ticket.category || "general",
      subcategory: input.ticket.subcategory,
      ticket_type: input.ticket.ticket_type || "incident",
      service_type: input.ticket.service_type || "it",
      priority,
      impact: input.ticket.impact || "medium",
      urgency: input.ticket.urgency || "medium",
      severity: priority,
      channel: input.ticket.channel || "web",
      customer_id: input.ticket.customer_id,
      employee_id: input.ticket.employee_id,
      requester_name: input.ticket.requester_name,
      requester_email: input.ticket.requester_email,
      requester_phone: input.ticket.requester_phone,
      department_name: input.ticket.department_name,
      location_name: input.ticket.location_name,
      asset_tag: input.ticket.asset_tag,
      cmdb_ci_id: input.ticket.cmdb_ci_id,
      team_id,
      assigned_to,
      catalog_item_id: input.ticket.catalog_item_id,
      call_ref: input.ticket.call_ref,
      is_major: input.ticket.is_major || input.ticket.ticket_type === "major_incident",
      related_invoice: input.ticket.related_invoice,
      related_product: input.ticket.related_product,
      related_qr: input.ticket.related_qr,
      related_dispatch: input.ticket.related_dispatch,
      related_asset_tag: input.ticket.related_asset_tag || input.ticket.asset_tag,
      preferred_contact: input.ticket.preferred_contact || "email",
      gps_lat: input.ticket.gps_lat,
      gps_lng: input.ticket.gps_lng,
      template_code: input.ticket.template_code,
      status,
      sla_policy_id: policy?.id || null,
      sla_response_due: sla.responseDue.toISOString(),
      sla_resolve_due: sla.resolveDue.toISOString(),
      created_by: input.created_by,
    })
    .select("*")
    .single();

  if (error) throw error;

  await logTicketEvent({
    company_id: input.company_id,
    ticket_id: data.id,
    event_type: "created",
    message: `Ticket ${ticket_number} created${routeReason ? ` · ${routeReason}` : ""}`,
    actor_id: input.created_by,
    actor_name: input.actor_name,
  });

  if (assigned_to) {
    await logTicketEvent({
      company_id: input.company_id,
      ticket_id: data.id,
      event_type: "assigned",
      message: routeReason || "Auto-assigned",
      new_value: assigned_to,
      actor_id: input.created_by,
      actor_name: input.actor_name,
      is_public: false,
    });
  }

  return data;
}

export async function updateTicketStatus(input: {
  ticket_id: string;
  company_id: string;
  status: string;
  actor_id?: string | null;
  actor_name?: string | null;
  resolution_notes?: string | null;
  root_cause?: string | null;
}) {
  const { data: before } = await sb()
    .from("support_tickets")
    .select("*")
    .eq("id", input.ticket_id)
    .single();
  if (!before) throw new Error("Ticket not found");

  const now = new Date().toISOString();
  const patch: Record<string, unknown> = {
    status: input.status,
    updated_at: now,
  };

  if (input.status === "acknowledged" && !before.acknowledged_at) {
    patch.acknowledged_at = now;
    if (!before.first_response_at) {
      patch.first_response_at = now;
      patch.sla_response_met = before.sla_response_due
        ? new Date(now) <= new Date(before.sla_response_due)
        : true;
    }
  }
  if (
    ["investigating", "in_progress", "waiting_customer"].includes(input.status) &&
    !before.first_response_at
  ) {
    patch.first_response_at = now;
    patch.sla_response_met = before.sla_response_due
      ? new Date(now) <= new Date(before.sla_response_due)
      : true;
  }
  if (input.status === "resolved" || input.status === "customer_confirmation") {
    patch.resolved_at = now;
    patch.resolution_notes = input.resolution_notes ?? before.resolution_notes;
    patch.root_cause = input.root_cause ?? before.root_cause;
    patch.sla_resolve_met = before.sla_resolve_due
      ? new Date(now) <= new Date(before.sla_resolve_due)
      : true;
  }
  if (input.status === "closed") {
    patch.closed_at = now;
    if (!before.resolved_at) {
      patch.resolved_at = now;
      patch.sla_resolve_met = before.sla_resolve_due
        ? new Date(now) <= new Date(before.sla_resolve_due)
        : true;
    }
  }
  if (input.status === "archived") {
    patch.archived_at = now;
  }

  const { data, error } = await sb()
    .from("support_tickets")
    .update(patch)
    .eq("id", input.ticket_id)
    .select("*")
    .single();
  if (error) throw error;

  await logTicketEvent({
    company_id: input.company_id,
    ticket_id: input.ticket_id,
    event_type: "status",
    message: `Status → ${input.status}`,
    old_value: before.status,
    new_value: input.status,
    actor_id: input.actor_id,
    actor_name: input.actor_name,
  });

  return data;
}

export async function assignTicket(input: {
  ticket_id: string;
  company_id: string;
  assigned_to: string | null;
  team_id?: string | null;
  actor_id?: string | null;
  actor_name?: string | null;
}) {
  const { data, error } = await sb()
    .from("support_tickets")
    .update({
      assigned_to: input.assigned_to,
      team_id: input.team_id ?? undefined,
      status: input.assigned_to ? "assigned" : "new",
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.ticket_id)
    .select("*")
    .single();
  if (error) throw error;

  await logTicketEvent({
    company_id: input.company_id,
    ticket_id: input.ticket_id,
    event_type: "assigned",
    message: input.assigned_to ? "Ticket assigned" : "Unassigned",
    new_value: input.assigned_to,
    actor_id: input.actor_id,
    actor_name: input.actor_name,
    is_public: false,
  });
  return data;
}

export async function addComment(input: {
  ticket_id: string;
  company_id: string;
  message: string;
  is_public?: boolean;
  actor_id?: string | null;
  actor_name?: string | null;
}) {
  await logTicketEvent({
    company_id: input.company_id,
    ticket_id: input.ticket_id,
    event_type: input.is_public === false ? "note" : "comment",
    message: input.message,
    is_public: input.is_public !== false,
    actor_id: input.actor_id,
    actor_name: input.actor_name,
  });

  // First response tracking
  const { data: t } = await sb()
    .from("support_tickets")
    .select("first_response_at,sla_response_due,status")
    .eq("id", input.ticket_id)
    .single();
  if (t && !t.first_response_at && input.is_public !== false) {
    const now = new Date().toISOString();
    await sb()
      .from("support_tickets")
      .update({
        first_response_at: now,
        sla_response_met: t.sla_response_due
          ? new Date(now) <= new Date(t.sla_response_due)
          : true,
        updated_at: now,
      })
      .eq("id", input.ticket_id);
  }

  await sb()
    .from("support_tickets")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", input.ticket_id);
}

export async function escalateTicket(input: {
  ticket_id: string;
  company_id: string;
  level: number;
  reason?: string;
  actor_id?: string | null;
  actor_name?: string | null;
}) {
  await logTicketEvent({
    company_id: input.company_id,
    ticket_id: input.ticket_id,
    event_type: "escalate",
    message: `Escalated to level ${input.level}${input.reason ? `: ${input.reason}` : ""}`,
    new_value: String(input.level),
    actor_id: input.actor_id,
    actor_name: input.actor_name,
    is_public: false,
  });
  // Bump priority if not already critical
  const { data: t } = await sb()
    .from("support_tickets")
    .select("priority")
    .eq("id", input.ticket_id)
    .single();
  if (t && t.priority !== "critical" && input.level >= 2) {
    const next =
      t.priority === "low" ? "medium" : t.priority === "medium" ? "high" : "critical";
    await sb()
      .from("support_tickets")
      .update({ priority: next, updated_at: new Date().toISOString() })
      .eq("id", input.ticket_id);
  }
}

export async function softDeleteTicket(ticketId: string) {
  await sb()
    .from("support_tickets")
    .update({ deleted_at: new Date().toISOString(), status: "archived" })
    .eq("id", ticketId);
}

export async function restoreTicket(ticketId: string) {
  await sb()
    .from("support_tickets")
    .update({ deleted_at: null, archived_at: null, status: "open", updated_at: new Date().toISOString() })
    .eq("id", ticketId);
}

export async function duplicateTicket(
  ticketId: string,
  companyId: string,
  actorId?: string | null
) {
  const { data: src } = await sb().from("support_tickets").select("*").eq("id", ticketId).single();
  if (!src) throw new Error("Not found");
  return createTicket({
    company_id: companyId,
    created_by: actorId,
    ticket: {
      subject: `Copy: ${src.subject}`,
      description: src.description,
      category: src.category,
      subcategory: src.subcategory,
      ticket_type: src.ticket_type,
      service_type: src.service_type,
      priority: src.priority,
      impact: src.impact,
      urgency: src.urgency,
      channel: src.channel,
      customer_id: src.customer_id,
      employee_id: src.employee_id,
      department_name: src.department_name,
      location_name: src.location_name,
      asset_tag: src.asset_tag,
      cmdb_ci_id: src.cmdb_ci_id,
    },
  });
}

export async function submitCatalogRequest(input: {
  company_id: string;
  catalog_item_id: string;
  form_data?: Record<string, unknown>;
  requester_id?: string | null;
  employee_id?: string | null;
  actor_name?: string | null;
}) {
  const { data: item } = await sb()
    .from("sd_catalog_items")
    .select("*, sd_catalog_categories(name)")
    .eq("id", input.catalog_item_id)
    .single();
  if (!item) throw new Error("Catalog item not found");

  const request_number = await nextNumber(input.company_id, "sd_catalog_requests", "REQ");

  // Create fulfillment ticket
  const ticket = await createTicket({
    company_id: input.company_id,
    created_by: input.requester_id,
    actor_name: input.actor_name,
    ticket: {
      subject: `Service Request: ${item.name}`,
      description: `Catalog ${item.item_code}\n${item.description || ""}\n\nForm: ${JSON.stringify(input.form_data || {}, null, 2)}`,
      category: "service_request",
      subcategory: item.item_code,
      ticket_type: "service_request",
      service_type: item.service_type || "it",
      priority: item.item_code === "IT-PWD" ? "critical" : "medium",
      channel: "portal",
      employee_id: input.employee_id,
      catalog_item_id: item.id,
      team_id: item.fulfillment_team_id,
    },
  });

  const { data: req, error } = await sb()
    .from("sd_catalog_requests")
    .insert({
      company_id: input.company_id,
      request_number,
      catalog_item_id: item.id,
      ticket_id: ticket.id,
      requester_id: input.requester_id,
      employee_id: input.employee_id,
      form_data: input.form_data || {},
      status: item.requires_approval ? "pending_approval" : "fulfilling",
      approval_status: item.requires_approval ? "pending" : "approved",
      cost: item.estimated_cost || 0,
      approved_at: item.requires_approval ? null : new Date().toISOString(),
    })
    .select("*")
    .single();
  if (error) throw error;
  return { request: req, ticket };
}

export async function approveCatalogRequest(
  requestId: string,
  actorId: string,
  approved: boolean
) {
  const { data: req } = await sb()
    .from("sd_catalog_requests")
    .select("*")
    .eq("id", requestId)
    .single();
  if (!req) throw new Error("Request not found");

  const { data, error } = await sb()
    .from("sd_catalog_requests")
    .update({
      approval_status: approved ? "approved" : "rejected",
      status: approved ? "fulfilling" : "rejected",
      approved_by: actorId,
      approved_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", requestId)
    .select("*")
    .single();
  if (error) throw error;

  if (req.ticket_id) {
    await logTicketEvent({
      company_id: req.company_id,
      ticket_id: req.ticket_id,
      event_type: "system",
      message: approved ? "Catalog request approved" : "Catalog request rejected",
      actor_id: actorId,
    });
  }
  return data;
}

export async function createKnowledgeArticle(input: {
  company_id: string;
  title: string;
  body: string;
  summary?: string;
  category?: string;
  tags?: string[];
  author_id?: string | null;
  publish?: boolean;
}) {
  const article_number = await nextNumber(input.company_id, "sd_knowledge_articles", "KB");
  const { data, error } = await sb()
    .from("sd_knowledge_articles")
    .insert({
      company_id: input.company_id,
      article_number,
      title: input.title,
      body: input.body,
      summary: input.summary,
      category: input.category,
      tags: input.tags || [],
      status: input.publish ? "published" : "draft",
      published_at: input.publish ? new Date().toISOString() : null,
      author_id: input.author_id,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function createProblem(input: {
  company_id: string;
  title: string;
  description?: string;
  created_by?: string | null;
  related_ticket_ids?: string[];
}) {
  const problem_number = await nextNumber(input.company_id, "sd_problems", "PRB");
  const { data, error } = await sb()
    .from("sd_problems")
    .insert({
      company_id: input.company_id,
      problem_number,
      title: input.title,
      description: input.description,
      created_by: input.created_by,
      related_ticket_ids: input.related_ticket_ids || [],
      status: "open",
    })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function createChange(input: {
  company_id: string;
  title: string;
  description?: string;
  change_type?: string;
  risk_level?: string;
  impact?: string;
  implementation_plan?: string;
  rollback_plan?: string;
  requested_by?: string | null;
  scheduled_start?: string | null;
  scheduled_end?: string | null;
}) {
  const change_number = await nextNumber(input.company_id, "sd_changes", "CHG");
  const { data, error } = await sb()
    .from("sd_changes")
    .insert({
      company_id: input.company_id,
      change_number,
      title: input.title,
      description: input.description,
      change_type: input.change_type || "normal",
      risk_level: input.risk_level || "medium",
      impact: input.impact || "medium",
      implementation_plan: input.implementation_plan,
      rollback_plan: input.rollback_plan,
      requested_by: input.requested_by,
      scheduled_start: input.scheduled_start,
      scheduled_end: input.scheduled_end,
      status: "draft",
    })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function approveChange(changeId: string, actorId: string, approved: boolean, notes?: string) {
  const { data, error } = await sb()
    .from("sd_changes")
    .update({
      status: approved ? "approved" : "closed",
      approved_by: actorId,
      approved_at: new Date().toISOString(),
      cab_notes: notes,
    })
    .eq("id", changeId)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function createCmdbCi(input: {
  company_id: string;
  name: string;
  ci_type: string;
  location_name?: string;
  asset_tag?: string;
  serial_number?: string;
  manufacturer?: string;
  model?: string;
  owner_name?: string;
}) {
  const ci_number = await nextNumber(input.company_id, "sd_cmdb_cis", "CI");
  const { data, error } = await sb()
    .from("sd_cmdb_cis")
    .insert({
      company_id: input.company_id,
      ci_number,
      name: input.name,
      ci_type: input.ci_type,
      location_name: input.location_name,
      asset_tag: input.asset_tag,
      serial_number: input.serial_number,
      manufacturer: input.manufacturer,
      model: input.model,
      owner_name: input.owner_name,
      status: "operational",
    })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function createFieldJob(input: {
  company_id: string;
  title: string;
  ticket_id?: string | null;
  technician_id?: string | null;
  location_name?: string | null;
  scheduled_at?: string | null;
}) {
  const job_number = await nextNumber(input.company_id, "sd_field_jobs", "FLD");
  const { data, error } = await sb()
    .from("sd_field_jobs")
    .insert({
      company_id: input.company_id,
      job_number,
      title: input.title,
      ticket_id: input.ticket_id,
      technician_id: input.technician_id,
      location_name: input.location_name,
      scheduled_at: input.scheduled_at,
      status: "scheduled",
      checklist: [
        { step: "Arrive on site", done: false },
        { step: "Diagnose issue", done: false },
        { step: "Apply fix", done: false },
        { step: "Customer sign-off", done: false },
      ],
    })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function recordCsat(input: {
  company_id: string;
  ticket_id: string;
  score: number;
  comment?: string | null;
  agent_id?: string | null;
}) {
  const { data, error } = await sb()
    .from("sd_csat_responses")
    .insert({
      company_id: input.company_id,
      ticket_id: input.ticket_id,
      score: input.score,
      comment: input.comment,
      agent_id: input.agent_id,
    })
    .select("*")
    .single();
  if (error) throw error;

  await sb()
    .from("support_tickets")
    .update({
      csat_score: input.score,
      csat_comment: input.comment,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.ticket_id);

  return data;
}

export async function aiTriage(text: string, companyId: string) {
  const { data: articles } = await sb()
    .from("sd_knowledge_articles")
    .select("id,title,summary,body,category,tags")
    .eq("company_id", companyId)
    .eq("status", "published")
    .is("deleted_at", null)
    .limit(100);

  const analysis = analyzeRequest(text, (articles || []) as Array<{
    id: string;
    title: string;
    summary?: string | null;
    body: string;
    category?: string | null;
    tags?: string[] | null;
  }>);

  const { data: open } = await sb()
    .from("support_tickets")
    .select("id,subject,status")
    .eq("company_id", companyId)
    .is("deleted_at", null)
    .not("status", "in", '("closed","archived","resolved")')
    .limit(100);

  const duplicates = detectDuplicate(
    text.slice(0, 200),
    (open || []) as Array<{ id: string; subject: string; status: string }>
  );

  return { ...analysis, duplicates };
}

export function exportTicketsCsv(rows: Array<Record<string, unknown>>): string {
  const cols = [
    "ticket_number",
    "subject",
    "category",
    "priority",
    "status",
    "service_type",
    "channel",
    "requester_name",
    "created_at",
  ];
  const header = cols.join(",");
  const body = rows
    .map((r) =>
      cols
        .map((c) => `"${String(r[c] ?? "").replace(/"/g, '""')}"`)
        .join(",")
    )
    .join("\n");
  return `${header}\n${body}`;
}

/** Reopen a closed/resolved ticket */
export async function reopenTicket(input: {
  ticket_id: string;
  company_id: string;
  reason?: string;
  actor_id?: string | null;
  actor_name?: string | null;
}) {
  const { data: before } = await sb()
    .from("support_tickets")
    .select("reopen_count,status")
    .eq("id", input.ticket_id)
    .single();
  const { data, error } = await sb()
    .from("support_tickets")
    .update({
      status: "in_progress",
      closed_at: null,
      resolved_at: null,
      reopen_count: Number(before?.reopen_count || 0) + 1,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.ticket_id)
    .select("*")
    .single();
  if (error) throw error;
  await logTicketEvent({
    company_id: input.company_id,
    ticket_id: input.ticket_id,
    event_type: "reopen",
    message: input.reason || "Ticket reopened",
    old_value: before?.status,
    new_value: "in_progress",
    actor_id: input.actor_id,
    actor_name: input.actor_name,
  });
  return data;
}

export async function addWorkLog(input: {
  company_id: string;
  ticket_id: string;
  minutes: number;
  work_type?: string;
  notes?: string;
  agent_id?: string | null;
  agent_name?: string | null;
  billable?: boolean;
}) {
  const { data, error } = await sb()
    .from("sd_work_logs")
    .insert({
      company_id: input.company_id,
      ticket_id: input.ticket_id,
      minutes: input.minutes,
      work_type: input.work_type || "investigation",
      notes: input.notes,
      agent_id: input.agent_id,
      agent_name: input.agent_name,
      billable: input.billable || false,
      started_at: new Date(Date.now() - input.minutes * 60000).toISOString(),
      ended_at: new Date().toISOString(),
    })
    .select("*")
    .single();
  if (error) throw error;

  const { data: t } = await sb()
    .from("support_tickets")
    .select("time_spent_minutes")
    .eq("id", input.ticket_id)
    .single();
  await sb()
    .from("support_tickets")
    .update({
      time_spent_minutes: Number(t?.time_spent_minutes || 0) + input.minutes,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.ticket_id);

  await logTicketEvent({
    company_id: input.company_id,
    ticket_id: input.ticket_id,
    event_type: "work_log",
    message: `Work log ${input.minutes} min · ${input.work_type || "investigation"}`,
    actor_id: input.agent_id,
    actor_name: input.agent_name,
    is_public: false,
  });
  return data;
}

export async function postMessage(input: {
  company_id: string;
  ticket_id: string;
  body: string;
  channel?: string;
  is_public?: boolean;
  author_id?: string | null;
  author_name?: string | null;
}) {
  const { data, error } = await sb()
    .from("sd_messages")
    .insert({
      company_id: input.company_id,
      ticket_id: input.ticket_id,
      body: input.body,
      channel: input.channel || "internal",
      is_public: input.is_public !== false,
      author_id: input.author_id,
      author_name: input.author_name,
      direction: "outbound",
    })
    .select("*")
    .single();
  if (error) throw error;
  await addComment({
    ticket_id: input.ticket_id,
    company_id: input.company_id,
    message: input.body,
    is_public: input.is_public,
    actor_id: input.author_id,
    actor_name: input.author_name,
  });
  return data;
}

export async function requestTicketApproval(input: {
  company_id: string;
  ticket_id: string;
  approver_role?: string;
  approver_name?: string;
  sequence_no?: number;
}) {
  const { data, error } = await sb()
    .from("sd_approvals")
    .insert({
      company_id: input.company_id,
      ticket_id: input.ticket_id,
      sequence_no: input.sequence_no || 1,
      approver_role: input.approver_role || "Manager",
      approver_name: input.approver_name,
      decision: "pending",
    })
    .select("*")
    .single();
  if (error) throw error;
  await sb()
    .from("support_tickets")
    .update({ approval_status: "pending", updated_at: new Date().toISOString() })
    .eq("id", input.ticket_id);
  return data;
}

export async function decideTicketApproval(input: {
  approval_id: string;
  company_id: string;
  ticket_id: string;
  approved: boolean;
  comments?: string;
  approver_id?: string | null;
  approver_name?: string | null;
}) {
  const { data, error } = await sb()
    .from("sd_approvals")
    .update({
      decision: input.approved ? "approved" : "rejected",
      comments: input.comments,
      approver_id: input.approver_id,
      approver_name: input.approver_name,
      decided_at: new Date().toISOString(),
    })
    .eq("id", input.approval_id)
    .select("*")
    .single();
  if (error) throw error;
  await sb()
    .from("support_tickets")
    .update({
      approval_status: input.approved ? "approved" : "rejected",
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.ticket_id);
  await logTicketEvent({
    company_id: input.company_id,
    ticket_id: input.ticket_id,
    event_type: "approval",
    message: input.approved ? "Approved" : "Rejected",
    actor_id: input.approver_id,
    actor_name: input.approver_name,
  });
  return data;
}

export async function mergeTickets(input: {
  company_id: string;
  source_id: string;
  target_id: string;
  actor_id?: string | null;
  actor_name?: string | null;
}) {
  if (input.source_id === input.target_id) throw new Error("Cannot merge ticket into itself");
  await sb()
    .from("support_tickets")
    .update({
      merged_into_id: input.target_id,
      status: "closed",
      closed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.source_id);
  await logTicketEvent({
    company_id: input.company_id,
    ticket_id: input.target_id,
    event_type: "merge",
    message: `Merged ticket ${input.source_id} into this ticket`,
    actor_id: input.actor_id,
    actor_name: input.actor_name,
    is_public: false,
  });
  await logTicketEvent({
    company_id: input.company_id,
    ticket_id: input.source_id,
    event_type: "merge",
    message: `Merged into ${input.target_id}`,
    actor_id: input.actor_id,
    actor_name: input.actor_name,
    is_public: false,
  });
}

export async function createFromAssetQr(input: {
  company_id: string;
  asset_tag: string;
  subject?: string;
  description?: string;
  created_by?: string | null;
  actor_name?: string | null;
  channel?: string;
}) {
  return createTicket({
    company_id: input.company_id,
    created_by: input.created_by,
    actor_name: input.actor_name,
    ticket: {
      subject: input.subject || `Asset fault — ${input.asset_tag}`,
      description:
        input.description ||
        `Fault reported by scanning asset tag ${input.asset_tag}. Linked to asset management.`,
      category: "hardware",
      subcategory: "device",
      ticket_type: "incident",
      service_type: "maintenance",
      priority: "medium",
      channel: input.channel || "qr",
      asset_tag: input.asset_tag,
      related_asset_tag: input.asset_tag,
    },
  });
}

export async function declareMajorIncident(input: {
  company_id: string;
  title: string;
  impact_summary?: string;
  commander_name?: string;
  ticket_id?: string | null;
  created_by?: string | null;
}) {
  const { count } = await sb()
    .from("sd_major_incidents")
    .select("*", { count: "exact", head: true })
    .eq("company_id", input.company_id);
  const incident_number = `MI-${new Date().getFullYear()}-${String((count ?? 0) + 1).padStart(3, "0")}`;

  let ticketId = input.ticket_id;
  if (!ticketId) {
    const t = await createTicket({
      company_id: input.company_id,
      created_by: input.created_by,
      ticket: {
        subject: `[MAJOR] ${input.title}`,
        description: input.impact_summary,
        ticket_type: "major_incident",
        service_type: "it",
        priority: "critical",
        impact: "critical",
        urgency: "critical",
        is_major: true,
        channel: "web",
      },
    });
    ticketId = t.id;
  } else {
    await sb()
      .from("support_tickets")
      .update({ is_major: true, ticket_type: "major_incident", priority: "critical" })
      .eq("id", ticketId);
  }

  const { data, error } = await sb()
    .from("sd_major_incidents")
    .insert({
      company_id: input.company_id,
      incident_number,
      ticket_id: ticketId,
      title: input.title,
      impact_summary: input.impact_summary,
      commander_name: input.commander_name,
      status: "declared",
      severity: "critical",
      executive_notified: true,
      timeline: [
        { at: new Date().toISOString(), event: "Declared", by: input.commander_name || "system" },
      ],
    })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function convertInboundToTicket(input: {
  company_id: string;
  inbound_id: string;
  created_by?: string | null;
}) {
  const { data: item } = await sb()
    .from("sd_inbound_items")
    .select("*")
    .eq("id", input.inbound_id)
    .single();
  if (!item) throw new Error("Inbound item not found");

  const triage = await aiTriage(
    `${item.subject || ""}\n${item.body || ""}`,
    input.company_id
  );

  const ticket = await createTicket({
    company_id: input.company_id,
    created_by: input.created_by,
    ticket: {
      subject: item.subject || "Inbound request",
      description: item.body,
      category: triage.suggestedCategory,
      subcategory: triage.suggestedSubcategory || undefined,
      service_type: triage.suggestedServiceType,
      priority: triage.suggestedPriority,
      impact: triage.suggestedImpact,
      urgency: triage.suggestedUrgency,
      channel: item.source === "email" ? "email" : item.source,
      requester_email: item.from_address,
      requester_name: item.from_address,
      is_major: triage.isMajor,
    },
  });

  await sb()
    .from("sd_inbound_items")
    .update({ status: "ticketed", ticket_id: ticket.id })
    .eq("id", input.inbound_id);

  return ticket;
}
