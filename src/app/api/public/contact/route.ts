import { NextRequest, NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { ingressRateLimit } from "@/lib/security/public-ingress";
import { rateLimitStrict } from "@/lib/api";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const bodySchema = z.object({
  name: z.string().trim().min(2).max(150),
  email: z.string().trim().toLowerCase().email().max(255),
  company: z.string().trim().max(150).optional().nullable(),
  industry: z.string().trim().max(120).optional().nullable(),
  country: z.string().trim().max(120).optional().nullable(),
  message: z.string().trim().min(10).max(8000),
});

/**
 * Public marketing-site contact/lead intake (service role).
 * Inserts into contact_messages with source fixed to marketing_site.
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
    const parsed = bodySchema.safeParse({
      name: body.name ?? "",
      email: body.email ?? "",
      company: body.company ? String(body.company) : null,
      industry: body.industry ? String(body.industry) : null,
      country: body.country ? String(body.country) : null,
      message: body.message ?? "",
    });
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: "name, a valid email, and a message (10+ characters) are required" },
        { status: 400 }
      );
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
    const sb = createAdminClient();
    const { data: row, error } = await sb
      .from("contact_messages")
      .insert({
        name: data.name,
        email: data.email,
        company: data.company || null,
        industry: data.industry || null,
        country: data.country || null,
        message: data.message,
        source: "marketing_site",
        status: "new",
        consent_privacy: true,
        ip_hash: createHash("sha256").update(rl.ip).digest("hex"),
      })
      .select("id")
      .single();
    if (error) throw error;

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