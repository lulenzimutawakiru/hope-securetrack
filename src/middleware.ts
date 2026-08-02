import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import createMiddleware from "next-intl/middleware";

const intlMiddleware = createMiddleware({
  locales: ["en"],
  defaultLocale: "en",
  localePrefix: "never",
});

const SECURITY_HEADERS: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(self)",
  "Cross-Origin-Opener-Policy": "same-origin",
  "X-DNS-Prefetch-Control": "off",
};

// In-memory rate limiter (replace with Upstash/Redis for production)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const MAX_REQUESTS = parseInt(
  process.env.RATE_LIMIT_API ?? process.env.RATE_LIMIT_MAX ?? "30",
  10
);
const WINDOW_MS = 60_000;

function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  const realIp = req.headers.get("x-real-ip");
  if (realIp) {
    return realIp.trim();
  }
  return "127.0.0.1";
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

/**
 * Forward headers from the Supabase session response (notably refreshed
 * auth Set-Cookie headers) onto the base response. The base response is the
 * next-intl response so that the x-next-intl-locale header it attaches to the
 * forwarded request keeps getMessages()/useTranslations() working.
 */
function mergeResponseHeaders(target: Headers, source: Headers) {
  const sourceWithGetSetCookie = source as Headers & {
    getSetCookie?: () => string[];
  };
  const setCookies = sourceWithGetSetCookie.getSetCookie
    ? sourceWithGetSetCookie.getSetCookie()
    : [];

  for (const [key, value] of source.entries()) {
    if (key.toLowerCase() === "set-cookie") {
      continue;
    }
    if (!target.has(key)) {
      target.set(key, value);
    }
  }

  for (const cookie of setCookies) {
    target.append("set-cookie", cookie);
  }
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

  // Rate limit API routes (per IP, in-memory)
  if (pathname.startsWith("/api/")) {
    const ip = getClientIp(request);
    const now = Date.now();

    let entry = rateLimitMap.get(ip);
    if (!entry || entry.resetTime <= now) {
      entry = { count: 1, resetTime: now + WINDOW_MS };
    } else {
      entry.count += 1;
    }

    if (entry.count > MAX_REQUESTS) {
      const rateLimitResponse = NextResponse.json(
        { error: "Too many requests" },
        { status: 429 }
      );
      return withCorrelation(applySecurityHeaders(rateLimitResponse), request);
    }

    rateLimitMap.set(ip, entry);

    // Periodic cleanup (probabilistic)
    if (Math.random() < 0.01) {
      for (const [key, val] of rateLimitMap.entries()) {
        if (val.resetTime <= now) {
          rateLimitMap.delete(key);
        }
      }
    }
  }

  // Locale routing for page routes. En-only with localePrefix 'never' keeps
  // all existing URLs untouched while providing the x-next-intl-locale header
  // that next-intl server APIs (getMessages, useTranslations) require.
  const intlResponse = pathname.startsWith("/api/")
    ? null
    : intlMiddleware(request);

  // Honor any locale redirect (should not occur with localePrefix: 'never')
  if (
    intlResponse &&
    intlResponse.status >= 300 &&
    intlResponse.status < 400
  ) {
    return withCorrelation(applySecurityHeaders(intlResponse), request);
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
        const registerResponse = intlResponse ?? supabaseResponse;
        if (intlResponse) {
          mergeResponseHeaders(registerResponse.headers, supabaseResponse.headers);
        }
        return withCorrelation(applySecurityHeaders(registerResponse), request);
      }
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard";
      return withCorrelation(
        applySecurityHeaders(NextResponse.redirect(url)),
        request
      );
    }

    // Base response: keep the intl response so the locale header reaches RSC;
    // otherwise fall back to the Supabase session response.
    const response = intlResponse ?? supabaseResponse;
    if (intlResponse) {
      mergeResponseHeaders(response.headers, supabaseResponse.headers);
    }

    applySecurityHeaders(response);
    return withCorrelation(response, request);
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
