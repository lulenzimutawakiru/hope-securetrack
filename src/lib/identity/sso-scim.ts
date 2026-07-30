/**
 * Enterprise SSO / SCIM contracts — configuration model for Entra/Okta/Google.
 * UI exists at /dashboard/identity/sso; this module is the server-side contract
 * without requiring a full IdP implementation in-core (customer-specific).
 */

export type SsoProtocol = "oidc" | "saml2" | "oauth2";

export type SsoProviderConfig = {
  id?: string;
  company_id: string;
  tenant_id?: string | null;
  name: string;
  protocol: SsoProtocol;
  enabled: boolean;
  /** OIDC */
  issuer?: string;
  client_id?: string;
  client_secret_ref?: string; // vault key — never store raw secret in app tables long-term
  /** SAML */
  entity_id?: string;
  sso_url?: string;
  certificate_pem?: string;
  /** Attribute mapping */
  email_claim?: string;
  name_claim?: string;
  groups_claim?: string;
  /** JIT provisioning */
  jit_provision?: boolean;
  default_role_slug?: string;
};

export type ScimConfig = {
  company_id: string;
  enabled: boolean;
  bearer_token_hash?: string;
  base_url?: string;
  sync_users?: boolean;
  sync_groups?: boolean;
  deprovision_on_delete?: boolean;
};

export const SSO_SETUP_CHECKLIST = [
  "Register SecureTrack as OIDC/SAML app in IdP",
  "Configure redirect URI: {APP_URL}/api/auth/callback/sso",
  "Map email + groups claims",
  "Enable JIT or SCIM provisioning",
  "Require MFA at IdP for privileged groups",
  "Test maker/checker accounts with dual-control",
] as const;

/**
 * Validate minimal OIDC config before enabling.
 */
export function validateOidcConfig(
  cfg: SsoProviderConfig
): { ok: true } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  if (cfg.protocol !== "oidc" && cfg.protocol !== "oauth2") {
    /* saml validated separately */
  } else {
    if (!cfg.issuer) errors.push("issuer required");
    if (!cfg.client_id) errors.push("client_id required");
  }
  if (cfg.protocol === "saml2") {
    if (!cfg.sso_url) errors.push("sso_url required");
    if (!cfg.entity_id) errors.push("entity_id required");
  }
  if (!cfg.name) errors.push("name required");
  return errors.length ? { ok: false, errors } : { ok: true };
}
