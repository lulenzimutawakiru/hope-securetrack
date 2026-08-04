import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  hashToken,
  verifyTokenHash,
  generateSecureToken,
} from "@/lib/security/tokens";

describe("portal token crypto", () => {
  it("generates high-entropy tokens", () => {
    const t = generateSecureToken(32);
    expect(t.length).toBe(64); // hex
    expect(t).toMatch(/^[0-9a-f]+$/);
  });

  it("hash is stable and verifiable", async () => {
    const token = generateSecureToken();
    const h1 = await hashToken(token);
    const h2 = await hashToken(token);
    expect(h1).toBe(h2);
    expect(await verifyTokenHash(token, h1)).toBe(true);
    expect(await verifyTokenHash("wrong", h1)).toBe(false);
  });
});

describe("plaintext token policy", () => {
  const envKeys = [
    "NODE_ENV",
    "ALLOW_PLAINTEXT_TOKENS",
    "ALLOW_TOKEN_PLAINTEXT_LOOKUP",
  ] as const;
  const snapshot: Record<string, string | undefined> = {};

  const env = process.env as unknown as Record<string, string | undefined>;

  beforeEach(() => {
    for (const k of envKeys) snapshot[k] = env[k];
  });

  afterEach(() => {
    for (const k of envKeys) {
      if (snapshot[k] === undefined) delete env[k];
      else env[k] = snapshot[k];
    }
  });

  it("hashToken always produces 64-char hex", async () => {
    const h = await hashToken("test-token-value-here");
    expect(h).toHaveLength(64);
  });
});
