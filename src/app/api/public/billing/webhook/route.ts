import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { completePaymentIntent } from "@/lib/billing/gateway";
import { timingSafeEqualString } from "@/lib/security/shared";
import { ingressRateLimit } from "@/lib/security/public-ingress";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const bodySchema = z.object({
  external_ref: z.string().min(1).max(200).optional(),
  reference: z.string().min(1).max(200).optional(),
  status: z.string().max(40).optional(),
});

/**
 * Gateway webhook settlement endpoint.
 * Requires header X-Webhook-Secret matching BILLING_WEBHOOK_SECRET.
 * Body: { external_ref, status?: "succeeded"|"failed" }
 */
export async function POST(req: NextRequest) {
  try {
    const rl = await ingressRateLimit("billing-webhook", 120, 60_000, req);
    if (!rl.ok) {
      return NextResponse.json(
        { error: "Rate limit" },
        { status: 429, headers: rl.response.headers }
      );
    }

    const secret = process.env.BILLING_WEBHOOK_SECRET?.trim();
    if (!secret) {
      return NextResponse.json(
        { error: "Webhook not configured" },
        { status: 503 }
      );
    }

    // Header-only secret — never accept query-string secrets for webhooks.
    const provided =
      req.headers.get("x-webhook-secret") ||
      req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
      "";

    if (!provided || !timingSafeEqualString(provided, secret)) {
      return NextResponse.json({ error: "Invalid webhook secret" }, { status: 401 });
    }

    let raw: unknown;
    try {
      raw = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }
    const parsed = bodySchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ error: "Validation failed" }, { status: 400 });
    }

    const externalRef = String(
      parsed.data.external_ref || parsed.data.reference || ""
    ).trim();
    if (!externalRef) {
      return NextResponse.json({ error: "external_ref required" }, { status: 400 });
    }

    const sb = createAdminClient();
    const status = String(parsed.data.status || "succeeded").toLowerCase();

    if (status === "failed") {
      await completePaymentIntent(sb, externalRef, {
        force_fail: true,
        webhookVerified: true,
        serviceTrusted: true,
      });
      return NextResponse.json({ ok: true, status: "failed" });
    }

    const data = await completePaymentIntent(sb, externalRef, {
      webhookVerified: true,
      serviceTrusted: true,
      actor_id: null,
    });

    return NextResponse.json({
      ok: true,
      status: data?.status || "succeeded",
      external_ref: externalRef,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Webhook failed" },
      { status: 500 }
    );
  }
}
