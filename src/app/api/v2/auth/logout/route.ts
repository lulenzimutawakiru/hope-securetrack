/**
 * POST /api/v2/auth/logout
 *
 * Clears the Supabase session cookies so the browser crud-compat shim's
 * signOut() behaves like the real auth client.
 */

import { cookies } from "next/headers";
import { createApiHandler } from "@/lib/api/handler";
import { apiOk } from "@/lib/api";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const POST = createApiHandler(
  {
    module: "auth.logout",
  },
  async () => {
    const cookieStore = await cookies();
    const names = cookieStore
      .getAll()
      .map((c) => c.name)
      .filter((n) => n.startsWith("sb-") && n.endsWith("-auth-token"));
    for (const name of names) {
      cookieStore.set(name, "", { maxAge: 0, path: "/" });
    }
    return apiOk({ signedOut: true });
  }
);
