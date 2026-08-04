import { createClient } from "@/lib/supabase/crud-compat";
import type { ComposeInput, PublishEventInput } from "./types";

function sb() {
  return createClient();
}

async function nextMessageNumber(companyId: string): Promise<string> {
  const { data, error } = await sb().rpc("next_comm_message_number", {
    p_company_id: companyId,
  });
  if (!error && data) return String(data);
  const year = new Date().getFullYear();
  const { count } = await sb()
    .from("comm_messages")
    .select("*", { count: "exact", head: true })
    .eq("company_id", companyId);
  return `HDG-MSG-${year}-${String((count ?? 0) + 1).padStart(6, "0")}`;
}

async function nextJobNumber(companyId: string): Promise<string> {
  const { data, error } = await sb().rpc("next_comm_job_number", {
    p_company_id: companyId,
  });
  if (!error && data) return String(data);
  const year = new Date().getFullYear();
  const { count } = await sb()
    .from("comm_document_jobs")
    .select("*", { count: "exact", head: true })
    .eq("company_id", companyId);
  return `HDG-DOC-${year}-${String((count ?? 0) + 1).padStart(6, "0")}`;
}

export async function logCommAudit(input: {
  company_id?: string | null;
  actor_id?: string | null;
  action: string;
  entity_table?: string;
  entity_id?: string;
  details?: string;
}) {
  await sb().from("comm_audit_log").insert({
    company_id: input.company_id || null,
    actor_id: input.actor_id || null,
    action: input.action,
    entity_table: input.entity_table || null,
    entity_id: input.entity_id || null,
    details: input.details || null,
  });
}

export async function getCommStats(companyId: string) {
  const [messages, sent, failed, queued, templates, rules, campaigns, reminders] =
    await Promise.all([
      sb().from("comm_messages").select("*", { count: "exact", head: true }).eq("company_id", companyId).is("deleted_at", null),
      sb().from("comm_messages").select("*", { count: "exact", head: true }).eq("company_id", companyId).eq("status", "sent"),
      sb().from("comm_messages").select("*", { count: "exact", head: true }).eq("company_id", companyId).eq("status", "failed"),
      sb().from("comm_messages").select("*", { count: "exact", head: true }).eq("company_id", companyId).in("status", ["queued", "scheduled"]),
      sb().from("comm_templates").select("*", { count: "exact", head: true }).eq("company_id", companyId).eq("is_active", true),
      sb().from("comm_event_rules").select("*", { count: "exact", head: true }).eq("company_id", companyId).eq("is_active", true),
      sb().from("comm_campaigns").select("*", { count: "exact", head: true }).eq("company_id", companyId),
      sb().from("comm_reminders").select("*", { count: "exact", head: true }).eq("company_id", companyId).eq("status", "pending"),
    ]);
  return {
    messages: messages.count ?? 0,
    sent: sent.count ?? 0,
    failed: failed.count ?? 0,
    queued: queued.count ?? 0,
    templates: templates.count ?? 0,
    rules: rules.count ?? 0,
    campaigns: campaigns.count ?? 0,
    pendingReminders: reminders.count ?? 0,
  };
}

function applyVars(
  template: string | null | undefined,
  vars: Record<string, string | number | null | undefined> = {}
): string {
  if (!template) return "";
  return template.replace(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g, (_, key: string) => {
    const v = vars[key];
    return v == null ? "" : String(v);
  });
}

export async function listMessages(opts?: {
  companyId?: string;
  channel?: string;
  status?: string;
  search?: string;
  limit?: number;
}) {
  let q = sb()
    .from("comm_messages")
    .select("*")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(opts?.limit ?? 200);
  if (opts?.companyId) q = q.eq("company_id", opts.companyId);
  if (opts?.channel && opts.channel !== "all") q = q.eq("channel", opts.channel);
  if (opts?.status && opts.status !== "all") q = q.eq("status", opts.status);
  const { data, error } = await q;
  if (error) throw error;
  let rows = data || [];
  if (opts?.search?.trim()) {
    const s = opts.search.trim().toLowerCase();
    rows = rows.filter(
      (r) =>
        String(r.subject || "").toLowerCase().includes(s) ||
        String(r.message_number || "").toLowerCase().includes(s) ||
        String(r.recipient_summary || "").toLowerCase().includes(s)
    );
  }
  return rows;
}

export async function getMessage(id: string) {
  const { data, error } = await sb().from("comm_messages").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  const { data: attachments } = await sb()
    .from("comm_attachments")
    .select("*")
    .eq("message_id", id);
  const { data: events } = await sb()
    .from("comm_delivery_events")
    .select("*")
    .eq("message_id", id)
    .order("occurred_at", { ascending: false });
  return { message: data, attachments: attachments || [], events: events || [] };
}

/** Compose a branded message (queues for delivery) */
export async function composeMessage(input: ComposeInput) {
  const message_number = await nextMessageNumber(input.company_id);
  let subject = input.subject || "";
  let body_html = input.body_html || "";
  let body_text = input.body_text || "";
  let template_id: string | null = null;

  if (input.template_code) {
    const { data: tpl } = await sb()
      .from("comm_templates")
      .select("*")
      .eq("company_id", input.company_id)
      .eq("template_code", input.template_code)
      .eq("channel", input.channel)
      .maybeSingle();
    if (tpl) {
      template_id = tpl.id;
      subject = applyVars(tpl.subject_template || subject, input.vars);
      body_html = applyVars(tpl.body_html || body_html, input.vars);
      body_text = applyVars(tpl.body_text || body_text, input.vars);
    }
  } else if (input.vars) {
    subject = applyVars(subject, input.vars);
    body_html = applyVars(body_html, input.vars);
    body_text = applyVars(body_text, input.vars);
  }

  // Load branding snapshot
  let brand_logo_url: string | null = null;
  let brand_colors: Record<string, string> = {};
  try {
    const { data: company } = await sb()
      .from("companies")
      .select("name, logo_url, email, phone, address, website")
      .eq("id", input.company_id)
      .maybeSingle();
    brand_logo_url = (company?.logo_url as string) || null;
    brand_colors = { primary: "#0B1F3A", secondary: "#C9A227" };
    if (body_html && !body_html.includes("<html")) {
      body_html = wrapBrandedEmail({
        companyName: String(company?.name || "SecureTrack ERP"),
        logoUrl: brand_logo_url,
        address: String(company?.address || ""),
        phone: String(company?.phone || ""),
        email: String(company?.email || ""),
        website: String(company?.website || ""),
        bodyHtml: body_html,
        subject,
      });
    }
  } catch {
    /* branding optional */
  }

  const status = input.scheduled_for ? "scheduled" : "queued";
  const to = input.to_addresses || [];
  const { data, error } = await sb()
    .from("comm_messages")
    .insert({
      company_id: input.company_id,
      message_number,
      channel: input.channel,
      status,
      priority: input.priority || "normal",
      category: input.category || "system",
      source_module: input.source_module || null,
      source_event: input.source_event || null,
      entity_type: input.entity_type || null,
      entity_id: input.entity_id || null,
      entity_code: input.entity_code || null,
      template_id,
      subject,
      body_html,
      body_text,
      to_addresses: to,
      recipient_user_ids: input.recipient_user_ids || [],
      recipient_summary: to.join(", ") || `${(input.recipient_user_ids || []).length} user(s)`,
      brand_logo_url,
      brand_colors,
      scheduled_for: input.scheduled_for || null,
      created_by: input.actor_id || null,
    })
    .select("*")
    .single();
  if (error) throw error;

  // Auto document attachments registry
  for (const doc of input.attach_docs || []) {
    const job_number = await nextJobNumber(input.company_id);
    const { data: job } = await sb()
      .from("comm_document_jobs")
      .insert({
        company_id: input.company_id,
        job_number,
        doc_type: doc,
        entity_type: input.entity_type || null,
        entity_id: input.entity_id || null,
        entity_code: input.entity_code || null,
        status: "ready",
        file_url: null,
        qr_verify_url: `/verify?doc=${doc}&ref=${input.entity_code || data.id}`,
        requested_by: input.actor_id || null,
        completed_at: new Date().toISOString(),
      })
      .select("*")
      .single();

    await sb().from("comm_attachments").insert({
      company_id: input.company_id,
      message_id: data.id,
      doc_type: doc,
      file_name: `${doc}-${input.entity_code || data.message_number}.pdf`,
      file_url: job?.file_url || null,
      qr_payload: JSON.stringify({
        doc,
        ref: input.entity_code,
        msg: data.message_number,
      }),
      barcode_value: data.message_number,
      classification: "confidential",
      is_generated: true,
      metadata: { job_id: job?.id },
    });
  }

  // Simulate send for client-side queue (real Resend path is server API)
  if (status === "queued") {
    await markMessageSent(data.id, input.company_id, input.actor_id);
  }

  await logCommAudit({
    company_id: input.company_id,
    actor_id: input.actor_id,
    action: "compose",
    entity_table: "comm_messages",
    entity_id: data.id,
    details: `${input.channel}: ${subject}`,
  });

  return data;
}

export function wrapBrandedEmail(opts: {
  companyName: string;
  logoUrl?: string | null;
  address?: string;
  phone?: string;
  email?: string;
  website?: string;
  bodyHtml: string;
  subject?: string;
}): string {
  const logo = opts.logoUrl
    ? `<img src="${opts.logoUrl}" alt="${opts.companyName}" height="40" style="height:40px;max-width:180px;" />`
    : `<strong style="color:#C9A227;font-size:18px;">${opts.companyName}</strong>`;
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${opts.subject || opts.companyName}</title></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Inter,Segoe UI,system-ui,sans-serif;color:#0f172a;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:24px 12px;">
    <tr><td align="center">
      <table width="600" style="max-width:600px;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;">
        <tr><td style="background:#0B1F3A;padding:20px 28px;">${logo}</td></tr>
        <tr><td style="padding:28px;font-size:15px;line-height:1.6;">${opts.bodyHtml}</td></tr>
        <tr><td style="padding:16px 28px;background:#0B1F3A;color:#94a3b8;font-size:11px;line-height:1.5;">
          <div style="color:#C9A227;font-weight:600;margin-bottom:6px;">${opts.companyName}</div>
          ${opts.address ? `<div>${opts.address}</div>` : ""}
          ${opts.phone ? `<div>Tel: ${opts.phone}</div>` : ""}
          ${opts.email ? `<div>${opts.email}</div>` : ""}
          ${opts.website ? `<div>${opts.website}</div>` : ""}
          <div style="margin-top:10px;border-top:1px solid #1e3a5f;padding-top:10px;color:#64748b;">
            Confidential — intended recipient only. Verify authenticity via QR footer / SecureTrack verify portal.
          </div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

export async function markMessageSent(
  messageId: string,
  companyId: string,
  actorId?: string | null
) {
  const now = new Date().toISOString();
  const { data, error } = await sb()
    .from("comm_messages")
    .update({
      status: "sent",
      sent_at: now,
      provider: "resend",
      updated_at: now,
    })
    .eq("id", messageId)
    .select("*")
    .single();
  if (error) throw error;

  await sb().from("comm_delivery_events").insert({
    company_id: companyId,
    message_id: messageId,
    event_type: "sent",
    recipient: (data.to_addresses as string[])?.[0] || null,
  });

  // Fan-out in-app notifications for recipient users
  const userIds = (data.recipient_user_ids as string[]) || [];
  for (const uid of userIds) {
    try {
      await sb().from("notifications").insert({
        company_id: companyId,
        user_id: uid,
        title: data.subject || "New message",
        message: data.body_text || data.subject,
        type: "info",
        category: data.category || "system",
        priority: data.priority || "normal",
        source_module: data.source_module,
        source_event: data.source_event,
        entity_type: data.entity_type,
        entity_id: data.entity_id,
        is_read: false,
        created_by: actorId || null,
      });
    } catch {
      /* optional */
    }
  }

  return data;
}

export async function retryMessage(messageId: string, actorId?: string | null) {
  const { data: msg } = await sb().from("comm_messages").select("*").eq("id", messageId).maybeSingle();
  if (!msg) throw new Error("Message not found");
  await sb()
    .from("comm_messages")
    .update({
      status: "queued",
      retry_count: Number(msg.retry_count || 0) + 1,
      error_message: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", messageId);
  await sb().from("comm_delivery_events").insert({
    company_id: msg.company_id,
    message_id: messageId,
    event_type: "retried",
  });
  return markMessageSent(messageId, msg.company_id as string, actorId);
}

/** Publish ERP event → fire matching communication rules */
export async function publishCommEvent(input: PublishEventInput) {
  const { data: rules } = await sb()
    .from("comm_event_rules")
    .select("*")
    .eq("company_id", input.company_id)
    .eq("event_key", input.event_key)
    .eq("is_active", true);

  const results = [];
  for (const rule of rules || []) {
    const channels = (rule.channels as string[]) || ["in_app"];
    const audience = (rule.audience as Record<string, unknown>) || {};
    const roles = (audience.roles as string[]) || [];

    // Resolve user IDs by role slug
    let userIds: string[] = [];
    if (roles.length) {
      const { data: roleRows } = await sb().from("roles").select("id,slug").in("slug", roles);
      const roleIds = (roleRows || []).map((r) => r.id);
      if (roleIds.length) {
        const { data: profiles } = await sb()
          .from("user_profiles")
          .select("id")
          .eq("company_id", input.company_id)
          .in("role_id", roleIds)
          .eq("is_active", true)
          .limit(50);
        userIds = (profiles || []).map((p) => p.id as string);
      }
    }

    const vars = {
      company_name: "SecureTrack ERP",
      ...(input.vars || {}),
    };

    for (const channel of channels) {
      if (channel === "teams" || channel === "slack") continue;
      const msg = await composeMessage({
        company_id: input.company_id,
        channel,
        template_code: rule.template_code || undefined,
        subject: applyVars(rule.subject_template, vars),
        body_text: applyVars(rule.body_template, vars),
        body_html: `<p>${applyVars(rule.body_template, vars)}</p>`,
        recipient_user_ids: userIds,
        to_addresses: input.extra_recipients || [],
        category: input.source_module,
        priority: rule.priority || "normal",
        source_module: input.source_module,
        source_event: input.event_key,
        entity_type: input.entity_type,
        entity_id: input.entity_id,
        entity_code: input.entity_code,
        attach_docs: (rule.attach_docs as string[]) || [],
        actor_id: input.actor_id,
        vars,
      });
      results.push(msg);
    }
  }
  return results;
}

// ─── Templates / Rules / Campaigns CRUD ──────────────────────

export async function listTemplates(companyId: string) {
  const { data, error } = await sb()
    .from("comm_templates")
    .select("*")
    .eq("company_id", companyId)
    .is("deleted_at", null)
    .order("name");
  if (error) throw error;
  return data || [];
}

export async function upsertTemplate(
  input: Record<string, unknown>,
  actorId?: string | null
) {
  if (input.id) {
    const { data, error } = await sb()
      .from("comm_templates")
      .update({ ...input, updated_at: new Date().toISOString() })
      .eq("id", input.id)
      .select("*")
      .single();
    if (error) throw error;
    return data;
  }
  const { data, error } = await sb()
    .from("comm_templates")
    .insert({ ...input, created_by: actorId })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function listEventRules(companyId: string) {
  const { data, error } = await sb()
    .from("comm_event_rules")
    .select("*")
    .eq("company_id", companyId)
    .order("event_key");
  if (error) throw error;
  return data || [];
}

export async function listSchedules(companyId: string) {
  const { data, error } = await sb()
    .from("comm_schedules")
    .select("*")
    .eq("company_id", companyId)
    .order("name");
  if (error) throw error;
  return data || [];
}

export async function listReminders(companyId: string) {
  const { data, error } = await sb()
    .from("comm_reminders")
    .select("*")
    .eq("company_id", companyId)
    .order("due_at")
    .limit(100);
  if (error) throw error;
  return data || [];
}

export async function createReminder(input: {
  company_id: string;
  title: string;
  due_at: string;
  message?: string;
  entity_type?: string;
  entity_id?: string;
  recipient_user_ids?: string[];
}) {
  const { data, error } = await sb()
    .from("comm_reminders")
    .insert({
      company_id: input.company_id,
      title: input.title,
      due_at: input.due_at,
      message: input.message || null,
      entity_type: input.entity_type || null,
      entity_id: input.entity_id || null,
      recipient_user_ids: input.recipient_user_ids || [],
      status: "pending",
    })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function listCampaigns(companyId: string) {
  const { data, error } = await sb()
    .from("comm_campaigns")
    .select("*")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function createCampaign(input: {
  company_id: string;
  name: string;
  channel?: string;
  subject?: string;
  body_html?: string;
  created_by?: string | null;
}) {
  const year = new Date().getFullYear();
  const { count } = await sb()
    .from("comm_campaigns")
    .select("*", { count: "exact", head: true })
    .eq("company_id", input.company_id);
  const campaign_code = `CMP-${year}-${String((count ?? 0) + 1).padStart(4, "0")}`;
  const { data, error } = await sb()
    .from("comm_campaigns")
    .insert({
      company_id: input.company_id,
      campaign_code,
      name: input.name,
      channel: input.channel || "email",
      subject: input.subject || null,
      body_html: input.body_html || null,
      status: "draft",
      created_by: input.created_by || null,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function listAnnouncements(companyId: string) {
  const { data, error } = await sb()
    .from("comm_announcements")
    .select("*")
    .eq("company_id", companyId)
    .order("publish_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function createAnnouncement(input: {
  company_id: string;
  title: string;
  body: string;
  priority?: string;
  is_pinned?: boolean;
  created_by?: string | null;
}) {
  const { data, error } = await sb()
    .from("comm_announcements")
    .insert({
      company_id: input.company_id,
      title: input.title,
      body: input.body,
      priority: input.priority || "normal",
      is_pinned: input.is_pinned || false,
      status: "published",
      created_by: input.created_by || null,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function listProviders(companyId: string) {
  const { data, error } = await sb()
    .from("comm_providers")
    .select("*")
    .eq("company_id", companyId)
    .order("display_name");
  if (error) throw error;
  return data || [];
}

export async function listDocumentJobs(companyId: string) {
  const { data, error } = await sb()
    .from("comm_document_jobs")
    .select("*")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  return data || [];
}

export async function listDeliveryEvents(companyId: string, limit = 100) {
  const { data, error } = await sb()
    .from("comm_delivery_events")
    .select("*, comm_messages(message_number, subject, channel)")
    .eq("company_id", companyId)
    .order("occurred_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
}

export async function listCommAudit(companyId: string, limit = 100) {
  const { data, error } = await sb()
    .from("comm_audit_log")
    .select("*")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
}

export async function aiDraftEmail(input: {
  intent: string;
  tone?: string;
  facts?: string;
}): Promise<{ subject: string; body: string }> {
  // Rule-based professional draft (no external LLM required)
  const tone = input.tone || "professional";
  const subject = `${input.intent.slice(0, 60)}${input.intent.length > 60 ? "…" : ""}`;
  const body = [
    "Dear Colleague,",
    "",
    input.intent,
    input.facts ? `\nDetails:\n${input.facts}` : "",
    "",
    tone === "urgent"
      ? "Please treat this as high priority and respond at your earliest convenience."
      : "Please let us know if you need any further information.",
    "",
    "Kind regards,",
    "SecureTrack ERP",
  ]
    .filter(Boolean)
    .join("\n");
  return { subject, body };
}
