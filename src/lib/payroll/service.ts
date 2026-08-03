import { createClient } from "@/lib/supabase/client";
import {
  calculateEmployeePay,
  buildBankCsv,
  buildPayslipHtml,
  nextPeriodLabel,
  calcOvertimeAmount,
  estimateHourlyFromMonthly,
} from "./engine";
import type { PayrollCalcResult } from "./types";

function sb() {
  return createClient();
}

function pad(n: number, w = 4) {
  return String(n).padStart(w, "0");
}

export async function nextPayCode(companyId: string, table: string, prefix: string) {
  const { count } = await sb()
    .from(table)
    .select("*", { count: "exact", head: true })
    .eq("company_id", companyId);
  const y = new Date().getFullYear();
  return `${prefix}-${y}-${pad((count ?? 0) + 1)}`;
}

export async function logPayAudit(input: {
  company_id: string;
  actor_id?: string | null;
  action: string;
  entity_type?: string;
  entity_id?: string;
  details?: string;
}) {
  await sb().from("pay_audit").insert({
    company_id: input.company_id,
    actor_id: input.actor_id,
    action: input.action,
    entity_type: input.entity_type,
    entity_id: input.entity_id,
    details: input.details,
  });
}

export async function syncEmployeeProfile(input: {
  company_id: string;
  employee_id: string;
  basic_salary?: number;
  salary_grade?: string;
  bank_account?: string;
  bank_name?: string;
  tin_number?: string;
  nssf_number?: string;
  country_code?: string;
  payment_method?: string;
  cost_center?: string;
}) {
  const { data, error } = await sb()
    .from("pay_employee_profiles")
    .upsert(
      {
        company_id: input.company_id,
        employee_id: input.employee_id,
        basic_salary: input.basic_salary ?? 0,
        salary_grade: input.salary_grade,
        bank_account: input.bank_account,
        bank_name: input.bank_name,
        tin_number: input.tin_number,
        nssf_number: input.nssf_number,
        country_code: input.country_code || "UG",
        currency: "UGX",
        payment_method: input.payment_method || "bank_transfer",
        cost_center: input.cost_center,
        is_active: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "company_id,employee_id" }
    )
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function createOvertimeClaim(input: {
  company_id: string;
  employee_id: string;
  work_date: string;
  hours: number;
  ot_type?: string;
  basic_salary?: number;
  notes?: string;
  created_by?: string | null;
}) {
  const hourly = estimateHourlyFromMonthly(input.basic_salary || 0);
  const ot_type = input.ot_type || "weekday";
  const amount = calcOvertimeAmount(input.hours, hourly, ot_type);
  const claim_number = await nextPayCode(input.company_id, "pay_overtime_claims", "OT");
  const { data, error } = await sb()
    .from("pay_overtime_claims")
    .insert({
      company_id: input.company_id,
      claim_number,
      employee_id: input.employee_id,
      work_date: input.work_date,
      hours: input.hours,
      ot_type,
      rate_multiplier: ot_type === "weekend" || ot_type === "holiday" ? 2 : ot_type === "night" ? 1.75 : 1.5,
      hourly_rate: Math.round(hourly),
      amount,
      status: "pending",
      notes: input.notes,
      created_by: input.created_by,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function createLoan(input: {
  company_id: string;
  employee_id: string;
  loan_type?: string;
  principal: number;
  interest_rate_pct?: number;
  installments: number;
  notes?: string;
  created_by?: string | null;
}) {
  const interest = Math.round(input.principal * ((input.interest_rate_pct || 0) / 100));
  const total = input.principal + interest;
  const installments = Math.max(1, input.installments);
  const installment_amount = Math.round(total / installments);
  const loan_number = await nextPayCode(input.company_id, "pay_loans", "LN");

  const { data, error } = await sb()
    .from("pay_loans")
    .insert({
      company_id: input.company_id,
      loan_number,
      employee_id: input.employee_id,
      loan_type: input.loan_type || "salary_advance",
      principal: input.principal,
      interest_rate_pct: input.interest_rate_pct || 0,
      total_payable: total,
      installment_amount,
      installments,
      paid_installments: 0,
      outstanding: total,
      status: "pending",
      notes: input.notes,
      created_by: input.created_by,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function approveLoan(loanId: string, reviewerId: string) {
  const { data: loan, error } = await sb()
    .from("pay_loans")
    .select("*")
    .eq("id", loanId)
    .single();
  if (error || !loan) throw error || new Error("Loan not found");

  await sb()
    .from("pay_loans")
    .update({
      status: "active",
      approved_by: reviewerId,
      approved_at: new Date().toISOString(),
    })
    .eq("id", loanId);

  // Build schedule
  const start = new Date();
  for (let i = 1; i <= loan.installments; i++) {
    const due = new Date(start);
    due.setMonth(due.getMonth() + i);
    await sb().from("pay_loan_schedules").insert({
      company_id: loan.company_id,
      loan_id: loanId,
      installment_no: i,
      due_date: due.toISOString().slice(0, 10),
      amount: loan.installment_amount,
      status: "scheduled",
    });
  }
  return loan;
}

/**
 * Process full payroll run from active employee profiles.
 */
export async function processPayrollRun(input: {
  company_id: string;
  created_by?: string | null;
  country_code?: string;
  currency?: string;
  pay_group?: string;
  period?: { label: string; start: string; end: string };
}) {
  const period = input.period || nextPeriodLabel();
  const run_number = await nextPayCode(input.company_id, "payroll_runs", "PAY");
  const country = input.country_code || "UG";

  const { data: run, error: runErr } = await sb()
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

  // Load profiles + employees
  const { data: profiles } = await sb()
    .from("pay_employee_profiles")
    .select("*, employees(id, first_name, last_name, employee_number, department, status, salary)")
    .eq("company_id", input.company_id)
    .eq("is_active", true)
    .is("deleted_at", null);

  // Fallback: employees without profiles
  let list = (profiles || []) as Array<Record<string, unknown>>;
  if (list.length === 0) {
    const { data: emps } = await sb()
      .from("employees")
      .select("id, first_name, last_name, employee_number, department, status, salary, nssf_number, tin_number")
      .eq("status", "active");
    list = (emps || []).map((e) => ({
      employee_id: e.id,
      basic_salary: e.salary,
      country_code: country,
      bank_account: null,
      employees: e,
    }));
  }

  // Approved OT not yet paid
  const { data: otRows } = await sb()
    .from("pay_overtime_claims")
    .select("employee_id, amount, hours, id")
    .eq("company_id", input.company_id)
    .eq("status", "approved")
    .is("payroll_run_id", null);

  // Active loans installments
  const { data: activeLoans } = await sb()
    .from("pay_loans")
    .select("id, employee_id, installment_amount, outstanding")
    .eq("company_id", input.company_id)
    .eq("status", "active")
    .gt("outstanding", 0);

  // Approved advances not deducted
  const { data: advances } = await sb()
    .from("pay_advances")
    .select("id, employee_id, amount")
    .eq("company_id", input.company_id)
    .eq("status", "approved")
    .is("payroll_run_id", null);

  // Approved bonuses
  const { data: bonuses } = await sb()
    .from("pay_bonuses")
    .select("id, employee_id, amount")
    .eq("company_id", input.company_id)
    .eq("status", "approved")
    .is("payroll_run_id", null);

  // Benefits employee amounts
  const { data: benefits } = await sb()
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
      .reduce((s, l) => s + Math.min(Number(l.installment_amount), Number(l.outstanding)), 0);

    const advAmt = (advances || [])
      .filter((a) => a.employee_id === empId)
      .reduce((s, a) => s + Number(a.amount || 0), 0);

    const bonusAmt = (bonuses || [])
      .filter((b) => b.employee_id === empId)
      .reduce((s, b) => s + Number(b.amount || 0), 0);

    const insAmt = (benefits || [])
      .filter((b) => b.employee_id === empId)
      .reduce((s, b) => s + Number(b.employee_amount || 0), 0);

    // Structure-ish defaults: 20% housing of basic if no component rows — keep simple flat from profile
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

    await sb().from("payroll_lines").insert({
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

    // Mark OT/bonuses/advances as linked
    for (const o of otForEmp) {
      await sb()
        .from("pay_overtime_claims")
        .update({ payroll_run_id: run.id, status: "paid" })
        .eq("id", o.id);
    }
    for (const b of (bonuses || []).filter((x) => x.employee_id === empId)) {
      await sb()
        .from("pay_bonuses")
        .update({ payroll_run_id: run.id, status: "paid" })
        .eq("id", b.id);
    }
    for (const a of (advances || []).filter((x) => x.employee_id === empId)) {
      await sb()
        .from("pay_advances")
        .update({ payroll_run_id: run.id, status: "deducted" })
        .eq("id", a.id);
    }
    // Reduce loan outstanding
    for (const l of (activeLoans || []).filter((x) => x.employee_id === empId)) {
      const pay = Math.min(Number(l.installment_amount), Number(l.outstanding));
      const newOut = Number(l.outstanding) - pay;
      const { data: fullLoan } = await sb()
        .from("pay_loans")
        .select("paid_installments")
        .eq("id", l.id)
        .single();
      await sb()
        .from("pay_loans")
        .update({
          outstanding: newOut,
          paid_installments: Number(fullLoan?.paid_installments || 0) + 1,
          status: newOut <= 0 ? "completed" : "active",
        })
        .eq("id", l.id);
    }

    grossT += calc.gross_pay;
    dedT += calc.deductions_total;
    netT += calc.net_pay;
    empCostT += calc.employer_cost;
    cnt += 1;
  }

  await sb()
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

  // Seed approval chain
  for (const stage of [
    "payroll_officer",
    "hr_manager",
    "finance_manager",
    "director",
    "payment_release",
  ]) {
    await sb().from("pay_approvals").insert({
      company_id: input.company_id,
      payroll_run_id: run.id,
      stage,
      status: stage === "payroll_officer" ? "pending" : "pending",
    });
  }

  await logPayAudit({
    company_id: input.company_id,
    actor_id: input.created_by,
    action: "process_run",
    entity_type: "payroll_run",
    entity_id: run.id,
    details: `${run_number} · ${cnt} employees · net ${netT}`,
  });

  return { ...run, employee_count: cnt, gross_total: grossT, net_total: netT };
}

export async function advancePayrollApproval(input: {
  approval_id: string;
  company_id: string;
  approve: boolean;
  reviewer_id: string;
  comments?: string;
}) {
  const { data: appr } = await sb()
    .from("pay_approvals")
    .select("*")
    .eq("id", input.approval_id)
    .single();
  if (!appr) throw new Error("Approval not found");

  const status = input.approve ? "approved" : "rejected";
  await sb()
    .from("pay_approvals")
    .update({
      status,
      reviewer_id: input.reviewer_id,
      comments: input.comments,
      decided_at: new Date().toISOString(),
    })
    .eq("id", input.approval_id);

  if (!input.approve) {
    await sb()
      .from("payroll_runs")
      .update({ status: "cancelled" })
      .eq("id", appr.payroll_run_id);
    return { status: "rejected" };
  }

  // If all stages approved, mark run approved
  const { data: stages } = await sb()
    .from("pay_approvals")
    .select("status, stage")
    .eq("payroll_run_id", appr.payroll_run_id);

  const allApproved = (stages || []).every((s) => s.status === "approved");
  const directorDone = (stages || []).find(
    (s) => s.stage === "director" && s.status === "approved"
  );

  if (allApproved || directorDone) {
    await sb()
      .from("payroll_runs")
      .update({
        status: "approved",
        approved_by: input.reviewer_id,
        approved_at: new Date().toISOString(),
      })
      .eq("id", appr.payroll_run_id);
  }

  await logPayAudit({
    company_id: input.company_id,
    actor_id: input.reviewer_id,
    action: input.approve ? "approve" : "reject",
    entity_type: "payroll_run",
    entity_id: appr.payroll_run_id,
    details: appr.stage,
  });

  return { status, stage: appr.stage };
}

export async function generatePaymentBatch(input: {
  company_id: string;
  payroll_run_id: string;
  bank_name?: string;
  created_by?: string | null;
}) {
  const { data: lines } = await sb()
    .from("payroll_lines")
    .select("*, employees(first_name, last_name, employee_number)")
    .eq("payroll_run_id", input.payroll_run_id);

  const rows = (lines || []).map((l) => {
    const emp = l.employees as { first_name?: string; last_name?: string; employee_number?: string } | null;
    return {
      employee_name: emp ? `${emp.first_name || ""} ${emp.last_name || ""}`.trim() : "Employee",
      employee_number: emp?.employee_number,
      bank_account: l.bank_account as string | null,
      net_pay: Number(l.net_pay || 0),
    };
  });

  const csv = buildBankCsv(rows);
  const total = rows.reduce((s, r) => s + r.net_pay, 0);
  const batch_number = await nextPayCode(input.company_id, "pay_payment_batches", "PB");

  const { data, error } = await sb()
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
    .select("*")
    .single();
  if (error) throw error;

  await sb()
    .from("payroll_runs")
    .update({ payment_status: "batched" })
    .eq("id", input.payroll_run_id);

  return data;
}

export async function publishPayslips(input: {
  company_id: string;
  payroll_run_id: string;
  company_name?: string;
}) {
  const { data: run } = await sb()
    .from("payroll_runs")
    .select("*")
    .eq("id", input.payroll_run_id)
    .single();
  if (!run) throw new Error("Run not found");

  const { data: lines } = await sb()
    .from("payroll_lines")
    .select("*, employees(first_name, last_name, employee_number, department)")
    .eq("payroll_run_id", input.payroll_run_id);

  let count = 0;
  for (const l of lines || []) {
    const emp = l.employees as {
      first_name?: string;
      last_name?: string;
      employee_number?: string;
      department?: string;
    } | null;
    const calc: PayrollCalcResult = {
      basic_salary: Number(l.basic_salary),
      housing: Number(l.housing || 0),
      transport: Number(l.transport || 0),
      medical: Number(l.medical || 0),
      communication: Number(l.communication || 0),
      overtime: Number(l.overtime || 0),
      bonuses: Number(l.bonuses || 0),
      commission: Number(l.commission || 0),
      incentives: Number(l.incentives || 0),
      allowances: Number(l.allowances || 0),
      gross_pay: Number(l.gross_pay),
      taxable_pay: Number(l.taxable_pay || l.gross_pay),
      paye: Number(l.paye),
      nssf_employee: Number(l.nssf_employee),
      nssf_employer: Number(l.nssf_employer),
      pension_employee: 0,
      pension_employer: 0,
      lst: Number(l.lst || 0),
      loan_deduction: Number(l.loan_deduction || 0),
      advance_deduction: Number(l.advance_deduction || 0),
      insurance_deduction: Number(l.insurance_deduction || 0),
      other_deductions: Number(l.other_deductions || 0),
      deductions_total:
        Number(l.paye) +
        Number(l.nssf_employee) +
        Number(l.loan_deduction || 0) +
        Number(l.advance_deduction || 0) +
        Number(l.insurance_deduction || 0) +
        Number(l.other_deductions || 0),
      net_pay: Number(l.net_pay),
      employer_cost: Number(l.gross_pay) + Number(l.nssf_employer),
      days_worked: Number(l.days_worked || 0),
      unpaid_days: Number(l.unpaid_days || 0),
      ot_hours: Number(l.ot_hours || 0),
      component_json: (l.component_json as Record<string, number>) || {},
    };

    const payslip_number = String(l.payslip_number || `PSL-${l.id}`.slice(0, 20));
    const verification_code = `QR-PAY-${String(l.id).slice(0, 8).toUpperCase()}`;
    const html = buildPayslipHtml({
      companyName: input.company_name || "SecureTrack ERP",
      employeeName: emp
        ? `${emp.first_name || ""} ${emp.last_name || ""}`.trim()
        : "Employee",
      employeeNumber: emp?.employee_number || "",
      department: emp?.department,
      periodLabel: run.period_label,
      payslipNumber: payslip_number,
      verificationCode: verification_code,
      calc,
      currency: run.currency || "UGX",
    });

    await sb().from("pay_payslips").upsert(
      {
        company_id: input.company_id,
        payroll_line_id: l.id,
        payroll_run_id: input.payroll_run_id,
        employee_id: l.employee_id,
        payslip_number,
        period_label: run.period_label,
        html_body: html,
        verification_code,
        is_published: true,
      },
      { onConflict: "company_id,payslip_number" }
    );
    count += 1;
  }
  return { count };
}

export async function lockPayrollRun(runId: string, userId: string) {
  await sb()
    .from("payroll_runs")
    .update({
      locked_at: new Date().toISOString(),
      locked_by: userId,
      // keep status; lock is tracked via locked_at (enum-safe)
    })
    .eq("id", runId);
}

export async function unlockPayrollRun(runId: string) {
  await sb()
    .from("payroll_runs")
    .update({
      locked_at: null,
      locked_by: null,
      status: "approved",
    })
    .eq("id", runId);
}

export type PayrollDashboardStats = {
  runs: number;
  profiles: number;
  pendingApprovals: number;
  activeLoans: number;
  pendingOt: number;
  publishedPayslips: number;
  openPeriods: number;
  simulations: number;
  pendingCorrections: number;
  mobileMoneyPending: number;
  latestGross: number;
  latestNet: number;
  latestRunLabel: string | null;
  latestRunNumber: string | null;
  latestRunStatus: string | null;
  employeeCount: number;
};

export async function getPayrollDashboardStats(companyId: string): Promise<PayrollDashboardStats> {
  const client = sb();
  const [
    runs,
    profiles,
    pending,
    loans,
    ot,
    payslips,
    periods,
    sims,
    corrections,
    mm,
    { data: lastRun },
  ] = await Promise.all([
    client.from("payroll_runs").select("*", { count: "exact", head: true }).eq("company_id", companyId),
    client.from("pay_employee_profiles").select("*", { count: "exact", head: true }).eq("company_id", companyId).is("deleted_at", null),
    client.from("pay_approvals").select("*", { count: "exact", head: true }).eq("company_id", companyId).eq("status", "pending"),
    client.from("pay_loans").select("*", { count: "exact", head: true }).eq("company_id", companyId).eq("status", "active"),
    client.from("pay_overtime_claims").select("*", { count: "exact", head: true }).eq("company_id", companyId).eq("status", "pending"),
    client.from("pay_payslips").select("*", { count: "exact", head: true }).eq("company_id", companyId).eq("is_published", true),
    client.from("pay_periods").select("*", { count: "exact", head: true }).eq("company_id", companyId).eq("status", "open"),
    client.from("pay_simulations").select("*", { count: "exact", head: true }).eq("company_id", companyId).is("deleted_at", null),
    client.from("pay_corrections").select("*", { count: "exact", head: true }).eq("company_id", companyId).eq("status", "pending"),
    client.from("pay_mobile_money").select("*", { count: "exact", head: true }).eq("company_id", companyId).eq("status", "pending"),
    client.from("payroll_runs").select("period_label,run_number,status,gross_total,net_total,employee_count").eq("company_id", companyId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ]);

  return {
    runs: runs.count ?? 0,
    profiles: profiles.count ?? 0,
    pendingApprovals: pending.count ?? 0,
    activeLoans: loans.count ?? 0,
    pendingOt: ot.count ?? 0,
    publishedPayslips: payslips.count ?? 0,
    openPeriods: periods.count ?? 0,
    simulations: sims.count ?? 0,
    pendingCorrections: corrections.count ?? 0,
    mobileMoneyPending: mm.count ?? 0,
    latestGross: Number(lastRun?.gross_total || 0),
    latestNet: Number(lastRun?.net_total || 0),
    latestRunLabel: lastRun?.period_label ? String(lastRun.period_label) : null,
    latestRunNumber: lastRun?.run_number ? String(lastRun.run_number) : null,
    latestRunStatus: lastRun?.status ? String(lastRun.status) : null,
    employeeCount: Number(lastRun?.employee_count || 0),
  };
}
