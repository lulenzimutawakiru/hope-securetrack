/**
 * MTN Customer KYC Verification (MADAPI Swagger v1.0.2)
 * GET  - config status + recent verifications
 * POST - proxy MADAPI by mode:
 *   get            -> GET  /customers (BVN / MSISDN identifiers)
 *   post           -> POST /customers (customer array + requestType for NIBSS)
 *   check          -> GET  /customers/{customerId} (MSISDN active + hashed)
 *   verify         -> POST /customers/{customerId} (isConsentVerified required)
 *   score          -> POST /customers/{customerId}/kycScore
 *   name_score     -> POST /customers/{customerId}/nameScore
 *   address_score  -> POST /customers/{customerId}/addressScore
 *   biometric      -> POST /customers/{customerId}/biometric/verify
 *   identity       -> POST /biometric-roc/customers/identityStatus
 */

import { z } from "zod";
import { createApiHandler } from "@/lib/api/handler";
import { apiError, apiOk } from "@/lib/api";
import { createClient } from "@/lib/supabase/server";
import {
  listKycVerifications,
  mtnKycConfig,
  runCompanyKycBiometric,
  runCompanyKycCheckMsisdn,
  runCompanyKycIdentityStatus,
  runCompanyKycScore,
  runCompanyKycSingle,
  runCompanyKycVerification,
  runCompanyKycVerificationPost,
} from "@/lib/mtn-kyc";
import type { MtnKycCallResult } from "@/lib/mtn-kyc/types";

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

const customerSchema = z
  .object({
    msisdn: z.string().max(20).optional(),
    bvn: z.string().max(40).optional(),
    firstName: z.string().max(100).optional(),
    lastName: z.string().max(100).optional(),
    middleName: z.string().max(100).optional(),
    otherNames: z.string().max(100).optional(),
    dateOfBirth: z.string().max(40).optional(),
    gender: z.string().max(20).optional(),
    faceImage: z.string().max(5_000_000).optional(),
    fingerprintImage: z.string().max(5_000_000).optional(),
  })
  .passthrough();

/** BasicKYCRequestData for single-customer verify / score payloads */
const kycBodySchema = z
  .record(z.string(), z.unknown())
  .refine((v) => Object.keys(v).length > 0, {
    message: "Provide a non-empty KYC payload",
  });

const verifySchema = z
  .object({
    mode: z
      .enum([
        "get",
        "post",
        "check",
        "verify",
        "score",
        "name_score",
        "address_score",
        "biometric",
        "identity",
      ])
      .optional()
      .default("get"),
    // get
    bvns: z.array(z.string().min(5).max(40)).max(50).optional(),
    msisdns: z.array(z.string().min(8).max(20)).max(50).optional(),
    bvn_list: z.string().max(2000).optional(),
    msisdn_list: z.string().max(2000).optional(),
    // post
    customers: z.array(customerSchema).max(50).optional(),
    request_type: z.string().max(40).optional(),
    verification_type: z.string().max(40).optional(),
    device_id: z.string().max(120).optional(),
    // check / verify / score / biometric
    customer_id: z.string().max(120).optional(),
    is_consent_verified: z.boolean().optional(),
    external_code: z.string().max(40).optional(),
    start_date: z.string().max(40).optional(),
    end_date: z.string().max(40).optional(),
    // payloads
    customer: kycBodySchema.optional(),
    score_body: kycBodySchema.optional(),
    biometric_body: z.record(z.string(), z.unknown()).optional(),
    identity_body: z
      .object({
        customer_id: z.string().max(120),
        agent_id: z.string().max(120).optional(),
        channel_id: z.string().max(120).optional(),
      })
      .optional(),
    // common
    target_system: z.string().max(80).optional(),
    transaction_id: z.string().max(120).optional(),
  })
  .superRefine((v, ctx) => {
    const require = (path: string, msg: string) => {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: msg, path: [path] });
    };
    switch (v.mode) {
      case "post":
        if (!v.customers?.length) require("customers", "POST mode requires customers[]");
        break;
      case "check":
        if (!v.customer_id) require("customer_id", "check mode requires customer_id (MSISDN)");
        break;
      case "verify":
        if (!v.customer_id) require("customer_id", "verify mode requires customer_id");
        if (v.is_consent_verified == null) {
          require("is_consent_verified", "verify mode requires is_consent_verified=true (consent)");
        }
        if (!v.customer) require("customer", "verify mode requires customer payload");
        break;
      case "score":
      case "name_score":
      case "address_score":
        if (!v.customer_id) require("customer_id", `${v.mode} mode requires customer_id`);
        if (!v.score_body) require("score_body", `${v.mode} mode requires score_body payload`);
        break;
      case "biometric":
        if (!v.customer_id) require("customer_id", "biometric mode requires customer_id");
        if (!v.biometric_body) require("biometric_body", "biometric mode requires biometric_body payload");
        break;
      case "identity":
        if (!v.identity_body) require("identity_body", "identity mode requires identity_body { customer_id }");
        break;
      default: {
        const has =
          (v.bvns && v.bvns.length > 0) ||
          (v.msisdns && v.msisdns.length > 0) ||
          Boolean(v.bvn_list?.trim()) ||
          Boolean(v.msisdn_list?.trim());
        if (!has) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Provide bvns or msisdns for get mode",
          });
        }
      }
    }
  });

function splitList(s?: string): string[] {
  if (!s?.trim()) return [];
  return s
    .split(/[,\n\s]+/)
    .map((x) => x.trim())
    .filter(Boolean);
}

function respond(out: {
  result: MtnKycCallResult;
  transactionId: string;
  auditId: string | null;
  sandbox: boolean;
  method: "GET" | "POST";
}) {
  if (!out.result.ok) {
    const http = out.result.status;
    const code =
      http === 401 || http === 403
        ? "FORBIDDEN"
        : http === 404
          ? "NOT_FOUND"
          : http === 400 || http === 405 || http === 406 || http === 415
            ? "VALIDATION"
            : "INTERNAL";
    const statusOut = http && http >= 400 && http < 600 ? http : 502;
    return apiError(code, out.result.error, statusOut, {
      transaction_id: out.transactionId,
      audit_id: out.auditId,
      madapi_code: out.result.madapiCode,
      severity: out.result.severity,
      mtn: out.result.body || null,
    });
  }
  return apiOk({
    transaction_id: out.transactionId,
    audit_id: out.auditId,
    sandbox: out.sandbox,
    method: out.method,
    http_status: out.result.status,
    madapi_code: out.result.madapiCode,
    data: out.result.body,
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
      endpoints: {
        get_customers: `${cfg.baseUrl}/customers`,
        post_customers: `${cfg.baseUrl}/customers`,
        get_customer: `${cfg.baseUrl}/customers/{customerId}`,
        post_customer: `${cfg.baseUrl}/customers/{customerId}`,
        kyc_score: `${cfg.baseUrl}/customers/{customerId}/kycScore`,
        name_score: `${cfg.baseUrl}/customers/{customerId}/nameScore`,
        address_score: `${cfg.baseUrl}/customers/{customerId}/addressScore`,
        biometric: `${cfg.baseUrl}/customers/{customerId}/biometric/verify`,
        identity_status: `${cfg.baseUrl}/biometric-roc/customers/identityStatus`,
      },
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
    const sb = await createClient();

    try {
      const common = {
        companyId: ctx.companyId,
        tenantId: ctx.tenantId,
        userId: ctx.user.id,
        transactionId: body.transaction_id,
        targetSystem: body.target_system,
        sb,
      };

      switch (body.mode) {
        case "post": {
          const out = await runCompanyKycVerificationPost({
            ...common,
            customers: body.customers || [],
            requestType: body.request_type,
            verificationType: body.verification_type,
            deviceId: body.device_id,
          });
          return respond(out);
        }
        case "check": {
          const out = await runCompanyKycCheckMsisdn({
            ...common,
            customerId: body.customer_id || "",
            verificationType: body.verification_type,
            externalCode: body.external_code,
            startDate: body.start_date,
            endDate: body.end_date,
          });
          return respond(out);
        }
        case "verify": {
          const out = await runCompanyKycSingle({
            ...common,
            customerId: body.customer_id || "",
            isConsentVerified: body.is_consent_verified === true,
            body: body.customer || {},
          });
          return respond(out);
        }
        case "score":
        case "name_score":
        case "address_score": {
          const out = await runCompanyKycScore({
            ...common,
            customerId: body.customer_id || "",
            kind: body.mode,
            body: body.score_body || {},
          });
          return respond(out);
        }
        case "biometric": {
          const out = await runCompanyKycBiometric({
            ...common,
            customerId: body.customer_id || "",
            requestType: body.request_type,
            verificationType: body.verification_type,
            body: body.biometric_body || {},
          });
          return respond(out);
        }
        case "identity": {
          const out = await runCompanyKycIdentityStatus({
            ...common,
            customerId: body.identity_body?.customer_id || "",
            agentId: body.identity_body?.agent_id,
            channelId: body.identity_body?.channel_id,
          });
          return respond(out);
        }
        default: {
          const bvns = [...(body.bvns || []), ...splitList(body.bvn_list)];
          const msisdns = [
            ...(body.msisdns || []),
            ...splitList(body.msisdn_list),
          ];
          const out = await runCompanyKycVerification({
            ...common,
            bvns,
            msisdns,
          });
          return respond(out);
        }
      }
    } catch (e) {
      return apiError(
        "INTERNAL",
        e instanceof Error ? e.message : "KYC verification failed",
        500
      );
    }
  }
);