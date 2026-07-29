/**
 * Credit control — limits, risk, sales blocks.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export type CreditCheckResult = {
  allowed: boolean;
  blocked: boolean;
  requireApproval: boolean;
  warning?: string;
  outstanding: number;
  credit_limit: number;
  available: number;
  risk_score: number;
  reasons: string[];
};

export async function getCustomerOutstanding(
  supabase: SupabaseClient,
  customerId: string
): Promise<number> {
  const { data } = await supabase
    .from("invoices")
    .select("total_amount,amount_paid,status")
    .eq("customer_id", customerId)
    .not("status", "in", '("paid","void","cancelled")');
  return (data || []).reduce(
    (s, i) => s + (Number(i.total_amount) - Number(i.amount_paid || 0)),
    0
  );
}

export async function checkCredit(
  supabase: SupabaseClient,
  companyId: string,
  customerId: string,
  additionalAmount = 0
): Promise<CreditCheckResult> {
  const { data: cust } = await supabase
    .from("customers")
    .select("*")
    .eq("id", customerId)
    .single();
  if (!cust) {
    return {
      allowed: false,
      blocked: true,
      requireApproval: false,
      outstanding: 0,
      credit_limit: 0,
      available: 0,
      risk_score: 100,
      reasons: ["Customer not found"],
    };
  }

  const outstanding = await getCustomerOutstanding(supabase, customerId);
  const limit = Number(cust.credit_limit || 0);
  const projected = outstanding + additionalAmount;
  const available = Math.max(0, limit - outstanding);
  const risk = Number(cust.risk_score ?? 50);
  const reasons: string[] = [];
  let blocked = Boolean(cust.credit_blocked || cust.on_hold);
  let requireApproval = Boolean(cust.require_credit_approval);
  let warning: string | undefined;

  if (cust.credit_blocked) reasons.push(cust.credit_block_reason || "Customer credit blocked");
  if (cust.on_hold) reasons.push("Customer account on hold");

  if (limit > 0 && projected > limit) {
    reasons.push(
      `Credit limit exceeded: outstanding ${projected.toFixed(0)} > limit ${limit}`
    );
    blocked = true;
  } else if (limit > 0 && projected > limit * 0.8) {
    warning = `Approaching credit limit (${((projected / limit) * 100).toFixed(0)}% used)`;
  }

  if (risk >= 70) {
    requireApproval = true;
    reasons.push(`High risk score (${risk})`);
  }

  const { data: rules } = await supabase
    .from("bill_credit_rules")
    .select("*")
    .eq("company_id", companyId)
    .eq("is_active", true);

  for (const r of rules || []) {
    if (r.rule_type === "risk_threshold" && risk >= Number(r.threshold_value || 70)) {
      if (r.action === "require_finance") requireApproval = true;
      if (r.action === "block_sales") blocked = true;
      reasons.push(String(r.name));
    }
  }

  // Pending credit approval can allow temporarily
  if (blocked && requireApproval) {
    const { data: pending } = await supabase
      .from("bill_credit_approvals")
      .select("id")
      .eq("customer_id", customerId)
      .eq("status", "approved")
      .gte("requested_amount", additionalAmount)
      .limit(1)
      .maybeSingle();
    if (pending) {
      blocked = false;
      reasons.push("Override: approved credit request");
    }
  }

  return {
    allowed: !blocked,
    blocked,
    requireApproval,
    warning,
    outstanding,
    credit_limit: limit,
    available,
    risk_score: risk,
    reasons,
  };
}

export async function logCreditEvent(
  supabase: SupabaseClient,
  input: {
    company_id: string;
    customer_id: string;
    event_type: string;
    amount?: number;
    credit_limit?: number;
    outstanding?: number;
    message?: string;
    actor_id?: string | null;
  }
) {
  await supabase.from("bill_credit_events").insert({
    company_id: input.company_id,
    customer_id: input.customer_id,
    event_type: input.event_type,
    amount: input.amount ?? null,
    credit_limit: input.credit_limit ?? null,
    outstanding: input.outstanding ?? null,
    message: input.message ?? null,
    actor_id: input.actor_id ?? null,
  });
}

export async function setCustomerCreditBlock(
  supabase: SupabaseClient,
  customerId: string,
  blocked: boolean,
  reason?: string
) {
  await supabase
    .from("customers")
    .update({
      credit_blocked: blocked,
      credit_block_reason: blocked ? reason || "Blocked by credit control" : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", customerId);
}
