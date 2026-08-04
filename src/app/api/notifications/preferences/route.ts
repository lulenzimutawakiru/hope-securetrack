import { z } from "zod";
import { apiError, apiOk, createApiHandler } from "@/lib/api/handler";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const schema = z.object({
  email_enabled: z.boolean().optional(),
  in_app_enabled: z.boolean().optional(),
  sms_enabled: z.boolean().optional(),
  push_enabled: z.boolean().optional(),
  whatsapp_enabled: z.boolean().optional(),
  quiet_hours_start: z.string().nullable().optional(),
  quiet_hours_end: z.string().nullable().optional(),
  digest_mode: z.enum(["instant", "hourly", "daily", "weekly"]).optional(),
  digest_hour: z.number().int().min(0).max(23).optional(),
  category_settings: z.record(z.record(z.boolean())).optional(),
  muted_events: z.array(z.string()).optional(),
});

export const GET = createApiHandler(
  {
    auth: true,
    permissions: [
      "notifications.view",
      "notifications.manage",
      "dashboard.view",
      "hc.view",
    ],
    module: "notifications",
  },
  async ({ ctx }) => {
    if (!ctx) return apiError("UNAUTHORIZED", "Sign in required", 401);
    const supabase = await createClient();

    const { data } = await supabase
      .from("notification_preferences")
      .select("*")
      .eq("user_id", ctx.user.id)
      .maybeSingle();

    return apiOk({
      preferences: data || {
        email_enabled: true,
        in_app_enabled: true,
        sms_enabled: false,
        push_enabled: false,
        whatsapp_enabled: false,
        digest_mode: "instant",
        digest_hour: 8,
        category_settings: {},
        muted_events: [],
        company_id: ctx.companyId,
        user_id: ctx.user.id,
      },
    });
  }
);

export const PUT = createApiHandler(
  {
    auth: true,
    permissions: [
      "notifications.view",
      "notifications.manage",
      "dashboard.view",
      "hc.view",
    ],
    bodySchema: schema,
    rateLimit: { limit: 30, windowMs: 60_000 },
    module: "notifications",
  },
  async ({ ctx, body }) => {
    if (!ctx) return apiError("UNAUTHORIZED", "Sign in required", 401);
    if (!ctx.companyId) {
      return apiError("VALIDATION", "No company");
    }
    const data = body as z.infer<typeof schema>;
    const supabase = await createClient();

    const payload = {
      company_id: ctx.companyId,
      user_id: ctx.user.id,
      ...data,
      updated_at: new Date().toISOString(),
    };

    const { data: existing } = await supabase
      .from("notification_preferences")
      .select("id")
      .eq("user_id", ctx.user.id)
      .maybeSingle();

    let row;
    if (existing?.id) {
      const { data: updated, error } = await supabase
        .from("notification_preferences")
        .update(payload)
        .eq("id", existing.id)
        .select("*")
        .single();
      if (error) return apiError("INTERNAL", error.message, 500);
      row = updated;
    } else {
      const { data: created, error } = await supabase
        .from("notification_preferences")
        .insert(payload)
        .select("*")
        .single();
      if (error) return apiError("INTERNAL", error.message, 500);
      row = created;
    }

    return apiOk({ preferences: row });
  }
);
