/** Enterprise Communication Platform */

export const COMM_CHANNELS = [
  "email",
  "sms",
  "whatsapp",
  "push",
  "in_app",
  "hopechat",
  "teams",
  "slack",
] as const;

export const COMM_STATUSES = [
  "draft",
  "queued",
  "sending",
  "sent",
  "delivered",
  "opened",
  "clicked",
  "failed",
  "cancelled",
  "scheduled",
] as const;

export const DOC_TYPES = [
  "quotation",
  "proforma",
  "sales_order",
  "invoice",
  "receipt",
  "credit_note",
  "debit_note",
  "statement",
  "pr",
  "rfq",
  "po",
  "grn",
  "delivery_note",
  "contract",
  "payment_voucher",
  "journal",
  "financial_report",
  "production_order",
  "job_card",
  "bom",
  "batch",
  "qc_certificate",
  "packaging",
  "offer_letter",
  "employment_contract",
  "payslip",
  "leave_letter",
  "id_card",
  "ticket_report",
  "service_report",
  "project_report",
  "other",
] as const;

export const COMM_MENU = [
  { title: "Communication Hub", href: "/dashboard/communications", group: "Overview" },
  { title: "Notification Center", href: "/dashboard/notifications", group: "Inbox" },
  { title: "Email Center", href: "/dashboard/communications/email", group: "Channels" },
  { title: "SMS Center", href: "/dashboard/communications/sms", group: "Channels" },
  { title: "WhatsApp", href: "/dashboard/communications/whatsapp", group: "Channels" },
  { title: "Push Notifications", href: "/dashboard/communications/push", group: "Channels" },
  { title: "In-App Messages", href: "/dashboard/communications/in-app", group: "Channels" },
  { title: "HopeChat Delivery", href: "/dashboard/communications/hopechat", group: "Channels" },
  { title: "Document Delivery", href: "/dashboard/communications/documents", group: "Documents" },
  { title: "PDF Jobs", href: "/dashboard/communications/pdf-jobs", group: "Documents" },
  { title: "Approval Requests", href: "/dashboard/communications/approvals", group: "Workflow" },
  { title: "Announcements", href: "/dashboard/communications/announcements", group: "Broadcast" },
  { title: "Broadcasts", href: "/dashboard/communications/broadcasts", group: "Broadcast" },
  { title: "Campaigns", href: "/dashboard/communications/campaigns", group: "Broadcast" },
  { title: "Scheduled", href: "/dashboard/communications/scheduled", group: "Automation" },
  { title: "Reminders", href: "/dashboard/communications/reminders", group: "Automation" },
  { title: "Event Rules", href: "/dashboard/communications/rules", group: "Automation" },
  { title: "Templates", href: "/dashboard/communications/templates", group: "Content" },
  { title: "Delivery Reports", href: "/dashboard/communications/deliveries", group: "Ops" },
  { title: "Failed / Retry Queue", href: "/dashboard/communications/retry", group: "Ops" },
  { title: "Preferences", href: "/dashboard/notifications/preferences", group: "Settings" },
  { title: "Providers", href: "/dashboard/communications/providers", group: "Settings" },
  { title: "AI Assistant", href: "/dashboard/communications/ai", group: "Intelligence" },
  { title: "Audit Logs", href: "/dashboard/communications/audit", group: "Settings" },
] as const;

export type ComposeInput = {
  company_id: string;
  channel: string;
  subject?: string;
  body_html?: string;
  body_text?: string;
  to_addresses?: string[];
  recipient_user_ids?: string[];
  category?: string;
  priority?: string;
  source_module?: string;
  source_event?: string;
  entity_type?: string;
  entity_id?: string;
  entity_code?: string;
  template_code?: string;
  attach_docs?: string[];
  scheduled_for?: string | null;
  actor_id?: string | null;
  vars?: Record<string, string | number | null | undefined>;
};

export type PublishEventInput = {
  company_id: string;
  event_key: string;
  source_module: string;
  entity_type?: string;
  entity_id?: string;
  entity_code?: string;
  vars?: Record<string, string | number | null | undefined>;
  actor_id?: string | null;
  extra_recipients?: string[];
};
