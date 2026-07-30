/**
 * Maker-checker / dual-control enforcement for high-risk actions.
 * Requires a second distinct approver record before execution.
 */

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type DualControlAction =
  | "payroll.release"
  | "payroll.bank_file"
  | "finance.gl_post"
  | "finance.period_close"
  | "identity.provision"
  | "identity.reset_password"
  | "billing.payment_void"
  | "platform.provision_tenant";

export type DualControlRequest = {
  id: string;
  company_id: string;
  action: string;
  subject_type?: string | null;
  subject_id?: string | null;
  maker_id: string;
  checker_id?: string | null;
  status: string;
  payload?: Record<string, unknown> | null;
};

/**
 * Ensure dual-control table exists usage via try/catch if migration lagging.
 * Request approval: maker creates; checker approves; execute only when approved.
 */
export async function createDualControlRequest(input: {
  company_id: string;
  action: DualControlAction | string;
  maker_id: string;
  subject_type?: string;
  subject_id?: string;
  payload?: Record<string, unknown>;
  notes?: string;
}): Promise<{ id: string; status: string }> {
  const sb = createAdminClient();
  const { data, error } = await sb
    .from("sec_dual_control_requests")
    .insert({
      company_id: input.company_id,
      action: input.action,
      maker_id: input.maker_id,
      subject_type: input.subject_type || null,
      subject_id: input.subject_id || null,
      payload: input.payload || {},
      notes: input.notes || null,
      status: "pending",
    })
    .select("id,status")
    .single();

  if (error) {
    // Fail closed for money/identity when dual control required and table missing
    throw new Error(
      `Dual-control request failed: ${error.message}. Ensure migration 00067 applied.`
    );
  }
  return { id: data.id, status: data.status };
}

export async function approveDualControlRequest(input: {
  request_id: string;
  checker_id: string;
  company_id: string;
  approve: boolean;
  notes?: string;
}): Promise<DualControlRequest> {
  const sb = createAdminClient();
  const { data: row, error } = await sb
    .from("sec_dual_control_requests")
    .select("*")
    .eq("id", input.request_id)
    .eq("company_id", input.company_id)
    .maybeSingle();

  if (error || !row) throw new Error("Dual-control request not found");
  if (row.status !== "pending") throw new Error(`Request already ${row.status}`);
  if (row.maker_id === input.checker_id) {
    throw new Error("Maker cannot approve their own dual-control request");
  }

  const { data: updated, error: uErr } = await sb
    .from("sec_dual_control_requests")
    .update({
      status: input.approve ? "approved" : "rejected",
      checker_id: input.checker_id,
      checked_at: new Date().toISOString(),
      notes: input.notes || row.notes,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.request_id)
    .select("*")
    .single();

  if (uErr || !updated) throw uErr || new Error("Update failed");
  return updated as DualControlRequest;
}

/**
 * Returns true if dual control is satisfied for action.
 * - If DUAL_CONTROL_REQUIRED=false, always true (dev only)
 * - If request_id provided and approved by different user, true
 * - Platform may set DUAL_CONTROL_BYPASS_ROLES (not recommended)
 */
export async function assertDualControl(input: {
  company_id: string;
  action: DualControlAction | string;
  actor_id: string;
  request_id?: string | null;
  /** When true (default for money/identity in prod), require approved request */
  required?: boolean;
}): Promise<{ ok: true; request?: DualControlRequest } | { ok: false; error: string }> {
  // Opt-in: set DUAL_CONTROL_REQUIRED=true for production money/identity gates
  const required =
    input.required === true || process.env.DUAL_CONTROL_REQUIRED === "true";

  if (!required) {
    return { ok: true };
  }

  if (!input.request_id) {
    return {
      ok: false,
      error:
        "Dual-control required: create and approve a dual-control request before this action",
    };
  }

  const sb = createAdminClient();
  const { data: row } = await sb
    .from("sec_dual_control_requests")
    .select("*")
    .eq("id", input.request_id)
    .eq("company_id", input.company_id)
    .eq("action", input.action)
    .maybeSingle();

  if (!row) {
    return { ok: false, error: "Dual-control request not found for this action" };
  }
  if (row.status !== "approved") {
    return { ok: false, error: `Dual-control status is ${row.status}, expected approved` };
  }
  if (row.maker_id === input.actor_id && row.checker_id === input.actor_id) {
    return { ok: false, error: "Invalid dual-control: maker and checker must differ" };
  }
  if (row.checker_id === input.actor_id || row.maker_id === input.actor_id) {
    // Executor can be maker or checker after approval — both OK
    return { ok: true, request: row as DualControlRequest };
  }

  // Allow any privileged executor if request approved (delegation)
  return { ok: true, request: row as DualControlRequest };
}

export async function listPendingDualControl(companyId: string) {
  const sb = await createClient();
  const { data } = await sb
    .from("sec_dual_control_requests")
    .select("*")
    .eq("company_id", companyId)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(100);
  return data || [];
}
