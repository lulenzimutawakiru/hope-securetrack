import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { User } from "@supabase/supabase-js";

export async function updateSession(request: NextRequest): Promise<{
  supabaseResponse: NextResponse;
  user: User | null;
}> {
  let supabaseResponse = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Missing env vars must not crash middleware on Vercel
  if (!url || !anonKey) {
    console.error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY"
    );
    return { supabaseResponse, user: null };
  }

  try {
    const supabase = createServerClient(url, anonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(
          cookiesToSet: {
            name: string;
            value: string;
            options?: Record<string, unknown>;
          }[]
        ) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    });

    const {
      data: { user },
    } = await supabase.auth.getUser();

    return { supabaseResponse, user };
  } catch (error) {
    console.error("Supabase middleware session error:", error);
    return { supabaseResponse: NextResponse.next({ request }), user: null };
  }
}
