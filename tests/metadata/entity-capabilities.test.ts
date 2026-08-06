/**
 * Business Object catalog — universal capabilities surface.
 * Every registered entity must expose the full capability set so common
 * object services (timeline, attachments, comments, QR, tags, AI, approvals,
 * audit, …) are never re-implemented per module.
 */
import { describe, it, expect } from "vitest";
import {
  DEFAULT_CAPABILITIES,
  getEntityCatalog,
} from "@/lib/metadata/entity-registry";

describe("Business Object catalog", () => {
  const catalog = getEntityCatalog();
  const capabilityKeys = Object.keys(DEFAULT_CAPABILITIES) as Array<
    keyof typeof DEFAULT_CAPABILITIES
  >;

  it("registers a large catalog of Business Objects", () => {
    expect(catalog.length).toBeGreaterThan(100);
    const names = new Set(catalog.map((d) => d.entity));
    expect(names.size).toBe(catalog.length);
  });

  it("gives every entity a complete boolean capability surface", () => {
    for (const def of catalog) {
      expect(def.capabilities, def.entity).toBeDefined();
      for (const key of capabilityKeys) {
        expect(
          typeof def.capabilities[key],
          `${def.entity}.${key}`
        ).toBe("boolean");
      }
    }
  });

  it("defaults every capability to enabled", () => {
    for (const def of catalog) {
      expect(def.capabilities, def.entity).toEqual(DEFAULT_CAPABILITIES);
    }
  });
});
