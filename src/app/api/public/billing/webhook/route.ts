import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { completePaymentIntent } from "@/lib/billing/gateway";
import { clientIp, rateLimit } from "@/lib/api";
import { timingSafeEqualString } from "@/lib/security/shared";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Gateway webhook settlement endpoint.
 * Requires header X-Webhook-Secret matching BILLING_WEBHOOK_SECRET.
 * Body: { external_ref, status?: "succeeded"|"failed" }
 */
export async function POST(req: NextRequest) {
  try {
    const ip = clientIp(req);
    const rl = rateLimit(`billing-webhook:${ip}`, 120, 60_000);
    if (!rl.allowed) {
      return NextResponse.json({ error: "Rate limit" }, { status: 429 });
    }

    const secret = process.env.BILLING_WEBHOOK_SECRET?.trim();
    if (!secret) {
      return NextResponse.json(
        { error: "Webhook not configured" },
        { status: 503 }
      );
    }

    const provided =
      req.headers.get("x-webhook-secret") ||
      req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
      "";

    if (!timingSafeEqualString(provided, secret)) {
      return NextResponse.json({ error: "Invalid webhook secret" }, { status: 401 });
    }

    const body = await req.json();
    const externalRef = String(body.external_ref || body.reference || "").trim();
    if (!externalRef) {
      return NextResponse.json({ error: "external_ref required" }, { status: 400 });
    }

    const sb = createAdminClient();
    const status = String(body.status || "succeeded").toLowerCase();

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
