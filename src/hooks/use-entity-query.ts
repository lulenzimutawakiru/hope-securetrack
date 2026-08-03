"use client";

import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet } from "@/lib/api-client";
import {
  crudArchive,
  crudCreate,
  crudDelete,
  crudRestore,
  crudUpdate,
  type CrudWriteResult,
} from "@/lib/api/crud-client";
import { entityKeys } from "@/lib/api/query-keys";

export interface EntityListParams {
  page?: number;
  pageSize?: number;
  sort?: string;
  order?: "asc" | "desc";
  search?: string;
  select?: string;
  includeDeleted?: boolean;
  filters?: Record<string, unknown> | string;
}

export interface EntityListResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

/** Serialize list params into the /api/v2/crud query string. */
export function entityListQueryString(params: EntityListParams): string {
  const q = new URLSearchParams();
  if (params.page && params.page > 1) q.set("page", String(params.page));
  if (params.pageSize) q.set("pageSize", String(params.pageSize));
  if (params.sort) q.set("sort", params.sort);
  if (params.order) q.set("order", params.order);
  if (params.search) q.set("search", params.search);
  if (params.select) q.set("select", params.select);
  if (params.includeDeleted) q.set("includeDeleted", "1");
  if (params.filters) {
    q.set(
      "filters",
      typeof params.filters === "string"
        ? params.filters
        : JSON.stringify(params.filters)
    );
  }
  const s = q.toString();
  return s ? `?${s}` : "";
}

/**
 * Read a paginated list through the hardened CRUD API. Every request is
 * authenticated, permission-checked (entity view permission) and scoped to the
 * session-derived tenant/company server-side - never client-supplied IDs.
 */
export function useEntityList<T = Record<string, unknown>>(
  entity: string,
  params: EntityListParams = {},
  options: { enabled?: boolean } = {}
) {
  const { enabled = true } = options;
  return useQuery({
    queryKey: entityKeys.list(entity, params as Record<string, unknown>),
    enabled,
    queryFn: async () => {
      const path = `/api/v2/crud/${encodeURIComponent(entity)}${entityListQueryString(
        params
      )}`;
      const res = await apiGet<EntityListResult<T>>(path);
      if (!res.ok) throw new Error(res.error);
      return res.data;
    },
  });
}

export interface CrudMutations<T = Record<string, unknown>> {
  /** Create a row; returns the server ApiResult. Invalidates the entity cache on success. */
  create: (body: Record<string, unknown>) => Promise<CrudWriteResult<T>>;
  /** Update a row by id; invalidates the entity cache on success. */
  update: (
    id: string,
    body: Record<string, unknown>
  ) => Promise<CrudWriteResult<T>>;
  /** Soft- or hard-delete a row (entity lifecycle decides). */
  remove: (id: string) => Promise<CrudWriteResult>;
  /** Restore a soft-deleted / archived row. */
  restore: (id: string) => Promise<CrudWriteResult<T>>;
  /** Archive a row (requires the entity to support archiving). */
  archive: (id: string) => Promise<CrudWriteResult<T>>;
  /** True while any mutation is in flight. */
  isMutating: boolean;
  /** Last mutation error message, if any. */
  error: string | null;
}

/**
 * CRUD mutations that invalidate the entity's cached lists on success.
 * Writes continue through the hardened /api/v2/crud surface (server derives
 * tenant/company; identity + lifecycle fields are stripped server-side).
 */
export function useCrudMutation<T = Record<string, unknown>>(
  entity: string
): CrudMutations<T> {
  const queryClient = useQueryClient();
  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: entityKeys.entity(entity) });

  const create = useMutation({
    mutationFn: (body: Record<string, unknown>) => crudCreate<T>(entity, body),
    onSuccess: (res) => {
      if (res.ok) invalidate();
    },
  });

  const update = useMutation({
    mutationFn: ({
      id,
      body,
    }: {
      id: string;
      body: Record<string, unknown>;
    }) => crudUpdate<T>(entity, id, body),
    onSuccess: (res) => {
      if (res.ok) invalidate();
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => crudDelete(entity, id),
    onSuccess: (res) => {
      if (res.ok) invalidate();
    },
  });

  const restore = useMutation({
    mutationFn: (id: string) => crudRestore<T>(entity, id),
    onSuccess: (res) => {
      if (res.ok) invalidate();
    },
  });

  const archive = useMutation({
    mutationFn: (id: string) => crudArchive<T>(entity, id),
    onSuccess: (res) => {
      if (res.ok) invalidate();
    },
  });

  const error =
    create.error?.message ||
    update.error?.message ||
    remove.error?.message ||
    restore.error?.message ||
    archive.error?.message ||
    null;

  const isMutating =
    create.isPending ||
    update.isPending ||
    remove.isPending ||
    restore.isPending ||
    archive.isPending;

  // Mutation objects keep stable identities across renders, so the memoized
  // handle keeps page-level useCallback/useMemo dependencies stable.
  return useMemo(
    () => ({
      create: (body: Record<string, unknown>) => create.mutateAsync(body),
      update: (id: string, body: Record<string, unknown>) =>
        update.mutateAsync({ id, body }),
      remove: (id: string) => remove.mutateAsync(id),
      restore: (id: string) => restore.mutateAsync(id),
      archive: (id: string) => archive.mutateAsync(id),
      isMutating,
      error,
    }),
    [create, update, remove, restore, archive, isMutating, error]
  );
}
