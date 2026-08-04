/**
 * Tenant-scoped MTN MADAPI OAuth2 access-token requests with audit trail.
 * The raw token is never persisted or returned - only a sha256 hash.
 */

import { randomUUID } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { requestAccessToken } from "./client";
import { mtnOauthConfig } from "./config";
import type { MtnOauthAuditRow, MtnOauthTokenResult } from "./types";

function adminOr(sb?: SupabaseClient) {
  return sb || createAdminClient();
}

async function persistOauthAudit(input: {
  companyId: string;
  tenantId?: string | null;
  userId?: string | null;
  transactionId: string;
  result: MtnOauthTokenResult;
  sb?: SupabaseClient;
}): Promise<string | null> {
  try {
    const client = adminOr(input.sb);
    const { result } = input;
    const cfg = mtnOauthConfig();
    const now = new Date();
    const expiresAt =
      result.ok && result.expiresInSeconds
        ? new Date(now.getTime() + result.expiresInSeconds * 1000).toISOString()
        : null;

    const { data } = await client
      .from("intg_mtn_oauth_tokens")
      .insert({
        company_id: input.companyId,
        tenant_id: input.tenantId || null,
        transaction_id: input.transactionId,
        http_status: result.status || null,
        status_code: result.ok
          ? "0000"
          : result.status === 401
            ? "4000"
            : result.status === 400
              ? "5000"
              : result.status === 503
                ? "503"
                : "ERROR",
        success: result.ok,
        token_hash: result.ok ? result.tokenHash : null,
        expires_at: expiresAt,
        issued_at: result.ok ? result.issuedAt : null,
        client_id: cfg.clientId || null,
        response_summary: result.ok ? result.summary : null,
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

/** Request an MTN MADAPI OAuth2 access token and persist the audit row. */
export async function runCompanyOauthCall(input: {
  companyId: string;
  tenantId?: string | null;
  userId?: string | null;
  transactionId?: string;
  sb?: SupabaseClient;
}): Promise<{
  result: MtnOauthTokenResult;
  auditId: string | null;
  transactionId: string;
  sandbox: boolean;
}> {
  const transactionId = input.transactionId?.trim() || randomUUID();
  const cfg = mtnOauthConfig();
  const result = await requestAccessToken({ transactionId });

  const auditId = await persistOauthAudit({
    companyId: input.companyId,
    tenantId: input.tenantId,
    userId: input.userId,
    transactionId,
    result,
    sb: input.sb,
  });

  return {
    result,
    auditId,
    transactionId,
    sandbox: cfg.sandbox && !cfg.configured,
  };
}

/** Recent OAuth token-request audit rows for a company (never token material). */
export async function listOauthAudits(
  companyId: string,
  opts?: { limit?: number; sb?: SupabaseClient }
): Promise<MtnOauthAuditRow[]> {
  const client = adminOr(opts?.sb);
  const { data, error } = await client
    .from("intg_mtn_oauth_tokens")
    .select(
      "id,company_id,transaction_id,http_status,status_code,success,token_hash,expires_at,issued_at,client_id,response_summary,error_message,created_by,created_at"
    )
    .eq("company_id", companyId)
    .order("created_at", { ascending: false })
    .limit(Math.min(100, opts?.limit ?? 30));
  if (error) throw new Error(error.message);
  return (data || []) as MtnOauthAuditRow[];
}