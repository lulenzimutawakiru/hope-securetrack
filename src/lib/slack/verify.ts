/**
 * Verify Slack request signatures (v0 HMAC-SHA256).
 * https://api.slack.com/authentication/verifying-requests-from-slack
 */

import { createHmac, timingSafeEqual } from "crypto";
import { slackPlatformConfig } from "./config";

export function verifySlackSignature(input: {
  signature: string | null;
  timestamp: string | null;
  rawBody: string;
  maxAgeSec?: number;
}): { ok: true } | { ok: false; error: string } {
  const { signingSecret } = slackPlatformConfig();
  if (!signingSecret) {
    return { ok: false, error: "SLACK_SIGNING_SECRET not configured" };
  }
  if (!input.signature || !input.timestamp) {
    return { ok: false, error: "Missing Slack signature headers" };
  }
  const ts = Number(input.timestamp);
  if (!Number.isFinite(ts)) {
    return { ok: false, error: "Invalid Slack timestamp" };
  }
  const maxAge = input.maxAgeSec ?? 60 * 5;
  const age = Math.abs(Math.floor(Date.now() / 1000) - ts);
  if (age > maxAge) {
    return { ok: false, error: "Slack request timestamp too old" };
  }

  const base = `v0:${input.timestamp}:${input.rawBody}`;
  const digest =
    "v0=" +
    createHmac("sha256", signingSecret).update(base, "utf8").digest("hex");

  try {
    const a = Buffer.from(digest);
    const b = Buffer.from(input.signature);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      return { ok: false, error: "Invalid Slack signature" };
    }
  } catch {
    return { ok: false, error: "Invalid Slack signature" };
  }
  return { ok: true };
}
