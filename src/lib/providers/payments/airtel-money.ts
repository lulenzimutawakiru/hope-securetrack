/**
 * Airtel Money Collection API (UAT/production OpenAPI).
 */

import { providersConfig } from "../config";
import { providerFetch, sandboxResult } from "../http";
import type { PaymentCollectInput, PaymentCollectResult } from "../types";

async function getToken(): Promise<string | null> {
  const cfg = providersConfig.airtelMoney;
  if (!cfg.configured) return null;
  const { res, json } = await providerFetch(`${cfg.baseUrl}/auth/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "*/*" },
    body: JSON.stringify({
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
      grant_type: "client_credentials",
    }),
  });
  if (!res.ok) return null;
  return (json as { access_token?: string }).access_token || null;
}

export async function airtelMoneyCollect(
  input: PaymentCollectInput
): Promise<PaymentCollectResult> {
  const cfg = providersConfig.airtelMoney;
  const phone = (input.phone || "").replace(/\D/g, "");

  if (!cfg.configured || cfg.sandbox) {
    return sandboxResult("airtel_money", {
      checkoutUrl: null,
      providerRef: input.externalRef,
      status: "TIP",
      msisdn: phone || "sandbox",
      amount: input.amount,
    });
  }

  if (!phone) {
    return {
      ok: false,
      provider: "airtel_money",
      error: "phone required for Airtel Money collection",
    };
  }

  try {
    const token = await getToken();
    if (!token) {
      return {
        ok: false,
        provider: "airtel_money",
        error: "Failed to obtain Airtel OAuth token",
      };
    }

    const { res, json, text } = await providerFetch(
      `${cfg.baseUrl}/merchant/v1/payments/`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Accept: "*/*",
          "X-Country": cfg.country,
          "X-Currency": input.currency || cfg.currency,
        },
        body: JSON.stringify({
          reference: input.externalRef.slice(0, 25),
          subscriber: {
            country: cfg.country,
            currency: input.currency || cfg.currency,
            msisdn: phone.replace(/^256/, "").replace(/^0/, ""),
          },
          transaction: {
            amount: Math.round(input.amount),
            country: cfg.country,
            currency: input.currency || cfg.currency,
            id: input.externalRef.slice(0, 50),
          },
        }),
      }
    );

    const data = json as {
      status?: { success?: boolean; message?: string; response_code?: string };
      data?: { transaction?: { id?: string; status?: string } };
    };

    if (res.ok && data?.status?.success !== false) {
      const tid =
        data?.data?.transaction?.id || input.externalRef;
      return {
        ok: true,
        status: res.status,
        provider: "airtel_money",
        externalId: tid,
        data: {
          checkoutUrl: null,
          providerRef: tid,
          status: data?.data?.transaction?.status || "PENDING",
        },
        raw: json,
      };
    }

    return {
      ok: false,
      status: res.status,
      provider: "airtel_money",
      error:
        data?.status?.message ||
        text.slice(0, 300) ||
        `Airtel HTTP ${res.status}`,
      raw: json,
    };
  } catch (e) {
    return {
      ok: false,
      provider: "airtel_money",
      error: e instanceof Error ? e.message : "Airtel Money request failed",
    };
  }
}
