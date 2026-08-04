/**
 * Domain event bus — CRUD-backed emit/list (no browser Supabase client).
 */

import type { DomainEvent } from "./types";
import { mustCreate, mustList } from "@/lib/crud/domain-helpers";

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
  try {
    const row = await mustCreate<Record<string, unknown>>("domain_events", {
      event_type: input.event_type,
      aggregate_type: input.aggregate_type || null,
      aggregate_id: input.aggregate_id || null,
      payload: input.payload || {},
      source_module: input.source_module || null,
      severity: input.severity || "info",
      status: "pending",
    });
    return row?.id ? String(row.id) : null;
  } catch (e) {
    console.warn(
      "emitEvent failed",
      e instanceof Error ? e.message : String(e)
    );
    return null;
  }
}

export async function listDomainEvents(opts?: {
  companyId?: string;
  tenantId?: string;
  limit?: number;
  eventType?: string;
}): Promise<DomainEvent[]> {
  void opts?.companyId;
  void opts?.tenantId;
  const data = await mustList<DomainEvent>("domain_events", {
    pageSize: opts?.limit ?? 100,
    sort: "created_at",
    order: "desc",
    filters: opts?.eventType ? { event_type: opts.eventType } : undefined,
  });
  return data;
}
