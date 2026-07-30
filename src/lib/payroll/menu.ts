/** Enterprise Payroll & Compensation navigation */

export const PAY_MENU = [
  { title: "Executive Dashboard", href: "/dashboard/payroll", group: "Overview" },
  { title: "Payroll Workspace", href: "/dashboard/payroll/workspace", group: "Overview" },
  { title: "AI Payroll Assistant", href: "/dashboard/payroll/ai", group: "Overview" },

  { title: "Payroll Calendars", href: "/dashboard/payroll/calendars", group: "Calendar & Periods" },
  { title: "Payroll Periods", href: "/dashboard/payroll/periods", group: "Calendar & Periods" },

  { title: "Payroll Runs", href: "/dashboard/payroll/runs", group: "Processing" },
  { title: "Simulations", href: "/dashboard/payroll/simulations", group: "Processing" },
  { title: "Corrections & Retro", href: "/dashboard/payroll/corrections", group: "Processing" },
  { title: "Final Settlements", href: "/dashboard/payroll/settlements", group: "Processing" },
  { title: "Approvals", href: "/dashboard/payroll/approvals", group: "Processing" },

  { title: "Employee Profiles", href: "/dashboard/payroll/profiles", group: "Compensation" },
  { title: "Salary Structures", href: "/dashboard/payroll/structures", group: "Compensation" },
  { title: "Salary Grades", href: "/dashboard/payroll/grades", group: "Compensation" },
  { title: "Salary Bands", href: "/dashboard/payroll/bands", group: "Compensation" },
  { title: "Salary Scales", href: "/dashboard/payroll/scales", group: "Compensation" },
  { title: "Payroll Groups", href: "/dashboard/payroll/groups", group: "Compensation" },
  { title: "Pay Components", href: "/dashboard/payroll/components", group: "Compensation" },

  { title: "Formula Engine", href: "/dashboard/payroll/formulas", group: "Rules" },
  { title: "Tax & Statutory", href: "/dashboard/payroll/tax", group: "Rules" },
  { title: "Pension Schemes", href: "/dashboard/payroll/pension", group: "Rules" },
  { title: "Gratuity Rules", href: "/dashboard/payroll/gratuity", group: "Rules" },
  { title: "Shift Premiums", href: "/dashboard/payroll/shift-premiums", group: "Rules" },

  { title: "Overtime", href: "/dashboard/payroll/overtime", group: "Earnings & Deductions" },
  { title: "Bonuses", href: "/dashboard/payroll/bonuses", group: "Earnings & Deductions" },
  { title: "Commissions", href: "/dashboard/payroll/commissions", group: "Earnings & Deductions" },
  { title: "Incentives", href: "/dashboard/payroll/incentives", group: "Earnings & Deductions" },
  { title: "Loans", href: "/dashboard/payroll/loans", group: "Earnings & Deductions" },
  { title: "Salary Advances", href: "/dashboard/payroll/advances", group: "Earnings & Deductions" },
  { title: "Benefits", href: "/dashboard/payroll/benefits", group: "Earnings & Deductions" },

  { title: "Cost Allocations", href: "/dashboard/payroll/cost-allocations", group: "Costing & Accounting" },
  { title: "GL Mappings", href: "/dashboard/payroll/gl-mappings", group: "Costing & Accounting" },
  { title: "Bank Files", href: "/dashboard/payroll/bank-files", group: "Payments" },
  { title: "Bank Payments", href: "/dashboard/payroll/payments", group: "Payments" },
  { title: "Mobile Money", href: "/dashboard/payroll/mobile-money", group: "Payments" },
  { title: "Payslips", href: "/dashboard/payroll/payslips", group: "Payments" },

  { title: "Employee Self-Service", href: "/dashboard/payroll/self-service", group: "Self-Service" },
  { title: "Documents", href: "/dashboard/payroll/documents", group: "Compliance" },
  { title: "Analytics", href: "/dashboard/payroll/analytics", group: "Intelligence" },
  { title: "Settings", href: "/dashboard/payroll/settings", group: "System" },
  { title: "Audit Logs", href: "/dashboard/payroll/audit", group: "System" },

  { title: "HR Module", href: "/dashboard/hr", group: "Integrations" },
  { title: "Attendance", href: "/dashboard/attendance", group: "Integrations" },
  { title: "Talent Acquisition", href: "/dashboard/talent", group: "Integrations" },
  { title: "Finance", href: "/dashboard/finance", group: "Integrations" },
  { title: "Manufacturing", href: "/dashboard/manufacturing", group: "Integrations" },
] as const;
