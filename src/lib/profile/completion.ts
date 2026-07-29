import type { CompletionResult, EmployeeProfile } from "./types";

const CHECKS: Array<{
  key: string;
  label: string;
  weight: number;
  ok: (e: EmployeeProfile, ctx?: CompletionContext) => boolean;
}> = [
  { key: "photo", label: "Profile Photo", weight: 8, ok: (e) => Boolean(e.photo_url) },
  {
    key: "full_name",
    label: "Full Name",
    weight: 6,
    ok: (e) => Boolean(e.first_name && e.last_name),
  },
  {
    key: "employee_number",
    label: "Employee ID",
    weight: 6,
    ok: (e) => Boolean(e.employee_number),
  },
  {
    key: "national_id",
    label: "National ID",
    weight: 8,
    ok: (e) => Boolean(e.national_id),
  },
  {
    key: "date_of_birth",
    label: "Date of Birth",
    weight: 5,
    ok: (e) => Boolean(e.date_of_birth),
  },
  { key: "gender", label: "Gender", weight: 3, ok: (e) => Boolean(e.gender) },
  {
    key: "phone",
    label: "Phone Number",
    weight: 6,
    ok: (e) => Boolean(e.phone),
  },
  {
    key: "email",
    label: "Email",
    weight: 6,
    ok: (e) => Boolean(e.email || e.personal_email),
  },
  {
    key: "emergency_contact",
    label: "Emergency Contact",
    weight: 8,
    ok: (e) => Boolean(e.emergency_contact && e.emergency_phone),
  },
  {
    key: "address",
    label: "Residential Address",
    weight: 5,
    ok: (e) => Boolean(e.residential_address || e.address),
  },
  {
    key: "department",
    label: "Department",
    weight: 5,
    ok: (e) => Boolean(e.department),
  },
  {
    key: "job_title",
    label: "Job Title",
    weight: 5,
    ok: (e) => Boolean(e.job_title || e.position_title),
  },
  {
    key: "hire_date",
    label: "Joining Date",
    weight: 4,
    ok: (e) => Boolean(e.hire_date),
  },
  {
    key: "employment_type",
    label: "Employment Type",
    weight: 3,
    ok: (e) => Boolean(e.employment_type),
  },
  {
    key: "manager",
    label: "Reporting Manager",
    weight: 4,
    ok: (e) => Boolean(e.manager_employee_id),
  },
  {
    key: "skills",
    label: "Skills",
    weight: 6,
    ok: (_e, ctx) => (ctx?.skillCount ?? 0) > 0,
  },
  {
    key: "certifications",
    label: "Certifications",
    weight: 4,
    ok: (_e, ctx) => (ctx?.certCount ?? 0) > 0,
  },
  {
    key: "documents",
    label: "Identity Documents",
    weight: 6,
    ok: (_e, ctx) => (ctx?.docCount ?? 0) > 0,
  },
  {
    key: "blood_group",
    label: "Blood Group",
    weight: 2,
    ok: (e) => Boolean(e.blood_group),
  },
];

export interface CompletionContext {
  skillCount?: number;
  certCount?: number;
  docCount?: number;
}

export function calculateProfileCompletion(
  employee: EmployeeProfile,
  ctx: CompletionContext = {}
): CompletionResult {
  const missing: string[] = [];
  const completed: string[] = [];
  let earned = 0;
  let total = 0;

  for (const check of CHECKS) {
    total += check.weight;
    if (check.ok(employee, ctx)) {
      earned += check.weight;
      completed.push(check.label);
    } else {
      missing.push(check.label);
    }
  }

  const pct = total > 0 ? Math.round((earned / total) * 1000) / 10 : 0;
  return { pct, missing, completed, weight: total };
}

export function completionTone(pct: number): "excellent" | "good" | "fair" | "poor" {
  if (pct >= 90) return "excellent";
  if (pct >= 70) return "good";
  if (pct >= 50) return "fair";
  return "poor";
}
