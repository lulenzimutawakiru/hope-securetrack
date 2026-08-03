import { z } from "zod";
import { apiError, apiOk, createApiHandler } from "@/lib/api/handler";
import { createClient } from "@/lib/supabase/server";
import { generateSecureToken, hashToken } from "@/lib/security/tokens";
import { storePlaintextSecrets } from "@/lib/security/public-ingress";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const createSchema = z.object({
  customer_id: z.string().uuid(),
  email: z.string().email().optional().nullable(),
  full_name: z.string().max(200).optional().nullable(),
});

/**
 * Create customer portal access with hashed token.
 * Returns plaintext token once for admin to copy.
 */
export const POST = createApiHandler(
  {
    auth: true,
    permissions: ["billing.manage", "billing.portal", "crm.manage"],
    allowPlatformAdmin: true,
    requireMfa: "privileged",
    bodySchema: createSchema,
    rateLimit: { limit: 20, windowMs: 60_000 },
    module: "billing",
  },
  async ({ ctx, body }) => {
    if (!ctx) return apiError("UNAUTHORIZED", "Sign in required", 401);
    const data = body as z.infer<typeof createSchema>;

    // Verify customer belongs to company
    const supabase = await createClient();
    const { data: customer, error: custErr } = await supabase
      .from("customers")
      .select("id")
      .eq("id", data.customer_id)
      .eq("company_id", ctx.companyId)
      .maybeSingle();
    if (custErr) return apiError("INTERNAL", custErr.message, 500);
    if (!customer) {
      return apiError("NOT_FOUND", "Customer not found in this company", 404);
    }

    const token = generateSecureToken(32);
    const tokenHash = await hashToken(token);

    const email =
      data.email || `portal-${token.slice(0, 8)}@customer.local`;

    const { data: user, error } = await supabase
      .from("bill_portal_users")
      .insert({
        company_id: ctx.companyId,
        customer_id: data.customer_id,
        email,
        full_name: data.full_name || null,
        // Production: hash-only at rest; plaintext returned once below
        access_token: storePlaintextSecrets() ? token : null,
        access_token_hash: tokenHash,
        is_active: true,
      })
      .select("id,customer_id,email,full_name,is_active,created_at")
      .single();

    if (error) return apiError("INTERNAL", error.message, 500);

    return apiOk({
      user,
      access_token: token,
      portal_path: `/portal/${token}`,
    });
  }
);
