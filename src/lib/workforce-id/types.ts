/** Workforce Identity & Credential Management — shared types */

export type IdentityType =
  | "employee"
  | "permanent"
  | "temporary"
  | "intern"
  | "contractor"
  | "consultant"
  | "volunteer"
  | "factory_operator"
  | "machine_operator"
  | "technician"
  | "security_officer"
  | "driver"
  | "warehouse_operator"
  | "visitor"
  | "digital";

export type IdentityStatus =
  | "created"
  | "pending_hr"
  | "verified"
  | "active"
  | "suspended"
  | "expired"
  | "terminated"
  | "archived";

export type CredentialStatus =
  | "created"
  | "pending_approval"
  | "approved"
  | "printing"
  | "printed"
  | "issued"
  | "active"
  | "suspended"
  | "lost"
  | "stolen"
  | "damaged"
  | "expired"
  | "returned"
  | "destroyed"
  | "archived";

export type CredentialType =
  | "pvc"
  | "rfid"
  | "nfc"
  | "smart_card"
  | "mobile"
  | "visitor";

export type CardElementType =
  | "text"
  | "field"
  | "photo"
  | "qr"
  | "barcode"
  | "rect"
  | "ellipse"
  | "logo"
  | "image"
  | "line"
  | "hologram"
  | "watermark"
  | "microtext"
  | "signature";

export type DynamicField =
  | "full_name"
  | "first_name"
  | "last_name"
  | "identity_number"
  | "credential_number"
  | "employee_number"
  | "job_title"
  | "department"
  | "division"
  | "branch_name"
  | "company"
  | "grade"
  | "employment_type"
  | "manager_name"
  | "location_name"
  | "blood_group"
  | "emergency_contact"
  | "emergency_phone"
  | "hire_date"
  | "expiry_date"
  | "issue_date"
  | "operational_role"
  | "security_clearance"
  | "email"
  | "phone"
  | "notes"
  | "rfid_uid"
  | "nfc_uid"
  | "access_zones";

export interface CardElement {
  id: string;
  type: CardElementType;
  x: number; // % of canvas 0-100
  y: number;
  w: number;
  h: number;
  z?: number;
  text?: string;
  field?: DynamicField | string;
  label?: string;
  fontSize?: number;
  fontFamily?: string;
  color?: string;
  fill?: string;
  bold?: boolean;
  italic?: boolean;
  align?: "left" | "center" | "right";
  opacity?: number;
  locked?: boolean;
  rotation?: number;
  src?: string;
}

export interface CardDesign {
  front: CardElement[];
  back: CardElement[];
}

export interface WidIdentity {
  id: string;
  company_id: string;
  employee_id: string | null;
  identity_number: string;
  identity_type: string;
  operational_role: string | null;
  full_name: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  photo_url: string | null;
  department: string | null;
  division: string | null;
  branch_name: string | null;
  job_title: string | null;
  grade: string | null;
  employment_type: string | null;
  manager_name: string | null;
  location_name: string | null;
  blood_group: string | null;
  emergency_contact: string | null;
  emergency_phone: string | null;
  hire_date: string | null;
  expiry_date: string | null;
  username: string | null;
  erp_account: string | null;
  vpn_account: string | null;
  api_identity: string | null;
  status: string;
  security_clearance: string | null;
  notes: string | null;
  metadata?: Record<string, unknown> | null;
  created_at?: string;
  updated_at?: string;
  deleted_at?: string | null;
}

export interface WidCredential {
  id: string;
  company_id: string;
  identity_id: string;
  template_id: string | null;
  brand_id: string | null;
  credential_number: string;
  card_serial: string | null;
  credential_type: string;
  status: string;
  issue_date: string | null;
  activation_date: string | null;
  expiry_date: string | null;
  printed_at: string | null;
  issued_at: string | null;
  qr_token: string | null;
  qr_public_id: string | null;
  barcode_value: string | null;
  rfid_uid: string | null;
  nfc_uid: string | null;
  security_seal: string | null;
  anti_copy_nonce: string | null;
  snapshot_json: Record<string, unknown> | null;
  access_profile_code: string | null;
  print_count: number | null;
  replacement_of: string | null;
  notes: string | null;
  created_at?: string;
  wid_identities?: WidIdentity | null;
  wid_card_templates?: { name: string; template_code: string; design_json: CardDesign } | null;
}

export interface WidTemplate {
  id: string;
  company_id: string;
  brand_id: string | null;
  template_code: string;
  name: string;
  description: string | null;
  category: string;
  card_format: string;
  orientation: string;
  width_mm: number;
  height_mm: number;
  sides: number;
  design_json: CardDesign;
  security_features: string[] | null;
  default_access_profile_code: string | null;
  language: string;
  version: number;
  is_system: boolean;
  is_active: boolean;
  deleted_at?: string | null;
}

export interface WidAccessZone {
  id: string;
  company_id: string;
  zone_code: string;
  name: string;
  description: string | null;
  zone_level: number;
  is_restricted: boolean;
  color: string | null;
  is_active: boolean;
}

export interface WidAccessProfile {
  id: string;
  company_id: string;
  profile_code: string;
  name: string;
  description: string | null;
  zone_codes: string[] | null;
  time_start: string | null;
  time_end: string | null;
  auto_departments: string[] | null;
  auto_identity_types: string[] | null;
  is_active: boolean;
}

export interface FieldContext {
  full_name?: string;
  first_name?: string;
  last_name?: string;
  identity_number?: string;
  credential_number?: string;
  employee_number?: string;
  job_title?: string;
  department?: string;
  division?: string;
  branch_name?: string;
  company?: string;
  grade?: string;
  employment_type?: string;
  manager_name?: string;
  location_name?: string;
  blood_group?: string;
  emergency_contact?: string;
  emergency_phone?: string;
  hire_date?: string;
  expiry_date?: string;
  issue_date?: string;
  operational_role?: string;
  security_clearance?: string;
  email?: string;
  phone?: string;
  notes?: string;
  rfid_uid?: string;
  nfc_uid?: string;
  access_zones?: string;
  photo_url?: string;
  [key: string]: string | undefined;
}

export const IDENTITY_TYPES: { value: IdentityType; label: string; group: string }[] = [
  { value: "employee", label: "Employee", group: "Employment" },
  { value: "permanent", label: "Permanent Staff", group: "Employment" },
  { value: "temporary", label: "Temporary Staff", group: "Employment" },
  { value: "intern", label: "Intern", group: "Employment" },
  { value: "contractor", label: "Contractor", group: "Employment" },
  { value: "consultant", label: "Consultant", group: "Employment" },
  { value: "volunteer", label: "Volunteer", group: "Employment" },
  { value: "factory_operator", label: "Factory Operator", group: "Operational" },
  { value: "machine_operator", label: "Machine Operator", group: "Operational" },
  { value: "technician", label: "Technician", group: "Operational" },
  { value: "security_officer", label: "Security Officer", group: "Operational" },
  { value: "driver", label: "Driver", group: "Operational" },
  { value: "warehouse_operator", label: "Warehouse Operator", group: "Operational" },
  { value: "visitor", label: "Visitor", group: "Other" },
  { value: "digital", label: "Digital Only", group: "Other" },
];

export const CREDENTIAL_STATUSES: CredentialStatus[] = [
  "created",
  "pending_approval",
  "approved",
  "printing",
  "printed",
  "issued",
  "active",
  "suspended",
  "lost",
  "stolen",
  "damaged",
  "expired",
  "returned",
  "destroyed",
  "archived",
];

export const DYNAMIC_FIELDS: { value: DynamicField; label: string }[] = [
  { value: "full_name", label: "Full Name" },
  { value: "identity_number", label: "Identity Number" },
  { value: "credential_number", label: "Credential Number" },
  { value: "job_title", label: "Job Title" },
  { value: "department", label: "Department" },
  { value: "division", label: "Division" },
  { value: "branch_name", label: "Branch" },
  { value: "company", label: "Company" },
  { value: "grade", label: "Grade" },
  { value: "employment_type", label: "Employment Type" },
  { value: "manager_name", label: "Manager" },
  { value: "location_name", label: "Location" },
  { value: "blood_group", label: "Blood Group" },
  { value: "emergency_contact", label: "Emergency Contact" },
  { value: "hire_date", label: "Hire Date" },
  { value: "expiry_date", label: "Expiry Date" },
  { value: "issue_date", label: "Issue Date" },
  { value: "operational_role", label: "Operational Role" },
  { value: "security_clearance", label: "Security Clearance" },
  { value: "email", label: "Email" },
  { value: "phone", label: "Phone" },
  { value: "access_zones", label: "Access Zones" },
  { value: "rfid_uid", label: "RFID UID" },
  { value: "nfc_uid", label: "NFC UID" },
];

export const LIFECYCLE_STAGES = [
  "Recruitment",
  "Identity Creation",
  "HR Verification",
  "Credential Generation",
  "ID Card Design",
  "Approval",
  "Printing",
  "Activation",
  "Access Assignment",
  "Usage Monitoring",
  "Renewal",
  "Suspension",
  "Termination",
  "Archiving",
] as const;
