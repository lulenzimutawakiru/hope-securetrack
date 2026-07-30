/** Enterprise Talent Acquisition navigation */

export const TA_MENU = [
  { title: "Talent Dashboard", href: "/dashboard/talent", group: "Overview" },
  { title: "ATS Pipeline", href: "/dashboard/talent/ats", group: "Overview" },
  { title: "Live Hiring Board", href: "/dashboard/talent/live", group: "Overview" },

  { title: "Headcount Plans", href: "/dashboard/talent/headcount", group: "Planning" },
  { title: "Recruitment Requests", href: "/dashboard/talent/requisitions", group: "Planning" },
  { title: "Positions", href: "/dashboard/talent/positions", group: "Planning" },
  { title: "Job Library", href: "/dashboard/talent/job-library", group: "Planning" },

  { title: "Vacancies", href: "/dashboard/talent/vacancies", group: "Jobs" },
  { title: "Pipeline Stages", href: "/dashboard/talent/stages", group: "Jobs" },
  { title: "Careers Portal", href: "/careers", group: "Jobs" },

  { title: "Candidates", href: "/dashboard/talent/candidates", group: "Talent" },
  { title: "Applications", href: "/dashboard/talent/applications", group: "Talent" },
  { title: "Talent Pool", href: "/dashboard/talent/talent-pool", group: "Talent" },
  { title: "Referrals", href: "/dashboard/talent/referrals", group: "Talent" },
  { title: "Agencies", href: "/dashboard/talent/agencies", group: "Talent" },
  { title: "Campus Events", href: "/dashboard/talent/campus", group: "Talent" },

  { title: "Assessments", href: "/dashboard/talent/assessments", group: "Selection" },
  { title: "Assessment Attempts", href: "/dashboard/talent/assessment-attempts", group: "Selection" },
  { title: "Interviews", href: "/dashboard/talent/interviews", group: "Selection" },
  { title: "Background Checks", href: "/dashboard/talent/background", group: "Selection" },
  { title: "References", href: "/dashboard/talent/references", group: "Selection" },
  { title: "Medical Exams", href: "/dashboard/talent/medical", group: "Selection" },

  { title: "Offers", href: "/dashboard/talent/offers", group: "Hire" },
  { title: "Onboarding Tasks", href: "/dashboard/talent/onboarding", group: "Hire" },
  { title: "Probation Handover", href: "/dashboard/hr", group: "Hire" },

  { title: "Documents", href: "/dashboard/talent/documents", group: "Content" },
  { title: "AI Assistant", href: "/dashboard/talent/ai", group: "Intelligence" },
  { title: "Analytics", href: "/dashboard/talent/analytics", group: "Intelligence" },
  { title: "Reports", href: "/dashboard/talent/reports", group: "Intelligence" },

  { title: "Settings", href: "/dashboard/talent/settings", group: "System" },
  { title: "Audit Logs", href: "/dashboard/talent/audit", group: "System" },
  { title: "HR Module", href: "/dashboard/hr", group: "Integrations" },
  { title: "Payroll", href: "/dashboard/payroll", group: "Integrations" },
  { title: "Identity", href: "/dashboard/identity", group: "Integrations" },
] as const;
