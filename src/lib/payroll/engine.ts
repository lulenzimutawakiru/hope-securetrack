/** Payroll processing engine */

import type { EmployeePayInput, PayrollCalcResult, PayeBracket } from "./types";
import { defaultBrackets, statutoryForCountry } from "./tax";
import { OT_TYPES } from "./types";

export function calcOvertimeAmount(
  hours: number,
  hourlyRate: number,
  otType: string
): number {
  const mult = OT_TYPES.find((t) => t.value === otType)?.multiplier ?? 1.5;
  return Math.round(hours * hourlyRate * mult);
}

export function estimateHourlyFromMonthly(basic: number, hoursPerMonth = 176): number {
  if (!basic || hoursPerMonth <= 0) return 0;
  return basic / hoursPerMonth;
}

export function prorationFactor(daysWorked: number, unpaidDays: number, periodDays = 26): number {
  const effective = Math.max(0, daysWorked > 0 ? daysWorked : periodDays - unpaidDays);
  return Math.min(1, effective / periodDays);
}

/**
 * Full employee net pay calculation for one period.
 */
export function calculateEmployeePay(
  input: EmployeePayInput,
  options?: {
    brackets?: PayeBracket[];
    country?: string;
    periodDays?: number;
  }
): PayrollCalcResult {
  const country = options?.country || input.country_code || "UG";
  const factor = prorationFactor(
    input.days_worked ?? 0,
    input.unpaid_days ?? 0,
    options?.periodDays ?? 26
  );

  const basic = Math.round((input.basic_salary || 0) * (input.days_worked || input.unpaid_days ? factor : 1));
  const housing = Math.round(input.housing || 0);
  const transport = Math.round(input.transport || 0);
  const medical = Math.round(input.medical || 0);
  const communication = Math.round(input.communication || 0);
  const overtime = Math.round(input.overtime || 0);
  const bonuses = Math.round(input.bonuses || 0);
  const commission = Math.round(input.commission || 0);
  const incentives = Math.round(input.incentives || 0);

  const allowances = housing + transport + medical + communication;
  const gross =
    basic + allowances + overtime + bonuses + commission + incentives;

  const loan = Math.round(input.loan_deduction || 0);
  const advance = Math.round(input.advance_deduction || 0);
  const insurance = Math.round(input.insurance_deduction || 0);
  const other = Math.round(input.other_deductions || 0);

  const taxable = input.tax_exempt ? 0 : gross;

  let paye = 0;
  let nssf_employee = 0;
  let nssf_employer = 0;
  let lst = 0;
  let extraStatutory = 0;

  if (!input.tax_exempt) {
    const st = statutoryForCountry(country, gross, taxable);
    paye = st.paye;
    nssf_employee = st.nssf_employee;
    nssf_employer = st.nssf_employer;
    lst = st.lst;
    extraStatutory = st.other_statutory;
  }

  const deductions_total =
    paye + nssf_employee + lst + loan + advance + insurance + other + extraStatutory;
  const net_pay = Math.max(0, gross - deductions_total);
  const employer_cost = gross + nssf_employer;

  return {
    basic_salary: basic,
    housing,
    transport,
    medical,
    communication,
    overtime,
    bonuses,
    commission,
    incentives,
    allowances,
    gross_pay: gross,
    taxable_pay: taxable,
    paye,
    nssf_employee,
    nssf_employer,
    pension_employee: 0,
    pension_employer: 0,
    lst,
    loan_deduction: loan,
    advance_deduction: advance,
    insurance_deduction: insurance,
    other_deductions: other + extraStatutory,
    deductions_total,
    net_pay,
    employer_cost,
    days_worked: input.days_worked || 0,
    unpaid_days: input.unpaid_days || 0,
    ot_hours: input.ot_hours || 0,
    component_json: {
      basic,
      housing,
      transport,
      medical,
      communication,
      overtime,
      bonuses,
      commission,
      paye,
      nssf_employee,
      nssf_employer,
      loan,
      advance,
      insurance,
      net_pay,
    },
  };
}

export function buildBankCsv(
  lines: Array<{
    employee_name: string;
    employee_number?: string;
    bank_account?: string | null;
    net_pay: number;
  }>,
  opts?: { bankName?: string; currency?: string }
): string {
  const header = "Employee Number,Employee Name,Bank Account,Amount,Currency,Narration";
  const rows = lines
    .filter((l) => l.net_pay > 0 && l.bank_account)
    .map(
      (l) =>
        `"${l.employee_number || ""}","${l.employee_name}","${l.bank_account}",${l.net_pay},"${opts?.currency || "UGX"}","Salary ${opts?.bankName || "payroll"}"`
    );
  return [header, ...rows].join("\n");
}

export function buildPayslipHtml(params: {
  companyName: string;
  employeeName: string;
  employeeNumber: string;
  department?: string;
  periodLabel: string;
  payslipNumber: string;
  verificationCode: string;
  calc: PayrollCalcResult;
  currency?: string;
}): string {
  const c = params.calc;
  const cur = params.currency || "UGX";
  const fmt = (n: number) =>
    `${cur} ${n.toLocaleString("en-UG", { maximumFractionDigits: 0 })}`;

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"/><title>Payslip ${params.payslipNumber}</title>
<style>
  body{font-family:Inter,system-ui,sans-serif;margin:24px;color:#1a1a1a;font-size:13px}
  h1{color:#0D7377;font-size:18px;margin:0}
  .meta{color:#555;font-size:11px;margin-bottom:16px}
  table{width:100%;border-collapse:collapse;margin-top:8px}
  th,td{border:1px solid #e5e5e5;padding:6px 8px;text-align:left}
  th{background:#0D737715}
  .right{text-align:right}
  .total{font-weight:700;background:#f8fafc}
  .footer{margin-top:20px;font-size:10px;color:#666;border-top:1px solid #ddd;padding-top:8px}
</style></head><body>
  <h1>${params.companyName}</h1>
  <div class="meta">PAYSLIP · ${params.periodLabel} · ${params.payslipNumber}<br/>
  Verify: ${params.verificationCode}</div>
  <p><strong>${params.employeeName}</strong> (${params.employeeNumber})<br/>
  ${params.department || ""}</p>
  <table>
    <tr><th>Earnings</th><th class="right">Amount</th></tr>
    <tr><td>Basic Salary</td><td class="right">${fmt(c.basic_salary)}</td></tr>
    <tr><td>Housing</td><td class="right">${fmt(c.housing)}</td></tr>
    <tr><td>Transport</td><td class="right">${fmt(c.transport)}</td></tr>
    <tr><td>Medical</td><td class="right">${fmt(c.medical)}</td></tr>
    <tr><td>Communication</td><td class="right">${fmt(c.communication)}</td></tr>
    <tr><td>Overtime</td><td class="right">${fmt(c.overtime)}</td></tr>
    <tr><td>Bonuses / Incentives</td><td class="right">${fmt(c.bonuses + c.incentives)}</td></tr>
    <tr><td>Commission</td><td class="right">${fmt(c.commission)}</td></tr>
    <tr class="total"><td>Gross Pay</td><td class="right">${fmt(c.gross_pay)}</td></tr>
  </table>
  <table>
    <tr><th>Deductions</th><th class="right">Amount</th></tr>
    <tr><td>PAYE</td><td class="right">${fmt(c.paye)}</td></tr>
    <tr><td>NSSF (Employee)</td><td class="right">${fmt(c.nssf_employee)}</td></tr>
    <tr><td>Loan / Advance</td><td class="right">${fmt(c.loan_deduction + c.advance_deduction)}</td></tr>
    <tr><td>Insurance / Other</td><td class="right">${fmt(c.insurance_deduction + c.other_deductions)}</td></tr>
    <tr class="total"><td>Total Deductions</td><td class="right">${fmt(c.deductions_total)}</td></tr>
  </table>
  <table>
    <tr class="total"><td>Net Pay</td><td class="right">${fmt(c.net_pay)}</td></tr>
    <tr><td>Employer NSSF</td><td class="right">${fmt(c.nssf_employer)}</td></tr>
    <tr><td>Total Employer Cost</td><td class="right">${fmt(c.employer_cost)}</td></tr>
  </table>
  <div class="footer">Confidential · Generated by Hope SecureTrack Payroll · Not a tax certificate</div>
</body></html>`;
}

export function nextPeriodLabel(d = new Date()): {
  label: string;
  start: string;
  end: string;
} {
  const y = d.getFullYear();
  const m = d.getMonth();
  const start = new Date(y, m, 1).toISOString().slice(0, 10);
  const end = new Date(y, m + 1, 0).toISOString().slice(0, 10);
  const label = d.toLocaleString("en-UG", { month: "long", year: "numeric" });
  return { label, start, end };
}
