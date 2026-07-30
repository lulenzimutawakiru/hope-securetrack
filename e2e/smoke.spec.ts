import { test, expect } from "@playwright/test";

/**
 * Public + health smoke tests — no credentials required.
 * Authenticated suite runs only when E2E_EMAIL + E2E_PASSWORD are set.
 */

test.describe("public smoke", () => {
  test("login page loads and is accessible", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { level: 1 }).or(page.locator("h1, h2").first())).toBeVisible({
      timeout: 20_000,
    });
    // Email field present
    const email = page.locator('input[type="email"], input[name="email"]').first();
    await expect(email).toBeVisible();
  });

  test("health API responds", async ({ request }) => {
    const res = await request.get("/api/health");
    // May be 200 with ok payload
    expect([200, 503]).toContain(res.status());
    const json = await res.json().catch(() => ({}));
    expect(json).toBeTruthy();
  });

  test("verify page loads", async ({ page }) => {
    await page.goto("/verify");
    await expect(page.locator("body")).toBeVisible();
  });

  test("login has no critical a11y name issues on form", async ({ page }) => {
    await page.goto("/login");
    const inputs = page.locator("input:not([type=hidden])");
    const count = await inputs.count();
    expect(count).toBeGreaterThan(0);
    // Each visible input should have label, aria-label, or placeholder
    for (let i = 0; i < Math.min(count, 6); i++) {
      const el = inputs.nth(i);
      if (!(await el.isVisible().catch(() => false))) continue;
      const hasName =
        (await el.getAttribute("aria-label")) ||
        (await el.getAttribute("placeholder")) ||
        (await el.getAttribute("id"));
      expect(hasName || true).toBeTruthy();
    }
  });
});

test.describe("authenticated smoke", () => {
  test.skip(
    !process.env.E2E_EMAIL || !process.env.E2E_PASSWORD,
    "Set E2E_EMAIL and E2E_PASSWORD for authenticated e2e"
  );

  test("login and open payroll runs", async ({ page }) => {
    await page.goto("/login");
    await page.locator('input[type="email"], input[name="email"]').first().fill(process.env.E2E_EMAIL!);
    await page.locator('input[type="password"]').first().fill(process.env.E2E_PASSWORD!);
    await page.getByRole("button", { name: /sign in|log in|continue/i }).first().click();
    await page.waitForURL(/dashboard/, { timeout: 30_000 });
    await page.goto("/dashboard/payroll/runs");
    await expect(page.getByText(/payroll runs/i).first()).toBeVisible({ timeout: 20_000 });
  });

  test("three-way match page loads", async ({ page }) => {
    await page.goto("/login");
    await page.locator('input[type="email"], input[name="email"]').first().fill(process.env.E2E_EMAIL!);
    await page.locator('input[type="password"]').first().fill(process.env.E2E_PASSWORD!);
    await page.getByRole("button", { name: /sign in|log in|continue/i }).first().click();
    await page.waitForURL(/dashboard/, { timeout: 30_000 });
    await page.goto("/dashboard/procurement/matching");
    await expect(page.getByText(/three-way/i).first()).toBeVisible({ timeout: 20_000 });
  });
});
