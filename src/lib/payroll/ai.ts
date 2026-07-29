/** AI Payroll Assistant */

export interface PayrollAiInsight {
  type: "error" | "anomaly" | "cost" | "compliance" | "faq";
  severity: "info" | "low" | "medium" | "high";
  title: string;
  detail: string;
  actions: string[];
}

export function generatePayrollInsights(params: {
  employeeCount?: number;
  grossTotal?: number;
  netTotal?: number;
  pendingApprovals?: number;
  openLoans?: number;
  pendingOt?: number;
  avgNet?: number;
  maxNet?: number;
  zeroPayCount?: number;
}): PayrollAiInsight[] {
  const insights: PayrollAiInsight[] = [];

  if ((params.pendingApprovals || 0) > 0) {
    insights.push({
      type: "compliance",
      severity: "medium",
      title: `${params.pendingApprovals} payroll approval(s) pending`,
      detail: "Complete Payroll Officer → HR → Finance → Director → Payment Release stages.",
      actions: ["Open Approvals", "Notify reviewers"],
    });
  }

  if ((params.pendingOt || 0) > 0) {
    insights.push({
      type: "cost",
      severity: "low",
      title: `${params.pendingOt} overtime claim(s) awaiting approval`,
      detail: "Unapproved OT will not be included in the next payroll run.",
      actions: ["Review OT claims"],
    });
  }

  if ((params.zeroPayCount || 0) > 0) {
    insights.push({
      type: "error",
      severity: "high",
      title: `${params.zeroPayCount} employee(s) with zero net pay`,
      detail: "Check missing basic salary, excessive deductions, or inactive profiles.",
      actions: ["Open employee profiles", "Re-run calculation"],
    });
  }

  if (params.maxNet && params.avgNet && params.maxNet > params.avgNet * 4) {
    insights.push({
      type: "anomaly",
      severity: "medium",
      title: "Unusual salary variance detected",
      detail: `Highest net (${Math.round(params.maxNet).toLocaleString()}) is >4× average. Verify bonuses and grades.`,
      actions: ["Review top earners", "Audit last run"],
    });
  }

  if ((params.openLoans || 0) > 0) {
    insights.push({
      type: "cost",
      severity: "info",
      title: `${params.openLoans} active loan(s)`,
      detail: "Ensure installment schedules are linked for automatic deduction.",
      actions: ["Open Loans"],
    });
  }

  if ((params.grossTotal || 0) > 0) {
    const er = Math.round((params.grossTotal || 0) * 0.1);
    insights.push({
      type: "cost",
      severity: "info",
      title: "Employer cost forecast (NSSF 10%)",
      detail: `Estimated employer NSSF this period ≈ UGX ${er.toLocaleString()} on gross UGX ${Math.round(params.grossTotal || 0).toLocaleString()}.`,
      actions: ["Open Analytics", "Export GL draft"],
    });
  }

  insights.push({
    type: "faq",
    severity: "info",
    title: "Payslip FAQ ready",
    detail: "Employees can view published payslips in self-service. PAYE is progressive; NSSF employee is 5% of gross (UG).",
    actions: ["Open ESS Portal", "Publish payslips"],
  });

  return insights;
}

export function detectDuplicateRisk(
  lines: Array<{ employee_id: string; net_pay: number }>
): string[] {
  const seen = new Map<string, number>();
  const risks: string[] = [];
  for (const l of lines) {
    const n = (seen.get(l.employee_id) || 0) + 1;
    seen.set(l.employee_id, n);
    if (n > 1) risks.push(`Duplicate line for employee ${l.employee_id}`);
  }
  return risks;
}

export function answerPayrollFaq(question: string): string {
  const q = question.toLowerCase();
  if (q.includes("paye") || q.includes("tax")) {
    return "PAYE is calculated on progressive monthly brackets after NSSF employee contribution (Uganda). Configure brackets under Tax Management.";
  }
  if (q.includes("nssf")) {
    return "Uganda NSSF: employee 5% and employer 10% of gross (configurable). Employer portion is not deducted from net pay.";
  }
  if (q.includes("payslip")) {
    return "After payroll approval and publish, employees access payslips in Payroll Self-Service with verification codes.";
  }
  if (q.includes("advance") || q.includes("loan")) {
    return "Apply for advances under Loans & Advances. Approved installments auto-deduct on the next payroll run.";
  }
  if (q.includes("overtime") || q.includes("ot")) {
    return "Submit OT claims with type (weekday 1.5×, weekend/holiday 2×). Approved claims enter the next run.";
  }
  return "Ask about PAYE, NSSF, payslips, loans, overtime, or approval stages. Use the Payroll hub modules for processing.";
}
