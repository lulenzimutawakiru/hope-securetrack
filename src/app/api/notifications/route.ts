import { apiError, apiOk, createApiHandler } from "@/lib/api/handler";
import { createClient } from "@/lib/supabase/server";
import { sanitizePostgrestFilter } from "@/lib/security/shared";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** GET inbox for current user */
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
  async ({ req, ctx }) => {
    if (!ctx) return apiError("UNAUTHORIZED", "Sign in required", 401);
    const supabase = await createClient();
    const unreadOnly = req.nextUrl.searchParams.get("unread") === "1";
    const limit = Math.min(
      Number(req.nextUrl.searchParams.get("limit") || 30),
      100
    );
    const categoryRaw = req.nextUrl.searchParams.get("category");
    const category = categoryRaw
      ? sanitizePostgrestFilter(categoryRaw, 60)
      : null;

    let q = supabase
      .from("notifications")
      .select("*")
      .eq("user_id", ctx.user.id)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (unreadOnly) q = q.eq("is_read", false);
    if (category) q = q.eq("category", category);
    q = q.or("is_archived.is.null,is_archived.eq.false");

    const { data, error } = await q;
    if (error) return apiError("INTERNAL", error.message, 500);

    const { count } = await supabase
      .from("notifications")
      .select("*", { count: "exact", head: true })
      .eq("user_id", ctx.user.id)
      .eq("is_read", false);

    return apiOk({
      items: data ?? [],
      unreadCount: count ?? 0,
    });
  }
);
