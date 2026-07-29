/** Enterprise CRM domain types — Hope SecureTrack */

export type CustomerStatus =
  | "lead"
  | "prospect"
  | "active"
  | "preferred"
  | "vip"
  | "suspended"
  | "blacklisted"
  | "inactive"
  | "closed";

export type CustomerClass =
  | "individual"
  | "corporate"
  | "government"
  | "ngo"
  | "school"
  | "distributor"
  | "dealer"
  | "retailer"
  | "wholesaler"
  | "export"
  | "strategic"
  | "vip";

export type LeadStatus =
  | "new"
  | "contacted"
  | "qualified"
  | "unqualified"
  | "converted"
  | "lost";

export type OpportunityStage =
  | "prospecting"
  | "qualification"
  | "proposal"
  | "negotiation"
  | "won"
  | "lost";

export type TimelineKind =
  | "call"
  | "meeting"
  | "email"
  | "whatsapp"
  | "sms"
  | "note"
  | "quote"
  | "order"
  | "invoice"
  | "payment"
  | "ticket"
  | "delivery"
  | "complaint"
  | "return"
  | "task"
  | "ai_summary"
  | "portal"
  | "system";

export type LoyaltyTier = "bronze" | "silver" | "gold" | "platinum" | "diamond";

export interface Customer360 {
  id: string;
  company_id: string;
  code: string;
  name: string;
  trading_name?: string | null;
  customer_type?: string | null;
  customer_class?: string | null;
  customer_status?: string | null;
  contact_person?: string | null;
  designation?: string | null;
  tax_id?: string | null;
  tin_vat?: string | null;
  registration_number?: string | null;
  industry?: string | null;
  website?: string | null;
  email?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  physical_address?: string | null;
  billing_address?: string | null;
  shipping_address?: string | null;
  city?: string | null;
  region?: string | null;
  district?: string | null;
  country?: string | null;
  gps_lat?: number | null;
  gps_lng?: number | null;
  time_zone?: string | null;
  preferred_language?: string | null;
  preferred_currency?: string | null;
  currency?: string | null;
  credit_limit?: number | null;
  outstanding_balance?: number | null;
  credit_hold?: boolean | null;
  credit_status?: string | null;
  payment_terms_days?: number | null;
  risk_score?: number | null;
  health_score?: number | null;
  churn_risk?: number | null;
  clv_estimate?: number | null;
  loyalty_level?: string | null;
  loyalty_points?: number | null;
  parent_customer_id?: string | null;
  territory?: string | null;
  source?: string | null;
  portal_enabled?: boolean | null;
  is_active?: boolean | null;
  deleted_at?: string | null;
  tags?: string[] | null;
  notes?: string | null;
  owner_id?: string | null;
  sales_rep_id?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface CrmContact {
  id: string;
  company_id: string;
  customer_id: string;
  first_name: string;
  last_name?: string | null;
  title?: string | null;
  department?: string | null;
  email?: string | null;
  phone?: string | null;
  mobile?: string | null;
  whatsapp?: string | null;
  linkedin?: string | null;
  birthday?: string | null;
  is_primary?: boolean;
  is_decision_maker?: boolean;
  is_technical?: boolean;
  is_finance?: boolean;
  is_procurement?: boolean;
  is_emergency?: boolean;
  consent_email?: boolean;
  consent_sms?: boolean;
  consent_whatsapp?: boolean;
  notes?: string | null;
  is_active?: boolean;
}

export interface CrmLead {
  id: string;
  company_id: string;
  lead_number: string;
  company_name: string;
  contact_name?: string | null;
  email?: string | null;
  phone?: string | null;
  source?: string | null;
  industry?: string | null;
  status: string;
  estimated_value?: number | null;
  currency?: string | null;
  lead_score?: number | null;
  ai_score?: number | null;
  notes?: string | null;
  next_action?: string | null;
  next_action_at?: string | null;
  assigned_to?: string | null;
  converted_customer_id?: string | null;
  territory?: string | null;
  lost_reason?: string | null;
  created_at?: string;
}

export interface CrmOpportunity {
  id: string;
  company_id: string;
  opportunity_number: string;
  name: string;
  customer_id?: string | null;
  lead_id?: string | null;
  stage: string;
  probability?: number | null;
  expected_value?: number | null;
  weighted_value?: number | null;
  currency?: string | null;
  expected_close_date?: string | null;
  competitors?: string | null;
  decision_makers?: string | null;
  risks?: string | null;
  win_strategy?: string | null;
  products_interest?: string | null;
  forecast_category?: string | null;
  owner_id?: string | null;
  notes?: string | null;
  created_at?: string;
}

export interface CrmTimelineEvent {
  id: string;
  company_id: string;
  customer_id?: string | null;
  lead_id?: string | null;
  opportunity_id?: string | null;
  kind: TimelineKind | string;
  title: string;
  body?: string | null;
  channel?: string | null;
  direction?: string | null;
  amount?: number | null;
  currency?: string | null;
  sentiment?: string | null;
  actor_name?: string | null;
  occurred_at: string;
  metadata?: Record<string, unknown>;
}

export interface CrmInsight {
  id: string;
  company_id: string;
  customer_id?: string | null;
  insight_type: string;
  severity: string;
  title: string;
  recommendation: string;
  score?: number | null;
  status: string;
  created_at?: string;
}

export interface CustomerInput {
  company_id: string;
  name: string;
  code?: string;
  trading_name?: string;
  customer_type?: string;
  customer_class?: string;
  customer_status?: string;
  contact_person?: string;
  designation?: string;
  email?: string;
  phone?: string;
  whatsapp?: string;
  industry?: string;
  city?: string;
  region?: string;
  district?: string;
  country?: string;
  credit_limit?: number;
  payment_terms_days?: number;
  currency?: string;
  territory?: string;
  source?: string;
  parent_customer_id?: string | null;
  owner_id?: string | null;
  notes?: string;
}

export interface LeadInput {
  company_id: string;
  company_name: string;
  contact_name?: string;
  email?: string;
  phone?: string;
  source?: string;
  industry?: string;
  estimated_value?: number;
  currency?: string;
  territory?: string;
  notes?: string;
  assigned_to?: string | null;
}

export interface OpportunityInput {
  company_id: string;
  name: string;
  customer_id?: string | null;
  lead_id?: string | null;
  stage?: string;
  probability?: number;
  expected_value?: number;
  currency?: string;
  expected_close_date?: string;
  competitors?: string;
  win_strategy?: string;
  products_interest?: string;
  owner_id?: string | null;
  notes?: string;
}

export interface TimelineInput {
  company_id: string;
  customer_id?: string | null;
  lead_id?: string | null;
  opportunity_id?: string | null;
  kind: string;
  title: string;
  body?: string;
  channel?: string;
  direction?: string;
  amount?: number;
  currency?: string;
  actor_id?: string | null;
  actor_name?: string;
}

export const LEAD_STAGES = [
  "new",
  "contacted",
  "qualified",
  "unqualified",
  "converted",
  "lost",
] as const;

export const OPP_STAGES = [
  "prospecting",
  "qualification",
  "proposal",
  "negotiation",
  "won",
  "lost",
] as const;

export const CUSTOMER_CLASSES: CustomerClass[] = [
  "individual",
  "corporate",
  "government",
  "ngo",
  "school",
  "distributor",
  "dealer",
  "retailer",
  "wholesaler",
  "export",
  "strategic",
  "vip",
];

export const CUSTOMER_STATUSES: CustomerStatus[] = [
  "lead",
  "prospect",
  "active",
  "preferred",
  "vip",
  "suspended",
  "blacklisted",
  "inactive",
  "closed",
];

export const LIFECYCLE_STAGES = [
  "Lead",
  "Qualification",
  "Opportunity",
  "Quotation",
  "Approval",
  "Sales Order",
  "Production",
  "Packaging",
  "Dispatch",
  "Invoice",
  "Payment",
  "Support",
  "Loyalty",
  "Renewal",
] as const;
