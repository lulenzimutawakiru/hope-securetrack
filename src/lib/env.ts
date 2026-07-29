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
    name: process.env.NEXT_PUBLIC_APP_NAME || "Hope SecureTrack",
    company: process.env.NEXT_PUBLIC_COMPANY_NAME || "Hope Design Group Ltd",
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
  },
  companyId:
    process.env.DEFAULT_COMPANY_ID || "a0000000-0000-4000-8000-000000000001",
  resend: {
    apiKey: process.env.RESEND_API_KEY || "",
    fromEmail: process.env.RESEND_FROM_EMAIL || "",
    fromName: process.env.RESEND_FROM_NAME || "",
    replyTo: process.env.RESEND_REPLY_TO || "",
    configured: Boolean(process.env.RESEND_API_KEY?.trim()),
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
