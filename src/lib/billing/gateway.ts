/**
 * Payment gateway intents — MTN, Airtel, Pesapal, Stripe, PayPal, Flutterwave, Bank API.
 * Creates trackable payment links; provider webhooks can complete intents.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { nextBillNumber, recordPayment } from "./service";

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
    base_url?: string;
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
    (typeof window !== "undefined" ? window.location.origin : "");
  const payment_link = `${origin}/portal/pay/${external_ref}`;

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
      checkout_url: payment_link,
      payment_link,
      phone_msisdn: input.phone_msisdn || null,
      expires_at: expires.toISOString(),
      notify_customer: true,
      provider_payload: {
        provider: input.gateway_code,
        created_via: "hope_securetrack",
      },
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

/** Simulate or record successful gateway callback */
export async function completePaymentIntent(
  supabase: SupabaseClient,
  externalRef: string,
  opts?: { actor_id?: string | null; force_fail?: boolean }
) {
  const { data: intent, error } = await supabase
    .from("bill_payment_intents")
    .select("*")
    .eq("external_ref", externalRef)
    .maybeSingle();
  if (error || !intent) throw error || new Error("Payment intent not found");

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
    notes: `Gateway payment ${intent.intent_number}`,
  });

  const { data } = await supabase
    .from("bill_payment_intents")
    .update({
      status: "succeeded",
      paid_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", intent.id)
    .select()
    .single();

  // notify
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
