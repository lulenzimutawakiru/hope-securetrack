/** Enterprise Payroll types & constants */

export const PAYROLL_LIFECYCLE = [
  "Contract",
  "Profile",
  "Structure",
  "Benefits",
  "Tax Reg",
  "Attendance",
  "Leave",
  "Overtime",
  "Incentives",
  "Commissions",
  "Loans",
  "Tax Calc",
  "Simulate",
  "Validate",
  "Approve",
  "Bank/MM",
  "Payment",
  "GL Post",
  "Payslips",
  "Audit",
] as const;

export const PAY_FREQUENCIES = [
  { value: "monthly", label: "Monthly" },
  { value: "weekly", label: "Weekly" },
  { value: "biweekly", label: "Bi-weekly" },
  { value: "daily", label: "Daily" },
] as const;

export const OT_TYPES = [
  { value: "weekday", label: "Weekday", multiplier: 1.5 },
  { value: "weekend", label: "Weekend", multiplier: 2.0 },
  { value: "holiday", label: "Holiday", multiplier: 2.0 },
  { value: "night", label: "Night shift", multiplier: 1.75 },
] as const;

export const LOAN_TYPES = [
  { value: "salary_advance", label: "Salary Advance" },
  { value: "emergency", label: "Emergency Loan" },
  { value: "equipment", label: "Equipment Loan" },
  { value: "other", label: "Other" },
] as const;

export const BONUS_TYPES = [
  { value: "performance", label: "Performance" },
  { value: "production", label: "Production Incentive" },
  { value: "sales", label: "Sales Commission" },
  { value: "department", label: "Department Bonus" },
  { value: "holiday", label: "Holiday Bonus" },
  { value: "other", label: "Other" },
] as const;

export const APPROVAL_STAGES = [
  { value: "payroll_officer", label: "Payroll Officer" },
  { value: "hr_manager", label: "HR Manager" },
  { value: "finance_manager", label: "Finance Manager" },
  { value: "director", label: "Director" },
  { value: "payment_release", label: "Payment Release" },
] as const;

export const COUNTRIES = [
  { value: "UG", label: "Uganda", currency: "UGX" },
  { value: "KE", label: "Kenya", currency: "KES" },
  { value: "TZ", label: "Tanzania", currency: "TZS" },
  { value: "RW", label: "Rwanda", currency: "RWF" },
] as const;

export interface PayeBracket {
  min_amount: number;
  max_amount: number | null;
  rate_pct: number;
  fixed_amount: number;
}

export interface EmployeePayInput {
  employee_id: string;
  basic_salary: number;
  housing?: number;
  transport?: number;
  medical?: number;
  communication?: number;
  overtime?: number;
  bonuses?: number;
  commission?: number;
  incentives?: number;
  loan_deduction?: number;
  advance_deduction?: number;
  insurance_deduction?: number;
  other_deductions?: number;
  days_worked?: number;
  unpaid_days?: number;
  ot_hours?: number;
  bank_account?: string | null;
  tax_exempt?: boolean;
  country_code?: string;
}

export interface PayrollCalcResult {
  basic_salary: number;
  housing: number;
  transport: number;
  medical: number;
  communication: number;
  overtime: number;
  bonuses: number;
  commission: number;
  incentives: number;
  allowances: number;
  gross_pay: number;
  taxable_pay: number;
  paye: number;
  nssf_employee: number;
  nssf_employer: number;
  pension_employee: number;
  pension_employer: number;
  lst: number;
  loan_deduction: number;
  advance_deduction: number;
  insurance_deduction: number;
  other_deductions: number;
  deductions_total: number;
  net_pay: number;
  employer_cost: number;
  days_worked: number;
  unpaid_days: number;
  ot_hours: number;
  component_json: Record<string, number>;
}
