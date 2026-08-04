/**
 * MTN Customer KYC Verification
 * GET  — config status + recent verifications
 * POST — verify customers by BVN / MSISDN (proxies MTN MADAPI)
 */

import { z } from "zod";
import { createApiHandler } from "@/lib/api/handler";
import { apiError, apiOk } from "@/lib/api";
import { createClient } from "@/lib/supabase/server";
import {
  listKycVerifications,
  mtnKycConfig,
  runCompanyKycVerification,
} from "@/lib/mtn-kyc";

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

const verifySchema = z
  .object({
    bvns: z.array(z.string().min(5).max(40)).max(50).optional(),
    msisdns: z.array(z.string().min(8).max(20)).max(50).optional(),
    /** Comma-separated convenience fields */
    bvn_list: z.string().max(2000).optional(),
    msisdn_list: z.string().max(2000).optional(),
    target_system: z.string().max(80).optional(),
    transaction_id: z.string().max(120).optional(),
  })
  .refine(
    (v) =>
      (v.bvns && v.bvns.length > 0) ||
      (v.msisdns && v.msisdns.length > 0) ||
      Boolean(v.bvn_list?.trim()) ||
      Boolean(v.msisdn_list?.trim()),
    { message: "Provide bvns or msisdns" }
  );

function splitList(s?: string): string[] {
  if (!s?.trim()) return [];
  return s
    .split(/[,\n\s]+/)
    .map((x) => x.trim())
    .filter(Boolean);
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
    const cfg = mtnKycConfig();
    const sb = await createClient();
    let history: unknown[] = [];
    try {
      history = await listKycVerifications(ctx.companyId, { limit: 25, sb });
    } catch {
      history = [];
    }
    return apiOk({
      configured: cfg.configured,
      sandbox: cfg.sandbox && !cfg.configured,
      base_url: cfg.baseUrl,
      default_target_system: cfg.defaultTargetSystem,
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
    bodySchema: verifySchema,
    rateLimit: { limit: 20, windowMs: 60_000 },
    idempotent: true,
  },
  async ({ ctx, body }) => {
    if (!ctx) return apiError("UNAUTHORIZED", "Sign in required", 401);

    const bvns = [
      ...(body.bvns || []),
      ...splitList(body.bvn_list),
    ];
    const msisdns = [
      ...(body.msisdns || []),
      ...splitList(body.msisdn_list),
    ];

    const sb = await createClient();
    try {
      const out = await runCompanyKycVerification({
        companyId: ctx.companyId,
        tenantId: ctx.tenantId,
        userId: ctx.user.id,
        bvns,
        msisdns,
        targetSystem: body.target_system,
        transactionId: body.transaction_id,
        sb,
      });

      if (!out.result.ok) {
        const http = out.result.status;
        const code =
          http === 401 || http === 403
            ? "FORBIDDEN"
            : http === 404
              ? "NOT_FOUND"
              : http === 400
                ? "VALIDATION"
                : "INTERNAL";
        return apiError(
          code,
          out.result.error,
          http && http >= 400 ? http : 502,
          {
            transaction_id: out.transactionId,
            audit_id: out.auditId,
            madapi_code: out.result.madapiCode,
            severity: out.result.severity,
            /** MADAPI ErrorPayload (statusCode 4000/4001/5000/…) */
            mtn: out.result.body || null,
          }
        );
      }

      return apiOk({
        transaction_id: out.transactionId,
        audit_id: out.auditId,
        sandbox: out.sandbox,
        http_status: out.result.status,
        madapi_code: out.result.madapiCode,
        data: out.result.body,
      });
    } catch (e) {
      return apiError(
        "INTERNAL",
        e instanceof Error ? e.message : "KYC verification failed",
        500
      );
    }
  }
);
