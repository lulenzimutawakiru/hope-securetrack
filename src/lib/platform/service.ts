/**
 * Platform control-plane service — CRUD-backed (no browser Supabase client).
 */

import type {
  PlatformModule,
  PlatformPlan,
  PlatformStats,
  ProvisioningJob,
  SetupStep,
  TenantSubscription,
} from "./types";
import { listDomainEvents } from "./events";
import {
  crudCount,
  mustCreate,
  mustList,
  mustUpdate,
} from "@/lib/crud/domain-helpers";

export async function getPlatformStats(): Promise<PlatformStats> {
  const dayAgo = new Date(Date.now() - 86400000).toISOString();

  const [
    tenants,
    companies,
    users,
    activeSubscriptions,
    openProvisionJobs,
    events24h,
    health,
  ] = await Promise.all([
    crudCount("tenants"),
    crudCount("companies"),
    crudCount("user_profiles"),
    crudCount("tenant_subscriptions", { status: "active" }),
    crudCount("tenant_provisioning_jobs", {
      status: ["pending", "running"],
    }),
    crudCount("domain_events", { created_at: { gte: dayAgo } }),
    mustList<Record<string, unknown>>("platform_health_checks", {
      pageSize: 20,
      sort: "checked_at",
      order: "desc",
    }),
  ]);

  const healthy = health.filter((c) => c.status === "healthy").length;

  return {
    tenants,
    companies,
    users,
    activeSubscriptions,
    openProvisionJobs,
    events24h,
    healthyChecks: healthy,
    totalChecks: health.length,
  };
}

export async function listPlans(): Promise<PlatformPlan[]> {
  return (await mustList("platform_plans", {
    pageSize: 50,
    sort: "price_monthly",
    order: "asc",
    filters: { status: "active" },
  })) as PlatformPlan[];
}

export async function listPlatformModules(): Promise<PlatformModule[]> {
  return (await mustList("platform_modules", {
    pageSize: 100,
    sort: "sort_order",
    order: "asc",
    filters: { status: "active" },
  })) as PlatformModule[];
}

export async function listProvisioningJobs(
  limit = 50
): Promise<ProvisioningJob[]> {
  return (await mustList("tenant_provisioning_jobs", {
    pageSize: limit,
    sort: "created_at",
    order: "desc",
  })) as ProvisioningJob[];
}

export async function getTenantSubscription(
  tenantId: string
): Promise<TenantSubscription | null> {
  const rows = await mustList<TenantSubscription>("tenant_subscriptions", {
    pageSize: 1,
    filters: { tenant_id: tenantId },
  });
  return rows[0] || null;
}

export async function getSetupProgress(tenantId: string): Promise<SetupStep[]> {
  return (await mustList("tenant_setup_progress", {
    pageSize: 50,
    sort: "sort_order",
    order: "asc",
    filters: { tenant_id: tenantId },
  })) as SetupStep[];
}

export async function listFeatureFlags() {
  return mustList("platform_feature_flags", {
    pageSize: 100,
    sort: "category",
    order: "asc",
  });
}

export async function listTenantFlags(tenantId: string) {
  return mustList("tenant_feature_flags", {
    pageSize: 100,
    filters: { tenant_id: tenantId },
  });
}

export async function setTenantFlag(
  tenantId: string,
  flagKey: string,
  enabled: boolean
) {
  const existing = await mustList<Record<string, unknown>>(
    "tenant_feature_flags",
    {
      pageSize: 1,
      filters: { tenant_id: tenantId, flag_key: flagKey },
    }
  );
  if (existing[0]?.id) {
    return mustUpdate("tenant_feature_flags", String(existing[0].id), {
      enabled,
    });
  }
  return mustCreate("tenant_feature_flags", {
    tenant_id: tenantId,
    flag_key: flagKey,
    enabled,
  });
}

export async function listHealthChecks() {
  return mustList("platform_health_checks", {
    pageSize: 40,
    sort: "checked_at",
    order: "desc",
  });
}

export async function listAnnouncements() {
  return mustList("platform_announcements", {
    pageSize: 20,
    sort: "created_at",
    order: "desc",
    filters: { status: "active" },
  });
}

export { listDomainEvents };
