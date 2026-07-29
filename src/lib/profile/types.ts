/** Enterprise Digital Employee Profile types */

export const EMPLOYMENT_TYPES = [
  { value: "permanent", label: "Permanent" },
  { value: "contract", label: "Contract" },
  { value: "temporary", label: "Temporary" },
  { value: "intern", label: "Intern" },
  { value: "consultant", label: "Consultant" },
  { value: "freelancer", label: "Freelancer" },
] as const;

export const GENDERS = ["male", "female", "other", "prefer_not_to_say"] as const;

export const MARITAL_STATUSES = [
  "single",
  "married",
  "divorced",
  "widowed",
  "separated",
] as const;

export const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"] as const;

export const DOC_TYPES = [
  { value: "national_id", label: "National ID" },
  { value: "passport", label: "Passport" },
  { value: "contract", label: "Contract" },
  { value: "certificate", label: "Certificate" },
  { value: "academic", label: "Academic Document" },
  { value: "license", label: "License" },
  { value: "medical", label: "Medical Certificate" },
  { value: "training", label: "Training Certificate" },
  { value: "appraisal", label: "Appraisal Document" },
  { value: "other", label: "Other" },
] as const;

export const TIMELINE_EVENT_TYPES = [
  { value: "joined", label: "Joined Company" },
  { value: "confirmed", label: "Confirmation" },
  { value: "promotion", label: "Promotion" },
  { value: "transfer", label: "Transfer" },
  { value: "department_change", label: "Department Change" },
  { value: "salary_change", label: "Salary Change" },
  { value: "role_change", label: "Role Change" },
  { value: "contract_renewal", label: "Contract Renewal" },
  { value: "resignation", label: "Resignation" },
  { value: "termination", label: "Termination" },
  { value: "recognition", label: "Recognition" },
  { value: "warning", label: "Warning" },
] as const;

export const SKILL_CATEGORIES = [
  { value: "technical", label: "Technical" },
  { value: "soft", label: "Soft Skills" },
  { value: "language", label: "Language" },
  { value: "tool", label: "Tools" },
  { value: "domain", label: "Domain" },
] as const;

export const SKILL_LEVELS = [
  { value: "beginner", label: "Beginner", score: 1 },
  { value: "intermediate", label: "Intermediate", score: 3 },
  { value: "advanced", label: "Advanced", score: 4 },
  { value: "expert", label: "Expert", score: 5 },
] as const;

export const VISIBILITY_OPTIONS = [
  { value: "everyone", label: "Everyone" },
  { value: "department", label: "Department" },
  { value: "manager", label: "Manager Only" },
  { value: "hr", label: "HR Only" },
  { value: "private", label: "Private" },
  { value: "self", label: "Self Only" },
] as const;

export const REQUEST_TYPES = [
  { value: "profile_update", label: "Profile Update" },
  { value: "document_upload", label: "Document Upload" },
  { value: "id_replacement", label: "ID Replacement" },
  { value: "leave", label: "Leave Request" },
  { value: "expense", label: "Expense Claim" },
  { value: "asset", label: "Asset Request" },
  { value: "support", label: "Support Ticket" },
  { value: "training", label: "Training Request" },
  { value: "data_correction", label: "Data Correction" },
] as const;

export const PROFILE_FIELD_GROUPS = [
  "photo",
  "full_name",
  "employee_number",
  "national_id",
  "date_of_birth",
  "gender",
  "phone",
  "email",
  "emergency_contact",
  "address",
  "department",
  "job_title",
  "manager",
  "skills",
  "certifications",
  "photo_consent",
] as const;

export type Visibility = (typeof VISIBILITY_OPTIONS)[number]["value"];

export interface CompletionResult {
  pct: number;
  missing: string[];
  completed: string[];
  weight: number;
}

export interface ProfileSectionAccess {
  personal: boolean;
  employment: boolean;
  job: boolean;
  timeline: boolean;
  identity: boolean;
  account: boolean;
  documents: boolean;
  skills: boolean;
  certifications: boolean;
  training: boolean;
  performance: boolean;
  attendance: boolean;
  payroll: boolean;
  projects: boolean;
  assets: boolean;
  helpdesk: boolean;
  security: boolean;
}

export interface EmployeeProfile {
  id: string;
  company_id: string;
  user_id: string | null;
  employee_number: string;
  first_name: string;
  last_name: string;
  middle_name?: string | null;
  preferred_name?: string | null;
  email: string | null;
  personal_email?: string | null;
  phone: string | null;
  alt_phone?: string | null;
  photo_url?: string | null;
  national_id?: string | null;
  passport_number?: string | null;
  date_of_birth?: string | null;
  gender?: string | null;
  nationality?: string | null;
  marital_status?: string | null;
  blood_group?: string | null;
  languages?: string | null;
  residential_address?: string | null;
  address?: string | null;
  emergency_contact?: string | null;
  emergency_phone?: string | null;
  emergency_relationship?: string | null;
  department?: string | null;
  division?: string | null;
  team_name?: string | null;
  branch_name?: string | null;
  cost_center?: string | null;
  work_location?: string | null;
  job_title?: string | null;
  position_title?: string | null;
  job_grade?: string | null;
  position_code?: string | null;
  employment_type?: string | null;
  status?: string;
  hire_date?: string | null;
  confirmation_date?: string | null;
  end_date?: string | null;
  manager_employee_id?: string | null;
  supervisor_employee_id?: string | null;
  responsibilities?: string | null;
  job_description?: string | null;
  qualifications?: string | null;
  experience_years?: number | null;
  shift_name?: string | null;
  working_hours?: string | null;
  security_clearance?: string | null;
  access_level?: string | null;
  login_risk_score?: number | null;
  profile_completion_pct?: number | null;
  profile_visibility?: string | null;
  salary_grade?: string | null;
  payroll_number?: string | null;
  salary?: number | null;
  currency?: string | null;
  bank_name?: string | null;
  bank_account?: string | null;
  tin_number?: string | null;
  nssf_number?: string | null;
  leave_balance_days?: number | null;
  bio?: string | null;
  deleted_at?: string | null;
}

export const PROFILE_LIFECYCLE = [
  "Personal Identity",
  "Company Assignment",
  "Job Profile",
  "Digital ID",
  "IAM Account",
  "Skills & Certs",
  "Documents",
  "Attendance",
  "Payroll Link",
  "Projects",
  "Assets",
  "Performance",
  "Security",
  "Self-Service",
] as const;
