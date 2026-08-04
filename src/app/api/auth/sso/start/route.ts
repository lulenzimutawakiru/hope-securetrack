/**
 * Start company OIDC SSO — redirects to IdP authorize URL.
 * Query: provider_id | provider_code, company_id?, return_to?
 */

import { NextRequest, NextResponse } from "next/server";
import { clientIp, rateLimitStrict } from "@/lib/api";
import {
  createSsoState,
  loadActiveProvider,
  newNonce,
  resolveClientSecret,
  resolveOidcEndpoints,
} from "@/lib/sso/oidc";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const ip = clientIp(req);
  const rl = await rateLimitStrict(`sso-start:${ip}`, 30, 60_000);
  if (!rl.allowed) {
    return NextResponse.json({ error: "Rate limit" }, { status: 429 });
  }

  const sp = req.nextUrl.searchParams;
  const providerId = sp.get("provider_id") || undefined;
  const providerCode = sp.get("provider_code") || undefined;
  const companyId = sp.get("company_id") || undefined;
  const returnTo = sp.get("return_to") || "/dashboard";

  if (!providerId && !providerCode) {
    return NextResponse.json(
      { error: "provider_id or provider_code required" },
      { status: 400 }
    );
  }

  const provider = await loadActiveProvider({
    providerId,
    providerCode,
    companyId,
  });
  if (!provider) {
    return NextResponse.json(
      { error: "SSO provider not found or inactive" },
      { status: 404 }
    );
  }

  const clientId =
    provider.client_id ||
    process.env.SSO_ENTRA_CLIENT_ID ||
    process.env.AZURE_AD_CLIENT_ID ||
    process.env.GOOGLE_OAUTH_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json(
      { error: "SSO client_id not configured" },
      { status: 503 }
    );
  }

  const secret = resolveClientSecret(provider);
  if (!secret) {
    return NextResponse.json(
      {
        error:
          "SSO client secret not configured (set client_secret_ref ENV:VAR or SSO_*_CLIENT_SECRET)",
      },
      { status: 503 }
    );
  }

  const endpoints = await resolveOidcEndpoints(provider);
  if (!endpoints?.authorization_endpoint) {
    return NextResponse.json(
      { error: "Could not resolve OIDC authorization endpoint" },
      { status: 503 }
    );
  }

  const origin =
    process.env.NEXT_PUBLIC_APP_URL ||
    req.nextUrl.origin ||
    "http://localhost:3000";
  const redirectUri = `${origin.replace(/\/$/, "")}/api/auth/sso/callback`;
  const nonce = newNonce();
  const state = createSsoState({
    providerId: provider.id,
    companyId: provider.company_id,
    nonce,
    returnTo: returnTo.startsWith("/") ? returnTo : "/dashboard",
  });

  const scopes =
    (provider.config?.scopes as string) ||
    "openid email profile offline_access";

  const authUrl = new URL(endpoints.authorization_endpoint);
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("scope", scopes);
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("nonce", nonce);
  // Entra-friendly
  if (
    provider.provider_code.includes("entra") ||
    provider.provider_code.includes("azure") ||
    authUrl.hostname.includes("microsoftonline")
  ) {
    authUrl.searchParams.set("response_mode", "query");
  }

  return NextResponse.redirect(authUrl.toString(), 302);
}
