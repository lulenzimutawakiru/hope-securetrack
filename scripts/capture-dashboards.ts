/**
 * SecureTrack ERP - capture real dashboard screenshots for the marketing site.
 *
 * Logs in with the configured screenshot user, visits each ERP dashboard, and
 * saves a JPEG to public/screenshots/<slug>.jpg.
 *
 * Credentials:
 *   E2E_EMAIL / E2E_PASSWORD env vars, or C:\tmp\screenshot-creds.json (dev).
 *   BASE_URL overrides the app origin (default http://localhost:3111).
 *   ONLY is a comma-separated slug filter (e.g. ONLY=inventory,reports,assets).
 *
 * Usage: npx tsx scripts/capture-dashboards.ts
 */
import { chromium, type Page } from "@playwright/test";
import { existsSync, readFileSync, mkdirSync, statSync } from "node:fs";
import { join } from "node:path";

const BASE_URL = process.env.BASE_URL || "http://localhost:3111";
const ONLY = (process.env.ONLY || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

function resolveCredentials(): { email: string; password: string } {
  const email = process.env.E2E_EMAIL;
  const password = process.env.E2E_PASSWORD;
  if (email && password) return { email, password };
  const candidates = [
    join(process.cwd(), "..", "tmp", "screenshot-creds.json"),
    join(process.cwd(), "..", "..", "tmp", "screenshot-creds.json"),
    "C:\\tmp\\screenshot-creds.json",
  ];
  for (const p of candidates) {
    if (existsSync(p)) {
      const parsed = JSON.parse(readFileSync(p, "utf8")) as {
        email?: string;
        password?: string;
      };
      if (parsed.email && parsed.password) return parsed as { email: string; password: string };
    }
  }
  throw new Error(
    "Screenshot credentials missing. Set E2E_EMAIL/E2E_PASSWORD or create C:\\tmp\\screenshot-creds.json"
  );
}

const ROUTES: Array<{ slug: string; path: string; assert: string }> = [
  { slug: "executive", path: "/dashboard", assert: "Welcome back" },
  { slug: "finance", path: "/dashboard/finance", assert: "Enterprise Finance" },
  { slug: "crm", path: "/dashboard/crm", assert: "Enterprise CRM" },
  { slug: "inventory", path: "/dashboard/inventory/reports", assert: "Inventory Reports" },
  { slug: "procurement", path: "/dashboard/procurement", assert: "Enterprise SRM" },
  { slug: "hr", path: "/dashboard/hr", assert: "Human Resource" },
  { slug: "payroll", path: "/dashboard/payroll", assert: "Enterprise Payroll" },
  { slug: "production", path: "/dashboard/production", assert: "MES Platform" },
  { slug: "fleet", path: "/dashboard/fleet", assert: "Fleet & Transport" },
  { slug: "sales", path: "/dashboard/sales", assert: "Advanced Sales" },
  { slug: "service-desk", path: "/dashboard/service-desk", assert: "Enterprise Ticketing" },
  { slug: "projects", path: "/dashboard/projects", assert: "Project Portfolio" },
  { slug: "reports", path: "/dashboard/reports/kpis", assert: "KPI Engine" },
  { slug: "analytics", path: "/dashboard/reports/analytics", assert: "Analytics" },
  { slug: "executive-bi", path: "/dashboard/reports/executive", assert: "Executive" },
  { slug: "assets", path: "/dashboard/assets", assert: "Enterprise Asset Tagging" },
];

async function login(page: Page, email: string, password: string): Promise<void> {
  await page.goto(`${BASE_URL}/login`, { waitUntil: "domcontentloaded" });
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(password);
  await page.getByRole("button", { name: /sign in/i }).first().click();
  await page.waitForURL(/\/dashboard/, { timeout: 60_000 });
}

/**
 * Polls the page body until the content assertion appears (or timeout).
 * Some hubs render a permission gate and hydrate slowly, so a fixed wait
 * is unreliable; this polls every 3s for up to ~90s.
 */
async function waitForContent(page: Page, assert: string, timeoutMs = 90_000): Promise<boolean> {
  const started = Date.now();
  let lastText = "";
  while (Date.now() - started < timeoutMs) {
    try {
      lastText = await page.locator("body").innerText({ timeout: 5_000 });
      if (lastText.includes(assert)) return true;
    } catch {
      // body may not be interactive mid-navigation; keep polling
    }
    await page.waitForTimeout(3_000);
  }
  console.log(`  (timeout waiting for "${assert}"; last body len=${lastText.length})`);
  return false;
}

async function main(): Promise<void> {
  const { email, password } = resolveCredentials();
  const outDir = join(process.cwd(), "public", "screenshots");
  mkdirSync(outDir, { recursive: true });

  const targets = ONLY.length > 0 ? ROUTES.filter((r) => ONLY.includes(r.slug)) : ROUTES;
  console.log(`targets: ${targets.map((t) => t.slug).join(", ")}`);

  const browser = await chromium.launch();
  try {
    const context = await browser.newContext({
      viewport: { width: 1600, height: 1000 },
      deviceScaleFactor: 1,
    });
    const page = await context.newPage();
    await login(page, email, password);
    console.log("login ok");

    let failed = 0;
    for (const route of targets) {
      try {
        console.log(`>> ${route.slug} -> ${route.path}`);
        await page.goto(`${BASE_URL}${route.path}`, {
          waitUntil: "domcontentloaded",
          timeout: 60_000,
        });
        const ready = await waitForContent(page, route.assert);
        await page.waitForTimeout(1500);
        const bodyText = await page.locator("body").innerText({ timeout: 10_000 }).catch(() => "");
        if (!ready && !bodyText.includes(route.assert)) {
          console.log(`MISS ${route.slug}: "${route.assert}" not found`);
          failed += 1;
          continue;
        }
        const file = join(outDir, `${route.slug}.jpg`);
        await page.screenshot({ path: file, type: "jpeg", quality: 85, fullPage: false });
        console.log(`OK  ${route.slug} -> ${file} (${Math.round(statSync(file).size / 1024)} KB)`);
      } catch (e) {
        console.log(`ERR ${route.slug}: ${String(e).slice(0, 200)}`);
        failed += 1;
      }
    }
    console.log(failed === 0 ? "ALL_CAPTURED" : `FAILED=${failed}`);
  } finally {
    await browser.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});