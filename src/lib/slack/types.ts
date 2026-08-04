export type SlackWorkspace = {
  id: string;
  company_id: string;
  tenant_id?: string | null;
  team_id: string;
  team_name?: string | null;
  team_domain?: string | null;
  bot_user_id?: string | null;
  default_channel_id?: string | null;
  default_channel_name?: string | null;
  incoming_webhook_url?: string | null;
  incoming_webhook_channel?: string | null;
  scopes?: string[] | null;
  notify_tickets: boolean;
  notify_alerts: boolean;
  notify_approvals: boolean;
  notify_chat_mentions: boolean;
  is_enabled: boolean;
  last_error?: string | null;
  last_success_at?: string | null;
  installed_at?: string | null;
};

export type SlackNotifyInput = {
  companyId: string;
  text: string;
  /** Optional channel id (C…) or name (#general). Defaults to workspace default. */
  channel?: string | null;
  blocks?: unknown[];
  eventType?: string;
  entityType?: string;
  entityId?: string | null;
  /** Prefer webhook if present, else bot token chat.postMessage */
  preferWebhook?: boolean;
};

export type SlackNotifyResult = {
  ok: boolean;
  mode?: "webhook" | "api" | "none";
  error?: string;
  channel?: string | null;
  ts?: string | null;
};

export const SLACK_BOT_SCOPES = [
  "chat:write",
  "channels:read",
  "groups:read",
  "im:write",
  "commands",
  "incoming-webhook",
  "app_mentions:read",
] as const;
