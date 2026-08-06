/**
 * Talent CRUD — browser helpers routed through /api/v2/crud/[entity].
 * Never write business rows via the browser Supabase client.
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

/** @deprecated Prefer useEntityList — kept for residual call sites. */
export async function taList(
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
  void opts?.companyId; // session-scoped server-side
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

export async function taCreate(
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

export async function taUpdate(
  table: string,
  id: string,
  patch: Record<string, unknown>,
  _actorId?: string | null
) {
  void _actorId;
  const body = { ...patch };
  delete body.company_id;
  delete body.tenant_id;
  delete body.created_by;
  delete body.updated_by;
  delete body.id;
  return unwrap(await crudUpdate(table, id, body));
}

export async function taSoftDelete(
  table: string,
  id: string,
  _actorId?: string | null
) {
  void _actorId;
  return unwrap(await crudDelete(table, id));
}

export async function taRestore(
  table: string,
  id: string,
  _actorId?: string | null
) {
  void _actorId;
  return unwrap(await crudRestore(table, id));
}

export async function taDuplicate(
  table: string,
  id: string,
  overrides: Record<string, unknown>,
  _actorId?: string | null
) {
  void _actorId;
  const res = await crudList(table, {
    pageSize: 1,
    filters: { id },
  });
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
  return taCreate(table, { ...rest, ...overrides });
}

export async function taBulkStatus(
  table: string,
  ids: string[],
  status: string,
  _actorId?: string | null
) {
  void _actorId;
  const out = [];
  for (const id of ids) {
    out.push(await taUpdate(table, id, { status }));
  }
  return out;
}

export async function taNextNumber(
  _table: string,
  _companyId: string,
  prefix: string,
  _field = "code"
): Promise<string> {
  void _table;
  void _companyId;
  void _field;
  const year = new Date().getFullYear();
  const n = Date.now() % 100000;
  return `${prefix}-${year}-${String(n).padStart(5, "0")}`;
}

/** no-op audit — server engine writes audit_logs */
export async function taAudit(_input: {
  company_id?: string | null;
  actor_id?: string | null;
  action: string;
  entity_table: string;
  entity_id?: string;
  entity_code?: string;
  details?: string;
}) {
  void _input;
}
