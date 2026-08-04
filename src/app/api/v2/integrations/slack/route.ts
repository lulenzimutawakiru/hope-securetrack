/**
 * Slack workspace status + settings for current company.
 * GET  — list installs (no secrets)
 * PATCH — update notify flags / default channel
 * DELETE — disconnect workspace
 */

import { z } from "zod";
import { createApiHandler } from "@/lib/api/handler";
import { apiError, apiOk } from "@/lib/api";
import { createClient } from "@/lib/supabase/server";
import {
  disconnectSlack,
  listSlackWorkspaces,
  slackPlatformConfig,
  updateSlackSettings,
} from "@/lib/slack";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const INTG_PERMS = [
  "intg.view",
  "intg.manage",
  "settings.integrations",
  "settings.manage",
];

const patchSchema = z.object({
  workspace_id: z.string().uuid(),
  default_channel_id: z.string().max(40).nullable().optional(),
  default_channel_name: z.string().max(120).nullable().optional(),
  notify_tickets: z.boolean().optional(),
  notify_alerts: z.boolean().optional(),
  notify_approvals: z.boolean().optional(),
  notify_chat_mentions: z.boolean().optional(),
  is_enabled: z.boolean().optional(),
});

export const GET = createApiHandler(
  {
    auth: true,
    permissions: INTG_PERMS,
    allowPlatformAdmin: true,
    module: "integrations",
    rateLimit: { limit: 60, windowMs: 60_000 },
  },
  async ({ ctx }) => {
    if (!ctx) return apiError("UNAUTHORIZED", "Sign in required", 401);
    const sb = await createClient();
    try {
      const workspaces = await listSlackWorkspaces(ctx.companyId, sb);
      const platform = slackPlatformConfig();
      return apiOk({
        platform_configured: platform.configured,
        app_id: platform.appId || null,
        workspaces,
      });
    } catch (e) {
      return apiError(
        "INTERNAL",
        e instanceof Error ? e.message : "Failed to load Slack status",
        500
      );
    }
  }
);

export const PATCH = createApiHandler(
  {
    auth: true,
    permissions: ["intg.manage", "settings.integrations", "settings.manage"],
    allowPlatformAdmin: true,
    module: "integrations",
    bodySchema: patchSchema,
    rateLimit: { limit: 30, windowMs: 60_000 },
  },
  async ({ ctx, body }) => {
    if (!ctx) return apiError("UNAUTHORIZED", "Sign in required", 401);
    const sb = await createClient();
    try {
      const workspace = await updateSlackSettings({
        companyId: ctx.companyId,
        workspaceId: body.workspace_id,
        patch: {
          default_channel_id: body.default_channel_id,
          default_channel_name: body.default_channel_name,
          notify_tickets: body.notify_tickets,
          notify_alerts: body.notify_alerts,
          notify_approvals: body.notify_approvals,
          notify_chat_mentions: body.notify_chat_mentions,
          is_enabled: body.is_enabled,
        },
        sb,
      });
      return apiOk({ workspace });
    } catch (e) {
      return apiError(
        "INTERNAL",
        e instanceof Error ? e.message : "Update failed",
        500
      );
    }
  }
);

const deleteSchema = z.object({
  workspace_id: z.string().uuid(),
});

export const DELETE = createApiHandler(
  {
    auth: true,
    permissions: ["intg.manage", "settings.integrations", "settings.manage"],
    allowPlatformAdmin: true,
    module: "integrations",
    bodySchema: deleteSchema,
    rateLimit: { limit: 20, windowMs: 60_000 },
  },
  async ({ ctx, body }) => {
    if (!ctx) return apiError("UNAUTHORIZED", "Sign in required", 401);
    const sb = await createClient();
    try {
      await disconnectSlack({
        companyId: ctx.companyId,
        workspaceId: body.workspace_id,
        sb,
      });
      return apiOk({ disconnected: true });
    } catch (e) {
      return apiError(
        "INTERNAL",
        e instanceof Error ? e.message : "Disconnect failed",
        500
      );
    }
  }
);
