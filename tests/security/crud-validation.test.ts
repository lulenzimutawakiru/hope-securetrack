/**
 * CRUD payload validation contract (pure).
 *
 * Entities with a schema in src/lib/crud/entity-schemas.ts must:
 *   - reject malformed values for validated columns (400-class issues), and
 *   - never reject unlisted columns (passthrough), preserving page compat.
 */
import { describe, it, expect } from "vitest";
import {
  ENTITY_SCHEMAS,
  validatePayload,
  getSchemaEntities,
} from "@/lib/crud/entity-schemas";
import { getRegisteredEntities } from "@/lib/metadata/entity-registry";

describe("CRUD entity schemas", () => {
  const registered = new Set(getRegisteredEntities().map((e) => e.entity));

  it("only defines schemas for registered entities", () => {
    for (const entity of getSchemaEntities()) {
      expect(registered.has(entity), `${entity} is not registered`).toBe(true);
    }
  });

  it("has schemas for every high-traffic migrated entity", () => {
    for (const entity of [
      "products",
      "customers",
      "crm_contacts",
      "crm_activities",
      "distributors",
      "brand_ui_themes",
      "brand_logos",
      "brand_fonts",
      "brand_guidelines",
      "brand_email_signatures",
      "brand_product_profiles",
    ]) {
      expect(ENTITY_SCHEMAS[entity], `${entity} missing schema`).toBeDefined();
    }
  });

  it("accepts a valid minimal create payload", () => {
    const result = validatePayload("products", {
      name: "Widget",
      sku: "WID-001",
      unit_price: 12.5,
      extra_column_that_pages_send: { nested: true },
    });
    expect(result.ok).toBe(true);
  });

  it("accepts numeric strings for unvalidated numeric columns", () => {
    // Regression guard: pages have historically sent both numbers and
    // numeric strings for money/quantity columns; schemas must not reject.
    const result = validatePayload("products", {
      name: "Widget",
      unit_price: "12.50",
      quantity_on_hand: "100",
    });
    expect(result.ok).toBe(true);
  });

  it("rejects objects where a string column is expected", () => {
    const result = validatePayload("products", { name: { bad: true } });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.join("; ")).toContain("name");
    }
  });

  it("rejects over-long strings for validated text columns", () => {
    const result = validatePayload("brand_ui_themes", {
      theme_name: "x".repeat(101),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.join("; ")).toContain("theme_name");
    }
  });

  it("rejects numbers where a UUID is expected", () => {
    const result = validatePayload("customers", { id: 12345 });
    expect(result.ok).toBe(false);
  });

  it("is a no-op for entities without a schema", () => {
    expect(validatePayload("totally_unregistered_thing", { anything: true }).ok).toBe(true);
    expect(validatePayload("payroll_runs", { anything: { x: 1 } }).ok).toBe(true);
  });

  it("treats null as an empty payload (no false rejects)", () => {
    expect(validatePayload("products", null).ok).toBe(true);
  });
});
