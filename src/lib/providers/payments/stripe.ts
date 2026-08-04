/**
 * Stripe Checkout Session (payment mode) via REST.
 */

import { providersConfig } from "../config";
import { providerFetch, sandboxResult } from "../http";
import type { PaymentCollectInput, PaymentCollectResult } from "../types";
import { createHmac, timingSafeEqual } from "crypto";

export async function stripeCollect(
  input: PaymentCollectInput
): Promise<PaymentCollectResult> {
  const cfg = providersConfig.stripe;

  if (!cfg.configured) {
    return sandboxResult("stripe", {
      checkoutUrl: input.returnUrl || null,
      providerRef: input.externalRef,
      status: "open",
    });
  }

  try {
    const unitAmount = Math.round(Number(input.amount) * 100); // minor units; UGX has no decimals historically but Stripe may use 1:1
    // For zero-decimal currencies like UGX, Stripe expects whole units.
    const zeroDecimal = ["ugx", "jpy", "krw", "vnd"].includes(
      (input.currency || "").toLowerCase()
    );
    const amount = zeroDecimal
      ? Math.round(Number(input.amount))
      : unitAmount;

    const params = new URLSearchParams();
    params.set("mode", "payment");
    params.set("success_url", input.returnUrl || input.callbackUrl || "https://example.com/success");
    params.set("cancel_url", input.returnUrl || input.callbackUrl || "https://example.com/cancel");
    params.set("client_reference_id", input.externalRef);
    params.set("line_items[0][price_data][currency]", (input.currency || "usd").toLowerCase());
    params.set("line_items[0][price_data][product_data][name]", input.description || "SecureTrack payment");
    params.set("line_items[0][price_data][unit_amount]", String(amount));
    params.set("line_items[0][quantity]", "1");
    params.set("metadata[external_ref]", input.externalRef);
    if (input.email) params.set("customer_email", input.email);

    const { res, json, text } = await providerFetch(
      "https://api.stripe.com/v1/checkout/sessions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${cfg.secretKey}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params.toString(),
      }
    );

    const body = json as {
      id?: string;
      url?: string;
      error?: { message?: string };
    };

    if (res.ok && body.url) {
      return {
        ok: true,
        status: res.status,
        provider: "stripe",
        sandbox: cfg.sandbox,
        externalId: body.id,
        data: {
          checkoutUrl: body.url,
          providerRef: body.id,
          status: "open",
        },
        raw: json,
      };
    }

    return {
      ok: false,
      status: res.status,
      provider: "stripe",
      error: body.error?.message || text.slice(0, 300) || `Stripe HTTP ${res.status}`,
      raw: json,
    };
  } catch (e) {
    return {
      ok: false,
      provider: "stripe",
      error: e instanceof Error ? e.message : "Stripe request failed",
    };
  }
}

/** Verify Stripe-Signature header (v1). */
export function verifyStripeSignature(
  rawBody: string,
  signatureHeader: string | null,
  secret?: string
): boolean {
  const whSecret = secret || providersConfig.stripe.webhookSecret;
  if (!whSecret || !signatureHeader) return false;
  try {
    const parts = Object.fromEntries(
      signatureHeader.split(",").map((p) => {
        const [k, v] = p.split("=");
        return [k, v];
      })
    );
    const ts = parts.t;
    const sig = parts.v1;
    if (!ts || !sig) return false;
    const age = Math.abs(Date.now() / 1000 - Number(ts));
    if (age > 300) return false;
    const expected = createHmac("sha256", whSecret)
      .update(`${ts}.${rawBody}`)
      .digest("hex");
    const a = Buffer.from(expected);
    const b = Buffer.from(sig);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
