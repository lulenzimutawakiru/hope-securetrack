/**
 * SaaS Admin Console data layer.
 *
 * Aggregates platform-wide analytics, billing, usage, audit, security,
 * access-review, RBAC, and AI-assistant surfaces for the SecureTrack
 * control plane. Every caller MUST be a platform staff member; the API
 * routes enforce the capability matrix before calling these functions.
 *
 * All queries use the service-role admin client and are read-only.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { formatNumber } from "@/lib/utils";
import {
  PLATFORM_STAFF_ROLES,
  capabilitiesForRole,
  resolvePlatformRole,
  type PlatformStaffRole,
} from "./staff";

function admin() {
  return createAdminClient();
}

function monthLabel(d: Date): string {
  return d.toISOString().slice(0, 7);
}

function dayLabel(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function startOfUtcDay(daysAgo: number): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - daysAgo);
  return d;
}

function bucketBy<T>(
  rows: T[],
  getKey: (row: T) => string | null | undefined,
  keys: string[]
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const k of keys) out[k] = 0;
  for (const row of rows) {
    const k = getKey(row);
    if (k) {
      // Auto-discover keys when the caller passes an empty key list.
      if (out[k] === undefined) out[k] = 0;
      out[k] += 1;
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// ANALYTICS
// ---------------------------------------------------------------------------

export type SeriesPoint = { label: string; value: number };
export type LoginActivityPoint = {
  label: string;
  success: number;
  failed: number;
};

export type PlatformAnalytics = {
  generated_at: string;
  tenants_created_12m: SeriesPoint[];
  login_activity_7d: LoginActivityPoint[];
  api_requests_7d: SeriesPoint[];
  security_alerts_7d: SeriesPoint[];
  monthly_recurring_revenue: number;
  revenue_currency: string;
  plan_breakdown: Array<{ plan: string; count: number; mrr: number }>;
  totals: {
    tenants: number;
    users: number;
    active_subscriptions: number;
    mrr: number;
    api_requests_24h: number;
    failed_logins_24h: number;
    open_alerts: number;
    storage_objects: number;
  };
};

export async function getPlatformAnalytics(): Promise<PlatformAnalytics> {
  const sb = admin();
  const now = new Date();
  const dayAgo = new Date(now.getTime() - 86400000).toISOString();
  const weekAgo = startOfUtcDay(6).toISOString();
  const monthKeys: string[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getUTCFullYear(), now.getUTCMonth() - i, 1);
    monthKeys.push(monthLabel(d));
  }
  const dayKeys: string[] = [];
  for (let i = 6; i >= 0; i--) dayKeys.push(dayLabel(startOfUtcDay(i)));

  const [
    tenantRows,
    loginRows,
    apiRows,
    alertRows,
    userCount,
    subRows,
    planRows,
    storageObjects,
  ] = await Promise.all([
    sb
      .from("tenants")
      .select("created_at")
      .is("deleted_at", null)
      .limit(10000)
      .then((r) => r.data || [])
      .then(undefined, () => [] as Array<{ created_at: string | null }>),
    sb
      .from("login_history")
      .select("success,created_at")
      .gte("created_at", weekAgo)
      .limit(30000)
      .then((r) => r.data || [])
      .then(undefined, () => [] as Array<{ success: boolean | null; created_at: string | null }>),
    sb
      .from("intg_api_logs")
      .select("created_at")
      .gte("created_at", weekAgo)
      .limit(50000)
      .then((r) => r.data || [])
      .then(undefined, () => [] as Array<{ created_at: string | null }>),
    sb
      .from("security_alerts")
      .select("created_at")
      .gte("created_at", weekAgo)
      .limit(20000)
      .then((r) => r.data || [])
      .then(undefined, () => [] as Array<{ created_at: string | null }>),
    sb
      .from("user_profiles")
      .select("id", { count: "exact", head: true })
      .is("deleted_at", null)
      .then((r) => r.count ?? 0)
      .then(undefined, () => 0),
    sb
      .from("tenant_subscriptions")
      .select("plan_code,status")
      .limit(5000)
      .then((r) => r.data || [])
      .then(undefined, () => [] as Array<{ plan_code: string | null; status: string | null }>),
    sb
      .from("platform_plans")
      .select("plan_code,price_monthly,currency,status")
      .limit(200)
      .then((r) => r.data || [])
      .then(undefined, () => [] as Array<{ plan_code: string | null; price_monthly: number | null; currency: string | null; status: string | null }>),
    sb
      .from("storage.objects")
      .select("id", { count: "exact", head: true })
      .then((r) => r.count ?? 0)
      .then(undefined, () => 0),
  ]);

  const priceByPlan = new Map<string, number>();
  let currency = "UGX";
  for (const p of planRows) {
    if (!p.plan_code) continue;
    if (!priceByPlan.has(p.plan_code)) {
      priceByPlan.set(p.plan_code, Number(p.price_monthly) || 0);
    }
    if (p.currency) currency = p.currency;
  }

  const tenantsByMonth = bucketBy(
    tenantRows as Array<{ created_at: string | null }>,
    (r) => (r.created_at ? monthLabel(new Date(r.created_at)) : null),
    monthKeys
  );
  const loginsByDay = bucketBy(
    (loginRows as Array<{ success: boolean | null; created_at: string | null }>).filter(
      (r) => r.success === true
    ),
    (r) => (r.created_at ? dayLabel(new Date(r.created_at)) : null),
    dayKeys
  );
  const failedByDay = bucketBy(
    (loginRows as Array<{ success: boolean | null; created_at: string | null }>).filter(
      (r) => r.success === false
    ),
    (r) => (r.created_at ? dayLabel(new Date(r.created_at)) : null),
    dayKeys
  );
  const apiByDay = bucketBy(
    apiRows as Array<{ created_at: string | null }>,
    (r) => (r.created_at ? dayLabel(new Date(r.created_at)) : null),
    dayKeys
  );
  const alertsByDay = bucketBy(
    alertRows as Array<{ created_at: string | null }>,
    (r) => (r.created_at ? dayLabel(new Date(r.created_at)) : null),
    dayKeys
  );

  let mrr = 0;
  const activeSubs = (subRows as Array<{ plan_code: string | null; status: string | null }>).filter(
    (s) => s.status === "active"
  );
  const planCount = new Map<string, number>();
  const planMrr = new Map<string, number>();
  for (const s of activeSubs) {
    const code = s.plan_code || "starter";
    const price = priceByPlan.get(code) ?? 0;
    mrr += price;
    planCount.set(code, (planCount.get(code) || 0) + 1);
    planMrr.set(code, (planMrr.get(code) || 0) + price);
  }

  const failedLogins24h = (loginRows as Array<{ success: boolean | null; created_at: string | null }>).filter(
    (r) => r.success === false && r.created_at != null && r.created_at >= dayAgo
  ).length;
  const api24h = (apiRows as Array<{ created_at: string | null }>).filter(
    (r) => r.created_at != null && r.created_at >= dayAgo
  ).length;

  return {
    generated_at: new Date().toISOString(),
    tenants_created_12m: monthKeys.map((label) => ({
      label,
      value: tenantsByMonth[label] ?? 0,
    })),
    login_activity_7d: dayKeys.map((label) => ({
      label: label.slice(5),
      success: loginsByDay[label] ?? 0,
      failed: failedByDay[label] ?? 0,
    })),
    api_requests_7d: dayKeys.map((label) => ({
      label: label.slice(5),
      value: apiByDay[label] ?? 0,
    })),
    security_alerts_7d: dayKeys.map((label) => ({
      label: label.slice(5),
      value: alertsByDay[label] ?? 0,
    })),
    monthly_recurring_revenue: mrr,
    revenue_currency: currency,
    plan_breakdown: [...planCount.entries()]
      .map(([plan, count]) => ({
        plan,
        count,
        mrr: planMrr.get(plan) ?? 0,
      }))
      .sort((a, b) => b.count - a.count),
    totals: {
      tenants: tenantRows.length,
      users: userCount,
      active_subscriptions: activeSubs.length,
      mrr,
      api_requests_24h: api24h,
      failed_logins_24h: failedLogins24h,
      open_alerts: alertsByDay[dayKeys[dayKeys.length - 1]] ?? 0,
      storage_objects: storageObjects,
    },
  };
}

// ---------------------------------------------------------------------------
// BILLING
// ---------------------------------------------------------------------------

export type SubscriptionStatus =
  | "active"
  | "trial"
  | "past_due"
  | "suspended"
  | "cancelled";

export type BillingSubscriptionRow = {
  tenant_id: string | null;
  tenant_name: string | null;
  tenant_slug: string | null;
  tenant_status: string | null;
  plan_code: string | null;
  status: string | null;
  seats: number | null;
  billing_email: string | null;
  current_period_end: string | null;
  trial_ends_at: string | null;
  created_at: string | null;
};

export type BillingOverview = {
  generated_at: string;
  mrr: number;
  arr: number;
  currency: string;
  counts: Record<SubscriptionStatus, number>;
  renewals_7d: number;
  renewals_30d: number;
  trials_expiring_7d: number;
  past_due_tenants: number;
  per_plan: Array<{ plan: string; count: number; mrr: number }>;
  recent: BillingSubscriptionRow[];
};

export async function getBillingOverview(): Promise<BillingOverview> {
  const sb = admin();
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const in7 = new Date(now.getTime() + 7 * 86400000).toISOString().slice(0, 10);
  const in30 = new Date(now.getTime() + 30 * 86400000).toISOString().slice(0, 10);
  const in7ts = new Date(now.getTime() + 7 * 86400000).toISOString();

  const [subRows, tenantRows, planRows] = await Promise.all([
    sb
      .from("tenant_subscriptions")
      .select(
        "tenant_id,plan_code,status,seats,billing_email,current_period_end,trial_ends_at,created_at"
      )
      .limit(5000)
      .then((r) => r.data || [])
      .then(undefined, () => []),
    sb
      .from("tenants")
      .select("id,name,slug,status")
      .is("deleted_at", null)
      .limit(5000)
      .then((r) => r.data || [])
      .then(undefined, () => []),
    sb
      .from("platform_plans")
      .select("plan_code,price_monthly,currency")
      .limit(200)
      .then((r) => r.data || [])
      .then(undefined, () => []),
  ]);

  const tenantMeta = new Map<
    string,
    { name: string; slug: string; status: string }
  >();
  for (const t of tenantRows as Array<{
    id: string;
    name: string;
    slug: string;
    status: string | null;
  }>) {
    tenantMeta.set(t.id, {
      name: t.name,
      slug: t.slug,
      status: t.status ?? "",
    });
  }

  const priceByPlan = new Map<string, number>();
  let currency = "UGX";
  for (const p of planRows as Array<{
    plan_code: string | null;
    price_monthly: number | null;
    currency: string | null;
  }>) {
    if (p.plan_code && !priceByPlan.has(p.plan_code)) {
      priceByPlan.set(p.plan_code, Number(p.price_monthly) || 0);
    }
    if (p.currency) currency = p.currency;
  }

  const counts: Record<SubscriptionStatus, number> = {
    active: 0,
    trial: 0,
    past_due: 0,
    suspended: 0,
    cancelled: 0,
  };
  let mrr = 0;
  let renewals7 = 0;
  let renewals30 = 0;
  let trials7 = 0;
  let pastDue = 0;
  const planCount = new Map<string, number>();
  const planMrr = new Map<string, number>();

  const subs = subRows as Array<{
    tenant_id: string | null;
    plan_code: string | null;
    status: string | null;
    seats: number | null;
    billing_email: string | null;
    current_period_end: string | null;
    trial_ends_at: string | null;
    created_at: string | null;
  }>;

  for (const s of subs) {
    const status = (s.status || "active") as SubscriptionStatus;
    if (counts[status] !== undefined) counts[status] += 1;
    const plan = s.plan_code || "starter";
    const price = priceByPlan.get(plan) ?? 0;
    if (status === "active") {
      mrr += price;
      planCount.set(plan, (planCount.get(plan) || 0) + 1);
      planMrr.set(plan, (planMrr.get(plan) || 0) + price);
    }
    if (s.current_period_end) {
      const end = String(s.current_period_end).slice(0, 10);
      if (end >= today && end <= in30) renewals30 += 1;
      if (end >= today && end <= in7) renewals7 += 1;
    }
    if (status === "trial" && s.trial_ends_at) {
      const te = new Date(s.trial_ends_at).getTime();
      if (te >= now.getTime() && te <= now.getTime() + 7 * 86400000) trials7 += 1;
    }
    if (status === "past_due") pastDue += 1;
  }

  const recent = subs
    .slice()
    .sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")))
    .slice(0, 12)
    .map((s) => {
      const meta = s.tenant_id ? tenantMeta.get(s.tenant_id) : undefined;
      return {
        tenant_id: s.tenant_id,
        tenant_name: meta?.name ?? null,
        tenant_slug: meta?.slug ?? null,
        tenant_status: meta?.status ?? null,
        plan_code: s.plan_code,
        status: s.status,
        seats: s.seats,
        billing_email: s.billing_email,
        current_period_end: s.current_period_end
          ? String(s.current_period_end).slice(0, 10)
          : null,
        trial_ends_at: s.trial_ends_at,
        created_at: s.created_at,
      };
    });

  return {
    generated_at: new Date().toISOString(),
    mrr,
    arr: mrr * 12,
    currency,
    counts,
    renewals_7d: renewals7,
    renewals_30d: renewals30,
    trials_expiring_7d: trials7,
    past_due_tenants: pastDue,
    per_plan: [...planCount.entries()]
      .map(([plan, count]) => ({ plan, count, mrr: planMrr.get(plan) ?? 0 }))
      .sort((a, b) => b.count - a.count),
    recent,
  };
}

// ---------------------------------------------------------------------------
// USAGE METERING
// ---------------------------------------------------------------------------

export type TenantUsageRow = {
  tenant_id: string | null;
  tenant_name: string | null;
  tenant_slug: string | null;
  tenant_status: string | null;
  plan_code: string | null;
  seats: number | null;
  seat_pct: number | null;
  users: number;
  companies: number;
  modules_enabled: number;
  api_requests_30d: number;
  api_errors_30d: number;
  api_error_rate: number | null;
};

export type UsageOverview = {
  generated_at: string;
  rows: TenantUsageRow[];
  totals: {
    users: number;
    companies: number;
    modules_enabled: number;
    api_requests_30d: number;
    api_errors_30d: number;
    over_capacity: number;
  };
  top_by_api: TenantUsageRow[];
};

export async function getUsageOverview(): Promise<UsageOverview> {
  const sb = admin();
  const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString();

  const [tenantRows, subRows, userRows, companyRows, moduleRows, apiRows] =
    await Promise.all([
      sb
        .from("tenants")
        .select("id,name,slug,status,plan_code,max_users")
        .is("deleted_at", null)
        .limit(2000)
        .then((r) => r.data || [])
        .then(undefined, () => []),
      sb
        .from("tenant_subscriptions")
        .select("tenant_id,plan_code,seats")
        .limit(5000)
        .then((r) => r.data || [])
        .then(undefined, () => []),
      sb
        .from("user_profiles")
        .select("tenant_id")
        .is("deleted_at", null)
        .limit(30000)
        .then((r) => r.data || [])
        .then(undefined, () => []),
      sb
        .from("companies")
        .select("id,tenant_id")
        .is("deleted_at", null)
        .limit(30000)
        .then((r) => r.data || [])
        .then(undefined, () => []),
      sb
        .from("tenant_modules")
        .select("tenant_id,enabled")
        .limit(30000)
        .then((r) => r.data || [])
        .then(undefined, () => []),
      sb
        .from("intg_api_logs")
        .select("company_id,status_code")
        .gte("created_at", monthAgo)
        .limit(50000)
        .then((r) => r.data || [])
        .then(undefined, () => []),
    ]);

  const tenantMap = new Map<
    string,
    {
      name: string;
      slug: string;
      status: string;
      plan_code: string | null;
      max_users: number | null;
    }
  >();
  for (const t of tenantRows as Array<{
    id: string;
    name: string;
    slug: string;
    status: string | null;
    plan_code: string | null;
    max_users: number | null;
  }>) {
    tenantMap.set(t.id, {
      name: t.name,
      slug: t.slug,
      status: t.status ?? "",
      plan_code: t.plan_code,
      max_users: t.max_users,
    });
  }

  const seatByTenant = new Map<string, number>();
  const planByTenant = new Map<string, string>();
  for (const s of subRows as Array<{ tenant_id: string | null; plan_code: string | null; seats: number | null }>) {
    if (!s.tenant_id) continue;
    if (s.seats != null) seatByTenant.set(s.tenant_id, s.seats);
    if (s.plan_code) planByTenant.set(s.tenant_id, s.plan_code);
  }

  const companyIdToTenant = new Map<string, string>();
  for (const c of companyRows as Array<{
    id: string;
    tenant_id: string | null;
  }>) {
    if (c.tenant_id) companyIdToTenant.set(c.id, c.tenant_id);
  }

  const usersByTenant = bucketBy(
    userRows as Array<{ tenant_id: string | null }>,
    (r) => r.tenant_id,
    []
  );
  const companiesByTenant = bucketBy(
    companyRows as Array<{ tenant_id: string | null }>,
    (r) => r.tenant_id,
    []
  );
  const modulesByTenant = bucketBy(
    (moduleRows as Array<{ tenant_id: string | null; enabled: boolean | null }>).filter(
      (r) => r.enabled === true
    ),
    (r) => r.tenant_id,
    []
  );

  const apiByTenant = new Map<string, { total: number; errors: number }>();
  for (const r of apiRows as Array<{
    company_id: string | null;
    status_code: number | null;
  }>) {
    if (!r.company_id) continue;
    const tid = companyIdToTenant.get(r.company_id);
    if (!tid) continue;
    const cur = apiByTenant.get(tid) ?? { total: 0, errors: 0 };
    cur.total += 1;
    if (r.status_code != null && r.status_code >= 400) cur.errors += 1;
    apiByTenant.set(tid, cur);
  }

  const rows: TenantUsageRow[] = [...tenantMap.entries()].map(([tid, t]) => {
    const users = usersByTenant[tid] ?? 0;
    const seats = seatByTenant.get(tid) ?? null;
    const api = apiByTenant.get(tid) ?? { total: 0, errors: 0 };
    const seatPct =
      seats && seats > 0 ? Math.min(100, Math.round((users / seats) * 100)) : null;
    return {
      tenant_id: tid,
      tenant_name: t.name,
      tenant_slug: t.slug,
      tenant_status: t.status,
      plan_code: planByTenant.get(tid) ?? t.plan_code,
      seats,
      seat_pct: seatPct,
      users,
      companies: companiesByTenant[tid] ?? 0,
      modules_enabled: modulesByTenant[tid] ?? 0,
      api_requests_30d: api.total,
      api_errors_30d: api.errors,
      api_error_rate:
        api.total > 0 ? Math.round((api.errors / api.total) * 1000) / 10 : null,
    };
  });

  rows.sort((a, b) => b.users - a.users);

  const topByApi = rows
    .slice()
    .sort((a, b) => b.api_requests_30d - a.api_requests_30d)
    .slice(0, 10);

  const totals = rows.reduce(
    (acc, r) => {
      acc.users += r.users;
      acc.companies += r.companies;
      acc.modules_enabled += r.modules_enabled;
      acc.api_requests_30d += r.api_requests_30d;
      acc.api_errors_30d += r.api_errors_30d;
      if (r.seats && r.seats > 0 && r.users > r.seats) acc.over_capacity += 1;
      return acc;
    },
    { users: 0, companies: 0, modules_enabled: 0, api_requests_30d: 0, api_errors_30d: 0, over_capacity: 0 }
  );

  return {
    generated_at: new Date().toISOString(),
    rows,
    totals,
    top_by_api: topByApi,
  };
}

// ---------------------------------------------------------------------------
// AUDIT LOG EXPLORER
// ---------------------------------------------------------------------------

export type AuditRecord = {
  id: string;
  user_email: string | null;
  action: string;
  module: string | null;
  entity_reference: string | null;
  ip_address: string | null;
  metadata: Record<string, unknown> | null;
  tenant_id: string | null;
  tenant_name: string | null;
  created_at: string | null;
  source: "audit_logs" | "tenant_audit";
};

export type AuditLogsResult = {
  generated_at: string;
  total: number;
  records: AuditRecord[];
  actions: string[];
  modules: string[];
};

export async function getAuditLogs(opts?: {
  search?: string;
  action?: string;
  limit?: number;
}): Promise<AuditLogsResult> {
  const sb = admin();
  const limit = Math.min(Math.max(opts?.limit ?? 300, 1), 1000);
  const search = (opts?.search ?? "").trim().toLowerCase();

  const [auditRows, tenantAuditRows, companyRows, tenantRows] = await Promise.all([
    sb
      .from("audit_logs")
      .select(
        "id,user_email,action,module,entity_reference,ip_address,metadata,company_id,created_at"
      )
      .order("created_at", { ascending: false })
      .limit(2000)
      .then((r) => r.data || [])
      .then(undefined, () => []),
    sb
      .from("tenant_audit")
      .select(
        "id,actor_id,action,details,tenant_id,company_id,created_at"
      )
      .order("created_at", { ascending: false })
      .limit(2000)
      .then((r) => r.data || [])
      .then(undefined, () => []),
    sb
      .from("companies")
      .select("id,tenant_id")
      .is("deleted_at", null)
      .limit(30000)
      .then((r) => r.data || [])
      .then(undefined, () => []),
    sb
      .from("tenants")
      .select("id,name")
      .is("deleted_at", null)
      .limit(5000)
      .then((r) => r.data || [])
      .then(undefined, () => []),
  ]);

  const companyTenant = new Map<string, string>();
  for (const c of companyRows as Array<{ id: string; tenant_id: string | null }>) {
    if (c.tenant_id) companyTenant.set(c.id, c.tenant_id);
  }
  const tenantName = new Map<string, string>();
  for (const t of tenantRows as Array<{ id: string; name: string }>) {
    tenantName.set(t.id, t.name);
  }

  const records: AuditRecord[] = [];
  for (const r of auditRows as Array<{
    id: string;
    user_email: string | null;
    action: string | null;
    module: string | null;
    entity_reference: string | null;
    ip_address: string | null;
    metadata: Record<string, unknown> | null;
    company_id: string | null;
    created_at: string | null;
  }>) {
    const tid = r.company_id ? companyTenant.get(r.company_id) ?? null : null;
    records.push({
      id: r.id,
      user_email: r.user_email,
      action: r.action ?? "unknown",
      module: r.module,
      entity_reference: r.entity_reference,
      ip_address: r.ip_address ? String(r.ip_address) : null,
      metadata: r.metadata,
      tenant_id: tid,
      tenant_name: tid ? tenantName.get(tid) ?? null : null,
      created_at: r.created_at,
      source: "audit_logs",
    });
  }

  for (const r of tenantAuditRows as Array<{
    id: string;
    action: string | null;
    details: string | null;
    tenant_id: string | null;
    created_at: string | null;
  }>) {
    records.push({
      id: r.id,
      user_email: null,
      action: r.action ?? "unknown",
      module: "tenant",
      entity_reference: r.details,
      ip_address: null,
      metadata: null,
      tenant_id: r.tenant_id,
      tenant_name: r.tenant_id ? tenantName.get(r.tenant_id) ?? null : null,
      created_at: r.created_at,
      source: "tenant_audit",
    });
  }

  const actions = [...new Set(records.map((r) => r.action))].sort();
  const modules = [...new Set(records.map((r) => r.module ?? "other"))].sort();

  const filtered = records.filter((r) => {
    if (opts?.action && r.action !== opts.action) return false;
    if (!search) return true;
    const hay = [
      r.user_email,
      r.action,
      r.module,
      r.entity_reference,
      r.tenant_name,
      r.ip_address,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return hay.includes(search);
  });

  return {
    generated_at: new Date().toISOString(),
    total: filtered.length,
    records: filtered.slice(0, limit),
    actions,
    modules,
  };
}

// ---------------------------------------------------------------------------
// SECURITY OPERATIONS CENTER
// ---------------------------------------------------------------------------

export type SecurityEvent = {
  id: string;
  kind: "alert" | "failed_login" | "blocked_ip" | "event";
  severity: string;
  title: string;
  description: string | null;
  tenant_id: string | null;
  tenant_name: string | null;
  ip_address: string | null;
  status: string | null;
  created_at: string | null;
};

export type SecurityOverview = {
  generated_at: string;
  score: number;
  open_alerts: number;
  critical_alerts: number;
  failed_logins_24h: number;
  failed_logins_7d: number;
  failed_logins_daily: LoginActivityPoint[];
  active_sessions: number;
  blocked_ips_7d: number;
  distinct_blocked_ips: number;
  mfa_users: number;
  total_users: number;
  mfa_coverage_pct: number;
  platform_admins: number;
  events: SecurityEvent[];
};

export async function getSecurityOverview(): Promise<SecurityOverview> {
  const sb = admin();
  const dayAgo = new Date(Date.now() - 86400000).toISOString();
  const weekAgo = startOfUtcDay(6).toISOString();
  const dayKeys: string[] = [];
  for (let i = 6; i >= 0; i--) dayKeys.push(dayLabel(startOfUtcDay(i)));

  const [alertRows, loginRows, sessionCount, blockEvents, mfaCount, totalUsers, adminCount, tenantRows] =
    await Promise.all([
      sb
        .from("security_alerts")
        .select("id,alert_type,severity,title,description,status,ip_address,created_at")
        .in("status", ["open", "new", "investigating"])
        .order("created_at", { ascending: false })
        .limit(200)
        .then((r) => r.data || [])
        .then(undefined, () => []),
      sb
        .from("login_history")
        .select("success,ip_address,email,created_at")
        .eq("success", false)
        .gte("created_at", weekAgo)
        .order("created_at", { ascending: false })
        .limit(30000)
        .then((r) => r.data || [])
        .then(undefined, () => []),
      sb
        .from("user_sessions")
        .select("id", { count: "exact", head: true })
        .eq("is_active", true)
        .then((r) => r.count ?? 0)
        .then(undefined, () => 0),
      sb
        .from("domain_events")
        .select("id,event_type,payload,metadata,severity,created_at")
        .ilike("event_type", "%block%")
        .gte("created_at", weekAgo)
        .order("created_at", { ascending: false })
        .limit(2000)
        .then((r) => r.data || [])
        .then(undefined, () => []),
      sb
        .from("user_profiles")
        .select("id", { count: "exact", head: true })
        .eq("mfa_enabled", true)
        .is("deleted_at", null)
        .then((r) => r.count ?? 0)
        .then(undefined, () => 0),
      sb
        .from("user_profiles")
        .select("id", { count: "exact", head: true })
        .is("deleted_at", null)
        .then((r) => r.count ?? 0)
        .then(undefined, () => 0),
      sb
        .from("user_profiles")
        .select("id", { count: "exact", head: true })
        .eq("is_platform_admin", true)
        .then((r) => r.count ?? 0)
        .then(undefined, () => 0),
      sb
        .from("tenants")
        .select("id,name")
        .is("deleted_at", null)
        .limit(5000)
        .then((r) => r.data || [])
        .then(undefined, () => []),
    ]);

  const tenantName = new Map<string, string>();
  for (const t of tenantRows as Array<{ id: string; name: string }>) {
    tenantName.set(t.id, t.name);
  }

  const failed = loginRows as Array<{
    ip_address: string | null;
    email: string | null;
    created_at: string | null;
  }>;
  const failed24h = failed.filter(
    (r) => r.created_at != null && r.created_at >= dayAgo
  ).length;
  const failedByDay = bucketBy(
    failed,
    (r) => (r.created_at ? dayLabel(new Date(r.created_at)) : null),
    dayKeys
  );

  const alerts = alertRows as Array<{
    id: string;
    alert_type: string | null;
    severity: string | null;
    title: string;
    description: string | null;
    status: string | null;
    ip_address: string | null;
    created_at: string | null;
  }>;
  const critical = alerts.filter((a) => a.severity === "critical").length;

  const blocks = blockEvents as Array<{
    id: string;
    event_type: string | null;
    payload: Record<string, unknown> | null;
    metadata: Record<string, unknown> | null;
    severity: string | null;
    created_at: string | null;
  }>;
  const blockedIps = new Set<string>();
  for (const b of blocks) {
    const candidates = [
      b.payload?.ip,
      b.payload?.ip_address,
      b.metadata?.ip,
      b.metadata?.ip_address,
      b.metadata?.blocked_ip,
    ];
    for (const c of candidates) {
      if (typeof c === "string" && c.includes(".")) blockedIps.add(c);
    }
  }

  const events: SecurityEvent[] = [
    ...alerts.slice(0, 50).map((a) => ({
      id: a.id,
      kind: "alert" as const,
      severity: a.severity ?? "medium",
      title: a.title,
      description: a.description,
      tenant_id: null,
      tenant_name: null,
      ip_address: a.ip_address ? String(a.ip_address) : null,
      status: a.status,
      created_at: a.created_at,
    })),
    ...failed.slice(0, 50).map((f, i) => ({
      id: `login-${i}-${f.created_at ?? ""}`,
      kind: "failed_login" as const,
      severity: "high",
      title: "Failed authentication attempt",
      description: f.email ? `Attempt for ${f.email}` : "Attempt with unknown identity",
      tenant_id: null,
      tenant_name: null,
      ip_address: f.ip_address ? String(f.ip_address) : null,
      status: null,
      created_at: f.created_at,
    })),
    ...blocks.slice(0, 30).map((b) => ({
      id: b.id,
      kind: "blocked_ip" as const,
      severity: b.severity ?? "high",
      title: b.event_type ?? "IP blocked",
      description: null,
      tenant_id: null,
      tenant_name: null,
      ip_address: null,
      status: null,
      created_at: b.created_at,
    })),
  ].sort((a, b) =>
    String(b.created_at || "").localeCompare(String(a.created_at || ""))
  );

  let score = 100;
  score -= Math.min(40, alerts.length * 2);
  score -= Math.min(30, critical * 3);
  score -= Math.min(25, Math.floor(failed24h / 10));
  score -= Math.min(15, blockedIps.size * 2);
  score = Math.max(0, score);

  return {
    generated_at: new Date().toISOString(),
    score,
    open_alerts: alerts.length,
    critical_alerts: critical,
    failed_logins_24h: failed24h,
    failed_logins_7d: failed.length,
    failed_logins_daily: dayKeys.map((label) => ({
      label: label.slice(5),
      success: 0,
      failed: failedByDay[label] ?? 0,
    })),
    active_sessions: sessionCount,
    blocked_ips_7d: blocks.length,
    distinct_blocked_ips: blockedIps.size,
    mfa_users: mfaCount,
    total_users: totalUsers,
    mfa_coverage_pct:
      totalUsers > 0 ? Math.round((mfaCount / totalUsers) * 100) : 0,
    platform_admins: adminCount,
    events: events.slice(0, 100),
  };
}

// ---------------------------------------------------------------------------
// ACCESS REVIEWS (privileged staff)
// ---------------------------------------------------------------------------

export type StaffMember = {
  id: string;
  email: string | null;
  name: string | null;
  role_code: PlatformStaffRole | null;
  role_label: string;
  is_legacy: boolean;
  mfa_enabled: boolean | null;
  is_active: boolean | null;
  last_login_at: string | null;
  capabilities: number;
  capability_ids: string[];
};

export type AccessReviewSummary = {
  generated_at: string;
  staff: StaffMember[];
  totals: {
    platform_admins: number;
    legacy_admins: number;
    without_mfa: number;
    roles: number;
    permissions: number;
    role_permissions: number;
    active_users: number;
  };
  capability_matrix: Array<{
    role: PlatformStaffRole;
    label: string;
    capabilities: Array<{ id: string; title: string }>;
  }>;
};

export async function getAccessReviewSummary(): Promise<AccessReviewSummary> {
  const sb = admin();
  const [staffRows, roleCount, permCount, rpCount, activeUsers] =
    await Promise.all([
      sb
        .from("user_profiles")
        .select(
          "id,email,first_name,last_name,platform_role,mfa_enabled,is_active,last_login_at,tenant_id,is_platform_admin"
        )
        .limit(10000)
        .then((r) => r.data || [])
        .then(undefined, () => []),
      sb
        .from("roles")
        .select("id", { count: "exact", head: true })
        .then((r) => r.count ?? 0)
        .then(undefined, () => 0),
      sb
        .from("permissions")
        .select("id", { count: "exact", head: true })
        .then((r) => r.count ?? 0)
        .then(undefined, () => 0),
      sb
        .from("role_permissions")
        .select("role_id", { count: "exact", head: true })
        .then((r) => r.count ?? 0)
        .then(undefined, () => 0),
      sb
        .from("user_profiles")
        .select("id", { count: "exact", head: true })
        .eq("is_active", true)
        .is("deleted_at", null)
        .then((r) => r.count ?? 0)
        .then(undefined, () => 0),
    ]);

  const staff: StaffMember[] = [];
  let legacy = 0;
  let withoutMfa = 0;
  for (const p of staffRows as Array<{
    id: string;
    email: string | null;
    first_name: string | null;
    last_name: string | null;
    platform_role: string | null;
    mfa_enabled: boolean | null;
    is_active: boolean | null;
    last_login_at: string | null;
    tenant_id: string | null;
    is_platform_admin: boolean | null;
  }>) {
    if (!(p.is_platform_admin === true) || p.tenant_id) continue;
    const resolved = resolvePlatformRole(p);
    if (!resolved) continue; // unknown platform_role: excluded (fail closed)
    if (resolved.isLegacy) legacy += 1;
    if (!p.mfa_enabled) withoutMfa += 1;
    const caps = capabilitiesForRole(resolved.role);
    staff.push({
      id: p.id,
      email: p.email,
      name: [p.first_name, p.last_name].filter(Boolean).join(" ") || null,
      role_code: resolved.role,
      role_label: resolved.label,
      is_legacy: resolved.isLegacy,
      mfa_enabled: p.mfa_enabled,
      is_active: p.is_active,
      last_login_at: p.last_login_at,
      capabilities: caps.length,
      capability_ids: caps.map((c) => c.id),
    });
  }
  staff.sort((a, b) => (a.role_code ?? "").localeCompare(b.role_code ?? ""));

  const capability_matrix = PLATFORM_STAFF_ROLES.map((r) => ({
    role: r.code,
    label: r.label,
    capabilities: capabilitiesForRole(r.code).map((c) => ({
      id: c.id,
      title: c.title,
    })),
  }));

  return {
    generated_at: new Date().toISOString(),
    staff,
    totals: {
      platform_admins: staff.length,
      legacy_admins: legacy,
      without_mfa: withoutMfa,
      roles: roleCount,
      permissions: permCount,
      role_permissions: rpCount,
      active_users: activeUsers,
    },
    capability_matrix,
  };
}

// ---------------------------------------------------------------------------
// RBAC CATALOG (roles & permissions matrix)
// ---------------------------------------------------------------------------

export type RoleRow = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  is_system: boolean;
  is_active: boolean;
  company_id: string | null;
  permission_count: number;
  user_count: number;
};

export type PermissionRow = {
  id: string;
  name: string;
  slug: string;
  module: string;
};

export type RolesMatrix = {
  generated_at: string;
  roles: RoleRow[];
  permissions: PermissionRow[];
  modules: string[];
  platform_roles: Array<{
    code: PlatformStaffRole;
    label: string;
    description: string;
    capabilities: string[];
  }>;
  totals: {
    roles: number;
    permissions: number;
    role_permissions: number;
    users_with_roles: number;
  };
};

export async function getRolesMatrix(): Promise<RolesMatrix> {
  const sb = admin();
  const [roleRows, permRows, rpRows, userRows] = await Promise.all([
    sb
      .from("roles")
      .select("id,name,slug,description,is_system,is_active,company_id")
      .order("name", { ascending: true })
      .limit(1000)
      .then((r) => r.data || [])
      .then(undefined, () => []),
    sb
      .from("permissions")
      .select("id,name,slug,module")
      .order("module", { ascending: true })
      .limit(3000)
      .then((r) => r.data || [])
      .then(undefined, () => []),
    sb
      .from("role_permissions")
      .select("role_id,permission_id")
      .limit(20000)
      .then((r) => r.data || [])
      .then(undefined, () => []),
    sb
      .from("user_profiles")
      .select("role_id")
      .is("deleted_at", null)
      .limit(30000)
      .then((r) => r.data || [])
      .then(undefined, () => []),
  ]);

  const permCountByRole = new Map<string, number>();
  for (const rp of rpRows as Array<{ role_id: string | null }>) {
    if (!rp.role_id) continue;
    permCountByRole.set(rp.role_id, (permCountByRole.get(rp.role_id) || 0) + 1);
  }
  const userCountByRole = new Map<string, number>();
  for (const u of userRows as Array<{ role_id: string | null }>) {
    if (!u.role_id) continue;
    userCountByRole.set(u.role_id, (userCountByRole.get(u.role_id) || 0) + 1);
  }

  const roles: RoleRow[] = (roleRows as Array<{
    id: string;
    name: string;
    slug: string;
    description: string | null;
    is_system: boolean | null;
    is_active: boolean | null;
    company_id: string | null;
  }>).map((r) => ({
    id: r.id,
    name: r.name,
    slug: r.slug,
    description: r.description,
    is_system: Boolean(r.is_system),
    is_active: r.is_active !== false,
    company_id: r.company_id,
    permission_count: permCountByRole.get(r.id) ?? 0,
    user_count: userCountByRole.get(r.id) ?? 0,
  }));

  const permissions: PermissionRow[] = (permRows as Array<{
    id: string;
    name: string;
    slug: string;
    module: string;
  }>).map((p) => ({
    id: p.id,
    name: p.name,
    slug: p.slug,
    module: p.module,
  }));

  return {
    generated_at: new Date().toISOString(),
    roles,
    permissions,
    modules: [...new Set(permissions.map((p) => p.module))].sort(),
    platform_roles: PLATFORM_STAFF_ROLES.map((r) => ({
      code: r.code,
      label: r.label,
      description: r.description,
      capabilities: capabilitiesForRole(r.code).map((c) => c.id),
    })),
    totals: {
      roles: roles.length,
      permissions: permissions.length,
      role_permissions: rpRows.length,
      users_with_roles: userRows.length,
    },
  };
}

// ---------------------------------------------------------------------------
// AI ADMIN ASSISTANT (rule-based, tenant-isolated, read-only)
// ---------------------------------------------------------------------------

export type AssistantIntent =
  | "overdue_billing"
  | "security_risks"
  | "revenue"
  | "resource_usage"
  | "failed_integrations"
  | "tenant_overview"
  | "health"
  | "help";

export type AssistantResponse = {
  intent: AssistantIntent;
  answer: string;
  facts: Array<{ label: string; value: string | number }>;
  suggestions: string[];
  generated_at: string;
};

const INTENT_RULES: Array<{ intent: AssistantIntent; keywords: string[] }> = [
  {
    intent: "overdue_billing",
    keywords: ["overdue", "unpaid", "payment", "dunning", "past due", "owes"],
  },
  {
    intent: "security_risks",
    keywords: ["security", "risk", "threat", "breach", "suspicious", "anomal", "attack", "intrusion"],
  },
  {
    intent: "revenue",
    keywords: ["revenue", "mrr", "arr", "income", "earning", "recurring"],
  },
  {
    intent: "resource_usage",
    keywords: ["resource", "usage", "most", "consume", "storage", "capacity", "heavy"],
  },
  {
    intent: "failed_integrations",
    keywords: ["integration", "webhook", "connector"],
  },
  {
    intent: "health",
    keywords: ["health", "uptime", "down", "outage", "latency", "incident", "status"],
  },
  {
    intent: "tenant_overview",
    keywords: ["tenant", "organization", "organisation", "companies"],
  },
];

const SUGGESTIONS: Record<AssistantIntent, string[]> = {
  overdue_billing: [
    "Show tenants with overdue payments",
    "Which subscriptions are past due?",
    "Generate revenue report",
  ],
  security_risks: [
    "Find security risks",
    "Show recent failed logins",
    "List open security alerts",
  ],
  revenue: [
    "Generate revenue report",
    "Show monthly recurring revenue",
    "Which tenants use the most resources?",
  ],
  resource_usage: [
    "Which tenants use the most resources?",
    "Show tenants over their seat capacity",
    "Top API consumers",
  ],
  failed_integrations: [
    "Show failed integrations",
    "Any webhook errors this week?",
  ],
  tenant_overview: [
    "How many tenants are active?",
    "List recent tenants",
  ],
  health: [
    "Platform health status",
    "Any outages right now?",
  ],
  help: [
    "Show tenants with overdue payments",
    "Find security risks",
    "Generate revenue report",
    "Which tenants use the most resources?",
    "Show failed integrations",
  ],
};

export function classifyAssistantIntent(query: string): AssistantIntent {
  const q = query.toLowerCase();
  for (const rule of INTENT_RULES) {
    if (rule.keywords.some((k) => q.includes(k))) return rule.intent;
  }
  return "help";
}

export async function getAssistantResponse(
  query: string
): Promise<AssistantResponse> {
  const intent = classifyAssistantIntent(query);
  const suggestions = SUGGESTIONS[intent];

  switch (intent) {
    case "overdue_billing": {
      const b = await getBillingOverview();
      const overdue = b.recent
        .filter((r) => r.status === "past_due")
        .slice(0, 5);
      return {
        intent,
        answer:
          `${b.past_due_tenants} tenant(s) have a past-due subscription.` +
          (overdue.length
            ? ` Most recent: ${overdue.map((o) => o.tenant_name || "Unknown").join(", ")}.`
            : " No past-due rows in the recent window."),
        facts: [
          { label: "Past-due tenants", value: b.past_due_tenants },
          { label: "Active subscriptions", value: b.counts.active },
          { label: "Trials expiring in 7d", value: b.trials_expiring_7d },
          { label: "MRR", value: `${b.currency} ${formatNumber(b.mrr)}` },
        ],
        suggestions,
        generated_at: new Date().toISOString(),
      };
    }
    case "security_risks": {
      const s = await getSecurityOverview();
      return {
        intent,
        answer: `Security score ${s.score}/100 with ${s.open_alerts} open alert(s) and ${s.failed_logins_24h} failed logins in the last 24h.`,
        facts: [
          { label: "Security score", value: `${s.score}/100` },
          { label: "Open alerts", value: s.open_alerts },
          { label: "Critical alerts", value: s.critical_alerts },
          { label: "Failed logins 24h", value: s.failed_logins_24h },
          { label: "Blocked IPs 7d", value: s.blocked_ips_7d },
          { label: "MFA coverage", value: `${s.mfa_coverage_pct}%` },
        ],
        suggestions,
        generated_at: new Date().toISOString(),
      };
    }
    case "revenue": {
      const a = await getPlatformAnalytics();
      return {
        intent,
        answer: `Monthly recurring revenue is ${a.revenue_currency} ${formatNumber(a.monthly_recurring_revenue)} across ${a.totals.active_subscriptions} active subscriptions (ARR ${a.revenue_currency} ${formatNumber(a.monthly_recurring_revenue * 12)}).`,
        facts: [
          { label: "MRR", value: `${a.revenue_currency} ${formatNumber(a.monthly_recurring_revenue)}` },
          { label: "ARR", value: `${a.revenue_currency} ${formatNumber(a.monthly_recurring_revenue * 12)}` },
          { label: "Active subscriptions", value: a.totals.active_subscriptions },
          { label: "Tenants", value: a.totals.tenants },
          {
            label: "Top plan",
            value: a.plan_breakdown[0]
              ? `${a.plan_breakdown[0].plan} (${a.plan_breakdown[0].count})`
              : "none",
          },
        ],
        suggestions,
        generated_at: new Date().toISOString(),
      };
    }
    case "resource_usage": {
      const u = await getUsageOverview();
      return {
        intent,
        answer: `Platform-wide consumption: ${formatNumber(u.totals.users)} users, ${formatNumber(u.totals.companies)} companies, ${formatNumber(u.totals.api_requests_30d)} API requests in 30d, and ${u.totals.over_capacity} tenant(s) over seat capacity.`,
        facts: [
          { label: "Total users", value: u.totals.users },
          { label: "Companies", value: u.totals.companies },
          { label: "API requests 30d", value: u.totals.api_requests_30d },
          { label: "Over seat capacity", value: u.totals.over_capacity },
          {
            label: "Top consumer",
            value: u.top_by_api[0]?.tenant_name || "none",
          },
        ],
        suggestions,
        generated_at: new Date().toISOString(),
      };
    }
    case "failed_integrations": {
      const sb = admin();
      const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
      const [apiErrors, failedEvents] = await Promise.all([
        sb
          .from("intg_api_logs")
          .select("id", { count: "exact", head: true })
          .gte("created_at", weekAgo)
          .gte("status_code", 400)
          .then((r) => r.count ?? 0)
          .then(undefined, () => 0),
        sb
          .from("domain_events")
          .select("id", { count: "exact", head: true })
          .ilike("event_type", "%integ%")
          .in("severity", ["error", "critical", "warning"])
          .gte("created_at", weekAgo)
          .then((r) => r.count ?? 0)
          .then(undefined, () => 0),
      ]);
      return {
        intent,
        answer: `${apiErrors} API calls returned 4xx/5xx and ${failedEvents} integration-related warning/error events were recorded in the last 7 days.`,
        facts: [
          { label: "API errors 7d", value: apiErrors },
          { label: "Integration failure events", value: failedEvents },
        ],
        suggestions,
        generated_at: new Date().toISOString(),
      };
    }
    case "health": {
      const sb = admin();
      const checks = await sb
        .from("platform_health_checks")
        .select("check_key,status,latency_ms,checked_at")
        .order("checked_at", { ascending: false })
        .limit(100)
        .then((r) => r.data || [])
        .then(undefined, () => [] as Array<{ check_key: string | null; status: string | null; latency_ms: number | null; checked_at: string | null }>);
      const down = checks.filter((c) => c.status === "down").length;
      const degraded = checks.filter((c) => c.status === "degraded").length;
      const healthy = checks.filter((c) => c.status === "healthy").length;
      const latencies = checks
        .map((c) => c.latency_ms)
        .filter((v): v is number => typeof v === "number" && v > 0);
      const avgLatency =
        latencies.length > 0
          ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length)
          : null;
      return {
        intent,
        answer: `Platform health: ${healthy} healthy, ${degraded} degraded, ${down} down across ${checks.length} monitored check(s).`,
        facts: [
          { label: "Healthy checks", value: healthy },
          { label: "Degraded", value: degraded },
          { label: "Down", value: down },
          { label: "Avg latency", value: avgLatency != null ? `${avgLatency}ms` : "n/a" },
        ],
        suggestions,
        generated_at: new Date().toISOString(),
      };
    }
    case "tenant_overview": {
      const a = await getPlatformAnalytics();
      const u = await getUsageOverview();
      const top = u.rows.slice(0, 5);
      return {
        intent,
        answer: `${a.totals.tenants} tenant(s) on the platform with ${formatNumber(a.totals.users)} users. Largest tenants: ${top.map((t) => t.tenant_name || "Unknown").join(", ") || "none"}.`,
        facts: [
          { label: "Total tenants", value: a.totals.tenants },
          { label: "Total users", value: a.totals.users },
          { label: "Active subscriptions", value: a.totals.active_subscriptions },
          { label: "Storage objects", value: a.totals.storage_objects },
        ],
        suggestions,
        generated_at: new Date().toISOString(),
      };
    }
    default:
      return {
        intent: "help",
        answer:
          "I can answer questions about billing, security, revenue, resource usage, integrations, tenant health, and platform operations. Try one of the suggestions below.",
        facts: [],
        suggestions,
        generated_at: new Date().toISOString(),
      };
  }
}
