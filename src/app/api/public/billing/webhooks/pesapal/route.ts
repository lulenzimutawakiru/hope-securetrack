/**
 * Pesapal IPN / callback — settles intent by OrderMerchantReference / OrderTrackingId.
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { completePaymentIntent } from "@/lib/billing/gateway";
import { ingressRateLimit } from "@/lib/security/public-ingress";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  return handle(req);
}

export async function POST(req: NextRequest) {
  return handle(req);
}

async function handle(req: NextRequest) {
  try {
    const rl = await ingressRateLimit("pesapal-webhook", 200, 60_000, req);
    if (!rl.ok) {
      return NextResponse.json({ error: "Rate limit" }, { status: 429 });
    }

    let body: Record<string, unknown> = {};
    if (req.method === "POST") {
      try {
        body = (await req.json()) as Record<string, unknown>;
      } catch {
        body = {};
      }
    }

    const sp = req.nextUrl.searchParams;
    const ref = String(
      body.OrderMerchantReference ||
        body.orderMerchantReference ||
        body.external_ref ||
        sp.get("OrderMerchantReference") ||
        sp.get("OrderTrackingId") ||
        ""
    ).trim();

    const statusCode = String(
      body.payment_status_description ||
        body.Status ||
        body.status ||
        sp.get("OrderNotificationType") ||
        "COMPLETED"
    ).toUpperCase();

    if (!ref) {
      return NextResponse.json({ error: "reference required" }, { status: 400 });
    }

    const failed = ["FAILED", "INVALID", "REVERSED"].some((s) =>
      statusCode.includes(s)
    );

    const sb = createAdminClient();
    const data = await completePaymentIntent(sb, ref, {
      force_fail: failed,
      webhookVerified: true,
      serviceTrusted: true,
    });

    return NextResponse.json({
      orderNotificationType: "IPNCHANGE",
      orderTrackingId: sp.get("OrderTrackingId") || body.OrderTrackingId,
      orderMerchantReference: ref,
      status: data?.status || 200,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Webhook failed" },
      { status: 500 }
    );
  }
}
