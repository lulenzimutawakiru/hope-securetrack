/**
 * AI Finance Assistant — late payment risk, duplicates, collections, fraud, forecast.
 */

export type CustomerAccountSummary = {
  customer_name: string;
  outstanding: number;
  overdue_count: number;
  paid_count: number;
  avg_days_to_pay: number | null;
  late_payment_risk: number;
  collection_actions: string[];
  fraud_flags: string[];
};

export function predictLatePaymentRisk(input: {
  days_overdue_history: number[];
  outstanding: number;
  credit_limit: number;
  open_invoices: number;
  risk_score?: number;
}): number {
  let score = Number(input.risk_score ?? 40);
  const avgOverdue =
    input.days_overdue_history.length > 0
      ? input.days_overdue_history.reduce((a, b) => a + b, 0) /
        input.days_overdue_history.length
      : 0;
  if (avgOverdue > 30) score += 25;
  else if (avgOverdue > 7) score += 12;
  if (input.credit_limit > 0 && input.outstanding / input.credit_limit > 0.9)
    score += 20;
  if (input.open_invoices >= 5) score += 10;
  return Math.min(99, Math.max(1, Math.round(score)));
}

export function recommendCollections(input: {
  late_payment_risk: number;
  days_overdue: number;
  balance: number;
}): string[] {
  const actions: string[] = [];
  if (input.days_overdue <= 0) {
    actions.push("Send friendly reminder 3 days before due date");
    return actions;
  }
  if (input.days_overdue <= 7) {
    actions.push("Email payment reminder with portal payment link");
    actions.push("Offer MoMo / bank transfer options");
  } else if (input.days_overdue <= 30) {
    actions.push("Phone follow-up by collections");
    actions.push("Escalate to account manager");
    if (input.balance > 1_000_000) actions.push("Propose payment plan (2–3 installments)");
  } else if (input.days_overdue <= 60) {
    actions.push("Formal overdue notice + credit hold warning");
    actions.push("Require finance manager review");
  } else {
    actions.push("Place account on credit hold");
    actions.push("Legal / debt recovery review");
    actions.push("Stop new sales orders until settled");
  }
  if (input.late_payment_risk >= 70) {
    actions.push("Flag high late-payment risk on CRM account");
  }
  return actions;
}

export function detectDuplicateInvoices(
  invoices: Array<{
    id: string;
    customer_id: string | null;
    total_amount: number;
    invoice_date: string;
    invoice_number: string;
  }>
): Array<{ a: string; b: string; reason: string }> {
  const dups: Array<{ a: string; b: string; reason: string }> = [];
  for (let i = 0; i < invoices.length; i++) {
    for (let j = i + 1; j < invoices.length; j++) {
      const x = invoices[i];
      const y = invoices[j];
      if (
        x.customer_id &&
        x.customer_id === y.customer_id &&
        Number(x.total_amount) === Number(y.total_amount) &&
        x.invoice_date === y.invoice_date
      ) {
        dups.push({
          a: x.invoice_number,
          b: y.invoice_number,
          reason: "Same customer, date, and amount",
        });
      }
    }
  }
  return dups;
}

export function forecastRevenue(
  monthlyTotals: number[],
  monthsAhead = 3
): number[] {
  if (!monthlyTotals.length) return Array(monthsAhead).fill(0);
  const n = monthlyTotals.length;
  const avg =
    monthlyTotals.reduce((a, b) => a + b, 0) / n;
  // simple trend: last vs first half
  const mid = Math.floor(n / 2) || 1;
  const first = monthlyTotals.slice(0, mid);
  const last = monthlyTotals.slice(mid);
  const avgFirst = first.reduce((a, b) => a + b, 0) / (first.length || 1);
  const avgLast = last.reduce((a, b) => a + b, 0) / (last.length || 1);
  const growth = avgFirst === 0 ? 0 : (avgLast - avgFirst) / avgFirst;
  const out: number[] = [];
  let base = monthlyTotals[n - 1] ?? avg;
  for (let i = 0; i < monthsAhead; i++) {
    base = base * (1 + growth * 0.5);
    out.push(Math.round(base));
  }
  return out;
}

export function summarizeCustomerAccount(input: {
  customer_name: string;
  invoices: Array<{
    status: string;
    total_amount: number;
    amount_paid: number;
    due_date: string | null;
  }>;
  credit_limit: number;
  risk_score?: number;
}): CustomerAccountSummary {
  const open = input.invoices.filter(
    (i) => !["paid", "void", "cancelled"].includes(i.status)
  );
  const outstanding = open.reduce(
    (s, i) => s + Number(i.total_amount) - Number(i.amount_paid || 0),
    0
  );
  const today = new Date();
  const overdue = open.filter(
    (i) => i.due_date && new Date(i.due_date) < today
  );
  const paid = input.invoices.filter((i) => i.status === "paid");
  const maxOverdueDays = overdue.reduce((m, i) => {
    if (!i.due_date) return m;
    const d = Math.floor(
      (today.getTime() - new Date(i.due_date).getTime()) / 86400000
    );
    return Math.max(m, d);
  }, 0);

  const late_payment_risk = predictLatePaymentRisk({
    days_overdue_history: overdue.map((i) => {
      if (!i.due_date) return 0;
      return Math.floor(
        (today.getTime() - new Date(i.due_date).getTime()) / 86400000
      );
    }),
    outstanding,
    credit_limit: input.credit_limit,
    open_invoices: open.length,
    risk_score: input.risk_score,
  });

  const fraud_flags: string[] = [];
  if (open.length >= 8) fraud_flags.push("Unusually high open invoice count");
  if (
    input.credit_limit > 0 &&
    outstanding > input.credit_limit * 1.2
  )
    fraud_flags.push("Outstanding exceeds credit limit by >20%");

  return {
    customer_name: input.customer_name,
    outstanding,
    overdue_count: overdue.length,
    paid_count: paid.length,
    avg_days_to_pay: null,
    late_payment_risk,
    collection_actions: recommendCollections({
      late_payment_risk,
      days_overdue: maxOverdueDays,
      balance: outstanding,
    }),
    fraud_flags,
  };
}
