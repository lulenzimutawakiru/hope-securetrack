/**
 * Shared-secret webhook ingestion for external service desk sources
 * (email and WhatsApp). Used ONLY by the webhook routes below; the
 * session-authenticated portal path goes through the inbound API.
 *
 * Security model:
 *   - Shared secret via x-webhook-secret / Authorization Bearer
 *     (SD_WEBHOOK_SECRET or JOB_WORKER_SECRET), compared in constant time.
 *   - Company is resolved server-side from the x-company-id header and is
 *     never trusted from the body.
 *   - Admin (service role) client is used because there is no user session;
 *     RLS is bypassed deliberately and scoped to the resolved company.
 *   - Distributed rate limiting via ingressRateLimit.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { apiError, apiOk } from "@/lib/api";
import { timingSafeEqualString } from "@/lib/security/shared";
import { ingressRateLimit } from "@/lib/security/public-ingress";
import { ingestInbound } from "./ingest";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const webhookBodySchema = z.object({
  external_id: z.string().max(120).optional().nullable(),
  from_address: z.string().max(255).optional().nullable(),
  subject: z.string().min(1).max(500),
  body: z.string().max(100_000).optional().nullable(),
  category: z.string().max(120).optional(),
  service_type: z.string().max(80).optional(),
  ticket_type: z.string().max(40).optional(),
  priority: z.enum(["critical", "high", "medium", "low"]).optional(),
  /** Email / WhatsApp sources convert to tickets by default. */
  auto_convert: z.boolean().optional().default(true),
  metadata: z.record(z.unknown()).optional(),
});

export async function handleServiceDeskWebhook(
  req: NextRequest,
  source: "email" | "whatsapp"
): Promise<NextResponse> {
  const rateBucket =
    source === "email" ? "sd-email-webhook" : "sd-whatsapp-webhook";

  try {
    const rl = await ingressRateLimit(rateBucket, 60, 60_000, req);
    if (!rl.ok) {
      return NextResponse.json(
        { ok: false, error: { code: "RATE_LIMIT", message: "Rate limit exceeded" } },
        { status: 429, headers: rl.response.headers }
      );
    }

    const secret =
      process.env.SD_WEBHOOK_SECRET?.trim() ||
      process.env.JOB_WORKER_SECRET?.trim();
    if (!secret) {
      return apiError(
        "CONFIG",
        "Service desk webhook not configured (SD_WEBHOOK_SECRET)",
        503
      );
    }

    // Header-only secret, never query strings.
    const provided =
      req.headers.get("x-webhook-secret") ||
      req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
      "";
    if (!provided || !timingSafeEqualString(provided, secret)) {
      return apiError("UNAUTHORIZED", "Invalid webhook secret", 401);
    }

    const companyHeader = req.headers.get("x-company-id")?.trim() || "";
    if (!UUID_RE.test(companyHeader)) {
      return apiError("VALIDATION", "Valid x-company-id header required", 400);
    }

    let raw: unknown;
    try {
      raw = await req.json();
    } catch {
      return apiError("VALIDATION", "Invalid JSON", 400);
    }
    const parsed = webhookBodySchema.safeParse(raw);
    if (!parsed.success) {
      return apiError(
        "VALIDATION",
        parsed.error.issues.map((i) => i.message).join("; "),
        400
      );
    }

    const adminSb = createAdminClient();
    const { data: company, error: companyError } = await adminSb
      .from("companies")
      .select("id, tenant_id")
      .eq("id", companyHeader)
      .eq("is_active", true)
      .maybeSingle();
    if (companyError || !company) {
      return apiError("NOT_FOUND", "Unknown or inactive company", 404);
    }

    const result = await ingestInbound(
      adminSb,
      {
        companyId: company.id,
        tenantId: company.tenant_id || null,
        actorName:
          source === "email" ? "Webhook: email" : "Webhook: whatsapp",
      },
      { ...parsed.data, source }
    );

    return apiOk({
      item: result.item,
      duplicate: result.duplicate,
      auto_created: result.auto_created,
      ticket: result.ticket,
    });
  } catch (e) {
    return apiError(
      "INTERNAL",
      e instanceof Error ? e.message : "Webhook processing failed",
      500
    );
  }
}