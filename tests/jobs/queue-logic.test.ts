import { describe, it, expect } from "vitest";

/**
 * Pure backoff / status logic tests (no DB).
 * Mirrors failJob delay formula from src/lib/jobs/queue.ts
 */
function retryDelaySec(attempts: number): number {
  return Math.min(3600, 30 * Math.pow(2, Math.max(0, attempts - 1)));
}

describe("job queue backoff", () => {
  it("uses exponential backoff", () => {
    expect(retryDelaySec(1)).toBe(30);
    expect(retryDelaySec(2)).toBe(60);
    expect(retryDelaySec(3)).toBe(120);
    expect(retryDelaySec(4)).toBe(240);
  });

  it("caps at 1 hour", () => {
    expect(retryDelaySec(20)).toBe(3600);
  });
});

describe("job dead-letter threshold", () => {
  it("marks dead when attempts >= max", () => {
    const shouldDead = (attempts: number, max: number) => attempts >= max;
    expect(shouldDead(5, 5)).toBe(true);
    expect(shouldDead(4, 5)).toBe(false);
  });
});
