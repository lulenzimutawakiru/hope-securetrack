/**
 * MTN Mobile Money Collections (requestToPay).
 * Docs: https://momodeveloper.mtn.com
 */

import { providersConfig } from "../config";
import { providerFetch, sandboxResult } from "../http";
import type { PaymentCollectInput, PaymentCollectResult } from "../types";

function uuid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx`.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

async function getAccessToken(): Promise<string | null> {
  const cfg = providersConfig.mtnMomo;
  if (!cfg.configured) return null;
  const basic = Buffer.from(`${cfg.apiUser}:${cfg.apiKey}`).toString("base64");
  const { res, json } = await providerFetch(
    `${cfg.baseUrl}/collection/token/`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${basic}`,
        "Ocp-Apim-Subscription-Key": cfg.subscriptionKey,
      },
    }
  );
  if (!res.ok) return null;
  const body = json as { access_token?: string };
  return body.access_token || null;
}

export async function mtnMomoCollect(
  input: PaymentCollectInput
): Promise<PaymentCollectResult> {
  const cfg = providersConfig.mtnMomo;
  const phone = (input.phone || "").replace(/\D/g, "");

  if (!cfg.configured || cfg.sandbox) {
    return sandboxResult("mtn_momo", {
      checkoutUrl: null,
      providerRef: input.externalRef,
      status: "PENDING",
      partyId: phone || "sandbox",
      amount: input.amount,
      currency: input.currency,
      message: "Sandbox requestToPay accepted — complete via webhook or sandbox settle",
    });
  }

  if (!phone) {
    return {
      ok: false,
      provider: "mtn_momo",
      error: "phone (MSISDN) required for MTN MoMo collection",
    };
  }

  try {
    const token = await getAccessToken();
    if (!token) {
      return { ok: false, provider: "mtn_momo", error: "Failed to obtain MoMo token" };
    }

    const referenceId = uuid();
    const callback =
      input.callbackUrl ||
      (cfg.callbackHost
        ? `${cfg.callbackHost.replace(/\/$/, "")}/api/public/billing/webhooks/mtn-momo`
        : undefined);

    const { res, json, text } = await providerFetch(
      `${cfg.baseUrl}/collection/v1_0/requesttopay`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "X-Reference-Id": referenceId,
          "X-Target-Environment": cfg.targetEnvironment,
          "Ocp-Apim-Subscription-Key": cfg.subscriptionKey,
          "Content-Type": "application/json",
          ...(callback ? { "X-Callback-Url": callback } : {}),
        },
        body: JSON.stringify({
          amount: String(Math.round(input.amount)),
          currency: input.currency || "UGX",
          externalId: input.externalRef.slice(0, 64),
          payer: {
            partyIdType: "MSISDN",
            partyId: phone,
          },
          payerMessage: (input.description || "SecureTrack payment").slice(0, 160),
          payeeNote: input.externalRef.slice(0, 160),
        }),
      }
    );

    // 202 Accepted is success for requestToPay
    if (res.status === 202 || res.ok) {
      return {
        ok: true,
        status: res.status,
        provider: "mtn_momo",
        externalId: referenceId,
        data: {
          checkoutUrl: null,
          providerRef: referenceId,
          status: "PENDING",
        },
        raw: json || { text: text.slice(0, 500) },
      };
    }

    return {
      ok: false,
      status: res.status,
      provider: "mtn_momo",
      error:
        (json as { message?: string })?.message ||
        text.slice(0, 300) ||
        `MoMo HTTP ${res.status}`,
      raw: json,
    };
  } catch (e) {
    return {
      ok: false,
      provider: "mtn_momo",
      error: e instanceof Error ? e.message : "MTN MoMo request failed",
    };
  }
}
