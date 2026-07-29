import { createClient } from "@/lib/supabase/client";
import { finNextNumber, finAudit } from "./crud";

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

/**
 * Event-driven accounting engine: maps ERP events → posting rules → auto journal trail.
 * Creates fin_auto_journals and optionally a balanced gl_journals header when COA codes exist.
 */
export async function postAccountingEvent(input: PostEventInput) {
  const sb = createClient();
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

  const autoNumber = await finNextNumber(
    "fin_auto_journals",
    input.companyId,
    "AJ",
    "auto_number"
  );

  let glJournalId: string | null = null;
  let status = "posted";
  let errorMessage: string | null = null;

  if (rule?.auto_post && rule.debit_account_code && rule.credit_account_code) {
    try {
      const journalNumber = await finNextNumber(
        "gl_journals",
        input.companyId,
        "JE",
        "journal_number"
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

      // Resolve account IDs if present
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

  await finAudit({
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

export async function listPostingRules(companyId: string) {
  const { data, error } = await createClient()
    .from("fin_posting_rules")
    .select("*")
    .eq("company_id", companyId)
    .is("deleted_at", null)
    .order("event_type");
  if (error) throw error;
  return data || [];
}

export async function listAutoJournals(companyId: string, limit = 100) {
  const { data, error } = await createClient()
    .from("fin_auto_journals")
    .select("*")
    .eq("company_id", companyId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
}
