import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.10";
import { corsHeaders } from "../_shared/cors.ts";
import { generateQrPayload } from "../_shared/qr-crypto.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

function generateSerial(prefix: string, index: number): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const rand = crypto.randomUUID().replace(/-/g, "").slice(0, 6).toUpperCase();
  return `${prefix}-${date}-${String(index).padStart(5, "0")}-${rand}`;
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

    // Optional: validate JWT is present (service role does DB work)
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const batchId = body.batchId as string | undefined;
    const quantity = Number(body.quantity ?? 0);
    const codeType = (body.codeType as string) || "ream";
    const startIndex = Number(body.startIndex ?? 1);

    if (!batchId) {
      return new Response(JSON.stringify({ error: "batchId is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!Number.isFinite(quantity) || quantity < 1 || quantity > 5000) {
      return new Response(JSON.stringify({ error: "quantity must be between 1 and 5000" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: batch, error: batchError } = await supabase
      .from("production_batches")
      .select("*, products(*)")
      .eq("id", batchId)
      .single();

    if (batchError || !batch) {
      return new Response(
        JSON.stringify({ error: "Batch not found", details: batchError?.message }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const prefix = codeType === "carton" ? "CT" : "RM";
    const qrType = codeType === "carton" ? "CARTON" : "REAM";
    const dbType = codeType === "carton" ? "carton" : "ream";
    const generated: Array<Record<string, unknown>> = [];
    const errors: string[] = [];

    for (let i = 0; i < quantity; i++) {
      try {
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

        const payload = await generateQrPayload(
          qrType as "REAM" | "CARTON",
          internalData,
          publicUuid
        );

        const { data: qrCode, error: qrError } = await supabase
          .from("qr_codes")
          .insert({
            company_id: batch.company_id,
            public_uuid: publicUuid,
            code_type: dbType,
            status: "generated",
            encrypted_token: payload.token as string,
            signature: payload.signature as string,
            checksum: payload.checksum as string,
            human_serial: serial,
            batch_id: batchId,
            product_id: batch.product_id,
            payload_version: 1,
            payload,
          })
          .select()
          .single();

        if (qrError || !qrCode) {
          errors.push(qrError?.message ?? `Failed insert for ${serial}`);
          console.error("QR insert error:", qrError);
          continue;
        }

        if (codeType === "ream") {
          const { data: ream, error: reamError } = await supabase
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

          if (reamError) {
            console.error("Ream insert error:", reamError);
          } else if (ream) {
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
          qrData: JSON.stringify(payload),
        });
      } catch (itemErr) {
        const msg = itemErr instanceof Error ? itemErr.message : String(itemErr);
        errors.push(msg);
        console.error("QR item error:", itemErr);
      }
    }

    if (generated.length > 0) {
      try {
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
      } catch (auditErr) {
        console.error("Audit log error:", auditErr);
      }
    }

    if (generated.length === 0) {
      return new Response(
        JSON.stringify({
          error: "Failed to generate any QR codes",
          details: errors.slice(0, 5),
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        generated: generated.length,
        codes: generated,
        errors: errors.length ? errors.slice(0, 5) : undefined,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    console.error("QR generation error:", error);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
