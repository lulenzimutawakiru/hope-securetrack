import { createClient } from "@/lib/supabase/client";
import { chatAssist, handleBotCommand } from "./ai";
import type { ChatMessageInput } from "./types";

function sb() {
  return createClient();
}

/** Map PostgREST / Supabase errors to actionable chat messages */
function chatWriteError(error: { message?: string; code?: string; details?: string } | null, action = "send"): Error {
  const msg = String(error?.message || error?.details || "");
  const code = String(error?.code || "");
  if (
    code === "42501" ||
    /row-level security|permission denied|rls/i.test(msg)
  ) {
    return new Error(
      `Cannot ${action}: missing channel access or chat permission (hc.view). Join the channel or ask an admin to grant HopeChat access.`
    );
  }
  if (code === "PGRST116" || /0 rows|Cannot coerce/i.test(msg)) {
    return new Error(
      `Cannot ${action}: message was blocked by security policy (not a channel member). Re-open the channel and try again.`
    );
  }
  return new Error(msg || `Failed to ${action} message`);
}

export async function logHcAudit(input: {
  company_id: string;
  actor_id?: string | null;
  action: string;
  entity_type?: string;
  entity_id?: string;
  details?: string;
}) {
  await sb().from("hc_audit_log").insert({
    company_id: input.company_id,
    actor_id: input.actor_id,
    action: input.action,
    entity_type: input.entity_type,
    entity_id: input.entity_id,
    details: input.details,
  });
}

export async function listChannels(companyId: string, userId?: string) {
  const { data: channels } = await sb()
    .from("hc_channels")
    .select("*")
    .eq("company_id", companyId)
    .is("deleted_at", null)
    .eq("is_archived", false)
    .order("last_message_at", { ascending: false, nullsFirst: false });

  if (!userId) return channels || [];

  const { data: memberships } = await sb()
    .from("hc_channel_members")
    .select("channel_id, muted, pinned, last_read_at")
    .eq("user_id", userId);

  const memMap = new Map(
    (memberships || []).map((m) => [m.channel_id as string, m])
  );

  return (channels || []).map((c) => ({
    ...c,
    membership: memMap.get(c.id as string) || null,
  }));
}

export async function getMessages(channelId: string, limit = 80) {
  const { data, error } = await sb()
    .from("hc_messages")
    .select("*")
    .eq("channel_id", channelId)
    .is("deleted_at", null)
    .order("created_at", { ascending: true })
    .limit(limit);
  if (error) throw error;
  return data || [];
}

export async function sendMessage(input: {
  company_id: string;
  channel_id: string;
  sender_id?: string | null;
  sender_name?: string;
  message: ChatMessageInput;
}) {
  const body = input.message.body.trim();
  if (!body) throw new Error("Empty message");

  // Ensure membership before insert so RLS SELECT (RETURNING) succeeds.
  if (input.sender_id) {
    await ensureChannelMembership({
      company_id: input.company_id,
      channel_id: input.channel_id,
      user_id: input.sender_id,
    });
  }

  // Bot intercept
  const bot = handleBotCommand(body);
  const { data: msg, error } = await sb()
    .from("hc_messages")
    .insert({
      company_id: input.company_id,
      channel_id: input.channel_id,
      sender_id: input.sender_id,
      sender_name: input.sender_name || "User",
      message_type: input.message.message_type || "text",
      body,
      reply_to_id: input.message.reply_to_id,
      metadata: input.message.metadata || {},
      delivered_at: new Date().toISOString(),
    })
    .select("*")
    .single();
  if (error) throw chatWriteError(error, "send");

  // Channel metadata (last_message_at / message_count) is maintained by the
  // server-side trigger tr_hc_notify_recipients (secure + realtime-safe).

  // Auto bot reply
  if (bot) {
    const { data: botMsg } = await sb()
      .from("hc_messages")
      .insert({
        company_id: input.company_id,
        channel_id: input.channel_id,
        sender_name: bot.botDomain === "general" ? "SecureTrackAI" : `${bot.botDomain?.toUpperCase()} Bot`,
        message_type: "bot",
        body: bot.reply,
        reply_to_id: msg.id,
        metadata: { bot: bot.botDomain, suggestedTasks: bot.suggestedTasks },
      })
      .select("*")
      .single();
    return { message: msg, botMessage: botMsg, bot };
  }

  return { message: msg, botMessage: null, bot: null };
}

export async function editMessage(messageId: string, body: string) {
  const { data, error } = await sb()
    .from("hc_messages")
    .update({
      body,
      is_edited: true,
      updated_at: new Date().toISOString(),
    })
    .eq("id", messageId)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function softDeleteMessage(messageId: string) {
  await sb()
    .from("hc_messages")
    .update({ deleted_at: new Date().toISOString(), body: "[deleted]" })
    .eq("id", messageId);
}

export async function pinMessage(messageId: string, pinned = true) {
  await sb()
    .from("hc_messages")
    .update({ is_pinned: pinned })
    .eq("id", messageId);
}

export async function reactToMessage(input: {
  company_id: string;
  message_id: string;
  user_id: string;
  emoji: string;
}) {
  // toggle
  const { data: existing } = await sb()
    .from("hc_reactions")
    .select("id")
    .eq("message_id", input.message_id)
    .eq("user_id", input.user_id)
    .eq("emoji", input.emoji)
    .maybeSingle();

  if (existing) {
    await sb().from("hc_reactions").delete().eq("id", existing.id);
    return { removed: true };
  }

  await sb().from("hc_reactions").insert({
    company_id: input.company_id,
    message_id: input.message_id,
    user_id: input.user_id,
    emoji: input.emoji,
  });
  return { removed: false };
}

export async function createChannel(input: {
  company_id: string;
  name: string;
  channel_type?: string;
  description?: string;
  is_private?: boolean;
  created_by?: string | null;
  member_ids?: string[];
}) {
  const slug = input.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);

  const { data, error } = await sb()
    .from("hc_channels")
    .insert({
      company_id: input.company_id,
      name: input.name,
      slug,
      channel_type: input.channel_type || "channel",
      description: input.description,
      is_private: input.is_private || false,
      created_by: input.created_by,
    })
    .select("*")
    .single();
  if (error) throw error;

  const members = new Set(input.member_ids || []);
  if (input.created_by) members.add(input.created_by);

  for (const uid of members) {
    await sb().from("hc_channel_members").insert({
      company_id: input.company_id,
      channel_id: data.id,
      user_id: uid,
      role: uid === input.created_by ? "owner" : "member",
    });
  }

  await logHcAudit({
    company_id: input.company_id,
    actor_id: input.created_by,
    action: "create_channel",
    entity_type: "hc_channels",
    entity_id: data.id,
    details: input.name,
  });

  return data;
}

export async function startDm(input: {
  company_id: string;
  self_id: string;
  self_name: string;
  other_id: string;
  other_name: string;
}) {
  // Find existing DM between users
  const { data: myMemberships } = await sb()
    .from("hc_channel_members")
    .select("channel_id")
    .eq("user_id", input.self_id);

  for (const m of myMemberships || []) {
    const { data: ch } = await sb()
      .from("hc_channels")
      .select("*")
      .eq("id", m.channel_id)
      .eq("channel_type", "dm")
      .maybeSingle();
    if (!ch) continue;
    const { data: other } = await sb()
      .from("hc_channel_members")
      .select("user_id")
      .eq("channel_id", ch.id)
      .eq("user_id", input.other_id)
      .maybeSingle();
    if (other) return ch;
  }

  const name = [input.self_name, input.other_name].filter(Boolean).join("  ·  ");
  return createChannel({
    company_id: input.company_id,
    name: name || "Direct message",
    channel_type: "dm",
    is_private: true,
    created_by: input.self_id,
    member_ids: [input.self_id, input.other_id],
  });
}

export async function markChannelRead(input: {
  channel_id: string;
  user_id: string;
}) {
  await sb()
    .from("hc_channel_members")
    .update({ last_read_at: new Date().toISOString() })
    .eq("channel_id", input.channel_id)
    .eq("user_id", input.user_id);
}

/** Ensure the user has a membership row for a channel (self-heal for
 *  accounts created before the public-channel autofollow migration). */
export async function ensureChannelMembership(input: {
  company_id: string;
  channel_id: string;
  user_id: string;
}) {
  const { error } = await sb()
    .from("hc_channel_members")
    .upsert(
      {
        company_id: input.company_id,
        channel_id: input.channel_id,
        user_id: input.user_id,
        role: "member",
        joined_at: new Date().toISOString(),
      },
      { onConflict: "channel_id,user_id", ignoreDuplicates: true }
    );
  if (error) {
    // Membership is best-effort for public channels (RLS may still allow
    // insert via the public-channel policy). Surface only hard auth failures.
    if (/row-level security|permission denied|42501/i.test(error.message || "")) {
      throw chatWriteError(error, "join channel");
    }
  }
}
export async function createMeeting(input: {
  company_id: string;
  title: string;
  description?: string;
  host_id?: string | null;
  host_name?: string;
  channel_id?: string | null;
  scheduled_start?: string;
  scheduled_end?: string;
  agenda?: string;
}) {
  const { count } = await sb()
    .from("hc_meetings")
    .select("*", { count: "exact", head: true })
    .eq("company_id", input.company_id);
  const meeting_code = `MTG-${String((count ?? 0) + 1).padStart(5, "0")}`;

  const { data, error } = await sb()
    .from("hc_meetings")
    .insert({
      company_id: input.company_id,
      meeting_code,
      title: input.title,
      description: input.description,
      host_id: input.host_id,
      host_name: input.host_name,
      channel_id: input.channel_id,
      scheduled_start: input.scheduled_start || new Date().toISOString(),
      scheduled_end: input.scheduled_end,
      agenda: input.agenda,
      status: "scheduled",
      join_url: `/dashboard/chat/meetings?join=${meeting_code}`,
    })
    .select("*")
    .single();
  if (error) throw error;

  if (input.channel_id) {
    await sendMessage({
      company_id: input.company_id,
      channel_id: input.channel_id,
      sender_id: input.host_id,
      sender_name: input.host_name || "Host",
      message: {
        body: `📅 Meeting scheduled: **${input.title}**\nCode: ${meeting_code}\nJoin: ${data.join_url}`,
        message_type: "system",
      },
    });
  }

  return data;
}

export async function startMeeting(meetingId: string) {
  const { data, error } = await sb()
    .from("hc_meetings")
    .update({
      status: "live",
      started_at: new Date().toISOString(),
    })
    .eq("id", meetingId)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function endMeeting(meetingId: string, aiSummary?: string) {
  const { data, error } = await sb()
    .from("hc_meetings")
    .update({
      status: "ended",
      ended_at: new Date().toISOString(),
      ai_summary: aiSummary || "Meeting ended. Action items to be assigned.",
      minutes_text: aiSummary || "Minutes pending.",
    })
    .eq("id", meetingId)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function createChatTask(input: {
  company_id: string;
  title: string;
  channel_id?: string | null;
  message_id?: string | null;
  assignee_name?: string;
  due_date?: string;
  linked_module?: string;
  created_by?: string | null;
}) {
  const { data, error } = await sb()
    .from("hc_chat_tasks")
    .insert({
      company_id: input.company_id,
      title: input.title,
      channel_id: input.channel_id,
      message_id: input.message_id,
      assignee_name: input.assignee_name,
      due_date: input.due_date || null,
      linked_module: input.linked_module,
      created_by: input.created_by,
      status: "open",
    })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function publishAnnouncement(input: {
  company_id: string;
  title: string;
  body: string;
  priority?: string;
  require_ack?: boolean;
  created_by?: string | null;
}) {
  const { data, error } = await sb()
    .from("hc_announcements")
    .insert({
      company_id: input.company_id,
      title: input.title,
      body: input.body,
      priority: input.priority || "normal",
      require_ack: input.require_ack || false,
      status: "published",
      published_at: new Date().toISOString(),
      created_by: input.created_by,
      audience: "company",
    })
    .select("*")
    .single();
  if (error) throw error;

  // Post to announcements channel if exists
  const { data: ch } = await sb()
    .from("hc_channels")
    .select("id")
    .eq("company_id", input.company_id)
    .eq("slug", "announcements")
    .maybeSingle();

  if (ch) {
    await sendMessage({
      company_id: input.company_id,
      channel_id: ch.id,
      sender_id: input.created_by,
      sender_name: "Announcements",
      message: {
        body: `📢 **${input.title}**\n\n${input.body}`,
        message_type: "announcement",
        metadata: { announcement_id: data.id, priority: input.priority },
      },
    });
  }

  return data;
}

export async function ackAnnouncement(input: {
  company_id: string;
  announcement_id: string;
  user_id: string;
}) {
  await sb().from("hc_announcement_acks").insert({
    company_id: input.company_id,
    announcement_id: input.announcement_id,
    user_id: input.user_id,
  });
  const { data: a } = await sb()
    .from("hc_announcements")
    .select("ack_count")
    .eq("id", input.announcement_id)
    .single();
  await sb()
    .from("hc_announcements")
    .update({ ack_count: Number(a?.ack_count || 0) + 1 })
    .eq("id", input.announcement_id);
}

export async function registerFile(input: {
  company_id: string;
  channel_id?: string | null;
  message_id?: string | null;
  uploader_id?: string | null;
  file_name: string;
  file_type?: string;
  file_size_bytes?: number;
  storage_url?: string;
}) {
  const { data, error } = await sb()
    .from("hc_files")
    .insert({
      company_id: input.company_id,
      channel_id: input.channel_id,
      message_id: input.message_id,
      uploader_id: input.uploader_id,
      file_name: input.file_name,
      file_type: input.file_type,
      file_size_bytes: input.file_size_bytes || 0,
      storage_url: input.storage_url || `hopechat://files/${encodeURIComponent(input.file_name)}`,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function hopeAiAssist(input: {
  company_id: string;
  channel_id?: string;
  prompt: string;
}) {
  let recent: Array<{ sender_name?: string | null; body?: string | null }> = [];
  if (input.channel_id) {
    const msgs = await getMessages(input.channel_id, 30);
    recent = msgs.map((m) => ({
      sender_name: m.sender_name as string,
      body: m.body as string,
    }));
  }
  return chatAssist(input.prompt, recent);
}

export async function convertMessageToTicket(input: {
  company_id: string;
  message_id: string;
  created_by?: string | null;
}) {
  const { data: msg } = await sb()
    .from("hc_messages")
    .select("*, hc_channels(name, slug)")
    .eq("id", input.message_id)
    .single();
  if (!msg) throw new Error("Message not found");

  try {
    const { createTicket } = await import("@/lib/service-desk");
    const ch = msg.hc_channels as { name?: string; slug?: string } | null;
    const ticket = await createTicket({
      company_id: input.company_id,
      created_by: input.created_by,
      ticket: {
        subject: `Chat: ${(msg.body as string)?.slice(0, 80) || "SecureChat report"}`,
        description: `From SecureChat #${ch?.slug || ch?.name || "channel"}\n\n${msg.body}\n\n— ${msg.sender_name}`,
        category: ch?.slug === "production" ? "production" : "general",
        service_type: ch?.slug === "it-support" ? "it" : ch?.slug === "hr" ? "hr" : "it",
        channel: "chat",
        priority: "medium",
        requester_name: msg.sender_name as string,
      },
    });
    await sb()
      .from("hc_messages")
      .update({
        metadata: {
          ...((msg.metadata as object) || {}),
          ticket_id: ticket.id,
          ticket_number: ticket.ticket_number,
        },
      })
      .eq("id", input.message_id);
    return ticket;
  } catch (e) {
    throw e;
  }
}

export async function listCompanyUsers(companyId: string) {
  const { data, error } = await sb()
    .from("user_profiles")
    .select("id, first_name, last_name, email, avatar_url, job_title, department_code")
    .eq("company_id", companyId)
    .is("deleted_at", null)
    .order("first_name", { ascending: true });
  if (error) throw error;
  return (data || []).map((u) => ({
    ...u,
    name: `${u.first_name || ""} ${u.last_name || ""}`.trim() || u.email || "User",
  }));
}

function safeFileName(name: string): string {
  const base = name.replace(/[^\w.\- ]+/g, "").trim().replace(/\s+/g, "-");
  return base || `file-${Date.now()}`;
}

/** Upload a chat attachment to the private attachments bucket (company-scoped) */
export async function uploadChatFile(input: {
  company_id: string;
  channel_id: string;
  uploader_id?: string | null;
  file: File;
}) {
  const clean = safeFileName(input.file.name);
  const path = `${input.company_id}/chat/${input.channel_id}/${crypto.randomUUID()}-${clean}`;
  const { error: upErr } = await sb()
    .storage
    .from("attachments")
    .upload(path, input.file, {
      contentType: input.file.type || "application/octet-stream",
      cacheControl: "3600",
      upsert: false,
    });
  if (upErr) throw upErr;

  const record = await registerFile({
    company_id: input.company_id,
    channel_id: input.channel_id,
    uploader_id: input.uploader_id,
    file_name: input.file.name,
    file_type: input.file.type || "application/octet-stream",
    file_size_bytes: input.file.size,
    storage_url: path,
  });
  return { record, path };
}

/** Get a time-limited signed URL for a private attachment */
export async function getSignedFileUrl(storagePath: string): Promise<string> {
  const { data, error } = await sb()
    .storage
    .from("attachments")
    .createSignedUrl(storagePath, 3600);
  if (error) throw error;
  return data.signedUrl;
}

/** Send a message carrying a real uploaded file */
export async function sendFileMessage(input: {
  company_id: string;
  channel_id: string;
  sender_id?: string | null;
  sender_name?: string;
  file: File;
}) {
  if (input.sender_id) {
    await ensureChannelMembership({
      company_id: input.company_id,
      channel_id: input.channel_id,
      user_id: input.sender_id,
    });
  }

  const { record, path } = await uploadChatFile({
    company_id: input.company_id,
    channel_id: input.channel_id,
    uploader_id: input.sender_id,
    file: input.file,
  });

  const { data: msg, error } = await sb()
    .from("hc_messages")
    .insert({
      company_id: input.company_id,
      channel_id: input.channel_id,
      sender_id: input.sender_id,
      sender_name: input.sender_name || "User",
      message_type: "file",
      body: input.file.name,
      metadata: {
        file_id: record.id,
        file_name: input.file.name,
        file_type: input.file.type || "application/octet-stream",
        file_size_bytes: input.file.size,
        storage_url: path,
      },
      delivered_at: new Date().toISOString(),
    })
    .select("*")
    .single();
  if (error) throw chatWriteError(error, "send file");
  return { message: msg, file: record };
}