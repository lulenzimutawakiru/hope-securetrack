import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Simple in‑memory rate limiter (replace with Redis for production)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const MAX_REQUESTS = parseInt(process.env.RATE_LIMIT_MAX ?? "30", 10); // per window
const WINDOW_MS = 60_000; // 1 minute

function getClientIp(req: NextRequest): string {
  // Prefer x‑forwarded‑for if behind a proxy
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  // Fallback to remote address
  return req.ip ?? "127.0.0.1";
}

export function middleware(req: NextRequest) {
  // Only apply rate limiting to API routes
  if (req.nextUrl.pathname.startsWith("/api/")) {
    const ip = getClientIp(req);
    const now = Date.now();

    const entry = rateLimitMap.get(ip) ?? { count: 0, resetTime: now + WINDOW_MS };

    if (entry.resetTime <= now) {
      entry.count = 1;
      entry.resetTime = now + WINDOW_MS;
      rateLimitMap.set(ip, entry);
    } else {
      entry.count += 1;
      rateLimitMap.set(ip, entry);

      if (entry.count > MAX_REQUESTS) {
        return NextResponse.json(
          { error: "Too many requests" },
          { status: 429 }
        );
      }
    }

    // Cleanup old entries every 100 requests (simple GC)
    if (Math.random() < 0.01) {
      for (const [key, val] of rateLimitMap.entries()) {
        if (val.resetTime <= now) {
          rateLimitMap.delete(key);
        }
      }
    }
  }

  // Add basic security headers even for non‑API routes
  const response = NextResponse.next();
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=()"
  );
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
