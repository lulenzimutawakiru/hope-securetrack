/**
 * Browser CRUD client for the generic /api/v2/crud/[entity] surface.
 *
 * Thin wrappers over the hardened server route: tenant/company are always
 * derived from the authenticated session server-side, identity/lifecycle
 * fields are stripped, and every mutation is permission-checked and audited.
 * Pages must use these helpers instead of writing directly through the
 * browser Supabase client.
 */

import { apiDelete, apiPost, apiPut, type ApiResult } from "@/lib/api-client";

export type CrudWriteResult<T = Record<string, unknown>> = ApiResult<T>;

function crudPath(entity: string): string {
  return `/api/v2/crud/${entity}`;
}

/** Create a row through the generic CRUD API. */
export function crudCreate<T = Record<string, unknown>>(
  entity: string,
  body: Record<string, unknown>
): Promise<CrudWriteResult<T>> {
  return apiPost<T>(crudPath(entity), body);
}

/** Update a row by id through the generic CRUD API. */
export function crudUpdate<T = Record<string, unknown>>(
  entity: string,
  id: string,
  body: Record<string, unknown>
): Promise<CrudWriteResult<T>> {
  return apiPut<T>(`${crudPath(entity)}?id=${encodeURIComponent(id)}`, body);
}

/** Soft- or hard-delete a row by id (entity lifecycle decides). */
export function crudDelete<T = { id: string; deleted: boolean; soft: boolean }>(
  entity: string,
  id: string
): Promise<CrudWriteResult<T>> {
  return apiDelete<T>(crudPath(entity), { id });
}

/** Restore a soft-deleted / archived row. */
export function crudRestore<T = Record<string, unknown>>(
  entity: string,
  id: string
): Promise<CrudWriteResult<T>> {
  return apiDelete<T>(crudPath(entity), { id, restore: 1 });
}

/** Archive a row (requires the entity to support archiving). */
export function crudArchive<T = Record<string, unknown>>(
  entity: string,
  id: string
): Promise<CrudWriteResult<T>> {
  return apiDelete<T>(crudPath(entity), { id, archive: 1 });
}

/**
 * List helper for EntityPages (prefer useEntityList in React).
 * Server derives tenant/company from the session.
 */
export async function crudList<T = Record<string, unknown>>(
  entity: string,
  params: {
    page?: number;
    pageSize?: number;
    search?: string;
    sort?: string;
    order?: "asc" | "desc";
    filters?: Record<string, unknown>;
    includeDeleted?: boolean;
  } = {}
): Promise<
  CrudWriteResult<{ data: T[]; total: number; page: number; pageSize: number }>
> {
  const { apiGet } = await import("@/lib/api-client");
  const q = new URLSearchParams();
  if (params.page) q.set("page", String(params.page));
  if (params.pageSize) q.set("pageSize", String(params.pageSize));
  if (params.search) q.set("search", params.search);
  if (params.sort) q.set("sort", params.sort);
  if (params.order) q.set("order", params.order);
  if (params.includeDeleted) q.set("includeDeleted", "1");
  if (params.filters) q.set("filters", JSON.stringify(params.filters));
  const qs = q.toString();
  return apiGet(`${crudPath(entity)}${qs ? `?${qs}` : ""}`);
}

/** Exact total for an entity (+ optional eq/in/range filters) without loading rows. */
export async function crudCount(
  entity: string,
  filters?: Record<string, unknown>
): Promise<number> {
  const res = await crudList(entity, {
    page: 1,
    pageSize: 1,
    filters,
  });
  if (!res.ok) throw new Error(res.error);
  return res.data.total ?? 0;
}

/** First matching row by id, or null when not found. */
export async function crudGetOne<T = Record<string, unknown>>(
  entity: string,
  id: string
): Promise<T | null> {
  const { apiGet } = await import("@/lib/api-client");
  const res = await apiGet<T>(
    `${crudPath(entity)}?id=${encodeURIComponent(id)}`
  );
  if (!res.ok) {
    if (String(res.error || "").toLowerCase().includes("not found")) return null;
    throw new Error(res.error);
  }
  return res.data;
}
