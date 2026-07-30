import { NextRequest } from "next/server";
import { z } from "zod";
import { requireApiAuth } from "@/lib/security/api-auth";
import { assertDualControl } from "@/lib/security/dual-control";
import {
  apiError,
  apiOk,
  clientIp,
  parseJson,
  rateLimitStrict,
} from "@/lib/api";
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
export async function POST(req: NextRequest) {
  const auth = await requireApiAuth({
    permissions: [
      "finance.post",
      "finance.manage",
      "finance.admin",
      "finance.approve",
    ],
    allowPlatformAdmin: true,
    requireMfa: "privileged",
  });
  if ("response" in auth) return auth.response;

  const ip = clientIp(req);
  const rl = await rateLimitStrict(
    `finance-post:${auth.ctx.user.id}:${ip}`,
    30,
    60_000
  );
  if (!rl.allowed) return apiError("RATE_LIMIT", "Rate limit exceeded", 429);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("VALIDATION", "Invalid JSON");
  }
  const parsed = parseJson(schema, body);
  if (!parsed.success) return apiError("VALIDATION", parsed.error);

  const dc = await assertDualControl({
    company_id: auth.ctx.companyId,
    action: "finance.gl_post",
    actor_id: auth.ctx.user.id,
    request_id: parsed.data.dual_control_id,
  });
  if (!dc.ok) return apiError("FORBIDDEN", dc.error, 403);

  try {
    const sb = await createClient();
    const row = await postAccountingEvent(
      {
        companyId: auth.ctx.companyId,
        eventType: parsed.data.event_type as AccountingEventType,
        sourceModule: parsed.data.source_module,
        sourceRef: parsed.data.source_ref,
        amount: parsed.data.amount,
        currency: parsed.data.currency,
        description: parsed.data.description,
        actorId: auth.ctx.user.id,
        metadata: parsed.data.metadata,
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
