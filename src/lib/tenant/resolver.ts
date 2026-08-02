/**
 * Resolve tenant and company context from the authenticated user.
 * Must be called within a server route with access to the request cookies.
 */
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export interface TenantContext {
  tenantId: string;
  companyId: string;
  userId: string;
}

export async function resolveTenantContext(): Promise<TenantContext | null> {
  const cookieStore = await cookies();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(
        cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]
      ) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // Server Component - ignore
        }
      },
    },
  });
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return null;

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("tenant_id, company_id, active_company_id")
    .eq("id", session.user.id)
    .is("deleted_at", null)
    .maybeSingle();

  if (!profile) return null;

  // Active company wins (multi-company switching); tenant is resolved from the
  // company row as the source of truth, never from client input.
  const companyId = String(profile.active_company_id || profile.company_id);
  let tenantId: string | null = profile.tenant_id ?? null;
  try {
    const { data: co } = await supabase
      .from("companies")
      .select("tenant_id")
      .eq("id", companyId)
      .maybeSingle();
    if (co?.tenant_id) tenantId = String(co.tenant_id);
  } catch {
    /* keep profile tenant */
  }

  return {
    // Fail closed: an unresolvable tenant yields an empty string rather than a
    // NULL that could match rows via PostgREST `IS NULL` semantics.
    tenantId: tenantId ?? "",
    companyId,
    userId: session.user.id,
  };
}