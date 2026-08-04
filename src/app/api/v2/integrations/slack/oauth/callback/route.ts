/**
 * Slack OAuth redirect callback.
 * Exchanges code, stores company workspace, redirects to integrations UI.
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import {
  exchangeSlackOAuthCode,
  parseOAuthState,
  saveSlackInstallation,
} from "@/lib/slack";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function redirectTo(path: string, req: NextRequest, qs?: Record<string, string>) {
  const url = req.nextUrl.clone();
  url.pathname = path;
  url.search = "";
  if (qs) {
    for (const [k, v] of Object.entries(qs)) url.searchParams.set(k, v);
  }
  return NextResponse.redirect(url);
}

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const err = req.nextUrl.searchParams.get("error");

  if (err) {
    return redirectTo("/dashboard/integrations/slack", req, {
      error: err,
    });
  }
  if (!code || !state) {
    return redirectTo("/dashboard/integrations/slack", req, {
      error: "missing_code",
    });
  }

  const parsed = parseOAuthState(state);
  if (!parsed) {
    return redirectTo("/dashboard/integrations/slack", req, {
      error: "invalid_state",
    });
  }

  // OAuth state max age 10 minutes
  if (Date.now() - parsed.ts > 10 * 60 * 1000) {
    return redirectTo("/dashboard/integrations/slack", req, {
      error: "state_expired",
    });
  }

  const jar = await cookies();
  const nonce = jar.get("slack_oauth_nonce")?.value;
  if (!nonce || nonce !== parsed.nonce) {
    return redirectTo("/dashboard/integrations/slack", req, {
      error: "nonce_mismatch",
    });
  }
  jar.delete("slack_oauth_nonce");

  // Session must match state company/user
  const sb = await createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user || user.id !== parsed.userId) {
    return redirectTo("/login", req, { next: "/dashboard/integrations/slack" });
  }

  const origin =
    req.headers.get("x-forwarded-host")
      ? `${req.headers.get("x-forwarded-proto") || "https"}://${req.headers.get("x-forwarded-host")}`
      : req.nextUrl.origin;

  try {
    const oauth = await exchangeSlackOAuthCode({ code, origin });
    const { data: profile } = await sb
      .from("user_profiles")
      .select("company_id, active_company_id, tenant_id")
      .eq("id", user.id)
      .maybeSingle();
    const companyId = String(
      profile?.active_company_id || profile?.company_id || parsed.companyId
    );
    if (companyId !== parsed.companyId) {
      return redirectTo("/dashboard/integrations/slack", req, {
        error: "company_mismatch",
      });
    }

    await saveSlackInstallation({
      companyId,
      tenantId: (profile?.tenant_id as string | null) || null,
      userId: user.id,
      oauth,
    });

    return redirectTo("/dashboard/integrations/slack", req, {
      connected: "1",
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "oauth_failed";
    return redirectTo("/dashboard/integrations/slack", req, {
      error: msg.slice(0, 80),
    });
  }
}
