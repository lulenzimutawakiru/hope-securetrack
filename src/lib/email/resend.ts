/**
 * Hope SecureTrack — Resend email / notification transport
 * API key never leaves the server (RESEND_API_KEY).
 */

import { Resend } from "resend";
import { env } from "@/lib/env";

export type SendEmailInput = {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  replyTo?: string | string[];
  cc?: string | string[];
  bcc?: string | string[];
  tags?: Array<{ name: string; value: string }>;
  /** Idempotency / correlation */
  headers?: Record<string, string>;
};

export type SendEmailResult =
  | { ok: true; id: string }
  | { ok: false; error: string; code?: string };

let client: Resend | null = null;

export function isResendConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY?.trim());
}

export function getResendFrom(): { email: string; name: string } {
  const email =
    process.env.RESEND_FROM_EMAIL?.trim() ||
    "Hope SecureTrack <onboarding@resend.dev>";
  const name =
    process.env.RESEND_FROM_NAME?.trim() ||
    env.app.name ||
    "Hope SecureTrack";
  // If email already includes "Name <addr>", Resend accepts it as `from`
  return { email, name };
}

export function getResendClient(): Resend | null {
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) return null;
  if (!client) client = new Resend(key);
  return client;
}

/** Replace {{var}} placeholders in subject/body templates */
export function applyTemplateVars(
  template: string,
  vars: Record<string, string | number | null | undefined>
): string {
  return template.replace(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g, (_, key: string) => {
    const v = vars[key];
    return v == null ? "" : String(v);
  });
}

export function wrapEmailHtml(opts: {
  title?: string;
  bodyHtml: string;
  preheader?: string;
  footerNote?: string;
}): string {
  const company = env.app.company;
  const app = env.app.name;
  const pre = opts.preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;">${escapeHtml(opts.preheader)}</div>`
    : "";
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(opts.title || app)}</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Inter,Segoe UI,system-ui,sans-serif;color:#0f172a;">
  ${pre}
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f1f5f9;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;">
          <tr>
            <td style="background:linear-gradient(135deg,#0B1F3A 0%,#0d2847 100%);padding:20px 24px;">
              <div style="color:#C9A227;font-size:11px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;">${escapeHtml(company)}</div>
              <div style="color:#ffffff;font-size:18px;font-weight:600;margin-top:4px;">${escapeHtml(opts.title || app)}</div>
            </td>
          </tr>
          <tr>
            <td style="padding:24px;font-size:14px;line-height:1.6;color:#334155;">
              ${opts.bodyHtml}
            </td>
          </tr>
          <tr>
            <td style="padding:16px 24px;background:#f8fafc;border-top:1px solid #e2e8f0;font-size:11px;color:#64748b;">
              ${escapeHtml(opts.footerNote || `${app} · ${company} · Security Printing · Paper · Engineering`)}
              <br />This is an automated message. Please do not reply unless a reply-to address is provided.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Convert plain text / simple template body to HTML paragraphs */
export function textToEmailHtml(body: string): string {
  const escaped = escapeHtml(body);
  const withBreaks = escaped.replace(/\n/g, "<br />");
  return `<p style="margin:0 0 12px;">${withBreaks}</p>`;
}

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const resend = getResendClient();
  if (!resend) {
    return {
      ok: false,
      error: "Resend is not configured. Set RESEND_API_KEY on the server.",
      code: "NOT_CONFIGURED",
    };
  }

  const to = Array.isArray(input.to) ? input.to : [input.to];
  if (!to.length || !to[0]) {
    return { ok: false, error: "Recipient email is required", code: "INVALID_TO" };
  }

  const fromCfg = getResendFrom();
  const from = fromCfg.email.includes("<")
    ? fromCfg.email
    : `${fromCfg.name} <${fromCfg.email}>`;

  const text =
    input.text ||
    (input.html ? input.html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() : "");
  const html =
    input.html ||
    wrapEmailHtml({
      title: input.subject,
      bodyHtml: textToEmailHtml(text || input.subject),
      preheader: input.subject,
    });

  if (!html && !text) {
    return { ok: false, error: "Email body is required", code: "EMPTY_BODY" };
  }

  try {
    const payload = {
      from,
      to,
      subject: input.subject,
      html,
      text: text || undefined,
      replyTo: input.replyTo || process.env.RESEND_REPLY_TO || undefined,
      cc: input.cc,
      bcc: input.bcc,
      tags: input.tags,
      headers: input.headers,
    };
    // Resend CreateEmailOptions is a discriminated union (html | text | react | template)
    const { data, error } = await resend.emails.send(
      payload as Parameters<Resend["emails"]["send"]>[0]
    );

    if (error) {
      return {
        ok: false,
        error: error.message || "Resend API error",
        code: "RESEND_ERROR",
      };
    }

    return { ok: true, id: data?.id || "unknown" };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Failed to send email",
      code: "EXCEPTION",
    };
  }
}

export async function sendTemplatedEmail(opts: {
  to: string | string[];
  subjectTemplate: string;
  bodyTemplate: string;
  vars?: Record<string, string | number | null | undefined>;
  tags?: Array<{ name: string; value: string }>;
}): Promise<SendEmailResult> {
  const vars = opts.vars ?? {};
  const subject = applyTemplateVars(opts.subjectTemplate, vars);
  const bodyText = applyTemplateVars(opts.bodyTemplate, vars);
  const html = wrapEmailHtml({
    title: subject,
    bodyHtml: textToEmailHtml(bodyText),
    preheader: subject,
  });
  return sendEmail({
    to: opts.to,
    subject,
    html,
    text: bodyText,
    tags: opts.tags,
  });
}
