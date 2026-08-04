/**
 * Register / list device push tokens for FCM / OneSignal.
 */

import { z } from "zod";
import { createApiHandler } from "@/lib/api/handler";
import { apiError, apiOk } from "@/lib/api";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const schema = z.object({
  token: z.string().min(10).max(4000),
  platform: z.enum(["web", "ios", "android"]).default("web"),
  provider: z.enum(["fcm", "onesignal"]).default("fcm"),
});

export const GET = createApiHandler(
  {
    auth: true,
    permissions: ["dashboard.view"],
    module: "push",
    rateLimit: { limit: 60, windowMs: 60_000 },
  },
  async ({ ctx }) => {
    const sb = await createClient();
    const { data, error } = await sb
      .from("user_push_tokens")
      .select("id, platform, provider, is_active, last_seen_at, created_at")
      .eq("user_id", ctx!.profile.id)
      .eq("company_id", ctx!.companyId)
      .eq("is_active", true);
    if (error) return apiError("INTERNAL", error.message, 500);
    return apiOk({ tokens: data || [] });
  }
);

export const POST = createApiHandler(
  {
    auth: true,
    permissions: ["dashboard.view"],
    module: "push",
    bodySchema: schema,
    rateLimit: { limit: 30, windowMs: 60_000 },
    requireBaselinePermission: false,
  },
  async ({ ctx, body }) => {
    const input = body as z.infer<typeof schema>;
    const sb = await createClient();
    const { data, error } = await sb
      .from("user_push_tokens")
      .upsert(
        {
          company_id: ctx!.companyId,
          user_id: ctx!.profile.id,
          token: input.token,
          platform: input.platform,
          provider: input.provider,
          is_active: true,
          last_seen_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,token" }
      )
      .select("id, platform, provider, is_active")
      .maybeSingle();

    if (error) {
      // Table may not exist yet
      return apiError(
        "CONFIG",
        error.message.includes("user_push_tokens")
          ? "Apply migration 20260814000001_external_providers_hub"
          : error.message,
        503
      );
    }
    return apiOk({ token: data });
  }
);

export const DELETE = createApiHandler(
  {
    auth: true,
    permissions: ["dashboard.view"],
    module: "push",
    rateLimit: { limit: 30, windowMs: 60_000 },
  },
  async ({ ctx, req }) => {
    const token = req.nextUrl.searchParams.get("token");
    if (!token) return apiError("VALIDATION", "token query required", 400);
    const sb = await createClient();
    await sb
      .from("user_push_tokens")
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq("user_id", ctx!.profile.id)
      .eq("company_id", ctx!.companyId)
      .eq("token", token);
    return apiOk({ deactivated: true });
  }
);
