/**
 * Central environment access for enterprise deployments.
 * Public vars are safe for the browser; server vars never ship client-side.
 */

function required(name: string, value: string | undefined): string {
  if (!value) {
    if (process.env.NODE_ENV === "production") {
      console.error(`[env] Missing required environment variable: ${name}`);
    }
    return "";
  }
  return value;
}

export const env = {
  app: {
    name: process.env.NEXT_PUBLIC_APP_NAME || "SecureTrack ERP",
    company: process.env.NEXT_PUBLIC_COMPANY_NAME || "SecureTrack ERP",
    url:
      process.env.NEXT_PUBLIC_APP_URL ||
      (typeof window !== "undefined" ? window.location.origin : "http://localhost:3000"),
    isProd: process.env.NODE_ENV === "production",
  },
  supabase: {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
  },
  security: {
    qrEncryptionKey: process.env.QR_ENCRYPTION_KEY || "",
    qrSigningPrivateKey: process.env.QR_SIGNING_PRIVATE_KEY || "",
    qrSigningPublicKey: process.env.QR_SIGNING_PUBLIC_KEY || "",
    /** Production defaults ON; set MFA_ENFORCE_PRIVILEGED=false to disable */
    mfaEnforcePrivileged:
      process.env.MFA_ENFORCE_PRIVILEGED === "false" ||
      process.env.MFA_ENFORCE_PRIVILEGED === "0"
        ? false
        : process.env.MFA_ENFORCE_PRIVILEGED === "true" ||
          process.env.MFA_ENFORCE_PRIVILEGED === "1" ||
          process.env.NODE_ENV === "production",
    /** Production defaults ON; set DUAL_CONTROL_REQUIRED=false to disable */
    dualControlRequired:
      process.env.DUAL_CONTROL_REQUIRED === "false" ||
      process.env.DUAL_CONTROL_REQUIRED === "0"
        ? false
        : process.env.DUAL_CONTROL_REQUIRED === "true" ||
          process.env.DUAL_CONTROL_REQUIRED === "1" ||
          process.env.NODE_ENV === "production",
  },
  /** Prefer resolving company from product/context; env only as last resort */
  companyId: process.env.DEFAULT_COMPANY_ID || "",
  resend: {
    apiKey: process.env.RESEND_API_KEY || "",
    fromEmail: process.env.RESEND_FROM_EMAIL || "",
    fromName: process.env.RESEND_FROM_NAME || "",
    replyTo: process.env.RESEND_REPLY_TO || "",
    configured: Boolean(process.env.RESEND_API_KEY?.trim()),
  },
  ai: {
    apiKey:
      process.env.SECURETRACK_AI_API_KEY ||
      process.env.OPENAI_API_KEY ||
      process.env.XAI_API_KEY ||
      "",
    baseUrl:
      process.env.SECURETRACK_AI_BASE_URL ||
      process.env.OPENAI_BASE_URL ||
      "https://api.openai.com/v1",
    model:
      process.env.SECURETRACK_AI_MODEL ||
      process.env.OPENAI_MODEL ||
      "gpt-4o-mini",
    disabled: process.env.SECURETRACK_AI_DISABLED === "true",
    configured: Boolean(
      process.env.SECURETRACK_AI_API_KEY ||
        process.env.OPENAI_API_KEY ||
        process.env.XAI_API_KEY
    ),
  },
  /** Platform Slack SecureChat app (secrets server-only) */
  slack: {
    appId: process.env.SLACK_APP_ID || "",
    clientId: process.env.SLACK_CLIENT_ID || "",
    configured: Boolean(
      process.env.SLACK_CLIENT_ID?.trim() &&
        process.env.SLACK_CLIENT_SECRET?.trim() &&
        process.env.SLACK_SIGNING_SECRET?.trim()
    ),
  },
  /** MTN MADAPI Customer KYC Verification (server-only) */
  mtnKyc: {
    baseUrl:
      process.env.MTN_KYC_BASE_URL ||
      "https://api.mtn.com/v1/kycVerification",
    configured: Boolean(
      process.env.MTN_KYC_API_KEY?.trim() &&
        process.env.MTN_KYC_BASIC_USER?.trim() &&
        process.env.MTN_KYC_BASIC_PASSWORD?.trim()
    ),
    sandbox:
      process.env.MTN_KYC_SANDBOX === "true" ||
      process.env.MTN_KYC_SANDBOX === "1",
  },

  /** MTN MADAPI OAuth2 access token (server-only) */
  mtnOauth: {
    baseUrl:
      process.env.MTN_OAUTH_BASE_URL ||
      "https://api.mtn.com/v1/oauth",
    configured: Boolean(
      process.env.MTN_OAUTH_CLIENT_ID?.trim() &&
        process.env.MTN_OAUTH_CLIENT_SECRET?.trim()
    ),
    sandbox:
      process.env.MTN_OAUTH_SANDBOX === "true" ||
      process.env.MTN_OAUTH_SANDBOX === "1",
  },

  redis: {
    upstashUrl: process.env.UPSTASH_REDIS_REST_URL || "",
    upstashToken: process.env.UPSTASH_REDIS_REST_TOKEN || "",
    configured: Boolean(
      process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ),
  },
};

export function assertServerEnv(): { ok: boolean; missing: string[] } {
  const missing: string[] = [];
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) missing.push("NEXT_PUBLIC_SUPABASE_URL");
  if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
    missing.push("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY)
    missing.push("SUPABASE_SERVICE_ROLE_KEY");
  return { ok: missing.length === 0, missing };
}

export function getPublicConfig() {
  return {
    appName: env.app.name,
    companyName: env.app.company,
    appUrl: env.app.url,
    supabaseConfigured: Boolean(
      process.env.NEXT_PUBLIC_SUPABASE_URL &&
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    ),
  };
}
