/** Enterprise Identity Management types */

export const USER_TYPES = [
  { value: "employee", label: "Employee" },
  { value: "manager", label: "Manager" },
  { value: "administrator", label: "Administrator" },
  { value: "customer", label: "Customer" },
  { value: "supplier", label: "Supplier" },
  { value: "contractor", label: "Contractor" },
  { value: "partner", label: "Partner" },
  { value: "auditor", label: "Auditor" },
  { value: "guest", label: "Guest" },
] as const;

export const ACCOUNT_STATUSES = [
  { value: "active", label: "Active" },
  { value: "pending_activation", label: "Pending Activation" },
  { value: "suspended", label: "Suspended" },
  { value: "locked", label: "Locked" },
  { value: "disabled", label: "Disabled" },
  { value: "expired", label: "Expired" },
] as const;

export const PROVISION_SOURCES = [
  { value: "manual", label: "Manual (Admin)" },
  { value: "hr_onboarding", label: "HR Onboarding" },
  { value: "customer", label: "Customer Registration" },
  { value: "supplier", label: "Supplier Registration" },
  { value: "project", label: "Project Team" },
  { value: "api", label: "API Integration" },
  { value: "bulk", label: "Bulk Import" },
  { value: "ad_sync", label: "Active Directory Sync" },
] as const;

export const PROVISION_STATUSES = [
  "pending",
  "manager_approved",
  "security_review",
  "admin_approved",
  "activated",
  "rejected",
  "cancelled",
] as const;

export const USERNAME_PATTERNS = [
  { value: "firstname.lastname", label: "firstname.lastname", example: "john.doe" },
  { value: "employee.number", label: "employee.number", example: "HDG000254" },
  { value: "department.employee", label: "department.employee", example: "production254" },
  { value: "email.prefix", label: "email.prefix", example: "jdoe" },
] as const;

export const DATA_SCOPES = [
  { value: "own", label: "Own Records Only" },
  { value: "department", label: "Department Records" },
  { value: "branch", label: "Branch Records" },
  { value: "company", label: "Company Records" },
  { value: "all", label: "All Records" },
] as const;

export const MFA_METHODS = [
  { value: "email_otp", label: "Email OTP" },
  { value: "sms_otp", label: "SMS OTP" },
  { value: "authenticator", label: "Authenticator App" },
  { value: "security_key", label: "Security Key" },
  { value: "biometrics", label: "Biometrics" },
  { value: "push", label: "Push Authentication" },
] as const;

export const IDM_LIFECYCLE = [
  "Request",
  "Manager Approval",
  "Security Review",
  "Admin Approval",
  "Provision Account",
  "Activate",
  "Govern Access",
  "Offboard",
] as const;

export interface PasswordPolicy {
  min_password_length: number;
  require_uppercase: boolean;
  require_number: boolean;
  require_special: boolean;
  password_history_count: number;
  password_expiry_days: number;
  max_failed_logins: number;
  lockout_minutes: number;
  force_reset_on_first_login?: boolean;
  temp_password_hours?: number;
}

export interface ProvisionInput {
  first_name: string;
  last_name: string;
  email: string;
  phone?: string | null;
  username?: string | null;
  user_type?: string;
  employee_id?: string | null;
  employee_record_id?: string | null;
  department?: string | null;
  division?: string | null;
  team_name?: string | null;
  branch_name?: string | null;
  location_name?: string | null;
  cost_center?: string | null;
  job_title?: string | null;
  role_id?: string | null;
  role_ids?: string[];
  manager_user_id?: string | null;
  source?: string;
  data_scope?: string;
  require_mfa?: boolean;
  skip_approval?: boolean;
  send_invite?: boolean;
  temp_password?: string | null;
}

export interface BulkUserRow {
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  department?: string;
  job_title?: string;
  employee_id?: string;
  role_slug?: string;
  user_type?: string;
}
