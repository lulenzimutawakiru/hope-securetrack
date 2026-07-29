import { createClient } from "@/lib/supabase/client";
import { computePaperCosts } from "./ai";
import type { ApprovalInput, CostRollInput, JournalInput } from "./types";

function sb() {
  return createClient();
}

function genCode(prefix: string) {
  return `${prefix}-${Date.now().toString(36).toUpperCase()}`;
}

export async function logFinAudit(input: {
  company_id: string;
  actor_id?: string | null;
  action: string;
  entity_type?: string;
  entity_id?: string;
  details?: string;
}) {
  await sb().from("fin_audit_log").insert({
    company_id: input.company_id,
    actor_id: input.actor_id,
    action: input.action,
    entity_type: input.entity_type,
    entity_id: input.entity_id,
    details: input.details,
  });
}

// ─── Dashboard ───────────────────────────────────────────────

export async function getFinanceDashboard() {
  const [
    coa,
    journals,
    ap,
    ar,
    bank,
    assets,
    budgets,
    cashPos,
    kpi,
    insights,
    approvals,
  ] = await Promise.all([
    sb().from("chart_of_accounts").select("*", { count: "exact", head: true }).is("deleted_at", null),
    sb().from("gl_journals").select("*", { count: "exact", head: true }).is("deleted_at", null),
    sb()
      .from("ap_invoices")
      .select("total_amount, amount_paid, status")
      .is("deleted_at", null)
      .not("status", "in", '("paid","void")'),
    sb()
      .from("invoices")
      .select("total_amount, amount_paid, status")
      .not("status", "in", '("paid","void","cancelled")'),
    sb().from("bank_accounts").select("current_balance").eq("is_active", true).is("deleted_at", null),
    sb().from("fixed_assets").select("book_value").eq("status", "active").is("deleted_at", null),
    sb().from("budgets").select("total_amount, actual_amount, status").eq("status", "approved"),
    sb()
      .from("fin_cash_positions")
      .select("*")
      .order("position_date", { ascending: false })
      .limit(1)
      .maybeSingle(),
    sb()
      .from("fin_kpi_snapshots")
      .select("*")
      .order("snapshot_date", { ascending: false })
      .limit(1)
      .maybeSingle(),
    sb()
      .from("finance_insights")
      .select("*")
      .eq("status", "open")
      .order("created_at", { ascending: false })
      .limit(8),
    sb()
      .from("fin_approvals")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending"),
  ]);

  const apOpen = (ap.data || []).reduce(
    (s, r) => s + (Number(r.total_amount || 0) - Number(r.amount_paid || 0)),
    0
  );
  const arOpen = (ar.data || []).reduce(
    (s, r) => s + (Number(r.total_amount || 0) - Number(r.amount_paid || 0)),
    0
  );
  const bankBal = (bank.data || []).reduce((s, r) => s + Number(r.current_balance || 0), 0);
  const assetVal = (assets.data || []).reduce((s, r) => s + Number(r.book_value || 0), 0);
  const budgetTotal = (budgets.data || []).reduce((s, r) => s + Number(r.total_amount || 0), 0);
  const budgetActual = (budgets.data || []).reduce((s, r) => s + Number(r.actual_amount || 0), 0);

  const cash = cashPos.data;
  const k = kpi.data;

  return {
    accounts: coa.count ?? 0,
    journals: journals.count ?? 0,
    openAp: apOpen,
    openAr: arOpen,
    bankBalances: bankBal || Number(cash?.bank_balance || 0),
    cashPosition: Number(cash?.total_cash || bankBal || 0),
    assetBookValue: assetVal,
    budgetTotal,
    budgetActual,
    budgetUtil: budgetTotal > 0 ? Math.round((budgetActual / budgetTotal) * 1000) / 10 : 0,
    pendingApprovals: approvals.count ?? 0,
    kpi: k || null,
    insights: insights.data || [],
    cashPositionRow: cash || null,
  };
}

// ─── COA ─────────────────────────────────────────────────────

export async function listAccounts(opts?: { account_type?: string; limit?: number }) {
  let q = sb()
    .from("chart_of_accounts")
    .select("*")
    .is("deleted_at", null)
    .order("account_code")
    .limit(opts?.limit ?? 500);
  if (opts?.account_type) q = q.eq("account_type", opts.account_type);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

// ─── Journals ────────────────────────────────────────────────

export async function listJournals(opts?: { status?: string; limit?: number }) {
  let q = sb()
    .from("gl_journals")
    .select("*")
    .is("deleted_at", null)
    .order("journal_date", { ascending: false })
    .limit(opts?.limit ?? 100);
  if (opts?.status) q = q.eq("status", opts.status);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

export async function createJournal(input: JournalInput) {
  const debits = input.lines.reduce((s, l) => s + Number(l.debit || 0), 0);
  const credits = input.lines.reduce((s, l) => s + Number(l.credit || 0), 0);
  if (Math.abs(debits - credits) > 0.01) {
    throw new Error(`Journal not balanced: debit ${debits} ≠ credit ${credits}`);
  }

  const journal_number = genCode("JRN");
  const { data: header, error } = await sb()
    .from("gl_journals")
    .insert({
      company_id: input.company_id,
      journal_number,
      journal_type: input.journal_type || "general",
      journal_date: input.journal_date || new Date().toISOString().slice(0, 10),
      description: input.description,
      currency: input.currency || "UGX",
      status: "draft",
      source_module: input.source_module || null,
      source_ref: input.source_ref || null,
      created_by: input.created_by || null,
      total_debit: debits,
      total_credit: credits,
    })
    .select("*")
    .single();
  if (error) throw error;

  if (input.lines.length) {
    const lines = input.lines.map((l, i) => ({
      journal_id: header.id,
      company_id: input.company_id,
      line_number: i + 1,
      account_id: l.account_id || null,
      description: l.description || input.description,
      debit: Number(l.debit || 0),
      credit: Number(l.credit || 0),
      cost_center_id: l.cost_center_id || null,
    }));
    await sb().from("gl_journal_lines").insert(lines);
  }

  await logFinAudit({
    company_id: input.company_id,
    actor_id: input.created_by,
    action: "journal.create",
    entity_type: "journal",
    entity_id: header.id,
    details: journal_number,
  });

  return header;
}

export async function postJournal(id: string, actorId?: string | null) {
  const { data, error } = await sb()
    .from("gl_journals")
    .update({
      status: "posted",
      posted_at: new Date().toISOString(),
      posted_by: actorId || null,
    })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  if (data?.company_id) {
    await logFinAudit({
      company_id: data.company_id as string,
      actor_id: actorId,
      action: "journal.post",
      entity_type: "journal",
      entity_id: id,
    });
  }
  return data;
}

export async function reverseJournal(id: string, actorId?: string | null) {
  const { data, error } = await sb()
    .from("gl_journals")
    .update({ status: "reversed" })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  if (data?.company_id) {
    await logFinAudit({
      company_id: data.company_id as string,
      actor_id: actorId,
      action: "journal.reverse",
      entity_type: "journal",
      entity_id: id,
    });
  }
  return data;
}

// ─── Cost rolls ──────────────────────────────────────────────

export async function listCostRolls() {
  const { data, error } = await sb()
    .from("fin_cost_rolls")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  return data || [];
}

export async function createCostRoll(input: CostRollInput) {
  const roll_number = genCode("COST");
  const total =
    Number(input.direct_materials || 0) +
    Number(input.direct_labor || 0) +
    Number(input.factory_overhead || 0) +
    Number(input.machine_cost || 0) +
    Number(input.utility_cost || 0) +
    Number(input.packaging_cost || 0) +
    Number(input.transport_cost || 0) +
    Number(input.scrap_cost || 0);

  const reams = Number(input.reams_per_batch || input.batch_qty || 1);
  const costs = computePaperCosts({
    total_cost: total,
    reams,
    sheets: input.sheets_per_batch,
    boxes: input.boxes_per_batch,
    pallets: input.pallets_per_batch,
    tons: input.tons_per_batch,
    batch_qty: input.batch_qty,
  });

  const standard = Number(input.standard_cost || 0);
  const now = new Date();

  const { data, error } = await sb()
    .from("fin_cost_rolls")
    .insert({
      company_id: input.company_id,
      roll_number,
      production_order_ref: input.production_order_ref || null,
      product_name: input.product_name,
      product_line: input.product_line || "bond",
      batch_qty: input.batch_qty ?? reams,
      unit_label: input.unit_label || "ream",
      direct_materials: input.direct_materials ?? 0,
      direct_labor: input.direct_labor ?? 0,
      factory_overhead: input.factory_overhead ?? 0,
      machine_cost: input.machine_cost ?? 0,
      utility_cost: input.utility_cost ?? 0,
      packaging_cost: input.packaging_cost ?? 0,
      transport_cost: input.transport_cost ?? 0,
      scrap_cost: input.scrap_cost ?? 0,
      ...costs,
      standard_cost: standard,
      variance_amount: total - standard,
      period_year: now.getFullYear(),
      period_month: now.getMonth() + 1,
      created_by: input.created_by || null,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function listWip() {
  const { data, error } = await sb()
    .from("fin_wip")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return data || [];
}

// ─── CFO KPIs ────────────────────────────────────────────────

export async function getLatestKpis() {
  const { data, error } = await sb()
    .from("fin_kpi_snapshots")
    .select("*")
    .order("snapshot_date", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function listKpiHistory(limit = 12) {
  const { data, error } = await sb()
    .from("fin_kpi_snapshots")
    .select("*")
    .order("snapshot_date", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
}

// ─── Cash ────────────────────────────────────────────────────

export async function getCashPosition() {
  const { data, error } = await sb()
    .from("fin_cash_positions")
    .select("*")
    .order("position_date", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function listCashForecasts() {
  const { data, error } = await sb()
    .from("fin_cash_forecasts")
    .select("*")
    .order("forecast_date", { ascending: true })
    .limit(30);
  if (error) throw error;
  return data || [];
}

export async function listPettyCash() {
  const { data, error } = await sb()
    .from("fin_petty_cash")
    .select("*")
    .order("txn_date", { ascending: false })
    .limit(50);
  if (error) throw error;
  return data || [];
}

export async function createPettyCash(input: {
  company_id: string;
  payee: string;
  purpose: string;
  amount: number;
  created_by?: string | null;
}) {
  const voucher_number = genCode("PC");
  const { data, error } = await sb()
    .from("fin_petty_cash")
    .insert({
      company_id: input.company_id,
      voucher_number,
      payee: input.payee,
      purpose: input.purpose,
      amount: input.amount,
      status: "posted",
      created_by: input.created_by || null,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function listMobileMoney() {
  const { data, error } = await sb()
    .from("fin_mobile_money_txns")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return data || [];
}

// ─── Approvals ───────────────────────────────────────────────

export async function listApprovals(opts?: { status?: string }) {
  let q = sb()
    .from("fin_approvals")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);
  if (opts?.status) q = q.eq("status", opts.status);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

export async function createApproval(input: ApprovalInput) {
  const { data, error } = await sb()
    .from("fin_approvals")
    .insert({
      company_id: input.company_id,
      entity_type: input.entity_type,
      entity_ref: input.entity_ref,
      amount: input.amount ?? 0,
      currency: input.currency || "UGX",
      requested_by: input.requested_by || null,
      status: "pending",
      level_required: input.level_required ?? 1,
      comments: input.comments || null,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function decideApproval(
  id: string,
  decision: "approved" | "rejected",
  approverId?: string | null,
  comments?: string
) {
  const { data, error } = await sb()
    .from("fin_approvals")
    .update({
      status: decision,
      approver_id: approverId || null,
      decided_at: new Date().toISOString(),
      comments: comments || null,
      level_current: decision === "approved" ? 1 : 0,
      digital_signature: approverId ? `sig:${approverId}:${Date.now()}` : null,
    })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

// ─── Tax returns ─────────────────────────────────────────────

export async function listTaxReturns() {
  const { data, error } = await sb()
    .from("fin_tax_returns")
    .select("*")
    .order("period_year", { ascending: false })
    .order("period_month", { ascending: false })
    .limit(50);
  if (error) throw error;
  return data || [];
}

// ─── Insights ────────────────────────────────────────────────

export async function listFinanceInsights() {
  const { data, error } = await sb()
    .from("finance_insights")
    .select("*")
    .eq("status", "open")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return data || [];
}

export async function dismissInsight(id: string) {
  const { error } = await sb()
    .from("finance_insights")
    .update({ status: "dismissed", dismissed_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

// ─── Intercompany ────────────────────────────────────────────

export async function listIntercompany() {
  const { data, error } = await sb()
    .from("fin_intercompany_txns")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return data || [];
}

export async function createIntercompany(input: {
  company_id: string;
  from_entity: string;
  to_entity: string;
  amount: number;
  description?: string;
  created_by?: string | null;
}) {
  const txn_number = genCode("IC");
  const { data, error } = await sb()
    .from("fin_intercompany_txns")
    .insert({
      company_id: input.company_id,
      txn_number,
      from_entity: input.from_entity,
      to_entity: input.to_entity,
      amount: input.amount,
      description: input.description || null,
      status: "draft",
      created_by: input.created_by || null,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

// ─── Reports helpers ─────────────────────────────────────────

export async function getTrialBalanceSummary() {
  // Aggregate from journal lines if available; fallback empty
  const { data: lines } = await sb()
    .from("gl_journal_lines")
    .select("account_id, debit, credit")
    .limit(2000);

  const map = new Map<string, { debit: number; credit: number }>();
  for (const l of lines || []) {
    const k = String(l.account_id || "unassigned");
    const cur = map.get(k) || { debit: 0, credit: 0 };
    cur.debit += Number(l.debit || 0);
    cur.credit += Number(l.credit || 0);
    map.set(k, cur);
  }
  return Array.from(map.entries()).map(([account_id, v]) => ({
    account_id,
    debit: v.debit,
    credit: v.credit,
    balance: v.debit - v.credit,
  }));
}
