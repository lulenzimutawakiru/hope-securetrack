/**
 * Payment gateway intents — MTN, Airtel, Pesapal, Stripe, PayPal, Flutterwave, Bank API.
 * Creates trackable payment links; provider webhooks complete intents.
 *
 * SECURITY: completePaymentIntent must only be called from trusted server paths
 * (webhook with secret, or sandbox with PAYMENT_SANDBOX=true). Never from browser
 * production code without sandbox gate.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { nextBillNumber, recordPayment } from "./service";
import { isPaymentSandboxEnabled } from "@/lib/security/shared";

export const GATEWAY_PROVIDERS = [
  { code: "MTN", label: "MTN Mobile Money", provider: "mtn_momo" },
  { code: "AIRTEL", label: "Airtel Money", provider: "airtel_money" },
  { code: "PESAPAL", label: "Pesapal", provider: "pesapal" },
  { code: "STRIPE", label: "Stripe", provider: "stripe" },
  { code: "PAYPAL", label: "PayPal", provider: "paypal" },
  { code: "FLW", label: "Flutterwave", provider: "flutterwave" },
  { code: "BANKAPI", label: "Bank API", provider: "bank_api" },
  { code: "BANK", label: "Bank Transfer", provider: "bank_transfer" },
  { code: "POS", label: "POS", provider: "pos" },
  { code: "WALLET", label: "Wallet", provider: "wallet" },
  { code: "CHEQUE", label: "Cheque", provider: "cheque" },
  { code: "CASH", label: "Cash", provider: "cash" },
  { code: "CARD", label: "Card", provider: "card" },
] as const;

export async function createPaymentIntent(
  supabase: SupabaseClient,
  input: {
    company_id: string;
    invoice_id: string;
    customer_id?: string | null;
    amount: number;
    currency?: string;
    gateway_code: string;
    phone_msisdn?: string;
    email?: string | null;
    base_url?: string;
    description?: string;
    /** When true (default), call live/sandbox payment provider APIs */
    initiate_provider?: boolean;
  }
) {
  const intent_number = await nextBillNumber(
    supabase,
    input.company_id,
    "RCP"
  ).then((n) => n.replace("HDG-RCP", "PAY"));

  const external_ref = `PI-${Date.now().toString(36).toUpperCase()}`;
  const origin =
    input.base_url ||
    process.env.NEXT_PUBLIC_APP_URL ||
    (typeof window !== "undefined" ? window.location.origin : "");
  let payment_link = origin
    ? `${origin.replace(/\/$/, "")}/portal/pay/${external_ref}`
    : `/portal/pay/${external_ref}`;
  let checkout_url = payment_link;
  let provider_payload: Record<string, unknown> = {
    provider: input.gateway_code,
    created_via: "securetrack_erp",
  };
  let provider_ref: string | null = null;

  // Initiate collection with external payment provider (server-side only)
  if (input.initiate_provider !== false && typeof window === "undefined") {
    try {
      const { collectPayment } = await import("@/lib/providers/payments/router");
      const callbackUrl = origin
        ? `${origin.replace(/\/$/, "")}/api/public/billing/webhooks/generic`
        : undefined;
      const result = await collectPayment(input.gateway_code, {
        companyId: input.company_id,
        amount: input.amount,
        currency: input.currency || "UGX",
        externalRef: external_ref,
        phone: input.phone_msisdn,
        email: input.email,
        description: input.description || `Payment ${intent_number}`,
        callbackUrl,
        returnUrl: payment_link,
        metadata: {
          invoice_id: input.invoice_id,
          company_id: input.company_id,
        },
      });
      provider_payload = {
        ...provider_payload,
        collect: {
          ok: result.ok,
          provider: result.provider,
          sandbox: result.sandbox,
          externalId: result.externalId,
          error: result.error,
          data: result.data,
        },
      };
      if (result.ok) {
        provider_ref = result.externalId || result.data?.providerRef || null;
        if (result.data?.checkoutUrl) {
          checkout_url = result.data.checkoutUrl;
          payment_link = result.data.checkoutUrl;
        }
      }
    } catch (e) {
      provider_payload.collect_error =
        e instanceof Error ? e.message : "provider init failed";
    }
  }

  const expires = new Date();
  expires.setHours(expires.getHours() + 48);

  const { data, error } = await supabase
    .from("bill_payment_intents")
    .insert({
      company_id: input.company_id,
      intent_number,
      invoice_id: input.invoice_id,
      customer_id: input.customer_id || null,
      gateway_code: input.gateway_code,
      amount: input.amount,
      currency: input.currency || "UGX",
      status: "pending",
      external_ref,
      checkout_url,
      payment_link,
      phone_msisdn: input.phone_msisdn || null,
      expires_at: expires.toISOString(),
      notify_customer: true,
      provider_payload: {
        ...provider_payload,
        ...(provider_ref ? { provider_ref } : {}),
      },
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

/**
 * Record successful gateway settlement.
 * @param opts.allowSandbox - only when PAYMENT_SANDBOX / non-prod demo
 * @param opts.webhookVerified - set true after gateway signature verification
 * @param opts.serviceTrusted - set true for server service-role webhook handlers
 */
export async function completePaymentIntent(
  supabase: SupabaseClient,
  externalRef: string,
  opts?: {
    actor_id?: string | null;
    force_fail?: boolean;
    allowSandbox?: boolean;
    webhookVerified?: boolean;
    serviceTrusted?: boolean;
  }
) {
  const sandboxOk = opts?.allowSandbox && isPaymentSandboxEnabled();
  const trusted = Boolean(opts?.webhookVerified || opts?.serviceTrusted || sandboxOk);
  if (!trusted) {
    throw new Error(
      "Payment completion denied: requires verified webhook or PAYMENT_SANDBOX=true"
    );
  }

  const { data: intent, error } = await supabase
    .from("bill_payment_intents")
    .select("*")
    .eq("external_ref", externalRef)
    .maybeSingle();
  if (error || !intent) throw error || new Error("Payment intent not found");

  if (intent.status === "succeeded") {
    return intent;
  }

  if (opts?.force_fail) {
    const { data } = await supabase
      .from("bill_payment_intents")
      .update({
        status: "failed",
        error_message: "Payment failed at gateway",
        updated_at: new Date().toISOString(),
      })
      .eq("id", intent.id)
      .select()
      .single();
    return data;
  }

  if (!intent.invoice_id) throw new Error("Intent has no invoice");

  await recordPayment(supabase, {
    company_id: intent.company_id,
    invoice_id: intent.invoice_id,
    amount: Number(intent.amount),
    method: String(intent.gateway_code || "card").toLowerCase(),
    reference: intent.external_ref,
    gateway: intent.gateway_code,
    mobile_money_msisdn: intent.phone_msisdn || undefined,
    recorded_by: opts?.actor_id || null,
    notes: sandboxOk
      ? `SANDBOX settlement ${intent.intent_number}`
      : `Gateway payment ${intent.intent_number}`,
  });

  const { data } = await supabase
    .from("bill_payment_intents")
    .update({
      status: "succeeded",
      paid_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      provider_payload: {
        ...(typeof intent.provider_payload === "object" && intent.provider_payload
          ? (intent.provider_payload as object)
          : {}),
        settled_via: sandboxOk ? "sandbox" : "webhook",
      },
    })
    .eq("id", intent.id)
    .select()
    .single();

  await supabase.from("bill_communications").insert({
    company_id: intent.company_id,
    invoice_id: intent.invoice_id,
    customer_id: intent.customer_id,
    channel: "email",
    event_type: "payment_received",
    recipient: "customer",
    subject: `Payment received ${intent.intent_number}`,
    body: `Payment of ${intent.amount} ${intent.currency} received.`,
    status: "sent",
    sent_at: new Date().toISOString(),
  });

  return data;
}
