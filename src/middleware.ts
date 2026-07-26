import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Always allow health checks (load balancers / uptime)
  if (pathname === "/api/health" || pathname.startsWith("/api/health/")) {
    return NextResponse.next();
  }

  try {
    const { supabaseResponse, user } = await updateSession(request);

    const isAuthRoute = pathname.startsWith("/login");
    const isPublicRoute =
      pathname === "/" ||
      pathname.startsWith("/verify") ||
      pathname.startsWith("/api/public") ||
      pathname.startsWith("/api/health");

    if (!user && !isAuthRoute && !isPublicRoute) {
      // API routes return 401 JSON instead of redirect
      if (pathname.startsWith("/api/")) {
        return NextResponse.json(
          { ok: false, error: { code: "UNAUTHORIZED", message: "Sign in required" } },
          { status: 401 }
        );
      }
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("next", pathname);
      return NextResponse.redirect(url);
    }

    if (user && isAuthRoute) {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard";
      return NextResponse.redirect(url);
    }

    // Security headers on app responses
    supabaseResponse.headers.set("X-Content-Type-Options", "nosniff");
    supabaseResponse.headers.set("X-Frame-Options", "DENY");
    supabaseResponse.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");

    return supabaseResponse;
  } catch (error) {
    console.error("Middleware failed:", error);
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { ok: false, error: { code: "INTERNAL", message: "Middleware failure" } },
        { status: 500 }
      );
    }
    return NextResponse.next({ request });
  }
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.json|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
