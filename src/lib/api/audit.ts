/**
 * Server-side audit writer (admin client) for dedicated money-path routes.
 *
 * The generic CRUD engine writes its own audit rows; this helper is for
 * transactional routes (invoices, payments, advances, journals) that cannot
 * go through the generic surface. Audit must never break the business
 * operation, so failures are logged and swallowed.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export type ServerAuditEntry = {
  company_id: string;
  user_id: string;
  action: string;
  module: string;
  entity_type?: string;
  entity_id?: string | null;
  entity_reference?: string | null;
  before_state?: unknown;
  after_state?: unknown;
  metadata?: Record<string, unknown>;
  ip_address?: string | null;
  user_agent?: string | null;
};

export async function writeServerAudit(
  sb: SupabaseClient,
  entry: ServerAuditEntry
): Promise<void> {
  try {
    await sb.from("audit_logs").insert({
      company_id: entry.company_id,
      user_id: entry.user_id,
      action: entry.action.slice(0, 100),
      module: entry.module.slice(0, 50),
      entity_type: entry.entity_type?.slice(0, 50) ?? null,
      entity_id: entry.entity_id ?? null,
      entity_reference: entry.entity_reference ?? null,
      before_state: entry.before_state ?? null,
      after_state: entry.after_state ?? null,
      metadata: entry.metadata ?? {},
      ip_address: entry.ip_address ?? null,
      user_agent: entry.user_agent ?? null,
    });
  } catch {
    // audit is best-effort; never fail the business operation
  }
}
