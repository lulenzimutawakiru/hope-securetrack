/**
 * SecureTrack Enterprise Control Plane — OS administration layer.
 *
 * Completely separate from tenant ERP operations. All queries use the
 * service-role admin client. Callers MUST enforce platform staff only.
 *
 * Layers:
 *  1. Platform Administration  — health, infra, security, AI, compliance
 *  2. Tenant Administration    — customers, subscriptions, modules
 *  3. Company Administration   — legal entities under tenants
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { cpanelOverview } from "@/lib/platform/cpanel";

export type ControlPlaneLayer =
  | "platform"
  | "tenant"
  | "company";

export type CommandCenterSnapshot = {
  generated_at: string;
  layers: {
    platform: { label: string; description: string };
    tenant: { label: string; description: string };
    company: { label: string; description: string };
  };
  health: {
    status: "healthy" | "degraded" | "unknown";
    database_ok: boolean;
    database_latency_ms: number | null;
    redis_configured: boolean;
    ai_configured: boolean;
    job_worker_configured: boolean;
    mfa_enforced: boolean;
    dual_control: boolean;
    payment_sandbox: boolean;
    resend_configured: boolean;
  };
  estate: {
    tenants_total: number;
    tenants_active: number;
    tenants_trial: number;
    tenants_suspended: number;
    companies: number;
    users: number;
    active_subscriptions: number;
    open_provision_jobs: number;
    events_24h: number;
  };
  jobs: {
    pending: number;
    running: number;
    failed: number;
    dead: number;
  };
  security: {
    failed_logins_24h: number;
    open_alerts: number;
    mfa_enabled_users: number;
    privileged_users: number;
    platform_admins: number;
  };
  business: {
    trial_tenants: number;
    expiring_trials_7d: number;
    plan_breakdown: Array<{ plan: string; count: number }>;
    module_enabled_rows: number;
  };
  api: {
    requests_24h: number;
    errors_24h: number;
    avg_latency_ms: number | null;
    error_rate_pct: number | null;
  };
  storage: {
    objects: number;
    usage_mb: number;
  };
  activity: {
    active_users_7d: number;
    audit_events_24h: number;
  };
  backup: {
    status: "managed" | "unknown";
    last_backup_at: string | null;
    retention_days: number | null;
  };
  recent_tenants: Array<{
    id: string;
    name: string;
    slug: string;
    status: string;
    plan_code: string | null;
    created_at: string | null;
  }>;
  recent_security_events: Array<{
    id: string;
    event_type: string;
    severity: string | null;
    created_at: string | null;
  }>;
};

function admin() {
  return createAdminClient();
}

async function countTable(
  table: string,
  filters?: { eq?: Record<string, string | boolean>; in?: Record<string, string[]>; gte?: Record<string, string>; is?: Record<string, null> }
): Promise<number> {
  const sb = admin();
  let q = sb.from(table).select("id", { count: "exact", head: true });
  if (filters?.eq) {
    for (const [k, v] of Object.entries(filters.eq)) q = q.eq(k, v);
  }
  if (filters?.in) {
    for (const [k, v] of Object.entries(filters.in)) q = q.in(k, v);
  }
  if (filters?.gte) {
    for (const [k, v] of Object.entries(filters.gte)) q = q.gte(k, v);
  }
  if (filters?.is) {
    for (const [k, v] of Object.entries(filters.is)) q = q.is(k, v);
  }
  const { count, error } = await q;
  if (error) return 0;
  return count ?? 0;
}

export async function getCommandCenterSnapshot(): Promise<CommandCenterSnapshot> {
  const sb = admin();
  const dayAgo = new Date(Date.now() - 86400000).toISOString();
  const weekAhead = new Date(Date.now() + 7 * 86400000).toISOString();
  const now = new Date().toISOString();

  // Database health probe
  let databaseOk = false;
  let dbLatency: number | null = null;
  try {
    const t0 = Date.now();
    const { error } = await sb.from("tenants").select("id").limit(1);
    dbLatency = Date.now() - t0;
    databaseOk = !error;
  } catch {
    databaseOk = false;
  }

  const estate = await cpanelOverview();

  const [
    jobsPending,
    jobsRunning,
    jobsFailed,
    jobsDead,
    failedLogins,
    openAlerts,
    mfaUsers,
    platformAdmins,
    moduleRows,
    expiringTrials,
    planRows,
    recentTenants,
    recentSecEvents,
  ] = await Promise.all([
    countTable("job_queue", { eq: { status: "pending" } }),
    countTable("job_queue", { eq: { status: "running" } }),
    countTable("job_queue", { eq: { status: "failed" } }),
    countTable("job_queue", { in: { status: ["dead", "dead_letter"] } }),
    // login_history may not exist on all envs
    countTable("login_history", {
      eq: { success: false },
      gte: { created_at: dayAgo },
    }).catch(() => 0),
    countTable("security_alerts", {
      in: { status: ["open", "new", "investigating"] },
    }).catch(() => 0),
    countTable("user_profiles", {
      eq: { mfa_enabled: true },
      is: { deleted_at: null },
    }).catch(() => 0),
    countTable("user_profiles", {
      eq: { is_platform_admin: true },
      is: { deleted_at: null },
    }).catch(() => 0),
    countTable("tenant_modules", { eq: { enabled: true } }).catch(() => 0),
    Promise.resolve(
      sb
        .from("tenants")
        .select("id", { count: "exact", head: true })
        .eq("status", "trial")
        .gte("trial_ends_at", now)
        .lte("trial_ends_at", weekAhead)
        .is("deleted_at", null)
    )
      .then((r) => r.count ?? 0)
      .catch(() => 0),
    Promise.resolve(
      sb.from("tenants").select("plan_code").is("deleted_at", null).limit(2000)
    )
      .then((r) => r.data || [])
      .catch(() => [] as Array<{ plan_code: string | null }>),
    Promise.resolve(
      sb
        .from("tenants")
        .select("id,name,slug,status,plan_code,created_at")
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(8)
    )
      .then((r) => r.data || [])
      .catch(() => []),
    Promise.resolve(
      sb
        .from("domain_events")
        .select("id,event_type,severity,created_at")
        .or(
          "event_type.ilike.%mfa%,event_type.ilike.%login%,event_type.ilike.%security%,event_type.ilike.%elevat%,severity.eq.critical,severity.eq.warning"
        )
        .order("created_at", { ascending: false })
        .limit(12)
    )
      .then((r) => r.data || [])
      .catch(() => []),
  ]);

  // Privileged users heuristic: platform admins + roles with admin/manager slugs
  let privilegedUsers = platformAdmins;
  try {
    const { data: roles } = await sb
      .from("roles")
      .select("id")
      .or(
        "slug.ilike.%admin%,slug.ilike.%manager%,slug.eq.super_administrator,slug.eq.managing_director"
      )
      .limit(100);
    const roleIds = (roles || []).map((r) => r.id as string);
    if (roleIds.length) {
      const { count } = await sb
        .from("user_profiles")
        .select("id", { count: "exact", head: true })
        .in("role_id", roleIds)
        .is("deleted_at", null);
      privilegedUsers = Math.max(privilegedUsers, count ?? 0);
    }
  } catch {
    /* keep platform admin count */
  }

  const planMap = new Map<string, number>();
  for (const row of planRows as Array<{ plan_code: string | null }>) {
    const p = row.plan_code || "unknown";
    planMap.set(p, (planMap.get(p) || 0) + 1);
  }

  // Platform telemetry: API gateway, storage, activity, backup posture
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
  const [
    apiRequests24h,
    apiErrors24h,
    apiLatencyRows,
    storageObjects,
    storageMetaRows,
    activeUsers7d,
    auditEvents24h,
    backupSettings,
  ] = await Promise.all([
    Promise.resolve(
      sb
        .from("intg_api_logs")
        .select("id", { count: "exact", head: true })
        .gte("created_at", dayAgo)
        .then((r) => r.count ?? 0)
    ).catch(() => 0),
    Promise.resolve(
      sb
        .from("intg_api_logs")
        .select("id", { count: "exact", head: true })
        .gte("created_at", dayAgo)
        .gte("status_code", 400)
        .then((r) => r.count ?? 0)
    ).catch(() => 0),
    Promise.resolve(
      sb
        .from("intg_api_logs")
        .select("duration_ms")
        .gte("created_at", dayAgo)
        .order("created_at", { ascending: false })
        .limit(1000)
        .then((r) => r.data || [])
    ).catch(() => [] as Array<{ duration_ms: number | null }>),
    Promise.resolve(
      sb
        .from("storage.objects")
        .select("id", { count: "exact", head: true })
        .then((r) => r.count ?? 0)
    ).catch(() => 0),
    Promise.resolve(
      sb
        .from("storage.objects")
        .select("metadata")
        .limit(10000)
        .then((r) => r.data || [])
    ).catch(() => [] as Array<{ metadata?: Record<string, unknown> | null }>),
    Promise.resolve(
      sb
        .from("user_profiles")
        .select("id", { count: "exact", head: true })
        .eq("is_active", true)
        .gte("last_login_at", weekAgo)
        .is("deleted_at", null)
        .then((r) => r.count ?? 0)
    ).catch(() => 0),
    Promise.resolve(
      sb
        .from("audit_logs")
        .select("id", { count: "exact", head: true })
        .gte("created_at", dayAgo)
        .then((r) => r.count ?? 0)
    ).catch(() => 0),
    Promise.resolve(
      sb
        .from("system_settings")
        .select("key,value,updated_at")
        .in("key", ["backup.retention_days", "backup.last_run_at"])
        .order("updated_at", { ascending: false })
        .limit(20)
        .then((r) => r.data || [])
    ).catch(() => [] as Array<{ key: string; value: unknown }>),
  ]);

  const latencies = (apiLatencyRows as Array<{ duration_ms: number | null }>)
    .map((r) => r.duration_ms)
    .filter((v): v is number => typeof v === "number" && v >= 0);
  const avgLatencyMs =
    latencies.length > 0
      ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length)
      : null;
  const errorRatePct =
    apiRequests24h > 0
      ? Math.round((apiErrors24h / apiRequests24h) * 1000) / 10
      : null;

  let storageBytes = 0;
  for (const row of storageMetaRows as Array<{
    metadata?: Record<string, unknown> | null;
  }>) {
    const size = Number(row.metadata?.size);
    if (Number.isFinite(size) && size > 0) storageBytes += size;
  }
  const storageUsageMb = Math.round((storageBytes / (1024 * 1024)) * 10) / 10;

  const backupMap = new Map<string, unknown>();
  for (const row of backupSettings as Array<{ key: string; value: unknown }>) {
    if (!backupMap.has(row.key)) backupMap.set(row.key, row.value);
  }
  const retentionRaw = backupMap.get("backup.retention_days");
  const retentionDays =
    typeof retentionRaw === "number" && Number.isFinite(retentionRaw)
      ? retentionRaw
      : typeof retentionRaw === "string" &&
          retentionRaw.trim() !== "" &&
          !Number.isNaN(Number(retentionRaw))
        ? Number(retentionRaw)
        : null;
  const lastBackupRaw = backupMap.get("backup.last_run_at");
  const lastBackupAt =
    typeof lastBackupRaw === "string" &&
    !Number.isNaN(Date.parse(lastBackupRaw))
      ? new Date(lastBackupRaw).toISOString()
      : null;

  const healthy =
    databaseOk &&
    (process.env.NODE_ENV !== "production" ||
      (process.env.MFA_ENFORCE_PRIVILEGED !== "false" &&
        process.env.DUAL_CONTROL_REQUIRED !== "false"));

  return {
    generated_at: new Date().toISOString(),
    layers: {
      platform: {
        label: "Platform Administration",
        description:
          "SecureTrack OS: health, security, infra, AI, compliance, monitoring",
      },
      tenant: {
        label: "Tenant Administration",
        description:
          "Customer orgs: subscriptions, modules, users, lifecycle, data scope",
      },
      company: {
        label: "Company Administration",
        description:
          "Legal entities under tenants: branches, memberships, operating units",
      },
    },
    health: {
      status: healthy ? "healthy" : databaseOk ? "degraded" : "unknown",
      database_ok: databaseOk,
      database_latency_ms: dbLatency,
      redis_configured: Boolean(
        process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
      ),
      ai_configured: Boolean(
        process.env.SECURETRACK_AI_API_KEY ||
          process.env.OPENAI_API_KEY ||
          process.env.XAI_API_KEY
      ),
      job_worker_configured: Boolean(
        process.env.JOB_WORKER_SECRET || process.env.CRON_SECRET
      ),
      mfa_enforced:
        process.env.MFA_ENFORCE_PRIVILEGED === "true" ||
        (process.env.NODE_ENV === "production" &&
          process.env.MFA_ENFORCE_PRIVILEGED !== "false"),
      dual_control:
        process.env.DUAL_CONTROL_REQUIRED === "true" ||
        (process.env.NODE_ENV === "production" &&
          process.env.DUAL_CONTROL_REQUIRED !== "false"),
      payment_sandbox: process.env.PAYMENT_SANDBOX === "true",
      resend_configured: Boolean(process.env.RESEND_API_KEY?.trim()),
    },
    estate: {
      tenants_total: estate.tenants,
      tenants_active: estate.tenants_active,
      tenants_trial: estate.tenants_trial,
      tenants_suspended: estate.tenants_suspended,
      companies: estate.companies,
      users: estate.users,
      active_subscriptions: estate.active_subscriptions,
      open_provision_jobs: estate.open_provision_jobs,
      events_24h: estate.events_24h,
    },
    jobs: {
      pending: jobsPending,
      running: jobsRunning,
      failed: jobsFailed,
      dead: jobsDead,
    },
    security: {
      failed_logins_24h: failedLogins,
      open_alerts: openAlerts,
      mfa_enabled_users: mfaUsers,
      privileged_users: privilegedUsers,
      platform_admins: platformAdmins,
    },
    business: {
      trial_tenants: estate.tenants_trial,
      expiring_trials_7d: expiringTrials as number,
      plan_breakdown: [...planMap.entries()]
        .map(([plan, count]) => ({ plan, count }))
        .sort((a, b) => b.count - a.count),
      module_enabled_rows: moduleRows,
    },
    api: {
      requests_24h: apiRequests24h,
      errors_24h: apiErrors24h,
      avg_latency_ms: avgLatencyMs,
      error_rate_pct: errorRatePct,
    },
    storage: {
      objects: storageObjects,
      usage_mb: storageUsageMb,
    },
    activity: {
      active_users_7d: activeUsers7d,
      audit_events_24h: auditEvents24h,
    },
    backup: {
      status: lastBackupAt ? "managed" : "unknown",
      last_backup_at: lastBackupAt,
      retention_days: retentionDays,
    },
    recent_tenants: (recentTenants as Array<Record<string, unknown>>).map(
      (t) => ({
        id: String(t.id),
        name: String(t.name),
        slug: String(t.slug),
        status: String(t.status),
        plan_code: (t.plan_code as string) || null,
        created_at: (t.created_at as string) || null,
      })
    ),
    recent_security_events: (
      recentSecEvents as Array<Record<string, unknown>>
    ).map((e) => ({
      id: String(e.id),
      event_type: String(e.event_type),
      severity: (e.severity as string) || null,
      created_at: (e.created_at as string) || null,
    })),
  };
}

export async function listAllCompanies(opts?: {
  search?: string;
  tenantId?: string;
  limit?: number;
}) {
  const sb = admin();
  const limit = Math.min(500, opts?.limit ?? 200);
  let q = sb
    .from("companies")
    .select(
      "id,name,code,tenant_id,is_primary,is_active,base_currency,country,company_type,created_at,tenants(name,slug,status)"
    )
    .order("created_at", { ascending: false })
    .limit(limit);
  if (opts?.tenantId) q = q.eq("tenant_id", opts.tenantId);
  if (opts?.search?.trim()) {
    const s = opts.search.trim().replace(/[%_,.()"'\\]/g, " ").slice(0, 80);
    q = q.or(`name.ilike.%${s}%,code.ilike.%${s}%`);
  }
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data || [];
}

export async function listAllUsers(opts?: {
  search?: string;
  tenantId?: string;
  limit?: number;
}) {
  const sb = admin();
  const limit = Math.min(500, opts?.limit ?? 200);
  let q = sb
    .from("user_profiles")
    .select(
      "id,email,first_name,last_name,tenant_id,company_id,is_active,is_platform_admin,mfa_enabled,require_mfa,created_at,roles!user_profiles_role_id_fkey(slug,name),tenants(name,slug)"
    )
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (opts?.tenantId) q = q.eq("tenant_id", opts.tenantId);
  if (opts?.search?.trim()) {
    const s = opts.search.trim().replace(/[%_,.()"'\\]/g, " ").slice(0, 80);
    q = q.or(
      `email.ilike.%${s}%,first_name.ilike.%${s}%,last_name.ilike.%${s}%`
    );
  }
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data || [];
}

/** Navigation blueprint for the Enterprise Control Plane shell */
export const CONTROL_PLANE_NAV = {
  platform: [
    { title: "Command Center", href: "/platform", exact: true },
    { title: "Health & Infra", href: "/platform/health" },
    { title: "Monitoring", href: "/platform/monitoring" },
    { title: "Security Center", href: "/platform/security" },
    { title: "Audit & Compliance", href: "/platform/compliance" },
    { title: "Data Governance", href: "/platform/governance" },
    { title: "AI Administration", href: "/platform/ai" },
    { title: "Integration Center", href: "/platform/integrations" },
    { title: "API Management", href: "/platform/api" },
    { title: "Storage", href: "/platform/storage" },
    { title: "Database Admin", href: "/platform/database" },
    { title: "Backup & DR", href: "/platform/backup" },
    { title: "Deployment", href: "/platform/deploy" },
    { title: "Notifications", href: "/platform/notifications" },
    { title: "Support Center", href: "/platform/support" },
    { title: "System Config", href: "/platform/config" },
    { title: "Customization Studio", href: "/platform/studio" },
    { title: "Workflows", href: "/platform/workflows" },
    { title: "Background Jobs", href: "/platform/jobs" },
    { title: "Events", href: "/platform/events" },
    { title: "Ops / Elevation", href: "/platform/ops" },
  ],
  tenant: [
    { title: "Tenant Management", href: "/platform/tenants" },
    { title: "Provisioning Engine", href: "/platform/provisioning" },
    { title: "Subscriptions", href: "/platform/subscriptions" },
    { title: "Module Management", href: "/platform/modules" },
    { title: "Feature Flags", href: "/platform/flags" },
    { title: "User Administration", href: "/platform/users" },
  ],
  company: [
    { title: "Company Administration", href: "/platform/companies" },
  ],
} as const;
