/**
 * HTTP client for MTN MADAPI OAuth2 (Swagger v1.1).
 *
 *   POST /access_token?grant_type=client_credentials
 *   Content-Type: application/x-www-form-urlencoded
 *   body: client_id=<id>&client_secret=<secret>
 *
 * Response (SuccessToken): access_token, token_type, expires_in, issued_at, ...
 * Errors: 400 -> "unsupported_grant_type", 401 -> "invalid_client"
 *
 * Security: raw tokens live only in an in-memory cache keyed by client id.
 * The persisted/returned surface is a sha256 token_hash + expiry metadata.
 */

import { createHash } from "crypto";
import { mtnOauthConfig } from "./config";
import type { MtnOauthTokenResult } from "./types";

const SANDBOX_TTL_SECONDS = 3599;
/** Refresh 60s before the server-side expiry to avoid boundary races */
const EXPIRY_SKEW_MS = 60_000;

let tokenCache: {
  clientId: string;
  token: string;
  expiresAt: number;
} | null = null;

export function clearMtnOauthCache(): void {
  tokenCache = null;
}

export function mtnOauthSha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

type TokenPayload = {
  accessToken: string;
  tokenType: string;
  expiresInSeconds: number | null;
  issuedAt: string | null;
};

function parseTokenPayload(body: Record<string, unknown>): TokenPayload {
  const accessToken =
    typeof body.access_token === "string" ? body.access_token : "";
  const tokenType =
    typeof body.token_type === "string" ? body.token_type : "bearer";
  const rawExpires = body.expires_in;
  const expiresInSeconds =
    typeof rawExpires === "number"
      ? Math.floor(rawExpires)
      : typeof rawExpires === "string" && rawExpires.trim() !== ""
        ? Number(rawExpires) || null
        : null;
  const issuedAt =
    typeof body.issued_at === "string" && body.issued_at ? body.issued_at : null;
  return { accessToken, tokenType, expiresInSeconds, issuedAt };
}

function sandboxPayload(): TokenPayload & { body: Record<string, unknown> } {
  const issuedAt = new Date().toISOString();
  return {
    accessToken: "sandbox-oauth-token",
    tokenType: "bearer",
    expiresInSeconds: SANDBOX_TTL_SECONDS,
    issuedAt,
    body: {
      access_token: "sandbox-oauth-token",
      token_type: "bearer",
      expires_in: String(SANDBOX_TTL_SECONDS),
      issued_at: issuedAt,
      status: "approved",
    },
  };
}

function cacheToken(payload: TokenPayload, clientId: string): void {
  const ttlMs = (payload.expiresInSeconds ?? SANDBOX_TTL_SECONDS) * 1000;
  tokenCache = {
    clientId,
    token: payload.accessToken,
    expiresAt: Date.now() + Math.max(60_000, ttlMs - EXPIRY_SKEW_MS),
  };
}

async function fetchAccessToken(): Promise<
  (TokenPayload & { status: number; body: Record<string, unknown>; raw: unknown; ok: true }) |
  {
    ok: false;
    status: number;
    error: string;
    body?: Record<string, unknown> | null;
    raw?: unknown;
  }
> {
  const cfg = mtnOauthConfig();

  // Sandbox mock only when real credentials are absent (mirrors MTN KYC).
  if (cfg.sandbox && !cfg.configured) {
    const mock = sandboxPayload();
    return { ok: true, status: 200, ...mock, raw: { sandbox: true } };
  }

  if (!cfg.configured) {
    return {
      ok: false,
      status: 503,
      error:
        "MTN OAuth not configured. Set MTN_OAUTH_CLIENT_ID and MTN_OAUTH_CLIENT_SECRET",
    };
  }

  const params = new URLSearchParams();
  params.set("client_id", cfg.clientId);
  params.set("client_secret", cfg.clientSecret);
  const query = new URLSearchParams({ grant_type: cfg.grantType }).toString();

  let res: Response;
  try {
    res = await fetch(`${cfg.baseUrl}/access_token?${query}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: params.toString(),
      cache: "no-store",
    });
  } catch {
    return {
      ok: false,
      status: 0,
      error: "Unable to reach MTN MADAPI OAuth endpoint (network error)",
    };
  }

  const text = await res.text();
  let raw: unknown = null;
  try {
    raw = text ? JSON.parse(text) : null;
  } catch {
    raw = { raw: text.slice(0, 2000) };
  }
  const body = (raw || {}) as Record<string, unknown>;

  if (!res.ok) {
    const error =
      typeof body.error === "string"
        ? body.error
        : res.status === 400
          ? "unsupported_grant_type"
          : res.status === 401
            ? "invalid_client"
            : "Access token request failed";
    return { ok: false, status: res.status, error, body, raw };
  }

  const payload = parseTokenPayload(body);
  if (!payload.accessToken) {
    return {
      ok: false,
      status: 502,
      error: "MTN returned no access_token in response",
      body,
      raw,
    };
  }
  return { ok: true, status: res.status, ...payload, body, raw };
}

/**
 * Public, audited access-token request used by the route/UI.
 * Never returns the raw token - only metadata + sha256 hash.
 */
export async function requestAccessToken(opts?: {
  transactionId?: string;
}): Promise<MtnOauthTokenResult> {
  const cfg = mtnOauthConfig();
  const out = await fetchAccessToken();

  if (!out.ok) {
    return {
      ok: false,
      status: out.status,
      error: out.error,
      severity:
        out.status === 401 || out.status === 403
          ? "auth"
          : out.status === 400
            ? "client"
            : out.status === 0
              ? "unknown"
              : "server",
      body: out.body || null,
      raw: out.raw,
    };
  }

  cacheToken(out, cfg.clientId);
  const issuedAt = out.issuedAt ?? new Date().toISOString();
  return {
    ok: true,
    status: out.status,
    tokenType: out.tokenType,
    expiresInSeconds: out.expiresInSeconds,
    issuedAt,
    tokenHash: mtnOauthSha256(out.accessToken),
    tokenAvailable: true,
    summary: {
      token_type: out.tokenType,
      expires_in:
        out.expiresInSeconds != null ? String(out.expiresInSeconds) : null,
      issued_at: issuedAt,
      sandbox: cfg.sandbox || undefined,
    },
    raw: out.raw,
  };
}

/**
 * Internal: returns a live bearer token (cached) for other MADAPI clients
 * (e.g. MTN KYC) to send as `Authorization: Bearer <token>`.
 * Returns null when OAuth client credentials are not configured so callers
 * keep their existing auth fallbacks.
 */
export async function getMtnBearerToken(): Promise<string | null> {
  const cfg = mtnOauthConfig();
  if (!cfg.configured) return null;
  if (
    tokenCache &&
    tokenCache.clientId === cfg.clientId &&
    tokenCache.expiresAt > Date.now()
  ) {
    return tokenCache.token;
  }
  const out = await fetchAccessToken();
  if (!out.ok || !out.accessToken) return null;
  cacheToken(out, cfg.clientId);
  return out.accessToken;
}