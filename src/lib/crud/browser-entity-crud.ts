/**
 * Shared browser-side entity CRUD helpers for module libs.
 * All reads/writes go through /api/v2/crud (session-scoped, permissioned, audited).
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

export type ListOpts = {
  companyId?: string;
  status?: string;
  search?: string;
  searchCols?: string[];
  limit?: number;
  includeDeleted?: boolean;
  orderBy?: string;
};

async function unwrap<T>(
  res: Awaited<ReturnType<typeof crudCreate<T>>>
): Promise<T> {
  if (!res.ok) throw new Error(res.error);
  return res.data;
}

export function createBrowserEntityCrud() {
  async function list(table: string, opts?: ListOpts) {
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

  async function create(
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

  async function update(
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

  async function softDelete(
    table: string,
    id: string,
    _actorId?: string | null
  ) {
    void _actorId;
    return unwrap(await crudDelete(table, id));
  }

  async function restore(
    table: string,
    id: string,
    _actorId?: string | null
  ) {
    void _actorId;
    return unwrap(await crudRestore(table, id));
  }

  async function duplicate(
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
    return create(table, { ...rest, ...overrides });
  }

  async function bulkStatus(
    table: string,
    ids: string[],
    status: string,
    _actorId?: string | null
  ) {
    void _actorId;
    const out = [];
    for (const id of ids) {
      out.push(await update(table, id, { status }));
    }
    return out;
  }

  async function nextNumber(
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

  async function importCsv(
    table: string,
    csvText: string,
    opts: {
      companyId: string;
      actorId?: string | null;
      fieldMap: ImportFieldMap;
    }
  ) {
    void opts.companyId;
    void opts.actorId;
    const parsed = parseCsv(csvText);
    if (parsed.errors.length && !parsed.rows.length) {
      return {
        success: 0,
        failed: 0,
        errors: parsed.errors.map((e, i) => ({ row: i + 1, errors: [e] })),
        createdIds: [] as string[],
      };
    }
    const { valid, invalid } = validateImportRows(parsed.rows, opts.fieldMap);
    const createdIds: string[] = [];
    const runtimeErrors: Array<{ row: number; errors: string[] }> = invalid.map(
      (i) => ({ row: i.row, errors: i.errors })
    );
    for (let i = 0; i < valid.length; i++) {
      try {
        const row = await create(table, valid[i]);
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

  async function audit(_input: Record<string, unknown>) {
    void _input;
  }

  return {
    list,
    create,
    update,
    softDelete,
    restore,
    duplicate,
    bulkStatus,
    nextNumber,
    importCsv,
    audit,
  };
}
