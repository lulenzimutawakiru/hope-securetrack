import { describe, it, expect } from "vitest";
import {
  safeInternalPath,
  sanitizeHtml,
  sanitizePostgrestFilter,
  timingSafeEqualString,
  isPaymentSandboxEnabled,
} from "@/lib/security/shared";

describe("safeInternalPath", () => {
  it("allows relative dashboard paths", () => {
    expect(safeInternalPath("/dashboard/payroll")).toBe("/dashboard/payroll");
  });

  it("blocks open redirects", () => {
    expect(safeInternalPath("//evil.com")).toBe("/dashboard");
    expect(safeInternalPath("https://evil.com")).toBe("/dashboard");
    expect(safeInternalPath("/\\evil")).toBe("/dashboard");
    expect(safeInternalPath(null)).toBe("/dashboard");
  });
});

describe("sanitizePostgrestFilter", () => {
  it("strips filter injection characters", () => {
    const dirty = "foo%,()bar_baz";
    const clean = sanitizePostgrestFilter(dirty);
    expect(clean).not.toMatch(/[%_,.()]/);
    expect(clean.length).toBeGreaterThan(0);
  });

  it("caps length", () => {
    expect(sanitizePostgrestFilter("a".repeat(200), 80).length).toBeLessThanOrEqual(80);
  });
});

describe("sanitizeHtml", () => {
  it("removes script tags and handlers", () => {
    const html = `<p onclick="alert(1)">x</p><script>alert(2)</script>`;
    const out = sanitizeHtml(html);
    expect(out.toLowerCase()).not.toContain("<script");
    expect(out.toLowerCase()).not.toContain("onclick");
  });
});

describe("timingSafeEqualString", () => {
  it("compares equality", () => {
    expect(timingSafeEqualString("secret", "secret")).toBe(true);
    expect(timingSafeEqualString("secret", "Secret")).toBe(false);
    expect(timingSafeEqualString("a", "ab")).toBe(false);
  });
});

describe("isPaymentSandboxEnabled", () => {
  it("respects PAYMENT_SANDBOX env", () => {
    const prev = process.env.PAYMENT_SANDBOX;
    process.env.PAYMENT_SANDBOX = "true";
    expect(isPaymentSandboxEnabled()).toBe(true);
    process.env.PAYMENT_SANDBOX = "false";
    // still may be true in non-production when not false... we set false so should be false
    expect(isPaymentSandboxEnabled()).toBe(false);
    if (prev === undefined) delete process.env.PAYMENT_SANDBOX;
    else process.env.PAYMENT_SANDBOX = prev;
  });
});
