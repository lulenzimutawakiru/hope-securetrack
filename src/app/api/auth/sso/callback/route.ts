/**
 * OIDC authorization-code callback — provision user + session via magic link.
 */

import { NextRequest, NextResponse } from "next/server";
import { clientIp, rateLimitStrict } from "@/lib/api";
import {
  decodeIdTokenPayload,
  exchangeCode,
  fetchUserInfo,
  loadActiveProvider,
  parseSsoState,
  provisionSsoUser,
  resolveClientSecret,
  resolveOidcEndpoints,
} from "@/lib/sso/oidc";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const ip = clientIp(req);
  const rl = await rateLimitStrict(`sso-callback:${ip}`, 40, 60_000);
  if (!rl.allowed) {
    return NextResponse.redirect(
      new URL("/login?error=rate_limit", req.nextUrl.origin)
    );
  }

  const sp = req.nextUrl.searchParams;
  const err = sp.get("error");
  if (err) {
    return NextResponse.redirect(
      new URL(
        `/login?error=${encodeURIComponent(err)}&error_description=${encodeURIComponent(sp.get("error_description") || "")}`,
        req.nextUrl.origin
      )
    );
  }

  const code = sp.get("code");
  const state = sp.get("state");
  if (!code || !state) {
    return NextResponse.redirect(
      new URL("/login?error=missing_code", req.nextUrl.origin)
    );
  }

  const parsed = parseSsoState(state);
  if (!parsed) {
    return NextResponse.redirect(
      new URL("/login?error=invalid_state", req.nextUrl.origin)
    );
  }

  try {
    const provider = await loadActiveProvider({
      providerId: parsed.providerId,
      companyId: parsed.companyId,
    });
    if (!provider) {
      return NextResponse.redirect(
        new URL("/login?error=provider_inactive", req.nextUrl.origin)
      );
    }

    const clientId =
      provider.client_id ||
      process.env.SSO_ENTRA_CLIENT_ID ||
      process.env.AZURE_AD_CLIENT_ID ||
      "";
    const clientSecret = resolveClientSecret(provider);
    if (!clientId || !clientSecret) {
      return NextResponse.redirect(
        new URL("/login?error=sso_misconfigured", req.nextUrl.origin)
      );
    }

    const endpoints = await resolveOidcEndpoints(provider);
    if (!endpoints?.token_endpoint) {
      return NextResponse.redirect(
        new URL("/login?error=oidc_discovery", req.nextUrl.origin)
      );
    }

    // Pin the OIDC redirect_uri to the configured public origin. In production
    // the request Host header is never trusted: host-header poisoning would let
    // an attacker steer the authorization-code exchange to their own origin.
    const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "");
    const baseUrl =
      appUrl ||
      (process.env.NODE_ENV !== "production" ? req.nextUrl.origin : "");
    if (!baseUrl) {
      return NextResponse.redirect(
        new URL("/login?error=sso_misconfigured", req.nextUrl.origin)
      );
    }
    const redirectUri = `${baseUrl}/api/auth/sso/callback`;

    const tokens = await exchangeCode({
      tokenUrl: endpoints.token_endpoint,
      code,
      redirectUri,
      clientId,
      clientSecret,
    });

    let info =
      (tokens.id_token ? decodeIdTokenPayload(tokens.id_token) : null) || null;

    if (
      (!info?.email || !info?.sub) &&
      endpoints.userinfo_endpoint &&
      tokens.access_token
    ) {
      info = await fetchUserInfo(endpoints.userinfo_endpoint, tokens.access_token);
    }

    if (!info?.sub) {
      return NextResponse.redirect(
        new URL("/login?error=no_subject", req.nextUrl.origin)
      );
    }

    const email =
      info.email ||
      info.preferred_username ||
      "";
    if (!email.includes("@")) {
      return NextResponse.redirect(
        new URL("/login?error=no_email", req.nextUrl.origin)
      );
    }

    const fullName =
      info.name ||
      [info.given_name, info.family_name].filter(Boolean).join(" ") ||
      undefined;

    const { actionLink } = await provisionSsoUser({
      provider,
      subject: info.sub,
      email,
      fullName,
    });

    // Redirect through Supabase magic link to establish session cookies
    const safeReturn =
      parsed.returnTo &&
      parsed.returnTo.startsWith("/") &&
      !parsed.returnTo.startsWith("//")
        ? parsed.returnTo
        : "/dashboard";

    // Prefer action_link; append next if supported
    const link = new URL(actionLink);
    if (!link.searchParams.has("redirect_to")) {
      link.searchParams.set(
        "redirect_to",
        `${baseUrl}${safeReturn}`
      );
    }
    return NextResponse.redirect(link.toString(), 302);
  } catch (e) {
    console.error("[sso/callback]", e);
    return NextResponse.redirect(
      new URL(
        `/login?error=sso_failed&message=${encodeURIComponent(
          e instanceof Error ? e.message.slice(0, 120) : "failed"
        )}`,
        req.nextUrl.origin
      )
    );
  }
}
