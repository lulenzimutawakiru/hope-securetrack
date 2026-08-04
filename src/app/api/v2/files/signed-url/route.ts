/**
 * Signed storage URL gateway for browser crud-compat shims.
 *
 *   POST /api/v2/files/signed-url   body: { bucket, path, expiresIn }
 *
 * Bucket is whitelisted server-side; path is never trusted as an identity
 * field and the signed URL is minted against the authenticated session.
 */

import { z } from "zod";
import { createApiHandler } from "@/lib/api/handler";
import { apiError, apiOk } from "@/lib/api";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ALLOWED_BUCKETS = new Set(["attachments"]);

const SCHEMA = z.object({
  bucket: z.string().min(1).max(80),
  path: z.string().min(1).max(1024),
  expiresIn: z.number().int().min(60).max(86_400).default(3600),
});

export const POST = createApiHandler(
  {
    auth: true,
    permissions: ["dashboard.view"],
    allowPlatformAdmin: true,
    rateLimit: { limit: 120, windowMs: 60_000 },
    module: "v2.files",
    bodySchema: SCHEMA,
  },
  async ({ ctx, body }) => {
    if (!ctx) return apiError("UNAUTHORIZED", "Sign in required", 401);
    if (!ALLOWED_BUCKETS.has(body.bucket)) {
      return apiError(
        "FORBIDDEN",
        `Bucket "${body.bucket}" is not permitted`,
        403
      );
    }
    const supabase = await createClient();
    const { data, error } = await supabase.storage
      .from(body.bucket)
      .createSignedUrl(body.path, body.expiresIn);
    if (error || !data) {
      return apiError(
        "INTERNAL",
        `Signed URL failed: ${error?.message ?? "unknown"}`,
        500
      );
    }
    return apiOk({ signedUrl: data.signedUrl });
  }
);