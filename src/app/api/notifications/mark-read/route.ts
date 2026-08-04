import { z } from "zod";
import { apiError, apiOk, createApiHandler } from "@/lib/api/handler";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const schema = z.object({
  ids: z.array(z.string().uuid()).optional(),
  all: z.boolean().optional(),
});

export const POST = createApiHandler(
  {
    auth: true,
    permissions: [
      "notifications.view",
      "notifications.manage",
      "dashboard.view",
      "hc.view",
    ],
    bodySchema: schema,
    rateLimit: { limit: 60, windowMs: 60_000 },
    module: "notifications",
  },
  async ({ ctx, body }) => {
    if (!ctx) return apiError("UNAUTHORIZED", "Sign in required", 401);
    const data = body as z.infer<typeof schema>;
    const supabase = await createClient();
    const now = new Date().toISOString();

    if (data.all) {
      const { error } = await supabase
        .from("notifications")
        .update({ is_read: true, read_at: now })
        .eq("user_id", ctx.user.id)
        .eq("is_read", false);
      if (error) return apiError("INTERNAL", error.message, 500);
      return apiOk({ all: true });
    }

    const ids = data.ids ?? [];
    if (!ids.length) {
      return apiError("VALIDATION", "ids or all required");
    }

    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true, read_at: now })
      .eq("user_id", ctx.user.id)
      .in("id", ids);

    if (error) return apiError("INTERNAL", error.message, 500);
    return apiOk({ count: ids.length });
  }
);
