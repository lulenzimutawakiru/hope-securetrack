/**
 * Platform credentials for MTN MADAPI OAuth2 (Swagger v1.1).
 *
 * POST {baseUrl}/access_token
 *   query:  grant_type=client_credentials
 *   form:   client_id, client_secret  (application/x-www-form-urlencoded)
 *
 * The bearer token obtained here is shared across MADAPI products
 * (Customer KYC Verification, etc.), not just this module.
 */

export function mtnOauthConfig() {
  const baseUrl = (
    process.env.MTN_OAUTH_BASE_URL ||
    "https://api.mtn.com/v1/oauth"
  ).replace(/\/$/, "");

  const clientId =
    process.env.MTN_OAUTH_CLIENT_ID || process.env.MTN_CLIENT_ID || "";
  const clientSecret =
    process.env.MTN_OAUTH_CLIENT_SECRET || process.env.MTN_CLIENT_SECRET || "";
  const grantType = process.env.MTN_OAUTH_GRANT_TYPE || "client_credentials";

  return {
    baseUrl,
    clientId: clientId.trim(),
    clientSecret,
    grantType,
    /** client_credentials grant requires client id + secret */
    configured: Boolean(clientId.trim() && clientSecret.trim()),
    /** Sandbox / mock responses when true (never hits MTN) */
    sandbox:
      process.env.MTN_OAUTH_SANDBOX === "true" ||
      process.env.MTN_OAUTH_SANDBOX === "1" ||
      (process.env.NODE_ENV !== "production" &&
        process.env.MTN_OAUTH_SANDBOX !== "false"),
  };
}