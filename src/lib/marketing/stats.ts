import { createAdminClient } from "@/lib/supabase/admin";
import { STATS } from "./data";

export type MarketingStat = {
  value: number;
  prefix?: string;
  suffix?: string;
  label: string;
  decimals?: number;
};

const QUERY_TIMEOUT_MS = 4000;

function withTimeout<T>(promise: PromiseLike<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("stats query timed out")), ms);
    Promise.resolve(promise).then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

async function countRows(supabase: ReturnType<typeof createAdminClient>, table: string): Promise<number> {
  const result = (await withTimeout(
    supabase.from(table).select("*", { count: "exact", head: true }),
    QUERY_TIMEOUT_MS,
  )) as { count: number | null; error: { message: string } | null };
  if (result.error) throw new Error(result.error.message);
  return result.count ?? 0;
}

async function distinctCount(supabase: ReturnType<typeof createAdminClient>, table: string, column: string): Promise<number> {
  const result = (await withTimeout(
    supabase.from(table).select(column),
    QUERY_TIMEOUT_MS,
  )) as { data: Array<Record<string, unknown>> | null; error: { message: string } | null };
  if (result.error) throw new Error(result.error.message);
  const seen = new Set<string>();
  for (const row of result.data ?? []) {
    const value = row?.[column];
    if (typeof value === "string" && value.trim()) seen.add(value);
  }
  return seen.size;
}

/**
 * Live platform metrics for the marketing stats band. Counts are sourced
 * directly from the platform database (service role, platform-level data)
 * and cached at the page level via ISR so the public site never blocks on
 * the database. Falls back to curated defaults if the database is unavailable.
 */
export async function getMarketingStats(): Promise<MarketingStat[]> {
  try {
    const supabase = createAdminClient();
    const [
      organizations,
      companies,
      users,
      countries,
      modules,
      entities,
      roles,
      permissions,
      integrations,
      events,
      logins,
      sessions,
      tickets,
      branches,
      subscriptions,
    ] = await Promise.all([
      countRows(supabase, "tenants"),
      countRows(supabase, "companies"),
      countRows(supabase, "user_profiles"),
      distinctCount(supabase, "tenants", "country_code"),
      countRows(supabase, "tenant_modules"),
      countRows(supabase, "entity_metadata"),
      countRows(supabase, "roles"),
      countRows(supabase, "role_permissions"),
      countRows(supabase, "sd_integrations"),
      countRows(supabase, "domain_events"),
      countRows(supabase, "login_history"),
      countRows(supabase, "user_sessions"),
      countRows(supabase, "support_tickets"),
      countRows(supabase, "branches"),
      countRows(supabase, "tenant_subscriptions"),
    ]);
    return [
      { value: organizations, label: "Organizations" },
      { value: companies, label: "Companies" },
      { value: users, label: "Users" },
      { value: countries, label: "Countries" },
      { value: modules, label: "ERP Modules" },
      { value: entities, label: "Business Entities" },
      { value: roles, label: "Roles & Policies" },
      { value: permissions, label: "Permissions Mapped" },
      { value: integrations, label: "Integrations" },
      { value: events, label: "Platform Events" },
      { value: logins, label: "Login Events" },
      { value: sessions, label: "Active Sessions" },
      { value: tickets, label: "Support Tickets" },
      { value: branches, label: "Branches" },
      { value: subscriptions, label: "Subscriptions" },
    ];
  } catch {
    return STATS;
  }
}