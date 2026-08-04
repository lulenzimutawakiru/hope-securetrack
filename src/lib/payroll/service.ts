/**
 * Payroll domain service — all I/O via /api/v2/crud (no browser Supabase client).
 * Heavy processing (processPayrollRun) still runs client-side but mutations are server-scoped.
 */

import {
  calculateEmployeePay,
  buildBankCsv,
  buildPayslipHtml,
  nextPeriodLabel,
  calcOvertimeAmount,
  estimateHourlyFromMonthly,
} from "./engine";
import type { PayrollCalcResult } from "./types";
import {
  crudCount,
  crudGetOne,
  mustCreate,
  mustList,
  mustUpdate,
} from "@/lib/crud/domain-helpers";

function pad(n: number, w = 4) {
  return String(n).padStart(w, "0");
}

const ENTITY_BY_TABLE: Record<string, string> = {
  pay_overtime_claims: "pay_overtime_claims",
  pay_loans: "pay_loans",
  payroll_runs: "payroll_runs",
  pay_payment_batches: "pay_payment_batches",
  pay_advances: "pay_advances",
  pay_bonuses: "pay_bonuses",
};

export async function nextPayCode(
  companyId: string,
  table: string,
  prefix: string
) {
  void companyId;
  const entity = ENTITY_BY_TABLE[table] || table;
  const count = await crudCount(entity);
  const y = new Date().getFullYear();
  return `${prefix}-${y}-${pad(count + 1)}`;
}

export async function logPayAudit(input: {
  company_id: string;
  actor_id?: string | null;
  action: string;
  entity_type?: string;
  entity_id?: string;
  details?: string;
}) {
  try {
    await mustCreate("pay_audit", {
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
  const existing = await mustList<Record<string, unknown>>(
    "pay_employee_profiles",
    {
      pageSize: 1,
      filters: { employee_id: input.employee_id },
    }
  );
  const body = {
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
  };
  if (existing[0]?.id) {
    return mustUpdate("pay_employee_profiles", String(existing[0].id), body);
  }
  return mustCreate("pay_employee_profiles", body);
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
  const claim_number = await nextPayCode(
    input.company_id,
    "pay_overtime_claims",
    "OT"
  );
  return mustCreate("pay_overtime_claims", {
    claim_number,
    employee_id: input.employee_id,
    work_date: input.work_date,
    hours: input.hours,
    ot_type,
    rate_multiplier:
      ot_type === "weekend" || ot_type === "holiday"
        ? 2
        : ot_type === "night"
          ? 1.75
          : 1.5,
    hourly_rate: Math.round(hourly),
    amount,
    status: "pending",
    notes: input.notes,
  });
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
  const interest = Math.round(
    input.principal * ((input.interest_rate_pct || 0) / 100)
  );
  const total = input.principal + interest;
  const installments = Math.max(1, input.installments);
  const installment_amount = Math.round(total / installments);
  const loan_number = await nextPayCode(input.company_id, "pay_loans", "LN");

  return mustCreate("pay_loans", {
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
  });
}

export async function approveLoan(loanId: string, reviewerId: string) {
  const loan = await crudGetOne<Record<string, unknown>>("pay_loans", loanId);
  if (!loan) throw new Error("Loan not found");

  await mustUpdate("pay_loans", loanId, {
    status: "active",
    approved_by: reviewerId,
    approved_at: new Date().toISOString(),
  });

  const start = new Date();
  const n = Number(loan.installments || 0);
  for (let i = 1; i <= n; i++) {
    const due = new Date(start);
    due.setMonth(due.getMonth() + i);
    await mustCreate("pay_loan_schedules", {
      loan_id: loanId,
      installment_no: i,
      due_date: due.toISOString().slice(0, 10),
      amount: loan.installment_amount,
      status: "scheduled",
    });
  }
  return loan;
}

export async function processPayrollRun(input: {
  company_id: string;
  created_by?: string | null;
  country_code?: string;
  currency?: string;
  pay_group?: string;
  period?: { label: string; start: string; end: string };
}) {
  const period = input.period || nextPeriodLabel();
  const run_number = await nextPayCode(
    input.company_id,
    "payroll_runs",
    "PAY"
  );
  const country = input.country_code || "UG";

  const run = await mustCreate<Record<string, unknown>>("payroll_runs", {
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
  });

  let profiles = await mustList<Record<string, unknown>>(
    "pay_employee_profiles",
    {
      pageSize: 100,
      filters: { is_active: true },
    }
  );

  const employees = await mustList<Record<string, unknown>>("employees", {
    pageSize: 100,
    filters: { status: "active" },
  });
  const empById = new Map(employees.map((e) => [String(e.id), e]));

  if (!profiles.length) {
    profiles = employees.map((e) => ({
      employee_id: e.id,
      basic_salary: e.salary,
      country_code: country,
      bank_account: null,
      employees: e,
    }));
  } else {
    profiles = profiles.map((p) => ({
      ...p,
      employees: empById.get(String(p.employee_id)),
    }));
  }

  const [otRows, activeLoans, advances, bonuses, benefits] = await Promise.all([
    mustList<Record<string, unknown>>("pay_overtime_claims", {
      pageSize: 100,
      filters: { status: "approved" },
    }),
    mustList<Record<string, unknown>>("pay_loans", {
      pageSize: 100,
      filters: { status: "active" },
    }),
    mustList<Record<string, unknown>>("pay_advances", {
      pageSize: 100,
      filters: { status: "approved" },
    }),
    mustList<Record<string, unknown>>("pay_bonuses", {
      pageSize: 100,
      filters: { status: "approved" },
    }),
    mustList<Record<string, unknown>>("pay_employee_benefits", {
      pageSize: 100,
      filters: { status: "active" },
    }),
  ]);

  // Filter unlinked OT/advances/bonuses client-side (null payroll_run_id)
  const otOpen = otRows.filter((o) => !o.payroll_run_id);
  const advOpen = advances.filter((a) => !a.payroll_run_id);
  const bonusOpen = bonuses.filter((b) => !b.payroll_run_id);
  const loansOpen = activeLoans.filter((l) => Number(l.outstanding || 0) > 0);

  let grossT = 0;
  let dedT = 0;
  let netT = 0;
  let empCostT = 0;
  let cnt = 0;

  for (const p of profiles) {
    const emp = p.employees as Record<string, unknown> | undefined;
    const empId = String(p.employee_id || emp?.id || "");
    if (!empId) continue;
    if (emp && emp.status && emp.status !== "active") continue;

    const basic = Number(p.basic_salary ?? emp?.salary ?? 0);
    if (!basic) continue;

    const otForEmp = otOpen.filter((o) => o.employee_id === empId);
    const otAmount = otForEmp.reduce((s, o) => s + Number(o.amount || 0), 0);
    const otHours = otForEmp.reduce((s, o) => s + Number(o.hours || 0), 0);

    const loanAmt = loansOpen
      .filter((l) => l.employee_id === empId)
      .reduce(
        (s, l) =>
          s +
          Math.min(Number(l.installment_amount), Number(l.outstanding)),
        0
      );

    const advAmt = advOpen
      .filter((a) => a.employee_id === empId)
      .reduce((s, a) => s + Number(a.amount || 0), 0);

    const bonusAmt = bonusOpen
      .filter((b) => b.employee_id === empId)
      .reduce((s, b) => s + Number(b.amount || 0), 0);

    const insAmt = benefits
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

    await mustCreate("payroll_lines", {
      payroll_run_id: run.id,
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

    for (const o of otForEmp) {
      await mustUpdate("pay_overtime_claims", String(o.id), {
        payroll_run_id: run.id,
        status: "paid",
      });
    }
    for (const b of bonusOpen.filter((x) => x.employee_id === empId)) {
      await mustUpdate("pay_bonuses", String(b.id), {
        payroll_run_id: run.id,
        status: "paid",
      });
    }
    for (const a of advOpen.filter((x) => x.employee_id === empId)) {
      await mustUpdate("pay_advances", String(a.id), {
        payroll_run_id: run.id,
        status: "deducted",
      });
    }
    for (const l of loansOpen.filter((x) => x.employee_id === empId)) {
      const pay = Math.min(
        Number(l.installment_amount),
        Number(l.outstanding)
      );
      const newOut = Number(l.outstanding) - pay;
      await mustUpdate("pay_loans", String(l.id), {
        outstanding: newOut,
        paid_installments: Number(l.paid_installments || 0) + 1,
        status: newOut <= 0 ? "completed" : "active",
      });
    }

    grossT += calc.gross_pay;
    dedT += calc.deductions_total;
    netT += calc.net_pay;
    empCostT += calc.employer_cost;
    cnt += 1;
  }

  await mustUpdate("payroll_runs", String(run.id), {
    employee_count: cnt,
    gross_total: grossT,
    deductions_total: dedT,
    net_total: netT,
    employer_cost: empCostT,
    status: "processing",
  });

  for (const stage of [
    "payroll_officer",
    "hr_manager",
    "finance_manager",
    "director",
    "payment_release",
  ]) {
    await mustCreate("pay_approvals", {
      payroll_run_id: run.id,
      stage,
      status: "pending",
    });
  }

  await logPayAudit({
    company_id: input.company_id,
    actor_id: input.created_by,
    action: "process_run",
    entity_type: "payroll_run",
    entity_id: String(run.id),
    details: `${run_number} · ${cnt} employees · net ${netT}`,
  });

  return {
    ...run,
    employee_count: cnt,
    gross_total: grossT,
    net_total: netT,
  };
}

export async function advancePayrollApproval(input: {
  approval_id: string;
  company_id: string;
  approve: boolean;
  reviewer_id: string;
  comments?: string;
}) {
  const appr = await crudGetOne<Record<string, unknown>>(
    "pay_approvals",
    input.approval_id
  );
  if (!appr) throw new Error("Approval not found");

  const status = input.approve ? "approved" : "rejected";
  await mustUpdate("pay_approvals", input.approval_id, {
    status,
    reviewer_id: input.reviewer_id,
    comments: input.comments,
    decided_at: new Date().toISOString(),
  });

  if (!input.approve) {
    await mustUpdate("payroll_runs", String(appr.payroll_run_id), {
      status: "cancelled",
    });
    return { status: "rejected" };
  }

  const stages = await mustList<Record<string, unknown>>("pay_approvals", {
    pageSize: 20,
    filters: { payroll_run_id: appr.payroll_run_id },
  });

  const allApproved = stages.every((s) => s.status === "approved");
  const directorDone = stages.find(
    (s) => s.stage === "director" && s.status === "approved"
  );

  if (allApproved || directorDone) {
    await mustUpdate("payroll_runs", String(appr.payroll_run_id), {
      status: "approved",
      approved_by: input.reviewer_id,
      approved_at: new Date().toISOString(),
    });
  }

  await logPayAudit({
    company_id: input.company_id,
    actor_id: input.reviewer_id,
    action: input.approve ? "approve" : "reject",
    entity_type: "payroll_run",
    entity_id: String(appr.payroll_run_id),
    details: String(appr.stage),
  });

  return { status, stage: appr.stage };
}

export async function generatePaymentBatch(input: {
  company_id: string;
  payroll_run_id: string;
  bank_name?: string;
  created_by?: string | null;
}) {
  const lines = await mustList<Record<string, unknown>>("payroll_lines", {
    pageSize: 100,
    filters: { payroll_run_id: input.payroll_run_id },
  });
  const employees = await mustList<Record<string, unknown>>("employees", {
    pageSize: 100,
  });
  const empById = new Map(employees.map((e) => [String(e.id), e]));

  const rows = lines.map((l) => {
    const emp = empById.get(String(l.employee_id));
    return {
      employee_name: emp
        ? `${emp.first_name || ""} ${emp.last_name || ""}`.trim()
        : "Employee",
      employee_number: emp?.employee_number as string | undefined,
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

  const data = await mustCreate("pay_payment_batches", {
    batch_number,
    payroll_run_id: input.payroll_run_id,
    bank_name: input.bank_name || "Primary Payroll Bank",
    payment_date: new Date().toISOString().slice(0, 10),
    total_amount: total,
    employee_count: rows.length,
    status: "generated",
    file_content: csv,
    file_format: "csv",
  });

  await mustUpdate("payroll_runs", input.payroll_run_id, {
    payment_status: "batched",
  });

  return data;
}

export async function publishPayslips(input: {
  company_id: string;
  payroll_run_id: string;
  company_name?: string;
}) {
  const run = await crudGetOne<Record<string, unknown>>(
    "payroll_runs",
    input.payroll_run_id
  );
  if (!run) throw new Error("Run not found");

  const lines = await mustList<Record<string, unknown>>("payroll_lines", {
    pageSize: 100,
    filters: { payroll_run_id: input.payroll_run_id },
  });
  const employees = await mustList<Record<string, unknown>>("employees", {
    pageSize: 100,
  });
  const empById = new Map(employees.map((e) => [String(e.id), e]));

  let count = 0;
  for (const l of lines) {
    const emp = empById.get(String(l.employee_id));
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

    const payslip_number = String(
      l.payslip_number || `PSL-${l.id}`.slice(0, 20)
    );
    const verification_code = `QR-PAY-${String(l.id).slice(0, 8).toUpperCase()}`;
    const html = buildPayslipHtml({
      companyName: input.company_name || "SecureTrack ERP",
      employeeName: emp
        ? `${emp.first_name || ""} ${emp.last_name || ""}`.trim()
        : "Employee",
      employeeNumber: String(emp?.employee_number || ""),
      department: emp?.department as string | undefined,
      periodLabel: String(run.period_label),
      payslipNumber: payslip_number,
      verificationCode: verification_code,
      calc,
      currency: String(run.currency || "UGX"),
    });

    const existing = await mustList("pay_payslips", {
      pageSize: 1,
      filters: { payslip_number },
    });
    const body = {
      payroll_line_id: l.id,
      payroll_run_id: input.payroll_run_id,
      employee_id: l.employee_id,
      payslip_number,
      period_label: run.period_label,
      html_body: html,
      verification_code,
      is_published: true,
    };
    if (existing[0]?.id) {
      await mustUpdate("pay_payslips", String(existing[0].id), body);
    } else {
      await mustCreate("pay_payslips", body);
    }
    count += 1;
  }
  return { count };
}

export async function lockPayrollRun(runId: string, userId: string) {
  await mustUpdate("payroll_runs", runId, {
    locked_at: new Date().toISOString(),
    locked_by: userId,
  });
}

export async function unlockPayrollRun(runId: string) {
  await mustUpdate("payroll_runs", runId, {
    locked_at: null,
    locked_by: null,
    status: "approved",
  });
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

export async function getPayrollDashboardStats(
  companyId: string
): Promise<PayrollDashboardStats> {
  void companyId;
  const [
    runs,
    profiles,
    pendingApprovals,
    activeLoans,
    pendingOt,
    publishedPayslips,
    lastRuns,
    employeeCount,
  ] = await Promise.all([
    crudCount("payroll_runs"),
    crudCount("pay_employee_profiles"),
    crudCount("pay_approvals", { status: "pending" }),
    crudCount("pay_loans", { status: "active" }),
    crudCount("pay_overtime_claims", { status: "pending" }),
    crudCount("pay_payslips", { is_published: true }),
    mustList<Record<string, unknown>>("payroll_runs", {
      pageSize: 1,
      sort: "created_at",
      order: "desc",
    }),
    crudCount("employees", { status: "active" }),
  ]);

  const last = lastRuns[0];
  return {
    runs,
    profiles,
    pendingApprovals,
    activeLoans,
    pendingOt,
    publishedPayslips,
    openPeriods: 0,
    simulations: 0,
    pendingCorrections: 0,
    mobileMoneyPending: 0,
    latestGross: Number(last?.gross_total || 0),
    latestNet: Number(last?.net_total || 0),
    latestRunLabel: last?.period_label
      ? String(last.period_label)
      : null,
    latestRunNumber: last?.run_number ? String(last.run_number) : null,
    latestRunStatus: last?.status ? String(last.status) : null,
    employeeCount,
  };
}
