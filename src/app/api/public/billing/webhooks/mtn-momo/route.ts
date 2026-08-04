/**
 * MTN MoMo collection callback.
 * Body typically includes externalId / financialTransactionId / status.
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { completePaymentIntent } from "@/lib/billing/gateway";
import { ingressRateLimit } from "@/lib/security/public-ingress";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const rl = await ingressRateLimit("mtn-momo-webhook", 200, 60_000, req);
    if (!rl.ok) {
      return NextResponse.json({ error: "Rate limit" }, { status: 429 });
    }

    // Optional shared secret if configured
    const secret = process.env.MTN_MOMO_CALLBACK_SECRET?.trim();
    if (secret) {
      const provided =
        req.headers.get("x-callback-secret") ||
        req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
        "";
      if (provided !== secret) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    let body: Record<string, unknown> = {};
    try {
      body = (await req.json()) as Record<string, unknown>;
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const externalRef = String(
      body.externalId ||
        body.external_id ||
        body.external_ref ||
        body.referenceId ||
        ""
    ).trim();
    const providerRef = String(
      body.financialTransactionId || body.referenceId || body.id || ""
    ).trim();

    // Lookup intent by external_ref or provider_payload
    const sb = createAdminClient();
    let ref = externalRef;
    if (!ref && providerRef) {
      const { data: byPayload } = await sb
        .from("bill_payment_intents")
        .select("external_ref")
        .contains("provider_payload", { collect: { externalId: providerRef } })
        .maybeSingle();
      ref = String(byPayload?.external_ref || "");
    }

    if (!ref) {
      // Also try matching provider_ref stored in payload
      const { data: intents } = await sb
        .from("bill_payment_intents")
        .select("external_ref, provider_payload")
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(50);
      for (const row of intents || []) {
        const pp = row.provider_payload as {
          collect?: { externalId?: string };
          provider_ref?: string;
        } | null;
        if (
          pp?.collect?.externalId === providerRef ||
          pp?.provider_ref === providerRef
        ) {
          ref = String(row.external_ref);
          break;
        }
      }
    }

    if (!ref) {
      return NextResponse.json({ error: "Intent not found" }, { status: 404 });
    }

    const status = String(body.status || body.financialTransactionStatus || "SUCCESSFUL").toUpperCase();
    const failed = ["FAILED", "REJECTED", "TIMEOUT", "CANCELLED"].includes(status);

    const data = await completePaymentIntent(sb, ref, {
      force_fail: failed,
      webhookVerified: true,
      serviceTrusted: true,
    });

    return NextResponse.json({
      ok: true,
      status: data?.status,
      external_ref: ref,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Webhook failed" },
      { status: 500 }
    );
  }
}
