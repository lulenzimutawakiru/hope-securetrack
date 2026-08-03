import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { ingressRateLimit } from "@/lib/security/public-ingress";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const bodySchema = z.object({
  description: z.string().min(10).max(4000),
  publicUuid: z.string().max(100).optional().nullable(),
  name: z.string().max(150).optional().nullable(),
  email: z.string().email().max(255).optional().nullable().or(z.literal("")),
  phone: z.string().max(40).optional().nullable(),
  location: z.string().max(255).optional().nullable(),
});

export async function POST(request: Request) {
  try {
    const rl = await ingressRateLimit("counterfeit", 15, 60 * 60_000, request);
    if (!rl.ok) {
      return NextResponse.json(
        { error: "Too many reports. Try again later." },
        { status: 429, headers: rl.response.headers }
      );
    }

    let raw: unknown;
    try {
      raw = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const parsed = bodySchema.safeParse({
      ...(raw as object),
      description: String((raw as { description?: string })?.description || "").trim(),
      email: (raw as { email?: string })?.email || undefined,
    });
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Description is required (min 10 characters)" },
        { status: 400 }
      );
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !serviceKey) {
      return NextResponse.json(
        { error: "Reporting service not configured" },
        { status: 503 }
      );
    }

    const supabase = createClient(url, serviceKey);
    const body = parsed.data;

    // Resolve company from product UUID when possible — never pick a random tenant.
    let companyId: string | null = null;
    const publicUuid = body.publicUuid ? String(body.publicUuid).slice(0, 100) : null;
    if (publicUuid) {
      const { data: qr } = await supabase
        .from("qr_codes")
        .select("company_id")
        .eq("public_uuid", publicUuid)
        .maybeSingle();
      if (qr?.company_id) companyId = String(qr.company_id);
    }
    if (!companyId && process.env.DEFAULT_COMPANY_ID) {
      companyId = process.env.DEFAULT_COMPANY_ID;
    }
    // Fail closed: do not fall back to is_primary company (cross-tenant risk).
    if (!companyId) {
      return NextResponse.json(
        {
          error:
            "Unable to resolve company for report. Include a product QR public UUID.",
        },
        { status: 400 }
      );
    }

    const description = body.description;
    const { data, error } = await supabase
      .from("counterfeit_reports")
      .insert({
        company_id: companyId,
        public_uuid: publicUuid,
        reporter_name: body.name ? String(body.name).slice(0, 150) : null,
        reporter_email: body.email ? String(body.email).slice(0, 255) : null,
        reporter_phone: body.phone ? String(body.phone).slice(0, 40) : null,
        description,
        purchase_location: body.location
          ? String(body.location).slice(0, 255)
          : null,
        status: "pending",
      })
      .select("id")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    await supabase.from("fraud_alerts").insert({
      company_id: companyId,
      alert_type: "consumer_report",
      severity: "high",
      status: "open",
      title: "Consumer counterfeit report",
      description: description.slice(0, 500),
      evidence: {
        report_id: data.id,
        public_uuid: publicUuid,
        reporter: body.email || body.name,
      },
    });

    return NextResponse.json({ success: true, id: data.id });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Server error" },
      { status: 500 }
    );
  }
}
