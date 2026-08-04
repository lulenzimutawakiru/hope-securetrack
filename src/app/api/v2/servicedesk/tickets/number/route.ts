/**
 * POST-only ticket numbering API.
 *
 *   POST /api/v2/servicedesk/tickets/number
 *
 * Returns the next ticket number for the authenticated company WITHOUT
 * consuming the sequence (preview_support_ticket_number RPC). Integrators
 * can show a number before a real ticket is created; the create path
 * (next_support_ticket_number) remains the single source of truth and is
 * never bypassed by this endpoint.
 */

import { createApiHandler } from "@/lib/api/handler";
import { apiError, apiOk } from "@/lib/api";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const POST = createApiHandler(
  {
    auth: true,
    permissions: ["sd.agent", "sd.manage"],
    allowPlatformAdmin: true,
    rateLimit: { limit: 60, windowMs: 60_000 },
    module: "servicedesk",
  },
  async ({ ctx }) => {
    if (!ctx) return apiError("UNAUTHORIZED", "Sign in required", 401);

    const supabase = await createClient();
    const { data, error } = await supabase.rpc(
      "preview_support_ticket_number",
      { p_company_id: ctx.companyId }
    );
    if (error) {
      return apiError(
        "INTERNAL",
        `Failed to preview ticket number: ${error.message}`,
        500
      );
    }
    return apiOk({ ticket_number: String(data) });
  }
);