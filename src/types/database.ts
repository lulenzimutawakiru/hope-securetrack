export type ProductionStatus =
  | "draft"
  | "in_progress"
  | "qc_pending"
  | "approved"
  | "rejected"
  | "packed"
  | "completed"
  | "archived";

export type QcStatus = "pending" | "passed" | "failed" | "on_hold";
export type QrCodeType = "ream" | "carton" | "pallet" | "batch";
export type QrCodeStatus =
  | "generated"
  | "printed"
  | "verified"
  | "packed"
  | "dispatched"
  | "sold"
  | "recalled"
  | "voided"
  | "counterfeit";
export type PrintJobStatus =
  | "pending"
  | "queued"
  | "printing"
  | "paused"
  | "completed"
  | "failed"
  | "cancelled";
export type InventoryStatus =
  | "in_production"
  | "in_warehouse"
  | "in_transit"
  | "at_distributor"
  | "at_retailer"
  | "sold"
  | "returned"
  | "recalled"
  | "destroyed";
export type VerificationResult =
  | "genuine"
  | "invalid"
  | "counterfeit"
  | "recalled"
  | "duplicate"
  | "suspicious";
export type FraudAlertSeverity = "low" | "medium" | "high" | "critical";
export type FraudAlertStatus =
  | "open"
  | "investigating"
  | "confirmed"
  | "dismissed"
  | "resolved";
export type ShiftType = "morning" | "afternoon" | "night";

export interface Company {
  id: string;
  name: string;
  code: string;
  legal_name: string | null;
  city: string | null;
  country: string | null;
  is_active: boolean;
}

export interface UserProfile {
  id: string;
  company_id: string;
  /** Multi-tenant: currently selected company for RLS context */
  active_company_id?: string | null;
  tenant_id?: string | null;
  is_platform_admin?: boolean;
  factory_id: string | null;
  warehouse_id: string | null;
  branch_id: string | null;
  department_id: string | null;
  role_id: string;
  employee_id: string | null;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  avatar_url: string | null;
  is_active: boolean;
  last_login_at: string | null;
  roles?: Role;
  permissions?: string[];
}

export interface Role {
  id: string;
  company_id: string | null;
  name: string;
  slug: string;
  description: string | null;
  is_system: boolean;
}

export interface Product {
  id: string;
  company_id: string;
  category_id: string | null;
  name: string;
  product_code: string;
  description: string | null;
  paper_size: string | null;
  gsm: number | null;
  color: string | null;
  reams_per_carton: number;
  is_active: boolean;
  product_categories?: ProductCategory | null;
}

export interface ProductCategory {
  id: string;
  company_id: string;
  name: string;
  code: string;
  description: string | null;
  is_active: boolean;
}

export interface ProductionBatch {
  id: string;
  company_id: string;
  factory_id: string;
  product_id: string;
  batch_number: string;
  product_code: string;
  product_category: string | null;
  paper_size: string | null;
  gsm: number | null;
  color: string | null;
  machine_id: string | null;
  production_line: string | null;
  shift: ShiftType | null;
  operator_id: string | null;
  supervisor_id: string | null;
  quantity_reams: number;
  quantity_cartons: number;
  manufacturing_date: string;
  qc_status: QcStatus;
  production_status: ProductionStatus;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  products?: Product;
}

export interface QrCode {
  id: string;
  company_id: string;
  public_uuid: string;
  code_type: QrCodeType;
  status: QrCodeStatus;
  encrypted_token: string;
  signature: string;
  checksum: string;
  human_serial: string;
  batch_id: string | null;
  product_id: string | null;
  ream_id: string | null;
  carton_id: string | null;
  payload: Record<string, unknown>;
  print_count: number;
  verification_count: number;
  is_recalled: boolean;
  created_at: string;
  production_batches?: (ProductionBatch & {
    manufacturing_date?: string;
  }) | null;
  products?: (Product & {
    product_code?: string;
  }) | null;
}

export interface Ream {
  id: string;
  company_id: string;
  batch_id: string;
  product_id: string;
  qr_code_id: string | null;
  serial_number: string;
  paper_size: string | null;
  gsm: number | null;
  color: string | null;
  carton_id: string | null;
  inventory_status: InventoryStatus;
  is_defective: boolean;
  warehouse_id: string | null;
  created_at: string;
}

export interface Carton {
  id: string;
  company_id: string;
  batch_id: string;
  product_id: string;
  qr_code_id: string | null;
  serial_number: string;
  paper_size: string | null;
  gsm: number | null;
  ream_count: number;
  packed_by: string | null;
  packed_at: string | null;
  inventory_status: InventoryStatus;
  warehouse_id: string | null;
  created_at: string;
}

export interface PrintJob {
  id: string;
  company_id: string;
  batch_id: string | null;
  agent_id: string | null;
  printer_id: string | null;
  job_type: string;
  status: PrintJobStatus;
  label_type: QrCodeType;
  total_labels: number;
  printed_labels: number;
  failed_labels: number;
  is_reprint: boolean;
  created_by: string | null;
  created_at: string;
  production_batches?: ProductionBatch | null;
}

export interface Distributor {
  id: string;
  company_id: string;
  name: string;
  code: string;
  contact_person: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
  region: string | null;
  is_active: boolean;
}

export interface FraudAlert {
  id: string;
  company_id: string;
  qr_code_id: string | null;
  alert_type: string;
  severity: FraudAlertSeverity;
  status: FraudAlertStatus;
  title: string;
  description: string | null;
  created_at: string;
  qr_codes?: QrCode | null;
}

export interface VerificationLog {
  id: string;
  company_id: string;
  qr_code_id: string | null;
  public_uuid: string | null;
  result: VerificationResult;
  ip_address: string | null;
  city: string | null;
  country: string | null;
  scan_source: string | null;
  is_first_scan: boolean;
  verified_at: string;
}

export interface AuditLog {
  id: string;
  company_id: string;
  user_id: string | null;
  user_email: string | null;
  user_role: string | null;
  action: string;
  module: string;
  entity_type: string | null;
  entity_id: string | null;
  entity_reference: string | null;
  created_at: string;
}

export interface InventoryMovement {
  id: string;
  company_id: string;
  movement_type: string;
  item_type: string;
  ream_id: string | null;
  carton_id: string | null;
  quantity: number;
  notes: string | null;
  performed_at: string;
}

export interface DashboardStats {
  batchesToday: number;
  batchesInProgress: number;
  qrGenerated: number;
  qrPrinted: number;
  verificationsToday: number;
  openFraudAlerts: number;
  inventoryReams: number;
  inventoryCartons: number;
  pendingPrintJobs: number;
}
