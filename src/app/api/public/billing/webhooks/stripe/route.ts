/**
 * Stripe webhook — checkout.session.completed → settle intent.
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { completePaymentIntent } from "@/lib/billing/gateway";
import { verifyStripeSignature } from "@/lib/providers/payments/stripe";
import { ingressRateLimit } from "@/lib/security/public-ingress";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const rl = await ingressRateLimit("stripe-webhook", 200, 60_000, req);
    if (!rl.ok) {
      return NextResponse.json({ error: "Rate limit" }, { status: 429 });
    }

    const rawBody = await req.text();
    const sig = req.headers.get("stripe-signature");
    if (!verifyStripeSignature(rawBody, sig)) {
      // Fallback shared secret for non-Stripe test tooling
      const alt = process.env.BILLING_WEBHOOK_SECRET?.trim();
      const provided = req.headers.get("x-webhook-secret") || "";
      if (!alt || provided !== alt) {
        return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
      }
    }

    const event = JSON.parse(rawBody) as {
      type?: string;
      data?: {
        object?: {
          client_reference_id?: string;
          metadata?: { external_ref?: string };
          payment_status?: string;
          status?: string;
        };
      };
    };

    const obj = event.data?.object;
    const ref = String(
      obj?.client_reference_id || obj?.metadata?.external_ref || ""
    ).trim();
    if (!ref) {
      return NextResponse.json({ received: true, skipped: true });
    }

    const paid =
      event.type === "checkout.session.completed" ||
      obj?.payment_status === "paid" ||
      obj?.status === "complete";

    const sb = createAdminClient();
    await completePaymentIntent(sb, ref, {
      force_fail: !paid,
      webhookVerified: true,
      serviceTrusted: true,
    });

    return NextResponse.json({ received: true, external_ref: ref });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Webhook failed" },
      { status: 500 }
    );
  }
}
