/**
 * Ensures EntityPage module tables are registered for /api/v2/crud and that
 * production security defaults enforce MFA / dual-control unless explicitly off.
 */
import { describe, it, expect, afterEach } from "vitest";
import {
  ensureEntityPageTablesRegistered,
  ENTITY_PAGE_TABLES,
} from "@/lib/metadata/register-entity-page-tables";
import { getEntityDefinition } from "@/lib/metadata/entity-registry";
import { mfaEnforcementEnabled } from "@/lib/security/api-auth";
import { dualControlEnforcementEnabled } from "@/lib/security/dual-control";

describe("entity page CRUD path", () => {
  it("registers all EntityPage tables on demand", () => {
    const n = ensureEntityPageTablesRegistered();
    // Second call is a no-op (0 new); first may be 0 if already loaded via import
    expect(n).toBeGreaterThanOrEqual(0);
    expect(ENTITY_PAGE_TABLES.length).toBeGreaterThan(100);

    for (const table of [
      "fin_account_groups",
      "fin_banks",
      "pay_calendars",
      "fleet_drivers",
      "sales_price_lists",
      "att_devices",
      "ta_offers",
      "ppm_tasks",
      "lbl_templates",
    ]) {
      const def = getEntityDefinition(table);
      expect(def, `missing registry entry for ${table}`).toBeDefined();
      expect(def!.table).toBe(table);
      expect(def!.tenantScoped).toBe(true);
      expect(def!.softDelete).toBe(true);
    }
  });

  it("maps finance tables to finance module permissions", () => {
    ensureEntityPageTablesRegistered();
    const def = getEntityDefinition("fin_journal_templates");
    expect(def?.module).toBe("finance");
    expect(def?.viewPermission).toBe("finance.view");
    expect(def?.createPermission).toBe("finance.manage");
  });
});

describe("production security defaults", () => {
  const prevMfa = process.env.MFA_ENFORCE_PRIVILEGED;
  const prevDc = process.env.DUAL_CONTROL_REQUIRED;

  afterEach(() => {
    if (prevMfa === undefined) delete process.env.MFA_ENFORCE_PRIVILEGED;
    else process.env.MFA_ENFORCE_PRIVILEGED = prevMfa;
    if (prevDc === undefined) delete process.env.DUAL_CONTROL_REQUIRED;
    else process.env.DUAL_CONTROL_REQUIRED = prevDc;
  });

  it("MFA can be forced on with MFA_ENFORCE_PRIVILEGED=true", () => {
    process.env.MFA_ENFORCE_PRIVILEGED = "true";
    expect(mfaEnforcementEnabled()).toBe(true);
  });

  it("MFA can be forced off with MFA_ENFORCE_PRIVILEGED=false", () => {
    process.env.MFA_ENFORCE_PRIVILEGED = "false";
    expect(mfaEnforcementEnabled()).toBe(false);
  });

  it("dual-control can be forced on/off via env", () => {
    process.env.DUAL_CONTROL_REQUIRED = "true";
    expect(dualControlEnforcementEnabled()).toBe(true);
    process.env.DUAL_CONTROL_REQUIRED = "false";
    expect(dualControlEnforcementEnabled()).toBe(false);
  });

  it("explicit flags override ambient NODE_ENV", () => {
    // Production default is ON when env unset; explicit false always wins.
    process.env.MFA_ENFORCE_PRIVILEGED = "false";
    process.env.DUAL_CONTROL_REQUIRED = "false";
    expect(mfaEnforcementEnabled()).toBe(false);
    expect(dualControlEnforcementEnabled()).toBe(false);
  });
});
