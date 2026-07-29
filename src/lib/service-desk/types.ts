/** Enterprise Service Desk / ITSM types */

export const TICKET_TYPES = [
  { value: "incident", label: "Incident" },
  { value: "service_request", label: "Service Request" },
  { value: "problem", label: "Problem" },
  { value: "change", label: "Change" },
  { value: "major_incident", label: "Major Incident" },
  { value: "question", label: "Question" },
] as const;

export const SERVICE_TYPES = [
  { value: "it", label: "IT Support" },
  { value: "hr", label: "HR Requests" },
  { value: "finance", label: "Finance Requests" },
  { value: "procurement", label: "Procurement" },
  { value: "maintenance", label: "Maintenance" },
  { value: "production", label: "Production" },
  { value: "warehouse", label: "Warehouse" },
  { value: "fleet", label: "Fleet" },
  { value: "security", label: "Security" },
  { value: "facilities", label: "Facilities" },
  { value: "customer", label: "Customer Support" },
] as const;

export const CHANNELS_EXTENDED = [
  { value: "web", label: "ERP Dashboard" },
  { value: "portal", label: "Employee Portal" },
  { value: "customer_portal", label: "Customer Portal" },
  { value: "email", label: "Email-to-Ticket" },
  { value: "mobile", label: "Mobile App" },
  { value: "chat", label: "Live Chat" },
  { value: "whatsapp", label: "WhatsApp Business" },
  { value: "teams", label: "Microsoft Teams" },
  { value: "slack", label: "Slack" },
  { value: "phone", label: "Telephone" },
  { value: "qr", label: "QR Code Scan" },
  { value: "api", label: "API Integration" },
  { value: "iot", label: "IoT Alert" },
  { value: "ai", label: "AI Assistant" },
  { value: "import", label: "Bulk Import" },
] as const;

export const WORK_LOG_TYPES = [
  { value: "investigation", label: "Investigation" },
  { value: "remote", label: "Remote support" },
  { value: "onsite", label: "On-site" },
  { value: "travel", label: "Travel" },
  { value: "wait", label: "Waiting" },
  { value: "documentation", label: "Documentation" },
] as const;

export const PRIORITIES = [
  { value: "critical", label: "Critical / P1", responseMin: 15, resolveMin: 120 },
  { value: "high", label: "High / P2", responseMin: 30, resolveMin: 240 },
  { value: "medium", label: "Medium / P3", responseMin: 60, resolveMin: 480 },
  { value: "low", label: "Low / P4", responseMin: 240, resolveMin: 1440 },
] as const;

export const IMPACT_LEVELS = ["low", "medium", "high", "critical"] as const;
export const URGENCY_LEVELS = ["low", "medium", "high", "critical"] as const;

export const TICKET_STATUSES = [
  "new",
  "assigned",
  "acknowledged",
  "investigating",
  "waiting_customer",
  "in_progress",
  "resolved",
  "customer_confirmation",
  "closed",
  "archived",
  // legacy
  "open",
  "pending",
] as const;

export const CHANNELS = [
  { value: "web", label: "Web Portal" },
  { value: "portal", label: "Employee Portal" },
  { value: "email", label: "Email" },
  { value: "mobile", label: "Mobile App" },
  { value: "chat", label: "Website Chat" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "teams", label: "Microsoft Teams" },
  { value: "slack", label: "Slack" },
  { value: "phone", label: "Phone" },
] as const;

export const CHANGE_TYPES = [
  { value: "standard", label: "Standard Change" },
  { value: "normal", label: "Normal Change" },
  { value: "emergency", label: "Emergency Change" },
] as const;

export const CHANGE_STATUSES = [
  "draft",
  "submitted",
  "cab_review",
  "approved",
  "implementing",
  "implemented",
  "failed",
  "rolled_back",
  "closed",
] as const;

export const PROBLEM_STATUSES = [
  "open",
  "investigating",
  "known_error",
  "resolved",
  "closed",
] as const;

export const CI_TYPES = [
  { value: "device", label: "Device" },
  { value: "server", label: "Server" },
  { value: "pc", label: "PC / Laptop" },
  { value: "router", label: "Router" },
  { value: "switch", label: "Switch" },
  { value: "firewall", label: "Firewall" },
  { value: "application", label: "Application" },
  { value: "database", label: "Database" },
  { value: "cloud", label: "Cloud Resource" },
  { value: "vehicle", label: "Vehicle" },
  { value: "machine", label: "Machine" },
] as const;

export const SERVICE_DESK_LIFECYCLE = [
  "New",
  "Assigned",
  "Acknowledged",
  "Investigating",
  "Waiting Customer",
  "In Progress",
  "Resolved",
  "Customer Confirmation",
  "Closed",
  "Archived",
] as const;

export type TicketPriority = (typeof PRIORITIES)[number]["value"];
export type TicketStatus = (typeof TICKET_STATUSES)[number];

export interface SlaResult {
  responseDue: Date;
  resolveDue: Date;
  responseMinutes: number;
  resolveMinutes: number;
  policyCode?: string;
}

export interface TicketInput {
  subject: string;
  description?: string | null;
  category?: string;
  subcategory?: string | null;
  ticket_type?: string;
  service_type?: string;
  priority?: string;
  impact?: string;
  urgency?: string;
  channel?: string;
  customer_id?: string | null;
  employee_id?: string | null;
  requester_name?: string | null;
  requester_email?: string | null;
  requester_phone?: string | null;
  department_name?: string | null;
  location_name?: string | null;
  asset_tag?: string | null;
  cmdb_ci_id?: string | null;
  team_id?: string | null;
  assigned_to?: string | null;
  catalog_item_id?: string | null;
  call_ref?: string | null;
  is_major?: boolean;
  related_invoice?: string | null;
  related_product?: string | null;
  related_qr?: string | null;
  related_dispatch?: string | null;
  related_asset_tag?: string | null;
  preferred_contact?: string | null;
  gps_lat?: number | null;
  gps_lng?: number | null;
  template_code?: string | null;
}
