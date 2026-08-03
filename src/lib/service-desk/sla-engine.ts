/**
 * Server-side SLA monitoring + escalation engine.
 * Runs under the admin/service role (cron / job worker). Tenant-scoped per company.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { enqueueJob } from "@/lib/jobs/queue";

const OPEN_STATUSES = [
  "new",
  "assigned",
  "acknowledged",
  "investigating",
  "waiting_customer",
  "in_progress",
  "open",
  "reopened",
] as const;

export type SlaScanResult = {
  scanned: number;
  responseBreaches: number;
  resolveBreaches: number;
  warnings: number;
  escalations: number;
  notifications: number;
  errors: string[];
};

type TicketRow = {
  id: string;
  company_id: string;
  tenant_id?: string | null;
  ticket_number?: string | null;
  subject?: string | null;
  status?: string | null;
  priority?: string | null;
  assigned_to?: string | null;
  created_by?: string | null;
  team_id?: string | null;
  escalation_level?: number | null;
  sla_response_due?: string | null;
  sla_resolve_due?: string | null;
  first_response_at?: string | null;
  resolved_at?: string | null;
  sla_response_breached?: boolean | null;
  sla_resolve_breached?: boolean | null;
  last_sla_notified_at?: string | null;
};

type EscalationRule = {
  id: string;
  company_id: string;
  name: string;
  trigger_type: string;
  escalate_to_level: number | null;
  notify_roles: string[] | null;
  is_active: boolean | null;
};

function minutesUntil(iso: string | null | undefined): number | null {
  if (!iso) return null;
  return Math.round((new Date(iso).getTime() - Date.now()) / 60_000);
}

function isPast(iso: string | null | undefined): boolean {
  if (!iso) return false;
  return new Date(iso).getTime() < Date.now();
}

async function resolveTenantId(
  admin: SupabaseClient,
  companyId: string,
  known?: string | null
): Promise<string | null> {
  if (known) return known;
  const { data } = await admin
    .from("companies")
    .select("tenant_id")
    .eq("id", companyId)
    .maybeSingle();
  return (data?.tenant_id as string | null) || null;
}

async function usersForRoles(
  admin: SupabaseClient,
  companyId: string,
  roleSlugs: string[]
): Promise<string[]> {
  if (!roleSlugs.length) return [];
  const { data: roles } = await admin
    .from("roles")
    .select("id, slug")
    .in("slug", roleSlugs);
  const roleIds = (roles || []).map((r) => r.id as string);
  if (!roleIds.length) return [];
  const { data: users } = await admin
    .from("user_profiles")
    .select("id")
    .eq("company_id", companyId)
    .eq("is_active", true)
    .in("role_id", roleIds);
  return (users || []).map((u) => u.id as string);
}

async function notify(
  admin: SupabaseClient,
  input: {
    companyId: string;
    tenantId: string | null;
    userIds: string[];
    title: string;
    message: string;
    priority?: "low" | "normal" | "high" | "urgent";
    ticketId: string;
    ticketNumber?: string | null;
    event: string;
  }
): Promise<number> {
  const unique = [...new Set(input.userIds.filter(Boolean))];
  if (!unique.length || !input.tenantId) return 0;

  await enqueueJob(admin, {
    jobType: "notification.dispatch",
    companyId: input.companyId,
    tenantId: input.tenantId,
    payload: {
      company_id: input.companyId,
      userIds: unique,
      title: input.title,
      message: input.message,
      channels: ["in_app", "email"],
      category: "service_desk",
      priority: input.priority || "high",
      type: "warning",
      link: `/dashboard/service-desk/tickets?id=${input.ticketId}`,
      sourceModule: "service_desk",
      sourceEvent: input.event,
      entityType: "support_ticket",
      entityId: input.ticketId,
      force: true,
    },
    idempotencyKey: `sd-sla:${input.event}:${input.ticketId}:${new Date()
      .toISOString()
      .slice(0, 13)}`,
    priority: 40,
  });
  return unique.length;
}

async function logEvent(
  admin: SupabaseClient,
  ticket: TicketRow,
  event_type: string,
  message: string,
  new_value?: string
) {
  await admin.from("sd_ticket_events").insert({
    company_id: ticket.company_id,
    tenant_id: ticket.tenant_id,
    ticket_id: ticket.id,
    event_type,
    message,
    new_value: new_value || null,
    is_public: false,
    actor_name: "SLA Engine",
  });
}

/**
 * Scan open tickets for SLA warnings/breaches and apply escalation rules.
 */
export async function runSlaEscalationScan(
  admin: SupabaseClient,
  opts?: { companyId?: string; limit?: number }
): Promise<SlaScanResult> {
  const result: SlaScanResult = {
    scanned: 0,
    responseBreaches: 0,
    resolveBreaches: 0,
    warnings: 0,
    escalations: 0,
    notifications: 0,
    errors: [],
  };

  const limit = Math.min(Math.max(opts?.limit ?? 200, 1), 500);
  let query = admin
    .from("support_tickets")
    .select(
      "id,company_id,tenant_id,ticket_number,subject,status,priority,assigned_to,created_by,team_id,escalation_level,sla_response_due,sla_resolve_due,first_response_at,resolved_at,sla_response_breached,sla_resolve_breached,last_sla_notified_at"
    )
    .is("deleted_at", null)
    .in("status", [...OPEN_STATUSES])
    .order("sla_resolve_due", { ascending: true, nullsFirst: false })
    .limit(limit);

  if (opts?.companyId) {
    query = query.eq("company_id", opts.companyId);
  }

  const { data: tickets, error } = await query;
  if (error) {
    result.errors.push(error.message);
    return result;
  }

  const rows = (tickets || []) as TicketRow[];
  result.scanned = rows.length;
  if (!rows.length) return result;

  const companyIds = [...new Set(rows.map((t) => t.company_id))];
  const { data: rulesData } = await admin
    .from("sd_escalation_rules")
    .select("*")
    .in("company_id", companyIds)
    .eq("is_active", true);
  const rulesByCompany = new Map<string, EscalationRule[]>();
  for (const r of (rulesData || []) as EscalationRule[]) {
    const list = rulesByCompany.get(r.company_id) || [];
    list.push(r);
    rulesByCompany.set(r.company_id, list);
  }

  for (const ticket of rows) {
    try {
      const tenantId = await resolveTenantId(
        admin,
        ticket.company_id,
        ticket.tenant_id
      );
      const patch: Record<string, unknown> = {};
      const notifyIds = new Set<string>();
      if (ticket.assigned_to) notifyIds.add(ticket.assigned_to);
      if (ticket.created_by) notifyIds.add(ticket.created_by);

      const responsePast =
        !ticket.first_response_at && isPast(ticket.sla_response_due);
      const resolvePast = !ticket.resolved_at && isPast(ticket.sla_resolve_due);
      const responseWarn =
        !ticket.first_response_at &&
        !responsePast &&
        (minutesUntil(ticket.sla_response_due) ?? 999) <= 30 &&
        (minutesUntil(ticket.sla_response_due) ?? 0) > 0;
      const resolveWarn =
        !ticket.resolved_at &&
        !resolvePast &&
        (minutesUntil(ticket.sla_resolve_due) ?? 999) <= 30 &&
        (minutesUntil(ticket.sla_resolve_due) ?? 0) > 0;

      // Response breach
      if (responsePast && !ticket.sla_response_breached) {
        patch.sla_response_breached = true;
        patch.sla_response_met = false;
        result.responseBreaches += 1;
        await logEvent(
          admin,
          ticket,
          "sla",
          `Response SLA breached (due ${ticket.sla_response_due})`,
          "response_breach"
        );
        result.notifications += await notify(admin, {
          companyId: ticket.company_id,
          tenantId,
          userIds: [...notifyIds],
          title: `SLA response breach - ${ticket.ticket_number || "ticket"}`,
          message: `${ticket.subject || "Ticket"} missed first-response SLA.`,
          priority: "urgent",
          ticketId: ticket.id,
          ticketNumber: ticket.ticket_number,
          event: "sla_response_breach",
        });
      }

      // Resolve breach
      if (resolvePast && !ticket.sla_resolve_breached) {
        patch.sla_resolve_breached = true;
        patch.sla_resolve_met = false;
        result.resolveBreaches += 1;
        await logEvent(
          admin,
          ticket,
          "sla",
          `Resolve SLA breached (due ${ticket.sla_resolve_due})`,
          "resolve_breach"
        );
        result.notifications += await notify(admin, {
          companyId: ticket.company_id,
          tenantId,
          userIds: [...notifyIds],
          title: `SLA resolve breach - ${ticket.ticket_number || "ticket"}`,
          message: `${ticket.subject || "Ticket"} missed resolution SLA.`,
          priority: "urgent",
          ticketId: ticket.id,
          ticketNumber: ticket.ticket_number,
          event: "sla_resolve_breach",
        });
      }

      // At-risk warnings (throttle via last_sla_notified_at ~ 25 min)
      const lastNotified = ticket.last_sla_notified_at
        ? new Date(ticket.last_sla_notified_at).getTime()
        : 0;
      const canWarn = Date.now() - lastNotified > 25 * 60_000;
      if (canWarn && (responseWarn || resolveWarn)) {
        patch.last_sla_notified_at = new Date().toISOString();
        result.warnings += 1;
        const kind = responseWarn ? "response" : "resolve";
        const mins =
          kind === "response"
            ? minutesUntil(ticket.sla_response_due)
            : minutesUntil(ticket.sla_resolve_due);
        await logEvent(
          admin,
          ticket,
          "sla",
          `SLA ${kind} at risk (~${mins} min remaining)`,
          `${kind}_warning`
        );
        result.notifications += await notify(admin, {
          companyId: ticket.company_id,
          tenantId,
          userIds: [...notifyIds],
          title: `SLA at risk - ${ticket.ticket_number || "ticket"}`,
          message: `${ticket.subject || "Ticket"} ${kind} SLA expires in ~${mins} minutes.`,
          priority: "high",
          ticketId: ticket.id,
          ticketNumber: ticket.ticket_number,
          event: `sla_${kind}_warning`,
        });
      }

      // Escalation rules on breach
      if (responsePast || resolvePast) {
        const rules = (rulesByCompany.get(ticket.company_id) || []).filter(
          (r) => r.trigger_type === "sla_breach" || r.trigger_type === "priority"
        );
        const currentLevel = Number(ticket.escalation_level || 0);
        const applicable = rules
          .filter((r) => Number(r.escalate_to_level || 0) > currentLevel)
          .sort(
            (a, b) =>
              Number(a.escalate_to_level || 0) - Number(b.escalate_to_level || 0)
          );
        const rule = applicable[0];
        if (rule) {
          const toLevel = Number(rule.escalate_to_level || currentLevel + 1);
          patch.escalation_level = toLevel;
          patch.escalated_at = new Date().toISOString();
          patch.last_escalation_at = new Date().toISOString();
          if (ticket.priority !== "critical" && toLevel >= 2) {
            const next =
              ticket.priority === "low"
                ? "medium"
                : ticket.priority === "medium"
                  ? "high"
                  : "critical";
            patch.priority = next;
          }

          const roleUsers = await usersForRoles(
            admin,
            ticket.company_id,
            rule.notify_roles || []
          );
          roleUsers.forEach((id) => notifyIds.add(id));

          await admin.from("sd_escalation_events").insert({
            company_id: ticket.company_id,
            tenant_id: tenantId,
            ticket_id: ticket.id,
            rule_id: rule.id,
            from_level: currentLevel,
            to_level: toLevel,
            trigger_type: "sla_breach",
            reason: rule.name,
            notified_user_ids: [...notifyIds],
          });

          await logEvent(
            admin,
            ticket,
            "escalate",
            `Auto-escalated to level ${toLevel} via rule "${rule.name}"`,
            String(toLevel)
          );

          result.escalations += 1;
          result.notifications += await notify(admin, {
            companyId: ticket.company_id,
            tenantId,
            userIds: [...notifyIds],
            title: `Escalated L${toLevel} - ${ticket.ticket_number || "ticket"}`,
            message: `${ticket.subject || "Ticket"} escalated: ${rule.name}`,
            priority: "urgent",
            ticketId: ticket.id,
            ticketNumber: ticket.ticket_number,
            event: "sla_escalation",
          });
        }
      }

      if (Object.keys(patch).length) {
        patch.updated_at = new Date().toISOString();
        const { error: upErr } = await admin
          .from("support_tickets")
          .update(patch)
          .eq("id", ticket.id);
        if (upErr) result.errors.push(`${ticket.id}: ${upErr.message}`);
      }
    } catch (e) {
      result.errors.push(
        `${ticket.id}: ${e instanceof Error ? e.message : "scan failed"}`
      );
    }
  }

  return result;
}
