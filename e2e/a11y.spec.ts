import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { hasE2ECredentials, loginAsE2EUser } from "./helpers/auth";

/**
 * WCAG-oriented axe scans.
 * Serious/critical violations fail the test.
 */
async function expectNoCriticalA11y(page: import("@playwright/test").Page, path: string) {
  await page.goto(path);
  await page.waitForLoadState("domcontentloaded");
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();

  const critical = results.violations.filter(
    (v) => v.impact === "critical" || v.impact === "serious"
  );

  if (critical.length) {
    const summary = critical
      .map(
        (v) =>
          `${v.impact?.toUpperCase()} ${v.id}: ${v.help} (${v.nodes.length} nodes)`
      )
      .join("\n");
    expect(critical, `A11y violations on ${path}:\n${summary}`).toEqual([]);
  }
}

test.describe("axe WCAG public pages", () => {
  test("login page", async ({ page }) => {
    await expectNoCriticalA11y(page, "/login");
  });

  test("verify page", async ({ page }) => {
    await expectNoCriticalA11y(page, "/verify");
  });
});

test.describe("axe WCAG authenticated pages", () => {
  test.skip(!hasE2ECredentials(), "Set E2E_EMAIL and E2E_PASSWORD");

  test.beforeEach(async ({ page }) => {
    await loginAsE2EUser(page);
  });

  for (const path of [
    "/dashboard",
    "/dashboard/payroll/runs",
    "/dashboard/procurement/matching",
    "/dashboard/finance/engine",
    "/dashboard/workflows",
  ]) {
    test(`scan ${path}`, async ({ page }) => {
      await expectNoCriticalA11y(page, path);
    });
  }
});
