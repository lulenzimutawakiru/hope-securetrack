/**
 * Enterprise branding resolver - resolves company brand tokens from the
 * database (companies + brand_profiles + brand_logos + brand_colors) so that
 * documents, emails and notifications share one branded presentation layer.
 *
 * Server-safe: accepts any Supabase client (server session or admin/service
 * role). The company id MUST always be session-derived by the caller - never
 * taken from request bodies or URLs (see AGENTS.md tenant rules).
 *
 * Non-throwing by design: on any failure it falls back to environment
 * defaults so document and email flows never break because brand data is
 * missing or unreachable.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";
import type { EmailBrand } from "@/lib/email/resend";

export interface ResolvedBrand {
  companyId: string | null;
  name: string;
  legalName: string;
  tradingName: string;
  registrationNumber: string;
  taxNumber: string;
  address: string;
  city: string;
  country: string;
  phone: string;
  email: string;
  website: string;
  logoUrl: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  source: "db" | "defaults";
}

export const DEFAULT_BRAND_PRIMARY = "#0B1F3A";
export const DEFAULT_BRAND_SECONDARY = "#C9A227";
export const DEFAULT_BRAND_ACCENT = "#00AEEF";

export function defaultBrand(companyId?: string | null): ResolvedBrand {
  return {
    companyId: companyId ?? null,
    name: env.app.company,
    legalName: "",
    tradingName: "",
    registrationNumber: "",
    taxNumber: "",
    address: "",
    city: "",
    country: "",
    phone: "",
    email: "",
    website: "",
    logoUrl: "",
    primaryColor: DEFAULT_BRAND_PRIMARY,
    secondaryColor: DEFAULT_BRAND_SECONDARY,
    accentColor: DEFAULT_BRAND_ACCENT,
    source: "defaults",
  };
}

function str(v: unknown): string {
  return v == null ? "" : String(v);
}

function normalizeHex(hex: string): string | null {
  const m = /^#?([0-9a-fA-F]{6})$/.exec(hex.trim());
  if (!m) return null;
  return hex.trim().startsWith("#") ? hex.trim() : `#${m[1]}`;
}

export async function resolveCompanyBranding(
  sb: SupabaseClient,
  companyId: string | null | undefined
): Promise<ResolvedBrand> {
  const brand = defaultBrand(companyId || null);
  if (!companyId) return brand;
  brand.source = "db";

  // Performance: companies + brand_profiles + brand_logos + brand_colors are
  // independent lookups, so fire them in parallel (4 queries -> 1 RTT wall
  // time). allSettled keeps the original per-section fallback semantics - a
  // failure in one lookup never breaks the others.
  const [companyRes, profileRes, defaultLogoRes, colorsRes] =
    await Promise.allSettled([
      sb
        .from("companies")
        .select(
          "name, legal_name, tax_id, address, city, country, phone, email, logo_url, website"
        )
        .eq("id", companyId)
        .maybeSingle(),
      sb
        .from("brand_profiles")
        .select(
          "trading_name, registration_number, tax_number, address, phone, email, website"
        )
        .eq("company_id", companyId)
        .eq("is_primary", true)
        .eq("is_active", true)
        .limit(1)
        .maybeSingle(),
      sb
        .from("brand_logos")
        .select("file_url")
        .eq("company_id", companyId)
        .eq("logo_type", "primary")
        .eq("is_default", true)
        .limit(1),
      sb
        .from("brand_colors")
        .select("color_role, hex_value")
        .eq("company_id", companyId)
        .in("color_role", ["primary", "secondary", "accent"])
        .eq("status", "approved"),
    ]);

  if (companyRes.status === "fulfilled") {
    const company = companyRes.value.data;
    if (company) {
      brand.name = str(company.name) || brand.name;
      brand.legalName = str(company.legal_name);
      brand.taxNumber = str(company.tax_id);
      brand.address = str(company.address);
      brand.city = str(company.city);
      brand.country = str(company.country);
      brand.phone = str(company.phone);
      brand.email = str(company.email);
      brand.website = str(company.website);
      brand.logoUrl = str(company.logo_url);
    }
  }

  if (profileRes.status === "fulfilled") {
    const profile = profileRes.value.data;
    if (profile) {
      brand.tradingName = str(profile.trading_name);
      if (profile.trading_name) brand.name = str(profile.trading_name);
      brand.registrationNumber = str(profile.registration_number);
      if (profile.tax_number) brand.taxNumber = str(profile.tax_number);
      if (profile.address) brand.address = str(profile.address);
      if (profile.phone) brand.phone = str(profile.phone);
      if (profile.email) brand.email = str(profile.email);
      if (profile.website) brand.website = str(profile.website);
    }
  }

  if (defaultLogoRes.status === "fulfilled") {
    const logo = defaultLogoRes.value.data?.[0] ?? null;
    if (!logo?.file_url) {
      try {
        const { data: anyLogos } = await sb
          .from("brand_logos")
          .select("file_url")
          .eq("company_id", companyId)
          .eq("logo_type", "primary")
          .limit(1);
        const fallbackLogo = anyLogos?.[0] ?? null;
        if (fallbackLogo?.file_url) brand.logoUrl = str(fallbackLogo.file_url);
      } catch {
        /* fall back */
      }
    } else {
      brand.logoUrl = str(logo.file_url);
    }
  }

  if (colorsRes.status === "fulfilled") {
    const colors = colorsRes.value.data;
    for (const c of colors ?? []) {
      const hex = normalizeHex(str(c.hex_value));
      if (!hex) continue;
      if (c.color_role === "primary") brand.primaryColor = hex;
      else if (c.color_role === "secondary") brand.secondaryColor = hex;
      else if (c.color_role === "accent") brand.accentColor = hex;
    }
  }

  return brand;
}

/** Full human-readable address assembled from the brand record. */
export function brandFullAddress(brand: ResolvedBrand): string {
  const parts = [brand.address, brand.city, brand.country].filter(Boolean);
  return parts.join(", ");
}

/** Flatten a resolved brand into email/document template vars ({{company_name}} etc). */
export function brandToTemplateVars(brand: ResolvedBrand): Record<string, string> {
  return {
    company_name: brand.name,
    company_legal_name: brand.legalName,
    trading_name: brand.tradingName,
    registration_number: brand.registrationNumber,
    tax_number: brand.taxNumber,
    company_address: brand.address,
    company_city: brand.city,
    company_country: brand.country,
    company_phone: brand.phone,
    company_email: brand.email,
    company_website: brand.website,
    logo_url: brand.logoUrl,
    primary_color: brand.primaryColor,
    secondary_color: brand.secondaryColor,
    accent_color: brand.accentColor,
  };
}

/** Convert a resolved brand into the email header/footer branding payload. */
export function brandToEmailBrand(brand: ResolvedBrand): EmailBrand {
  const info: string[] = [];
  const address = brandFullAddress(brand);
  if (address) info.push(address);
  if (brand.phone) info.push(`Phone: ${brand.phone}`);
  if (brand.email) info.push(brand.email);
  if (brand.website) info.push(brand.website);
  if (brand.taxNumber) info.push(`Tax: ${brand.taxNumber}`);
  if (brand.registrationNumber) info.push(`Reg: ${brand.registrationNumber}`);
  return {
    name: brand.name,
    logoUrl: brand.logoUrl,
    primaryColor: brand.primaryColor,
    secondaryColor: brand.secondaryColor,
    companyInfo: info,
    tagline: brand.legalName || brand.tradingName || undefined,
  };
}
