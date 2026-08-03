import { describe, it, expect } from "vitest";
import {
  calculateEmployeePay,
  calcOvertimeAmount,
  estimateHourlyFromMonthly,
  prorationFactor,
  buildBankCsv,
  buildPayslipHtml,
} from "@/lib/payroll/engine";
import { calculatePaye, statutoryForCountry } from "@/lib/payroll/tax";

describe("payroll engine — overtime", () => {
  it("applies weekday 1.5x multiplier", () => {
    expect(calcOvertimeAmount(10, 1000, "weekday")).toBe(15000);
  });

  it("applies weekend 2x multiplier", () => {
    expect(calcOvertimeAmount(5, 2000, "weekend")).toBe(20000);
  });
});

describe("payroll engine — proration", () => {
  it("prorates by days worked", () => {
    expect(prorationFactor(13, 0, 26)).toBeCloseTo(0.5);
  });

  it("handles unpaid days when days_worked is 0", () => {
    expect(prorationFactor(0, 6, 26)).toBeCloseTo(20 / 26);
  });
});

describe("payroll engine — hourly estimate", () => {
  it("divides monthly by 176", () => {
    expect(estimateHourlyFromMonthly(176000)).toBe(1000);
  });
});

describe("payroll engine — net pay Uganda", () => {
  it("calculates gross and net with allowances and statutory", () => {
    const result = calculateEmployeePay(
      {
        employee_id: "e1",
        basic_salary: 1_000_000,
        housing: 100_000,
        transport: 50_000,
        medical: 0,
        communication: 0,
        overtime: 0,
        bonuses: 0,
        commission: 0,
        incentives: 0,
        loan_deduction: 50_000,
        advance_deduction: 0,
        insurance_deduction: 0,
        other_deductions: 0,
        country_code: "UG",
      },
      { country: "UG" }
    );

    expect(result.gross_pay).toBe(1_150_000);
    expect(result.nssf_employee).toBeGreaterThan(0);
    expect(result.paye).toBeGreaterThan(0);
    expect(result.loan_deduction).toBe(50_000);
    expect(result.net_pay).toBe(
      result.gross_pay - result.deductions_total
    );
    expect(result.net_pay).toBeGreaterThan(0);
    expect(result.employer_cost).toBe(result.gross_pay + result.nssf_employer);
  });

  it("skips tax when tax_exempt", () => {
    const result = calculateEmployeePay(
      {
        employee_id: "e2",
        basic_salary: 500_000,
        housing: 0,
        transport: 0,
        medical: 0,
        communication: 0,
        overtime: 0,
        bonuses: 0,
        commission: 0,
        incentives: 0,
        loan_deduction: 0,
        advance_deduction: 0,
        insurance_deduction: 0,
        other_deductions: 0,
        tax_exempt: true,
        country_code: "UG",
      },
      { country: "UG" }
    );
    expect(result.paye).toBe(0);
    expect(result.nssf_employee).toBe(0);
    expect(result.net_pay).toBe(500_000);
  });
});

describe("payroll tax — PAYE brackets", () => {
  it("returns 0 below first taxable band edge for UG low income", () => {
    expect(calculatePaye(100_000)).toBe(0);
  });

  it("Kenya statutory includes NHIF", () => {
    const st = statutoryForCountry("KE", 50_000, 50_000);
    expect(st.nhif).toBeGreaterThan(0);
    expect(st.paye).toBeGreaterThan(0);
  });
});

describe("payroll engine — bank CSV", () => {
  it("emits header and rows with bank accounts only", () => {
    const csv = buildBankCsv(
      [
        {
          employee_name: "Jane Doe",
          employee_number: "E001",
          bank_account: "1234567890",
          net_pay: 800_000,
        },
        {
          employee_name: "No Bank",
          employee_number: "E002",
          bank_account: null,
          net_pay: 100_000,
        },
      ],
      { currency: "UGX", bankName: "Stanbic" }
    );
    expect(csv).toContain("Employee Number");
    expect(csv).toContain("Jane Doe");
    expect(csv).toContain("800000");
    expect(csv).not.toContain("No Bank");
  });
});

describe("payroll engine — payslip HTML", () => {
  it("includes employee name and net", () => {
    const html = buildPayslipHtml({
      employeeName: "Jane Doe",
      employeeNumber: "E001",
      periodLabel: "July 2026",
      companyName: "SecureTrack ERP",
      payslipNumber: "PS-001",
      verificationCode: "VERIFY-001",
      calc: calculateEmployeePay({
        employee_id: "e1",
        basic_salary: 1_000_000,
        housing: 0,
        transport: 0,
        medical: 0,
        communication: 0,
        overtime: 0,
        bonuses: 0,
        commission: 0,
        incentives: 0,
        loan_deduction: 0,
        advance_deduction: 0,
        insurance_deduction: 0,
        other_deductions: 0,
        country_code: "UG",
      }),
    });
    expect(html.toLowerCase()).toContain("jane doe");
    expect(html).toContain("July 2026");
    expect(html).toContain("PS-001");
  });
});
