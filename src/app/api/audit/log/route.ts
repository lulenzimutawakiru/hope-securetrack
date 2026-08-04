/**
 * Audit ingestion endpoint: POST /api/audit/log
 *
 * Accepts best-effort client audit events and writes them to the immutable
 * `audit_logs` table. The actor, company and timestamp are ALWAYS derived from
 * the authenticated session - client-supplied userId / companyId /
 * clientTimestamp are ignored (defense against audit spoofing).
 */

import { z } from "zod";
import { apiOk, apiError, createApiHandler } from "@/lib/api/handler";
import { clientIp } from "@/lib/api";
import type { AuthedContext } from "@/lib/security/api-auth";
import { createClient } from "@/lib/supabase/server";

const AUDIT_SCHEMA = z
  .object({
    event: z.string().min(1).max(200),
    details: z.record(z.unknown()).optional(),
    module: z.string().min(1).max(50).optional(),
    entity_type: z.string().min(1).max(50).optional(),
    entity_id: z.string().max(255).optional(),
  })
  .passthrough();

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const POST = createApiHandler(
  {
    auth: true,
    // Any authenticated session may emit audit events for actions they performed;
    // actor/company are always taken from the session (never the body).
    permissions: ["dashboard.view", "audit.view", "eal.view"],
    rateLimit: { limit: 120, windowMs: 60_000 },
    module: "audit",
    bodySchema: AUDIT_SCHEMA,
  },
  async ({ req, ctx, body }) => {
    if (!ctx) return apiError("UNAUTHORIZED", "Sign in required", 401);
    const authed = ctx as AuthedContext;
    const sb = await createClient();

    const entityId = body.entity_id ?? undefined;
    const isUuid = typeof entityId === "string" && UUID_RE.test(entityId);
    const userAgent = req.headers.get("user-agent") ?? undefined;

    const { error } = await sb.from("audit_logs").insert({
      company_id: authed.companyId,
      user_id: authed.user.id,
      user_email: authed.profile.email ?? null,
      user_role: authed.roleSlug,
      action: body.event.slice(0, 100),
      module: (body.module ?? "api").slice(0, 50),
      entity_type: body.entity_type ?? null,
      entity_id: isUuid ? entityId : null,
      entity_reference: !isUuid && entityId ? entityId : null,
      metadata: body.details ?? {},
      ip_address: clientIp(req),
      user_agent: userAgent,
    });

    if (error) {
      return apiError("INTERNAL", "Failed to record event", 500);
    }
    return apiOk({ status: "ok" });
  }
);
