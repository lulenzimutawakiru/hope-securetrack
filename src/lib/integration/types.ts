/** Enterprise Integration Hub types */

export type ConnectorCategory =
  | "payment"
  | "banking"
  | "communication"
  | "cloud"
  | "identity"
  | "logistics"
  | "iot"
  | "hardware"
  | "government"
  | "ai"
  | "document"
  | "erp"
  | "business"
  | "general";

export type WorkflowStepType =
  | "condition"
  | "map"
  | "http"
  | "email"
  | "create_record"
  | "notify"
  | "transform"
  | "delay";

export interface WorkflowStep {
  id: string;
  type: WorkflowStepType;
  config?: Record<string, unknown>;
  on_error?: "stop" | "continue" | "retry";
}

export const INTEGRATION_EVENTS = [
  "user.created",
  "employee.created",
  "invoice.created",
  "invoice.paid",
  "payment.received",
  "stock.changed",
  "inventory.stock.low",
  "production.completed",
  "ticket.created",
  "project.updated",
  "crm.opportunity.won",
  "sales.order.confirmed",
  "dispatch.delivered",
  "hr.employee.created",
] as const;

export const ARCHITECTURE_LAYERS = [
  "External Systems",
  "API Gateway",
  "Integration Engine",
  "Message Queue",
  "Transformation Layer",
  "Hope SecureTrack ERP Core",
  "Database / Analytics / AI",
] as const;

export const INTERNAL_MODULES = [
  "hr",
  "iam",
  "crm",
  "sales",
  "procurement",
  "inventory",
  "production",
  "finance",
  "billing",
  "helpdesk",
  "projects",
  "credentials",
  "dispatch",
  "scm",
] as const;
