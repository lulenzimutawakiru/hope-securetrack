/**
 * CRUD v2 registry contract (pure).
 *
 * Every entity exposed through /api/v2/crud/[entity] must satisfy the
 * isolation + permission contract the CRUD engine relies on. These are
 * static guarantees: they run with no database and no credentials.
 */
import { describe, it, expect } from "vitest";
import {
  getRegisteredEntities,
  permissionForAction,
  type EntityDefinition,
  type EntityModule,
} from "@/lib/metadata/entity-registry";

/** Hand-written set of every allowed module (mirrors the EntityModule union). */
const ALLOWED_MODULES: readonly EntityModule[] = [
  "settings",
  "hr",
  "attendance",
  "payroll",
  "finance",
  "inventory",
  "procurement",
  "crm",
  "sales",
  "sd",
  "mes",
  "fleet",
  "ppm",
  "ta",
  "dispatch",
  "print",
  "notifications",
  "crud",
  "wfm",
  "assets",
  "billing",
  "brand",
  "ast",
  "bi",
  "dsp",
  "eal",
  "ec",
  "fraud",
  "hc",
  "iam",
  "intg",
  "pkg",
  "scm",
  "wid",
];

const SNAKE_CASE = /^[a-z][a-z0-9_]*$/;
const entities: EntityDefinition[] = getRegisteredEntities();

describe("entity registry contract", () => {
  it("registers the expected entity set", () => {
    expect(entities.length).toBeGreaterThanOrEqual(58);
  });

  it("keeps every entity name, table and module in canonical form", () => {
    for (const def of entities) {
      expect(def.entity, `${def.entity}: entity name`).toMatch(SNAKE_CASE);
      expect(def.table, `${def.entity}: table`).toMatch(SNAKE_CASE);
      expect(def.table, `${def.entity}: table`).not.toBe("");
      expect(ALLOWED_MODULES, `${def.entity}: module`).toContain(def.module);
      expect(def.primaryKey, `${def.entity}: primaryKey`).toBe("id");
    }
  });

  it("never registers two entities against the same table", () => {
    const seen = new Map<string, string>();
    for (const def of entities) {
      const prev = seen.get(def.table);
      expect(prev, `${def.table} claimed by ${prev ?? "?"} and ${def.entity}`).toBeUndefined();
      seen.set(def.table, def.entity);
    }
  });

  it("marks every entity as tenant-scoped (hard isolation)", () => {
    for (const def of entities) {
      expect(def.tenantScoped, `${def.entity}: tenantScoped`).toBe(true);
    }
  });

  it("provides non-empty permission slugs for every action", () => {
    for (const def of entities) {
      for (const field of [
        "viewPermission",
        "createPermission",
        "updatePermission",
        "deletePermission",
      ] as const) {
        expect(
          def[field],
          `${def.entity}: ${field}`
        ).toBeTruthy();
      }
    }
  });

  it("declares searchable columns for the ?search= surface", () => {
    for (const def of entities) {
      expect(Array.isArray(def.searchable), `${def.entity}: searchable`).toBe(true);
    }
  });

  it("always resolves a default sort column", () => {
    for (const def of entities) {
      expect(Array.isArray(def.sortable), `${def.entity}: sortable`).toBe(true);
      expect(def.sortable!.length, `${def.entity}: sortable non-empty`).toBeGreaterThan(0);
    }
  });

  it("keeps soft delete and archive declarations consistent", () => {
    for (const def of entities) {
      if (def.softDelete) {
        expect(def.deletedColumn, `${def.entity}: deletedColumn`).toBeTruthy();
      }
      if (def.archivedAt) {
        expect(def.archiveTimestampColumn ?? "archived_at", `${def.entity}: archive ts`).toBeTruthy();
      }
    }
  });

  it("maps CRUD actions to the correct permission slug", () => {
    for (const def of entities) {
      expect(permissionForAction(def, "view")).toBe(def.viewPermission);
      expect(permissionForAction(def, "export")).toBe(def.viewPermission);
      expect(permissionForAction(def, "create")).toBe(def.createPermission);
      expect(permissionForAction(def, "import")).toBe(def.createPermission);
      expect(permissionForAction(def, "update")).toBe(def.updatePermission);
      expect(permissionForAction(def, "delete")).toBe(def.deletePermission);
      expect(permissionForAction(def, "restore")).toBe(def.deletePermission);
      expect(permissionForAction(def, "archive")).toBe(def.deletePermission);
      expect(permissionForAction(def, "bulk")).toBe(def.deletePermission);
    }
  });

  it("covers every entity-backed module with at least one registered entity", () => {
    const covered = new Set(entities.map((d) => d.module));
    // "crud" is the API route module, not an entity module - no entity uses it.
    const entityModules = ALLOWED_MODULES.filter((mod) => mod !== "crud");
    for (const mod of entityModules) {
      expect(covered.has(mod), `module ${mod} has entities`).toBe(true);
    }
  });
});
