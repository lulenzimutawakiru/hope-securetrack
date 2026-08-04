/**
 * Flutterwave standard payment link / charge initiation.
 */

import { providersConfig } from "../config";
import { providerFetch, sandboxResult } from "../http";
import type { PaymentCollectInput, PaymentCollectResult } from "../types";
import { timingSafeEqualString } from "@/lib/security/shared";

export async function flutterwaveCollect(
  input: PaymentCollectInput
): Promise<PaymentCollectResult> {
  const cfg = providersConfig.flutterwave;

  if (!cfg.configured) {
    return sandboxResult("flutterwave", {
      checkoutUrl: input.returnUrl || null,
      providerRef: input.externalRef,
      status: "sandbox",
    });
  }

  try {
    const { res, json, text } = await providerFetch(
      `${cfg.baseUrl}/payments`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${cfg.secretKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          tx_ref: input.externalRef,
          amount: input.amount,
          currency: input.currency || "UGX",
          redirect_url: input.returnUrl || input.callbackUrl,
          customer: {
            email: input.email || "billing@securetrack.local",
            phonenumber: input.phone || undefined,
            name: "SecureTrack Customer",
          },
          customizations: {
            title: "SecureTrack ERP",
            description: input.description || "Invoice payment",
          },
          meta: input.metadata || {},
        }),
      }
    );

    const body = json as {
      status?: string;
      message?: string;
      data?: { link?: string; id?: number };
    };

    if (res.ok && body.status === "success" && body.data?.link) {
      return {
        ok: true,
        status: res.status,
        provider: "flutterwave",
        sandbox: cfg.sandbox,
        externalId: String(body.data.id || input.externalRef),
        data: {
          checkoutUrl: body.data.link,
          providerRef: String(body.data.id || input.externalRef),
          status: "pending",
        },
        raw: json,
      };
    }

    return {
      ok: false,
      status: res.status,
      provider: "flutterwave",
      error: body.message || text.slice(0, 300) || `Flutterwave HTTP ${res.status}`,
      raw: json,
    };
  } catch (e) {
    return {
      ok: false,
      provider: "flutterwave",
      error: e instanceof Error ? e.message : "Flutterwave request failed",
    };
  }
}

export function verifyFlutterwaveWebhook(
  signatureHeader: string | null,
  secret?: string
): boolean {
  const expected = secret || providersConfig.flutterwave.webhookSecret;
  if (!expected || !signatureHeader) return false;
  return timingSafeEqualString(signatureHeader, expected);
}
