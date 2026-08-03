"use client";

import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api-client";
import { entityKeys } from "@/lib/api/query-keys";
import {
  entityListQueryString,
  type EntityListParams,
  type EntityListResult,
} from "@/hooks/use-entity-query";

export interface EntityAllParams extends EntityListParams {
  /** Hard cap on total rows fetched across pages (default 500). */
  max?: number;
}

/**
 * Fetch every row of an entity through the hardened CRUD API by walking
 * server-paginated pages (pageSize is capped at 100 by the engine). Preserves
 * the legacy "load up to N rows into the client" pattern while keeping reads
 * authenticated, permission-checked and tenant-scoped server-side.
 */
export async function fetchAllPages<T = Record<string, unknown>>(
  entity: string,
  params: EntityAllParams = {}
): Promise<T[]> {
  const max = Math.max(1, params.max ?? 500);
  const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 100));
  const pageCount = Math.ceil(max / pageSize);
  const rows: T[] = [];
  for (let page = 1; page <= pageCount; page++) {
    const path = `/api/v2/crud/${encodeURIComponent(entity)}${entityListQueryString({
      ...params,
      page,
      pageSize,
    })}`;
    const res = await apiGet<EntityListResult<T>>(path);
    if (!res.ok) throw new Error(res.error);
    rows.push(...res.data.data);
    if (res.data.data.length < pageSize) break;
  }
  return rows;
}

/**
 * Read a full (bounded) entity list through the CRUD API. Cached under the
 * entity key so useCrudMutation invalidations refresh it after writes.
 */
export function useEntityAll<T = Record<string, unknown>>(
  entity: string,
  params: EntityAllParams = {},
  options: { enabled?: boolean } = {}
) {
  const { enabled = true } = options;
  return useQuery({
    queryKey: entityKeys.list(entity, { ...params, __all: true }),
    enabled,
    queryFn: () => fetchAllPages<T>(entity, params),
  });
}
