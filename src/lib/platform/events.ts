import { createClient } from "@/lib/supabase/client";
import type { DomainEvent } from "./types";

/** Standard SecureTrack domain event types */
export const EVENT_TYPES = {
  RECORD_CREATED: "record.created",
  RECORD_UPDATED: "record.updated",
  RECORD_DELETED: "record.deleted",
  APPROVAL_REQUESTED: "approval.requested",
  APPROVAL_APPROVED: "approval.approved",
  APPROVAL_REJECTED: "approval.rejected",
  INVOICE_PAID: "invoice.paid",
  GOODS_RECEIVED: "goods.received",
  PAYROLL_PROCESSED: "payroll.processed",
  EMPLOYEE_HIRED: "employee.hired",
  PRODUCTION_STARTED: "production.started",
  PRODUCTION_COMPLETED: "production.completed",
  QUALITY_FAILED: "quality.failed",
  PROJECT_COMPLETED: "project.completed",
  TICKET_CLOSED: "ticket.closed",
  ASSET_ASSIGNED: "asset.assigned",
  ATTENDANCE_RECORDED: "attendance.recorded",
  LEAVE_APPROVED: "leave.approved",
  CUSTOMER_REGISTERED: "customer.registered",
  SUPPLIER_APPROVED: "supplier.approved",
  CONTRACT_EXPIRED: "contract.expired",
  TENANT_PROVISIONED: "tenant.provisioned",
  COMPANY_SWITCHED: "company.switched",
  USER_LOGIN: "user.login",
} as const;

export async function emitEvent(input: {
  event_type: string;
  aggregate_type?: string;
  aggregate_id?: string;
  payload?: Record<string, unknown>;
  source_module?: string;
  severity?: string;
  tenant_id?: string | null;
  company_id?: string | null;
  actor_id?: string | null;
}): Promise<string | null> {
  const sb = createClient();

  // Prefer RPC when authenticated (auto-fills tenant/company)
  try {
    const { data, error } = await sb.rpc("emit_domain_event", {
      p_event_type: input.event_type,
      p_aggregate_type: input.aggregate_type || null,
      p_aggregate_id: input.aggregate_id || null,
      p_payload: input.payload || {},
      p_source_module: input.source_module || null,
      p_severity: input.severity || "info",
    });
    if (!error && data) return String(data);
  } catch {
    /* fall through */
  }

  const { data, error } = await sb
    .from("domain_events")
    .insert({
      event_type: input.event_type,
      aggregate_type: input.aggregate_type || null,
      aggregate_id: input.aggregate_id || null,
      tenant_id: input.tenant_id || null,
      company_id: input.company_id || null,
      actor_id: input.actor_id || null,
      payload: input.payload || {},
      source_module: input.source_module || null,
      severity: input.severity || "info",
    })
    .select("id")
    .single();

  if (error) {
    console.warn("emitEvent failed", error.message);
    return null;
  }
  return data?.id || null;
}

export async function listDomainEvents(opts?: {
  companyId?: string;
  tenantId?: string;
  limit?: number;
  eventType?: string;
}): Promise<DomainEvent[]> {
  let q = createClient()
    .from("domain_events")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(opts?.limit ?? 100);

  if (opts?.companyId) q = q.eq("company_id", opts.companyId);
  if (opts?.tenantId) q = q.eq("tenant_id", opts.tenantId);
  if (opts?.eventType) q = q.eq("event_type", opts.eventType);

  const { data, error } = await q;
  if (error) throw error;
  return (data as DomainEvent[]) || [];
}
