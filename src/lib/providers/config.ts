/**
 * Server-only provider configuration from environment.
 * Never import this module from client components.
 */

function flag(name: string): boolean {
  const v = process.env[name];
  return v === "true" || v === "1";
}

function isProd() {
  return process.env.NODE_ENV === "production";
}

/** Global sandbox when PAYMENT_SANDBOX or non-prod without real keys */
export function globalSandboxPreferred(): boolean {
  if (flag("PAYMENT_SANDBOX") || flag("PROVIDERS_SANDBOX")) return true;
  return !isProd();
}

export const providersConfig = {
  mtnMomo: {
    baseUrl:
      process.env.MTN_MOMO_BASE_URL ||
      "https://sandbox.momodeveloper.mtn.com",
    subscriptionKey: process.env.MTN_MOMO_SUBSCRIPTION_KEY || "",
    apiUser: process.env.MTN_MOMO_API_USER || "",
    apiKey: process.env.MTN_MOMO_API_KEY || "",
    targetEnvironment: process.env.MTN_MOMO_TARGET_ENV || "sandbox",
    callbackHost: process.env.MTN_MOMO_CALLBACK_HOST || "",
    collectionPrimaryKey: process.env.MTN_MOMO_COLLECTION_PRIMARY_KEY || "",
    configured: Boolean(
      process.env.MTN_MOMO_SUBSCRIPTION_KEY?.trim() &&
        process.env.MTN_MOMO_API_USER?.trim() &&
        process.env.MTN_MOMO_API_KEY?.trim()
    ),
    sandbox:
      flag("MTN_MOMO_SANDBOX") ||
      (process.env.MTN_MOMO_TARGET_ENV || "sandbox") === "sandbox",
  },
  airtelMoney: {
    baseUrl:
      process.env.AIRTEL_MONEY_BASE_URL ||
      "https://openapiuat.airtel.africa",
    clientId: process.env.AIRTEL_MONEY_CLIENT_ID || "",
    clientSecret: process.env.AIRTEL_MONEY_CLIENT_SECRET || "",
    country: process.env.AIRTEL_MONEY_COUNTRY || "UG",
    currency: process.env.AIRTEL_MONEY_CURRENCY || "UGX",
    configured: Boolean(
      process.env.AIRTEL_MONEY_CLIENT_ID?.trim() &&
        process.env.AIRTEL_MONEY_CLIENT_SECRET?.trim()
    ),
    sandbox: flag("AIRTEL_MONEY_SANDBOX") || globalSandboxPreferred(),
  },
  flutterwave: {
    baseUrl: process.env.FLUTTERWAVE_BASE_URL || "https://api.flutterwave.com/v3",
    secretKey: process.env.FLUTTERWAVE_SECRET_KEY || "",
    publicKey: process.env.FLUTTERWAVE_PUBLIC_KEY || "",
    webhookSecret: process.env.FLUTTERWAVE_WEBHOOK_SECRET || "",
    configured: Boolean(process.env.FLUTTERWAVE_SECRET_KEY?.trim()),
    sandbox:
      flag("FLUTTERWAVE_SANDBOX") ||
      (process.env.FLUTTERWAVE_SECRET_KEY || "").startsWith("FLWSECK_TEST"),
  },
  pesapal: {
    baseUrl:
      process.env.PESAPAL_BASE_URL ||
      "https://cybqa.pesapal.com/pesapalv3",
    consumerKey: process.env.PESAPAL_CONSUMER_KEY || "",
    consumerSecret: process.env.PESAPAL_CONSUMER_SECRET || "",
    ipnId: process.env.PESAPAL_IPN_ID || "",
    configured: Boolean(
      process.env.PESAPAL_CONSUMER_KEY?.trim() &&
        process.env.PESAPAL_CONSUMER_SECRET?.trim()
    ),
    sandbox: flag("PESAPAL_SANDBOX") || globalSandboxPreferred(),
  },
  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY || "",
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || "",
    configured: Boolean(process.env.STRIPE_SECRET_KEY?.trim()),
    sandbox:
      flag("STRIPE_SANDBOX") ||
      (process.env.STRIPE_SECRET_KEY || "").startsWith("sk_test"),
  },
  africastalking: {
    baseUrl:
      process.env.AFRICASTALKING_BASE_URL ||
      "https://api.africastalking.com/version1",
    apiKey: process.env.AFRICASTALKING_API_KEY || "",
    username: process.env.AFRICASTALKING_USERNAME || "sandbox",
    from: process.env.AFRICASTALKING_FROM || "",
    configured: Boolean(
      process.env.AFRICASTALKING_API_KEY?.trim() &&
        process.env.AFRICASTALKING_USERNAME?.trim()
    ),
    sandbox:
      flag("AFRICASTALKING_SANDBOX") ||
      (process.env.AFRICASTALKING_USERNAME || "sandbox") === "sandbox",
  },
  whatsapp: {
    baseUrl:
      process.env.WHATSAPP_BASE_URL || "https://graph.facebook.com/v19.0",
    accessToken: process.env.WHATSAPP_ACCESS_TOKEN || "",
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || "",
    verifyToken: process.env.WHATSAPP_VERIFY_TOKEN || "",
    appSecret: process.env.WHATSAPP_APP_SECRET || "",
    configured: Boolean(
      process.env.WHATSAPP_ACCESS_TOKEN?.trim() &&
        process.env.WHATSAPP_PHONE_NUMBER_ID?.trim()
    ),
    sandbox: flag("WHATSAPP_SANDBOX") || globalSandboxPreferred(),
  },
  fcm: {
    serverKey: process.env.FCM_SERVER_KEY || "",
    projectId: process.env.FCM_PROJECT_ID || "",
    configured: Boolean(process.env.FCM_SERVER_KEY?.trim()),
    sandbox: flag("FCM_SANDBOX") || globalSandboxPreferred(),
  },
  onesignal: {
    appId: process.env.ONESIGNAL_APP_ID || "",
    apiKey: process.env.ONESIGNAL_API_KEY || "",
    configured: Boolean(
      process.env.ONESIGNAL_APP_ID?.trim() &&
        process.env.ONESIGNAL_API_KEY?.trim()
    ),
    sandbox: flag("ONESIGNAL_SANDBOX") || globalSandboxPreferred(),
  },
  mapbox: {
    accessToken:
      process.env.MAPBOX_ACCESS_TOKEN ||
      process.env.NEXT_PUBLIC_MAPBOX_TOKEN ||
      "",
    baseUrl: "https://api.mapbox.com",
    configured: Boolean(
      process.env.MAPBOX_ACCESS_TOKEN?.trim() ||
        process.env.NEXT_PUBLIC_MAPBOX_TOKEN?.trim()
    ),
  },
  qstash: {
    token: process.env.QSTASH_TOKEN || "",
    currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY || "",
    nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY || "",
    baseUrl: process.env.QSTASH_URL || "https://qstash.upstash.io",
    configured: Boolean(process.env.QSTASH_TOKEN?.trim()),
  },
  turnstile: {
    siteKey:
      process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ||
      process.env.NEXT_PUBLIC_CAPTCHA_SITE_KEY ||
      "",
    secretKey:
      process.env.TURNSTILE_SECRET_KEY ||
      process.env.CAPTCHA_SECRET_KEY ||
      "",
    configured: Boolean(
      (process.env.TURNSTILE_SECRET_KEY || process.env.CAPTCHA_SECRET_KEY || "")
        .trim()
    ),
  },
  documentAi: {
    endpoint: process.env.DOCUMENT_AI_ENDPOINT || "",
    apiKey: process.env.DOCUMENT_AI_API_KEY || "",
    processorId: process.env.DOCUMENT_AI_PROCESSOR_ID || "",
    configured: Boolean(
      process.env.DOCUMENT_AI_ENDPOINT?.trim() &&
        process.env.DOCUMENT_AI_API_KEY?.trim()
    ),
    sandbox: flag("DOCUMENT_AI_SANDBOX") || globalSandboxPreferred(),
  },
  docusign: {
    baseUrl:
      process.env.DOCUSIGN_BASE_URL || "https://demo.docusign.net/restapi",
    integrationKey: process.env.DOCUSIGN_INTEGRATION_KEY || "",
    accountId: process.env.DOCUSIGN_ACCOUNT_ID || "",
    userId: process.env.DOCUSIGN_USER_ID || "",
    privateKey: process.env.DOCUSIGN_PRIVATE_KEY || "",
    configured: Boolean(
      process.env.DOCUSIGN_INTEGRATION_KEY?.trim() &&
        process.env.DOCUSIGN_ACCOUNT_ID?.trim()
    ),
    sandbox: flag("DOCUSIGN_SANDBOX") || globalSandboxPreferred(),
  },
  billingWebhookSecret: process.env.BILLING_WEBHOOK_SECRET || "",
} as const;

export type ProvidersConfig = typeof providersConfig;
