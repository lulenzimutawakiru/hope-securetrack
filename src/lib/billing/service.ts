/**
 * Billing service — numbering, create/approve invoice, payments, recurring run.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { formatBillNumber, sequenceCodeForType, createInvoiceQrId } from "./numbering";
import { computeInvoiceTotals, dueDateFromTerms } from "./tax";
import type { BillLineInput, InvoiceType } from "./types";

export async function nextBillNumber(
  supabase: SupabaseClient,
  companyId: string,
  sequenceCode: string,
  branchCode?: string | null
): Promise<string> {
  const { data: seq } = await supabase
    .from("bill_sequences")
    .select("*")
    .eq("company_id", companyId)
    .eq("sequence_code", sequenceCode)
    .maybeSingle();

  if (!seq) {
    const y = new Date().getFullYear();
    return `HDG-${sequenceCode}-${y}-${String(Date.now()).slice(-6)}`;
  }

  const number = formatBillNumber({
    prefix: seq.prefix,
    branch_code: branchCode || seq.branch_code,
    include_year: seq.include_year,
    include_month: seq.include_month,
    pad_length: seq.pad_length,
    next_value: seq.next_value,
    check_digit: seq.check_digit,
    separator: seq.separator,
  });

  await supabase
    .from("bill_sequences")
    .update({
      next_value: Number(seq.next_value) + 1,
      updated_at: new Date().toISOString(),
    })
    .eq("id", seq.id);

  return number;
}

export type CreateInvoiceInput = {
  company_id: string;
  customer_id?: string | null;
  sales_order_id?: string | null;
  invoice_type?: InvoiceType | string;
  currency?: string;
  invoice_date?: string;
  payment_terms_days?: number;
  payment_terms_label?: string;
  po_number?: string;
  reference?: string;
  notes?: string;
  bank_details?: string;
  terms_conditions?: string;
  billing_address?: string;
  delivery_address?: string;
  customer_tax_id?: string;
  customer_vat_number?: string;
  shipping_amount?: number;
  withholding_rate?: number;
  branch_code?: string;
  source_type?: string;
  source_ref?: string;
  template_id?: string | null;
  lines: BillLineInput[];
  created_by?: string | null;
  status?: string;
};

export async function createInvoice(
  supabase: SupabaseClient,
  input: CreateInvoiceInput
) {
  const type = input.invoice_type || "tax";
  const seqCode = sequenceCodeForType(type);
  const invoice_number = await nextBillNumber(
    supabase,
    input.company_id,
    seqCode,
    input.branch_code
  );

  const { data: taxCodes } = await supabase
    .from("bill_tax_codes")
    .select("tax_code,name,tax_type,rate")
    .eq("company_id", input.company_id)
    .eq("is_active", true);

  const totals = computeInvoiceTotals(input.lines, {
    shipping_amount: input.shipping_amount,
    withholding_rate: input.withholding_rate,
    taxCodes: taxCodes || undefined,
  });

  const invoice_date =
    input.invoice_date || new Date().toISOString().slice(0, 10);
  const termsDays = input.payment_terms_days ?? 30;
  const due_date = dueDateFromTerms(invoice_date, termsDays);

  // Load template defaults if needed
  let bank_details = input.bank_details;
  let terms_conditions = input.terms_conditions;
  let template_id = input.template_id || null;
  if (!bank_details || !terms_conditions) {
    const { data: tpl } = await supabase
      .from("bill_invoice_templates")
      .select("*")
      .eq("company_id", input.company_id)
      .eq("is_default", true)
      .maybeSingle();
    if (tpl) {
      bank_details = bank_details || tpl.default_bank_details;
      terms_conditions = terms_conditions || tpl.default_terms;
      template_id = template_id || tpl.id;
    }
  }

  const header = {
    company_id: input.company_id,
    invoice_number,
    customer_id: input.customer_id || null,
    sales_order_id: input.sales_order_id || null,
    invoice_type: type,
    status: (input.status || "draft") as string,
    invoice_date,
    due_date,
    currency: input.currency || "UGX",
    subtotal: totals.subtotal,
    tax_amount: totals.tax_amount,
    discount_amount: totals.discount_amount,
    total_amount: totals.total_amount,
    amount_paid: 0,
    balance_due: totals.total_amount,
    withholding_tax: totals.withholding_tax,
    shipping_amount: totals.shipping_amount,
    tax_breakdown: totals.tax_breakdown,
    payment_terms_days: termsDays,
    payment_terms_label:
      input.payment_terms_label ||
      (termsDays === 0 ? "Due on receipt" : `Net ${termsDays}`),
    po_number: input.po_number || null,
    reference: input.reference || null,
    notes: input.notes || null,
    bank_details: bank_details || null,
    terms_conditions: terms_conditions || null,
    billing_address: input.billing_address || null,
    delivery_address: input.delivery_address || null,
    customer_tax_id: input.customer_tax_id || null,
    customer_vat_number: input.customer_vat_number || null,
    branch_code: input.branch_code || null,
    source_type: input.source_type || "manual",
    source_ref: input.source_ref || null,
    template_id,
    qr_public_id: createInvoiceQrId(),
    base_currency: "UGX",
    base_total: totals.total_amount,
    issued_by: input.created_by || null,
  };

  const { data: inv, error } = await supabase
    .from("invoices")
    .insert(header)
    .select()
    .single();
  if (error) throw error;

  if (totals.lines.length) {
    const lineRows = totals.lines.map((l, i) => ({
      invoice_id: inv.id,
      product_id: l.product_id || null,
      description: l.description,
      quantity: Math.round(l.quantity) || 1,
      unit: l.unit || "ea",
      unit_price: l.unit_price,
      tax_rate: l.tax_rate ?? 0,
      discount_pct: l.discount_pct || 0,
      discount_amount: l.discount_amount,
      tax_code: l.tax_code || null,
      tax_amount: l.tax_amount,
      line_type: l.line_type || "product",
      sort_order: i,
    }));
    const { error: lErr } = await supabase.from("invoice_lines").insert(lineRows);
    if (lErr) throw lErr;
  }

  return inv;
}

export async function createInvoiceFromSalesOrder(
  supabase: SupabaseClient,
  companyId: string,
  orderId: string,
  userId?: string | null
) {
  const { data: order, error } = await supabase
    .from("sales_orders")
    .select("*, customers(*), sales_order_lines(*)")
    .eq("id", orderId)
    .single();
  if (error || !order) throw error || new Error("Sales order not found");

  const lines: BillLineInput[] = (order.sales_order_lines || []).map(
    (l: {
      description: string | null;
      quantity: number;
      unit: string | null;
      unit_price: number;
      tax_rate: number;
      product_id: string | null;
    }) => ({
      description: l.description || "Line item",
      quantity: l.quantity,
      unit: l.unit || "ea",
      unit_price: Number(l.unit_price),
      tax_rate: Number(l.tax_rate ?? 18),
      product_id: l.product_id,
    })
  );

  const cust = order.customers as {
    billing_address?: string;
    shipping_address?: string;
    tax_id?: string;
    vat_number?: string;
    payment_terms_days?: number;
    currency?: string;
  } | null;

  return createInvoice(supabase, {
    company_id: companyId,
    customer_id: order.customer_id,
    sales_order_id: order.id,
    invoice_type: "tax",
    currency: order.currency || cust?.currency || "UGX",
    payment_terms_days: cust?.payment_terms_days ?? 30,
    billing_address: cust?.billing_address,
    delivery_address: cust?.shipping_address,
    customer_tax_id: cust?.tax_id,
    customer_vat_number: cust?.vat_number,
    source_type: "sales_order",
    source_ref: order.order_number,
    notes: order.notes,
    lines: lines.length
      ? lines
      : [
          {
            description: `Sales order ${order.order_number}`,
            quantity: 1,
            unit_price: Number(order.total_amount || 0),
            tax_rate: 0,
          },
        ],
    created_by: userId,
    status: "draft",
  });
}

export async function approveInvoice(
  supabase: SupabaseClient,
  invoiceId: string,
  userId?: string | null
) {
  const { data, error } = await supabase
    .from("invoices")
    .update({
      status: "issued",
      approved_by: userId || null,
      approved_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", invoiceId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function recordPayment(
  supabase: SupabaseClient,
  input: {
    company_id: string;
    invoice_id: string;
    amount: number;
    method: string;
    reference?: string;
    payment_date?: string;
    gateway?: string;
    mobile_money_msisdn?: string;
    recorded_by?: string | null;
    notes?: string;
    cheque_number?: string;
    cheque_bank?: string;
    cheque_date?: string;
    pos_terminal_id?: string;
    pos_batch?: string;
    wallet_provider?: string;
    wallet_txn_id?: string;
    bank_name?: string;
    bank_account_last4?: string;
  }
) {
  const { data: inv, error: iErr } = await supabase
    .from("invoices")
    .select("*")
    .eq("id", input.invoice_id)
    .single();
  if (iErr || !inv) throw iErr || new Error("Invoice not found");

  const amount = Number(input.amount);
  if (amount <= 0) throw new Error("Payment amount must be positive");

  const receipt_number = await nextBillNumber(
    supabase,
    input.company_id,
    "RCP"
  );

  const priorPaid = Number(inv.amount_paid || 0);
  const total = Number(inv.total_amount || 0);
  const newPaid = priorPaid + amount;
  const balance = Math.max(0, total - newPaid);

  const { data: pay, error } = await supabase
    .from("invoice_payments")
    .insert({
      invoice_id: input.invoice_id,
      company_id: input.company_id,
      amount,
      paid_amount: amount,
      outstanding_after: balance,
      payment_date: input.payment_date || new Date().toISOString().slice(0, 10),
      method: input.method,
      reference: input.reference || null,
      notes: input.notes || null,
      recorded_by: input.recorded_by || null,
      currency: inv.currency || "UGX",
      gateway: input.gateway || input.method,
      status: "completed",
      receipt_number,
      allocated_amount: amount,
      unallocated_amount: 0,
      mobile_money_msisdn: input.mobile_money_msisdn || null,
      cheque_number: input.cheque_number || null,
      cheque_bank: input.cheque_bank || null,
      cheque_date: input.cheque_date || null,
      pos_terminal_id: input.pos_terminal_id || null,
      pos_batch: input.pos_batch || null,
      wallet_provider: input.wallet_provider || null,
      wallet_txn_id: input.wallet_txn_id || null,
      bank_name: input.bank_name || null,
      bank_account_last4: input.bank_account_last4 || null,
    })
    .select()
    .single();
  if (error) throw error;

  const status =
    newPaid >= total - 0.01
      ? "paid"
      : newPaid > 0
        ? "partially_paid"
        : inv.status;

  await supabase
    .from("invoices")
    .update({
      amount_paid: newPaid,
      balance_due: balance,
      status,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.invoice_id);

  // Mirror AR receipt if table exists
  try {
    await supabase.from("ar_receipts").insert({
      company_id: input.company_id,
      receipt_number,
      customer_id: inv.customer_id,
      invoice_id: inv.id,
      receipt_date: input.payment_date || new Date().toISOString().slice(0, 10),
      amount,
      currency: inv.currency || "UGX",
      payment_method: input.method,
      reference: input.reference || null,
      created_by: input.recorded_by || null,
    });
  } catch {
    /* optional */
  }

  // Auto communication: payment received
  try {
    await supabase.from("bill_communications").insert({
      company_id: input.company_id,
      invoice_id: inv.id,
      customer_id: inv.customer_id,
      channel: "email",
      event_type: "payment_received",
      recipient: "customer",
      subject: `Payment received — ${inv.invoice_number}`,
      body: `Payment of ${amount} recorded. Receipt ${receipt_number}. Outstanding ${balance}.`,
      status: "sent",
      sent_at: new Date().toISOString(),
    });
  } catch {
    /* optional until migration */
  }

  return pay;
}

export async function runRecurringSchedule(
  supabase: SupabaseClient,
  scheduleId: string,
  userId?: string | null
) {
  const { data: sch, error } = await supabase
    .from("bill_recurring_schedules")
    .select("*")
    .eq("id", scheduleId)
    .single();
  if (error || !sch) throw error || new Error("Schedule not found");
  if (sch.status !== "active") throw new Error("Schedule is not active");

  const lines = (sch.lines_json || []) as BillLineInput[];
  if (!lines.length) throw new Error("Schedule has no lines");

  const inv = await createInvoice(supabase, {
    company_id: sch.company_id,
    customer_id: sch.customer_id,
    invoice_type: "recurring",
    currency: sch.currency || "UGX",
    payment_terms_days: sch.payment_terms_days ?? 14,
    source_type: "subscription",
    source_ref: sch.schedule_number,
    notes: `Recurring: ${sch.name}`,
    template_id: sch.template_id,
    lines: lines.map((l) => ({
      ...l,
      tax_code: l.tax_code || sch.tax_code || "VAT18",
    })),
    created_by: userId,
    status: sch.auto_approve ? "issued" : "draft",
  });

  // advance next run
  const next = new Date(sch.next_run_date || sch.start_date);
  const interval = sch.interval_count || 1;
  switch (sch.frequency) {
    case "daily":
      next.setDate(next.getDate() + interval);
      break;
    case "weekly":
      next.setDate(next.getDate() + 7 * interval);
      break;
    case "quarterly":
      next.setMonth(next.getMonth() + 3 * interval);
      break;
    case "yearly":
      next.setFullYear(next.getFullYear() + interval);
      break;
    default:
      next.setMonth(next.getMonth() + interval);
  }

  await supabase
    .from("bill_recurring_schedules")
    .update({
      last_run_date: new Date().toISOString().slice(0, 10),
      next_run_date: next.toISOString().slice(0, 10),
      invoices_generated: (sch.invoices_generated || 0) + 1,
      updated_at: new Date().toISOString(),
      status:
        sch.end_date && next > new Date(sch.end_date)
          ? "completed"
          : sch.status,
    })
    .eq("id", scheduleId);

  return inv;
}

export function agingBucket(dueDate: string | null, status: string): string {
  if (["paid", "void", "cancelled"].includes(status)) return "paid";
  if (!dueDate) return "current";
  const due = new Date(dueDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.floor(
    (today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24)
  );
  if (diff <= 0) return "current";
  if (diff <= 30) return "1-30";
  if (diff <= 60) return "31-60";
  if (diff <= 90) return "61-90";
  return "90+";
}

/** Duplicate invoice as new draft with new number */
export async function duplicateInvoice(
  supabase: SupabaseClient,
  invoiceId: string,
  userId?: string | null
) {
  const { data: inv, error } = await supabase
    .from("invoices")
    .select("*")
    .eq("id", invoiceId)
    .single();
  if (error || !inv) throw error || new Error("Invoice not found");

  const { data: lines } = await supabase
    .from("invoice_lines")
    .select("*")
    .eq("invoice_id", invoiceId)
    .order("sort_order");

  return createInvoice(supabase, {
    company_id: inv.company_id,
    customer_id: inv.customer_id,
    sales_order_id: inv.sales_order_id,
    invoice_type: inv.invoice_type || "tax",
    currency: inv.currency || "UGX",
    payment_terms_days: inv.payment_terms_days ?? 30,
    payment_terms_label: inv.payment_terms_label || undefined,
    po_number: inv.po_number || undefined,
    notes: inv.notes ? `Copy of ${inv.invoice_number}. ${inv.notes}` : `Copy of ${inv.invoice_number}`,
    bank_details: inv.bank_details || undefined,
    terms_conditions: inv.terms_conditions || undefined,
    billing_address: inv.billing_address || undefined,
    delivery_address: inv.delivery_address || undefined,
    customer_tax_id: inv.customer_tax_id || undefined,
    customer_vat_number: inv.customer_vat_number || undefined,
    shipping_amount: Number(inv.shipping_amount || 0),
    branch_code: inv.branch_code || undefined,
    source_type: "manual",
    source_ref: inv.invoice_number,
    template_id: inv.template_id,
    lines: (lines || []).map((l) => ({
      description: l.description || "Line",
      quantity: Number(l.quantity),
      unit: l.unit || "ea",
      unit_price: Number(l.unit_price),
      tax_rate: Number(l.tax_rate ?? 18),
      tax_code: l.tax_code || undefined,
      discount_pct: Number(l.discount_pct || 0),
      product_id: l.product_id,
      line_type: l.line_type || "product",
    })),
    created_by: userId,
    status: "draft",
  });
}

/** Cancel draft / issued unpaid invoice */
export async function cancelInvoice(
  supabase: SupabaseClient,
  invoiceId: string,
  reason?: string
) {
  const { data: inv } = await supabase
    .from("invoices")
    .select("status,amount_paid")
    .eq("id", invoiceId)
    .single();
  if (!inv) throw new Error("Invoice not found");
  if (Number(inv.amount_paid) > 0) {
    throw new Error("Cannot cancel invoice with payments — reverse or credit note instead");
  }
  const { data, error } = await supabase
    .from("invoices")
    .update({
      status: "cancelled",
      void_reason: reason || "Cancelled",
      voided_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", invoiceId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

/**
 * Reverse an issued/paid invoice by creating a credit note for full amount
 * and marking original as cancelled when unpaid, or leaving paid + credit applied.
 */
export async function reverseInvoice(
  supabase: SupabaseClient,
  invoiceId: string,
  userId?: string | null
) {
  const { data: inv, error } = await supabase
    .from("invoices")
    .select("*")
    .eq("id", invoiceId)
    .single();
  if (error || !inv) throw error || new Error("Invoice not found");
  if (["void", "cancelled"].includes(inv.status)) {
    throw new Error("Invoice already void/cancelled");
  }

  const { data: lines } = await supabase
    .from("invoice_lines")
    .select("*")
    .eq("invoice_id", invoiceId);

  const credit = await createInvoice(supabase, {
    company_id: inv.company_id,
    customer_id: inv.customer_id,
    invoice_type: "credit_note",
    currency: inv.currency || "UGX",
    payment_terms_days: 0,
    payment_terms_label: "Immediate",
    notes: `Reversal of ${inv.invoice_number}`,
    source_type: "manual",
    source_ref: inv.invoice_number,
    lines: (lines || []).map((l) => ({
      description: `REV: ${l.description || "Line"}`,
      quantity: Number(l.quantity),
      unit: l.unit || "ea",
      unit_price: Number(l.unit_price),
      tax_rate: Number(l.tax_rate ?? 0),
      tax_code: l.tax_code || undefined,
      discount_pct: Number(l.discount_pct || 0),
      product_id: l.product_id,
    })),
    created_by: userId,
    status: "issued",
  });

  await supabase
    .from("invoices")
    .update({
      related_invoice_id: inv.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", credit.id);

  // Link reverse on original
  await supabase
    .from("invoices")
    .update({
      related_invoice_id: credit.id,
      notes: `${inv.notes || ""}\nReversed by ${credit.invoice_number}`.trim(),
      updated_at: new Date().toISOString(),
      ...(Number(inv.amount_paid) === 0
        ? {
            status: "cancelled",
            voided_at: new Date().toISOString(),
            void_reason: `Reversed by ${credit.invoice_number}`,
          }
        : {}),
    })
    .eq("id", inv.id);

  // Also register bill_credit_notes if table exists
  try {
    const crn = await nextBillNumber(supabase, inv.company_id, "CRN");
    await supabase.from("bill_credit_notes").insert({
      company_id: inv.company_id,
      credit_note_number: crn,
      customer_id: inv.customer_id,
      invoice_id: inv.id,
      reason_code: "error",
      reason: `Reversal of ${inv.invoice_number}`,
      currency: inv.currency || "UGX",
      subtotal: inv.subtotal,
      tax_amount: inv.tax_amount,
      total_amount: inv.total_amount,
      status: "issued",
      created_by: userId || null,
    });
  } catch {
    /* optional */
  }

  return credit;
}

export async function bulkApproveInvoices(
  supabase: SupabaseClient,
  invoiceIds: string[],
  userId?: string | null
) {
  const results = [];
  for (const id of invoiceIds) {
    results.push(await approveInvoice(supabase, id, userId));
  }
  return results;
}

export async function emailInvoiceNotice(
  supabase: SupabaseClient,
  input: {
    company_id: string;
    invoice_id: string;
    recipient?: string;
    customer_id?: string | null;
    invoice_number: string;
    total?: number;
    currency?: string;
    due_date?: string | null;
  }
) {
  const { data, error } = await supabase
    .from("bill_communications")
    .insert({
      company_id: input.company_id,
      invoice_id: input.invoice_id,
      customer_id: input.customer_id || null,
      channel: "email",
      event_type: "invoice_created",
      recipient: input.recipient || "customer",
      subject: `Invoice ${input.invoice_number} from Hope Design Group`,
      body: `Invoice ${input.invoice_number} for ${input.total ?? ""} ${input.currency || "UGX"} is ready. Due: ${input.due_date || "see invoice"}.`,
      status: "sent",
      sent_at: new Date().toISOString(),
    })
    .select()
    .single();
  if (error) throw error;

  await supabase
    .from("invoices")
    .update({
      sent_at: new Date().toISOString(),
      sent_via: "email",
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.invoice_id);

  return data;
}
