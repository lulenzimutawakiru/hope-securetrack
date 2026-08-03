import { z } from "zod";
import { apiError, apiOk, createApiHandler } from "@/lib/api/handler";
import { createClient } from "@/lib/supabase/server";
import { flushSiemOutbox } from "@/lib/audit/siem";

const postSchema = z.object({
  action: z.literal("flush"),
});

/** List SIEM connectors / outbox pending count */
export const GET = createApiHandler(
  {
    auth: true,
    permissions: ["eal.view", "audit.view", "eal.security", "eal.export"],
    allowPlatformAdmin: true,
    module: "audit",
  },
  async ({ ctx }) => {
    if (!ctx) return apiError("UNAUTHORIZED", "Sign in required", 401);
    const supabase = await createClient();
    const { data: connectors } = await supabase
      .from("eal_siem_connectors")
      .select(
        "id, connector_code, name, provider, enabled, min_severity, last_push_at, last_status"
      )
      .eq("company_id", ctx.companyId)
      .order("name");

    const { count: pending } = await supabase
      .from("eal_siem_outbox")
      .select("*", { count: "exact", head: true })
      .eq("company_id", ctx.companyId)
      .eq("status", "pending");

    return apiOk({
      connectors: connectors || [],
      pending_outbox: pending ?? 0,
      providers: ["splunk", "sentinel", "qradar", "elastic", "webhook"],
    });
  }
);

/** Flush SIEM outbox for session company */
export const POST = createApiHandler(
  {
    auth: true,
    permissions: ["eal.export", "eal.manage", "audit.manage", "eal.security"],
    allowPlatformAdmin: true,
    requireMfa: "privileged",
    bodySchema: postSchema,
    rateLimit: { limit: 10, windowMs: 60_000 },
    module: "audit",
  },
  async ({ ctx }) => {
    if (!ctx) return apiError("UNAUTHORIZED", "Sign in required", 401);
    const result = await flushSiemOutbox(ctx.companyId);
    return apiOk({ ...result });
  }
);
