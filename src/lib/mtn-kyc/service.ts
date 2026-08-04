/**
 * Tenant-scoped MTN KYC verification with audit trail.
 */

import { randomUUID } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  checkMsisdnActive,
  getIdentityStatus,
  verifyBiometric,
  verifyAddressScore,
  verifyCustomerSingle,
  verifyCustomersKyc,
  verifyCustomersKycPost,
  verifyKycScore,
  verifyNameScore,
} from "./client";
import { mtnKycConfig } from "./config";
import type {
  MtnKycAuditRow,
  MtnKycCallResult,
  MtnKycCustomerInput,
  MtnKycRequestType,
} from "./types";

function adminOr(sb?: SupabaseClient) {
  return sb || createAdminClient();
}

async function persistAudit(input: {
  companyId: string;
  tenantId?: string | null;
  userId?: string | null;
  transactionId: string;
  targetSystem: string;
  kind: string;
  identifiers: string[];
  result: MtnKycCallResult;
  sb?: SupabaseClient;
}): Promise<string | null> {
  try {
    const client = adminOr(input.sb);
    const { result } = input;
    const summary =
      result.ok && result.body
        ? {
            statusCode: result.body.statusCode,
            statusMessage: result.body.statusMessage,
            customerCount: Array.isArray(result.body.customers)
              ? result.body.customers.length
              : Array.isArray(result.body.data)
                ? result.body.data.length
                : null,
            madapiCode: result.madapiCode,
          }
        : { madapiCode: result.madapiCode };

    const { data } = await client
      .from("intg_mtn_kyc_verifications")
      .insert({
        company_id: input.companyId,
        tenant_id: input.tenantId || null,
        transaction_id: input.transactionId,
        target_system: input.targetSystem,
        identifier_kind: input.kind,
        identifiers: input.identifiers,
        http_status: result.status || null,
        status_code: result.madapiCode || (result.ok ? "0000" : "ERROR"),
        success: result.ok,
        response_summary: summary,
        response_payload: result.ok
          ? result.body
          : result.body || {
              error: result.error,
              statusCode: result.madapiCode,
            },
        error_message: result.ok ? null : result.error,
        created_by: input.userId || null,
      })
      .select("id")
      .single();
    return (data?.id as string) || null;
  } catch {
    return null;
  }
}

/** Shared runner: builds transaction id, calls MTN, persists audit. */
async function runCompanyKycCall<M extends "GET" | "POST">(input: {
  companyId: string;
  tenantId?: string | null;
  userId?: string | null;
  kind: string;
  identifiers: string[];
  method: M;
  transactionId?: string;
  targetSystem?: string;
  call: (transactionId: string, targetSystem: string) => Promise<MtnKycCallResult>;
  sb?: SupabaseClient;
}): Promise<{
  result: MtnKycCallResult;
  auditId: string | null;
  transactionId: string;
  sandbox: boolean;
  method: M;
}> {
  const transactionId = input.transactionId?.trim() || randomUUID();
  const cfg = mtnKycConfig();
  const targetSystem = input.targetSystem || cfg.defaultTargetSystem;
  const result = await input.call(transactionId, targetSystem);

  const auditId = await persistAudit({
    companyId: input.companyId,
    tenantId: input.tenantId,
    userId: input.userId,
    transactionId,
    targetSystem,
    kind: input.kind,
    identifiers: input.identifiers,
    result,
    sb: input.sb,
  });

  return {
    result,
    auditId,
    transactionId,
    sandbox: cfg.sandbox && !cfg.configured,
    method: input.method,
  };
}

/** GET /customers - BVN / MSISDN lookup */
export async function runCompanyKycVerification(input: {
  companyId: string;
  tenantId?: string | null;
  userId?: string | null;
  bvns?: string[];
  msisdns?: string[];
  targetSystem?: string;
  transactionId?: string;
  sb?: SupabaseClient;
}): Promise<{
  result: MtnKycCallResult;
  auditId: string | null;
  transactionId: string;
  sandbox: boolean;
  method: "GET";
}> {
  const identifiers = [
    ...(input.bvns || []).map((b) => `bvn:${b}`),
    ...(input.msisdns || []).map((m) => `msisdn:${m}`),
  ];
  const kind =
    (input.bvns?.length || 0) > 0 && (input.msisdns?.length || 0) > 0
      ? "mixed"
      : (input.bvns?.length || 0) > 0
        ? "bvn"
        : "msisdn";

  return runCompanyKycCall({
    companyId: input.companyId,
    tenantId: input.tenantId,
    userId: input.userId,
    kind,
    identifiers,
    method: "GET",
    transactionId: input.transactionId,
    targetSystem: input.targetSystem,
    sb: input.sb,
    call: (transactionId, targetSystem) =>
      verifyCustomersKyc({
        transactionId,
        targetSystem,
        bvns: input.bvns,
        msisdns: input.msisdns,
      }),
  });
}

/** POST /customers - full customer payload (+ biometrics / requestType) */
export async function runCompanyKycVerificationPost(input: {
  companyId: string;
  tenantId?: string | null;
  userId?: string | null;
  customers: MtnKycCustomerInput[];
  requestType?: MtnKycRequestType;
  verificationType?: string;
  deviceId?: string;
  targetSystem?: string;
  transactionId?: string;
  sb?: SupabaseClient;
}): Promise<{
  result: MtnKycCallResult;
  auditId: string | null;
  transactionId: string;
  sandbox: boolean;
  method: "POST";
}> {
  const identifiers = input.customers.flatMap((c) => {
    const ids: string[] = [];
    if (c.bvn) ids.push(`bvn:${c.bvn}`);
    if (c.msisdn) ids.push(`msisdn:${c.msisdn}`);
    if (c.faceImage) ids.push("face:1");
    if (c.fingerprintImage) ids.push("fingerprint:1");
    return ids;
  });
  const kind = input.requestType
    ? `post:${String(input.requestType).toLowerCase()}`
    : "post:customers";

  return runCompanyKycCall({
    companyId: input.companyId,
    tenantId: input.tenantId,
    userId: input.userId,
    kind,
    identifiers: identifiers.length ? identifiers : ["post:body"],
    method: "POST",
    transactionId: input.transactionId,
    targetSystem: input.targetSystem,
    sb: input.sb,
    call: (transactionId, targetSystem) =>
      verifyCustomersKycPost({
        transactionId,
        targetSystem,
        requestType: input.requestType,
        verificationType: input.verificationType,
        deviceId: input.deviceId,
        customers: input.customers,
      }),
  });
}

/** POST /customers/{customerId} - verify single customer (isConsentVerified). */
export async function runCompanyKycSingle(input: {
  companyId: string;
  tenantId?: string | null;
  userId?: string | null;
  customerId: string;
  isConsentVerified: boolean;
  body: Record<string, unknown>;
  targetSystem?: string;
  transactionId?: string;
  sb?: SupabaseClient;
}): Promise<{
  result: MtnKycCallResult;
  auditId: string | null;
  transactionId: string;
  sandbox: boolean;
  method: "POST";
}> {
  return runCompanyKycCall({
    companyId: input.companyId,
    tenantId: input.tenantId,
    userId: input.userId,
    kind: "single",
    identifiers: [`id:${input.customerId}`],
    method: "POST",
    transactionId: input.transactionId,
    targetSystem: input.targetSystem,
    sb: input.sb,
    call: (transactionId, targetSystem) =>
      verifyCustomerSingle({
        transactionId,
        customerId: input.customerId,
        isConsentVerified: input.isConsentVerified,
        targetSystem,
        body: input.body,
      }),
  });
}

/** GET /customers/{customerId} - MSISDN active check + hashed MSISDN. */
export async function runCompanyKycCheckMsisdn(input: {
  companyId: string;
  tenantId?: string | null;
  userId?: string | null;
  customerId: string;
  verificationType?: string;
  externalCode?: string;
  startDate?: string;
  endDate?: string;
  targetSystem?: string;
  transactionId?: string;
  sb?: SupabaseClient;
}): Promise<{
  result: MtnKycCallResult;
  auditId: string | null;
  transactionId: string;
  sandbox: boolean;
  method: "GET";
}> {
  return runCompanyKycCall({
    companyId: input.companyId,
    tenantId: input.tenantId,
    userId: input.userId,
    kind: "msisdn-active",
    identifiers: [`msisdn:${input.customerId}`],
    method: "GET",
    transactionId: input.transactionId,
    targetSystem: input.targetSystem,
    sb: input.sb,
    call: (transactionId, targetSystem) =>
      checkMsisdnActive({
        transactionId,
        customerId: input.customerId,
        targetSystem,
        verificationType: input.verificationType,
        externalCode: input.externalCode,
        startDate: input.startDate,
        endDate: input.endDate,
      }),
  });
}

/** POST /customers/{customerId}/kycScore|nameScore|addressScore */
export async function runCompanyKycScore(input: {
  companyId: string;
  tenantId?: string | null;
  userId?: string | null;
  customerId: string;
  kind: "score" | "name_score" | "address_score";
  body: Record<string, unknown>;
  targetSystem?: string;
  transactionId?: string;
  sb?: SupabaseClient;
}): Promise<{
  result: MtnKycCallResult;
  auditId: string | null;
  transactionId: string;
  sandbox: boolean;
  method: "POST";
}> {
  const callers = {
    score: verifyKycScore,
    name_score: verifyNameScore,
    address_score: verifyAddressScore,
  } as const;
  const caller = callers[input.kind];
  return runCompanyKycCall({
    companyId: input.companyId,
    tenantId: input.tenantId,
    userId: input.userId,
    kind: input.kind,
    identifiers: [`id:${input.customerId}`],
    method: "POST",
    transactionId: input.transactionId,
    targetSystem: input.targetSystem,
    sb: input.sb,
    call: (transactionId, targetSystem) =>
      caller({
        transactionId,
        customerId: input.customerId,
        body: input.body,
      }),
  });
}

/** POST /customers/{customerId}/biometric/verify - face / fingerprint match. */
export async function runCompanyKycBiometric(input: {
  companyId: string;
  tenantId?: string | null;
  userId?: string | null;
  customerId: string;
  requestType?: string;
  verificationType?: string;
  body: Record<string, unknown>;
  targetSystem?: string;
  transactionId?: string;
  sb?: SupabaseClient;
}): Promise<{
  result: MtnKycCallResult;
  auditId: string | null;
  transactionId: string;
  sandbox: boolean;
  method: "POST";
}> {
  return runCompanyKycCall({
    companyId: input.companyId,
    tenantId: input.tenantId,
    userId: input.userId,
    kind: "biometric",
    identifiers: [`id:${input.customerId}`],
    method: "POST",
    transactionId: input.transactionId,
    targetSystem: input.targetSystem,
    sb: input.sb,
    call: (transactionId, targetSystem) =>
      verifyBiometric({
        transactionId,
        customerId: input.customerId,
        targetSystem,
        requestType: input.requestType,
        verificationType: input.verificationType,
        body: input.body,
      }),
  });
}

/** POST /biometric-roc/customers/identityStatus - ROC enroll identity status. */
export async function runCompanyKycIdentityStatus(input: {
  companyId: string;
  tenantId?: string | null;
  userId?: string | null;
  customerId: string;
  agentId?: string;
  channelId?: string;
  targetSystem?: string;
  transactionId?: string;
  sb?: SupabaseClient;
}): Promise<{
  result: MtnKycCallResult;
  auditId: string | null;
  transactionId: string;
  sandbox: boolean;
  method: "POST";
}> {
  return runCompanyKycCall({
    companyId: input.companyId,
    tenantId: input.tenantId,
    userId: input.userId,
    kind: "identity-status",
    identifiers: [`id:${input.customerId}`],
    method: "POST",
    transactionId: input.transactionId,
    targetSystem: input.targetSystem,
    sb: input.sb,
    call: (transactionId) =>
      getIdentityStatus({
        transactionId,
        body: {
          customerId: input.customerId,
          agentId: input.agentId,
          channelId: input.channelId,
        },
      }),
  });
}

export async function listKycVerifications(
  companyId: string,
  opts?: { limit?: number; sb?: SupabaseClient }
): Promise<MtnKycAuditRow[]> {
  const client = adminOr(opts?.sb);
  const { data, error } = await client
    .from("intg_mtn_kyc_verifications")
    .select(
      "id,company_id,transaction_id,target_system,identifier_kind,identifiers,http_status,status_code,success,response_summary,error_message,created_by,created_at"
    )
    .eq("company_id", companyId)
    .order("created_at", { ascending: false })
    .limit(Math.min(100, opts?.limit ?? 30));
  if (error) throw new Error(error.message);
  return (data || []) as MtnKycAuditRow[];
}