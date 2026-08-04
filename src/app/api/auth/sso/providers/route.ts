/**
 * Public list of active SSO providers (no secrets).
 * Optional ?company_id= or ?domain=acme.com for tenant routing.
 */

import { NextRequest } from "next/server";
import { apiOk, apiError, clientIp, rateLimitStrict } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";
import { listPublicSsoProviders } from "@/lib/sso/oidc";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const ip = clientIp(req);
  const rl = await rateLimitStrict(`sso-providers:${ip}`, 60, 60_000);
  if (!rl.allowed) return apiError("RATE_LIMIT", "Too many requests", 429);

  const companyId = req.nextUrl.searchParams.get("company_id");
  const domain = req.nextUrl.searchParams.get("domain")?.toLowerCase();

  let resolvedCompany = companyId;
  if (!resolvedCompany && domain) {
    try {
      const admin = createAdminClient();
      const { data } = await admin
        .from("companies")
        .select("id")
        .ilike("email_domain", domain)
        .limit(1)
        .maybeSingle();
      if (data?.id) resolvedCompany = String(data.id);
      // also try config domains
      if (!resolvedCompany) {
        const { data: byDomain } = await admin
          .from("idm_sso_providers")
          .select("company_id, config")
          .eq("is_active", true)
          .limit(50);
        for (const row of byDomain || []) {
          const cfg = row.config as { email_domains?: string[] } | null;
          if (cfg?.email_domains?.some((d) => d.toLowerCase() === domain)) {
            resolvedCompany = String(row.company_id);
            break;
          }
        }
      }
    } catch {
      /* ignore */
    }
  }

  const providers = await listPublicSsoProviders(resolvedCompany);
  // Also expose platform Supabase OAuth if env set
  const platform: Array<{
    id: string;
    provider_code: string;
    name: string;
    protocol: string;
    mode: "platform_oauth" | "oidc";
  }> = [];

  if (process.env.NEXT_PUBLIC_SSO_AZURE === "true" || process.env.AZURE_AD_CLIENT_ID) {
    platform.push({
      id: "platform-azure",
      provider_code: "azure",
      name: "Microsoft",
      protocol: "oauth2",
      mode: "platform_oauth",
    });
  }
  if (process.env.NEXT_PUBLIC_SSO_GOOGLE === "true" || process.env.GOOGLE_OAUTH_CLIENT_ID) {
    platform.push({
      id: "platform-google",
      provider_code: "google",
      name: "Google",
      protocol: "oauth2",
      mode: "platform_oauth",
    });
  }

  return apiOk({
    providers: providers.map((p) => ({
      id: p.id,
      provider_code: p.provider_code,
      name: p.name,
      protocol: p.protocol,
      mode: "oidc" as const,
      company_id: p.company_id,
    })),
    platform,
  });
}
