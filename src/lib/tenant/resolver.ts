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
    .from("profiles")
    .select("tenant_id, company_id")
    .eq("id", session.user.id)
    .maybeSingle();

  if (!profile) return null;

  return {
    tenantId: profile.tenant_id,
    companyId: profile.company_id,
    userId: session.user.id,
  };
}