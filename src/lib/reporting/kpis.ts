/**
 * KPI engine Ã¢â‚¬â€ rule-based metric computation against registry sources.
 *
 * Each active KPI is computed by parsing its aggregate formula
 * (`SUM(table.column)`, `AVG(...)`, `COUNT(...)`) or falling back to a
 * deterministic metric column heuristic per source. Results are persisted to
 * bi_kpis (actual/variance/trend) and bi_kpi_snapshots (time series), both
 * scoped to the authenticated company.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { TenantScope } from "@/lib/tenant/context";
import {
  isKnownSource,
  resolveSource,
  isValidColumn,
} from "./registry";
import { parseAggregateFormula } from "./engine";

export type KpiRow = {
  id?: string | null;
  company_id?: string | null;
  kpi_code?: string | null;
  name?: string | null;
  category?: string | null;
  department?: string | null;
  formula?: string | null;
  unit?: string | null;
  target_value?: number | string | null;
  actual_value?: number | string | null;
  variance_value?: number | string | null;
  variance_pct?: number | string | null;
  trend?: string | null;
  frequency?: string | null;
  threshold_warning?: number | string | null;
  threshold_critical?: number | string | null;
  higher_is_better?: boolean | null;
  data_source?: string | null;
  is_active?: boolean | null;
  last_calculated_at?: string | null;
};

const METRIC_COLUMN_PRIORITY = [
  "total_amount",
  "total",
  "amount",
  "value",
  "expected_value",
  "quantity",
  "planned_quantity",
  "balance",
  "closing_balance",
  "score",
  "oee",
  "rate",
  "cost",
  "price",
  "gross",
  "net",
  "net_pay",
  "actual_value",
  "duration_minutes",
  "distance_km",
  "allocation_pct",
  "hours",
  "profit",
  "estimated_cost",
  "budget",
  "impact_score",
];

const columnCache = new Map<string, string[]>();

async function getColumns(
  admin: SupabaseClient,
  table: string
): Promise<string[]> {
  const cached = columnCache.get(table);
  if (cached) return cached;
  try {
    const { data } = await admin.from(table).select("*").limit(1);
    const first = ((data?.[0] ?? {}) as unknown) as Record<string, unknown>;
    const cols = Object.keys(first);
    columnCache.set(table, cols);
    return cols;
  } catch {
    return [];
  }
}

function pickMetricColumn(
  cols: string[],
  sample: Record<string, unknown>,
  hint?: string
): string | null {
  const candidates = hint ? [hint, ...METRIC_COLUMN_PRIORITY] : METRIC_COLUMN_PRIORITY;
  for (const c of candidates) {
    if (cols.includes(c) && typeof sample[c] === "number") return c;
  }
  // Fall back to any numeric column (deterministic order).
  for (const c of cols) {
    if (typeof sample[c] === "number") return c;
  }
  return null;
}

/**
 * Compute a single KPI value. Returns null when the source is unregistered
 * or no metric can be derived (count fallback always succeeds).
 */
export async function computeKpiValue(
  admin: SupabaseClient,
  scope: TenantScope,
  kpi: KpiRow
): Promise<{ value: number; unit: string; via: string } | null> {
  const sourceKey = kpi.data_source || "";
  if (!isKnownSource(sourceKey)) return null;
  const source = resolveSource(sourceKey)!;
  const table = source.table;

  // Try to parse the aggregate formula first (SUM/AVG/MIN/MAX/COUNT).
  const parsed = parseAggregateFormula(kpi.formula);

  // COUNT of rows is always safe.
  if (parsed?.fn === "count") {
    const { count } = await admin
      .from(table)
      .select("*", { count: "exact", head: true })
      .eq("company_id", scope.companyId);
    return { value: Number(count || 0), unit: kpi.unit || "count", via: "count" };
  }

  const cols = await getColumns(admin, table);

  // When formula names an explicit column, only use it if it exists.
  if (parsed?.column) {
    if (!cols.includes(parsed.column)) return null;
    const { data, error } = await admin
      .from(table)
      .select(`${parsed.fn}(${parsed.column})`)
      .eq("company_id", scope.companyId);
    if (error) return null;
    const row = ((data?.[0] ?? {}) as unknown) as Record<string, unknown>;
    const val =
      row[`${parsed.fn}(${parsed.column})`] ?? row[parsed.fn] ?? null;
    if (val == null) return null;
    const num = Number(val);
    if (!Number.isFinite(num)) return null;
    return { value: num, unit: kpi.unit || "", via: `${parsed.fn}(${parsed.column})` };
  }

  // Heuristic metric column for formula-less / descriptive-formula KPIs.
  const { data: sample } = await admin
    .from(table)
    .select("*")
    .eq("company_id", scope.companyId)
    .limit(1);
  const first = ((sample?.[0] ?? {}) as unknown) as Record<string, unknown>;
  const metricCol = pickMetricColumn(cols, first, source.metricHint);
  if (!metricCol) {
    // No numeric metric: fall back to row count.
    const { count } = await admin
      .from(table)
      .select("*", { count: "exact", head: true })
      .eq("company_id", scope.companyId);
    return { value: Number(count || 0), unit: kpi.unit || "count", via: "count" };
  }
  const { data, error } = await admin
    .from(table)
    .select(`sum(${metricCol})`)
    .eq("company_id", scope.companyId);
  if (error) return null;
  const row = ((data?.[0] ?? {}) as unknown) as Record<string, unknown>;
  const val = row[`sum(${metricCol})`] ?? row.sum ?? null;
  if (val == null) return null;
  const num = Number(val);
  if (!Number.isFinite(num)) return null;
  return { value: num, unit: kpi.unit || "", via: `sum(${metricCol})` };
}

function pctChange(prev: number, cur: number): number | null {
  if (prev === 0) return null;
  return ((cur - prev) / Math.abs(prev)) * 100;
}

/**
 * Recalculate KPIs for the active company.
 * `kpiIds` limits the run (used by on-demand recalc); when omitted, all active
 * KPIs are recalculated. Returns per-KPI outcomes for API responses.
 */
export async function recalculateKpis(opts: {
  admin: SupabaseClient;
  scope: TenantScope;
  kpiIds?: string[];
}): Promise<Array<{ kpi_id: string; kpi_code: string; value: number; variance_pct: number; trend: string; ok: boolean }>> {
  const { admin, scope, kpiIds } = opts;
  const results: Array<{ kpi_id: string; kpi_code: string; value: number; variance_pct: number; trend: string; ok: boolean }> = [];

  let q = admin
    .from("bi_kpis")
    .select("id, company_id, kpi_code, name, formula, unit, target_value, data_source, is_active")
    .eq("company_id", scope.companyId)
    .eq("is_active", true);
  if (kpiIds?.length) q = q.in("id", kpiIds);

  const { data: kpis } = await q;
  if (!kpis?.length) return results;

  const today = new Date().toISOString().slice(0, 10);

  for (const kpi of kpis as unknown as KpiRow[]) {
    if (!kpi.id) continue;
    try {
      const metric = await computeKpiValue(admin, scope, kpi);
      if (!metric) continue;

      const value = metric.value;
      const target = Number(kpi.target_value ?? 0);
      const varianceValue = target !== 0 ? value - target : 0;
      const variancePct = target !== 0 ? ((value - target) / Math.abs(target)) * 100 : 0;

      // Trend vs most recent prior snapshot.
      const { data: prevSnap } = await admin
        .from("bi_kpi_snapshots")
        .select("actual_value, snapshot_date")
        .eq("kpi_id", kpi.id)
        .lt("snapshot_date", today)
        .order("snapshot_date", { ascending: false })
        .limit(1);
      let trend = "stable";
      const prevVal = prevSnap?.[0]?.actual_value;
      if (prevVal != null) {
        const delta = pctChange(Number(prevVal), value);
        if (delta != null) {
          trend = Math.abs(delta) < 1 ? "stable" : delta > 0 ? "up" : "down";
        }
      }

      await admin
        .from("bi_kpis")
        .update({
          actual_value: value,
          variance_value: varianceValue,
          variance_pct: variancePct,
          trend,
          last_calculated_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", kpi.id)
        .eq("company_id", scope.companyId);

      await admin
        .from("bi_kpi_snapshots")
        .upsert(
          {
            company_id: scope.companyId,
            kpi_id: kpi.id,
            snapshot_date: today,
            actual_value: value,
            target_value: target || null,
            variance_value: varianceValue,
            notes: `computed via ${metric.via} (${metric.unit})`,
          },
          { onConflict: "kpi_id,snapshot_date" }
        );

      results.push({
        kpi_id: kpi.id,
        kpi_code: String(kpi.kpi_code || ""),
        value,
        variance_pct: variancePct,
        trend,
        ok: true,
      });
    } catch {
      results.push({
        kpi_id: kpi.id,
        kpi_code: String(kpi.kpi_code || ""),
        value: 0,
        variance_pct: 0,
        trend: "stable",
        ok: false,
      });
    }
  }

  return results;
}