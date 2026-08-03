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

// Build a stricter CSP in production (no 'unsafe-inline'); allow relaxed CSP in non-production to avoid dev breakage
function buildCSP() {
  const base = [
    "default-src 'self'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    "connect-src 'self' https: wss:",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ];

  if (process.env.NODE_ENV === 'production') {
    // Production: no inline scripts/styles allowed — if inline runtime scripts are required, move them to external files
    return [
      ...base.slice(0, 1), // keep default-src first
      "script-src 'self'",
      "style-src 'self'",
      ...base.slice(1),
    ].join('; ');
  }

  // Development: allow some inline usage for developer ergonomics
  return [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    "connect-src 'self' https: wss:",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ].join('; ');
}

function applySecurityHeaders(res: NextResponse) {
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
    const result = await rateLimitRequest(
      `mw:${ip}`,
      apiRateLimitMax(request),
      WINDOW_MS,
      {
        failClosed:
          process.env.RATE_LIMIT_FAIL_CLOSED === "true" ||
          (process.env.NODE_ENV === "production" &&
            process.env.RATE_LIMIT_REQUIRE_REDIS === "true"),
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
    // Device machine webhooks authenticate via push token in the route handler
    const isPublicRoute =
      pathname === "/" ||
      pathname.startsWith("/verify") ||
      pathname.startsWith("/careers") ||
      pathname.startsWith("/register") ||
      pathname.startsWith("/portal") ||
      pathname.startsWith("/api/public") ||
      pathname.startsWith("/api/health") ||
      pathname.startsWith("/api/attendance/devices");

    if (!user && !isAuthRoute && !isPublicRoute) {
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
      pathname.startsWith("/register")
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
    "/((?!_next/static|_next/image|favicon.ico|manifest.json|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
