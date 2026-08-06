/**
 * Enterprise Tenant Provisioning Platform - control-plane service.
 *
 * Job directory, template catalog, executive snapshot, and tenant lifecycle
 * commands. Every read/write uses the service-role admin client, so callers
 * MUST verify platform-staff authorization before invoking these functions.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  cpanelDeleteTenant,
  cpanelGetTenant,
  cpanelMutateTenant,
  type TenantLifecycleAction,
} from "@/lib/platform/cpanel";
import {
  createProvisioningJob,
  retryProvisioningJob,
  runProvisioningJob,
  type ProvisioningRequest,
} from "./orchestrator";
import type {
  ExecutiveSnapshot,
  ProvisioningJobEvent,
  ProvisioningJobRow,
  ProvisioningRunResult,
  ProvisioningStepRow,
  ProvisioningTemplate,
  TenantLifecycleCommand,
} from "./types";

function admin(): SupabaseClient {
  return createAdminClient();
}

// ---------------------------------------------------------------------------
// Job directory
// ---------------------------------------------------------------------------

export async function listProvisioningJobs(opts?: {
  status?: string;
  kind?: string;
  limit?: number;
}): Promise<{ jobs: ProvisioningJobRow[]; count: number }> {
  const sb = admin();
  const limit = Math.min(500, Math.max(1, opts?.limit ?? 100));
  let q = sb
    .from("tenant_provisioning_jobs")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .limit(limit);
  if (opts?.status) q = q.eq("status", opts.status);
  if (opts?.kind) q = q.eq("kind", opts.kind);
  const { data, count, error } = await q;
  if (error) throw new Error(error.message);
  return { jobs: (data || []) as ProvisioningJobRow[], count: count ?? 0 };
}

export async function getProvisioningJob(id: string): Promise<{
  job: ProvisioningJobRow;
  steps: ProvisioningStepRow[];
  events: ProvisioningJobEvent[];
} | null> {
  const sb = admin();
  const { data: job, error } = await sb
    .from("tenant_provisioning_jobs")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error || !job) throw error || new Error("Provisioning job not found");

  const [steps, events] = await Promise.all([
    sb
      .from("provisioning_steps")
      .select("*")
      .eq("job_id", id)
      .order("sort_order", { ascending: true })
      .then((r) => (r.data || []) as ProvisioningStepRow[]),
    sb
      .from("provisioning_job_events")
      .select("*")
      .eq("job_id", id)
      .order("created_at", { ascending: false })
      .limit(200)
      .then((r) => (r.data || []) as ProvisioningJobEvent[]),
  ]);

  return { job: job as ProvisioningJobRow, steps, events };
}

// ---------------------------------------------------------------------------
// Template catalog
// ---------------------------------------------------------------------------

export async function listTemplates(opts?: {
  kind?: "tenant" | "industry";
  activeOnly?: boolean;
}): Promise<ProvisioningTemplate[]> {
  const sb = admin();
  let q = sb
    .from("provisioning_templates")
    .select("*")
    .order("kind", { ascending: true })
    .order("name", { ascending: true })
    .limit(200);
  if (opts?.kind) q = q.eq("kind", opts.kind);
  if (opts?.activeOnly !== false) q = q.eq("is_active", true);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data || []) as ProvisioningTemplate[];
}

export async function getTemplate(code: string): Promise<ProvisioningTemplate | null> {
  const sb = admin();
  const { data, error } = await sb
    .from("provisioning_templates")
    .select("*")
    .eq("template_code", code)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as ProvisioningTemplate) || null;
}

// ---------------------------------------------------------------------------
// Provisioning execution (create + run in one call)
// ---------------------------------------------------------------------------

export async function runProvisioning(
  input: ProvisioningRequest,
  opts?: { actorId?: string; adminPassword?: string }
): Promise<ProvisioningRunResult> {
  const sb = admin();
  const created = await createProvisioningJob(sb, input, {
    actorId: opts?.actorId,
  });
  return runProvisioningJob(sb, created.jobId, {
    adminPassword: opts?.adminPassword || input.admin_password,
  });
}

// ---------------------------------------------------------------------------
// Executive dashboard snapshot
// ---------------------------------------------------------------------------

export async function executiveSnapshot(): Promise<ExecutiveSnapshot> {
  const sb = admin();
  const dayAgo = new Date(Date.now() - 86400000).toISOString();
  const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString();

  type CountQuery = {
    is: (col: string, val: null) => CountQuery;
    eq: (col: string, val: string) => CountQuery;
    in: (col: string, vals: string[]) => CountQuery;
    gte: (col: string, val: string | number) => CountQuery;
    limit: (n: number) => CountQuery;
    then: (
      onfulfilled: (r: { count: number | null; error: unknown }) => unknown
    ) => Promise<unknown>;
  };

  const countWhere = async (
    table: string,
    where: (q: CountQuery) => CountQuery
  ): Promise<number> => {
    try {
      const base = sb
        .from(table)
        .select("id", { count: "exact", head: true }) as unknown as CountQuery;
      const { count, error } = (await where(base)) as {
        count: number | null;
        error?: unknown;
      };
      return error ? 0 : (count ?? 0);
    } catch {
      return 0;
    }
  };

  const [
    tenantsTotal,
    tenantsActive,
    tenantsTrial,
    tenantsSuspended,
    jobsQueue,
    jobsRunning,
    jobsSuccess,
    jobsFailed,
    storageObjects,
    apiRequests,
    apiErrors,
    growth30d,
    regionalRows,
    planRows,
    recentJobs,
    completedDurations,
    healthRows,
    aiAgents,
  ] = await Promise.all([
    countWhere("tenants", (q) => q.is("deleted_at", null)),
    countWhere("tenants", (q) => q.eq("status", "active").is("deleted_at", null)),
    countWhere("tenants", (q) => q.eq("status", "trial").is("deleted_at", null)),
    countWhere("tenants", (q) => q.eq("status", "suspended").is("deleted_at", null)),
    countWhere("tenant_provisioning_jobs", (q) => q.eq("status", "pending")),
    countWhere("tenant_provisioning_jobs", (q) => q.in("status", ["running", "partial"])),
    countWhere("tenant_provisioning_jobs", (q) => q.eq("status", "completed")),
    countWhere("tenant_provisioning_jobs", (q) => q.eq("status", "failed")),
    countWhere("storage.objects", (q) => q.limit(1)),
    countWhere("intg_api_logs", (q) => q.gte("created_at", dayAgo)),
    countWhere("intg_api_logs", (q) => q.gte("created_at", dayAgo).gte("status_code", 400)),
    countWhere("tenants", (q) => q.gte("created_at", monthAgo).is("deleted_at", null)),
    Promise.resolve(
      sb
        .from("tenants")
        .select("country_code")
        .is("deleted_at", null)
        .limit(10000)
    ).then((r) => r.data || []),
    Promise.resolve(
      sb
        .from("tenants")
        .select("plan_code")
        .is("deleted_at", null)
        .limit(10000)
    ).then((r) => r.data || []),
    Promise.resolve(
      sb
        .from("tenant_provisioning_jobs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(10)
    ).then((r) => r.data || []),
    Promise.resolve(
      sb
        .from("tenant_provisioning_jobs")
        .select("duration_ms")
        .eq("status", "completed")
        .not("duration_ms", "is", null)
        .limit(2000)
    ).then((r) => r.data || []),
    Promise.resolve(
      sb
        .from("platform_health_checks")
        .select("check_key,status,checked_at,details")
        .limit(200)
    ).then((r) => r.data || []),
    Promise.resolve(
      sb
        .from("provisioning_templates")
        .select("template_code,config")
        .eq("kind", "industry")
        .limit(100)
    ).then((r) => r.data || []),
  ]);

  const regionalMap = new Map<string, number>();
  for (const row of regionalRows as Array<{ country_code: string | null }>) {
    const cc = (row.country_code || "UN").toUpperCase();
    regionalMap.set(cc, (regionalMap.get(cc) || 0) + 1);
  }
  const regional = [...regionalMap.entries()]
    .map(([country_code, count]) => ({ country_code, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);

  const planMap = new Map<string, number>();
  for (const row of planRows as Array<{ plan_code: string | null }>) {
    const p = row.plan_code || "unknown";
    planMap.set(p, (planMap.get(p) || 0) + 1);
  }
  const plans = [...planMap.entries()]
    .map(([plan_code, count]) => ({ plan_code, count }))
    .sort((a, b) => b.count - a.count);

  const durations = (completedDurations as Array<{ duration_ms: number | null }>)
    .map((r) => r.duration_ms)
    .filter((v): v is number => typeof v === "number" && v >= 0)
    .sort((a, b) => a - b);
  const avgMs =
    durations.length > 0
      ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
      : null;
  const p95Ms =
    durations.length > 0
      ? durations[Math.min(durations.length - 1, Math.floor(durations.length * 0.95))]
      : null;

  let healthy = 0;
  let degraded = 0;
  let down = 0;
  let backupHealthy = 0;
  let backupStale = 0;
  let backupTotal = 0;
  for (const row of healthRows as Array<{
    check_key: string;
    status: string;
    checked_at: string | null;
  }>) {
    if (row.check_key.toLowerCase().includes("backup")) {
      backupTotal += 1;
      if (row.status === "healthy") backupHealthy += 1;
      else if (row.status === "stale") backupStale += 1;
      else if (row.status === "down" || row.status === "degraded") backupStale += 1;
      continue;
    }
    if (row.status === "healthy") healthy += 1;
    else if (row.status === "degraded") degraded += 1;
    else down += 1;
  }
  if (backupTotal === 0) {
    backupTotal = 1;
    backupHealthy = 1;
  }

  let storageBytes = 0;
  try {
    const { data: metas } = await sb
      .from("storage.objects")
      .select("metadata")
      .limit(10000);
    for (const row of (metas || []) as Array<{ metadata?: Record<string, unknown> | null }>) {
      const size = Number(row.metadata?.size);
      if (Number.isFinite(size) && size > 0) storageBytes += size;
    }
  } catch {
    /* storage telemetry optional */
  }
  const storageMb = Math.round((storageBytes / (1024 * 1024)) * 10) / 10;

  const aiAgentsCount = (aiAgents as Array<{ config?: Record<string, unknown> }>).length;

  const tenantsLimit = Math.max(1, Number(process.env.PLATFORM_TENANTS_LIMIT || 100000));
  const usersLimit = Math.max(1, Number(process.env.PLATFORM_USERS_LIMIT || 100000000));

  // Heuristic scores: security = healthy checks + active tenants posture
  const healthTotal = Math.max(1, healthy + degraded + down);
  const securityScore = Math.round(
    (healthy / healthTotal) * 60 +
      (tenantsTotal > 0 ? (tenantsActive / Math.max(1, tenantsTotal)) * 40 : 40)
  );
  const complianceScore = Math.round(
    (backupTotal > 0 ? (backupHealthy / backupTotal) * 50 : 50) +
      (degraded + down === 0 ? 30 : 15) +
      20
  );

  return {
    generated_at: new Date().toISOString(),
    tenants_total: tenantsTotal,
    tenants_active: tenantsActive,
    tenants_trial: tenantsTrial,
    tenants_suspended: tenantsSuspended,
    provisioning_queue: jobsQueue,
    provisioning_running: jobsRunning,
    provisioning_success: jobsSuccess,
    provisioning_failed: jobsFailed,
    avg_provisioning_ms: avgMs,
    p95_provisioning_ms: p95Ms,
    infra_health: { healthy, degraded, down, total: healthTotal },
    storage: { objects: storageObjects, usage_mb: storageMb },
    ai: { tokens_month: 0, agents: aiAgentsCount },
    api: { requests_24h: apiRequests, errors_24h: apiErrors },
    security_score: Math.min(100, securityScore),
    compliance_score: Math.min(100, complianceScore),
    capacity: {
      tenants_limit: tenantsLimit,
      tenants_pct: Math.min(100, Math.round((tenantsTotal / tenantsLimit) * 1000) / 10),
      users_limit: usersLimit,
      users_pct: 0,
    },
    regional,
    plans,
    growth_30d: growth30d,
    jobs_running: jobsRunning,
    backup_status: { healthy: backupHealthy, stale: backupStale, total: backupTotal },
    recent_jobs: (recentJobs as ProvisioningJobRow[]).slice(0, 10),
  };
}

// ---------------------------------------------------------------------------
// Tenant lifecycle
// ---------------------------------------------------------------------------

const LIFECYCLE_ACTION_MAP: Record<
  TenantLifecycleCommand,
  { action: TenantLifecycleAction; reason: string }
> = {
  activate: { action: "activate", reason: "Activated by platform admin" },
  suspend: { action: "suspend", reason: "Suspended by platform admin" },
  upgrade: { action: "update_plan", reason: "Plan upgraded by platform admin" },
  downgrade: { action: "update_plan", reason: "Plan downgraded by platform admin" },
  archive: { action: "activate", reason: "Archived by platform admin" },
  delete: { action: "activate", reason: "Deleted by platform admin" },
  restore: { action: "activate", reason: "Restored by platform admin" },
  clone: { action: "activate", reason: "Cloned by platform admin" },
};

export async function lifecycleAction(
  action: TenantLifecycleCommand,
  tenantId: string,
  payload: Record<string, unknown>,
  actorId: string
): Promise<Record<string, unknown>> {
  const sb = admin();
  const detail = await cpanelGetTenant(tenantId);
  if (!detail) throw new Error("Tenant not found");

  switch (action) {
    case "activate": {
      const row = await cpanelMutateTenant(tenantId, "activate", {}, actorId);
      return { action, tenant_id: tenantId, result: row, status: "active" };
    }
    case "suspend": {
      const reason = String(payload.reason || "Suspended by platform admin");
      const row = await cpanelMutateTenant(tenantId, "suspend", { reason }, actorId);
      try {
        await sb.from("domain_events").insert({
          event_type: "tenant.lifecycle",
          aggregate_type: "tenant",
          aggregate_id: tenantId,
          tenant_id: tenantId,
          actor_id: actorId,
          payload: { action, reason },
          source_module: "platform-provisioning",
          severity: "info",
        });
      } catch {
        /* non-fatal */
      }
      return { action, tenant_id: tenantId, result: row, status: "suspended" };
    }
    case "upgrade":
    case "downgrade": {
      const plan = String(payload.plan_code || "").trim();
      if (!plan) throw new Error("plan_code is required for plan changes");
      const row = await cpanelMutateTenant(
        tenantId,
        "update_plan",
        { plan_code: plan },
        actorId
      );
      return {
        action,
        tenant_id: tenantId,
        result: row,
        status: String(row.status || "active"),
        plan_code: plan,
      };
    }
    case "archive": {
      const reason = String(payload.reason || "Archived by platform admin");
      const row = await cpanelDeleteTenant(tenantId, actorId, { reason });
      return { action, tenant_id: tenantId, result: row, status: "archived" };
    }
    case "delete": {
      const reason = String(payload.reason || "Deleted by platform admin");
      const alreadySoft =
        detail.status === "cancelled" || Boolean((detail.settings as Record<string, unknown>)?.deleted_at);
      const row = await cpanelDeleteTenant(tenantId, actorId, {
        hard: true,
        force: alreadySoft,
        reason,
      });
      return { action, tenant_id: tenantId, result: row, status: "deleted" };
    }
    case "restore": {
      const row = await cpanelMutateTenant(tenantId, "activate", {}, actorId);
      try {
        await sb
          .from("tenants")
          .update({ deleted_at: null, status: "active", updated_at: new Date().toISOString() })
          .eq("id", tenantId);
      } catch {
        /* non-fatal */
      }
      return { action, tenant_id: tenantId, result: row, status: "active" };
    }
    case "clone": {
      const plan = String(payload.plan_code || detail.plan_code || "starter");
      const name = String(
        payload.organization_name || detail.name + " (Clone)"
      ).slice(0, 200);
      const adminEmail = String(
        payload.admin_email || detail.primary_contact_email || ""
      ).trim();
      if (!adminEmail) {
        throw new Error(
          "Source tenant has no primary contact email - provide admin_email to clone"
        );
      }
      const created = await createProvisioningJob(
        sb,
        {
          organization_name: name,
          admin_email: adminEmail,
          admin_name: String(payload.admin_name || "Administrator"),
          admin_password: String(payload.admin_password || ""),
          country_code: detail.country_code || undefined,
          currency: detail.primary_currency || undefined,
          timezone: detail.timezone || undefined,
          plan_code: plan,
          industry: detail.settings?.industry
            ? String(detail.settings.industry)
            : undefined,
          language: detail.settings?.language
            ? String(detail.settings.language)
            : undefined,
          data_region: detail.settings?.data_region
            ? String(detail.settings.data_region)
            : undefined,
          compliance_requirements: Array.isArray(detail.settings?.compliance_requirements)
            ? (detail.settings.compliance_requirements as string[])
            : undefined,
        },
        { actorId }
      );
      const result = await runProvisioningJob(sb, created.jobId, {
        adminPassword: String(payload.admin_password || ""),
      });
      return {
        action,
        tenant_id: result.tenantId,
        source_tenant_id: tenantId,
        job_id: created.jobId,
        status: result.job.status,
      };
    }
    default:
      throw new Error("Unsupported lifecycle action: " + String(action));
  }
}

export async function retryProvisioning(
  jobId: string,
  opts?: { actorId?: string; adminPassword?: string }
): Promise<ProvisioningRunResult> {
  const sb = admin();
  return retryProvisioningJob(sb, jobId, {
    actorId: opts?.actorId,
    adminPassword: opts?.adminPassword,
  });
}

export async function getLifecycleCatalog() {
  return {
    actions: [
      { key: "activate", label: "Activate", description: "Set tenant to active" },
      { key: "suspend", label: "Suspend", description: "Pause tenant access" },
      { key: "upgrade", label: "Upgrade plan", description: "Move to a higher plan" },
      { key: "downgrade", label: "Downgrade plan", description: "Move to a lower plan" },
      { key: "archive", label: "Archive", description: "Soft-delete / archive tenant" },
      { key: "restore", label: "Restore", description: "Reactivate archived tenant" },
      { key: "delete", label: "Delete", description: "Hard-purge tenant (destructive)" },
      { key: "clone", label: "Clone", description: "Provision a new tenant from this one" },
    ],
    mapping: LIFECYCLE_ACTION_MAP,
  };
}
