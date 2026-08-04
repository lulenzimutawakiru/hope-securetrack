/**
 * SecureTrack Slack integration — server only.
 * Uses platform OAuth app + per-company workspace installs.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { slackPlatformConfig, slackRedirectUri } from "./config";
import { SLACK_BOT_SCOPES, type SlackNotifyInput, type SlackNotifyResult, type SlackWorkspace } from "./types";

function adminOr(sb?: SupabaseClient) {
  return sb || createAdminClient();
}

function publicWorkspace(row: Record<string, unknown>): SlackWorkspace {
  return {
    id: String(row.id),
    company_id: String(row.company_id),
    tenant_id: (row.tenant_id as string | null) ?? null,
    team_id: String(row.team_id),
    team_name: (row.team_name as string | null) ?? null,
    team_domain: (row.team_domain as string | null) ?? null,
    bot_user_id: (row.bot_user_id as string | null) ?? null,
    default_channel_id: (row.default_channel_id as string | null) ?? null,
    default_channel_name: (row.default_channel_name as string | null) ?? null,
    // never return secrets to browser
    incoming_webhook_url: row.incoming_webhook_url
      ? "[configured]"
      : null,
    incoming_webhook_channel:
      (row.incoming_webhook_channel as string | null) ?? null,
    scopes: (row.scopes as string[] | null) ?? null,
    notify_tickets: Boolean(row.notify_tickets),
    notify_alerts: Boolean(row.notify_alerts),
    notify_approvals: Boolean(row.notify_approvals),
    notify_chat_mentions: Boolean(row.notify_chat_mentions),
    is_enabled: Boolean(row.is_enabled),
    last_error: (row.last_error as string | null) ?? null,
    last_success_at: (row.last_success_at as string | null) ?? null,
    installed_at: (row.installed_at as string | null) ?? null,
  };
}

export async function getSlackWorkspace(
  companyId: string,
  sb?: SupabaseClient
): Promise<SlackWorkspace | null> {
  const client = adminOr(sb);
  const { data } = await client
    .from("intg_slack_workspaces")
    .select("*")
    .eq("company_id", companyId)
    .is("deleted_at", null)
    .eq("is_enabled", true)
    .order("installed_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  return publicWorkspace(data as Record<string, unknown>);
}

export async function listSlackWorkspaces(
  companyId: string,
  sb?: SupabaseClient
): Promise<SlackWorkspace[]> {
  const client = adminOr(sb);
  const { data, error } = await client
    .from("intg_slack_workspaces")
    .select("*")
    .eq("company_id", companyId)
    .is("deleted_at", null)
    .order("installed_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data || []).map((r) => publicWorkspace(r as Record<string, unknown>));
}

export function buildSlackOAuthUrl(input: {
  companyId: string;
  userId: string;
  origin?: string;
  stateNonce: string;
}): string {
  const { clientId, configured } = slackPlatformConfig();
  if (!configured || !clientId) {
    throw new Error("Slack platform app is not configured (SLACK_CLIENT_ID)");
  }
  const redirect = slackRedirectUri(input.origin);
  const state = Buffer.from(
    JSON.stringify({
      c: input.companyId,
      u: input.userId,
      n: input.stateNonce,
      t: Date.now(),
    }),
    "utf8"
  ).toString("base64url");

  const params = new URLSearchParams({
    client_id: clientId,
    scope: SLACK_BOT_SCOPES.join(","),
    redirect_uri: redirect,
    state,
  });
  return `https://slack.com/oauth/v2/authorize?${params.toString()}`;
}

export function parseOAuthState(
  state: string
): { companyId: string; userId: string; nonce: string; ts: number } | null {
  try {
    const raw = JSON.parse(
      Buffer.from(state, "base64url").toString("utf8")
    ) as { c?: string; u?: string; n?: string; t?: number };
    if (!raw.c || !raw.u || !raw.n) return null;
    return {
      companyId: raw.c,
      userId: raw.u,
      nonce: raw.n,
      ts: Number(raw.t || 0),
    };
  } catch {
    return null;
  }
}

export async function exchangeSlackOAuthCode(input: {
  code: string;
  origin?: string;
}): Promise<Record<string, unknown>> {
  const { clientId, clientSecret } = slackPlatformConfig();
  if (!clientId || !clientSecret) {
    throw new Error("Slack OAuth credentials missing");
  }
  const redirect = slackRedirectUri(input.origin);
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    code: input.code,
    redirect_uri: redirect,
  });
  const res = await fetch("https://slack.com/api/oauth.v2.access", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const json = (await res.json()) as Record<string, unknown>;
  if (!json.ok) {
    throw new Error(String(json.error || "oauth.v2.access failed"));
  }
  return json;
}

export async function saveSlackInstallation(input: {
  companyId: string;
  tenantId?: string | null;
  userId: string;
  oauth: Record<string, unknown>;
  sb?: SupabaseClient;
}): Promise<SlackWorkspace> {
  const client = adminOr(input.sb);
  const team = (input.oauth.team || {}) as { id?: string; name?: string };
  const authed = (input.oauth.authed_user || {}) as { id?: string };
  const incoming = (input.oauth.incoming_webhook || {}) as {
    url?: string;
    channel?: string;
    channel_id?: string;
  };
  const teamId = String(team.id || "");
  if (!teamId) throw new Error("Slack team id missing from OAuth response");

  const botToken = String(input.oauth.access_token || "");
  const scopes = String(input.oauth.scope || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const row = {
    company_id: input.companyId,
    tenant_id: input.tenantId || null,
    team_id: teamId,
    team_name: team.name || null,
    bot_user_id: (input.oauth.bot_user_id as string) || authed.id || null,
    bot_access_token: botToken || null,
    default_channel_id: incoming.channel_id || null,
    default_channel_name: incoming.channel || null,
    incoming_webhook_url: incoming.url || null,
    incoming_webhook_channel: incoming.channel || null,
    scopes,
    is_enabled: true,
    installed_by: input.userId,
    installed_at: new Date().toISOString(),
    last_error: null,
    last_success_at: new Date().toISOString(),
    deleted_at: null,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await client
    .from("intg_slack_workspaces")
    .upsert(row, { onConflict: "company_id,team_id" })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return publicWorkspace(data as Record<string, unknown>);
}

export async function updateSlackSettings(input: {
  companyId: string;
  workspaceId: string;
  patch: {
    default_channel_id?: string | null;
    default_channel_name?: string | null;
    notify_tickets?: boolean;
    notify_alerts?: boolean;
    notify_approvals?: boolean;
    notify_chat_mentions?: boolean;
    is_enabled?: boolean;
  };
  sb?: SupabaseClient;
}): Promise<SlackWorkspace> {
  const client = adminOr(input.sb);
  const { data, error } = await client
    .from("intg_slack_workspaces")
    .update({ ...input.patch, updated_at: new Date().toISOString() })
    .eq("id", input.workspaceId)
    .eq("company_id", input.companyId)
    .is("deleted_at", null)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return publicWorkspace(data as Record<string, unknown>);
}

export async function disconnectSlack(input: {
  companyId: string;
  workspaceId: string;
  sb?: SupabaseClient;
}): Promise<void> {
  const client = adminOr(input.sb);
  const { error } = await client
    .from("intg_slack_workspaces")
    .update({
      is_enabled: false,
      deleted_at: new Date().toISOString(),
      bot_access_token: null,
      incoming_webhook_url: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.workspaceId)
    .eq("company_id", input.companyId);
  if (error) throw new Error(error.message);
}

async function logDelivery(
  client: SupabaseClient,
  input: {
    companyId: string;
    workspaceId?: string | null;
    channelId?: string | null;
    eventType?: string;
    status: string;
    responseCode?: number | null;
    errorMessage?: string | null;
    entityType?: string;
    entityId?: string | null;
    requestSummary?: string;
  }
) {
  await client.from("intg_slack_delivery_log").insert({
    company_id: input.companyId,
    workspace_id: input.workspaceId || null,
    channel_id: input.channelId || null,
    event_type: input.eventType || "message",
    status: input.status,
    response_code: input.responseCode ?? null,
    error_message: input.errorMessage || null,
    entity_type: input.entityType || null,
    entity_id: input.entityId || null,
    request_summary: input.requestSummary || null,
  });
}

/**
 * Send a company notification to Slack (webhook or chat.postMessage).
 */
export async function sendSlackMessage(
  input: SlackNotifyInput,
  sb?: SupabaseClient
): Promise<SlackNotifyResult> {
  const client = adminOr(sb);
  const { data: ws } = await client
    .from("intg_slack_workspaces")
    .select("*")
    .eq("company_id", input.companyId)
    .is("deleted_at", null)
    .eq("is_enabled", true)
    .order("installed_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!ws) {
    return { ok: false, mode: "none", error: "Slack not connected for company" };
  }

  const webhook = ws.incoming_webhook_url as string | null;
  const botToken = ws.bot_access_token as string | null;
  const channel =
    input.channel ||
    (ws.default_channel_id as string | null) ||
    (ws.incoming_webhook_channel as string | null);

  const preferWebhook = input.preferWebhook !== false && Boolean(webhook);

  try {
    if (preferWebhook && webhook) {
      const res = await fetch(webhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: input.text,
          blocks: input.blocks,
          channel: channel || undefined,
        }),
      });
      if (!res.ok) {
        const errText = await res.text();
        await logDelivery(client, {
          companyId: input.companyId,
          workspaceId: ws.id as string,
          channelId: channel,
          eventType: input.eventType,
          status: "failed",
          responseCode: res.status,
          errorMessage: errText.slice(0, 500),
          entityType: input.entityType,
          entityId: input.entityId,
          requestSummary: input.text.slice(0, 200),
        });
        await client
          .from("intg_slack_workspaces")
          .update({ last_error: errText.slice(0, 300) })
          .eq("id", ws.id);
        return { ok: false, mode: "webhook", error: errText };
      }
      await logDelivery(client, {
        companyId: input.companyId,
        workspaceId: ws.id as string,
        channelId: channel,
        eventType: input.eventType,
        status: "sent",
        responseCode: res.status,
        entityType: input.entityType,
        entityId: input.entityId,
        requestSummary: input.text.slice(0, 200),
      });
      await client
        .from("intg_slack_workspaces")
        .update({
          last_success_at: new Date().toISOString(),
          last_error: null,
        })
        .eq("id", ws.id);
      return { ok: true, mode: "webhook", channel };
    }

    if (!botToken) {
      return {
        ok: false,
        mode: "none",
        error: "No Slack bot token or webhook configured",
      };
    }
    if (!channel) {
      return {
        ok: false,
        mode: "api",
        error: "No Slack channel configured",
      };
    }

    const res = await fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        Authorization: `Bearer ${botToken}`,
      },
      body: JSON.stringify({
        channel,
        text: input.text,
        blocks: input.blocks,
      }),
    });
    const json = (await res.json()) as {
      ok?: boolean;
      error?: string;
      ts?: string;
      channel?: string;
    };
    if (!json.ok) {
      await logDelivery(client, {
        companyId: input.companyId,
        workspaceId: ws.id as string,
        channelId: channel,
        eventType: input.eventType,
        status: "failed",
        responseCode: res.status,
        errorMessage: json.error || "chat.postMessage failed",
        entityType: input.entityType,
        entityId: input.entityId,
        requestSummary: input.text.slice(0, 200),
      });
      await client
        .from("intg_slack_workspaces")
        .update({ last_error: json.error || "chat.postMessage failed" })
        .eq("id", ws.id);
      return { ok: false, mode: "api", error: json.error || "failed" };
    }
    await logDelivery(client, {
      companyId: input.companyId,
      workspaceId: ws.id as string,
      channelId: json.channel || channel,
      eventType: input.eventType,
      status: "sent",
      responseCode: 200,
      entityType: input.entityType,
      entityId: input.entityId,
      requestSummary: input.text.slice(0, 200),
    });
    await client
      .from("intg_slack_workspaces")
      .update({
        last_success_at: new Date().toISOString(),
        last_error: null,
      })
      .eq("id", ws.id);
    return {
      ok: true,
      mode: "api",
      channel: json.channel || channel,
      ts: json.ts || null,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await logDelivery(client, {
      companyId: input.companyId,
      workspaceId: ws.id as string,
      channelId: channel,
      eventType: input.eventType,
      status: "failed",
      errorMessage: msg,
      entityType: input.entityType,
      entityId: input.entityId,
    });
    return { ok: false, error: msg };
  }
}

export async function notifyCompanySlack(
  companyId: string,
  title: string,
  message?: string,
  opts?: {
    eventType?: string;
    entityType?: string;
    entityId?: string | null;
    link?: string | null;
  }
): Promise<SlackNotifyResult> {
  const { data: ws } = await createAdminClient()
    .from("intg_slack_workspaces")
    .select("notify_tickets,notify_alerts,notify_approvals,is_enabled")
    .eq("company_id", companyId)
    .is("deleted_at", null)
    .eq("is_enabled", true)
    .limit(1)
    .maybeSingle();
  if (!ws) return { ok: false, mode: "none", error: "not connected" };

  const et = opts?.eventType || "";
  if (et.includes("ticket") && ws.notify_tickets === false) {
    return { ok: false, mode: "none", error: "ticket notifications disabled" };
  }
  if (et.includes("alert") && ws.notify_alerts === false) {
    return { ok: false, mode: "none", error: "alert notifications disabled" };
  }
  if (et.includes("approval") && ws.notify_approvals === false) {
    return { ok: false, mode: "none", error: "approval notifications disabled" };
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "";
  const link = opts?.link
    ? opts.link.startsWith("http")
      ? opts.link
      : `${appUrl.replace(/\/$/, "")}${opts.link}`
    : null;
  const text = link
    ? `*${title}*\n${message || ""}\n${link}`.trim()
    : `*${title}*\n${message || ""}`.trim();

  return sendSlackMessage({
    companyId,
    text,
    eventType: opts?.eventType,
    entityType: opts?.entityType,
    entityId: opts?.entityId,
  });
}
