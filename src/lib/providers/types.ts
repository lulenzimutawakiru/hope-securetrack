/**
 * External provider contracts shared across payments, comms, maps, SIEM.
 */

export type ProviderCode =
  | "mtn_momo"
  | "airtel_money"
  | "flutterwave"
  | "pesapal"
  | "stripe"
  | "paypal"
  | "africastalking"
  | "whatsapp"
  | "fcm"
  | "onesignal"
  | "mapbox"
  | "qstash"
  | "turnstile"
  | "splunk"
  | "elastic"
  | "sentinel"
  | "webhook"
  | "document_ai"
  | "docusign";

export type ProviderCallResult<T = Record<string, unknown>> = {
  ok: boolean;
  status?: number;
  provider: ProviderCode | string;
  sandbox?: boolean;
  error?: string;
  externalId?: string;
  data?: T;
  raw?: unknown;
};

export type PaymentCollectInput = {
  companyId: string;
  amount: number;
  currency: string;
  externalRef: string;
  phone?: string | null;
  email?: string | null;
  description?: string;
  callbackUrl?: string;
  returnUrl?: string;
  metadata?: Record<string, unknown>;
};

export type PaymentCollectResult = ProviderCallResult<{
  checkoutUrl?: string | null;
  providerRef?: string | null;
  status?: string;
}>;

export type SmsInput = {
  to: string | string[];
  message: string;
  from?: string;
  companyId?: string;
};

export type WhatsAppInput = {
  to: string;
  message: string;
  templateName?: string;
  templateLang?: string;
  templateParams?: string[];
  companyId?: string;
};

export type PushInput = {
  tokens?: string[];
  topic?: string;
  title: string;
  body: string;
  data?: Record<string, string>;
  companyId?: string;
};

export type MapGeocodeInput = {
  query: string;
  country?: string;
  limit?: number;
};

export type MapDirectionsInput = {
  origin: [number, number]; // [lng, lat]
  destination: [number, number];
  waypoints?: [number, number][];
  profile?: "driving" | "driving-traffic" | "walking" | "cycling";
};

export type CaptchaVerifyInput = {
  token: string;
  remoteIp?: string | null;
};

export type SiemDeliverInput = {
  endpointUrl: string;
  provider: string;
  payload: Record<string, unknown>;
  headers?: Record<string, string>;
  token?: string | null;
};

export type ProviderStatus = {
  code: string;
  label: string;
  category: "payments" | "comms" | "maps" | "jobs" | "security" | "siem" | "docs";
  configured: boolean;
  sandbox: boolean;
  notes?: string;
};
