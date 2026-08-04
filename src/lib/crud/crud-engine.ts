/**
 * Tenant-aware CRUD engine.
 *
 * Single implementation behind the generic CRUD surface (/api/v2/crud/[entity]).
 * Every operation:
 *   - resolves the entity from the registry (unknown entities are rejected),
 *   - checks the permission that guards the requested action,
 *   - derives tenant/company from the authenticated session scope (never the body),
 *   - filters every query by company_id (and tenant_id when known),
 *   - asserts tenant + company on every row it returns,
 *   - strips identity/lifecycle fields from client payloads,
 *   - appends an immutable audit row to audit_logs,
 *   - enqueues lifecycle workflows as tenant-scoped jobs (non-blocking).
 *
 * The engine is framework-free: it only needs a Supabase client (defaults to the
 * session-scoped SSR client) and a CrudScope built from requireApiAuth().
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  DEFAULT_WRITE_BLACKLIST,
  getEntityDefinition,
  permissionForAction,
  type CrudAction,
  type EntityDefinition,
} from "@/lib/metadata/entity-registry";
// Side-effect: register EntityPage module tables (fin_*, pay_*, fleet_*, …)
import "@/lib/metadata/register-entity-page-tables";
import { createClient } from "@/lib/supabase/server";
import { assertTenantAndCompany } from "@/lib/tenant/context";
import { enqueueJob } from "@/lib/jobs/queue";
import { log } from "@/lib/observability/logger";
import { sanitizePostgrestFilter } from "@/lib/security/shared";
import { validatePayload } from "@/lib/crud/entity-schemas";

export type EngineErrorCode =
  | "UNKNOWN_ENTITY"
  | "MISSING_PERMISSION"
  | "CROSS_TENANT"
  | "CROSS_COMPANY"
  | "NOT_FOUND"
  | "VALIDATION"
  | "INTERNAL";

export class EngineError extends Error {
  constructor(
    public readonly code: EngineErrorCode,
    message: string,
    public readonly status = 400
  ) {
    super(message);
    this.name = "EngineError";
  }
}

/** Session-derived scope. Structurally compatible with scopeFromAuth(). */
export type CrudScope = {
  userId: string;
  companyId: string;
  tenantId: string | null;
  isElevated?: boolean;
  isPlatformAdmin: boolean;
  permissions: string[];
};

export type EngineDeps = { sb?: SupabaseClient };

export type ListOptions = {
  /** Equality filters. Accepts an object or a JSON / k=v&k2=v2 string. */
  filters?: Record<string, unknown> | string;
  search?: string;
  sort?: string;
  order?: "asc" | "desc";
  page?: number;
  pageSize?: number;
  select?: string;
  includeDeleted?: boolean;
};

export type ListResult<T> = {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
};

export type BulkAction = "delete" | "restore" | "archive";

export type BulkResult = {
  action: BulkAction;
  success: string[];
  failed: { id: string; error: string }[];
};

const RESERVED_FILTER_KEYS = new Set([
  "id",
  "page",
  "pageSize",
  "page_size",
  "sort",
  "order",
  "search",
  "select",
  "includeDeleted",
  "export",
  "bulk",
  "ids",
  "restore",
  "archive",
]);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function withEntity(
  scope: CrudScope,
  entity: string,
  action: CrudAction
): EntityDefinition {
  const def = getEntityDefinition(entity);
  if (!def) {
    throw new EngineError("UNKNOWN_ENTITY", `Unknown entity: ${entity}`, 404);
  }
  const permission = permissionForAction(def, action);
  if (!scope.isPlatformAdmin && !scope.permissions.includes(permission)) {
    throw new EngineError(
      "MISSING_PERMISSION",
      `Missing permission: ${permission}`,
      403
    );
  }
  return def;
}

/** Drop identity + lifecycle fields that must never come from the client. */
function stripBlacklist(
  payload: Record<string, unknown>
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload)) {
    if (!DEFAULT_WRITE_BLACKLIST.includes(key)) out[key] = value;
  }
  return out;
}

/** Map assertTenantAndCompany() failures to engine error codes. */
function mapIsolationError(e: unknown): never {
  const message = e instanceof Error ? e.message : String(e);
  if (message.includes("tenant boundary")) {
    throw new EngineError("CROSS_TENANT", message, 403);
  }
  if (message.includes("active company")) {
    throw new EngineError("CROSS_COMPANY", message, 403);
  }
  throw new EngineError("INTERNAL", message, 500);
}

async function fetchScopedRow(
  sb: SupabaseClient,
  scope: CrudScope,
  def: EntityDefinition,
  id: string
): Promise<Record<string, unknown>> {
  let query = sb
    .from(def.table)
    .select("*")
    .eq(def.primaryKey, id)
    .eq("company_id", scope.companyId);
  if (scope.tenantId) query = query.eq("tenant_id", scope.tenantId);
  const { data, error } = await query.maybeSingle();
  if (error) {
    throw new EngineError("INTERNAL", error.message, 500);
  }
  if (!data) {
    throw new EngineError("NOT_FOUND", `${def.entity} not found`, 404);
  }
  try {
    assertTenantAndCompany(
      scope,
      data as { tenant_id?: string; company_id?: string },
      def.entity
    );
  } catch (e) {
    mapIsolationError(e);
  }
  return data as Record<string, unknown>;
}

type AuditEntry = {
  action: string;
  module: string;
  entityType?: string;
  entityId?: string | null;
  entityReference?: string | null;
  beforeState?: unknown;
  afterState?: unknown;
  metadata?: Record<string, unknown>;
  ipAddress?: string | null;
  userAgent?: string | null;
};

/**
 * Append an immutable audit row. Best-effort: audit must never break the
 * business operation, so failures are logged and swallowed.
 */
async function writeAudit(
  sb: SupabaseClient,
  scope: CrudScope,
  entry: AuditEntry
): Promise<void> {
  try {
    await sb.from("audit_logs").insert({
      company_id: scope.companyId,
      user_id: scope.userId,
      action: entry.action.slice(0, 100),
      module: entry.module.slice(0, 50),
      entity_type: entry.entityType?.slice(0, 50) ?? null,
      entity_id:
        entry.entityId && UUID_RE.test(entry.entityId) ? entry.entityId : null,
      entity_reference:
        entry.entityReference ??
        (entry.entityId && !UUID_RE.test(entry.entityId) ? entry.entityId : null),
      before_state: entry.beforeState ?? null,
      after_state: entry.afterState ?? null,
      metadata: entry.metadata ?? {},
      ip_address: entry.ipAddress ?? null,
      user_agent: entry.userAgent ?? null,
    });
  } catch (e) {
    log.warn("crud.audit.failed", {
      companyId: scope.companyId,
      entity: entry.entityType,
      action: entry.action,
      error: e instanceof Error ? e.message : String(e),
    });
  }
}

/** Enqueue a lifecycle workflow as a tenant-scoped job (non-blocking). */
async function enqueueWorkflow(
  sb: SupabaseClient,
  scope: CrudScope,
  def: EntityDefinition,
  action: "onCreate" | "onUpdate" | "onDelete",
  record: Record<string, unknown>
): Promise<void> {
  const workflowType = def.workflows?.[action];
  if (!workflowType) return;
  try {
    await enqueueJob(sb, {
      companyId: scope.companyId,
      tenantId: scope.tenantId,
      jobType: "generic",
      payload: {
        workflow: workflowType,
        entity: def.entity,
        entityId: record[def.primaryKey] ?? null,
        action,
        record,
      },
    });
  } catch (e) {
    log.warn("crud.workflow.enqueue.failed", {
      companyId: scope.companyId,
      entity: def.entity,
      workflow: workflowType,
      error: e instanceof Error ? e.message : String(e),
    });
  }
}

function parseFilters(raw: ListOptions["filters"]): Record<string, unknown> {
  if (!raw) return {};
  if (typeof raw !== "string") return raw;
  try {
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    const out: Record<string, unknown> = {};
    for (const pair of raw.split("&")) {
      const eq = pair.indexOf("=");
      if (eq < 0) continue;
      const key = decodeURIComponent(pair.slice(0, eq));
      const value = decodeURIComponent(pair.slice(eq + 1));
      if (key) out[key] = value;
    }
    return out;
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type QueryBuilder = any;

function buildListQuery(
  sb: SupabaseClient,
  scope: CrudScope,
  def: EntityDefinition,
  opts: ListOptions
): QueryBuilder {
  let query = sb.from(def.table).select(opts.select || "*", { count: "exact" });
  query = query.eq("company_id", scope.companyId);
  if (scope.tenantId) query = query.eq("tenant_id", scope.tenantId);
  if (!opts.includeDeleted && def.softDelete && def.deletedColumn) {
    query = query.is(def.deletedColumn, null);
  }
  for (const [key, value] of Object.entries(parseFilters(opts.filters))) {
    if (RESERVED_FILTER_KEYS.has(key)) continue;
    if (Array.isArray(value)) {
      query = query.in(key, value as string[]);
    } else if (
      value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      ("gte" in value ||
        "lte" in value ||
        "gt" in value ||
        "lt" in value ||
        "neq" in value ||
        "is" in value ||
        "not_in" in value ||
        "nin" in value)
    ) {
      // Range / inequality operators for KPI hubs (e.g. { gte: "2026-01-01" })
      const v = value as Record<string, unknown>;
      if (v.gte != null) query = query.gte(key, v.gte);
      if (v.lte != null) query = query.lte(key, v.lte);
      if (v.gt != null) query = query.gt(key, v.gt);
      if (v.lt != null) query = query.lt(key, v.lt);
      if (v.neq != null) query = query.neq(key, v.neq);
      if (v.is === null) query = query.is(key, null);
      const notIn = (v.not_in ?? v.nin) as unknown;
      if (Array.isArray(notIn) && notIn.length > 0) {
        // PostgREST not.in — values as parenthesized list
        const list = notIn
          .map((x) => {
            if (typeof x === "number" || typeof x === "boolean") return String(x);
            const s = String(x).replace(/"/g, "");
            return `"${s}"`;
          })
          .join(",");
        query = query.not(key, "in", `(${list})`);
      }
    } else if (value !== undefined && value !== null && value !== "") {
      query = query.eq(key, value);
    }
  }
  const term = opts.search?.trim();
  if (term && def.searchable?.length) {
    const safe = sanitizePostgrestFilter(term);
    if (def.searchable.length === 1) {
      query = query.ilike(def.searchable[0], `%${safe}%`);
    } else {
      query = query.or(def.searchable.map((c) => `${c}.ilike.%${safe}%`).join(","));
    }
  }
  const sortCol = opts.sort || def.sortable?.[0];
  if (sortCol) {
    query = query.order(sortCol, { ascending: opts.order !== "desc" });
  }
  return query;
}

export async function listEntities<T = Record<string, unknown>>(
  scope: CrudScope,
  entity: string,
  opts: ListOptions = {},
  deps: EngineDeps = {}
): Promise<ListResult<T>> {
  const def = withEntity(scope, entity, "view");
  const sb = deps.sb ?? (await createClient());
  const page = Math.max(1, opts.page ?? 1);
  // Cap at 500 so hub aggregations can page without unbounded responses
  const pageSize = Math.min(500, Math.max(1, opts.pageSize ?? 25));
  const query = buildListQuery(sb, scope, def, opts).range(
    (page - 1) * pageSize,
    page * pageSize - 1
  );
  const { data, error, count } = await query;
  if (error) {
    throw new EngineError("INTERNAL", error.message, 500);
  }
  const rows = (data ?? []) as T[];
  return { data: rows, total: count ?? rows.length, page, pageSize };
}

export async function exportEntities<T = Record<string, unknown>>(
  scope: CrudScope,
  entity: string,
  opts: ListOptions = {},
  deps: EngineDeps = {}
): Promise<{ rows: T[]; total: number }> {
  const def = withEntity(scope, entity, "export");
  const sb = deps.sb ?? (await createClient());
  const query = buildListQuery(sb, scope, def, opts).limit(10000);
  const { data, error, count } = await query;
  if (error) {
    throw new EngineError("INTERNAL", error.message, 500);
  }
  const rows = (data ?? []) as T[];
  return { rows, total: count ?? rows.length };
}

export async function getEntity<T = Record<string, unknown>>(
  scope: CrudScope,
  entity: string,
  id: string,
  deps: EngineDeps = {}
): Promise<T> {
  const def = withEntity(scope, entity, "view");
  const sb = deps.sb ?? (await createClient());
  return (await fetchScopedRow(sb, scope, def, id)) as T;
}

export async function createEntity<T = Record<string, unknown>>(
  scope: CrudScope,
  entity: string,
  payload: Record<string, unknown>,
  deps: EngineDeps = {}
): Promise<T> {
  const def = withEntity(scope, entity, "create");
  const validation = validatePayload(entity, payload);
  if (!validation.ok) {
    throw new EngineError("VALIDATION", `Invalid ${def.entity} payload: ${validation.issues.join("; ")}`, 400);
  }
  const sb = deps.sb ?? (await createClient());
  const clean = stripBlacklist(payload);
  clean.company_id = scope.companyId;
  if (scope.tenantId) clean.tenant_id = scope.tenantId;
  if (def.createdBy) clean.created_by = scope.userId;
  if (def.updatedBy) clean.updated_by = scope.userId;
  const { data, error } = await sb.from(def.table).insert(clean).select().single();
  if (error) {
    throw new EngineError("VALIDATION", error.message, 400);
  }
  const row = (data ?? clean) as Record<string, unknown>;
  await writeAudit(sb, scope, {
    action: `${def.entity}.create`,
    module: def.module,
    entityType: def.entity,
    entityId: row[def.primaryKey] ? String(row[def.primaryKey]) : null,
    afterState: row,
    metadata: { entityId: row[def.primaryKey] ?? null },
  });
  await enqueueWorkflow(sb, scope, def, "onCreate", row);
  return row as T;
}

export async function updateEntity<T = Record<string, unknown>>(
  scope: CrudScope,
  entity: string,
  id: string,
  payload: Record<string, unknown>,
  deps: EngineDeps = {}
): Promise<T> {
  const def = withEntity(scope, entity, "update");
  const validation = validatePayload(entity, payload);
  if (!validation.ok) {
    throw new EngineError("VALIDATION", `Invalid ${def.entity} payload: ${validation.issues.join("; ")}`, 400);
  }
  const sb = deps.sb ?? (await createClient());
  const existing = await fetchScopedRow(sb, scope, def, id);
  const clean = stripBlacklist(payload);
  if (def.updatedBy) clean.updated_by = scope.userId;
  if (def.hasUpdatedAt !== false) {
    clean.updated_at = new Date().toISOString();
  }
  let query = sb
    .from(def.table)
    .update(clean)
    .eq(def.primaryKey, id)
    .eq("company_id", scope.companyId);
  if (scope.tenantId) query = query.eq("tenant_id", scope.tenantId);
  const { data, error } = await query.select().single();
  if (error) {
    throw new EngineError("VALIDATION", error.message, 400);
  }
  const row = (data ?? { ...existing, ...clean }) as Record<string, unknown>;
  await writeAudit(sb, scope, {
    action: `${def.entity}.update`,
    module: def.module,
    entityType: def.entity,
    entityId: id,
    beforeState: existing,
    afterState: row,
    metadata: { entityId: id },
  });
  await enqueueWorkflow(sb, scope, def, "onUpdate", row);
  return row as T;
}

export async function deleteEntity(
  scope: CrudScope,
  entity: string,
  id: string,
  deps: EngineDeps = {}
): Promise<{ id: string; deleted: boolean; soft: boolean }> {
  const def = withEntity(scope, entity, "delete");
  const sb = deps.sb ?? (await createClient());
  const existing = await fetchScopedRow(sb, scope, def, id);
  let error: { message: string } | null = null;
  if (def.softDelete && def.deletedColumn) {
    const patch: Record<string, unknown> = {
      [def.deletedColumn]: new Date().toISOString(),
    };
    if (def.updatedBy) patch.updated_by = scope.userId;
    if (def.hasUpdatedAt !== false) {
      patch.updated_at = new Date().toISOString();
    }
    let query = sb
      .from(def.table)
      .update(patch)
      .eq(def.primaryKey, id)
      .eq("company_id", scope.companyId);
    if (scope.tenantId) query = query.eq("tenant_id", scope.tenantId);
    ({ error } = await query);
  } else {
    let query = sb
      .from(def.table)
      .delete()
      .eq(def.primaryKey, id)
      .eq("company_id", scope.companyId);
    if (scope.tenantId) query = query.eq("tenant_id", scope.tenantId);
    ({ error } = await query);
  }
  if (error) {
    throw new EngineError("VALIDATION", error.message, 400);
  }
  await writeAudit(sb, scope, {
    action: `${def.entity}.delete`,
    module: def.module,
    entityType: def.entity,
    entityId: id,
    beforeState: existing,
    metadata: { id, soft: Boolean(def.softDelete) },
  });
  await enqueueWorkflow(sb, scope, def, "onDelete", { id, ...existing });
  return { id, deleted: true, soft: Boolean(def.softDelete) };
}

export async function restoreEntity<T = Record<string, unknown>>(
  scope: CrudScope,
  entity: string,
  id: string,
  deps: EngineDeps = {}
): Promise<T> {
  const def = withEntity(scope, entity, "restore");
  const sb = deps.sb ?? (await createClient());
  const existing = await fetchScopedRow(sb, scope, def, id);
  const patch: Record<string, unknown> = {};
  if (def.softDelete && def.deletedColumn) {
    patch[def.deletedColumn] = null;
  }
  if (def.archivedAt) {
    patch[def.archiveTimestampColumn ?? "archived_at"] = null;
    if (def.archiveColumn) patch[def.archiveColumn] = false;
  }
  if (Object.keys(patch).length === 0) {
    throw new EngineError(
      "VALIDATION",
      `${def.entity} does not support restore`,
      400
    );
  }
  if (def.updatedBy) patch.updated_by = scope.userId;
  if (def.hasUpdatedAt !== false) {
    patch.updated_at = new Date().toISOString();
  }
  let query = sb
    .from(def.table)
    .update(patch)
    .eq(def.primaryKey, id)
    .eq("company_id", scope.companyId);
  if (scope.tenantId) query = query.eq("tenant_id", scope.tenantId);
  const { data, error } = await query.select().single();
  if (error) {
    throw new EngineError("VALIDATION", error.message, 400);
  }
  const row = (data ?? { ...existing, ...patch }) as Record<string, unknown>;
  await writeAudit(sb, scope, {
    action: `${def.entity}.restore`,
    module: def.module,
    entityType: def.entity,
    entityId: id,
    beforeState: existing,
    afterState: row,
    metadata: { entityId: id },
  });
  return row as T;
}

export async function archiveEntity<T = Record<string, unknown>>(
  scope: CrudScope,
  entity: string,
  id: string,
  deps: EngineDeps = {}
): Promise<T> {
  const def = withEntity(scope, entity, "archive");
  if (!def.archivedAt) {
    throw new EngineError(
      "VALIDATION",
      `${def.entity} does not support archive`,
      400
    );
  }
  const sb = deps.sb ?? (await createClient());
  const existing = await fetchScopedRow(sb, scope, def, id);
  const patch: Record<string, unknown> = {
    [def.archiveTimestampColumn ?? "archived_at"]: new Date().toISOString(),
  };
  if (def.archiveColumn) patch[def.archiveColumn] = true;
  if (def.updatedBy) patch.updated_by = scope.userId;
  if (def.hasUpdatedAt !== false) {
    patch.updated_at = new Date().toISOString();
  }
  let query = sb
    .from(def.table)
    .update(patch)
    .eq(def.primaryKey, id)
    .eq("company_id", scope.companyId);
  if (scope.tenantId) query = query.eq("tenant_id", scope.tenantId);
  const { data, error } = await query.select().single();
  if (error) {
    throw new EngineError("VALIDATION", error.message, 400);
  }
  const row = (data ?? { ...existing, ...patch }) as Record<string, unknown>;
  await writeAudit(sb, scope, {
    action: `${def.entity}.archive`,
    module: def.module,
    entityType: def.entity,
    entityId: id,
    beforeState: existing,
    afterState: row,
    metadata: { entityId: id },
  });
  return row as T;
}

export async function bulkOperation(
  scope: CrudScope,
  entity: string,
  action: BulkAction,
  ids: string[],
  deps: EngineDeps = {}
): Promise<BulkResult> {
  withEntity(scope, entity, "bulk");
  if (!Array.isArray(ids) || ids.length === 0) {
    throw new EngineError("VALIDATION", "Bulk operation requires ids", 400);
  }
  const sb = deps.sb ?? (await createClient());
  const success: string[] = [];
  const failed: { id: string; error: string }[] = [];
  for (const id of ids) {
    try {
      if (action === "delete") {
        await deleteEntity(scope, entity, id, { sb });
      } else if (action === "restore") {
        await restoreEntity(scope, entity, id, { sb });
      } else {
        await archiveEntity(scope, entity, id, { sb });
      }
      success.push(id);
    } catch (e) {
      failed.push({ id, error: e instanceof Error ? e.message : String(e) });
    }
  }
  return { action, success, failed };
}

export async function importEntities(
  scope: CrudScope,
  entity: string,
  rows: Record<string, unknown>[],
  deps: EngineDeps = {}
): Promise<{ inserted: number; jobId: string | null }> {
  const def = withEntity(scope, entity, "import");
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new EngineError(
      "VALIDATION",
      "Import requires a non-empty array of rows",
      400
    );
  }
  const sb = deps.sb ?? (await createClient());
  const cleaned = rows.map((row) => {
    const clean = stripBlacklist(row);
    clean.company_id = scope.companyId;
    if (scope.tenantId) clean.tenant_id = scope.tenantId;
    if (def.createdBy) clean.created_by = scope.userId;
    if (def.updatedBy) clean.updated_by = scope.userId;
    return clean;
  });
  const { data, error } = await sb.from(def.table).insert(cleaned).select();
  if (error) {
    throw new EngineError("VALIDATION", error.message, 400);
  }
  const inserted = (data ?? cleaned) as Record<string, unknown>[];
  let jobId: string | null = null;
  try {
    const job = await enqueueJob(sb, {
      companyId: scope.companyId,
      tenantId: scope.tenantId,
      jobType: "import.batch",
      payload: {
        entity: def.entity,
        count: inserted.length,
        importedById: scope.userId,
      },
    });
    jobId = job?.id ?? null;
  } catch (e) {
    log.warn("crud.import.enqueue.failed", {
      companyId: scope.companyId,
      entity: def.entity,
      error: e instanceof Error ? e.message : String(e),
    });
  }
  await writeAudit(sb, scope, {
    action: `${def.entity}.import`,
    module: def.module,
    entityType: def.entity,
    metadata: { count: inserted.length, jobId },
  });
  return { inserted: inserted.length, jobId };
}

/**
 * Minimal RFC-4180-ish CSV stringifier. Escapes fields containing quotes,
 * commas or newlines; safe to stream to a response.
 */
export function csvStringify(rows: Record<string, unknown>[]): string {
  if (!rows.length) return "";
  const columns = Array.from(new Set(rows.flatMap((row) => Object.keys(row))));
  const escape = (value: unknown): string => {
    const s = value === null || value === undefined ? "" : String(value);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const header = columns.map(escape).join(",");
  const lines = rows.map((row) => columns.map((col) => escape(row[col])).join(","));
  return [header, ...lines].join("\n");
}
