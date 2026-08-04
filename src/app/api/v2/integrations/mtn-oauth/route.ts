/**
 * MTN MADAPI OAuth2 (Swagger v1.1)
 * GET  - config status + recent token-request audits (never token material)
 * POST - mode "token": request / refresh an access token
 *
 * Security: raw access tokens are never returned by this API. Only
 * metadata (token_type, expires_in, issued_at) and the audit history.
 */

import { z } from "zod";
import { createApiHandler } from "@/lib/api/handler";
import { apiError, apiOk } from "@/lib/api";
import { createClient } from "@/lib/supabase/server";
import {
  listOauthAudits,
  mtnOauthConfig,
  runCompanyOauthCall,
} from "@/lib/mtn-oauth";
import type { MtnOauthTokenResult } from "@/lib/mtn-oauth/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const VIEW = [
  "intg.view",
  "intg.manage",
  "crm.view",
  "crm.manage",
  "iam.view",
  "settings.integrations",
];
const MANAGE = [
  "intg.manage",
  "crm.manage",
  "iam.manage",
  "settings.integrations",
  "settings.manage",
];

const oauthSchema = z.object({
  mode: z.enum(["token"]).optional().default("token"),
  transaction_id: z.string().max(120).optional(),
});

function respond(out: {
  result: MtnOauthTokenResult;
  transactionId: string;
  auditId: string | null;
  sandbox: boolean;
}) {
  if (!out.result.ok) {
    const http = out.result.status;
    const code =
      http === 401 || http === 403
        ? "FORBIDDEN"
        : http === 400
          ? "VALIDATION"
          : http === 503
            ? "CONFIG"
            : "INTERNAL";
    const statusOut = http && http >= 400 && http < 600 ? http : 502;
    return apiError(code, out.result.error, statusOut, {
      transaction_id: out.transactionId,
      audit_id: out.auditId,
      severity: out.result.severity,
      oauth: out.result.body || null,
    });
  }
  return apiOk({
    transaction_id: out.transactionId,
    audit_id: out.auditId,
    sandbox: out.sandbox,
    token_type: out.result.tokenType,
    expires_in: out.result.expiresInSeconds,
    issued_at: out.result.issuedAt,
    token_available: out.result.tokenAvailable,
  });
}

export const GET = createApiHandler(
  {
    auth: true,
    permissions: VIEW,
    allowPlatformAdmin: true,
    module: "integrations",
    rateLimit: { limit: 60, windowMs: 60_000 },
  },
  async ({ ctx }) => {
    if (!ctx) return apiError("UNAUTHORIZED", "Sign in required", 401);
    const cfg = mtnOauthConfig();
    const sb = await createClient();
    let history: unknown[] = [];
    try {
      history = await listOauthAudits(ctx.companyId, { limit: 25, sb });
    } catch {
      history = [];
    }
    return apiOk({
      configured: cfg.configured,
      sandbox: cfg.sandbox && !cfg.configured,
      base_url: cfg.baseUrl,
      grant_type: cfg.grantType,
      token_endpoint: `${cfg.baseUrl}/access_token`,
      history,
    });
  }
);

export const POST = createApiHandler(
  {
    auth: true,
    permissions: MANAGE,
    allowPlatformAdmin: true,
    module: "integrations",
    bodySchema: oauthSchema,
    rateLimit: { limit: 20, windowMs: 60_000 },
    idempotent: true,
  },
  async ({ ctx, body }) => {
    if (!ctx) return apiError("UNAUTHORIZED", "Sign in required", 401);
    const sb = await createClient();
    try {
      const out = await runCompanyOauthCall({
        companyId: ctx.companyId,
        tenantId: ctx.tenantId,
        userId: ctx.user.id,
        transactionId: body.transaction_id,
        sb,
      });
      return respond(out);
    } catch (e) {
      return apiError(
        "INTERNAL",
        e instanceof Error ? e.message : "Access token request failed",
        500
      );
    }
  }
);