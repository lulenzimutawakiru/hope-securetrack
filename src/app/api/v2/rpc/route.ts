/**
 * Server-side RPC gateway for browser crud-compat shims.
 *
 *   POST /api/v2/rpc   body: { fn, args }
 *
 * Only whitelisted, session-scoped RPC names are forwarded to the database.
 * Tenant/company/user identity is always derived from the authenticated
 * session server-side - client-supplied identity fields are never trusted.
 */

import { z } from "zod";
import { createApiHandler } from "@/lib/api/handler";
import { apiError, apiOk } from "@/lib/api";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ALLOWED_RPCS = new Set([
  "next_comm_message_number",
  "next_comm_job_number",
  "next_di_job_number",
  "next_support_ticket_number",
  "next_upid",
  "switch_active_company",
  "user_tenant_id",
]);

const SCHEMA = z.object({
  fn: z.string().min(1).max(120),
  args: z.record(z.unknown()).optional().default({}),
});

export const POST = createApiHandler(
  {
    auth: true,
    permissions: ["dashboard.view"],
    allowPlatformAdmin: true,
    rateLimit: { limit: 120, windowMs: 60_000 },
    module: "v2.rpc",
    bodySchema: SCHEMA,
  },
  async ({ ctx, body }) => {
    if (!ctx) return apiError("UNAUTHORIZED", "Sign in required", 401);
    const { fn, args } = body;
    if (!ALLOWED_RPCS.has(fn)) {
      return apiError("FORBIDDEN", `RPC "${fn}" is not permitted`, 403);
    }

    // Never forward identity from the client for session-scoped RPCs.
    const { tenant_id: _t, company_id: _c, user_id: _u, ...safeArgs } = args;

    const supabase = await createClient();
    const { data, error } = await supabase.rpc(fn, safeArgs);
    if (error) {
      return apiError("INTERNAL", `RPC failed: ${error.message}`, 500);
    }
    return apiOk({ data: data ?? null });
  }
);