/**
 * Aggregate configuration status for Integrations hub.
 */

import { providersConfig, globalSandboxPreferred } from "./config";
import type { ProviderStatus } from "./types";

export function getProvidersStatus(): ProviderStatus[] {
  const c = providersConfig;
  return [
    {
      code: "mtn_momo",
      label: "MTN Mobile Money",
      category: "payments",
      configured: c.mtnMomo.configured,
      sandbox: c.mtnMomo.sandbox || !c.mtnMomo.configured,
      notes: "Collections requestToPay",
    },
    {
      code: "airtel_money",
      label: "Airtel Money",
      category: "payments",
      configured: c.airtelMoney.configured,
      sandbox: c.airtelMoney.sandbox || !c.airtelMoney.configured,
    },
    {
      code: "flutterwave",
      label: "Flutterwave",
      category: "payments",
      configured: c.flutterwave.configured,
      sandbox: c.flutterwave.sandbox || !c.flutterwave.configured,
    },
    {
      code: "pesapal",
      label: "Pesapal",
      category: "payments",
      configured: c.pesapal.configured,
      sandbox: c.pesapal.sandbox || !c.pesapal.configured,
    },
    {
      code: "stripe",
      label: "Stripe",
      category: "payments",
      configured: c.stripe.configured,
      sandbox: c.stripe.sandbox || !c.stripe.configured,
    },
    {
      code: "africastalking",
      label: "Africa's Talking SMS",
      category: "comms",
      configured: c.africastalking.configured,
      sandbox: c.africastalking.sandbox || !c.africastalking.configured,
    },
    {
      code: "whatsapp",
      label: "WhatsApp Cloud API",
      category: "comms",
      configured: c.whatsapp.configured,
      sandbox: c.whatsapp.sandbox || !c.whatsapp.configured,
    },
    {
      code: "fcm",
      label: "Firebase Cloud Messaging",
      category: "comms",
      configured: c.fcm.configured,
      sandbox: c.fcm.sandbox || !c.fcm.configured,
    },
    {
      code: "onesignal",
      label: "OneSignal",
      category: "comms",
      configured: c.onesignal.configured,
      sandbox: c.onesignal.sandbox || !c.onesignal.configured,
    },
    {
      code: "mapbox",
      label: "Mapbox Maps & Directions",
      category: "maps",
      configured: c.mapbox.configured,
      sandbox: !c.mapbox.configured,
    },
    {
      code: "qstash",
      label: "Upstash QStash",
      category: "jobs",
      configured: c.qstash.configured,
      sandbox: !c.qstash.configured,
      notes: "Durable serverless job dispatch",
    },
    {
      code: "turnstile",
      label: "Cloudflare Turnstile CAPTCHA",
      category: "security",
      configured: c.turnstile.configured,
      sandbox: !c.turnstile.configured,
    },
    {
      code: "document_ai",
      label: "Document OCR / AI",
      category: "docs",
      configured: c.documentAi.configured,
      sandbox: c.documentAi.sandbox || !c.documentAi.configured,
    },
    {
      code: "docusign",
      label: "DocuSign eSignature",
      category: "docs",
      configured: c.docusign.configured,
      sandbox: c.docusign.sandbox || !c.docusign.configured,
    },
    {
      code: "resend",
      label: "Resend Email",
      category: "comms",
      configured: Boolean(process.env.RESEND_API_KEY?.trim()),
      sandbox: !process.env.RESEND_API_KEY?.trim(),
    },
    {
      code: "slack",
      label: "Slack SecureChat",
      category: "comms",
      configured: Boolean(
        process.env.SLACK_CLIENT_ID?.trim() &&
          process.env.SLACK_CLIENT_SECRET?.trim()
      ),
      sandbox: false,
    },
    {
      code: "mtn_kyc",
      label: "MTN KYC (MADAPI)",
      category: "security",
      configured: Boolean(process.env.MTN_KYC_API_KEY?.trim()),
      sandbox: process.env.MTN_KYC_SANDBOX === "true" || globalSandboxPreferred(),
    },
  ];
}

export function getProvidersSummary() {
  const list = getProvidersStatus();
  const configured = list.filter((p) => p.configured).length;
  return {
    total: list.length,
    configured,
    sandbox_mode: globalSandboxPreferred(),
    providers: list,
  };
}
