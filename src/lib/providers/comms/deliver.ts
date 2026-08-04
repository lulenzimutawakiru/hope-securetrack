/**
 * Unified external channel delivery for notification queue drain.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { sendSms } from "./africastalking";
import { sendWhatsApp } from "./whatsapp";
import { sendPush } from "./push";

export type ChannelDeliverInput = {
  companyId: string;
  channel: string;
  recipient: string;
  subject?: string | null;
  body?: string | null;
  notificationId?: string | null;
  userId?: string | null;
  payload?: Record<string, unknown> | null;
};

export type ChannelDeliverResult = {
  ok: boolean;
  provider: string;
  error?: string;
  externalId?: string;
};

async function resolveUserPhone(
  companyId: string,
  recipient: string,
  userId?: string | null
): Promise<string | null> {
  // If recipient looks like a phone, use it
  if (/^\+?\d{9,15}$/.test(recipient.replace(/[\s-]/g, ""))) {
    return recipient.replace(/[\s-]/g, "");
  }
  const admin = createAdminClient();
  if (userId) {
    const { data } = await admin
      .from("user_profiles")
      .select("phone, mobile")
      .eq("id", userId)
      .maybeSingle();
    const p = (data?.phone || data?.mobile) as string | undefined;
    if (p) return p;
  }
  // Try employee by user_id
  if (userId) {
    const { data: emp } = await admin
      .from("employees")
      .select("phone, mobile_phone")
      .eq("company_id", companyId)
      .eq("user_id", userId)
      .maybeSingle();
    const p = (emp?.phone || emp?.mobile_phone) as string | undefined;
    if (p) return p;
  }
  return null;
}

async function resolvePushTokens(
  companyId: string,
  userId?: string | null
): Promise<string[]> {
  if (!userId) return [];
  const admin = createAdminClient();
  try {
    const { data } = await admin
      .from("user_push_tokens")
      .select("token")
      .eq("company_id", companyId)
      .eq("user_id", userId)
      .eq("is_active", true)
      .limit(20);
    return (data || []).map((r) => String(r.token)).filter(Boolean);
  } catch {
    return [];
  }
}

export async function deliverExternalChannel(
  input: ChannelDeliverInput
): Promise<ChannelDeliverResult> {
  const channel = input.channel.toLowerCase();
  const message = [input.subject, input.body].filter(Boolean).join("\n").slice(0, 1000);

  if (channel === "sms") {
    const phone =
      (await resolveUserPhone(input.companyId, input.recipient, input.userId)) ||
      input.recipient;
    const r = await sendSms({
      to: phone,
      message: message || "SecureTrack notification",
      companyId: input.companyId,
    });
    return {
      ok: r.ok,
      provider: "africastalking",
      error: r.error,
      externalId: r.externalId || r.data?.messageId,
    };
  }

  if (channel === "whatsapp") {
    const phone =
      (await resolveUserPhone(input.companyId, input.recipient, input.userId)) ||
      input.recipient;
    const r = await sendWhatsApp({
      to: phone,
      message: message || "SecureTrack notification",
      companyId: input.companyId,
    });
    return {
      ok: r.ok,
      provider: "whatsapp",
      error: r.error,
      externalId: r.externalId || r.data?.messageId,
    };
  }

  if (channel === "push") {
    const tokens =
      (input.payload?.tokens as string[] | undefined) ||
      (await resolvePushTokens(input.companyId, input.userId));
    const r = await sendPush({
      tokens: tokens.length ? tokens : undefined,
      title: input.subject || "SecureTrack",
      body: input.body || message || "You have a new notification",
      companyId: input.companyId,
      data: {
        notification_id: input.notificationId || "",
        company_id: input.companyId,
      },
    });
    return {
      ok: r.ok,
      provider: String(r.provider),
      error: r.error,
      externalId: r.externalId || r.data?.id,
    };
  }

  return {
    ok: false,
    provider: "unknown",
    error: `Unsupported channel: ${channel}`,
  };
}
