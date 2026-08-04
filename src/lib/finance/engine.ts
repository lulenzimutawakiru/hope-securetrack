/**
 * Event-driven accounting engine: maps ERP events → posting rules → auto journals.
 *
 * Prefer passing a server/admin Supabase client from API routes.
 * When no client is passed, all I/O goes through /api/v2/crud (session-scoped).
 * Never falls back to the browser Supabase client.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  crudCount,
  mustCreate,
  mustList,
} from "@/lib/crud/domain-helpers";

export type AccountingEventType =
  | "sales_invoice"
  | "customer_payment"
  | "purchase_invoice"
  | "goods_receipt"
  | "production_complete"
  | "material_issue"
  | "payroll_post"
  | "asset_purchase"
  | "asset_depreciation"
  | "dispatch"
  | "expense_claim";

export type PostEventInput = {
  companyId: string;
  eventType: AccountingEventType;
  sourceModule: string;
  sourceRef: string;
  amount: number;
  currency?: string;
  description?: string;
  actorId?: string | null;
  metadata?: Record<string, unknown>;
};

type PostingRule = {
  rule_code?: string;
  name?: string;
  auto_post?: boolean;
  debit_account_code?: string;
  credit_account_code?: string;
  tax_account_code?: string;
  accounting_basis?: string;
  ledger_book?: string;
};

async function nextCodeViaClient(
  sb: SupabaseClient,
  table: string,
  companyId: string,
  prefix: string
): Promise<string> {
  const year = new Date().getFullYear();
  const { count } = await sb
    .from(table)
    .select("*", { count: "exact", head: true })
    .eq("company_id", companyId);
  return `${prefix}-${year}-${String((count ?? 0) + 1).padStart(5, "0")}`;
}

async function nextCodeViaCrud(entity: string, prefix: string): Promise<string> {
  const year = new Date().getFullYear();
  const count = await crudCount(entity);
  return `${prefix}-${year}-${String(count + 1).padStart(5, "0")}`;
}

async function auditViaClient(
  sb: SupabaseClient,
  input: {
    company_id?: string | null;
    actor_id?: string | null;
    action: string;
    entity_table: string;
    entity_id?: string;
    entity_code?: string;
    details?: string;
  }
) {
  try {
    await sb.from("fin_audit_log").insert({
      company_id: input.company_id || null,
      actor_id: input.actor_id || null,
      action: input.action,
      entity_type: input.entity_table,
      entity_id: input.entity_id || null,
      details:
        [input.entity_code, input.details].filter(Boolean).join(" — ") || null,
    });
  } catch {
    /* non-blocking */
  }
}

async function auditViaCrud(input: {
  actor_id?: string | null;
  action: string;
  entity_table: string;
  entity_id?: string;
  entity_code?: string;
  details?: string;
}) {
  try {
    await mustCreate("fin_audit_log", {
      action: input.action,
      entity_type: input.entity_table,
      entity_id: input.entity_id || null,
      details:
        [input.entity_code, input.details].filter(Boolean).join(" — ") || null,
      actor_id: input.actor_id || null,
    });
  } catch {
    /* non-blocking */
  }
}

/**
 * Event-driven accounting engine: maps ERP events → posting rules → auto journal trail.
 * Pass a server/admin Supabase client from API routes; otherwise uses session CRUD API.
 */
export async function postAccountingEvent(
  input: PostEventInput,
  client?: SupabaseClient
) {
  if (client) {
    return postAccountingEventWithClient(input, client);
  }
  return postAccountingEventViaCrud(input);
}

async function postAccountingEventWithClient(
  input: PostEventInput,
  sb: SupabaseClient
) {
  const currency = input.currency || "UGX";

  const { data: rule } = await sb
    .from("fin_posting_rules")
    .select("*")
    .eq("company_id", input.companyId)
    .eq("event_type", input.eventType)
    .eq("is_active", true)
    .is("deleted_at", null)
    .limit(1)
    .maybeSingle();

  const autoNumber = await nextCodeViaClient(
    sb,
    "fin_auto_journals",
    input.companyId,
    "AJ"
  );

  let glJournalId: string | null = null;
  let status = "posted";
  let errorMessage: string | null = null;

  if (rule?.auto_post && rule.debit_account_code && rule.credit_account_code) {
    try {
      const journalNumber = await nextCodeViaClient(
        sb,
        "gl_journals",
        input.companyId,
        "JE"
      );
      const { data: journal, error: jErr } = await sb
        .from("gl_journals")
        .insert({
          company_id: input.companyId,
          journal_number: journalNumber,
          journal_type: "general",
          journal_date: new Date().toISOString().slice(0, 10),
          currency,
          description:
            input.description ||
            `${input.eventType} from ${input.sourceModule} ${input.sourceRef}`,
          reference: input.sourceRef,
          source_module: input.sourceModule,
          source_ref: input.sourceRef,
          status: "posted",
          total_debit: input.amount,
          total_credit: input.amount,
          posted_at: new Date().toISOString(),
          posted_by: input.actorId || null,
          created_by: input.actorId || null,
        })
        .select("id")
        .single();

      if (jErr) throw jErr;
      glJournalId = journal?.id || null;

      const [{ data: debitAcc }, { data: creditAcc }] = await Promise.all([
        sb
          .from("chart_of_accounts")
          .select("id")
          .eq("company_id", input.companyId)
          .eq("account_code", rule.debit_account_code)
          .maybeSingle(),
        sb
          .from("chart_of_accounts")
          .select("id")
          .eq("company_id", input.companyId)
          .eq("account_code", rule.credit_account_code)
          .maybeSingle(),
      ]);

      if (debitAcc?.id && creditAcc?.id && glJournalId) {
        await sb.from("gl_journal_lines").insert([
          {
            journal_id: glJournalId,
            company_id: input.companyId,
            line_number: 1,
            account_id: debitAcc.id,
            description: input.description || rule.name,
            debit: input.amount,
            credit: 0,
            currency,
            amount_base: input.amount,
          },
          {
            journal_id: glJournalId,
            company_id: input.companyId,
            line_number: 2,
            account_id: creditAcc.id,
            description: input.description || rule.name,
            debit: 0,
            credit: input.amount,
            currency,
            amount_base: input.amount,
          },
        ]);
      }
    } catch (e) {
      status = "failed";
      errorMessage = e instanceof Error ? e.message : "Posting failed";
    }
  } else if (!rule) {
    status = "draft";
    errorMessage = "No active posting rule for event";
  }

  const { data: autoRow, error } = await sb
    .from("fin_auto_journals")
    .insert({
      company_id: input.companyId,
      auto_number: autoNumber,
      event_type: input.eventType,
      source_module: input.sourceModule,
      source_ref: input.sourceRef,
      rule_code: rule?.rule_code || null,
      amount: input.amount,
      currency,
      status,
      gl_journal_id: glJournalId,
      payload: {
        description: input.description,
        metadata: input.metadata || {},
        rule: rule
          ? {
              debit: rule.debit_account_code,
              credit: rule.credit_account_code,
              tax: rule.tax_account_code,
              basis: rule.accounting_basis,
              book: rule.ledger_book,
            }
          : null,
      },
      error_message: errorMessage,
      created_by: input.actorId || null,
    })
    .select("*")
    .single();

  if (error) throw error;

  await auditViaClient(sb, {
    company_id: input.companyId,
    actor_id: input.actorId,
    action: "auto_post",
    entity_table: "fin_auto_journals",
    entity_id: autoRow.id,
    entity_code: autoNumber,
    details: `${input.eventType} ${status} ${input.amount}`,
  });

  return autoRow;
}

async function postAccountingEventViaCrud(input: PostEventInput) {
  const currency = input.currency || "UGX";

  const rules = await mustList<PostingRule & Record<string, unknown>>(
    "fin_posting_rules",
    {
      pageSize: 5,
      filters: { event_type: input.eventType, is_active: true },
    }
  );
  const rule = rules[0] || null;

  const autoNumber = await nextCodeViaCrud("fin_auto_journals", "AJ");

  let glJournalId: string | null = null;
  let status = "posted";
  let errorMessage: string | null = null;

  if (rule?.auto_post && rule.debit_account_code && rule.credit_account_code) {
    try {
      const journalNumber = await nextCodeViaCrud("gl_journals", "JE");
      const journal = await mustCreate<Record<string, unknown>>("gl_journals", {
        journal_number: journalNumber,
        journal_type: "general",
        journal_date: new Date().toISOString().slice(0, 10),
        currency,
        description:
          input.description ||
          `${input.eventType} from ${input.sourceModule} ${input.sourceRef}`,
        reference: input.sourceRef,
        source_module: input.sourceModule,
        source_ref: input.sourceRef,
        status: "posted",
        total_debit: input.amount,
        total_credit: input.amount,
        posted_at: new Date().toISOString(),
        posted_by: input.actorId || null,
      });
      glJournalId = journal.id ? String(journal.id) : null;

      const [debitAccs, creditAccs] = await Promise.all([
        mustList<Record<string, unknown>>("chart_of_accounts", {
          pageSize: 1,
          filters: { account_code: rule.debit_account_code },
        }),
        mustList<Record<string, unknown>>("chart_of_accounts", {
          pageSize: 1,
          filters: { account_code: rule.credit_account_code },
        }),
      ]);
      const debitAcc = debitAccs[0];
      const creditAcc = creditAccs[0];

      if (debitAcc?.id && creditAcc?.id && glJournalId) {
        await mustCreate("gl_journal_lines", {
          journal_id: glJournalId,
          line_number: 1,
          account_id: debitAcc.id,
          description: input.description || rule.name,
          debit: input.amount,
          credit: 0,
          currency,
          amount_base: input.amount,
        });
        await mustCreate("gl_journal_lines", {
          journal_id: glJournalId,
          line_number: 2,
          account_id: creditAcc.id,
          description: input.description || rule.name,
          debit: 0,
          credit: input.amount,
          currency,
          amount_base: input.amount,
        });
      }
    } catch (e) {
      status = "failed";
      errorMessage = e instanceof Error ? e.message : "Posting failed";
    }
  } else if (!rule) {
    status = "draft";
    errorMessage = "No active posting rule for event";
  }

  const autoRow = await mustCreate("fin_auto_journals", {
    auto_number: autoNumber,
    event_type: input.eventType,
    source_module: input.sourceModule,
    source_ref: input.sourceRef,
    rule_code: rule?.rule_code || null,
    amount: input.amount,
    currency,
    status,
    gl_journal_id: glJournalId,
    payload: {
      description: input.description,
      metadata: input.metadata || {},
      rule: rule
        ? {
            debit: rule.debit_account_code,
            credit: rule.credit_account_code,
            tax: rule.tax_account_code,
            basis: rule.accounting_basis,
            book: rule.ledger_book,
          }
        : null,
    },
    error_message: errorMessage,
  });

  await auditViaCrud({
    actor_id: input.actorId,
    action: "auto_post",
    entity_table: "fin_auto_journals",
    entity_id: String((autoRow as { id?: string }).id || ""),
    entity_code: autoNumber,
    details: `${input.eventType} ${status} ${input.amount}`,
  });

  return autoRow;
}

export async function listPostingRules(
  companyId: string,
  client?: SupabaseClient
) {
  void companyId;
  if (client) {
    const { data, error } = await client
      .from("fin_posting_rules")
      .select("*")
      .eq("company_id", companyId)
      .is("deleted_at", null)
      .order("event_type");
    if (error) throw error;
    return data || [];
  }
  return mustList("fin_posting_rules", {
    pageSize: 200,
    sort: "event_type",
    order: "asc",
  });
}

export async function listAutoJournals(
  companyId: string,
  limit = 100,
  client?: SupabaseClient
) {
  void companyId;
  if (client) {
    const { data, error } = await client
      .from("fin_auto_journals")
      .select("*")
      .eq("company_id", companyId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data || [];
  }
  return mustList("fin_auto_journals", {
    pageSize: limit,
    sort: "created_at",
    order: "desc",
  });
}
