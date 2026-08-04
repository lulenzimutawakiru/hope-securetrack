/**
 * Thin helpers for domain services that must never touch the browser Supabase client.
 * All I/O goes through /api/v2/crud (session-scoped, permissioned, audited).
 */

import {
  crudCount,
  crudCreate,
  crudDelete,
  crudGetOne,
  crudList,
  crudRestore,
  crudUpdate,
} from "@/lib/api/crud-client";

export async function mustCreate<T = any>(
  entity: string,
  body: Record<string, unknown>
): Promise<T> {
  const res = await crudCreate<T>(entity, body);
  if (!res.ok) throw new Error(res.error);
  return res.data;
}

export async function mustUpdate<T = any>(
  entity: string,
  id: string,
  body: Record<string, unknown>
): Promise<T> {
  const res = await crudUpdate<T>(entity, id, body);
  if (!res.ok) throw new Error(res.error);
  return res.data;
}

export async function mustList<T = any>(
  entity: string,
  opts?: {
    pageSize?: number;
    page?: number;
    sort?: string;
    order?: "asc" | "desc";
    filters?: Record<string, unknown>;
    search?: string;
    includeDeleted?: boolean;
  }
): Promise<T[]> {
  const res = await crudList<T>(entity, {
    page: opts?.page ?? 1,
    pageSize: opts?.pageSize ?? 200,
    sort: opts?.sort,
    order: opts?.order,
    filters: opts?.filters,
    search: opts?.search,
    includeDeleted: opts?.includeDeleted,
  });
  if (!res.ok) throw new Error(res.error);
  return res.data.data;
}

export async function mustGet<T = any>(
  entity: string,
  id: string
): Promise<T> {
  const row = await crudGetOne<T>(entity, id);
  if (!row) throw new Error(`${entity} not found`);
  return row;
}

export async function mustDelete(entity: string, id: string): Promise<void> {
  const res = await crudDelete(entity, id);
  if (!res.ok) throw new Error(res.error);
}

export async function mustRestore(entity: string, id: string): Promise<void> {
  const res = await crudRestore(entity, id);
  if (!res.ok) throw new Error(res.error);
}

export { crudCount, crudGetOne };

/** Update every row matching filters (bounded). Use only when no bulk API exists. */
export async function updateAllMatching(
  entity: string,
  filters: Record<string, unknown>,
  patch: Record<string, unknown>,
  max = 500
): Promise<number> {
  const rows = await mustList<Record<string, unknown>>(entity, {
    pageSize: max,
    filters,
  });
  let n = 0;
  for (const row of rows) {
    if (!row.id) continue;
    await mustUpdate(entity, String(row.id), patch);
    n += 1;
  }
  return n;
}
