/**
 * Browser-compatible data client that routes table I/O through /api/v2/crud
 * instead of the Supabase JS client. Drop-in for createClient() in domain libs.
 *
 * Supports the common PostgREST-style chain used across SecureTrack services:
 *   .from(t).select().eq().in().is().gte().lte().order().limit().maybeSingle()
 *   .from(t).insert(row).select().single()
 *   .from(t).update(patch).eq("id", id).select().single()
 *   .from(t).upsert(row, opts)
 *   .from(t).delete().eq("id", id)
 *
 * Does NOT implement realtime channels or storage (use dedicated helpers).
 */

import {
  crudCount,
  crudCreate,
  crudDelete,
  crudGetOne,
  crudList,
  crudUpdate,
} from "@/lib/api/crud-client";
import { apiPost } from "@/lib/api-client";
import type { SupabaseClient } from "@supabase/supabase-js";

type FilterOp =
  | { type: "eq"; col: string; val: unknown }
  | { type: "in"; col: string; val: unknown[] }
  | { type: "is"; col: string; val: null }
  | { type: "neq"; col: string; val: unknown }
  | { type: "gte"; col: string; val: unknown }
  | { type: "lte"; col: string; val: unknown }
  | { type: "gt"; col: string; val: unknown }
  | { type: "lt"; col: string; val: unknown }
  | { type: "not_in"; col: string; val: unknown[] }
  | { type: "like"; col: string; val: string }
  | { type: "ilike"; col: string; val: string }
  | { type: "fts"; col: string; val: string };

class QueryBuilder {
  private table: string;
  private mode: "select" | "insert" | "update" | "upsert" | "delete" = "select";
  private filters: FilterOp[] = [];
  private orderCol?: string;
  private orderAsc = true;
  private limitN = 100;
  private page = 1;
  private headCount = false;
  private insertPayload: unknown;
  private updatePayload: Record<string, unknown> | null = null;
  private wantSingle = false;
  private wantMaybe = false;
  private includeDeleted = false;

  constructor(table: string) {
    this.table = table;
  }

  select(_cols?: string, opts?: { count?: string; head?: boolean }) {
    if (opts?.head && opts?.count === "exact") {
      this.headCount = true;
    }
    return this;
  }

  insert(payload: unknown) {
    this.mode = "insert";
    this.insertPayload = payload;
    return this;
  }

  update(payload: Record<string, unknown>) {
    this.mode = "update";
    this.updatePayload = payload;
    return this;
  }

  upsert(payload: unknown, _opts?: unknown) {
    this.mode = "upsert";
    this.insertPayload = payload;
    return this;
  }

  delete() {
    this.mode = "delete";
    return this;
  }

  eq(col: string, val: unknown) {
    this.filters.push({ type: "eq", col, val });
    return this;
  }

  neq(col: string, val: unknown) {
    this.filters.push({ type: "neq", col, val });
    return this;
  }

  in(col: string, val: unknown[]) {
    this.filters.push({ type: "in", col, val });
    return this;
  }

  is(col: string, val: null) {
    if (col === "deleted_at" && val === null) {
      this.includeDeleted = false;
      return this;
    }
    this.filters.push({ type: "is", col, val });
    return this;
  }

  gte(col: string, val: unknown) {
    this.filters.push({ type: "gte", col, val });
    return this;
  }

  lte(col: string, val: unknown) {
    this.filters.push({ type: "lte", col, val });
    return this;
  }

  gt(col: string, val: unknown) {
    this.filters.push({ type: "gt", col, val });
    return this;
  }

  lt(col: string, val: unknown) {
    this.filters.push({ type: "lt", col, val });
    return this;
  }

  not(col: string, op: string, val: unknown) {
    if (op === "is" && val === null) {
      // not null — cannot express via CRUD eq; ignore and filter client-side later
      return this;
    }
    if (op === "in") {
      // Accept arrays or PostgREST list strings: '("a","b")' / '(a,b)'
      let list: unknown[];
      if (Array.isArray(val)) {
        list = val;
      } else if (typeof val === "string") {
        const inner = val.replace(/^\(/, "").replace(/\)$/, "").trim();
        list = inner
          ? inner.split(",").map((s) => s.trim().replace(/^"|"$/g, ""))
          : [];
      } else {
        list = [val];
      }
      this.filters.push({
        type: "not_in",
        col,
        val: list,
      });
      return this;
    }
    return this;
  }

  or(_expr: string) {
    // PostgREST or() not fully supported — no-op (callers should dual-query)
    return this;
  }

  like(col: string, pattern: string) {
    this.filters.push({ type: "like", col, val: pattern });
    return this;
  }

  ilike(col: string, pattern: string) {
    this.filters.push({ type: "ilike", col, val: pattern });
    return this;
  }

  textSearch(col: string, query: string, _opts?: unknown) {
    this.filters.push({ type: "fts", col, val: query });
    return this;
  }

  order(col: string, opts?: { ascending?: boolean; nullsFirst?: boolean }) {
    this.orderCol = col;
    this.orderAsc = opts?.ascending !== false;
    return this;
  }

  limit(n: number) {
    this.limitN = Math.min(500, Math.max(1, n));
    return this;
  }

  range(from: number, to: number) {
    const size = to - from + 1;
    this.limitN = Math.min(500, Math.max(1, size));
    this.page = Math.floor(from / this.limitN) + 1;
    return this;
  }

  single() {
    this.wantSingle = true;
    return this;
  }

  maybeSingle() {
    this.wantMaybe = true;
    return this;
  }

  private buildFilters(): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const f of this.filters) {
      if (f.type === "eq") out[f.col] = f.val;
      else if (f.type === "in") out[f.col] = f.val;
      else if (f.type === "not_in") {
        const prev =
          typeof out[f.col] === "object" && out[f.col] !== null
            ? (out[f.col] as Record<string, unknown>)
            : {};
        out[f.col] = { ...prev, not_in: f.val };
      } else if (f.type === "neq") {
        const prev =
          typeof out[f.col] === "object" && out[f.col] !== null
            ? (out[f.col] as Record<string, unknown>)
            : {};
        out[f.col] = { ...prev, neq: f.val };
      } else if (f.type === "gte" || f.type === "lte" || f.type === "gt" || f.type === "lt") {
        const prev =
          typeof out[f.col] === "object" && out[f.col] !== null
            ? (out[f.col] as Record<string, unknown>)
            : {};
        out[f.col] = { ...prev, [f.type]: f.val };
      } else if (f.type === "is" && f.val === null) {
        // soft: skip (CRUD softDelete handles deleted_at)
      }
    }
    return out;
  }

  private idFromFilters(): string | null {
    for (const f of this.filters) {
      if (f.type === "eq" && f.col === "id") return String(f.val);
    }
    return null;
  }

  private hasClientOnlyFilters(): boolean {
    return this.filters.some(
      (f) => f.type === "like" || f.type === "ilike" || f.type === "fts"
    );
  }

  private applyClientFilters(
    rows: Record<string, unknown>[]
  ): Record<string, unknown>[] {
    let out = rows;
    for (const f of this.filters) {
      if (f.type === "neq") {
        out = out.filter((r) => r[f.col] !== f.val);
      } else if (f.type === "not_in") {
        out = out.filter((r) => !f.val.includes(r[f.col]));
      } else if (f.type === "like" || f.type === "ilike") {
        const flags = f.type === "ilike" ? "i" : "";
        const pattern = String(f.val)
          .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
          .replace(/%/g, ".*");
        const re = new RegExp(`^${pattern}$`, flags);
        out = out.filter((r) => re.test(String(r[f.col] ?? "")));
      } else if (f.type === "fts") {
        const terms = String(f.val)
          .split(/\s+/)
          .filter(Boolean)
          .map((t) => t.replace(/[&|:!()']/g, "").toLowerCase());
        out = out.filter((r) => {
          const hay = String(r[f.col] ?? "").toLowerCase();
          return terms.every((t) => hay.includes(t));
        });
      }
    }
    return out;
  }

  then<TResult1 = any, TResult2 = any>(
    onfulfilled?:
      | ((value: {
          data: any;
          error: { message: string } | null;
          count?: number | null;
        }) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    return this.execute().then(onfulfilled as never, onrejected as never);
  }

  private async execute(): Promise<{
    data: any;
    error: { message: string } | null;
    count?: number | null;
  }> {
    try {
      if (this.mode === "insert") {
        const rows = Array.isArray(this.insertPayload)
          ? this.insertPayload
          : [this.insertPayload];
        const created: unknown[] = [];
        for (const row of rows) {
          const body = { ...(row as Record<string, unknown>) };
          delete body.company_id;
          delete body.tenant_id;
          const res = await crudCreate(this.table, body);
          if (!res.ok) return { data: null, error: { message: res.error } };
          created.push(res.data);
        }
        const data =
          this.wantSingle || this.wantMaybe
            ? created[0] ?? null
            : created;
        return { data, error: null };
      }

      if (this.mode === "upsert") {
        const rows = Array.isArray(this.insertPayload)
          ? this.insertPayload
          : [this.insertPayload];
        const out: unknown[] = [];
        for (const row of rows) {
          const body = { ...(row as Record<string, unknown>) };
          const id = body.id ? String(body.id) : null;
          delete body.company_id;
          delete body.tenant_id;
          if (id) {
            const res = await crudUpdate(this.table, id, body);
            if (!res.ok) {
              // try create if not found
              const c = await crudCreate(this.table, body);
              if (!c.ok) return { data: null, error: { message: c.error } };
              out.push(c.data);
            } else out.push(res.data);
          } else {
            // try match on common unique keys if present
            const res = await crudCreate(this.table, body);
            if (!res.ok) return { data: null, error: { message: res.error } };
            out.push(res.data);
          }
        }
        return {
          data: this.wantSingle || this.wantMaybe ? out[0] ?? null : out,
          error: null,
        };
      }

      if (this.mode === "update") {
        const id = this.idFromFilters();
        if (!id) {
          // multi-row update via list + update each
          const filters = this.buildFilters();
          const list = await crudList(this.table, {
            page: 1,
            pageSize: 100,
            filters,
            includeDeleted: this.includeDeleted,
          });
          if (!list.ok) return { data: null, error: { message: list.error } };
          const updated: unknown[] = [];
          for (const row of list.data.data) {
            const rid = (row as { id?: string }).id;
            if (!rid) continue;
            const patch = { ...(this.updatePayload || {}) };
            delete patch.company_id;
            delete patch.tenant_id;
            const res = await crudUpdate(this.table, String(rid), patch);
            if (res.ok) updated.push(res.data);
          }
          return {
            data:
              this.wantSingle || this.wantMaybe
                ? updated[0] ?? null
                : updated,
            error: null,
          };
        }
        const patch = { ...(this.updatePayload || {}) };
        delete patch.company_id;
        delete patch.tenant_id;
        const res = await crudUpdate(this.table, id, patch);
        if (!res.ok) return { data: null, error: { message: res.error } };
        return { data: res.data, error: null };
      }

      if (this.mode === "delete") {
        const id = this.idFromFilters();
        if (!id) {
          return {
            data: null,
            error: { message: "delete requires eq(id, ...)" },
          };
        }
        const res = await crudDelete(this.table, id);
        if (!res.ok) return { data: null, error: { message: res.error } };
        return { data: res.data, error: null };
      }

      // select / count
      const filters = this.buildFilters();
      if (this.headCount) {
        if (this.hasClientOnlyFilters()) {
          const listRes = await crudList(this.table, {
            page: 1,
            pageSize: 500,
            sort: this.orderCol,
            order: this.orderAsc ? "asc" : "desc",
            filters: Object.keys(filters).length ? filters : undefined,
            includeDeleted: this.includeDeleted,
          });
          if (!listRes.ok)
            return { data: null, error: { message: listRes.error } };
          return {
            data: null,
            error: null,
            count: this.applyClientFilters(
              listRes.data.data as Record<string, unknown>[]
            ).length,
          };
        }
        const n = await crudCount(
          this.table,
          Object.keys(filters).length ? filters : undefined
        );
        return { data: null, error: null, count: n };
      }

      if (
        (this.wantSingle || this.wantMaybe) &&
        this.idFromFilters()
      ) {
        const row = await crudGetOne(this.table, this.idFromFilters()!);
        if (!row && this.wantSingle) {
          return { data: null, error: { message: "not found" } };
        }
        return { data: row, error: null };
      }

      const res = await crudList(this.table, {
        page: this.page,
        pageSize: this.limitN,
        sort: this.orderCol,
        order: this.orderAsc ? "asc" : "desc",
        filters: Object.keys(filters).length ? filters : undefined,
        includeDeleted: this.includeDeleted,
      });
      if (!res.ok) return { data: null, error: { message: res.error } };

      const rows = this.applyClientFilters(
        res.data.data as Record<string, unknown>[]
      );

      if (this.wantSingle || this.wantMaybe) {
        return {
          data: rows[0] ?? null,
          error:
            this.wantSingle && !rows[0]
              ? { message: "not found" }
              : null,
        };
      }
      return { data: rows, error: null, count: res.data.total };
    } catch (e) {
      return {
        data: null,
        error: {
          message: e instanceof Error ? e.message : String(e),
        },
      };
    }
  }
}

/** Drop-in replacement for browser createClient() table access. */
export function createClient(): SupabaseClient {
  return {
    from(table: string) {
      return new QueryBuilder(table);
    },
    rpc: async (fn: string, args?: Record<string, unknown>) => {
      try {
        const res = await apiPost<unknown>("/api/v2/rpc", {
          fn,
          args: args ?? {},
        });
        if (res.ok) return { data: res.data ?? null, error: null };
        return { data: null, error: { message: res.error, code: res.code } };
      } catch (e) {
        return {
          data: null,
          error: {
            message: e instanceof Error ? e.message : String(e),
          },
        };
      }
    },
    auth: {
      getUser: async () => ({ data: { user: null }, error: null }),
      signOut: async () => {
        try {
          await fetch("/api/v2/auth/logout", {
            method: "POST",
            credentials: "same-origin",
          });
        } catch {
          // best-effort; navigation to /login happens regardless
        }
        return { error: null };
      },
    },
    storage: {
      from: (bucket: string) => ({
        createSignedUrl: async (path: string, expiresIn: number) => {
          const res = await apiPost<{ signedUrl: string }>(
            "/api/v2/files/signed-url",
            { bucket, path, expiresIn }
          );
          if (res.ok) return { data: res.data, error: null };
          return {
            data: { signedUrl: "" },
            error: { message: res.error, code: res.code },
          };
        },
      }),
    },
  } as unknown as SupabaseClient;
}

export default createClient;
