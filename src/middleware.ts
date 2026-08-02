import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import createMiddleware from "next-intl/middleware";

const intlMiddleware = createMiddleware({
  locales: ["en"],
  defaultLocale: "en",
});

// Simple in‑memory rate limiter (replace with Redis for production)
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
  return req.ip ?? "127.0.0.1";
}

export function middleware(req: NextRequest) {
  // Rate limit only API routes
  if (req.nextUrl.pathname.startsWith("/api/")) {
    const ip = getClientIp(req);
    const now = Date.now();

    let entry = rateLimitMap.get(ip);
    if (!entry || entry.resetTime <= now) {
      entry = { count: 1, resetTime: now + WINDOW_MS };
    } else {
      entry.count += 1;
    }

    if (entry.count > MAX_REQUESTS) {
      return NextResponse.json(
        { error: "Too many requests" },
        { status: 429 }
      );
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

    return NextResponse.next();
  }

  // Delegate all other routes to next‑intl for locale handling
  return intlMiddleware(req);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
