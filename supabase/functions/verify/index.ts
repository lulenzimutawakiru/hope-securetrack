import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.10";
import { corsHeaders } from "../_shared/cors.ts";
import { verifyQrPayload } from "../_shared/qr-crypto.ts";
import { detectFraud } from "../_shared/fraud-detection.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Normalize camera / paste / deep-link input into a structured request */
function parseScanInput(raw: unknown): {
  mode: "payload" | "uuid" | "serial";
  payload?: Record<string, unknown>;
  uuid?: string;
  serial?: string;
} {
  if (raw == null) return { mode: "serial", serial: "" };

  // Already an object (full crypto payload)
  if (typeof raw === "object" && !Array.isArray(raw)) {
    const obj = raw as Record<string, unknown>;
    if (obj.uuid && obj.token && obj.signature) {
      return { mode: "payload", payload: obj };
    }
    if (obj.uuid || obj.u || obj.code) {
      return {
        mode: "uuid",
        uuid: String(obj.uuid || obj.u || obj.code),
      };
    }
    if (obj.serial || obj.s) {
      return { mode: "serial", serial: String(obj.serial || obj.s) };
    }
  }

  let text = String(raw).trim();

  // Strip accidental wrapping quotes
  if (
    (text.startsWith('"') && text.endsWith('"')) ||
    (text.startsWith("'") && text.endsWith("'"))
  ) {
    text = text.slice(1, -1).trim();
  }

  // URL deep links: .../verify?code=UUID or ?uuid= or ?c=
  try {
    if (text.includes("://") || text.startsWith("http")) {
      const u = new URL(text);
      const code =
        u.searchParams.get("code") ||
        u.searchParams.get("uuid") ||
        u.searchParams.get("c") ||
        u.searchParams.get("id");
      if (code) {
        if (UUID_RE.test(code)) return { mode: "uuid", uuid: code };
        return { mode: "serial", serial: code };
      }
      // path /verify/UUID
      const parts = u.pathname.split("/").filter(Boolean);
      const last = parts[parts.length - 1];
      if (last && UUID_RE.test(last)) return { mode: "uuid", uuid: last };
    }
  } catch {
    /* not a URL */
  }

  // Compact codes: HST:UUID or HST|UUID|serial
  if (/^HST[:|]/i.test(text)) {
    const parts = text.split(/[:|]/).filter(Boolean);
    const maybeUuid = parts[1];
    if (maybeUuid && UUID_RE.test(maybeUuid)) {
      return { mode: "uuid", uuid: maybeUuid };
    }
  }

  // Bare UUID
  if (UUID_RE.test(text)) {
    return { mode: "uuid", uuid: text };
  }

  // Full JSON payload string
  if (text.startsWith("{")) {
    try {
      const obj = JSON.parse(text) as Record<string, unknown>;
      if (obj.token && obj.signature && obj.uuid) {
        return { mode: "payload", payload: obj };
      }
      if (obj.uuid || obj.u || obj.code) {
        return {
          mode: "uuid",
          uuid: String(obj.uuid || obj.u || obj.code),
        };
      }
    } catch {
      return { mode: "serial", serial: text };
    }
  }

  // Human serial e.g. RM-20260726-00001-B8B79C
  return { mode: "serial", serial: text };
}

async function lookupQrCode(opts: { uuid?: string; serial?: string }) {
  if (opts.uuid) {
    const { data, error } = await supabase
      .from("qr_codes")
      .select("*")
      .eq("public_uuid", opts.uuid)
      .maybeSingle();
    if (!error && data) return data;
  }
  if (opts.serial) {
    const { data, error } = await supabase
      .from("qr_codes")
      .select("*")
      .eq("human_serial", opts.serial)
      .maybeSingle();
    if (!error && data) return data;
  }
  return null;
}

async function buildSuccessResponse(
  qrCode: Record<string, unknown>,
  body: Record<string, unknown>,
  clientIp: string,
  userAgent: string
) {
  const isRecalled = Boolean(qrCode.is_recalled);

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
    ip_address: clientIp === "unknown" ? null : clientIp,
    user_agent: userAgent,
    latitude: body.latitude ?? null,
    longitude: body.longitude ?? null,
    scan_source: body.source || "web",
    is_first_scan: isFirstScan,
  });

  try {
    await detectFraud(supabase, qrCode, {
      ip: clientIp,
      latitude: body.latitude as number | undefined,
      longitude: body.longitude as number | undefined,
      isFirstScan,
    });
  } catch (e) {
    console.error("Fraud detection error:", e);
  }

  const { data: batch } = qrCode.batch_id
    ? await supabase
        .from("production_batches")
        .select("batch_number, manufacturing_date")
        .eq("id", qrCode.batch_id)
        .maybeSingle()
    : { data: null };

  const { data: product } = qrCode.product_id
    ? await supabase
        .from("products")
        .select("name, paper_size, gsm")
        .eq("id", qrCode.product_id)
        .maybeSingle()
    : { data: null };

  return {
    result: isRecalled ? "recalled" : "genuine",
    product: product?.name,
    paperSize: product?.paper_size,
    gsm: product?.gsm,
    batch: batch?.batch_number,
    manufacturingDate: batch?.manufacturing_date,
    serial: qrCode.human_serial,
    verificationCount: ((qrCode.verification_count as number) || 0) + 1,
    verifiedAt: new Date().toISOString(),
    isFirstScan,
    safetyMessage: isRecalled
      ? "This product has been recalled. Do not use."
      : "This is a genuine SecureTrack ERP product.",
  };
}

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

    // Accept qr | code | uuid | serial from body or query
    const qrData =
      url.searchParams.get("qr") ||
      url.searchParams.get("code") ||
      body.qr ||
      body.code ||
      body.uuid ||
      body.serial;

    if (!qrData) {
      return new Response(JSON.stringify({ error: "QR data required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const clientIp =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("cf-connecting-ip") ||
      "unknown";
    const userAgent = req.headers.get("user-agent") || "";

    const parsed = parseScanInput(qrData);

    // Path A: full signed payload (offline-tamper resistant)
    if (parsed.mode === "payload" && parsed.payload) {
      const verification = await verifyQrPayload(parsed.payload, supabase);

      if (!verification.valid) {
        // Fall back: if crypto fails but UUID is registered, still allow DB lookup
        // (handles label rebuilds that reordered JSON / rewrote uuid field)
        const fallbackUuid = String(parsed.payload.uuid || "");
        if (fallbackUuid && UUID_RE.test(fallbackUuid)) {
          const qrCode = await lookupQrCode({ uuid: fallbackUuid });
          if (qrCode && qrCode.status !== "counterfeit" && qrCode.status !== "voided") {
            const success = await buildSuccessResponse(
              qrCode,
              body,
              clientIp,
              userAgent
            );
            return new Response(JSON.stringify(success), {
              status: 200,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
        }

        await supabase.from("verification_logs").insert({
          company_id:
            verification.companyId || "a0000000-0000-4000-8000-000000000001",
          public_uuid: (parsed.payload.uuid as string) || null,
          result: verification.result,
          ip_address: clientIp === "unknown" ? null : clientIp,
          user_agent: userAgent,
          latitude: body.latitude ?? null,
          longitude: body.longitude ?? null,
          scan_source: body.source || "web",
        });

        return new Response(
          JSON.stringify({
            result: verification.result,
            message: verification.message,
            safetyMessage:
              "This product could not be verified. Please contact SecureTrack ERP.",
          }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      const success = await buildSuccessResponse(
        verification.qrCode!,
        body,
        clientIp,
        userAgent
      );
      return new Response(JSON.stringify(success), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Path B: short UUID or serial (scannable labels / deep links)
    const qrCode = await lookupQrCode({
      uuid: parsed.uuid,
      serial: parsed.serial,
    });

    if (!qrCode) {
      await supabase.from("verification_logs").insert({
        company_id: "a0000000-0000-4000-8000-000000000001",
        public_uuid: parsed.uuid || null,
        result: "invalid",
        ip_address: clientIp === "unknown" ? null : clientIp,
        user_agent: userAgent,
        scan_source: body.source || "web",
        response_data: { input: String(qrData).slice(0, 200) },
      });

      return new Response(
        JSON.stringify({
          result: "invalid",
          message: "Unknown or unregistered product code",
          safetyMessage:
            "This product could not be verified. Please contact SecureTrack ERP.",
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (qrCode.status === "counterfeit" || qrCode.status === "voided") {
      return new Response(
        JSON.stringify({
          result: "counterfeit",
          message: "QR code flagged as counterfeit or voided",
          safetyMessage:
            "Do not use this product. Contact SecureTrack ERP immediately.",
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const success = await buildSuccessResponse(
      qrCode,
      body,
      clientIp,
      userAgent
    );
    return new Response(JSON.stringify(success), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Verification error:", error);
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        message: error instanceof Error ? error.message : String(error),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
