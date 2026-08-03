/**
 * Finance CRUD — browser helpers routed through /api/v2/crud/[entity].
 * EntityPages use SecureEntityPage directly; this module serves residual call sites.
 */

import {
  crudCreate,
  crudUpdate,
  crudDelete,
  crudRestore,
  crudList,
} from "@/lib/api/crud-client";
import {
  toCsv,
  downloadCsv,
  parseCsv,
  validateImportRows,
  type ImportFieldMap,
} from "@/lib/enterprise/csv";

export { toCsv, downloadCsv, parseCsv, validateImportRows };
export type { ImportFieldMap };

async function unwrap<T>(
  res: Awaited<ReturnType<typeof crudCreate<T>>>
): Promise<T> {
  if (!res.ok) throw new Error(res.error);
  return res.data;
}

export async function finAudit(_input: {
  company_id?: string | null;
  actor_id?: string | null;
  action: string;
  entity_table: string;
  entity_id?: string;
  entity_code?: string;
  details?: string;
}) {
  void _input; // server CRUD engine audits
}

export async function finList(
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
  void opts?.companyId;
  void opts?.searchCols;
  const filters: Record<string, unknown> = {};
  if (opts?.status && opts.status !== "all") filters.status = opts.status;
  const res = await crudList<Record<string, unknown>>(table, {
    page: 1,
    pageSize: opts?.limit ?? 100,
    search: opts?.search,
    includeDeleted: opts?.includeDeleted,
    sort: opts?.orderBy || "created_at",
    order: "desc",
    filters: Object.keys(filters).length ? filters : undefined,
  });
  if (!res.ok) throw new Error(res.error);
  return res.data.data;
}

export async function finCreate(
  table: string,
  row: Record<string, unknown>,
  _actorId?: string | null
) {
  void _actorId;
  const body = { ...row };
  delete body.company_id;
  delete body.tenant_id;
  delete body.created_by;
  delete body.updated_by;
  return unwrap(await crudCreate(table, body));
}

export async function finUpdate(
  table: string,
  id: string,
  patch: Record<string, unknown>,
  _actorId?: string | null
) {
  void _actorId;
  const body = { ...patch };
  delete body.company_id;
  delete body.tenant_id;
  delete body.id;
  return unwrap(await crudUpdate(table, id, body));
}

export async function finSoftDelete(
  table: string,
  id: string,
  _actorId?: string | null
) {
  void _actorId;
  return unwrap(await crudDelete(table, id));
}

export async function finRestore(
  table: string,
  id: string,
  _actorId?: string | null
) {
  void _actorId;
  return unwrap(await crudRestore(table, id));
}

export async function finDuplicate(
  table: string,
  id: string,
  overrides: Record<string, unknown>,
  _actorId?: string | null
) {
  void _actorId;
  const res = await crudList(table, { pageSize: 1, filters: { id } });
  if (!res.ok) throw new Error(res.error);
  const src = res.data.data[0] as Record<string, unknown> | undefined;
  if (!src) throw new Error("Record not found");
  const {
    id: _id,
    created_at: _c,
    updated_at: _u,
    deleted_at: _d,
    created_by: _cb,
    updated_by: _ub,
    company_id: _co,
    tenant_id: _te,
    ...rest
  } = src;
  return finCreate(table, { ...rest, ...overrides });
}

export async function finBulkStatus(
  table: string,
  ids: string[],
  status: string,
  _actorId?: string | null
) {
  void _actorId;
  const out = [];
  for (const id of ids) {
    out.push(await finUpdate(table, id, { status }));
  }
  return out;
}

export async function finNextNumber(
  _table: string,
  _companyId: string,
  prefix: string,
  _field = "code"
): Promise<string> {
  void _table;
  void _companyId;
  void _field;
  const year = new Date().getFullYear();
  return `${prefix}-${year}-${String(Date.now() % 100000).padStart(5, "0")}`;
}

export async function finImportCsv(
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
  void opts.companyId;
  void opts.actorId;
  const parsed = parseCsv(csvText);
  if (parsed.errors.length && !parsed.rows.length) {
    return {
      success: 0,
      failed: 0,
      errors: parsed.errors.map((e, i) => ({ row: i + 1, errors: [e] })),
      createdIds: [],
    };
  }
  const { valid, invalid } = validateImportRows(parsed.rows, opts.fieldMap);
  const createdIds: string[] = [];
  const runtimeErrors: Array<{ row: number; errors: string[] }> = invalid.map(
    (i) => ({ row: i.row, errors: i.errors })
  );
  for (let i = 0; i < valid.length; i++) {
    try {
      const row = await finCreate(table, valid[i]);
      createdIds.push(String((row as { id: string }).id));
    } catch (e) {
      runtimeErrors.push({
        row: i + 2,
        errors: [e instanceof Error ? e.message : "Insert failed"],
      });
    }
  }
  return {
    success: createdIds.length,
    failed: runtimeErrors.length,
    errors: runtimeErrors,
    createdIds,
  };
}
