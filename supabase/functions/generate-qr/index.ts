import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.10";
import { corsHeaders } from "../_shared/cors.ts";
import { generateQrPayload } from "../_shared/qr-crypto.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

function generateSerial(prefix: string, index: number): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return `${prefix}-${date}-${String(index).padStart(5, "0")}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { batchId, quantity, codeType = "ream", startIndex = 1 } = await req.json();

    const { data: batch, error: batchError } = await supabase
      .from("production_batches")
      .select("*, products(*)")
      .eq("id", batchId)
      .single();

    if (batchError || !batch) {
      return new Response(JSON.stringify({ error: "Batch not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const prefix = codeType === "carton" ? "CT" : "RM";
    const qrType = codeType === "carton" ? "CARTON" : "REAM";
    const dbType = codeType === "carton" ? "carton" : "ream";
    const generated: Array<Record<string, unknown>> = [];

    for (let i = 0; i < quantity; i++) {
      const index = startIndex + i;
      const serial = generateSerial(prefix, index);
      const publicUuid = crypto.randomUUID();

      const internalData = {
        serial,
        batchNumber: batch.batch_number,
        productCode: batch.product_code,
        paperSize: batch.paper_size,
        gsm: batch.gsm,
        manufacturingDate: batch.manufacturing_date,
        generatedAt: new Date().toISOString(),
      };

      const payload = await generateQrPayload(qrType as "REAM" | "CARTON", internalData);

      const { data: qrCode, error: qrError } = await supabase
        .from("qr_codes")
        .insert({
          company_id: batch.company_id,
          public_uuid: publicUuid,
          code_type: dbType,
          status: "generated",
          encrypted_token: payload.token,
          signature: payload.signature,
          checksum: payload.checksum,
          human_serial: serial,
          batch_id: batchId,
          product_id: batch.product_id,
          payload_version: 1,
          payload,
        })
        .select()
        .single();

      if (qrError) {
        console.error("QR insert error:", qrError);
        continue;
      }

      if (codeType === "ream") {
        const { data: ream } = await supabase
          .from("reams")
          .insert({
            company_id: batch.company_id,
            batch_id: batchId,
            product_id: batch.product_id,
            qr_code_id: qrCode.id,
            serial_number: serial,
            paper_size: batch.paper_size,
            gsm: batch.gsm,
            color: batch.color,
          })
          .select()
          .single();

        if (ream) {
          await supabase
            .from("qr_codes")
            .update({ ream_id: ream.id })
            .eq("id", qrCode.id);
        }
      }

      generated.push({
        id: qrCode.id,
        publicUuid,
        serial,
        payload,
        qrData: JSON.stringify({ ...payload, uuid: publicUuid }),
      });
    }

    await supabase.rpc("create_audit_log", {
      p_company_id: batch.company_id,
      p_user_id: null,
      p_action: "qr.generate",
      p_module: "qr",
      p_entity_type: "production_batch",
      p_entity_id: batchId,
      p_entity_reference: batch.batch_number,
      p_after_state: { generated_count: generated.length, code_type: codeType },
    });

    return new Response(
      JSON.stringify({
        success: true,
        generated: generated.length,
        codes: generated,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("QR generation error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
