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
