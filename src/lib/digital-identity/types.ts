/** Enterprise Digital Identity Lifecycle — single source of truth */

export const LIFECYCLE_STAGES = [
  "recruitment",
  "interview",
  "offer",
  "hiring",
  "onboarding",
  "probation",
  "confirmation",
  "active",
  "promotion",
  "transfer",
  "training",
  "performance",
  "discipline",
  "leave",
  "suspension",
  "exit",
  "offboarding",
  "archived",
] as const;

export type LifecycleStage = (typeof LIFECYCLE_STAGES)[number];

export const CLEARANCE_LEVELS = [
  "visitor",
  "employee",
  "supervisor",
  "manager",
  "finance",
  "hr",
  "executive",
  "administrator",
  "system_owner",
] as const;

export type ClearanceLevel = (typeof CLEARANCE_LEVELS)[number];

export const ORG_UNIT_TYPES = [
  "company",
  "branch",
  "plant",
  "factory",
  "warehouse",
  "department",
  "team",
  "cost_center",
  "business_unit",
  "division",
  "section",
] as const;

export const CARD_TEMPLATES = [
  "staff",
  "management",
  "contractor",
  "visitor",
  "temporary",
  "intern",
  "driver",
] as const;

export const BIOMETRIC_MODALITIES = [
  "fingerprint",
  "face",
  "iris",
  "palm",
  "voice",
] as const;

export const BIOMETRIC_VENDORS = [
  "zkteco",
  "suprema",
  "hikvision",
  "anviz",
  "dahua",
  "generic",
] as const;

export const DEFAULT_PROVISION_STEPS: Array<{
  step_key: string;
  label: string;
  module: string;
  required: boolean;
}> = [
  { step_key: "master_identity", label: "Create Master Identity (UPID)", module: "identity", required: true },
  { step_key: "hr_employee", label: "HR Employee Record", module: "hr", required: true },
  { step_key: "erp_user", label: "ERP User Account", module: "identity", required: true },
  { step_key: "login_credentials", label: "Login Credentials", module: "identity", required: true },
  { step_key: "company_email", label: "Company Email Profile", module: "identity", required: true },
  { step_key: "hopechat", label: "SecureChat Account", module: "hopechat", required: true },
  { step_key: "service_desk", label: "Service Desk Account", module: "service_desk", required: true },
  { step_key: "employee_portal", label: "Employee Portal Access", module: "portal", required: true },
  { step_key: "payroll_profile", label: "Payroll Profile", module: "payroll", required: true },
  { step_key: "attendance_profile", label: "Attendance Profile", module: "hr", required: true },
  { step_key: "leave_profile", label: "Leave Profile", module: "hr", required: true },
  { step_key: "performance_profile", label: "Performance Profile", module: "hr", required: false },
  { step_key: "asset_profile", label: "Asset Assignment Profile", module: "assets", required: false },
  { step_key: "company_id_card", label: "Company ID Card", module: "credentials", required: true },
  { step_key: "qr_identity", label: "QR Identity Token", module: "credentials", required: true },
  { step_key: "digital_signature", label: "Digital Signature Placeholder", module: "identity", required: false },
  { step_key: "mfa_enrollment", label: "MFA Enrollment Flag", module: "identity", required: true },
];

export const LIFECYCLE_PIPELINE = [
  { stage: "recruitment", label: "Recruitment" },
  { stage: "interview", label: "Interview" },
  { stage: "offer", label: "Offer" },
  { stage: "hiring", label: "Hiring" },
  { stage: "onboarding", label: "Onboarding" },
  { stage: "probation", label: "Probation" },
  { stage: "confirmation", label: "Confirmation" },
  { stage: "active", label: "Active" },
  { stage: "promotion", label: "Promotion" },
  { stage: "transfer", label: "Transfer" },
  { stage: "training", label: "Training" },
  { stage: "performance", label: "Performance" },
  { stage: "discipline", label: "Discipline" },
  { stage: "exit", label: "Exit" },
  { stage: "offboarding", label: "Offboarding" },
  { stage: "archived", label: "Archive" },
] as const;

export interface HireOrchestrationInput {
  company_id: string;
  first_name: string;
  last_name: string;
  middle_name?: string;
  email: string;
  phone?: string;
  department?: string;
  job_title?: string;
  branch_name?: string;
  employment_type?: string;
  grade?: string;
  hire_date?: string;
  clearance_level?: ClearanceLevel;
  template_code?: string;
  actor_id?: string | null;
  /** Skip creating idm_provision_requests (still marks erp_user checklist) */
  skip_auth_provision?: boolean;
}

export interface MasterProfilePatch {
  employee_number?: string;
  staff_code?: string;
  national_id?: string;
  passport_number?: string;
  nssf_number?: string;
  tin_number?: string;
  middle_name?: string;
  gender?: string;
  date_of_birth?: string;
  nationality?: string;
  marital_status?: string;
  blood_group?: string;
  personal_email?: string;
  company_email?: string;
  alternative_phone?: string;
  physical_address?: string;
  department?: string;
  job_title?: string;
  position_title?: string;
  grade?: string;
  branch_name?: string;
  cost_center?: string;
  employment_type?: string;
  employment_status?: string;
  clearance_level?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  org_unit_id?: string | null;
  manager_person_id?: string | null;
}
