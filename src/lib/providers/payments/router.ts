/**
 * Route payment collection to the configured gateway provider.
 */

import type { PaymentCollectInput, PaymentCollectResult } from "../types";
import { mtnMomoCollect } from "./mtn-momo";
import { airtelMoneyCollect } from "./airtel-money";
import { flutterwaveCollect } from "./flutterwave";
import { pesapalCollect } from "./pesapal";
import { stripeCollect } from "./stripe";
import { sandboxResult } from "../http";

/** Map gateway_code from billing UI → provider handler */
export function normalizeGatewayCode(code: string): string {
  const c = (code || "").toUpperCase().replace(/[\s-]+/g, "_");
  const map: Record<string, string> = {
    MTN: "mtn_momo",
    MTN_MOMO: "mtn_momo",
    MOMO: "mtn_momo",
    AIRTEL: "airtel_money",
    AIRTEL_MONEY: "airtel_money",
    FLW: "flutterwave",
    FLUTTERWAVE: "flutterwave",
    PESAPAL: "pesapal",
    STRIPE: "stripe",
    PAYPAL: "paypal",
    BANKAPI: "bank_api",
    BANK: "bank_transfer",
  };
  return map[c] || code.toLowerCase();
}

export async function collectPayment(
  gatewayCode: string,
  input: PaymentCollectInput
): Promise<PaymentCollectResult> {
  const provider = normalizeGatewayCode(gatewayCode);

  switch (provider) {
    case "mtn_momo":
      return mtnMomoCollect(input);
    case "airtel_money":
      return airtelMoneyCollect(input);
    case "flutterwave":
      return flutterwaveCollect(input);
    case "pesapal":
      return pesapalCollect(input);
    case "stripe":
      return stripeCollect(input);
    case "paypal":
      // PayPal Checkout requires client credentials; sandbox placeholder
      return sandboxResult("paypal", {
        checkoutUrl: input.returnUrl || null,
        providerRef: input.externalRef,
        status: "CREATED",
        note: "Configure PAYPAL_CLIENT_ID/SECRET for live PayPal later",
      });
    case "bank_api":
    case "bank_transfer":
    case "pos":
    case "wallet":
    case "cheque":
    case "cash":
    case "card":
      return sandboxResult(provider, {
        checkoutUrl: input.returnUrl || null,
        providerRef: input.externalRef,
        status: "manual",
        note: "Manual / offline settlement — mark paid via webhook or AR",
      });
    default:
      return {
        ok: false,
        provider,
        error: `Unsupported payment gateway: ${gatewayCode}`,
      };
  }
}
