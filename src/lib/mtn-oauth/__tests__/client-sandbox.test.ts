import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearMtnOauthCache,
  getMtnBearerToken,
  requestAccessToken,
} from "../client";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("MTN MADAPI OAuth2 client sandbox", () => {
  const prev = { ...process.env };

  beforeEach(() => {
    clearMtnOauthCache();
    process.env.MTN_OAUTH_SANDBOX = "true";
    delete process.env.MTN_OAUTH_CLIENT_ID;
    delete process.env.MTN_OAUTH_CLIENT_SECRET;
  });

  afterEach(() => {
    process.env = { ...prev };
    clearMtnOauthCache();
    vi.unstubAllGlobals();
  });

  it("returns a sandbox token without live credentials", async () => {
    const res = await requestAccessToken({ transactionId: "txn-oauth-1" });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.tokenType).toBe("bearer");
    expect(res.expiresInSeconds).toBe(3599);
    expect(res.issuedAt).toBeTruthy();
    expect(res.tokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(res.tokenAvailable).toBe(true);
  });

  it("returns 503 when not configured and sandbox disabled", async () => {
    process.env.MTN_OAUTH_SANDBOX = "false";
    const res = await requestAccessToken();
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.status).toBe(503);
    expect(res.error).toMatch(/MTN_OAUTH_CLIENT_ID/);
  });

  it("maps 401 to invalid_client", async () => {
    process.env.MTN_OAUTH_SANDBOX = "false";
    process.env.MTN_OAUTH_CLIENT_ID = "test-client";
    process.env.MTN_OAUTH_CLIENT_SECRET = "test-secret";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse(401, { error: "invalid_client" })) as unknown as typeof fetch
    );
    const res = await requestAccessToken();
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.status).toBe(401);
    expect(res.severity).toBe("auth");
    expect(res.error).toBe("invalid_client");
  });

  it("maps 400 to unsupported_grant_type", async () => {
    process.env.MTN_OAUTH_SANDBOX = "false";
    process.env.MTN_OAUTH_CLIENT_ID = "test-client";
    process.env.MTN_OAUTH_CLIENT_SECRET = "test-secret";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse(400, { error: "unsupported_grant_type" })) as unknown as typeof fetch
    );
    const res = await requestAccessToken();
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.status).toBe(400);
    expect(res.error).toBe("unsupported_grant_type");
  });

  it("parses a live SuccessToken and posts form-encoded credentials", async () => {
    process.env.MTN_OAUTH_SANDBOX = "false";
    process.env.MTN_OAUTH_CLIENT_ID = "test-client";
    process.env.MTN_OAUTH_CLIENT_SECRET = "test-secret";
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const body = init?.body?.toString() ?? "";
      expect(body).toContain("client_id=test-client");
      expect(body).toContain("client_secret=test-secret");
      const url = String(input);
      expect(url).toContain("grant_type=client_credentials");
      return jsonResponse(200, {
        access_token: "live-token-123",
        token_type: "bearer",
        expires_in: "3599",
        issued_at: "2026-08-04T00:00:00Z",
      });
    }) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    const res = await requestAccessToken({ transactionId: "txn-live" });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.tokenType).toBe("bearer");
    expect(res.expiresInSeconds).toBe(3599);
    expect(res.tokenHash).toBe(
      "90c034ef5d8a4ca5ee00317ece12a074c628efe0e6a55cc5e39d090c5a0d5599"
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("getMtnBearerToken returns null when OAuth not configured", async () => {
    process.env.MTN_OAUTH_SANDBOX = "false";
    const token = await getMtnBearerToken();
    expect(token).toBeNull();
  });

  it("getMtnBearerToken caches a live token and reuses it", async () => {
    process.env.MTN_OAUTH_SANDBOX = "false";
    process.env.MTN_OAUTH_CLIENT_ID = "test-client";
    process.env.MTN_OAUTH_CLIENT_SECRET = "test-secret";
    const fetchMock = vi.fn(async () =>
      jsonResponse(200, { access_token: "cached-token", token_type: "bearer", expires_in: "3599" })
    ) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    const first = await getMtnBearerToken();
    const second = await getMtnBearerToken();
    expect(first).toBe("cached-token");
    expect(second).toBe("cached-token");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});