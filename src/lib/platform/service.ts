import { createClient } from "@/lib/supabase/client";
import type {
  PlatformModule,
  PlatformPlan,
  PlatformStats,
  ProvisioningJob,
  SetupStep,
  TenantSubscription,
} from "./types";
import { listDomainEvents } from "./events";

function sb() {
  return createClient();
}

export async function getPlatformStats(): Promise<PlatformStats> {
  const client = sb();
  const dayAgo = new Date(Date.now() - 86400000).toISOString();

  const [
    tenants,
    companies,
    users,
    subs,
    jobs,
    events,
    health,
  ] = await Promise.all([
    client.from("tenants").select("*", { count: "exact", head: true }).is("deleted_at", null),
    client.from("companies").select("*", { count: "exact", head: true }),
    client.from("user_profiles").select("*", { count: "exact", head: true }),
    client.from("tenant_subscriptions").select("*", { count: "exact", head: true }).eq("status", "active"),
    client.from("tenant_provisioning_jobs").select("*", { count: "exact", head: true }).in("status", ["pending", "running"]),
    client.from("domain_events").select("*", { count: "exact", head: true }).gte("created_at", dayAgo),
    client.from("platform_health_checks").select("status").order("checked_at", { ascending: false }).limit(20),
  ]);

  const checks = health.data || [];
  const healthy = checks.filter((c) => c.status === "healthy").length;

  return {
    tenants: tenants.count ?? 0,
    companies: companies.count ?? 0,
    users: users.count ?? 0,
    activeSubscriptions: subs.count ?? 0,
    openProvisionJobs: jobs.count ?? 0,
    events24h: events.count ?? 0,
    healthyChecks: healthy,
    totalChecks: checks.length,
  };
}

export async function listPlans(): Promise<PlatformPlan[]> {
  const { data, error } = await sb()
    .from("platform_plans")
    .select("*")
    .eq("status", "active")
    .order("price_monthly");
  if (error) throw error;
  return (data as PlatformPlan[]) || [];
}

export async function listPlatformModules(): Promise<PlatformModule[]> {
  const { data, error } = await sb()
    .from("platform_modules")
    .select("*")
    .eq("status", "active")
    .order("sort_order");
  if (error) throw error;
  return (data as PlatformModule[]) || [];
}

export async function listProvisioningJobs(limit = 50): Promise<ProvisioningJob[]> {
  const { data, error } = await sb()
    .from("tenant_provisioning_jobs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data as ProvisioningJob[]) || [];
}

export async function getTenantSubscription(tenantId: string): Promise<TenantSubscription | null> {
  const { data } = await sb()
    .from("tenant_subscriptions")
    .select("*")
    .eq("tenant_id", tenantId)
    .maybeSingle();
  return (data as TenantSubscription) || null;
}

export async function getSetupProgress(tenantId: string): Promise<SetupStep[]> {
  const { data, error } = await sb()
    .from("tenant_setup_progress")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("sort_order");
  if (error) throw error;
  return (data as SetupStep[]) || [];
}

export async function listFeatureFlags() {
  const { data, error } = await sb()
    .from("platform_feature_flags")
    .select("*")
    .order("category");
  if (error) throw error;
  return data || [];
}

export async function listTenantFlags(tenantId: string) {
  const { data, error } = await sb()
    .from("tenant_feature_flags")
    .select("*")
    .eq("tenant_id", tenantId);
  if (error) throw error;
  return data || [];
}

export async function setTenantFlag(tenantId: string, flagKey: string, enabled: boolean) {
  const { data, error } = await sb()
    .from("tenant_feature_flags")
    .upsert(
      { tenant_id: tenantId, flag_key: flagKey, enabled, updated_at: new Date().toISOString() },
      { onConflict: "tenant_id,flag_key" }
    )
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function listHealthChecks() {
  const { data } = await sb()
    .from("platform_health_checks")
    .select("*")
    .order("checked_at", { ascending: false })
    .limit(40);
  return data || [];
}

export async function listAnnouncements() {
  const { data } = await sb()
    .from("platform_announcements")
    .select("*")
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(20);
  return data || [];
}

export { listDomainEvents };
