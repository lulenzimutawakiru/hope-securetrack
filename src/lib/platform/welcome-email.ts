/**
 * Welcome email after successful tenant provisioning.
 * Non-blocking — provision succeeds even if email fails.
 */

import {
  isResendConfigured,
  sendEmail,
  wrapBrandedEmailHtml,
} from "@/lib/email/resend";
import { APP_NAME, APP_TAGLINE } from "@/lib/constants";

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function sendTenantWelcomeEmail(opts: {
  to: string;
  adminName?: string | null;
  organizationName: string;
  planCode: string;
  slug: string;
  loginUrl: string;
  setupUrl: string;
}): Promise<{ sent: boolean; error?: string }> {
  if (!isResendConfigured()) {
    return { sent: false, error: "email_not_configured" };
  }

  const name = opts.adminName?.trim() || "Administrator";
  const plan = opts.planCode || "starter";
  const bodyHtml = `
    <p style="margin:0 0 12px;">Hello ${esc(name)},</p>
    <p style="margin:0 0 12px;">
      <strong>${esc(opts.organizationName)}</strong> is ready on ${esc(APP_NAME)}.
      Your tenant (<code>${esc(opts.slug)}</code>) is on the <strong>${esc(plan)}</strong> plan.
    </p>
    <p style="margin:0 0 12px;">Next steps:</p>
    <ol style="margin:0 0 16px;padding-left:20px;">
      <li>Sign in with this email and the password you chose during registration.</li>
      <li>Complete the go-live setup wizard (branding, team invites, company details).</li>
      <li>Invite finance, HR, and operations leads from Identity.</li>
    </ol>
    <p style="margin:0 0 16px;">
      <a href="${esc(opts.loginUrl)}" style="display:inline-block;background:#0f766e;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;font-weight:600;">
        Sign in to ${esc(APP_NAME)}
      </a>
    </p>
    <p style="margin:0 0 8px;font-size:13px;color:#64748b;">
      Setup wizard: <a href="${esc(opts.setupUrl)}">${esc(opts.setupUrl)}</a>
    </p>
    <p style="margin:0;font-size:12px;color:#94a3b8;">${esc(APP_TAGLINE)}</p>
  `;

  const html = wrapBrandedEmailHtml({
    title: `Welcome to ${APP_NAME}`,
    bodyHtml,
    preheader: `${opts.organizationName} is ready on ${APP_NAME}`,
    footerNote: "You received this because an organization was provisioned with this email.",
  });

  const result = await sendEmail({
    to: opts.to,
    subject: `${opts.organizationName} is live on ${APP_NAME}`,
    html,
    tags: [
      { name: "category", value: "tenant-onboarding" },
      { name: "plan", value: plan.slice(0, 40) },
    ],
  });

  if (!result.ok) {
    return { sent: false, error: result.error };
  }
  return { sent: true };
}
