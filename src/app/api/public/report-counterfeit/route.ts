import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(request: Request) {
  try {
    const { clientIp, rateLimit } = await import("@/lib/api");
    const ip = clientIp(request);
    const rl = rateLimit(`counterfeit:${ip}`, 15, 60 * 60_000);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Too many reports. Try again later." },
        { status: 429 }
      );
    }

    const body = await request.json();
    const description = String(body.description || "").trim().slice(0, 4000);
    if (!description || description.length < 10) {
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

    // Resolve company from product UUID when possible; never hardcode a single tenant in multi-tenant prod
    let companyId = process.env.DEFAULT_COMPANY_ID || null;
    const publicUuid = body.publicUuid ? String(body.publicUuid).slice(0, 100) : null;
    if (publicUuid) {
      const { data: qr } = await supabase
        .from("qr_codes")
        .select("company_id")
        .eq("public_uuid", publicUuid)
        .maybeSingle();
      if (qr?.company_id) companyId = String(qr.company_id);
    }
    if (!companyId) {
      const { data: first } = await supabase
        .from("companies")
        .select("id")
        .eq("is_primary", true)
        .limit(1)
        .maybeSingle();
      companyId = first?.id ? String(first.id) : null;
    }
    if (!companyId) {
      return NextResponse.json(
        { error: "Unable to resolve company for report" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("counterfeit_reports")
      .insert({
        company_id: companyId,
        public_uuid: publicUuid,
        reporter_name: body.name ? String(body.name).slice(0, 150) : null,
        reporter_email: body.email ? String(body.email).slice(0, 255) : null,
        reporter_phone: body.phone ? String(body.phone).slice(0, 40) : null,
        description,
        purchase_location: body.location ? String(body.location).slice(0, 255) : null,
        status: "pending",
      })
      .select("id")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Optional fraud alert
    await supabase.from("fraud_alerts").insert({
      company_id: companyId,
      alert_type: "consumer_report",
      severity: "high",
      status: "open",
      title: "Consumer counterfeit report",
      description: description.slice(0, 500),
      evidence: {
        report_id: data.id,
        public_uuid: body.publicUuid,
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
