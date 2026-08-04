import { createClient } from "@/lib/supabase/crud-compat";
import type { CompanyMembership, Tenant } from "./types";

function sb() {
  return createClient();
}

export async function listMyMemberships(userId: string): Promise<CompanyMembership[]> {
  const { data, error } = await sb()
    .from("user_company_memberships")
    .select(
      "id,user_id,company_id,tenant_id,role_id,is_default,status,title,companies(id,name,code,tenant_id,is_primary,company_type,base_currency,country)"
    )
    .eq("user_id", userId)
    .eq("status", "active")
    .order("is_default", { ascending: false });

  if (error) {
    // Fallback: single home company from profile
    const { data: profile } = await sb()
      .from("user_profiles")
      .select("id,company_id,active_company_id,tenant_id,role_id")
      .eq("id", userId)
      .maybeSingle();

    if (!profile?.company_id) return [];

    const { data: company } = await sb()
      .from("companies")
      .select("id,name,code,tenant_id,is_primary,company_type,base_currency,country")
      .eq("id", profile.company_id)
      .maybeSingle();

    return [
      {
        id: "home",
        user_id: userId,
        company_id: String(profile.company_id),
        tenant_id: (profile as { tenant_id?: string }).tenant_id || null,
        role_id: (profile as { role_id?: string }).role_id || null,
        is_default: true,
        status: "active",
        companies: (company as CompanyMembership["companies"]) || null,
      },
    ];
  }

  return (data as unknown as CompanyMembership[]) || [];
}

export async function listAccessibleCompanies(userId: string) {
  const memberships = await listMyMemberships(userId);
  const fromMemberships = memberships
    .map((m) => m.companies)
    .filter(Boolean) as NonNullable<CompanyMembership["companies"]>[];

  // Super-admin / platform admin may see all companies
  const { data: all } = await sb()
    .from("companies")
    .select("id,name,code,tenant_id,is_primary,company_type,base_currency,country")
    .is("deleted_at", null)
    .order("name")
    .limit(200);

  if (all && all.length > fromMemberships.length) {
    // Prefer union of membership + any visible via RLS
    const map = new Map<string, (typeof all)[number]>();
    for (const c of all) map.set(c.id, c);
    for (const c of fromMemberships) if (c) map.set(c.id, c as (typeof all)[number]);
    return Array.from(map.values());
  }

  return fromMemberships;
}

export async function switchActiveCompany(companyId: string): Promise<string> {
  const { data, error } = await sb().rpc("switch_active_company", {
    p_company_id: companyId,
  });
  if (error) throw error;
  return String(data || companyId);
}

export async function getActiveTenant(): Promise<Tenant | null> {
  const { data: tid } = await sb().rpc("user_tenant_id");
  if (!tid) {
    const { data } = await sb().from("tenants").select("*").limit(1).maybeSingle();
    return (data as Tenant) || null;
  }
  const { data } = await sb().from("tenants").select("*").eq("id", tid).maybeSingle();
  return (data as Tenant) || null;
}

export async function listTenants(): Promise<Tenant[]> {
  const { data, error } = await sb()
    .from("tenants")
    .select("*")
    .is("deleted_at", null)
    .order("name");
  if (error) throw error;
  return (data as Tenant[]) || [];
}

export async function createTenant(input: {
  slug: string;
  name: string;
  legal_name?: string;
  plan_code?: string;
  country_code?: string;
  primary_currency?: string;
  primary_contact_email?: string;
}) {
  const { data, error } = await sb()
    .from("tenants")
    .insert({
      slug: input.slug.toLowerCase().replace(/[^a-z0-9-]/g, "-"),
      name: input.name,
      legal_name: input.legal_name || input.name,
      plan_code: input.plan_code || "enterprise",
      country_code: input.country_code || "UG",
      primary_currency: input.primary_currency || "UGX",
      primary_contact_email: input.primary_contact_email || null,
      status: "active",
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as Tenant;
}

export async function createCompanyUnderTenant(input: {
  tenant_id: string;
  name: string;
  code: string;
  company_type?: string;
  country?: string;
  base_currency?: string;
  is_primary?: boolean;
}) {
  const { data, error } = await sb()
    .from("companies")
    .insert({
      tenant_id: input.tenant_id,
      name: input.name,
      code: input.code.toUpperCase(),
      legal_name: input.name,
      company_type: input.company_type || "operating",
      country: input.country || "Uganda",
      base_currency: input.base_currency || "UGX",
      is_primary: input.is_primary ?? false,
      is_active: true,
      company_status: "active",
    })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function addCompanyMembership(input: {
  user_id: string;
  company_id: string;
  tenant_id?: string | null;
  role_id?: string | null;
  is_default?: boolean;
}) {
  const { data, error } = await sb()
    .from("user_company_memberships")
    .upsert(
      {
        user_id: input.user_id,
        company_id: input.company_id,
        tenant_id: input.tenant_id || null,
        role_id: input.role_id || null,
        is_default: input.is_default ?? false,
        status: "active",
        joined_at: new Date().toISOString(),
      },
      { onConflict: "user_id,company_id" }
    )
    .select("*")
    .single();
  if (error) throw error;
  return data;
}
