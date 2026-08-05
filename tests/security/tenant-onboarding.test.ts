import { describe, expect, it } from "vitest";
import {
  resolveLocaleDefaults,
  setupProgressSummary,
  slugifyOrgName,
  validateAdminPassword,
  TENANT_WIZARD_STEPS,
  buildWizardRows,
} from "@/lib/platform/onboarding";

describe("tenant onboarding helpers", () => {
  it("validates strong admin passwords", () => {
    expect(validateAdminPassword("short").ok).toBe(false);
    expect(validateAdminPassword("alllowercase1!").ok).toBe(false);
    expect(validateAdminPassword("NoSpecial123").ok).toBe(false);
    expect(validateAdminPassword("GoodPass1!").ok).toBe(true);
  });

  it("resolves locale defaults from country", () => {
    const ug = resolveLocaleDefaults({ country_code: "UG" });
    expect(ug.currency).toBe("UGX");
    expect(ug.timezone).toBe("Africa/Kampala");

    const ke = resolveLocaleDefaults({ country_code: "ke" });
    expect(ke.currency).toBe("KES");

    const custom = resolveLocaleDefaults({
      country_code: "UG",
      currency: "USD",
      timezone: "UTC",
    });
    expect(custom.currency).toBe("USD");
    expect(custom.timezone).toBe("UTC");
  });

  it("slugifies organization names", () => {
    expect(slugifyOrgName("Acme Manufacturing Ltd")).toBe(
      "acme-manufacturing-ltd"
    );
    expect(slugifyOrgName("  ")).toMatch(/^tenant-/);
  });

  it("builds wizard rows with auto-completed seed steps", () => {
    const rows = buildWizardRows("t1", "c1");
    expect(rows.length).toBe(TENANT_WIZARD_STEPS.length);
    const branding = rows.find((r) => r.step_key === "branding");
    expect(branding?.status).toBe("pending");
    const company = rows.find((r) => r.step_key === "company");
    expect(company?.status).toBe("completed");
    expect(company?.metadata).toMatchObject({ href: expect.any(String) });
  });

  it("summarizes setup progress", () => {
    const summary = setupProgressSummary([
      { step_key: "a", status: "completed" },
      { step_key: "b", status: "pending" },
      { step_key: "c", status: "skipped" },
    ]);
    expect(summary.total).toBe(3);
    expect(summary.completed).toBe(2);
    expect(summary.remaining).toBe(1);
    expect(summary.percent).toBe(67);
    expect(summary.isComplete).toBe(false);
    expect(summary.nextStep?.step_key).toBe("b");
  });
});
