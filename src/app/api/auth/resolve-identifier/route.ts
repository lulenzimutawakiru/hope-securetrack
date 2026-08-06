/**
 * Pre-auth identifier resolution for employee-ID / username login.
 *
 * Maps an "Employee ID / Username / Email" identifier to the canonical
 * email used by Supabase Auth so users can sign in with their employee ID.
 *
 * Tenant isolation:
 *   - The endpoint only ever returns an email for ACTIVE profiles.
 *   - Ambiguous identifiers (multi-company tenants) return company options
 *     and require company_code to disambiguate; nothing is returned when no
 *     unique match exists.
 *   - Responses are deliberately minimal to limit identifier enumeration;
 *     the client proceeds with a generic Supabase sign-in when unresolved.
 *   - Rate-limited; login-guard + lockout still apply at sign-in time.
 */

import { z } from "zod";
import { createApiHandler, apiOk } from "@/lib/api/handler";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const schema = z.object({
  identifier: z.string().trim().min(1).max(200),
  company_code: z.string().trim().min(1).max(50).optional().nullable(),
});

type MatchRow = {
  id: string;
  email: string;
  company_id: string;
};

type CompanyInfo = { code: string | null; name: string | null };

function uniqueMatches(rows: MatchRow[]): MatchRow[] {
  const seen = new Set<string>();
  const out: MatchRow[] = [];
  for (const r of rows) {
    const key = r.id;
    if (!seen.has(key)) {
      seen.add(key);
      out.push(r);
    }
  }
  return out;
}

export const POST = createApiHandler(
  {
    auth: false,
    requireBaselinePermission: false, // pre-auth identifier resolution
    bodySchema: schema,
    rateLimit: { limit: 40, windowMs: 60_000, key: "resolve-identifier" },
    module: "identity",
  },
  async ({ body }) => {
    const { identifier, company_code } = body as z.infer<typeof schema>;
    const admin = createAdminClient();
    const id = identifier.trim();

    // Emails sign in directly ? nothing to resolve.
    if (id.includes("@")) {
      return apiOk({ resolved: true, email: id, direct: true });
    }

    let companyId: string | null = null;
    if (company_code && company_code.trim()) {
      const { data: company } = await admin
        .from("companies")
        .select("id")
        .ilike("code", company_code.trim())
        .maybeSingle();
      companyId = company?.id ?? null;
      if (!companyId) {
        return apiOk({ resolved: false, ambiguous: false, email: null });
      }
    }

    const base = () =>
      admin
        .from("user_profiles")
        .select("id,email,company_id")
        .is("deleted_at", null)
        .eq("is_active", true);

    const [byEmp, byUsername] = await Promise.all([
      base().ilike("employee_id", id).limit(10),
      base().ilike("username", id).limit(10),
    ]);

    let matches = uniqueMatches([
      ...((byEmp.data as MatchRow[] | null) ?? []),
      ...((byUsername.data as MatchRow[] | null) ?? []),
    ]);

    if (companyId) {
      matches = matches.filter((m) => m.company_id === companyId);
    }

    if (matches.length === 0) {
      return apiOk({ resolved: false, ambiguous: false, email: null });
    }

    if (matches.length === 1) {
      return apiOk({
        resolved: true,
        ambiguous: false,
        email: matches[0].email,
      });
    }

    // Multiple companies share this identifier ? ask for the organization.
    const companyIds = [...new Set(matches.map((m) => m.company_id))];
    const { data: companies } = await admin
      .from("companies")
      .select("id,code,name")
      .in("id", companyIds);
    const infoById = new Map<string, CompanyInfo>(
      (companies ?? []).map((c) => [
        c.id,
        { code: c.code ?? null, name: c.name ?? null },
      ])
    );
    return apiOk({
      resolved: false,
      ambiguous: true,
      email: null,
      options: matches.map((m) => {
        const info = infoById.get(m.company_id);
        return {
          company_code: info?.code ?? null,
          company_name: info?.name ?? "Unknown organization",
        };
      }),
    });
  }
);
