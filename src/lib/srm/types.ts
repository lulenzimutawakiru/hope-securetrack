/** Enterprise SRM domain types */

export type SupplierStatus =
  | "registered"
  | "qualifying"
  | "pending_approval"
  | "approved"
  | "active"
  | "preferred"
  | "strategic"
  | "suspended"
  | "blacklisted"
  | "inactive"
  | "offboarded";

export type SupplierClass =
  | "strategic"
  | "preferred"
  | "approved"
  | "temporary"
  | "one_time"
  | "high_risk"
  | "critical"
  | "international"
  | "local"
  | "manufacturer"
  | "distributor"
  | "wholesaler";

export const SUPPLIER_CATEGORIES = [
  "raw_materials",
  "packaging",
  "machinery",
  "printing_equipment",
  "office_supplies",
  "ict",
  "software",
  "logistics",
  "maintenance",
  "security",
  "cleaning",
  "professional_services",
  "utilities",
  "marketing",
  "manufacturing_partners",
] as const;

export const SUPPLIER_CLASSES: SupplierClass[] = [
  "strategic",
  "preferred",
  "approved",
  "temporary",
  "one_time",
  "high_risk",
  "critical",
  "international",
  "local",
  "manufacturer",
  "distributor",
  "wholesaler",
];

export const LIFECYCLE_STAGES = [
  "Registration",
  "Qualification",
  "Due Diligence",
  "Approval",
  "Contract",
  "RFQ/RFP",
  "Purchase Orders",
  "Deliveries",
  "Quality Inspection",
  "Invoice Matching",
  "Payment",
  "Performance Review",
  "Renewal / Offboarding",
] as const;

export interface SupplierInput {
  company_id: string;
  name: string;
  code?: string;
  trading_name?: string;
  category?: string;
  supplier_type?: string;
  supplier_class?: string;
  supplier_status?: string;
  contact_person?: string;
  email?: string;
  phone?: string;
  whatsapp?: string;
  country?: string;
  city?: string;
  region?: string;
  currency?: string;
  payment_terms_days?: number;
  tin_vat?: string;
  registration_number?: string;
  notes?: string;
}

export interface OnboardingInput {
  company_id: string;
  company_name: string;
  trading_name?: string;
  category?: string;
  contact_name?: string;
  email?: string;
  phone?: string;
  tin_number?: string;
  vat_number?: string;
  registration_number?: string;
  created_by?: string | null;
}

export interface NcrInput {
  company_id: string;
  supplier_id: string;
  title: string;
  description?: string;
  severity?: string;
  defect_type?: string;
  quantity_affected?: number;
  capa_required?: boolean;
  capa_description?: string;
  capa_due_date?: string;
  purchase_order_id?: string | null;
  created_by?: string | null;
}

export interface RiskInput {
  company_id: string;
  supplier_id?: string | null;
  risk_type: string;
  title: string;
  description?: string;
  likelihood?: number;
  impact?: number;
  mitigation?: string;
  owner_id?: string | null;
}
