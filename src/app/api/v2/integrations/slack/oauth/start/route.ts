/**
 * Start Slack OAuth install for the signed-in company.
 * GET → { authorize_url }
 */

import { randomBytes } from "crypto";
import { createApiHandler } from "@/lib/api/handler";
import { apiError, apiOk } from "@/lib/api";
import { cookies } from "next/headers";
import { buildSlackOAuthUrl, slackPlatformConfig } from "@/lib/slack";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const GET = createApiHandler(
  {
    auth: true,
    permissions: ["intg.manage", "settings.integrations", "settings.manage"],
    allowPlatformAdmin: true,
    module: "integrations",
    rateLimit: { limit: 20, windowMs: 60_000 },
  },
  async ({ ctx, req }) => {
    if (!ctx) return apiError("UNAUTHORIZED", "Sign in required", 401);
    const platform = slackPlatformConfig();
    if (!platform.configured) {
      return apiError(
        "VALIDATION",
        "Slack platform credentials are not configured on the server",
        400
      );
    }

    const nonce = randomBytes(16).toString("hex");
    const jar = await cookies();
    jar.set("slack_oauth_nonce", nonce, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 600,
    });

    const origin =
      req.headers.get("x-forwarded-host")
        ? `${req.headers.get("x-forwarded-proto") || "https"}://${req.headers.get("x-forwarded-host")}`
        : req.nextUrl.origin;

    try {
      const authorize_url = buildSlackOAuthUrl({
        companyId: ctx.companyId,
        userId: ctx.user.id,
        origin,
        stateNonce: nonce,
      });
      return apiOk({ authorize_url });
    } catch (e) {
      return apiError(
        "INTERNAL",
        e instanceof Error ? e.message : "OAuth start failed",
        500
      );
    }
  }
);
