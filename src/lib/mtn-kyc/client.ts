/**
 * HTTP client for MTN Customer KYC Verification API.
 * Spec: GET /customers with transactionId + targetSystem headers;
 * bvns (and/or msisdns) as array query/header identifiers.
 */

import {
  mtnKycBasicAuthHeader,
  mtnKycConfig,
} from "./config";
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
      error: "Provide at least one BVN or MSISDN",
    };
  }
  if (!input.transactionId?.trim()) {
    return {
      ok: false,
      status: 400,
      error: "transactionId is required",
    };
  }

  if (cfg.sandbox && !cfg.configured) {
    return sandboxResponse(input, bvns, msisdns);
  }

  if (!cfg.configured) {
    return {
      ok: false,
      status: 503,
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

    if (!res.ok) {
      const body = (raw || {}) as Record<string, unknown>;
      return {
        ok: false,
        status: res.status,
        error:
          String(
            body.statusMessage ||
              body.message ||
              body.error ||
              `MTN KYC HTTP ${res.status}`
          ),
        body: body as MtnKycCallResult extends { ok: false; body?: infer B }
          ? B
          : never,
        raw,
      };
    }

    return {
      ok: true,
      status: res.status,
      body: (raw || {}) as MtnKycMultiResponse,
      raw,
    };
  } catch (e) {
    return {
      ok: false,
      status: 0,
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
    body: {
      statusCode: "0000",
      statusMessage: "Success (sandbox)",
      transactionId: input.transactionId,
      customers,
    },
    raw: { sandbox: true, customers },
  };
}
