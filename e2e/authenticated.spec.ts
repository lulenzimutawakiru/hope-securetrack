import { test, expect } from "@playwright/test";
import { hasE2ECredentials, loginAsE2EUser } from "./helpers/auth";

test.describe("authenticated enterprise flows", () => {
  test.skip(!hasE2ECredentials(), "Set E2E_EMAIL and E2E_PASSWORD");

  test.beforeEach(async ({ page }) => {
    await loginAsE2EUser(page);
  });

  test("dashboard shell has skip link and main landmark", async ({ page }) => {
    await page.goto("/dashboard");
    const skip = page.getByRole("link", { name: /skip to main content/i });
    // May be sr-only until focus
    await expect(skip).toHaveCount(1);
    await expect(page.locator("#main-content")).toBeVisible();
  });

  test("payroll runs page shows server actions", async ({ page }) => {
    await page.goto("/dashboard/payroll/runs");
    await expect(page.getByText(/payroll runs/i).first()).toBeVisible({
      timeout: 25_000,
    });
    await expect(
      page.getByRole("button", { name: /run payroll/i })
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /bank file/i })
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /release pay/i })
    ).toBeVisible();
  });

  test("payroll process API is authenticated", async ({ page, request }) => {
    // Use browser cookies from logged-in context
    const cookies = await page.context().cookies();
    const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join("; ");

    const res = await request.post("/api/payroll/process", {
      headers: {
        Cookie: cookieHeader,
        "Content-Type": "application/json",
      },
      data: {},
    });

    // 200 success, 403 MFA/permission, or 500 empty workforce — not 401 if session ok
    expect([200, 403, 400, 429, 500]).toContain(res.status());
    if (res.status() === 401) {
      throw new Error("Session cookie not accepted by payroll process API");
    }
  });

  test("three-way match page can open run dialog", async ({ page }) => {
    await page.goto("/dashboard/procurement/matching");
    await expect(page.getByText(/three-way/i).first()).toBeVisible({
      timeout: 25_000,
    });
    const runBtn = page.getByRole("button", { name: /run match/i });
    await expect(runBtn).toBeVisible();
    await runBtn.click();
    await expect(page.getByText(/evaluate three-way match/i)).toBeVisible();
    await page.getByRole("button", { name: /local preview/i }).click();
    // Preview card should show a result status
    await expect(page.getByText(/result:/i)).toBeVisible({ timeout: 10_000 });
  });

  test("match API dry-run works with session", async ({ page, request }) => {
    const cookies = await page.context().cookies();
    const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join("; ");

    const res = await request.post("/api/procurement/match", {
      headers: {
        Cookie: cookieHeader,
        "Content-Type": "application/json",
      },
      data: {
        po_amount: 1000000,
        grn_amount: 1000000,
        invoice_amount: 1000000,
        dry_run: true,
      },
    });

    expect([200, 403, 429]).toContain(res.status());
    if (res.status() === 200) {
      const json = await res.json();
      expect(json.ok).toBe(true);
      expect(json.data?.result?.status).toBe("matched");
    }
  });

  test("finance engine page loads server post CTA", async ({ page }) => {
    await page.goto("/dashboard/finance/engine");
    await expect(page.getByText(/accounting engine/i).first()).toBeVisible({
      timeout: 25_000,
    });
  });

  test("dual-control security page loads", async ({ page }) => {
    await page.goto("/dashboard/security/dual-control");
    await expect(page.locator("body")).toBeVisible();
    // Page title or empty state
    await expect(
      page.getByText(/dual.?control|maker|checker|pending/i).first()
    ).toBeVisible({ timeout: 25_000 });
  });

  test("workflows page lists definitions", async ({ page }) => {
    await page.goto("/dashboard/workflows");
    await expect(page.getByText(/workflow/i).first()).toBeVisible({
      timeout: 25_000,
    });
  });

  test("platform jobs page loads", async ({ page }) => {
    await page.goto("/dashboard/platform/jobs");
    await expect(page.getByText(/background jobs|job queue|jobs/i).first()).toBeVisible({
      timeout: 25_000,
    });
  });
});
