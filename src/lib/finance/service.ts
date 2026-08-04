/**
 * Finance domain service — all I/O via /api/v2/crud (no browser Supabase client).
 */

import { computePaperCosts } from "./ai";
import type { ApprovalInput, CostRollInput, JournalInput } from "./types";
import {
  crudCount,
  mustCreate,
  mustList,
  mustUpdate,
} from "@/lib/crud/domain-helpers";

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
  try {
    await mustCreate("fin_audit_log", {
      action: input.action,
      entity_type: input.entity_type,
      entity_id: input.entity_id,
      details: input.details,
      actor_id: input.actor_id,
    });
  } catch {
    /* best-effort */
  }
}

// ─── Dashboard ───────────────────────────────────────────────

export async function getFinanceDashboard() {
  const [
    accounts,
    journals,
    apRows,
    arRows,
    bankRows,
    assetRows,
    budgetRows,
    cashRows,
    kpiRows,
    insights,
    pendingApprovals,
  ] = await Promise.all([
    crudCount("chart_of_accounts"),
    crudCount("gl_journals"),
    mustList<Record<string, unknown>>("ap_invoices", { pageSize: 500 }),
    mustList<Record<string, unknown>>("invoices", { pageSize: 500 }),
    mustList<Record<string, unknown>>("bank_accounts", {
      pageSize: 200,
      filters: { is_active: true },
    }),
    mustList<Record<string, unknown>>("fixed_assets", {
      pageSize: 500,
      filters: { status: "active" },
    }),
    mustList<Record<string, unknown>>("budgets", {
      pageSize: 200,
      filters: { status: "approved" },
    }),
    mustList<Record<string, unknown>>("fin_cash_positions", {
      pageSize: 1,
      sort: "position_date",
      order: "desc",
    }),
    mustList<Record<string, unknown>>("fin_kpi_snapshots", {
      pageSize: 1,
      sort: "snapshot_date",
      order: "desc",
    }),
    mustList("finance_insights", {
      pageSize: 8,
      sort: "created_at",
      order: "desc",
      filters: { status: "open" },
    }),
    crudCount("fin_approvals", { status: "pending" }),
  ]);

  const apOpen = apRows
    .filter((r) => r.status !== "paid" && r.status !== "void")
    .reduce(
      (s, r) =>
        s + (Number(r.total_amount || 0) - Number(r.amount_paid || 0)),
      0
    );
  const arOpen = arRows
    .filter(
      (r) =>
        r.status !== "paid" &&
        r.status !== "void" &&
        r.status !== "cancelled"
    )
    .reduce(
      (s, r) =>
        s + (Number(r.total_amount || 0) - Number(r.amount_paid || 0)),
      0
    );
  const bankBal = bankRows.reduce(
    (s, r) => s + Number(r.current_balance || 0),
    0
  );
  const assetVal = assetRows.reduce(
    (s, r) => s + Number(r.book_value || 0),
    0
  );
  const budgetTotal = budgetRows.reduce(
    (s, r) => s + Number(r.total_amount || 0),
    0
  );
  const budgetActual = budgetRows.reduce(
    (s, r) => s + Number(r.actual_amount || 0),
    0
  );

  const cash = cashRows[0] || null;
  const k = kpiRows[0] || null;

  return {
    accounts,
    journals,
    openAp: apOpen,
    openAr: arOpen,
    bankBalances: bankBal || Number(cash?.bank_balance || 0),
    cashPosition: Number(cash?.total_cash || bankBal || 0),
    assetBookValue: assetVal,
    budgetTotal,
    budgetActual,
    budgetUtil:
      budgetTotal > 0
        ? Math.round((budgetActual / budgetTotal) * 1000) / 10
        : 0,
    pendingApprovals,
    kpi: k,
    insights,
    cashPositionRow: cash,
  };
}

// ─── COA ─────────────────────────────────────────────────────

export async function listAccounts(opts?: {
  account_type?: string;
  limit?: number;
}) {
  return mustList("chart_of_accounts", {
    pageSize: opts?.limit ?? 500,
    sort: "account_code",
    order: "asc",
    filters: opts?.account_type
      ? { account_type: opts.account_type }
      : undefined,
  });
}

// ─── Journals ────────────────────────────────────────────────

export async function listJournals(opts?: {
  status?: string;
  limit?: number;
}) {
  return mustList("gl_journals", {
    pageSize: opts?.limit ?? 100,
    sort: "journal_date",
    order: "desc",
    filters: opts?.status ? { status: opts.status } : undefined,
  });
}

export async function createJournal(input: JournalInput) {
  const debits = input.lines.reduce((s, l) => s + Number(l.debit || 0), 0);
  const credits = input.lines.reduce((s, l) => s + Number(l.credit || 0), 0);
  if (Math.abs(debits - credits) > 0.01) {
    throw new Error(
      `Journal not balanced: debit ${debits} ≠ credit ${credits}`
    );
  }

  const journal_number = genCode("JRN");
  const header = await mustCreate<Record<string, unknown>>("gl_journals", {
    journal_number,
    journal_type: input.journal_type || "general",
    journal_date:
      input.journal_date || new Date().toISOString().slice(0, 10),
    description: input.description,
    currency: input.currency || "UGX",
    status: "draft",
    source_module: input.source_module || null,
    source_ref: input.source_ref || null,
    total_debit: debits,
    total_credit: credits,
  });

  for (let i = 0; i < input.lines.length; i++) {
    const l = input.lines[i];
    await mustCreate("gl_journal_lines", {
      journal_id: header.id,
      line_number: i + 1,
      account_id: l.account_id || null,
      description: l.description || input.description,
      debit: Number(l.debit || 0),
      credit: Number(l.credit || 0),
      cost_center_id: l.cost_center_id || null,
    });
  }

  await logFinAudit({
    company_id: input.company_id,
    actor_id: input.created_by,
    action: "journal.create",
    entity_type: "journal",
    entity_id: String(header.id),
    details: journal_number,
  });

  return header;
}

export async function postJournal(id: string, actorId?: string | null) {
  const data = await mustUpdate<Record<string, unknown>>("gl_journals", id, {
    status: "posted",
    posted_at: new Date().toISOString(),
    posted_by: actorId || null,
  });
  await logFinAudit({
    company_id: String(data.company_id || ""),
    actor_id: actorId,
    action: "journal.post",
    entity_type: "journal",
    entity_id: id,
  });
  return data;
}

export async function reverseJournal(id: string, actorId?: string | null) {
  const data = await mustUpdate<Record<string, unknown>>("gl_journals", id, {
    status: "reversed",
  });
  await logFinAudit({
    company_id: String(data.company_id || ""),
    actor_id: actorId,
    action: "journal.reverse",
    entity_type: "journal",
    entity_id: id,
  });
  return data;
}

// ─── Cost rolls ──────────────────────────────────────────────

export async function listCostRolls() {
  return mustList("fin_cost_rolls", {
    pageSize: 100,
    sort: "created_at",
    order: "desc",
  });
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

  return mustCreate("fin_cost_rolls", {
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
  });
}

export async function listWip() {
  return mustList("fin_wip", {
    pageSize: 50,
    sort: "created_at",
    order: "desc",
  });
}

// ─── CFO KPIs ────────────────────────────────────────────────

export async function getLatestKpis() {
  const rows = await mustList("fin_kpi_snapshots", {
    pageSize: 1,
    sort: "snapshot_date",
    order: "desc",
  });
  return rows[0] || null;
}

export async function listKpiHistory(limit = 12) {
  return mustList("fin_kpi_snapshots", {
    pageSize: limit,
    sort: "snapshot_date",
    order: "desc",
  });
}

// ─── Cash ────────────────────────────────────────────────────

export async function getCashPosition() {
  const rows = await mustList("fin_cash_positions", {
    pageSize: 1,
    sort: "position_date",
    order: "desc",
  });
  return rows[0] || null;
}

export async function listCashForecasts() {
  return mustList("fin_cash_forecasts", {
    pageSize: 30,
    sort: "forecast_date",
    order: "asc",
  });
}

export async function listPettyCash() {
  return mustList("fin_petty_cash", {
    pageSize: 50,
    sort: "txn_date",
    order: "desc",
  });
}

export async function createPettyCash(input: {
  company_id: string;
  payee: string;
  purpose: string;
  amount: number;
  created_by?: string | null;
}) {
  return mustCreate("fin_petty_cash", {
    voucher_number: genCode("PC"),
    payee: input.payee,
    purpose: input.purpose,
    amount: input.amount,
    status: "posted",
  });
}

export async function listMobileMoney() {
  return mustList("fin_mobile_money_txns", {
    pageSize: 50,
    sort: "created_at",
    order: "desc",
  });
}

// ─── Approvals ───────────────────────────────────────────────

export async function listApprovals(opts?: { status?: string }) {
  return mustList("fin_approvals", {
    pageSize: 100,
    sort: "created_at",
    order: "desc",
    filters: opts?.status ? { status: opts.status } : undefined,
  });
}

export async function createApproval(input: ApprovalInput) {
  return mustCreate("fin_approvals", {
    entity_type: input.entity_type,
    entity_ref: input.entity_ref,
    amount: input.amount ?? 0,
    currency: input.currency || "UGX",
    requested_by: input.requested_by || null,
    status: "pending",
    level_required: input.level_required ?? 1,
    comments: input.comments || null,
  });
}

export async function decideApproval(
  id: string,
  decision: "approved" | "rejected",
  approverId?: string | null,
  comments?: string
) {
  return mustUpdate("fin_approvals", id, {
    status: decision,
    approver_id: approverId || null,
    decided_at: new Date().toISOString(),
    comments: comments || null,
    level_current: decision === "approved" ? 1 : 0,
    digital_signature: approverId
      ? `sig:${approverId}:${Date.now()}`
      : null,
  });
}

// ─── Tax returns ─────────────────────────────────────────────

export async function listTaxReturns() {
  return mustList("fin_tax_returns", {
    pageSize: 50,
    sort: "period_year",
    order: "desc",
  });
}

// ─── Insights ────────────────────────────────────────────────

export async function listFinanceInsights() {
  return mustList("finance_insights", {
    pageSize: 50,
    sort: "created_at",
    order: "desc",
    filters: { status: "open" },
  });
}

export async function dismissInsight(id: string) {
  await mustUpdate("finance_insights", id, {
    status: "dismissed",
    dismissed_at: new Date().toISOString(),
  });
}

// ─── Intercompany ────────────────────────────────────────────

export async function listIntercompany() {
  return mustList("fin_intercompany_txns", {
    pageSize: 50,
    sort: "created_at",
    order: "desc",
  });
}

export async function createIntercompany(input: {
  company_id: string;
  from_entity: string;
  to_entity: string;
  amount: number;
  description?: string;
  created_by?: string | null;
}) {
  return mustCreate("fin_intercompany_txns", {
    txn_number: genCode("IC"),
    from_entity: input.from_entity,
    to_entity: input.to_entity,
    amount: input.amount,
    description: input.description || null,
    status: "draft",
  });
}

// ─── Reports helpers ─────────────────────────────────────────

export async function getTrialBalanceSummary() {
  const lines = await mustList<Record<string, unknown>>("gl_journal_lines", {
    pageSize: 500,
  });
  // Cap via multiple pages if needed
  const more =
    lines.length >= 500
      ? await mustList<Record<string, unknown>>("gl_journal_lines", {
          page: 2,
          pageSize: 500,
        })
      : [];
  const all = [...lines, ...more];

  const map = new Map<string, { debit: number; credit: number }>();
  for (const l of all) {
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
