import { NextRequest } from "next/server";
import { z } from "zod";
import { requireApiAuth } from "@/lib/security/api-auth";
import { apiError, apiOk, parseJson, clientIp, rateLimitStrict } from "@/lib/api";
import { createClient } from "@/lib/supabase/server";
import { generateSecureToken, hashToken } from "@/lib/security/tokens";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const createSchema = z.object({
  customer_id: z.string().uuid(),
  email: z.string().email().optional().nullable(),
  full_name: z.string().max(200).optional().nullable(),
});

/**
 * Create customer portal access with hashed token.
 * Returns plaintext token once for admin to copy — never stored as sole secret long-term.
 */
export async function POST(req: NextRequest) {
  // Authenticated company users may issue portal access (RLS scopes writes).
  const auth = await requireApiAuth({ allowPlatformAdmin: true });
  if ("response" in auth) return auth.response;

  const ip = clientIp(req);
  const rl = await rateLimitStrict(`portal-user-create:${auth.ctx.user.id}:${ip}`, 20, 60_000);
  if (!rl.allowed) return apiError("RATE_LIMIT", "Rate limit exceeded", 429);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("VALIDATION", "Invalid JSON");
  }

  const parsed = parseJson(createSchema, body);
  if (!parsed.success) return apiError("VALIDATION", parsed.error);

  const token = generateSecureToken(32);
  const tokenHash = await hashToken(token);
  const supabase = await createClient();

  const email =
    parsed.data.email ||
    `portal-${token.slice(0, 8)}@customer.local`;

  const { data, error } = await supabase
    .from("bill_portal_users")
    .insert({
      company_id: auth.ctx.companyId,
      customer_id: parsed.data.customer_id,
      email,
      full_name: parsed.data.full_name || null,
      // Keep plaintext only during migration for legacy links; prefer hash
      access_token: token,
      access_token_hash: tokenHash,
      is_active: true,
    })
    .select("id,customer_id,email,full_name,is_active,created_at")
    .single();

  if (error) {
    return apiError("INTERNAL", error.message, 500);
  }

  return apiOk({
    user: data,
    /** Shown once — copy to customer; not returned on subsequent GETs */
    access_token: token,
    portal_path: `/portal/${token}`,
  });
}
