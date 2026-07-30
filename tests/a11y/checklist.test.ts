/**
 * Static accessibility checklist for enterprise UX contracts.
 * Complements Playwright a11y smoke on public pages.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

const root = process.cwd();

function read(rel: string): string {
  const p = join(root, rel);
  if (!existsSync(p)) return "";
  return readFileSync(p, "utf8");
}

describe("WCAG foundation checklist", () => {
  it("root layout sets lang=en", () => {
    const layout = read("src/app/layout.tsx");
    expect(layout).toMatch(/lang=["']en["']/);
  });

  it("dashboard shell has skip link and main landmark id", () => {
    const shell = read("src/components/layout/dashboard-shell.tsx");
    expect(shell).toMatch(/Skip to main content/);
    expect(shell).toMatch(/id=["']main-content["']/);
    expect(shell).toMatch(/<main/);
  });

  it("payroll runs actions expose aria-labels", () => {
    const page = read("src/app/dashboard/payroll/runs/page.tsx");
    expect(page).toMatch(/aria-label=["']Run payroll/);
    expect(page).toMatch(/aria-label=["']Generate bank file/);
    expect(page).toMatch(/aria-label=["']Release payroll/);
  });

  it("theme provider supports light and dark (system)", () => {
    const layout = read("src/app/layout.tsx");
    expect(layout).toMatch(/ThemeProvider/);
    expect(layout).toMatch(/defaultTheme/);
  });

  it("axe e2e suite exists for WCAG 2.1 AA tags", () => {
    const axe = read("e2e/a11y.spec.ts");
    expect(axe).toMatch(/@axe-core\/playwright/);
    expect(axe).toMatch(/wcag21aa/);
  });

  it("compliance evidence pack documents SOC2 map", () => {
    const pack = read("docs/SOC2_ISO_EVIDENCE_PACK.md");
    expect(pack).toMatch(/Trust Services Criteria/);
    expect(pack).toMatch(/ISO 27001/);
  });
});
