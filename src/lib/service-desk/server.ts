/**
 * Server-side Service Desk operations (API routes / workers).
 * Always use session or admin Supabase clients -- never trust body company_id.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { calculateSlaDue, slaMinutesForPriority } from "./sla";
import { routeTicket, detectDuplicate } from "./routing";
import { analyzeRequest } from "./ai";
import type { TicketInput } from "./types";
import type { RoutingAgent, RoutingTeam } from "./routing";
import { notifyUsersAsync } from "@/lib/notifications/service";

export async function nextSupportTicketNumber(
  supabase: SupabaseClient,
  companyId: string
): Promise<string> {
  const { data, error } = await supabase.rpc("next_support_ticket_number", {
    p_company_id: companyId,
  });
  if (error) {
    // Fallback only if RPC not yet migrated -- still unique-ish under low concurrency
    const year = new Date().getFullYear();
    const { count } = await supabase
      .from("support_tickets")
      .select("*", { count: "exact", head: true })
      .eq("company_id", companyId);
    return `HDG-SD-${year}-${String((count ?? 0) + 1).padStart(5, "0")}`;
  }
  return String(data);
}

export async function loadSlaPolicy(
  supabase: SupabaseClient,
  companyId: string,
  priority: string
) {
  const { data } = await supabase
    .from("sd_sla_policies")
    .select("*")
    .eq("company_id", companyId)
    .eq("priority", priority)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();
  if (data) return data;
  const code =
    priority === "critical"
      ? "SLA-P1"
      : priority === "high"
        ? "SLA-P2"
        : priority === "low"
          ? "SLA-P4"
          : "SLA-P3";
  const { data: byCode } = await supabase
    .from("sd_sla_policies")
    .select("*")
    .eq("company_id", companyId)
    .eq("policy_code", code)
    .maybeSingle();
  return byCode;
}

export async function createTicketServer(
  supabase: SupabaseClient,
  input: {
    company_id: string;
    tenant_id?: string | null;
    ticket: TicketInput;
    created_by?: string | null;
    actor_name?: string | null;
    auto_route?: boolean;
  }
) {
  const ticket_number = await nextSupportTicketNumber(
    supabase,
    input.company_id
  );
  const priority = input.ticket.priority || "medium";
  const policy = await loadSlaPolicy(supabase, input.company_id, priority);
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
      supabase
        .from("sd_teams")
        .select("*")
        .eq("company_id", input.company_id)
        .eq("is_active", true),
      supabase
        .from("sd_agents")
        .select("*")
        .eq("company_id", input.company_id)
        .eq("is_active", true),
    ]);
    const routed = routeTicket({
      category: input.ticket.category,
      service_type: input.ticket.service_type,
      teams: (teams || []) as RoutingTeam[],
      agents: ((agents || []) as Array<Record<string, unknown>>).map((a) => ({
        id: String(a.id),
        user_id: String(a.user_id),
        team_id: (a.team_id as string) || null,
        skills: a.skills as string[] | null,
        max_open_tickets: a.max_open_tickets as number | null,
        is_available: a.is_available as boolean | null,
        open_count: 0,
        display_name: a.display_name as string | null,
      })) as RoutingAgent[],
    });
    if (!team_id) team_id = routed.teamId;
    if (!assigned_to) assigned_to = routed.agentUserId;
    routeReason = routed.reason;
  }

  const status = assigned_to ? "assigned" : "new";
  const { data, error } = await supabase
    .from("support_tickets")
    .insert({
      company_id: input.company_id,
      tenant_id: input.tenant_id || null,
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
      is_major:
        input.ticket.is_major || input.ticket.ticket_type === "major_incident",
      related_invoice: input.ticket.related_invoice,
      related_product: input.ticket.related_product,
      related_qr: input.ticket.related_qr,
      related_dispatch: input.ticket.related_dispatch,
      related_asset_tag:
        input.ticket.related_asset_tag || input.ticket.asset_tag,
      preferred_contact: input.ticket.preferred_contact || "email",
      gps_lat: input.ticket.gps_lat,
      gps_lng: input.ticket.gps_lng,
      template_code: input.ticket.template_code,
      status,
      sla_policy_id: policy?.id || null,
      sla_response_due: sla.responseDue.toISOString(),
      sla_resolve_due: sla.resolveDue.toISOString(),
      escalation_level: 0,
      created_by: input.created_by,
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);

  await supabase.from("sd_ticket_events").insert({
    company_id: input.company_id,
    tenant_id: input.tenant_id || null,
    ticket_id: data.id,
    event_type: "created",
    message: `Ticket ${ticket_number} created${
      routeReason ? ` - ${routeReason}` : ""
    }`,
    actor_id: input.created_by,
    actor_name: input.actor_name,
    is_public: true,
  });

  if (assigned_to) {
    await supabase.from("sd_ticket_events").insert({
      company_id: input.company_id,
      tenant_id: input.tenant_id || null,
      ticket_id: data.id,
      event_type: "assigned",
      message: routeReason || "Auto-assigned",
      new_value: assigned_to,
      actor_id: input.created_by,
      actor_name: input.actor_name,
      is_public: false,
    });
  }

  // Email notification (in-app is generated by the DB trigger on insert).
  // Enqueued as a durable job so delivery is retried by the worker.
  const recipients = Array.from(
    new Set([input.created_by, assigned_to].filter(Boolean))
  ) as string[];
  if (recipients.length) {
    await notifyUsersAsync({
      companyId: input.company_id,
      tenantId: input.tenant_id || null,
      userIds: recipients,
      title: `Ticket ${ticket_number} created`,
      message: `${input.ticket.subject}${
        assigned_to ? ` - Assigned to agent` : ""
      }`,
      channels: ["email"],
      category: "service_desk",
      priority: priority === "critical" ? "urgent" : priority === "high" ? "high" : "normal",
      sourceModule: "service_desk",
      sourceEvent: "ticket.created",
      entityType: "support_ticket",
      entityId: data.id,
      link: `/dashboard/service-desk/tickets?id=${data.id}`,
      createdBy: input.created_by,
    });
  }

  return data;
}

export async function triageForCompany(
  supabase: SupabaseClient,
  companyId: string,
  text: string
) {
  const [{ data: articles }, { data: open }] = await Promise.all([
    supabase
      .from("sd_knowledge_articles")
      .select("id,title,summary,body,category,tags")
      .eq("company_id", companyId)
      .eq("status", "published")
      .is("deleted_at", null)
      .limit(100),
    supabase
      .from("support_tickets")
      .select("id,subject,status")
      .eq("company_id", companyId)
      .is("deleted_at", null)
      .not("status", "in", '("closed","archived","resolved")')
      .limit(100),
  ]);

  const analysis = analyzeRequest(
    text,
    (articles || []) as Parameters<typeof analyzeRequest>[1]
  );
  const duplicates = detectDuplicate(
    text.slice(0, 200),
    (open || []) as Array<{ id: string; subject: string; status: string }>
  );
  return { analysis, duplicates };
}
