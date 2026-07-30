export type TenantStatus = "trial" | "active" | "suspended" | "cancelled";

export type Tenant = {
  id: string;
  slug: string;
  name: string;
  legal_name?: string | null;
  status: string;
  plan_code?: string | null;
  max_companies?: number | null;
  max_users?: number | null;
  primary_currency?: string | null;
  country_code?: string | null;
  logo_url?: string | null;
  branding?: Record<string, unknown> | null;
  settings?: Record<string, unknown> | null;
};

export type CompanyMembership = {
  id: string;
  user_id: string;
  company_id: string;
  tenant_id?: string | null;
  role_id?: string | null;
  is_default?: boolean;
  status: string;
  title?: string | null;
  companies?: {
    id: string;
    name: string;
    code: string;
    tenant_id?: string | null;
    is_primary?: boolean | null;
    company_type?: string | null;
    base_currency?: string | null;
    country?: string | null;
  } | null;
};

export type TenantContext = {
  tenantId: string | null;
  companyId: string | null;
  companyName: string | null;
  companyCode: string | null;
  memberships: CompanyMembership[];
  isPlatformAdmin: boolean;
};
