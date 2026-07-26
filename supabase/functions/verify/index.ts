import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.10";
import { corsHeaders } from "../_shared/cors.ts";
import { verifyQrPayload } from "../_shared/qr-crypto.ts";
import { detectFraud } from "../_shared/fraud-detection.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    let body: Record<string, unknown> = {};
    if (req.method === "POST") {
      try {
        body = await req.json();
      } catch {
        body = {};
      }
    }

    const qrData = url.searchParams.get("qr") || body.qr;

    if (!qrData) {
      return new Response(
        JSON.stringify({ error: "QR data required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let payload: Record<string, unknown>;
    try {
      payload = typeof qrData === "string" ? JSON.parse(qrData) : (qrData as Record<string, unknown>);
    } catch {
      return new Response(
        JSON.stringify({
          result: "invalid",
          message: "Invalid QR code format",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("cf-connecting-ip") || "unknown";
    const userAgent = req.headers.get("user-agent") || "";

    const verification = await verifyQrPayload(payload, supabase);

    if (!verification.valid) {
      await supabase.from("verification_logs").insert({
        company_id: verification.companyId || "a0000000-0000-4000-8000-000000000001",
        public_uuid: payload.uuid as string,
        result: verification.result,
        ip_address: clientIp,
        user_agent: userAgent,
        latitude: body.latitude,
        longitude: body.longitude,
        scan_source: body.source || "web",
      });

      return new Response(
        JSON.stringify({
          result: verification.result,
          message: verification.message,
          safetyMessage: "This product could not be verified. Please contact Hope Design Group.",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const qrCode = verification.qrCode!;
    const isRecalled = qrCode.is_recalled;

    const { count: priorScans } = await supabase
      .from("verification_logs")
      .select("*", { count: "exact", head: true })
      .eq("qr_code_id", qrCode.id);

    const isFirstScan = (priorScans || 0) === 0;

    await supabase.from("verification_logs").insert({
      company_id: qrCode.company_id,
      qr_code_id: qrCode.id,
      public_uuid: qrCode.public_uuid,
      result: isRecalled ? "recalled" : "genuine",
      ip_address: clientIp,
      user_agent: userAgent,
      latitude: body.latitude,
      longitude: body.longitude,
      scan_source: body.source || "web",
      is_first_scan: isFirstScan,
      response_data: {
        product: verification.product,
        batch: verification.batch,
      },
    });

    await detectFraud(supabase, qrCode, {
      ip: clientIp,
      latitude: body.latitude,
      longitude: body.longitude,
      isFirstScan,
    });

    const { data: batch } = await supabase
      .from("production_batches")
      .select("batch_number, manufacturing_date")
      .eq("id", qrCode.batch_id)
      .single();

    const { data: product } = await supabase
      .from("products")
      .select("name, paper_size, gsm")
      .eq("id", qrCode.product_id)
      .single();

    return new Response(
      JSON.stringify({
        result: isRecalled ? "recalled" : "genuine",
        product: product?.name,
        paperSize: product?.paper_size,
        gsm: product?.gsm,
        batch: batch?.batch_number,
        manufacturingDate: batch?.manufacturing_date,
        verificationCount: (qrCode.verification_count || 0) + 1,
        verifiedAt: new Date().toISOString(),
        isFirstScan,
        safetyMessage: isRecalled
          ? "This product has been recalled. Do not use."
          : "This is a genuine Hope Design Group product.",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Verification error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
