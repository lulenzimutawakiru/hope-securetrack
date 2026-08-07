import { NextRequest, NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { ingressRateLimit } from "@/lib/security/public-ingress";
import { rateLimitStrict } from "@/lib/api";
import {
  isResendConfigured,
  sendEmail,
  wrapBrandedEmailHtml,
  textToEmailHtml,
} from "@/lib/email/resend";
import { COMPANY } from "@/lib/marketing/data";
import {
  INDUSTRY_OPTIONS,
  COMPANY_SIZE_OPTIONS,
  CONTACT_METHOD_OPTIONS,
} from "@/lib/marketing/lead-options";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const bodySchema = z.object({
  name: z.string().trim().min(2).max(150),
  email: z.string().trim().toLowerCase().email().max(255),
  company: z.string().trim().min(2).max(150),
  industry: z
    .string()
    .trim()
    .max(120)
    .refine((v) => INDUSTRY_OPTIONS.includes(v as never), {
      message: "Please select a valid industry",
    }),
  country: z.string().trim().max(120).optional().nullable(),
  phone: z
    .string()
    .trim()
    .max(40)
    .refine((v) => !v || /^[+0-9][0-9\s().-]{5,39}$/.test(v), {
      message: "Enter a valid phone number",
    })
    .optional()
    .nullable(),
  companySize: z.string().trim().max(40).optional().nullable(),
  preferredContactMethod: z.string().trim().max(20).optional().nullable(),
  message: z.string().trim().min(10).max(8000),
  attachmentPath: z.string().trim().max(500).optional().nullable(),
  website: z.string().max(200).optional().nullable(),
  startedAt: z.number().int().min(0).optional().nullable(),
  turnstileToken: z.string().max(2048).optional().nullable(),
  utmSource: z.string().trim().max(120).optional().nullable(),
  utmMedium: z.string().trim().max(120).optional().nullable(),
  utmCampaign: z.string().trim().max(120).optional().nullable(),
});

const MIN_SUBMIT_MS = 3_000;
const TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

async function verifyTurnstile(token: string, ip: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return true; // not configured -> skip (defense from honeypot + rate limits)
  try {
    const res = await fetch(TURNSTILE_VERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        secret,
        response: token,
        remoteip: ip,
      }),
    });
    const data = (await res.json().catch(() => ({}))) as { success?: boolean };
    return data.success === true;
  } catch {
    return false;
  }
}

function computeLeadScore(input: {
  phone?: string | null;
  companySize?: string | null;
  preferredContactMethod?: string | null;
  country?: string | null;
  industry?: string | null;
  message: string;
  attachmentPath?: string | null;
}): number {
  let score = 10;
  if (input.phone) score += 15;
  if (input.companySize) score += 10;
  if (input.preferredContactMethod) score += 10;
  if (input.country) score += 10;
  if (input.industry && input.industry !== "Other") score += 10;
  if (input.message.length >= 200) score += 15;
  if (input.attachmentPath) score += 20;
  return Math.min(100, score);
}

/**
 * Public marketing-site lead intake (service role).
 * Anti-spam: honeypot + submit time trap + IP/email rate limits + optional
 * Cloudflare Turnstile (enabled when TURNSTILE_SECRET_KEY is set).
 */
export async function POST(req: NextRequest) {
  try {
    const rl = await ingressRateLimit("contact-msg", 10, 60_000, req);
    if (!rl.ok) {
      return NextResponse.json(
        { ok: false, error: "Too many messages from this network. Try later." },
        { status: 429, headers: rl.response.headers }
      );
    }

    let raw: unknown;
    try {
      raw = await req.json();
    } catch {
      return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
    }

    const body = (raw ?? {}) as Record<string, unknown>;

    // Honeypot: bots fill the hidden field. Silently accept without storing.
    const website = typeof body.website === "string" ? body.website.trim() : "";
    if (website) {
      return NextResponse.json({ ok: true, id: "filtered" });
    }

    // Time trap: humans take at least a few seconds on this form.
    const startedAt =
      typeof body.startedAt === "number" && Number.isFinite(body.startedAt)
        ? body.startedAt
        : 0;
    if (startedAt && Date.now() - startedAt < MIN_SUBMIT_MS) {
      return NextResponse.json({ ok: true, id: "filtered" });
    }

    const parsed = bodySchema.safeParse({
      name: body.name ?? "",
      email: body.email ?? "",
      company: body.company ?? "",
      industry: body.industry ?? "",
      country: body.country ? String(body.country) : null,
      phone: body.phone ? String(body.phone) : null,
      companySize: body.companySize ? String(body.companySize) : null,
      preferredContactMethod: body.preferredContactMethod
        ? String(body.preferredContactMethod)
        : null,
      message: body.message ?? "",
      attachmentPath: body.attachmentPath ? String(body.attachmentPath) : null,
      website: website || null,
      startedAt: startedAt || null,
      turnstileToken: body.turnstileToken ? String(body.turnstileToken) : null,
      utmSource: body.utmSource ? String(body.utmSource) : null,
      utmMedium: body.utmMedium ? String(body.utmMedium) : null,
      utmCampaign: body.utmCampaign ? String(body.utmCampaign) : null,
    });
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: "Please complete all required fields correctly." },
        { status: 400 }
      );
    }

    // Optional CAPTCHA when configured.
    const turnstileToken = parsed.data.turnstileToken;
    if (process.env.TURNSTILE_SECRET_KEY) {
      if (!turnstileToken || !(await verifyTurnstile(turnstileToken, rl.ip))) {
        return NextResponse.json(
          { ok: false, error: "CAPTCHA verification failed. Please try again." },
          { status: 400 }
        );
      }
    }

    const emailRl = await rateLimitStrict(
      `contact-email:${parsed.data.email}`,
      5,
      24 * 60 * 60_000
    );
    if (!emailRl.allowed) {
      return NextResponse.json(
        { ok: false, error: "Too many messages from this email today" },
        { status: 429 }
      );
    }

    const data = parsed.data;
    const companySizeOk = COMPANY_SIZE_OPTIONS.some(
      (o) => o.value === data.companySize
    );
    const methodOk = CONTACT_METHOD_OPTIONS.some(
      (o) => o.value === data.preferredContactMethod
    );
    const leadScore = computeLeadScore(data);

    const referrer = req.headers.get("referer")?.slice(0, 2000) || null;
    const userAgent = req.headers.get("user-agent")?.slice(0, 500) || null;

    const sb = createAdminClient();
    const { data: row, error } = await sb
      .from("contact_messages")
      .insert({
        name: data.name,
        email: data.email,
        company: data.company,
        industry: data.industry,
        country: data.country || null,
        phone: data.phone || null,
        company_size: companySizeOk ? data.companySize : null,
        preferred_contact_method: methodOk ? data.preferredContactMethod : null,
        message: data.message,
        source: "marketing_site",
        status: "new",
        lead_score: leadScore,
        consent_privacy: true,
        ip_hash: createHash("sha256").update(rl.ip).digest("hex"),
        attachment_path: data.attachmentPath || null,
        metadata: {
          utm_source: data.utmSource || null,
          utm_medium: data.utmMedium || null,
          utm_campaign: data.utmCampaign || null,
          referrer,
          user_agent: userAgent,
          email_status: "pending",
        },
      })
      .select("id")
      .single();
    if (error) throw error;

    // Confirmation + internal sales alert. Fail-soft: never surface email
    // errors to the visitor when Resend is not configured.
    let emailStatus: "skipped" | "sent" | "failed" = "skipped";
    if (isResendConfigured()) {
      const [confirmation, alert] = await Promise.allSettled([
        sendEmail({
          to: data.email,
          subject: "Thank you for contacting SecureTrack ERP",
          html: wrapBrandedEmailHtml({
            title: "Thank you for contacting us",
            bodyHtml: textToEmailHtml(
              `Hi ${data.name},\n\nThank you for contacting us. Our enterprise solutions team will respond within 24 hours.\n\nWe received your inquiry about ${data.industry}. If you would like to move faster, reply to this email with a preferred time for a live demo.\n\nBest regards,\nThe SecureTrack ERP Team`
            ),
            preheader: "Our enterprise solutions team will respond within 24 hours.",
          }),
          tags: [{ name: "lead_confirmation", value: row.id }],
        }),
        sendEmail({
          to: COMPANY.email,
          subject: `New sales lead: ${data.company} (${data.industry})`,
          html: wrapBrandedEmailHtml({
            title: "New marketing lead",
            bodyHtml: textToEmailHtml(
              [
                `Name: ${data.name}`,
                `Email: ${data.email}`,
                `Phone: ${data.phone || "-"}`,
                `Company: ${data.company}`,
                `Industry: ${data.industry}`,
                `Company size: ${data.companySize || "-"}`,
                `Country: ${data.country || "-"}`,
                `Preferred contact: ${data.preferredContactMethod || "-"}`,
                `Lead score: ${leadScore}/100`,
                "",
                `Message: ${data.message}`,
              ].join("\n")
            ),
            preheader: `${data.company} - ${data.industry} lead`,
          }),
          replyTo: data.email,
          tags: [{ name: "lead_alert", value: row.id }],
        }),
      ]);
      emailStatus =
        confirmation.status === "fulfilled" && confirmation.value.ok
          ? "sent"
          : "failed";
    }

    if (emailStatus === "sent" || emailStatus === "failed") {
      await sb
        .from("contact_messages")
        .update({ metadata: { email_status: emailStatus } })
        .eq("id", row.id)
        .select("id")
        .maybeSingle();
    }

    return NextResponse.json({ ok: true, id: row.id });
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        error: e instanceof Error ? e.message : "Message could not be sent",
      },
      { status: 500 }
    );
  }
}