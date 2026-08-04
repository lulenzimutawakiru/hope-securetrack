/**
 * OIDC / Entra / Google SSO helpers for SecureTrack.
 * Secrets resolved from env refs (client_secret_ref) — never from browser.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { createHmac, randomBytes, timingSafeEqual } from "crypto";

export type SsoProviderRow = {
  id: string;
  company_id: string;
  provider_code: string;
  name: string;
  protocol: string;
  client_id: string | null;
  client_secret_ref: string | null;
  issuer_url: string | null;
  metadata_url: string | null;
  authorize_url: string | null;
  token_url: string | null;
  userinfo_url: string | null;
  auto_provision: boolean | null;
  is_active: boolean | null;
  default_role_id: string | null;
  config: Record<string, unknown> | null;
};

export type OidcDiscovery = {
  authorization_endpoint: string;
  token_endpoint: string;
  userinfo_endpoint?: string;
  end_session_endpoint?: string;
  jwks_uri?: string;
};

const STATE_TTL_MS = 10 * 60 * 1000;

function stateSecret(): string {
  return (
    process.env.SSO_STATE_SECRET ||
    process.env.QR_ENCRYPTION_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    "dev-sso-state"
  );
}

/** Signed state blob: base64url(payload).sig */
export function createSsoState(payload: {
  providerId: string;
  companyId: string;
  nonce: string;
  returnTo?: string;
}): string {
  const body = Buffer.from(
    JSON.stringify({ ...payload, exp: Date.now() + STATE_TTL_MS })
  ).toString("base64url");
  const sig = createHmac("sha256", stateSecret()).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function parseSsoState(state: string): {
  providerId: string;
  companyId: string;
  nonce: string;
  returnTo?: string;
} | null {
  try {
    const [body, sig] = state.split(".");
    if (!body || !sig) return null;
    const expected = createHmac("sha256", stateSecret())
      .update(body)
      .digest("base64url");
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    const json = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as {
      providerId: string;
      companyId: string;
      nonce: string;
      returnTo?: string;
      exp?: number;
    };
    if (!json.exp || json.exp < Date.now()) return null;
    return json;
  } catch {
    return null;
  }
}

export function newNonce(): string {
  return randomBytes(16).toString("hex");
}

/** Resolve client secret from ref: ENV:VAR_NAME or raw env SSO_{CODE}_CLIENT_SECRET */
export function resolveClientSecret(
  provider: SsoProviderRow
): string | null {
  const ref = provider.client_secret_ref?.trim();
  if (ref?.startsWith("ENV:")) {
    return process.env[ref.slice(4)]?.trim() || null;
  }
  if (ref && process.env[ref]) return process.env[ref]!.trim();

  const code = provider.provider_code.toUpperCase().replace(/[^A-Z0-9]/g, "_");
  const byCode =
    process.env[`SSO_${code}_CLIENT_SECRET`] ||
    process.env.SSO_ENTRA_CLIENT_SECRET ||
    process.env.AZURE_AD_CLIENT_SECRET ||
    process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  if (byCode?.trim()) return byCode.trim();

  // Optional: secret in config only for non-prod sandbox (discouraged)
  if (
    process.env.NODE_ENV !== "production" &&
    typeof provider.config?.client_secret === "string"
  ) {
    return String(provider.config.client_secret);
  }
  return null;
}

export async function discoverOidc(
  issuerOrMetadata: string
): Promise<OidcDiscovery | null> {
  const base = issuerOrMetadata.replace(/\/$/, "");
  const url = base.includes(".well-known")
    ? base
    : `${base}/.well-known/openid-configuration`;
  try {
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      next: { revalidate: 3600 },
    } as RequestInit);
    if (!res.ok) return null;
    return (await res.json()) as OidcDiscovery;
  } catch {
    return null;
  }
}

export async function resolveOidcEndpoints(
  provider: SsoProviderRow
): Promise<OidcDiscovery | null> {
  if (provider.authorize_url && provider.token_url) {
    return {
      authorization_endpoint: provider.authorize_url,
      token_endpoint: provider.token_url,
      userinfo_endpoint: provider.userinfo_url || undefined,
    };
  }
  const issuer =
    provider.metadata_url ||
    provider.issuer_url ||
    (provider.provider_code === "entra" || provider.provider_code === "azure"
      ? process.env.SSO_ENTRA_ISSUER ||
        (process.env.AZURE_AD_TENANT_ID
          ? `https://login.microsoftonline.com/${process.env.AZURE_AD_TENANT_ID}/v2.0`
          : null)
      : null) ||
    (provider.provider_code === "google"
      ? "https://accounts.google.com"
      : null);
  if (!issuer) return null;
  return discoverOidc(issuer);
}

export async function loadActiveProvider(opts: {
  providerId?: string;
  providerCode?: string;
  companyId?: string;
}): Promise<SsoProviderRow | null> {
  const admin = createAdminClient();
  let q = admin
    .from("idm_sso_providers")
    .select("*")
    .eq("is_active", true)
    .limit(1);

  if (opts.providerId) q = q.eq("id", opts.providerId);
  if (opts.providerCode) q = q.eq("provider_code", opts.providerCode);
  if (opts.companyId) q = q.eq("company_id", opts.companyId);

  const { data } = await q.maybeSingle();
  return (data as SsoProviderRow) || null;
}

export async function listPublicSsoProviders(companyId?: string | null) {
  const admin = createAdminClient();
  let q = admin
    .from("idm_sso_providers")
    .select(
      "id, company_id, provider_code, name, protocol, is_active, issuer_url"
    )
    .eq("is_active", true)
    .order("name");
  if (companyId) q = q.eq("company_id", companyId);
  const { data } = await q.limit(20);
  return data || [];
}

export type TokenResponse = {
  access_token?: string;
  id_token?: string;
  token_type?: string;
  expires_in?: number;
  refresh_token?: string;
};

export async function exchangeCode(opts: {
  tokenUrl: string;
  code: string;
  redirectUri: string;
  clientId: string;
  clientSecret: string;
}): Promise<TokenResponse> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code: opts.code,
    redirect_uri: opts.redirectUri,
    client_id: opts.clientId,
    client_secret: opts.clientSecret,
  });
  const res = await fetch(opts.tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: body.toString(),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Token exchange failed: ${res.status} ${t.slice(0, 200)}`);
  }
  return (await res.json()) as TokenResponse;
}

export type OidcUserInfo = {
  sub: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  given_name?: string;
  family_name?: string;
  preferred_username?: string;
};

export async function fetchUserInfo(
  userinfoUrl: string,
  accessToken: string
): Promise<OidcUserInfo> {
  const res = await fetch(userinfoUrl, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`userinfo failed: ${res.status}`);
  return (await res.json()) as OidcUserInfo;
}

/** Decode JWT payload without verify (we trust token endpoint + TLS). */
export function decodeIdTokenPayload(idToken: string): OidcUserInfo | null {
  try {
    const part = idToken.split(".")[1];
    if (!part) return null;
    return JSON.parse(Buffer.from(part, "base64url").toString("utf8")) as OidcUserInfo;
  } catch {
    return null;
  }
}

/**
 * Provision or link user after successful IdP auth; return magic-link URL for session.
 */
export async function provisionSsoUser(opts: {
  provider: SsoProviderRow;
  subject: string;
  email: string;
  fullName?: string;
}): Promise<{ actionLink: string; userId: string; created: boolean }> {
  const admin = createAdminClient();
  const email = opts.email.toLowerCase().trim();
  if (!email.includes("@")) throw new Error("IdP did not return a valid email");

  // Existing SSO link?
  const { data: link } = await admin
    .from("idm_sso_links")
    .select("user_id")
    .eq("provider_id", opts.provider.id)
    .eq("external_subject", opts.subject)
    .maybeSingle();

  let userId = link?.user_id as string | undefined;
  let created = false;

  if (!userId) {
    // Find by email in profiles / auth
    const { data: profile } = await admin
      .from("user_profiles")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    if (profile?.id) {
      userId = profile.id as string;
    } else if (opts.provider.auto_provision !== false) {
      const names = (opts.fullName || email.split("@")[0] || "User").split(/\s+/);
      const { data: createdUser, error } = await admin.auth.admin.createUser({
        email,
        email_confirm: true,
        user_metadata: {
          full_name: opts.fullName,
          sso_provider: opts.provider.provider_code,
        },
      });
      if (error || !createdUser.user) {
        // User may already exist in auth
        const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 });
        const found = list?.users?.find(
          (u) => u.email?.toLowerCase() === email
        );
        if (!found) throw error || new Error("Failed to create SSO user");
        userId = found.id;
      } else {
        userId = createdUser.user.id;
        created = true;
      }

      // Ensure profile
      await admin.from("user_profiles").upsert(
        {
          id: userId,
          email,
          company_id: opts.provider.company_id,
          first_name: names[0] || "User",
          last_name: names.slice(1).join(" ") || "",
          is_active: true,
        },
        { onConflict: "id" }
      );

      if (opts.provider.default_role_id) {
        try {
          await admin
            .from("user_profiles")
            .update({ role_id: opts.provider.default_role_id })
            .eq("id", userId);
        } catch {
          /* optional */
        }
      }
    } else {
      throw new Error("No local account for this identity (auto-provision off)");
    }

    await admin.from("idm_sso_links").upsert(
      {
        company_id: opts.provider.company_id,
        user_id: userId!,
        provider_id: opts.provider.id,
        external_subject: opts.subject,
        external_email: email,
        linked_at: new Date().toISOString(),
      },
      { onConflict: "provider_id,external_subject" }
    );
  }

  const { data: linkData, error: linkErr } =
    await admin.auth.admin.generateLink({
      type: "magiclink",
      email,
      options: {
        redirectTo: `${(process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "")}/dashboard`,
      },
    });

  if (linkErr || !linkData?.properties?.action_link) {
    throw linkErr || new Error("Failed to generate session link");
  }

  return {
    actionLink: linkData.properties.action_link,
    userId: userId!,
    created,
  };
}
