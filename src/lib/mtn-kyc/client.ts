/**
 * HTTP client for MTN Customer KYC Verification API.
 * Spec: GET /customers with transactionId + targetSystem headers;
 * bvns (and/or msisdns) as array query/header identifiers.
 *
 * Error responses (swagger):
 *   400 + statusCode 5000  Bad Request
 *   401 + statusCode 4000  Unauthorized
 *   403 + statusCode 4001  Forbidden
 *   404 + statusCode 4004  Not Found
 */

import {
  mtnKycBasicAuthHeader,
  mtnKycConfig,
} from "./config";
import {
  describeMadapiError,
  isMadapiSuccessCode,
  resolveMadapiCode,
} from "./madapi-codes";
import type { MtnKycCallResult, MtnKycMultiResponse, MtnKycVerifyInput } from "./types";

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

/**
 * Verify multiple customers by BVN and/or MSISDN.
 * Swagger lists bvns as a header array; many MADAPI gateways also accept
 * repeated query params — we send both for compatibility.
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
    return sandboxResponse(input, bvns, msisdns);
  }

  if (!cfg.configured) {
    return {
      ok: false,
      status: 503,
      madapiCode: "5000",
      severity: "server",
      error:
        "MTN KYC not configured. Set MTN_KYC_API_KEY, MTN_KYC_BASIC_USER, MTN_KYC_BASIC_PASSWORD",
    };
  }

  const targetSystem = input.targetSystem || cfg.defaultTargetSystem;
  const url = new URL(`${cfg.baseUrl}/customers`);
  for (const b of bvns) url.searchParams.append("bvns", b);
  for (const m of msisdns) url.searchParams.append("msisdns", m);

  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
    "X-API-Key": cfg.apiKey,
    Authorization: mtnKycBasicAuthHeader(cfg.basicUser, cfg.basicPass),
    transactionId: input.transactionId.trim(),
    targetSystem,
  };

  // Swagger: bvns as header array — send comma-joined + JSON array forms
  if (bvns.length) {
    headers.bvns = JSON.stringify(bvns);
    headers["X-BVNs"] = bvns.join(",");
  }
  if (msisdns.length) {
    headers.msisdns = JSON.stringify(msisdns);
    headers["X-MSISDNs"] = msisdns.join(",");
  }

  try {
    const res = await fetch(url.toString(), {
      method: "GET",
      headers,
      // No cookies; server-to-server
      cache: "no-store",
    });

    const text = await res.text();
    let raw: unknown = null;
    try {
      raw = text ? JSON.parse(text) : null;
    } catch {
      raw = { raw: text.slice(0, 2000) };
    }

    const body = (raw || {}) as Record<string, unknown>;
    const madapiCode = resolveMadapiCode(res.status, body);

    // HTTP error envelope (400/401/403/404 + ErrorPayload)
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

    // HTTP 200 but MADAPI business failure in body statusCode
    if (
      body.statusCode != null &&
      !isMadapiSuccessCode(body.statusCode)
    ) {
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
  } catch (e) {
    return {
      ok: false,
      status: 0,
      madapiCode: "5000",
      severity: "server",
      error: e instanceof Error ? e.message : "Network error calling MTN KYC",
    };
  }
}

function sandboxResponse(
  input: MtnKycVerifyInput,
  bvns: string[],
  msisdns: string[]
): MtnKycCallResult {
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
      statusMessage: "Success (sandbox)",
      transactionId: input.transactionId,
      customers,
    },
    raw: { sandbox: true, customers },
  };
}
