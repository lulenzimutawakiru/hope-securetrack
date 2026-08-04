/**
 * Universal report engine.
 *
 * Executes a report definition against a real, registry-approved data source,
 * always scoping reads to the authenticated company (never client-supplied
 * company/tenant IDs). Every run is audited into bi_report_runs.
 *
 * No raw SQL is ever built from user input: the data source is resolved
 * through the registry and filter columns/operators are validated against the
 * introspected table columns.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { TenantScope } from "@/lib/tenant/context";
import {
  isValidColumn,
  isValidOperator,
  isKnownSource,
  isLegacySource,
  resolveSource,
  type FilterOperator,
} from "./registry";

export type ReportDefinition = {
  id?: string | null;
  report_code?: string | null;
  name?: string | null;
  description?: string | null;
  category?: string | null;
  module_key?: string | null;
  report_type?: string | null;
  data_source?: string | null;
  query_config?: Record<string, unknown> | null;
  parameters?: unknown;
  columns_config?: unknown;
  company_id?: string | null;
};

export type ReportFilter = {
  field: string;
  operator: FilterOperator;
  value: unknown;
};

export type RunReportOptions = {
  admin: SupabaseClient;
  scope: TenantScope;
  definition: ReportDefinition;
  /** Client-supplied parameter values (date ranges, filters, limit) */
  parameters?: Record<string, unknown>;
  format?: string;
  actorId?: string | null;
  limit?: number;
};

export type ReportRunResult = {
  runId: string | null;
  status: "completed" | "failed" | "empty";
  rowCount: number;
  durationMs: number;
  rows: Array<Record<string, unknown>>;
  columns: string[];
  note?: string;
  error?: string;
};

const MAX_ROWS = 5000;
const DEFAULT_ROWS = 500;

/** Introspection cache: table -> column names (per process). */
const columnCache = new Map<string, string[]>();

async function getTableColumns(
  admin: SupabaseClient,
  table: string
): Promise<string[]> {
  const cached = columnCache.get(table);
  if (cached) return cached;
  try {
    const { data } = await admin
      .from(table)
      .select("*")
      .limit(1);
    const first = ((data?.[0] ?? {}) as unknown) as Record<string, unknown>;
    const cols = Object.keys(first);
    columnCache.set(table, cols);
    return cols;
  } catch {
    return [];
  }
}

/** Parse a simple `SUM(table.column)` / `COUNT(...)` / `AVG(table.column)` formula. */
export function parseAggregateFormula(
  formula: string | null | undefined
): { fn: "sum" | "avg" | "count" | "min" | "max"; table: string; column?: string } | null {
  if (!formula) return null;
  const m = /^(SUM|AVG|COUNT|MIN|MAX)\(\s*(\w+)\.(\w+)\s*\)$/i.exec(formula.trim());
  if (!m) return null;
  const fn = m[1].toLowerCase() as "sum" | "avg" | "count" | "min" | "max";
  if (fn === "count") return { fn, table: m[2] };
  return { fn, table: m[2], column: m[3] };
}

/** Apply a whitelisted filter to a query builder. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applyFilter(q: any, field: string, operator: FilterOperator, value: unknown) {
  switch (operator) {
    case "eq":
      return q.eq(field, value);
    case "neq":
      return q.neq(field, value);
    case "gt":
      return q.gt(field, value);
    case "gte":
      return q.gte(field, value);
    case "lt":
      return q.lt(field, value);
    case "lte":
      return q.lte(field, value);
    case "in":
      return q.in(field, Array.isArray(value) ? value : [value]);
    case "contains":
      return q.ilike(field, `%${String(value)}%`);
    default:
      return q;
  }
}

/**
 * Run a report definition and audit the run.
 */
export async function runReport(
  opts: RunReportOptions
): Promise<ReportRunResult> {
  const { admin, scope, definition } = opts;
  const started = Date.now();
  const sourceKey = definition.data_source || "";
  const columns: string[] = [];
  const rows: Array<Record<string, unknown>> = [];
  let status: ReportRunResult["status"] = "completed";
  let note: string | undefined;

  const params = opts.parameters || {};

  try {
    if (!isKnownSource(sourceKey)) {
      if (isLegacySource(sourceKey)) {
        status = "empty";
        note = `Data source "${sourceKey}" is a legacy seed reference with no live table. Configure a real source in the report designer.`;
      } else if (!sourceKey) {
        status = "empty";
        note = "Report has no data source configured.";
      } else {
        status = "empty";
        note = `Data source "${sourceKey}" is not registered.`;
      }
      return finalize();
    }

    const source = resolveSource(sourceKey)!;
    const table = source.table;

    // Scope every read to the authenticated company.
    let q = admin
      .from(table)
      .select("*")
      .eq("company_id", scope.companyId);

    const tableCols = await getTableColumns(admin, table);

    // Date-range parameters on a date column the table actually has.
    const dateCol =
      tableCols.includes("created_at") ? "created_at" : undefined;
    if (dateCol) {
      if (params.date_from) q = q.gte(dateCol, String(params.date_from));
      if (params.date_to) q = q.lte(dateCol, String(params.date_to));
    }

    // Client filters: validate field + operator, never trust raw input.
    const rawFilters = Array.isArray(params.filters) ? params.filters : [];
    for (const f of rawFilters) {
      const filter = f as Partial<ReportFilter>;
      if (
        !filter ||
        !isValidColumn(filter.field) ||
        !isValidOperator(filter.operator)
      ) {
        continue;
      }
      if (filter.field === "company_id" || filter.field === "tenant_id") continue; // never client-scoped
      if (!tableCols.includes(filter.field)) continue;
      q = applyFilter(q, filter.field, filter.operator, filter.value);
    }

    // Order + bound.
    const orderCol = tableCols.includes("created_at")
      ? "created_at"
      : tableCols.includes("updated_at")
        ? "updated_at"
        : null;
    if (orderCol) q = q.order(orderCol, { ascending: false });

    const limitNum = Math.max(1, Math.min(MAX_ROWS, Number(params.limit) || DEFAULT_ROWS));
    q = q.limit(limitNum);

    const { data, error } = await q;
    if (error) throw new Error(error.message);

    const out = (data || []) as Array<Record<string, unknown>>;
    if (out.length) {
      columns.push(...Object.keys(out[0]));
    } else if (tableCols.length) {
      columns.push(...tableCols.slice(0, 24));
    }
    rows.push(...out);
    if (out.length === 0) status = "empty";
    return finalize();
  } catch (e) {
    status = "failed";
    note = e instanceof Error ? e.message : "Report execution failed";
    return finalize();
  }

  function finalize(): ReportRunResult {
    const durationMs = Date.now() - started;
    return {
      runId: null,
      status,
      rowCount: rows.length,
      durationMs,
      rows,
      columns,
      note,
    };
  }
}

/**
 * Persist a report run audit row (admin client, company-scoped).
 */
export async function recordReportRun(opts: {
  admin: SupabaseClient;
  scope: TenantScope;
  definition: ReportDefinition;
  result: ReportRunResult;
  format: string;
  actorId?: string | null;
}): Promise<string | null> {
  const { admin, scope, definition, result, format, actorId } = opts;
  const { data, error } = await admin
    .from("bi_report_runs")
    .insert({
      company_id: scope.companyId,
      report_id: definition.id || null,
      report_code: definition.report_code || null,
      run_by: actorId || null,
      parameters: result.error ? { error: result.error } : {},
      status: result.status,
      row_count: result.rowCount,
      format,
      duration_ms: result.durationMs,
      error_message: result.error || result.note || null,
      started_at: new Date(Date.now() - result.durationMs).toISOString(),
      completed_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (error || !data) return null;
  return (data as { id: string }).id;
}