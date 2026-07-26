import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const description = String(body.description || "").trim();
    if (!description) {
      return NextResponse.json(
        { error: "Description is required" },
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
    const companyId =
      process.env.DEFAULT_COMPANY_ID ||
      "a0000000-0000-4000-8000-000000000001";

    const { data, error } = await supabase
      .from("counterfeit_reports")
      .insert({
        company_id: companyId,
        public_uuid: body.publicUuid || null,
        reporter_name: body.name || null,
        reporter_email: body.email || null,
        reporter_phone: body.phone || null,
        description,
        purchase_location: body.location || null,
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
