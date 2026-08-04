/**
 * Flutterwave webhook — verifies verif-hash header.
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { completePaymentIntent } from "@/lib/billing/gateway";
import { verifyFlutterwaveWebhook } from "@/lib/providers/payments/flutterwave";
import { ingressRateLimit } from "@/lib/security/public-ingress";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const rl = await ingressRateLimit("flutterwave-webhook", 200, 60_000, req);
    if (!rl.ok) {
      return NextResponse.json({ error: "Rate limit" }, { status: 429 });
    }

    const signature = req.headers.get("verif-hash");
    if (!verifyFlutterwaveWebhook(signature)) {
      // Allow BILLING_WEBHOOK_SECRET as alternate
      const alt = process.env.BILLING_WEBHOOK_SECRET?.trim();
      const provided =
        req.headers.get("x-webhook-secret") ||
        req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
        "";
      if (!alt || provided !== alt) {
        return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
      }
    }

    const body = (await req.json()) as {
      event?: string;
      data?: {
        tx_ref?: string;
        status?: string;
        id?: number;
      };
    };

    const ref = String(body.data?.tx_ref || "").trim();
    if (!ref) {
      return NextResponse.json({ error: "tx_ref required" }, { status: 400 });
    }

    const status = String(body.data?.status || "").toLowerCase();
    const failed = !["successful", "success"].includes(status);

    const sb = createAdminClient();
    const data = await completePaymentIntent(sb, ref, {
      force_fail: failed,
      webhookVerified: true,
      serviceTrusted: true,
    });

    return NextResponse.json({ ok: true, status: data?.status, external_ref: ref });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Webhook failed" },
      { status: 500 }
    );
  }
}
