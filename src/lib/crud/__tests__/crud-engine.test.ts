/**
 * CRUD engine unit tests (pure, no live DB).
 * Exercises tenant scoping, permission enforcement, lifecycle columns,
 * blacklist stripping, audit writes, and CSV export.
 */
import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  archiveEntity,
  bulkOperation,
  createEntity,
  csvStringify,
  deleteEntity,
  exportEntities,
  getEntity,
  importEntities,
  listEntities,
  restoreEntity,
  updateEntity,
  type CrudScope,
} from "@/lib/crud/crud-engine";

const USER = "user-1";
const COMPANY = "company-aaa";
const TENANT = "tenant-aaa";

const scope: CrudScope = {
  userId: USER,
  companyId: COMPANY,
  tenantId: TENANT,
  isPlatformAdmin: false,
  permissions: [
    "hr.view",
    "hr.manage",
    "hr.self",
    "inventory.view",
    "inventory.manage",
    "crm.view",
    "crm.manage",
    "crm.leads",
    "notifications.view",
    "notifications.send",
    "notifications.manage",
    "settings.view",
    "settings.manage",
  ],
};

type Call = { method: string; args: unknown[]; table?: string };

/** Fluent thenable fake Supabase client that records every call. */
function makeFake(opts: {
  data?: unknown;
  count?: number;
  error?: { message: string } | null;
  onInsert?: (table: string, payload: unknown) => unknown;
  rowFor?: (table: string, id: string) => unknown;
} = {}) {
  const calls: Call[] = [];
  let currentTable: string | undefined;
  const builder = {
    from(table: string) {
      currentTable = table;
      calls.push({ method: "from", table, args: [table] });
      return builder;
    },
    select(...args: unknown[]) {
      calls.push({ method: "select", args, table: currentTable });
      return builder;
    },
    eq(...args: unknown[]) {
      calls.push({ method: "eq", args, table: currentTable });
      return builder;
    },
    gte(...args: unknown[]) {
      calls.push({ method: "gte", args, table: currentTable });
      return builder;
    },
    lte(...args: unknown[]) {
      calls.push({ method: "lte", args, table: currentTable });
      return builder;
    },
    gt(...args: unknown[]) {
      calls.push({ method: "gt", args, table: currentTable });
      return builder;
    },
    lt(...args: unknown[]) {
      calls.push({ method: "lt", args, table: currentTable });
      return builder;
    },
    neq(...args: unknown[]) {
      calls.push({ method: "neq", args, table: currentTable });
      return builder;
    },
    in(...args: unknown[]) {
      calls.push({ method: "in", args, table: currentTable });
      return builder;
    },
    is(...args: unknown[]) {
      calls.push({ method: "is", args, table: currentTable });
      return builder;
    },
    ilike(...args: unknown[]) {
      calls.push({ method: "ilike", args, table: currentTable });
      return builder;
    },
    or(...args: unknown[]) {
      calls.push({ method: "or", args, table: currentTable });
      return builder;
    },
    order(...args: unknown[]) {
      calls.push({ method: "order", args, table: currentTable });
      return builder;
    },
    range(...args: unknown[]) {
      calls.push({ method: "range", args, table: currentTable });
      return builder;
    },
    limit(...args: unknown[]) {
      calls.push({ method: "limit", args, table: currentTable });
      return builder;
    },
    maybeSingle() {
      calls.push({ method: "maybeSingle", args: [], table: currentTable });
      return builder;
    },
    single() {
      calls.push({ method: "single", args: [], table: currentTable });
      return builder;
    },
    head() {
      calls.push({ method: "head", args: [], table: currentTable });
      return builder;
    },
    insert(payload: unknown) {
      calls.push({ method: "insert", args: [payload], table: currentTable });
      return builder;
    },
    update(payload: unknown) {
      calls.push({ method: "update", args: [payload], table: currentTable });
      return builder;
    },
    delete() {
      calls.push({ method: "delete", args: [], table: currentTable });
      return builder;
    },
    then(
      resolve: (v: { data: unknown; error: unknown; count?: number }) => void,
      reject: (e: unknown) => void
    ) {
      if (opts.error) {
        return Promise.resolve({ data: null, error: opts.error, count: opts.count }).then(
          resolve,
          reject
        );
      }
      // Resolve from the current query chain only (segment since the last from()).
      // A shared call log would otherwise let a prior audit insert hijack fetches.
      const fromIdx = calls.map((c) => c.method).lastIndexOf("from");
      const segment = fromIdx >= 0 ? calls.slice(fromIdx) : calls;
      const segInsert = segment.find((c) => c.method === "insert");
      const segUpdate = segment.find((c) => c.method === "update");
      const segDelete = segment.find((c) => c.method === "delete");
      const segIdEq = [...segment].reverse().find((c) => c.method === "eq" && c.args[0] === "id");
      const segId = segIdEq ? String(segIdEq.args[1]) : undefined;
      let data: unknown = null;
      if (segInsert) {
        data = opts.onInsert
          ? opts.onInsert(currentTable ?? "", segInsert.args[0])
          : segInsert.args[0];
      } else if (segDelete) {
        data = null;
      } else if (segUpdate) {
        // UPDATE ... SELECT returns the merged row; fire-and-forget updates return nothing.
        const lastCall = segment[segment.length - 1];
        const isUpdateRead = lastCall?.method === "single" || lastCall?.method === "maybeSingle";
        if (isUpdateRead) {
          const base =
            (opts.rowFor && segId ? opts.rowFor(currentTable ?? "", segId) : null) ??
            (opts.data as object | undefined) ??
            {};
          data = { ...base, ...(segUpdate.args[0] as object) };
        }
      } else {
        data =
          opts.rowFor && segId ? opts.rowFor(currentTable ?? "", segId) : (opts.data ?? null);
      }
      return Promise.resolve({ data, error: null, count: opts.count }).then(resolve, reject);
    },
  };
  return { sb: builder as unknown as SupabaseClient, calls };
}

const eqCalls = (calls: Call[], column: string): unknown[] =>
  calls.filter((c) => c.method === "eq" && c.args[0] === column).map((c) => c.args[1]);

describe("crud engine ? tenant scoping", () => {
  it("lists rows scoped by company + tenant with soft-delete filter and pagination", async () => {
    const { sb, calls } = makeFake({ data: [{ id: "e1", company_id: COMPANY, tenant_id: TENANT }], count: 1 });
    const result = await listEntities(scope, "employees", {}, { sb });
    expect(result.data).toHaveLength(1);
    expect(result.total).toBe(1);
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(25);
    expect(eqCalls(calls, "company_id")).toEqual([COMPANY]);
    expect(eqCalls(calls, "tenant_id")).toEqual([TENANT]);
    expect(calls.some((c) => c.method === "is" && c.args[0] === "deleted_at" && c.args[1] === null)).toBe(true);
    expect(calls.some((c) => c.method === "range" && c.args[0] === 0 && c.args[1] === 24)).toBe(true);
    expect(calls.some((c) => c.method === "order" && c.args[0] === "created_at")).toBe(true);
  });

  it("omits the tenant filter when tenantId is null (shared tenant rows)", async () => {
    const { sb, calls } = makeFake({ data: [], count: 0 });
    await listEntities({ ...scope, tenantId: null }, "employees", {}, { sb });
    expect(eqCalls(calls, "company_id")).toEqual([COMPANY]);
    expect(eqCalls(calls, "tenant_id")).toEqual([]);
  });

  it("returns every row for includeDeleted", async () => {
    const { sb, calls } = makeFake({ data: [], count: 0 });
    await listEntities(scope, "employees", { includeDeleted: true }, { sb });
    expect(calls.some((c) => c.method === "is" && c.args[0] === "deleted_at")).toBe(false);
  });

  it("exports with the export permission and a hard limit", async () => {
    const { sb, calls } = makeFake({ data: [], count: 0 });
    const out = await exportEntities(scope, "employees", {}, { sb });
    expect(out.total).toBe(0);
    expect(calls.some((c) => c.method === "limit" && c.args[0] === 10000)).toBe(true);
  });

  it("rejects unknown entities with UNKNOWN_ENTITY / 404", async () => {
    const { sb } = makeFake({});
    await expect(listEntities(scope, "not_a_real_entity", {}, { sb })).rejects.toMatchObject({
      code: "UNKNOWN_ENTITY",
      status: 404,
    });
  });

  it("rejects users without the required permission with MISSING_PERMISSION / 403", async () => {
    const { sb } = makeFake({});
    await expect(
      listEntities({ ...scope, permissions: [] }, "employees", {}, { sb })
    ).rejects.toMatchObject({ code: "MISSING_PERMISSION", status: 403 });
  });

  it("skips the permission check for platform admins", async () => {
    const { sb, calls } = makeFake({ data: [], count: 0 });
    const out = await listEntities(
      { ...scope, permissions: [], isPlatformAdmin: true },
      "employees",
      {},
      { sb }
    );
    expect(out.data).toEqual([]);
    expect(calls.length).toBeGreaterThan(0);
  });

  it("applies gte/lte range filters and in-list filters", async () => {
    const { sb, calls } = makeFake({ data: [], count: 0 });
    await listEntities(
      scope,
      "employees",
      {
        filters: {
          created_at: { gte: "2026-01-01", lte: "2026-12-31" },
          status: ["active", "on_leave"],
        },
      },
      { sb }
    );
    const gte = calls.find((c) => c.method === "gte");
    const lte = calls.find((c) => c.method === "lte");
    const inn = calls.find((c) => c.method === "in");
    expect(gte?.args).toEqual(["created_at", "2026-01-01"]);
    expect(lte?.args).toEqual(["created_at", "2026-12-31"]);
    expect(inn?.args?.[0]).toBe("status");
    expect(inn?.args?.[1]).toEqual(["active", "on_leave"]);
  });

  it("fetches a single row scoped by tenant and company", async () => {
    const { sb, calls } = makeFake({
      data: { id: "e1", company_id: COMPANY, tenant_id: TENANT, first_name: "Ada" },
    });
    const row = await getEntity(scope, "employees", "e1", { sb });
    expect(row.first_name).toBe("Ada");
    expect(eqCalls(calls, "id")).toEqual(["e1"]);
    expect(eqCalls(calls, "company_id")).toEqual([COMPANY]);
    expect(eqCalls(calls, "tenant_id")).toEqual([TENANT]);
  });

  it("rejects a row from another tenant with CROSS_TENANT / 403", async () => {
    const { sb } = makeFake({
      data: { id: "e1", company_id: COMPANY, tenant_id: "tenant-other" },
    });
    await expect(getEntity(scope, "employees", "e1", { sb })).rejects.toMatchObject({
      code: "CROSS_TENANT",
      status: 403,
    });
  });

  it("rejects a row from another company with CROSS_COMPANY / 403", async () => {
    const { sb } = makeFake({
      data: { id: "e1", company_id: "company-other", tenant_id: TENANT },
    });
    await expect(getEntity(scope, "employees", "e1", { sb })).rejects.toMatchObject({
      code: "CROSS_COMPANY",
      status: 403,
    });
  });
});

describe("crud engine ? mutations", () => {
  it("create forces tenant/company, strips client identity fields, sets actor, and audits", async () => {
    const { sb, calls } = makeFake({});
    const row = await createEntity(
      scope,
      "sales_leads",
      {
        company_name: "Acme",
        tenant_id: "tenant-evil",
        company_id: "company-evil",
        created_by: "user-evil",
        created_at: "2020-01-01",
        updated_at: "2020-01-01",
      },
      { sb }
    );
    expect(row.company_id).toBe(COMPANY);
    expect(row.tenant_id).toBe(TENANT);
    expect(row.created_by).toBe(USER);
    expect(row.company_name).toBe("Acme");
    expect(row.created_at).toBeUndefined();
    expect(row.updated_at).toBeUndefined();
    const insert = calls.find((c) => c.method === "insert" && c.table === "sales_leads");
    expect(insert).toBeDefined();
    const payload = insert!.args[0] as Record<string, unknown>;
    expect(payload.company_id).toBe(COMPANY);
    expect(payload.tenant_id).toBe(TENANT);
    expect(payload.created_by).toBe(USER);
    expect(payload).not.toHaveProperty("id");
    expect(payload).not.toHaveProperty("created_at");
    // Immutable audit row written with the session actor
    const audit = calls.find((c) => c.method === "insert" && c.table === "audit_logs");
    expect(audit).toBeDefined();
    const auditPayload = audit!.args[0] as Record<string, unknown>;
    expect(auditPayload.company_id).toBe(COMPANY);
    expect(auditPayload.user_id).toBe(USER);
    expect(auditPayload.action).toBe("sales_leads.create");
  });

  it("maps insert errors to VALIDATION / 400", async () => {
    const { sb } = makeFake({ error: { message: "duplicate key" } });
    await expect(
      createEntity(scope, "sales_leads", { company_name: "Acme" }, { sb })
    ).rejects.toMatchObject({ code: "VALIDATION", status: 400 });
  });

  it("update strips identity fields, sets updated_by/updated_at, audits before/after", async () => {
    const existing = { id: "sl1", company_id: COMPANY, tenant_id: TENANT, company_name: "Acme" };
    const { sb, calls } = makeFake({ data: existing });
    const row = await updateEntity(
      scope,
      "sales_leads",
      "sl1",
      { company_name: "Globex", company_id: "company-evil", tenant_id: "tenant-evil", id: "other" },
      { sb }
    );
    const update = calls.find((c) => c.method === "update" && c.table === "sales_leads");
    expect(update).toBeDefined();
    const payload = update!.args[0] as Record<string, unknown>;
    expect(payload.company_name).toBe("Globex");
    expect(payload).not.toHaveProperty("id");
    expect(payload).not.toHaveProperty("company_id");
    expect(payload).not.toHaveProperty("tenant_id");
    expect(payload.updated_by).toBe(USER);
    expect(typeof payload.updated_at).toBe("string");
    const audit = calls.find((c) => c.method === "insert" && c.table === "audit_logs");
    const auditPayload = audit!.args[0] as Record<string, unknown>;
    expect(auditPayload.action).toBe("sales_leads.update");
    expect(auditPayload.before_state).toEqual(existing);
    expect(row.company_name).toBe("Globex");
  });

  it("soft-deletes soft-delete entities instead of hard deleting", async () => {
    const { sb, calls } = makeFake({
      data: { id: "e1", company_id: COMPANY, tenant_id: TENANT },
    });
    const result = await deleteEntity(scope, "employees", "e1", { sb });
    expect(result).toEqual({ id: "e1", deleted: true, soft: true });
    const update = calls.find((c) => c.method === "update" && c.table === "employees");
    expect(update).toBeDefined();
    const payload = update!.args[0] as Record<string, unknown>;
    expect(typeof payload.deleted_at).toBe("string");
    expect(calls.some((c) => c.method === "delete")).toBe(false);
  });

  it("hard-deletes entities without soft delete", async () => {
    const { sb, calls } = makeFake({
      data: { id: "lr1", company_id: COMPANY, tenant_id: TENANT },
    });
    const result = await deleteEntity(scope, "leave_requests", "lr1", { sb });
    expect(result).toEqual({ id: "lr1", deleted: true, soft: false });
    expect(calls.some((c) => c.method === "delete" && c.table === "leave_requests")).toBe(true);
  });

  it("restore clears deleted_at and archive flags", async () => {
    const { sb, calls } = makeFake({
      data: { id: "c1", company_id: COMPANY, tenant_id: TENANT, deleted_at: "2026-01-01", archived_at: "2026-01-01" },
    });
    const row = await restoreEntity(scope, "customers", "c1", { sb });
    const update = calls.find((c) => c.method === "update" && c.table === "customers");
    const payload = update!.args[0] as Record<string, unknown>;
    expect(payload.deleted_at).toBeNull();
    expect(payload.archived_at).toBeNull();
    expect(row.deleted_at).toBeNull();
    expect(row.archived_at).toBeNull();
  });

  it("archive sets the archive column + timestamp", async () => {
    const { sb, calls } = makeFake({
      data: { id: "n1", company_id: COMPANY, tenant_id: TENANT },
    });
    const row = await archiveEntity(scope, "notifications", "n1", { sb });
    const update = calls.find((c) => c.method === "update" && c.table === "notifications");
    const payload = update!.args[0] as Record<string, unknown>;
    expect(payload.is_archived).toBe(true);
    expect(typeof payload.archived_at).toBe("string");
    expect(row.is_archived).toBe(true);
  });

  it("archive is rejected for entities without archive support", async () => {
    const { sb } = makeFake({});
    await expect(archiveEntity(scope, "leave_requests", "lr1", { sb })).rejects.toMatchObject({
      code: "VALIDATION",
      status: 400,
    });
  });

  it("bulk operation splits success and failure per id", async () => {
    const { sb } = makeFake({
      rowFor: (table, id) =>
        id === "c1" ? { id, company_id: COMPANY, tenant_id: TENANT } : null,
    });
    const result = await bulkOperation(scope, "customers", "delete", ["c1", "c2"], { sb });
    expect(result.action).toBe("delete");
    expect(result.success).toEqual(["c1"]);
    expect(result.failed).toHaveLength(1);
    expect(result.failed[0].id).toBe("c2");
  });

  it("import strips identity fields, forces tenant/company, and enqueues a job", async () => {
    const { sb, calls } = makeFake({
      onInsert: (table) => (table === "customers" ? [{ id: "c1" }, { id: "c2" }] : null),
    });
    const result = await importEntities(
      scope,
      "customers",
      [{ name: "Acme", tenant_id: "evil" }, { name: "Globex" }],
      { sb }
    );
    expect(result.inserted).toBe(2);
    const insert = calls.find((c) => c.method === "insert" && c.table === "customers");
    const payload = insert!.args[0] as Record<string, unknown>[];
    expect(payload).toHaveLength(2);
    expect(payload[0].company_id).toBe(COMPANY);
    expect(payload[0].tenant_id).toBe(TENANT);
    expect(payload[1].tenant_id).toBe(TENANT);
    expect(calls.some((c) => c.method === "from" && c.args[0] === "job_queue")).toBe(true);
  });

  it("import rejects empty arrays with VALIDATION", async () => {
    const { sb } = makeFake({});
    await expect(importEntities(scope, "customers", [], { sb })).rejects.toMatchObject({
      code: "VALIDATION",
      status: 400,
    });
  });
});

describe("crud engine ? csv export", () => {
  it("escapes quotes, commas and newlines (RFC-4180 style)", () => {
    const csv = csvStringify([
      { name: "Ada, Lovelace", note: 'said "hello"', line: "a\nb" },
      { name: "Grace", note: "plain", line: "x" },
    ]);
    expect(csv).toContain('"Ada, Lovelace"');
    expect(csv).toContain('"said ""hello"""');
    expect(csv).toContain('"a\nb"');
    expect(csv.split("\n")[0]).toBe("name,note,line");
  });

  it("returns an empty string for no rows", () => {
    expect(csvStringify([])).toBe("");
  });
});
