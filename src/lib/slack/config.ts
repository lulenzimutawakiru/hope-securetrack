/**
 * Platform-level Slack SecureChat app credentials (env only — never client).
 * Per-company bot tokens live in intg_slack_workspaces.
 */

export function slackPlatformConfig() {
  return {
    appId: process.env.SLACK_APP_ID || "",
    clientId: process.env.SLACK_CLIENT_ID || "",
    clientSecret: process.env.SLACK_CLIENT_SECRET || "",
    signingSecret: process.env.SLACK_SIGNING_SECRET || "",
    /** Deprecated verification token — prefer signing secret */
    verificationToken: process.env.SLACK_VERIFICATION_TOKEN || "",
    appToken: process.env.SLACK_APP_TOKEN || "",
    configured: Boolean(
      process.env.SLACK_CLIENT_ID?.trim() &&
        process.env.SLACK_CLIENT_SECRET?.trim() &&
        process.env.SLACK_SIGNING_SECRET?.trim()
    ),
  };
}

export function slackRedirectUri(origin?: string): string {
  let base = origin || process.env.NEXT_PUBLIC_APP_URL || "";
  if (!base && process.env.VERCEL_URL) {
    base = `https://${process.env.VERCEL_URL}`;
  }
  if (!base) base = "http://localhost:3000";
  const clean = base.replace(/\/$/, "");
  return `${clean}/api/v2/integrations/slack/oauth/callback`;
}
