/**
 * Push notifications via FCM legacy HTTP or OneSignal.
 */

import { providersConfig } from "../config";
import { providerFetch, sandboxResult } from "../http";
import type { ProviderCallResult, PushInput } from "../types";

export async function sendPush(
  input: PushInput
): Promise<ProviderCallResult<{ id?: string }>> {
  // Prefer OneSignal when configured
  if (providersConfig.onesignal.configured && !providersConfig.onesignal.sandbox) {
    return sendOneSignal(input);
  }
  if (providersConfig.fcm.configured && !providersConfig.fcm.sandbox) {
    return sendFcm(input);
  }

  // Sandbox / not configured
  return sandboxResult("fcm", {
    id: `push-sandbox-${Date.now()}`,
    title: input.title,
    body: input.body,
    tokens: input.tokens?.length || 0,
  });
}

async function sendFcm(
  input: PushInput
): Promise<ProviderCallResult<{ id?: string }>> {
  const cfg = providersConfig.fcm;
  try {
    const { res, json, text } = await providerFetch(
      "https://fcm.googleapis.com/fcm/send",
      {
        method: "POST",
        headers: {
          Authorization: `key=${cfg.serverKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          registration_ids: input.tokens?.length ? input.tokens : undefined,
          to: !input.tokens?.length && input.topic ? `/topics/${input.topic}` : undefined,
          notification: {
            title: input.title,
            body: input.body,
          },
          data: input.data || {},
        }),
      }
    );
    const body = json as { message_id?: number; success?: number; error?: string };
    if (res.ok && (body.message_id || body.success)) {
      return {
        ok: true,
        status: res.status,
        provider: "fcm",
        externalId: String(body.message_id || "ok"),
        data: { id: String(body.message_id || "ok") },
        raw: json,
      };
    }
    return {
      ok: false,
      status: res.status,
      provider: "fcm",
      error: body.error || text.slice(0, 300) || `FCM HTTP ${res.status}`,
      raw: json,
    };
  } catch (e) {
    return {
      ok: false,
      provider: "fcm",
      error: e instanceof Error ? e.message : "FCM failed",
    };
  }
}

async function sendOneSignal(
  input: PushInput
): Promise<ProviderCallResult<{ id?: string }>> {
  const cfg = providersConfig.onesignal;
  try {
    const { res, json, text } = await providerFetch(
      "https://onesignal.com/api/v1/notifications",
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${cfg.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          app_id: cfg.appId,
          headings: { en: input.title },
          contents: { en: input.body },
          include_player_ids: input.tokens?.length ? input.tokens : undefined,
          included_segments: !input.tokens?.length ? ["All"] : undefined,
          data: input.data || {},
        }),
      }
    );
    const body = json as { id?: string; errors?: unknown };
    if (res.ok && body.id) {
      return {
        ok: true,
        status: res.status,
        provider: "onesignal",
        externalId: body.id,
        data: { id: body.id },
        raw: json,
      };
    }
    return {
      ok: false,
      status: res.status,
      provider: "onesignal",
      error: text.slice(0, 300) || `OneSignal HTTP ${res.status}`,
      raw: json,
    };
  } catch (e) {
    return {
      ok: false,
      provider: "onesignal",
      error: e instanceof Error ? e.message : "OneSignal failed",
    };
  }
}
