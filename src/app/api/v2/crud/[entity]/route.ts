/**
 * Generic CRUD API: /api/v2/crud/[entity]
 *
 * AuthN/AuthZ: every request is authenticated via createApiHandler and the
 * per-entity permission is enforced inside the engine (view/export/create/
 * import/update/delete/restore/archive/bulk map to registry permission slugs).
 * Tenant/company are always derived from the session - client-supplied
 * identity fields are stripped/rejected before they reach the engine.
 *
 * Query surface:
 *   GET  /api/v2/crud/{entity}?page=1&pageSize=25&sort=name&order=asc
 *        &search=term&status=active&includeDeleted=1
 *   GET  /api/v2/crud/{entity}?id=<uuid>                (single record)
 *   GET  /api/v2/crud/{entity}?export=csv|json          (export, view perm)
 *   POST /api/v2/crud/{entity}                          (create, JSON body)
 *   PUT  /api/v2/crud/{entity}?id=<uuid>                (update, JSON body)
 *   DELETE /api/v2/crud/{entity}?id=<uuid>              (soft or hard delete)
 *   DELETE /api/v2/crud/{entity}?restore=1&id=<uuid>    (restore)
 *   DELETE /api/v2/crud/{entity}?archive=1&id=<uuid>    (archive)
 *   DELETE /api/v2/crud/{entity}?bulk=1&ids=a,b,c[&restore=1|archive=1]
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, apiOk, createApiHandler } from "@/lib/api/handler";
import type { AuthedContext } from "@/lib/security/api-auth";
import { getEntityDefinition } from "@/lib/metadata/entity-registry";
import {
  csvStringify,
  EngineError,
  type CrudScope,
  type ListOptions,
} from "@/lib/crud/crud-engine";
import * as engine from "@/lib/crud/crud-engine";
import { createClient } from "@/lib/supabase/server";

const RESERVED_PARAMS = new Set([
  "id",
  "page",
  "pageSize",
  "sort",
  "order",
  "search",
  "select",
  "includeDeleted",
  "export",
  "bulk",
  "ids",
  "restore",
  "archive",
  "filters",
]);

const BODY_SCHEMA = z.record(z.unknown());

/** Entity name is the last path segment (route is /api/v2/crud/[entity]). */
function entityFromPath(pathname: string): string {
  const segments = pathname.split("/").filter(Boolean);
  const last = segments[segments.length - 1] ?? "";
  try {
    return decodeURIComponent(last);
  } catch {
    return last;
  }
}

function toCrudScope(ctx: AuthedContext): CrudScope {
  return {
    userId: ctx.user.id,
    companyId: ctx.companyId,
    tenantId: ctx.tenantId,
    isElevated: ctx.isElevated,
    isPlatformAdmin: ctx.isPlatformAdmin,
    permissions: ctx.permissions,
  };
}

function listOptions(searchParams: URLSearchParams): ListOptions {
  const opts: ListOptions = {};
  const page = Number(searchParams.get("page"));
  if (Number.isFinite(page) && page > 0) opts.page = page;
  const pageSize = Number(searchParams.get("pageSize"));
  if (Number.isFinite(pageSize) && pageSize > 0) opts.pageSize = pageSize;
  const sort = searchParams.get("sort");
  if (sort) opts.sort = sort;
  const order = searchParams.get("order");
  if (order === "asc" || order === "desc") opts.order = order;
  const search = searchParams.get("search");
  if (search) opts.search = search;
  const select = searchParams.get("select");
  if (select) opts.select = select;
  const includeDeleted = searchParams.get("includeDeleted");
  if (includeDeleted === "1" || includeDeleted === "true") {
    opts.includeDeleted = true;
  }
  const filters: Record<string, unknown> = {};
  const explicit = searchParams.get("filters");
  if (explicit) {
    try {
      const parsed = JSON.parse(explicit) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        Object.assign(filters, parsed);
      }
    } catch {
      /* malformed filters JSON ignored */
    }
  }
  for (const [key, value] of searchParams.entries()) {
    if (RESERVED_PARAMS.has(key)) continue;
    filters[key] = value;
  }
  if (Object.keys(filters).length > 0) opts.filters = filters;
  return opts;
}

function mapEngineError(e: unknown): NextResponse {
  if (e instanceof EngineError) {
    if (e.code === "UNKNOWN_ENTITY" || e.code === "NOT_FOUND") {
      return apiError("NOT_FOUND", e.message, 404);
    }
    if (
      e.code === "MISSING_PERMISSION" ||
      e.code === "FORBIDDEN" ||
      e.code === "CROSS_TENANT" ||
      e.code === "CROSS_COMPANY"
    ) {
      return apiError("FORBIDDEN", e.message, 403);
    }
    if (e.code === "VALIDATION") {
      return apiError("VALIDATION", e.message, 400);
    }
    return apiError("INTERNAL", e.message, 500);
  }
  return apiError(
    "INTERNAL",
    e instanceof Error ? e.message : "Internal error",
    500
  );
}

export const GET = createApiHandler(
  {
    auth: true,
    allowPlatformAdmin: true,
    requireMfa: "privileged",
    rateLimit: { limit: 120, windowMs: 60_000 },
    module: "crud",
  },
  async ({ req, ctx }) => {
    if (!ctx) return apiError("UNAUTHORIZED", "Sign in required", 401);
    const entity = entityFromPath(req.nextUrl.pathname);
    const def = getEntityDefinition(entity);
    if (!def) return apiError("NOT_FOUND", `Unknown entity: ${entity}`, 404);
    const scope = toCrudScope(ctx);
    const sb = await createClient();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    try {
      if (id) {
        const row = await engine.getEntity(scope, entity, id, { sb });
        return apiOk(row);
      }
      const exportType = searchParams.get("export");
      if (exportType === "csv" || exportType === "json") {
        const { rows, total } = await engine.exportEntities(
          scope,
          entity,
          listOptions(searchParams),
          { sb }
        );
        if (exportType === "csv") {
          const csv = csvStringify(rows as Record<string, unknown>[]);
          return new NextResponse(csv, {
            status: 200,
            headers: {
              "Content-Type": "text/csv; charset=utf-8",
              "Content-Disposition": `attachment; filename="${entity}.csv"`,
            },
          });
        }
        const res = apiOk({ data: rows, count: total });
        res.headers.set("x-total-count", String(total));
        return res;
      }
      const { data, total, page, pageSize } = await engine.listEntities(
        scope,
        entity,
        listOptions(searchParams),
        { sb }
      );
      const res = apiOk({ data, total, page, pageSize });
      res.headers.set("x-total-count", String(total));
      return res;
    } catch (e) {
      return mapEngineError(e);
    }
  }
);

export const POST = createApiHandler(
  {
    auth: true,
    allowPlatformAdmin: true,
    requireMfa: "privileged",
    idempotent: true,
    rateLimit: { limit: 60, windowMs: 60_000 },
    module: "crud",
    bodySchema: BODY_SCHEMA,
  },
  async ({ req, ctx, body }) => {
    if (!ctx) return apiError("UNAUTHORIZED", "Sign in required", 401);
    const entity = entityFromPath(req.nextUrl.pathname);
    const def = getEntityDefinition(entity);
    if (!def) return apiError("NOT_FOUND", `Unknown entity: ${entity}`, 404);
    const scope = toCrudScope(ctx);
    try {
      const row = await engine.createEntity(
        scope,
        entity,
        (body ?? {}) as Record<string, unknown>,
        { sb: await createClient() }
      );
      return apiOk(row, { status: 201 });
    } catch (e) {
      return mapEngineError(e);
    }
  }
);

export const PUT = createApiHandler(
  {
    auth: true,
    allowPlatformAdmin: true,
    requireMfa: "privileged",
    idempotent: true,
    rateLimit: { limit: 60, windowMs: 60_000 },
    module: "crud",
    bodySchema: BODY_SCHEMA,
  },
  async ({ req, ctx, body }) => {
    if (!ctx) return apiError("UNAUTHORIZED", "Sign in required", 401);
    const entity = entityFromPath(req.nextUrl.pathname);
    const def = getEntityDefinition(entity);
    if (!def) return apiError("NOT_FOUND", `Unknown entity: ${entity}`, 404);
    const id = new URL(req.url).searchParams.get("id");
    if (!id) return apiError("VALIDATION", "Missing id query parameter", 400);
    const scope = toCrudScope(ctx);
    try {
      const row = await engine.updateEntity(
        scope,
        entity,
        id,
        (body ?? {}) as Record<string, unknown>,
        { sb: await createClient() }
      );
      return apiOk(row);
    } catch (e) {
      return mapEngineError(e);
    }
  }
);

export const DELETE = createApiHandler(
  {
    auth: true,
    allowPlatformAdmin: true,
    requireMfa: "privileged",
    rateLimit: { limit: 60, windowMs: 60_000 },
    module: "crud",
  },
  async ({ req, ctx }) => {
    if (!ctx) return apiError("UNAUTHORIZED", "Sign in required", 401);
    const entity = entityFromPath(req.nextUrl.pathname);
    const def = getEntityDefinition(entity);
    if (!def) return apiError("NOT_FOUND", `Unknown entity: ${entity}`, 404);
    const scope = toCrudScope(ctx);
    const sb = await createClient();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    try {
      if (searchParams.get("bulk") === "1") {
        const idsParam = searchParams.get("ids");
        if (!idsParam) {
          return apiError("VALIDATION", "Missing ids for bulk operation", 400);
        }
        const ids = idsParam.split(",").map((s) => s.trim()).filter(Boolean);
        const action =
          searchParams.get("restore") === "1"
            ? "restore"
            : searchParams.get("archive") === "1"
              ? "archive"
              : "delete";
        const result = await engine.bulkOperation(scope, entity, action, ids, {
          sb,
        });
        return apiOk(result);
      }
      if (searchParams.get("restore") === "1") {
        if (!id) return apiError("VALIDATION", "Missing id query parameter", 400);
        const row = await engine.restoreEntity(scope, entity, id, { sb });
        return apiOk(row);
      }
      if (searchParams.get("archive") === "1") {
        if (!id) return apiError("VALIDATION", "Missing id query parameter", 400);
        const row = await engine.archiveEntity(scope, entity, id, { sb });
        return apiOk(row);
      }
      if (!id) return apiError("VALIDATION", "Missing id query parameter", 400);
      const result = await engine.deleteEntity(scope, entity, id, { sb });
      return apiOk(result);
    } catch (e) {
      return mapEngineError(e);
    }
  }
);
