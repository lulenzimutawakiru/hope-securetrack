/**
 * Tenant-scoped MTN KYC verification with audit trail.
 */

import { randomUUID } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyCustomersKyc } from "./client";
import { mtnKycConfig } from "./config";
import type { MtnKycAuditRow, MtnKycCallResult } from "./types";

function adminOr(sb?: SupabaseClient) {
  return sb || createAdminClient();
}

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
}> {
  const transactionId = input.transactionId?.trim() || randomUUID();
  const cfg = mtnKycConfig();
  const result = await verifyCustomersKyc({
    transactionId,
    targetSystem: input.targetSystem || cfg.defaultTargetSystem,
    bvns: input.bvns,
    msisdns: input.msisdns,
  });

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

  let auditId: string | null = null;
  try {
    const client = adminOr(input.sb);
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
          }
        : null;

    const { data } = await client
      .from("intg_mtn_kyc_verifications")
      .insert({
        company_id: input.companyId,
        tenant_id: input.tenantId || null,
        transaction_id: transactionId,
        target_system: input.targetSystem || cfg.defaultTargetSystem,
        identifier_kind: kind,
        identifiers,
        http_status: result.status || null,
        status_code: result.ok
          ? String(result.body.statusCode || "OK")
          : String(
              (result.body as { statusCode?: string } | undefined)?.statusCode ||
                "ERROR"
            ),
        success: result.ok,
        response_summary: summary,
        response_payload: result.ok ? result.body : result.body || { error: result.error },
        error_message: result.ok ? null : result.error,
        created_by: input.userId || null,
      })
      .select("id")
      .single();
    auditId = (data?.id as string) || null;
  } catch {
    /* table may not exist until migration; verification still returns */
  }

  return {
    result,
    auditId,
    transactionId,
    sandbox: cfg.sandbox && !cfg.configured,
  };
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
