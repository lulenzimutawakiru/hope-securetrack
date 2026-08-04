/**
 * External providers status + test actions.
 * GET  — configuration matrix
 * POST — run a sandbox/live test (sms, whatsapp, payment, map, captcha, ocr)
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { createApiHandler } from "@/lib/api/handler";
import { apiError, apiOk } from "@/lib/api";
import { getProvidersSummary } from "@/lib/providers/status";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const testSchema = z.object({
  action: z.enum([
    "status",
    "sms",
    "whatsapp",
    "push",
    "payment",
    "geocode",
    "directions",
    "captcha",
    "ocr",
    "qstash",
  ]),
  to: z.string().max(40).optional(),
  message: z.string().max(500).optional(),
  gateway: z.string().max(40).optional(),
  amount: z.number().positive().optional(),
  currency: z.string().max(10).optional(),
  query: z.string().max(200).optional(),
  captcha_token: z.string().max(2000).optional(),
  origin: z.tuple([z.number(), z.number()]).optional(),
  destination: z.tuple([z.number(), z.number()]).optional(),
});

export const GET = createApiHandler(
  {
    auth: true,
    permissions: ["intg.view", "intg.manage", "settings.integrations"],
    module: "integrations",
    rateLimit: { limit: 60, windowMs: 60_000 },
  },
  async ({ ctx }) => {
    const summary = getProvidersSummary();
    let recent: unknown[] = [];
    try {
      const admin = createAdminClient();
      const { data } = await admin
        .from("intg_provider_calls")
        .select(
          "id, provider, category, operation, success, sandbox, error_message, created_at"
        )
        .eq("company_id", ctx!.companyId)
        .order("created_at", { ascending: false })
        .limit(20);
      recent = data || [];
    } catch {
      /* table may not be migrated yet */
    }
    return apiOk({
      ...summary,
      company_id: ctx!.companyId,
      recent_calls: recent,
      webhook_paths: {
        generic: "/api/public/billing/webhooks/generic",
        mtn_momo: "/api/public/billing/webhooks/mtn-momo",
        flutterwave: "/api/public/billing/webhooks/flutterwave",
        stripe: "/api/public/billing/webhooks/stripe",
        pesapal: "/api/public/billing/webhooks/pesapal",
        whatsapp: "/api/public/webhooks/whatsapp",
      },
    });
  }
);

export const POST = createApiHandler(
  {
    auth: true,
    permissions: ["intg.manage", "settings.integrations"],
    module: "integrations",
    bodySchema: testSchema,
    rateLimit: { limit: 20, windowMs: 60_000 },
    idempotent: true,
  },
  async ({ ctx, body }) => {
    const input = body as z.infer<typeof testSchema>;
    const companyId = ctx!.companyId;
    const started = Date.now();

    async function logCall(
      provider: string,
      category: string,
      operation: string,
      result: {
        ok: boolean;
        sandbox?: boolean;
        error?: string;
        externalId?: string;
        status?: number;
      }
    ) {
      try {
        const admin = createAdminClient();
        await admin.from("intg_provider_calls").insert({
          company_id: companyId,
          provider,
          category,
          operation,
          success: result.ok,
          sandbox: Boolean(result.sandbox),
          http_status: result.status ?? null,
          external_id: result.externalId ?? null,
          error_message: result.error ?? null,
          duration_ms: Date.now() - started,
          created_by: ctx!.profile.id,
        });
      } catch {
        /* non-fatal */
      }
    }

    if (input.action === "status") {
      return apiOk(getProvidersSummary());
    }

    if (input.action === "sms") {
      const { sendSms } = await import("@/lib/providers/comms/africastalking");
      const r = await sendSms({
        to: input.to || "+256700000000",
        message: input.message || "SecureTrack SMS test",
        companyId,
      });
      await logCall("africastalking", "comms", "sms", r);
      return r.ok ? apiOk(r) : apiError("INTERNAL", r.error || "SMS failed", 502);
    }

    if (input.action === "whatsapp") {
      const { sendWhatsApp } = await import("@/lib/providers/comms/whatsapp");
      const r = await sendWhatsApp({
        to: input.to || "256700000000",
        message: input.message || "SecureTrack WhatsApp test",
        companyId,
      });
      await logCall("whatsapp", "comms", "send", r);
      return r.ok
        ? apiOk(r)
        : apiError("INTERNAL", r.error || "WhatsApp failed", 502);
    }

    if (input.action === "push") {
      const { sendPush } = await import("@/lib/providers/comms/push");
      const r = await sendPush({
        title: "SecureTrack test",
        body: input.message || "Push integration test",
        companyId,
      });
      await logCall(String(r.provider), "comms", "push", r);
      return r.ok ? apiOk(r) : apiError("INTERNAL", r.error || "Push failed", 502);
    }

    if (input.action === "payment") {
      const { collectPayment } = await import(
        "@/lib/providers/payments/router"
      );
      const r = await collectPayment(input.gateway || "MTN", {
        companyId,
        amount: input.amount || 1000,
        currency: input.currency || "UGX",
        externalRef: `TEST-${Date.now().toString(36).toUpperCase()}`,
        phone: input.to,
        description: "SecureTrack provider test",
      });
      await logCall(String(r.provider), "payments", "collect", r);
      return r.ok
        ? apiOk(r)
        : apiError("INTERNAL", r.error || "Payment init failed", 502);
    }

    if (input.action === "geocode") {
      const { mapboxGeocode } = await import("@/lib/providers/maps/mapbox");
      const r = await mapboxGeocode({
        query: input.query || "Kampala",
        country: "ug",
      });
      await logCall("mapbox", "maps", "geocode", r);
      return r.ok
        ? apiOk(r)
        : apiError("INTERNAL", r.error || "Geocode failed", 502);
    }

    if (input.action === "directions") {
      const { mapboxDirections } = await import("@/lib/providers/maps/mapbox");
      const r = await mapboxDirections({
        origin: input.origin || [32.58, 0.35],
        destination: input.destination || [32.6, 0.32],
      });
      await logCall("mapbox", "maps", "directions", r);
      return r.ok
        ? apiOk(r)
        : apiError("INTERNAL", r.error || "Directions failed", 502);
    }

    if (input.action === "captcha") {
      const { verifyCaptcha } = await import(
        "@/lib/providers/security/captcha"
      );
      const r = await verifyCaptcha({
        token: input.captcha_token || "dev-bypass",
      });
      await logCall("turnstile", "security", "verify", r);
      return r.ok
        ? apiOk(r)
        : apiError("INTERNAL", r.error || "Captcha failed", 400);
    }

    if (input.action === "ocr") {
      const { extractDocument } = await import("@/lib/providers/docs/ocr");
      const r = await extractDocument({ companyId });
      await logCall("document_ai", "docs", "extract", r);
      return r.ok
        ? apiOk(r)
        : apiError("INTERNAL", r.error || "OCR failed", 502);
    }

    if (input.action === "qstash") {
      const { scheduleWorkerPing } = await import(
        "@/lib/providers/queue/qstash"
      );
      const r = await scheduleWorkerPing();
      await logCall("qstash", "jobs", "publish", {
        ok: r.ok || r.data?.mode === "local",
        error: r.error,
        externalId: r.externalId,
      });
      return apiOk(r);
    }

    return apiError("VALIDATION", "Unknown action", 400);
  }
);
