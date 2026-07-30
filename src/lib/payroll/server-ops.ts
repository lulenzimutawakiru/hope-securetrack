/**
 * Server-only payroll operations using admin client + company scope.
 * Called from authenticated API routes — never import into client components.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import {
  calculateEmployeePay,
  buildBankCsv,
  nextPeriodLabel,
} from "./engine";
import type { PayrollCalcResult } from "./types";

function admin() {
  return createAdminClient();
}

function pad(n: number, w = 4) {
  return String(n).padStart(w, "0");
}

async function nextPayCode(companyId: string, table: string, prefix: string) {
  const { count } = await admin()
    .from(table)
    .select("*", { count: "exact", head: true })
    .eq("company_id", companyId);
  const y = new Date().getFullYear();
  return `${prefix}-${y}-${pad((count ?? 0) + 1)}`;
}

async function logPayAudit(input: {
  company_id: string;
  actor_id?: string | null;
  action: string;
  entity_type?: string;
  entity_id?: string;
  details?: string;
}) {
  await admin().from("pay_audit").insert({
    company_id: input.company_id,
    actor_id: input.actor_id,
    action: input.action,
    entity_type: input.entity_type,
    entity_id: input.entity_id,
    details: input.details,
  });
}

export async function serverProcessPayrollRun(input: {
  company_id: string;
  created_by?: string | null;
  country_code?: string;
  currency?: string;
  pay_group?: string;
  period?: { label: string; start: string; end: string };
}) {
  const sb = admin();
  const period = input.period || nextPeriodLabel();
  const run_number = await nextPayCode(input.company_id, "payroll_runs", "PAY");
  const country = input.country_code || "UG";

  const { data: run, error: runErr } = await sb
    .from("payroll_runs")
    .insert({
      company_id: input.company_id,
      run_number,
      period_label: period.label,
      period_start: period.start,
      period_end: period.end,
      pay_date: period.end,
      status: "draft",
      country_code: country,
      currency: input.currency || "UGX",
      pay_group: input.pay_group || "monthly",
      frequency: "monthly",
      payment_status: "unpaid",
      created_by: input.created_by,
    })
    .select("*")
    .single();
  if (runErr || !run) throw runErr || new Error("Failed to create run");

  const { data: profiles } = await sb
    .from("pay_employee_profiles")
    .select(
      "*, employees(id, first_name, last_name, employee_number, department, status, salary)"
    )
    .eq("company_id", input.company_id)
    .eq("is_active", true)
    .is("deleted_at", null);

  let list = (profiles || []) as Array<Record<string, unknown>>;
  if (list.length === 0) {
    const { data: emps } = await sb
      .from("employees")
      .select(
        "id, first_name, last_name, employee_number, department, status, salary, nssf_number, tin_number"
      )
      .eq("company_id", input.company_id)
      .eq("status", "active");
    list = (emps || []).map((e) => ({
      employee_id: e.id,
      basic_salary: e.salary,
      country_code: country,
      bank_account: null,
      employees: e,
    }));
  }

  const { data: otRows } = await sb
    .from("pay_overtime_claims")
    .select("employee_id, amount, hours, id")
    .eq("company_id", input.company_id)
    .eq("status", "approved")
    .is("payroll_run_id", null);

  const { data: activeLoans } = await sb
    .from("pay_loans")
    .select("id, employee_id, installment_amount, outstanding")
    .eq("company_id", input.company_id)
    .eq("status", "active")
    .gt("outstanding", 0);

  const { data: advances } = await sb
    .from("pay_advances")
    .select("id, employee_id, amount")
    .eq("company_id", input.company_id)
    .eq("status", "approved")
    .is("payroll_run_id", null);

  const { data: bonuses } = await sb
    .from("pay_bonuses")
    .select("id, employee_id, amount")
    .eq("company_id", input.company_id)
    .eq("status", "approved")
    .is("payroll_run_id", null);

  const { data: benefits } = await sb
    .from("pay_employee_benefits")
    .select("employee_id, employee_amount")
    .eq("company_id", input.company_id)
    .eq("status", "active");

  let grossT = 0;
  let dedT = 0;
  let netT = 0;
  let empCostT = 0;
  let cnt = 0;

  for (const p of list) {
    const emp = p.employees as Record<string, unknown> | undefined;
    const empId = String(p.employee_id || emp?.id || "");
    if (!empId) continue;
    if (emp && emp.status && emp.status !== "active") continue;

    const basic = Number(p.basic_salary ?? emp?.salary ?? 0);
    if (!basic) continue;

    const otForEmp = (otRows || []).filter((o) => o.employee_id === empId);
    const otAmount = otForEmp.reduce((s, o) => s + Number(o.amount || 0), 0);
    const otHours = otForEmp.reduce((s, o) => s + Number(o.hours || 0), 0);
    const loanAmt = (activeLoans || [])
      .filter((l) => l.employee_id === empId)
      .reduce(
        (s, l) =>
          s + Math.min(Number(l.installment_amount), Number(l.outstanding)),
        0
      );
    const advAmt = (advances || [])
      .filter((a) => a.employee_id === empId)
      .reduce((s, a) => s + Number(a.amount || 0), 0);
    const bonusAmt = (bonuses || [])
      .filter((b) => b.employee_id === empId)
      .reduce((s, b) => s + Number(b.amount || 0), 0);
    const insAmt = (benefits || [])
      .filter((b) => b.employee_id === empId)
      .reduce((s, b) => s + Number(b.employee_amount || 0), 0);

    const calc = calculateEmployeePay(
      {
        employee_id: empId,
        basic_salary: basic,
        housing: Math.round(basic * 0.15),
        transport: 100000,
        medical: 50000,
        communication: 30000,
        overtime: otAmount,
        bonuses: bonusAmt,
        loan_deduction: loanAmt,
        advance_deduction: advAmt,
        insurance_deduction: insAmt,
        ot_hours: otHours,
        bank_account: p.bank_account as string | null,
        country_code: String(p.country_code || country),
        tax_exempt: Boolean(p.tax_exempt),
      },
      { country: String(p.country_code || country) }
    );

    const payslip_number = `PSL-${run.run_number}-${pad(cnt + 1)}`;

    await sb.from("payroll_lines").insert({
      payroll_run_id: run.id,
      company_id: input.company_id,
      employee_id: empId,
      basic_salary: calc.basic_salary,
      housing: calc.housing,
      transport: calc.transport,
      medical: calc.medical,
      communication: calc.communication,
      allowances: calc.allowances,
      overtime: calc.overtime,
      bonuses: calc.bonuses,
      commission: calc.commission,
      incentives: calc.incentives,
      gross_pay: calc.gross_pay,
      taxable_pay: calc.taxable_pay,
      paye: calc.paye,
      nssf_employee: calc.nssf_employee,
      nssf_employer: calc.nssf_employer,
      lst: calc.lst,
      loan_deduction: calc.loan_deduction,
      advance_deduction: calc.advance_deduction,
      insurance_deduction: calc.insurance_deduction,
      other_deductions: calc.other_deductions,
      net_pay: calc.net_pay,
      days_worked: calc.days_worked,
      unpaid_days: calc.unpaid_days,
      ot_hours: calc.ot_hours,
      component_json: calc.component_json,
      bank_account: p.bank_account,
      payment_method: p.payment_method || "bank_transfer",
      payslip_number,
      status: "calculated",
    });

    grossT += calc.gross_pay;
    dedT += calc.deductions_total;
    netT += calc.net_pay;
    empCostT += calc.employer_cost;
    cnt += 1;
  }

  await sb
    .from("payroll_runs")
    .update({
      employee_count: cnt,
      gross_total: grossT,
      deductions_total: dedT,
      net_total: netT,
      employer_cost: empCostT,
      status: "processing",
    })
    .eq("id", run.id);

  for (const stage of [
    "payroll_officer",
    "hr_manager",
    "finance_manager",
    "director",
    "payment_release",
  ]) {
    await sb.from("pay_approvals").insert({
      company_id: input.company_id,
      payroll_run_id: run.id,
      stage,
      status: "pending",
    });
  }

  await logPayAudit({
    company_id: input.company_id,
    actor_id: input.created_by,
    action: "process_run_server",
    entity_type: "payroll_run",
    entity_id: run.id,
    details: `${run_number} · ${cnt} employees · net ${netT}`,
  });

  return {
    id: run.id as string,
    run_number,
    employee_count: cnt,
    gross_total: grossT,
    deductions_total: dedT,
    net_total: netT,
    employer_cost: empCostT,
    status: "processing",
  };
}

export async function serverGenerateBankFile(input: {
  company_id: string;
  payroll_run_id: string;
  bank_name?: string;
  created_by?: string | null;
}) {
  const sb = admin();

  const { data: run } = await sb
    .from("payroll_runs")
    .select("id,status,company_id,payment_status")
    .eq("id", input.payroll_run_id)
    .eq("company_id", input.company_id)
    .maybeSingle();

  if (!run) throw new Error("Payroll run not found");
  if (!["approved", "processing", "paid"].includes(String(run.status))) {
    // Allow bank file after approval preferred; processing for pilot
    if (run.status !== "approved" && process.env.NODE_ENV === "production") {
      throw new Error("Payroll run must be approved before bank file generation");
    }
  }

  const { data: lines } = await sb
    .from("payroll_lines")
    .select("*, employees(first_name, last_name, employee_number)")
    .eq("payroll_run_id", input.payroll_run_id)
    .eq("company_id", input.company_id);

  const rows = (lines || []).map((l) => {
    const emp = l.employees as {
      first_name?: string;
      last_name?: string;
      employee_number?: string;
    } | null;
    return {
      employee_name: emp
        ? `${emp.first_name || ""} ${emp.last_name || ""}`.trim()
        : "Employee",
      employee_number: emp?.employee_number,
      bank_account: l.bank_account as string | null,
      net_pay: Number(l.net_pay || 0),
    };
  });

  const csv = buildBankCsv(rows);
  const total = rows.reduce((s, r) => s + r.net_pay, 0);
  const batch_number = await nextPayCode(
    input.company_id,
    "pay_payment_batches",
    "PB"
  );

  const { data, error } = await sb
    .from("pay_payment_batches")
    .insert({
      company_id: input.company_id,
      batch_number,
      payroll_run_id: input.payroll_run_id,
      bank_name: input.bank_name || "Primary Payroll Bank",
      payment_date: new Date().toISOString().slice(0, 10),
      total_amount: total,
      employee_count: rows.length,
      status: "generated",
      file_content: csv,
      file_format: "csv",
      created_by: input.created_by,
    })
    .select("id,batch_number,total_amount,employee_count,status,file_format")
    .single();
  if (error) throw error;

  await sb
    .from("payroll_runs")
    .update({ payment_status: "batched" })
    .eq("id", input.payroll_run_id);

  await logPayAudit({
    company_id: input.company_id,
    actor_id: input.created_by,
    action: "bank_file_server",
    entity_type: "payroll_run",
    entity_id: input.payroll_run_id,
    details: batch_number,
  });

  return {
    batch: data,
    /** Full bank CSV for authenticated operator download */
    file_content: csv,
    csv_preview: csv.slice(0, 500),
  };
}

export async function serverReleasePayroll(input: {
  company_id: string;
  payroll_run_id: string;
  actor_id: string;
}) {
  const sb = admin();
  const { data: run } = await sb
    .from("payroll_runs")
    .select("*")
    .eq("id", input.payroll_run_id)
    .eq("company_id", input.company_id)
    .maybeSingle();
  if (!run) throw new Error("Payroll run not found");
  if (run.status !== "approved" && run.payment_status !== "batched") {
    throw new Error("Run must be approved (and preferably bank-batched) before release");
  }

  await sb
    .from("payroll_runs")
    .update({
      status: "paid",
      payment_status: "paid",
      paid_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.payroll_run_id);

  await sb
    .from("payroll_lines")
    .update({ status: "paid" })
    .eq("payroll_run_id", input.payroll_run_id);

  await logPayAudit({
    company_id: input.company_id,
    actor_id: input.actor_id,
    action: "release_server",
    entity_type: "payroll_run",
    entity_id: input.payroll_run_id,
  });

  return { id: input.payroll_run_id, status: "paid" };
}

export type { PayrollCalcResult };
