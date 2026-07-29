/**
 * Automated billing communications — email / SMS / WhatsApp / portal.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export type CommEvent =
  | "invoice_created"
  | "payment_reminder"
  | "overdue"
  | "payment_received"
  | "receipt"
  | "approval_needed"
  | "credit_blocked"
  | "custom";

const TEMPLATES: Record<
  CommEvent,
  { subject: string; body: string }
> = {
  invoice_created: {
    subject: "Invoice {{invoice_number}} from Hope Design Group",
    body: "Dear {{customer_name}}, invoice {{invoice_number}} for {{total}} {{currency}} is ready. Due date: {{due_date}}.",
  },
  payment_reminder: {
    subject: "Reminder: Invoice {{invoice_number}} due {{due_date}}",
    body: "Friendly reminder that invoice {{invoice_number}} ({{total}} {{currency}}) is due on {{due_date}}.",
  },
  overdue: {
    subject: "Overdue: Invoice {{invoice_number}}",
    body: "Invoice {{invoice_number}} is overdue. Outstanding balance {{balance}} {{currency}}. Please arrange payment.",
  },
  payment_received: {
    subject: "Payment received — {{invoice_number}}",
    body: "Thank you. We received payment of {{amount}} {{currency}} for invoice {{invoice_number}}. Receipt {{receipt}}.",
  },
  receipt: {
    subject: "Receipt {{receipt}}",
    body: "Your receipt {{receipt}} for {{amount}} {{currency}} is attached / available in the customer portal.",
  },
  approval_needed: {
    subject: "Approval required: {{invoice_number}}",
    body: "Invoice {{invoice_number}} ({{total}} {{currency}}) awaits your approval.",
  },
  credit_blocked: {
    subject: "Account credit notice",
    body: "Customer {{customer_name}} credit status changed: {{message}}",
  },
  custom: {
    subject: "{{subject}}",
    body: "{{body}}",
  },
};

function fill(
  template: string,
  vars: Record<string, string | number | undefined | null>
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, k) =>
    String(vars[k] ?? "")
  );
}

export async function queueCommunication(
  supabase: SupabaseClient,
  input: {
    company_id: string;
    invoice_id?: string | null;
    customer_id?: string | null;
    channel?: "email" | "sms" | "whatsapp" | "portal";
    event_type: CommEvent;
    recipient?: string;
    vars?: Record<string, string | number | undefined | null>;
    auto_send?: boolean;
  }
) {
  const tpl = TEMPLATES[input.event_type] || TEMPLATES.custom;
  const vars = input.vars || {};
  const subject = fill(tpl.subject, vars);
  const body = fill(tpl.body, vars);
  const status = input.auto_send === false ? "queued" : "sent";

  const { data, error } = await supabase
    .from("bill_communications")
    .insert({
      company_id: input.company_id,
      invoice_id: input.invoice_id || null,
      customer_id: input.customer_id || null,
      channel: input.channel || "email",
      event_type: input.event_type,
      recipient: input.recipient || "customer",
      subject,
      body,
      status,
      sent_at: status === "sent" ? new Date().toISOString() : null,
    })
    .select()
    .single();
  if (error) throw error;

  // Also try in-app notification table if present
  try {
    if (status === "sent") {
      await supabase.from("bill_delivery_logs").insert({
        company_id: input.company_id,
        invoice_id: input.invoice_id || null,
        channel: input.channel || "email",
        recipient: input.recipient || "customer",
        status: "sent",
      });
    }
  } catch {
    /* optional */
  }

  return data;
}
