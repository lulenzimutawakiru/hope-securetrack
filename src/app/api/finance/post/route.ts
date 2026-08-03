import { z } from "zod";
import { apiError, apiOk, createApiHandler } from "@/lib/api/handler";
import { assertDualControl } from "@/lib/security/dual-control";
import {
  postAccountingEvent,
  type AccountingEventType,
} from "@/lib/finance/engine";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const schema = z.object({
  event_type: z.string().min(2).max(60),
  source_module: z.string().min(1).max(60),
  source_ref: z.string().min(1).max(120),
  amount: z.number().positive(),
  currency: z.string().max(8).optional(),
  description: z.string().max(500).optional(),
  dual_control_id: z.string().uuid().optional().nullable(),
  metadata: z.record(z.unknown()).optional(),
});

/** Server-side GL posting via accounting engine — dual-control when enabled */
export const POST = createApiHandler(
  {
    auth: true,
    permissions: [
      "finance.post",
      "finance.manage",
      "finance.admin",
      "finance.approve",
    ],
    allowPlatformAdmin: true,
    requireMfa: "privileged",
    bodySchema: schema,
    idempotent: true,
    rateLimit: { limit: 30, windowMs: 60_000 },
    module: "finance",
  },
  async ({ ctx, body }) => {
    if (!ctx) return apiError("UNAUTHORIZED", "Sign in required", 401);
    const data = body as z.infer<typeof schema>;

    const dc = await assertDualControl({
      company_id: ctx.companyId,
      action: "finance.gl_post",
      actor_id: ctx.user.id,
      request_id: data.dual_control_id,
    });
    if (!dc.ok) return apiError("FORBIDDEN", dc.error, 403);

    try {
      const sb = await createClient();
      const row = await postAccountingEvent(
        {
          companyId: ctx.companyId,
          eventType: data.event_type as AccountingEventType,
          sourceModule: data.source_module,
          sourceRef: data.source_ref,
          amount: data.amount,
          currency: data.currency,
          description: data.description,
          actorId: ctx.user.id,
          metadata: data.metadata,
        },
        sb
      );
      return apiOk({ journal: row });
    } catch (e) {
      return apiError(
        "INTERNAL",
        e instanceof Error ? e.message : "GL post failed",
        500
      );
    }
  }
);
