/**
 * Platform / connection credentials for MTN KYC Verification API.
 * Prefer env; company connection can override base URL via intg later.
 */

export function mtnKycConfig() {
  const baseUrl = (
    process.env.MTN_KYC_BASE_URL ||
    "https://api.mtn.com/v1/kycVerification"
  ).replace(/\/$/, "");

  const apiKey = process.env.MTN_KYC_API_KEY || process.env.MTN_API_KEY || "";
  const basicUser =
    process.env.MTN_KYC_BASIC_USER || process.env.MTN_BASIC_USER || "";
  const basicPass =
    process.env.MTN_KYC_BASIC_PASSWORD || process.env.MTN_BASIC_PASSWORD || "";
  const defaultTarget =
    process.env.MTN_KYC_TARGET_SYSTEM || "NIBSS";

  const hasBasic = Boolean(basicUser && basicPass);
  const hasKey = Boolean(apiKey.trim());

  return {
    baseUrl,
    apiKey: apiKey.trim(),
    basicUser,
    basicPass,
    defaultTargetSystem: defaultTarget,
    /** Swagger security requires both ApiKeyAuth and basicAuth */
    configured: hasKey && hasBasic,
    hasApiKey: hasKey,
    hasBasic,
    /** Sandbox / mock responses when true (never hits MTN) */
    sandbox:
      process.env.MTN_KYC_SANDBOX === "true" ||
      process.env.MTN_KYC_SANDBOX === "1" ||
      (process.env.NODE_ENV !== "production" &&
        process.env.MTN_KYC_SANDBOX !== "false"),
  };
}

export function mtnKycBasicAuthHeader(user: string, pass: string): string {
  const token =
    typeof Buffer !== "undefined"
      ? Buffer.from(`${user}:${pass}`, "utf8").toString("base64")
      : btoa(`${user}:${pass}`);
  return `Basic ${token}`;
}
