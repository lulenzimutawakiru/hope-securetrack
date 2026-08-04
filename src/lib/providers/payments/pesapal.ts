/**
 * Pesapal v3 order submission.
 */

import { providersConfig } from "../config";
import { providerFetch, sandboxResult } from "../http";
import type { PaymentCollectInput, PaymentCollectResult } from "../types";

let cachedToken: { token: string; exp: number } | null = null;

async function getToken(): Promise<string | null> {
  const cfg = providersConfig.pesapal;
  if (!cfg.configured) return null;
  if (cachedToken && cachedToken.exp > Date.now()) return cachedToken.token;

  const { res, json } = await providerFetch(
    `${cfg.baseUrl}/api/Auth/RequestToken`,
    {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        consumer_key: cfg.consumerKey,
        consumer_secret: cfg.consumerSecret,
      }),
    }
  );
  if (!res.ok) return null;
  const token = (json as { token?: string }).token;
  if (!token) return null;
  cachedToken = { token, exp: Date.now() + 4 * 60 * 1000 };
  return token;
}

export async function pesapalCollect(
  input: PaymentCollectInput
): Promise<PaymentCollectResult> {
  const cfg = providersConfig.pesapal;

  if (!cfg.configured || cfg.sandbox) {
    return sandboxResult("pesapal", {
      checkoutUrl: input.returnUrl || null,
      providerRef: input.externalRef,
      status: "PENDING",
    });
  }

  try {
    const token = await getToken();
    if (!token) {
      return { ok: false, provider: "pesapal", error: "Pesapal auth failed" };
    }

    const { res, json, text } = await providerFetch(
      `${cfg.baseUrl}/api/Transactions/SubmitOrderRequest`,
      {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          id: input.externalRef,
          currency: input.currency || "UGX",
          amount: input.amount,
          description: (input.description || "SecureTrack payment").slice(0, 100),
          callback_url: input.returnUrl || input.callbackUrl,
          notification_id: cfg.ipnId || undefined,
          billing_address: {
            email_address: input.email || "billing@securetrack.local",
            phone_number: input.phone || undefined,
            country_code: "UG",
            first_name: "Customer",
            last_name: "SecureTrack",
          },
        }),
      }
    );

    const body = json as {
      order_tracking_id?: string;
      redirect_url?: string;
      status?: string;
      message?: string;
      error?: { message?: string };
    };

    if (res.ok && body.redirect_url) {
      return {
        ok: true,
        status: res.status,
        provider: "pesapal",
        externalId: body.order_tracking_id || input.externalRef,
        data: {
          checkoutUrl: body.redirect_url,
          providerRef: body.order_tracking_id || input.externalRef,
          status: body.status || "PENDING",
        },
        raw: json,
      };
    }

    return {
      ok: false,
      status: res.status,
      provider: "pesapal",
      error:
        body.message ||
        body.error?.message ||
        text.slice(0, 300) ||
        `Pesapal HTTP ${res.status}`,
      raw: json,
    };
  } catch (e) {
    return {
      ok: false,
      provider: "pesapal",
      error: e instanceof Error ? e.message : "Pesapal request failed",
    };
  }
}
