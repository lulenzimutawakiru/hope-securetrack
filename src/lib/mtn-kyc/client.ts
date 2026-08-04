/**
 * HTTP client for MTN Customer KYC Verification API (Swagger v1.0.2).
 *
 * Endpoints:
 *   GET  /customers                                   - bvns / msisdns identifiers
 *   POST /customers                                   - array of customer data (+ requestType for NIBSS)
 *   POST /customers/{customerId}                      - verify single customer (isConsentVerified)
 *   GET  /customers/{customerId}                      - MSISDN active check + hashed MSISDN
 *   POST /customers/{customerId}/kycScore             - percentage match score
 *   POST /customers/{customerId}/nameScore            - name-only percentage score
 *   POST /customers/{customerId}/addressScore         - address-only percentage score
 *   POST /customers/{customerId}/biometric/verify     - face / fingerprint match
 *   POST /biometric-roc/customers/identityStatus      - ROC enroll identity status
 *
 * Headers: transactionId, targetSystem (auth: X-API-Key + HTTP Basic)
 *
 * Error responses (swagger ErrorPayload statusCode examples):
 *   400 -> 5000  Bad Request
 *   401 -> 4000  Unauthorized
 *   403 -> 4001  Forbidden
 *   404 -> 1000  Not Found
 *   405/406/415/500 -> 3000  (method/media/server family per examples)
 */

import { mtnKycBasicAuthHeader, mtnKycConfig } from "./config";
import { getMtnBearerToken } from "@/lib/mtn-oauth/client";
import {
  describeMadapiError,
  isMadapiSuccessCode,
  resolveMadapiCode,
} from "./madapi-codes";
import type {
  MtnKycBiometricInput,
  MtnKycCallResult,
  MtnKycCheckMsisdnInput,
  MtnKycCustomerInput,
  MtnKycIdentityStatusInput,
  MtnKycMultiResponse,
  MtnKycScoreInput,
  MtnKycVerifyBodyInput,
  MtnKycVerifyInput,
  MtnKycVerifySingleInput,
} from "./types";

function normalizeIds(ids: string[] | undefined): string[] {
  if (!ids?.length) return [];
  return [
    ...new Set(
      ids
        .flatMap((x) => String(x).split(/[,\s]+/))
        .map((s) => s.trim())
        .filter(Boolean)
    ),
  ].slice(0, 50);
}

function authHeaders(
  cfg: ReturnType<typeof mtnKycConfig>,
  transactionId: string,
  targetSystem: string
): Record<string, string> {
  return {
    Accept: "application/json",
    "Content-Type": "application/json",
    "X-API-Key": cfg.apiKey,
    Authorization: mtnKycBasicAuthHeader(cfg.basicUser, cfg.basicPass),
    transactionId: transactionId.trim(),
    targetSystem,
  };
}

async function parseMtnResponse(res: Response): Promise<MtnKycCallResult> {
  const text = await res.text();
  let raw: unknown = null;
  try {
    raw = text ? JSON.parse(text) : null;
  } catch {
    raw = { raw: text.slice(0, 2000) };
  }

  const body = (raw || {}) as Record<string, unknown>;
  const madapiCode = resolveMadapiCode(res.status, body);

  if (!res.ok) {
    const described = describeMadapiError(res.status, body);
    return {
      ok: false,
      status: res.status,
      madapiCode: described.code,
      severity: described.severity,
      error: described.message,
      body: body as { statusCode?: string; statusMessage?: string },
      raw,
    };
  }

  if (body.statusCode != null && !isMadapiSuccessCode(body.statusCode)) {
    const described = describeMadapiError(res.status, body);
    return {
      ok: false,
      status: res.status,
      madapiCode: described.code,
      severity: described.severity,
      error: described.message,
      body: body as { statusCode?: string; statusMessage?: string },
      raw,
    };
  }

  return {
    ok: true,
    status: res.status,
    madapiCode,
    body: body as MtnKycMultiResponse,
    raw,
  };
}

function notConfigured(): MtnKycCallResult {
  return {
    ok: false,
    status: 503,
    madapiCode: "3000",
    severity: "server",
    error:
      "MTN KYC not configured. Set MTN_KYC_API_KEY, MTN_KYC_BASIC_USER, MTN_KYC_BASIC_PASSWORD",
  };
}

function networkError(e: unknown): MtnKycCallResult {
  return {
    ok: false,
    status: 0,
    madapiCode: "3000",
    severity: "server",
    error: e instanceof Error ? e.message : "Network error calling MTN KYC",
  };
}

function sandboxOk(
  transactionId: string,
  method: string,
  data: Record<string, unknown>
): MtnKycCallResult {
  return {
    ok: true,
    status: 200,
    madapiCode: "0000",
    body: {
      statusCode: "0000",
      statusMessage: "Success (sandbox)",
      transactionId,
      data,
    },
    raw: { sandbox: true, method, data },
  };
}

/**
 * Low-level request to MADAPI. Assumes config is configured (sandbox handled
 * by the exported helpers above this one).
 */
async function callMtnApi(input: {
  method: "GET" | "POST";
  /** URL path below basePath, e.g. /customers or /customers/{id}/kycScore */
  path: string;
  transactionId: string;
  targetSystem?: string;
  query?: Record<string, string | undefined>;
  body?: unknown;
  extraHeaders?: Record<string, string>;
}): Promise<MtnKycCallResult> {
  const cfg = mtnKycConfig();
  if (!cfg.configured) return notConfigured();

  const url = new URL(`${cfg.baseUrl}${input.path}`);
  if (input.query) {
    for (const [k, v] of Object.entries(input.query)) {
      if (v != null && v !== "") url.searchParams.set(k, v);
    }
  }

  const headers = authHeaders(
    cfg,
    input.transactionId,
    input.targetSystem || cfg.defaultTargetSystem
  );
  if (input.extraHeaders) {
    for (const [k, v] of Object.entries(input.extraHeaders)) {
      if (v != null && v !== "") headers[k] = v;
    }
  }

  // MADAPI OAuth2: when MTN_OAUTH_CLIENT_ID / MTN_OAUTH_CLIENT_SECRET are
  // configured, prefer the live bearer token over HTTP Basic (X-API-Key kept).
  const bearer = await getMtnBearerToken();
  if (bearer) headers.Authorization = `Bearer ${bearer}`;

  try {
    const res = await fetch(url.toString(), {
      method: input.method,
      headers,
      body: input.body != null ? JSON.stringify(input.body) : undefined,
      cache: "no-store",
    });
    return parseMtnResponse(res);
  } catch (e) {
    return networkError(e);
  }
}

/**
 * GET /customers - verify by BVN and/or MSISDN identifiers.
 */
export async function verifyCustomersKyc(
  input: MtnKycVerifyInput
): Promise<MtnKycCallResult> {
  const cfg = mtnKycConfig();
  const bvns = normalizeIds(input.bvns);
  const msisdns = normalizeIds(input.msisdns);

  if (!bvns.length && !msisdns.length) {
    return {
      ok: false,
      status: 400,
      madapiCode: "5000",
      severity: "client",
      error: "Provide at least one BVN or MSISDN (MADAPI 5000 Bad Request)",
    };
  }
  if (!input.transactionId?.trim()) {
    return {
      ok: false,
      status: 400,
      madapiCode: "5000",
      severity: "client",
      error: "transactionId is required (MADAPI 5000 Bad Request)",
    };
  }

  if (cfg.sandbox && !cfg.configured) {
    const customers = [
      ...bvns.map((bvn, i) => ({
        bvn,
        firstName: "Sandbox",
        lastName: `Customer${i + 1}`,
        fullName: `Sandbox Customer${i + 1}`,
        kycStatus: "VERIFIED",
        matchStatus: "MATCH",
        idType: "BVN",
        idNumber: bvn,
      })),
      ...msisdns.map((msisdn, i) => ({
        msisdn,
        firstName: "Sandbox",
        lastName: `Msisdn${i + 1}`,
        fullName: `Sandbox Msisdn${i + 1}`,
        kycStatus: "VERIFIED",
        matchStatus: "MATCH",
      })),
    ];
    return {
      ok: true,
      status: 200,
      madapiCode: "0000",
      body: {
        statusCode: "0000",
        statusMessage: "Success (sandbox GET)",
        transactionId: input.transactionId,
        customers,
      },
      raw: { sandbox: true, method: "GET", customers },
    };
  }

  const query: Record<string, string> = {};
  if (bvns.length) query.bvns = bvns.join(",");
  if (msisdns.length) query.msisdns = msisdns.join(",");

  const extraHeaders: Record<string, string> = {};
  if (bvns.length) {
    extraHeaders.bvns = JSON.stringify(bvns);
    extraHeaders["X-BVNs"] = bvns.join(",");
  }
  if (msisdns.length) {
    extraHeaders.msisdns = JSON.stringify(msisdns);
    extraHeaders["X-MSISDNs"] = msisdns.join(",");
  }

  return callMtnApi({
    method: "GET",
    path: "/customers",
    transactionId: input.transactionId,
    targetSystem: input.targetSystem,
    query,
    extraHeaders,
  });
}

/** Map camelCase UI fields onto Swagger BasicKYCRequestData field names. */
function normalizeCustomerForPost(
  c: MtnKycCustomerInput
): Record<string, unknown> {
  const { middleName, faceImage, fingerprintImage, ...rest } = c;
  const out: Record<string, unknown> = { ...rest };
  if (middleName) out.otherNames = middleName;
  void faceImage;
  void fingerprintImage;
  return out;
}

/**
 * POST /customers - verify multiple customers by submitting customer data array.
 * Swagger body: CustomerKYCVerificationMultipleRequest { bvns[], binaryAttachment?, deviceId? }
 * Query (NIBSS): requestType (FACE_MATCH | FINGERPRINT), verificationType (FINGERPRINT | FINGERPRINT_DOB)
 */
export async function verifyCustomersKycPost(
  input: MtnKycVerifyBodyInput
): Promise<MtnKycCallResult> {
  const cfg = mtnKycConfig();
  const customers = (input.customers || []).filter(
    (c) => c && (c.bvn || c.msisdn || c.faceImage || c.fingerprintImage)
  );

  if (!customers.length) {
    return {
      ok: false,
      status: 400,
      madapiCode: "5000",
      severity: "client",
      error:
        "Provide a non-empty customers array (MADAPI 5000 Bad Request)",
    };
  }
  if (!input.transactionId?.trim()) {
    return {
      ok: false,
      status: 400,
      madapiCode: "5000",
      severity: "client",
      error: "transactionId is required (MADAPI 5000 Bad Request)",
    };
  }

  if (cfg.sandbox && !cfg.configured) {
    const out = customers.map((c, i) => ({
      ...c,
      firstName: c.firstName || "Sandbox",
      lastName: c.lastName || `Post${i + 1}`,
      fullName:
        c.firstName || c.lastName
          ? [c.firstName, c.lastName].filter(Boolean).join(" ")
          : `Sandbox Post${i + 1}`,
      kycStatus: "VERIFIED",
      matchStatus:
        input.requestType === "FACE_MATCH" ||
        input.requestType === "FINGERPRINT"
          ? "BIOMETRIC_MATCH"
          : "MATCH",
      requestType: input.requestType || null,
    }));
    return {
      ok: true,
      status: 200,
      madapiCode: "0000",
      body: {
        statusCode: "0000",
        statusMessage: "Success (sandbox POST)",
        transactionId: input.transactionId,
        customers: out,
      },
      raw: {
        sandbox: true,
        method: "POST",
        requestType: input.requestType,
        customers: out,
      },
    };
  }

  // Collect biometric payloads into top-level binaryAttachment per Swagger.
  const binary: Record<string, unknown>[] = [];
  for (const c of customers) {
    if (c.faceImage) {
      binary.push({
        id: "nist_impression_type_10",
        attachmentType: "picture",
        content: c.faceImage,
        mimeType: "image/jpeg",
        name: "face_image",
      });
    }
    if (c.fingerprintImage) {
      binary.push({
        id: "nist_impression_type_2",
        attachmentType: "picture",
        content: c.fingerprintImage,
        mimeType: "image/jpeg",
        name: "fingerprint_image",
      });
    }
  }

  const payload: Record<string, unknown> = {
    bvns: customers.map(normalizeCustomerForPost),
  };
  if (binary.length) payload.binaryAttachment = binary;
  if (input.deviceId) payload.deviceId = input.deviceId;

  return callMtnApi({
    method: "POST",
    path: "/customers",
    transactionId: input.transactionId,
    targetSystem: input.targetSystem,
    query: {
      requestType: input.requestType,
      verificationType: input.verificationType,
    },
    body: payload,
  });
}

/**
 * POST /customers/{customerId} - verify single customer KYC attributes.
 * Requires isConsentVerified=true query (partner has acquired consent).
 */
export async function verifyCustomerSingle(
  input: MtnKycVerifySingleInput
): Promise<MtnKycCallResult> {
  const cfg = mtnKycConfig();
  if (!input.customerId?.trim()) {
    return {
      ok: false,
      status: 400,
      madapiCode: "5000",
      severity: "client",
      error: "customerId is required (MADAPI 5000 Bad Request)",
    };
  }
  if (cfg.sandbox && !cfg.configured) {
    return sandboxOk(input.transactionId, "POST /customers/{id}", {
      customerId: input.customerId,
      verificationStatus: "Verified",
      matches: {
        firstName: true,
        lastName: true,
        otherNames: true,
        dateOfBirth: true,
        gender: true,
        phoneNumber: input.customerId,
      },
    });
  }
  return callMtnApi({
    method: "POST",
    path: `/customers/${encodeURIComponent(input.customerId)}`,
    transactionId: input.transactionId,
    targetSystem: input.targetSystem,
    query: { isConsentVerified: String(input.isConsentVerified) },
    body: input.body,
  });
}

/**
 * GET /customers/{customerId} - confirm MSISDN is active on bank/MTN and get
 * the hashed MSISDN (BANK | HASHCODE | EVALIDATOR | WinBack | VALENTINE_PROMO).
 */
export async function checkMsisdnActive(
  input: MtnKycCheckMsisdnInput
): Promise<MtnKycCallResult> {
  const cfg = mtnKycConfig();
  if (!input.customerId?.trim()) {
    return {
      ok: false,
      status: 400,
      madapiCode: "5000",
      severity: "client",
      error: "customerId (MSISDN) is required (MADAPI 5000 Bad Request)",
    };
  }
  if (cfg.sandbox && !cfg.configured) {
    return sandboxOk(input.transactionId, "GET /customers/{id}", {
      customerId: input.customerId,
      verificationStatus: "Active",
      verificationStatus2: "Active",
      hashedMsisdn: `HASH:${input.customerId}`,
      attemptCount: 1,
    });
  }
  return callMtnApi({
    method: "GET",
    path: `/customers/${encodeURIComponent(input.customerId)}`,
    transactionId: input.transactionId,
    targetSystem: input.targetSystem,
    query: {
      verificationType: input.verificationType,
      externalCode: input.externalCode,
      startDate: input.startDate,
      endDate: input.endDate,
    },
  });
}

/** POST /customers/{customerId}/kycScore - full attribute match score (0-100). */
export async function verifyKycScore(
  input: MtnKycScoreInput
): Promise<MtnKycCallResult> {
  return scoreCall(input, "/kycScore");
}

/** POST /customers/{customerId}/nameScore - name-only match score (0-100). */
export async function verifyNameScore(
  input: MtnKycScoreInput
): Promise<MtnKycCallResult> {
  return scoreCall(input, "/nameScore");
}

/** POST /customers/{customerId}/addressScore - address-only match score (0-100). */
export async function verifyAddressScore(
  input: MtnKycScoreInput
): Promise<MtnKycCallResult> {
  return scoreCall(input, "/addressScore");
}

async function scoreCall(
  input: MtnKycScoreInput,
  suffix: string
): Promise<MtnKycCallResult> {
  const cfg = mtnKycConfig();
  if (!input.customerId?.trim()) {
    return {
      ok: false,
      status: 400,
      madapiCode: "5000",
      severity: "client",
      error: "customerId is required (MADAPI 5000 Bad Request)",
    };
  }
  if (cfg.sandbox && !cfg.configured) {
    return sandboxOk(input.transactionId, `POST /customers/{id}${suffix}`, {
      customerId: input.customerId,
      score: 100,
      matches: {
        firstName: 100,
        lastName: 100,
        phoneNumber: 100,
        emailAddress: 100,
        nationalIdNumber: 100,
        streetAddress: 100,
        city: 100,
        postCode: 100,
        country: 100,
      },
    });
  }
  return callMtnApi({
    method: "POST",
    path: `/customers/${encodeURIComponent(input.customerId)}${suffix}`,
    transactionId: input.transactionId,
    body: input.body,
  });
}

/** POST /customers/{customerId}/biometric/verify - face / fingerprint match. */
export async function verifyBiometric(
  input: MtnKycBiometricInput
): Promise<MtnKycCallResult> {
  const cfg = mtnKycConfig();
  if (!input.customerId?.trim()) {
    return {
      ok: false,
      status: 400,
      madapiCode: "5000",
      severity: "client",
      error: "customerId is required (MADAPI 5000 Bad Request)",
    };
  }
  if (cfg.sandbox && !cfg.configured) {
    return sandboxOk(input.transactionId, "POST /customers/{id}/biometric/verify", {
      id: input.customerId,
      dateOfBirth: "23-Apr-1985",
      score: 100,
      confidenceValidationScore: 100.0,
      confidenceMinRange: 23.0,
      confidenceMaxRange: 45.0,
      matchDescription: "MATCH_FOUND",
      matchThreshold: 57.0,
    });
  }
  return callMtnApi({
    method: "POST",
    path: `/customers/${encodeURIComponent(input.customerId)}/biometric/verify`,
    transactionId: input.transactionId,
    targetSystem: input.targetSystem,
    query: {
      requestType: input.requestType,
      verificationType: input.verificationType,
    },
    body: input.body,
  });
}

/** POST /biometric-roc/customers/identityStatus - ROC enroll identity status. */
export async function getIdentityStatus(
  input: MtnKycIdentityStatusInput
): Promise<MtnKycCallResult> {
  const cfg = mtnKycConfig();
  if (!input.body?.customerId?.trim()) {
    return {
      ok: false,
      status: 400,
      madapiCode: "5000",
      severity: "client",
      error: "body.customerId is required (MADAPI 5000 Bad Request)",
    };
  }
  if (cfg.sandbox && !cfg.configured) {
    return sandboxOk(input.transactionId, "POST /biometric-roc/customers/identityStatus", {
      customerId: input.body.customerId,
      customerStatus: "NotEnrolled",
      externalStatus: "DHAOffline",
      modality: "face",
      agentId: input.body.agentId || null,
      channelId: input.body.channelId || null,
    });
  }
  return callMtnApi({
    method: "POST",
    path: "/biometric-roc/customers/identityStatus",
    transactionId: input.transactionId,
    body: input.body,
  });
}