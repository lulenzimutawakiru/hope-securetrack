/**
 * POST — send a test message to the company's Slack.
 */

import { z } from "zod";
import { createApiHandler } from "@/lib/api/handler";
import { apiError, apiOk } from "@/lib/api";
import { createClient } from "@/lib/supabase/server";
import { sendSlackMessage } from "@/lib/slack";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const schema = z.object({
  text: z.string().min(1).max(2000).optional(),
  channel: z.string().max(80).optional().nullable(),
});

export const POST = createApiHandler(
  {
    auth: true,
    permissions: ["intg.manage", "settings.integrations", "settings.manage"],
    allowPlatformAdmin: true,
    module: "integrations",
    bodySchema: schema,
    rateLimit: { limit: 10, windowMs: 60_000 },
  },
  async ({ ctx, body }) => {
    if (!ctx) return apiError("UNAUTHORIZED", "Sign in required", 401);
    const sb = await createClient();
    const result = await sendSlackMessage(
      {
        companyId: ctx.companyId,
        text:
          body.text ||
          `SecureTrack ERP test message from ${ctx.user.email || "admin"}`,
        channel: body.channel,
        eventType: "slack.test",
      },
      sb
    );
    if (!result.ok) {
      return apiError("VALIDATION", result.error || "Send failed", 400);
    }
    return apiOk(result);
  }
);
