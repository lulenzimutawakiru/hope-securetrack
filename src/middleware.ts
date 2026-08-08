import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import {
  getClientIpFromHeaders,
  hasSupabaseSessionCookie,
  isApiRateLimitExempt,
  rateLimitRequest,
} from "@/lib/security/rate-limit";

const SECURITY_HEADERS: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(self)",
  "Cross-Origin-Opener-Policy": "same-origin",
  "X-DNS-Prefetch-Control": "off",
};

const WINDOW_MS = 60_000;

/**
 * Per-IP ceilings per minute. Authenticated sessions get a higher ceiling than
 * anonymous traffic; attendance device polling (token-authenticated, frequent)
 * gets its own dedicated bucket so real devices are never throttled.
 */
function apiRateLimitMax(req: NextRequest): number {
  let raw: string | undefined;
  if (req.nextUrl.pathname.startsWith("/api/attendance/devices")) {
    raw = process.env.RATE_LIMIT_DEVICE_API ?? "300";
  } else if (hasSupabaseSessionCookie(req)) {
    raw =
      process.env.RATE_LIMIT_AUTH_API ??
      process.env.RATE_LIMIT_API ??
      process.env.RATE_LIMIT_MAX ??
      "600";
  } else {
    raw = process.env.RATE_LIMIT_API ?? process.env.RATE_LIMIT_MAX ?? "30";
  }
  const parsed = parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 30;
}

// Content-Security-Policy: pragmatic strict production policy. Inline scripts
// are allowed (Next.js RSC payloads + theme bootstrap render inline script tags),
// but inline event handlers are blocked via script-src-attr 'none'.
function buildCSP() {
  const captchaScript =
    "https://challenges.cloudflare.com https://js.hcaptcha.com";
  const captchaFrame =
    "https://challenges.cloudflare.com https://newassets.hcaptcha.com";

  const common = [
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    "worker-src 'self'",
    "connect-src 'self' https: wss:",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ];

  if (process.env.NODE_ENV === "production") {
    return [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",
      "script-src-attr 'none'",
      `script-src-elem 'self' 'unsafe-inline' ${captchaScript}`,
      `frame-src 'self' ${captchaFrame}`,
      ...common,
    ].join("; ");
  }

  // Development: allow eval for fast-refresh ergonomics
  return [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline' 'unsafe-eval' ${captchaScript}`,
    "script-src-attr 'none'",
    `frame-src 'self' ${captchaFrame}`,
    ...common,
  ].join("; ");
}

function applySecurityHeaders(res: NextResponse) {
  res.headers.set("Content-Security-Policy", buildCSP());
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) {
    res.headers.set(k, v);
  }
  if (process.env.NODE_ENV === "production") {
    res.headers.set(
      "Strict-Transport-Security",
      "max-age=63072000; includeSubDomains; preload"
    );
  }
  return res;
}

function withCorrelation(res: NextResponse, req: NextRequest) {
  const incoming =
    req.headers.get("x-correlation-id") || req.headers.get("x-request-id");
  const id =
    incoming ||
    (typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `corr-${Date.now().toString(36)}`);
  res.headers.set("x-correlation-id", id);
  return res;
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Always allow health checks (load balancers / uptime)
  if (pathname === "/api/health" || pathname.startsWith("/api/health/")) {
    const res = NextResponse.next();
    return withCorrelation(applySecurityHeaders(res), request);
  }

  // Login guard is public (abuse controls before auth)
  if (pathname.startsWith("/api/auth/login-guard")) {
    const res = NextResponse.next();
    return withCorrelation(applySecurityHeaders(res), request);
  }

  // Rate limit API routes (per IP; Upstash-backed when configured)
  if (pathname.startsWith("/api/") && !isApiRateLimitExempt(pathname)) {
    const ip = getClientIpFromHeaders(request.headers);
    // Multi-instance production: set RATE_LIMIT_REQUIRE_REDIS=true (or
    // RATE_LIMIT_FAIL_CLOSED=true) so missing Upstash cannot silently bypass limits.
    const redisRequired = process.env.RATE_LIMIT_REQUIRE_REDIS === "true";
    const result = await rateLimitRequest(
      `mw:${ip}`,
      apiRateLimitMax(request),
      WINDOW_MS,
      {
        failClosed:
          process.env.RATE_LIMIT_FAIL_CLOSED === "true" ||
          (process.env.NODE_ENV === "production" && redisRequired),
      }
    );
    if (!result.allowed) {
      const rateLimitResponse = NextResponse.json(
        { error: "Too many requests" },
        { status: 429 }
      );
      rateLimitResponse.headers.set(
        "Retry-After",
        String(Math.max(1, result.retryAfterSec))
      );
      return withCorrelation(applySecurityHeaders(rateLimitResponse), request);
    }
  }
  try {
    const { supabaseResponse, user } = await updateSession(request);

    const isAuthRoute =
      pathname.startsWith("/login") || pathname.startsWith("/register");
    // MFA step-up requires an existing session (AAL1); not public, not auth bounce
    const isMfaRoute = pathname === "/mfa" || pathname.startsWith("/mfa/");
    // Device machine webhooks authenticate via push token in the route handler
    const isPublicRoute =
      pathname === "/" ||
      pathname.startsWith("/verify") ||
      pathname.startsWith("/careers") ||
      pathname.startsWith("/register") ||
      pathname.startsWith("/portal") ||
      pathname.startsWith("/api/public") ||
      pathname.startsWith("/forgot-password") ||
      pathname.startsWith("/reset-password") ||
      pathname.startsWith("/api/health") ||
      // Pre-auth employee-ID/username resolver (rate-limited in route)
      pathname.startsWith("/api/auth/resolve-identifier") ||
      pathname.startsWith("/api/attendance/devices") ||
      // Slack Events API (signature verified in route)
      pathname === "/api/v2/integrations/slack/events" ||
      // Public marketing site (enterprise landing experience)
      pathname === "/solutions" || pathname.startsWith("/solutions/") ||
      pathname === "/industries" || pathname.startsWith("/industries/") ||
      pathname === "/modules" || pathname.startsWith("/modules/") ||
      pathname === "/ai-platform" || pathname.startsWith("/ai-platform/") ||
      pathname === "/security" || pathname.startsWith("/security/") ||
      pathname === "/pricing" || pathname.startsWith("/pricing/") ||
      pathname === "/customers" || pathname.startsWith("/customers/") ||
      pathname === "/resources" || pathname.startsWith("/resources/") ||
      pathname === "/contact" || pathname.startsWith("/contact/") ||
      pathname === "/partners" || pathname.startsWith("/partners/") ||
      pathname === "/developers" || pathname.startsWith("/developers/") ||
      pathname === "/company" || pathname.startsWith("/company/") ||
      pathname === "/legal" || pathname.startsWith("/legal/") ||
      pathname === "/sitemap.xml" || pathname === "/robots.txt";

    if (!user && !isAuthRoute && !isPublicRoute && !isMfaRoute) {
      if (pathname.startsWith("/api/")) {
        return withCorrelation(
          applySecurityHeaders(
            NextResponse.json(
              {
                ok: false,
                error: { code: "UNAUTHORIZED", message: "Sign in required" },
              },
              { status: 401 }
            )
          ),
          request
        );
      }
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      // Only store safe relative paths for next=
      const safeNext =
        pathname.startsWith("/") &&
        !pathname.startsWith("//") &&
        !pathname.includes("://")
          ? pathname
          : "/dashboard";
      url.searchParams.set("next", safeNext);
      return withCorrelation(
        applySecurityHeaders(NextResponse.redirect(url)),
        request
      );
    }

    if (user && isAuthRoute) {
      // Allow platform admins to open /register for provisioning without bounce
      if (pathname.startsWith("/register")) {
        return withCorrelation(applySecurityHeaders(supabaseResponse), request);
      }
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard";
      return withCorrelation(
        applySecurityHeaders(NextResponse.redirect(url)),
        request
      );
    }

    // MFA page requires a session
    if (isMfaRoute && !user) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      return withCorrelation(
        applySecurityHeaders(NextResponse.redirect(url)),
        request
      );
    }

    applySecurityHeaders(supabaseResponse);
    return withCorrelation(supabaseResponse, request);
  } catch (error) {
    // Fail CLOSED — never allow dashboard access if session pipeline breaks
    console.error("Middleware failed:", error);
    if (pathname.startsWith("/api/")) {
      return applySecurityHeaders(
        NextResponse.json(
          { ok: false, error: { code: "INTERNAL", message: "Middleware failure" } },
          { status: 500 }
        )
      );
    }
    if (
      pathname === "/" ||
      pathname.startsWith("/verify") ||
      pathname.startsWith("/careers") ||
      pathname.startsWith("/portal") ||
      pathname.startsWith("/login") ||
      pathname.startsWith("/register") ||
      pathname.startsWith("/forgot-password") ||
      pathname.startsWith("/reset-password") ||
      pathname.startsWith("/solutions") ||
      pathname.startsWith("/industries") ||
      pathname.startsWith("/modules") ||
      pathname.startsWith("/ai-platform") ||
      pathname.startsWith("/security") ||
      pathname.startsWith("/pricing") ||
      pathname.startsWith("/customers") ||
      pathname.startsWith("/resources") ||
      pathname.startsWith("/contact") ||
      pathname.startsWith("/partners") ||
      pathname.startsWith("/developers") ||
      pathname.startsWith("/company") ||
      pathname.startsWith("/legal") ||
      pathname === "/sitemap.xml" || pathname === "/robots.txt"
    ) {
      return applySecurityHeaders(NextResponse.next({ request }));
    }
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("error", "session");
    return applySecurityHeaders(NextResponse.redirect(url));
  }
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.json|.*\\.(?:svg|png|jpg|jpeg|gif|webp|woff2?|ttf|otf|eot)$).*)",
  ],
};
