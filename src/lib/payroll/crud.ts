import { createClient } from "@/lib/supabase/client";

function sb() {
  return createClient();
}

export async function payAudit(input: {
  company_id?: string | null;
  actor_id?: string | null;
  action: string;
  entity_table?: string;
  entity_type?: string;
  entity_id?: string;
  entity_code?: string;
  details?: string;
}) {
  try {
    const entityType = input.entity_type || input.entity_table || null;
    const detailParts = [
      input.details,
      input.entity_code ? `code=${input.entity_code}` : null,
      input.entity_table && !input.entity_type ? `table=${input.entity_table}` : null,
    ].filter(Boolean);
    await sb().from("pay_audit").insert({
      company_id: input.company_id || null,
      actor_id: input.actor_id || null,
      action: input.action,
      entity_type: entityType,
      entity_id: input.entity_id || null,
      details: detailParts.join(" · ") || null,
    });
  } catch {
    /* non-blocking */
  }
}

export async function payList(
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
  if (opts?.companyId) q = q.eq("company_id", opts.companyId);
  if (!opts?.includeDeleted && table !== "pay_audit") q = q.is("deleted_at", null);
  if (opts?.status && opts.status !== "all") q = q.eq("status", opts.status);
  if (opts?.orderBy) q = q.order(opts.orderBy, { ascending: false });
  else q = q.order("created_at", { ascending: false });

  const { data, error } = await q;
  if (error) {
    let q2 = sb().from(table).select("*").limit(opts?.limit ?? 400);
    if (opts?.companyId) q2 = q2.eq("company_id", opts.companyId);
    const res = await q2;
    if (res.error) throw error;
    return res.data || [];
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

export async function payCreate(
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
  await payAudit({
    company_id: data.company_id,
    actor_id: actorId,
    action: "create",
    entity_table: table,
    entity_id: data.id,
    entity_code: String(
      data.requisition_number || data.vacancy_code || data.application_number || data.candidate_number || data.offer_number || data.template_code ||
        data.batch_code ||
        data.label_number ||
        data.job_code ||
        data.format_code ||
        data.material_code ||
        data.code ||
        data.name ||
        ""
    ),
  });
  return data;
}

export async function payUpdate(
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
  await payAudit({
    company_id: data.company_id,
    actor_id: actorId,
    action: "update",
    entity_table: table,
    entity_id: id,
  });
  return data;
}

export async function paySoftDelete(table: string, id: string, actorId?: string | null) {
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
  await payAudit({
    company_id: data?.company_id,
    actor_id: actorId,
    action: "soft_delete",
    entity_table: table,
    entity_id: id,
  });
  return data;
}

export async function payRestore(table: string, id: string, actorId?: string | null) {
  const { data, error } = await sb()
    .from(table)
    .update({ deleted_at: null, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  await payAudit({
    company_id: data.company_id,
    actor_id: actorId,
    action: "restore",
    entity_table: table,
    entity_id: id,
  });
  return data;
}

export async function payDuplicate(
  table: string,
  id: string,
  overrides: Record<string, unknown>,
  actorId?: string | null
) {
  const { data: src, error } = await sb().from(table).select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  if (!src) throw new Error("Record not found");
  const { id: _id, created_at: _c, updated_at: _u, deleted_at: _d, ...rest } =
    src as Record<string, unknown>;
  return payCreate(table, { ...rest, ...overrides }, actorId);
}

export async function payBulkStatus(
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
    await payAudit({
      actor_id: actorId,
      action: "bulk_status",
      entity_table: table,
      entity_id: id,
      details: status,
    });
  }
  return data || [];
}

export async function payNextNumber(
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

export {
  toCsv,
  downloadCsv,
  parseCsv,
  validateImportRows,
  type ImportFieldMap,
  type ImportValidation,
} from "@/lib/enterprise/csv";

import {
  parseCsv,
  validateImportRows,
  type ImportFieldMap,
} from "@/lib/enterprise/csv";

/**
 * Bulk CSV import for payroll master data (company-scoped, audited).
 */
export async function payImportCsv(
  table: string,
  csvText: string,
  opts: {
    companyId: string;
    actorId?: string | null;
    fieldMap: ImportFieldMap;
  }
): Promise<{
  success: number;
  failed: number;
  errors: Array<{ row: number; errors: string[] }>;
  createdIds: string[];
}> {
  const parsed = parseCsv(csvText);
  if (parsed.errors.length && !parsed.rows.length) {
    return {
      success: 0,
      failed: 0,
      errors: parsed.errors.map((e, i) => ({ row: i + 1, errors: [e] })),
      createdIds: [],
    };
  }

  const map: ImportFieldMap = {
    ...opts.fieldMap,
    defaults: {
      ...(opts.fieldMap.defaults || {}),
      company_id: opts.companyId,
    },
  };
  const { valid, invalid } = validateImportRows(parsed.rows, map);
  const createdIds: string[] = [];
  const runtimeErrors: Array<{ row: number; errors: string[] }> = invalid.map(
    (i) => ({ row: i.row, errors: i.errors })
  );

  for (let i = 0; i < valid.length; i++) {
    try {
      const row = await payCreate(table, valid[i], opts.actorId);
      createdIds.push(String(row.id));
    } catch (e) {
      runtimeErrors.push({
        row: i + 2,
        errors: [e instanceof Error ? e.message : "Insert failed"],
      });
    }
  }

  try {
    await sb().from("enterprise_import_batches").insert({
      company_id: opts.companyId,
      module: "payroll",
      entity_table: table,
      total_rows: parsed.rows.length,
      success_rows: createdIds.length,
      error_rows: runtimeErrors.length,
      errors: runtimeErrors.slice(0, 100),
      status: runtimeErrors.length ? "partial" : "completed",
      created_by: opts.actorId || null,
    });
  } catch {
    /* non-blocking if migration not applied */
  }

  await payAudit({
    company_id: opts.companyId,
    actor_id: opts.actorId,
    action: "import",
    entity_table: table,
    details: `imported=${createdIds.length} failed=${runtimeErrors.length}`,
  });

  return {
    success: createdIds.length,
    failed: runtimeErrors.length,
    errors: runtimeErrors,
    createdIds,
  };
}
