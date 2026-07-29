import { createClient } from "@/lib/supabase/client";

function sb() {
  return createClient();
}

export async function salesAudit(input: {
  company_id?: string | null;
  actor_id?: string | null;
  action: string;
  entity_table: string;
  entity_id?: string;
  entity_code?: string;
  details?: string;
}) {
  try {
    await sb().from("sales_audit_log").insert({
      company_id: input.company_id || null,
      actor_id: input.actor_id || null,
      action: input.action,
      entity_table: input.entity_table,
      entity_id: input.entity_id || null,
      entity_code: input.entity_code || null,
      details: input.details || null,
    });
  } catch {
    /* non-blocking */
  }
}

const NO_SOFT_DELETE = new Set(["sales_audit_log", "quotation_lines", "sales_order_lines", "sales_return_lines"]);
const NO_COMPANY = new Set(["quotation_lines", "sales_order_lines", "sales_return_lines"]);

export async function salesList(
  table: string,
  opts?: {
    companyId?: string;
    status?: string;
    search?: string;
    searchCols?: string[];
    limit?: number;
    includeDeleted?: boolean;
    orderBy?: string;
  }
) {
  let q = sb().from(table).select("*").limit(opts?.limit ?? 400);
  if (opts?.companyId && !NO_COMPANY.has(table)) q = q.eq("company_id", opts.companyId);
  if (!opts?.includeDeleted && !NO_SOFT_DELETE.has(table)) q = q.is("deleted_at", null);
  if (opts?.status && opts.status !== "all") q = q.eq("status", opts.status);
  if (opts?.orderBy) q = q.order(opts.orderBy, { ascending: false });
  else if (table === "sales_audit_log") q = q.order("created_at", { ascending: false });
  else q = q.order("created_at", { ascending: false });

  const { data, error } = await q;
  if (error) {
    // Fallback for tables missing optional columns
    let q2 = sb().from(table).select("*").limit(opts?.limit ?? 400);
    if (opts?.companyId && !NO_COMPANY.has(table)) q2 = q2.eq("company_id", opts.companyId);
    const res = await q2;
    if (res.error) throw error;
    let rows = res.data || [];
    if (opts?.search?.trim() && opts.searchCols?.length) {
      const s = opts.search.trim().toLowerCase();
      rows = rows.filter((r) =>
        opts.searchCols!.some((c) =>
          String((r as Record<string, unknown>)[c] ?? "")
            .toLowerCase()
            .includes(s)
        )
      );
    }
    return rows;
  }
  let rows = data || [];

  if (opts?.search?.trim() && opts.searchCols?.length) {
    const s = opts.search.trim().toLowerCase();
    rows = rows.filter((r) =>
      opts.searchCols!.some((c) =>
        String((r as Record<string, unknown>)[c] ?? "")
          .toLowerCase()
          .includes(s)
      )
    );
  }
  return rows;
}

export async function salesCreate(
  table: string,
  row: Record<string, unknown>,
  actorId?: string | null
) {
  const payload = {
    ...row,
    created_by: row.created_by ?? actorId ?? null,
    updated_by: actorId ?? null,
  };
  const { data, error } = await sb().from(table).insert(payload).select("*").single();
  if (error) throw error;
  await salesAudit({
    company_id: data.company_id,
    actor_id: actorId,
    action: "create",
    entity_table: table,
    entity_id: data.id,
    entity_code: String(
      data.order_number ||
        data.quote_number ||
        data.lead_number ||
        data.opportunity_number ||
        data.contract_number ||
        data.team_code ||
        data.price_list_code ||
        data.activity_code ||
        data.code ||
        data.name ||
        ""
    ),
  });
  return data;
}

export async function salesUpdate(
  table: string,
  id: string,
  patch: Record<string, unknown>,
  actorId?: string | null
) {
  const { data, error } = await sb()
    .from(table)
    .update({ ...patch, updated_by: actorId ?? null, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  await salesAudit({
    company_id: data.company_id,
    actor_id: actorId,
    action: "update",
    entity_table: table,
    entity_id: id,
  });
  return data;
}

export async function salesSoftDelete(table: string, id: string, actorId?: string | null) {
  const { data, error } = await sb()
    .from(table)
    .update({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .single();
  if (error) {
    const { data: d2, error: e2 } = await sb()
      .from(table)
      .update({ status: "cancelled" })
      .eq("id", id)
      .select("*")
      .maybeSingle();
    if (e2) throw error;
    return d2;
  }
  await salesAudit({
    company_id: data?.company_id,
    actor_id: actorId,
    action: "soft_delete",
    entity_table: table,
    entity_id: id,
  });
  return data;
}

export async function salesRestore(table: string, id: string, actorId?: string | null) {
  const { data, error } = await sb()
    .from(table)
    .update({ deleted_at: null, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  await salesAudit({
    company_id: data.company_id,
    actor_id: actorId,
    action: "restore",
    entity_table: table,
    entity_id: id,
  });
  return data;
}

export async function salesDuplicate(
  table: string,
  id: string,
  overrides: Record<string, unknown>,
  actorId?: string | null
) {
  const { data: src, error } = await sb().from(table).select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  if (!src) throw new Error("Record not found");
  const {
    id: _id,
    created_at: _c,
    updated_at: _u,
    deleted_at: _d,
    approved_at: _a,
    ...rest
  } = src as Record<string, unknown>;
  return salesCreate(table, { ...rest, ...overrides }, actorId);
}

export async function salesBulkStatus(
  table: string,
  ids: string[],
  status: string,
  actorId?: string | null
) {
  const { data, error } = await sb()
    .from(table)
    .update({ status, updated_at: new Date().toISOString() })
    .in("id", ids)
    .select("*");
  if (error) throw error;
  for (const id of ids) {
    await salesAudit({
      actor_id: actorId,
      action: "bulk_status",
      entity_table: table,
      entity_id: id,
      details: status,
    });
  }
  return data || [];
}

export async function salesNextNumber(
  table: string,
  companyId: string,
  prefix: string,
  _field = "code"
): Promise<string> {
  const year = new Date().getFullYear();
  const { count } = await sb()
    .from(table)
    .select("*", { count: "exact", head: true })
    .eq("company_id", companyId);
  return `${prefix}-${year}-${String((count ?? 0) + 1).padStart(5, "0")}`;
}

export function toCsv(rows: Array<Record<string, unknown>>, columns: string[]): string {
  const esc = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return s.includes(",") || s.includes('"') || s.includes("\n")
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  };
  const header = columns.join(",");
  const body = rows.map((r) => columns.map((c) => esc(r[c])).join(",")).join("\n");
  return `${header}\n${body}`;
}

export function downloadCsv(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
