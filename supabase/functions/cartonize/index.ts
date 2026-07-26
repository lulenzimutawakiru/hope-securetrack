import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.10";
import { corsHeaders } from "../_shared/cors.ts";
import { generateQrPayload } from "../_shared/qr-crypto.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

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

    const { reamQrIds, packedBy } = await req.json();

    if (!reamQrIds || reamQrIds.length !== 5) {
      return new Response(
        JSON.stringify({ error: "Exactly 5 ream QR codes required for cartonization" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: reams, error: reamsError } = await supabase
      .from("reams")
      .select("*, qr_codes(*), production_batches(*), products(*)")
      .in("qr_code_id", reamQrIds);

    if (reamsError || !reams || reams.length !== 5) {
      return new Response(
        JSON.stringify({ error: "Could not find all 5 reams" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const validations = {
      sameProduct: reams.every((r) => r.product_id === reams[0].product_id),
      sameBatch: reams.every((r) => r.batch_id === reams[0].batch_id),
      sameGsm: reams.every((r) => r.gsm === reams[0].gsm),
      sameSize: reams.every((r) => r.paper_size === reams[0].paper_size),
      notPacked: reams.every((r) => !r.carton_id),
      notDefective: reams.every((r) => !r.is_defective),
    };

    const failures = Object.entries(validations)
      .filter(([, v]) => !v)
      .map(([k]) => k);

    if (failures.length > 0) {
      return new Response(
        JSON.stringify({
          error: "Validation failed",
          failures,
          message: getValidationMessage(failures),
        }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const batch = reams[0].production_batches;
    const product = reams[0].products;
    const companyId = reams[0].company_id;

    const { count: existingCartons } = await supabase
      .from("cartons")
      .select("*", { count: "exact", head: true })
      .eq("batch_id", batch.id);

    const cartonIndex = (existingCartons || 0) + 1;
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const cartonSerial = `CT-${date}-${String(cartonIndex).padStart(5, "0")}`;
    const publicUuid = crypto.randomUUID();

    const internalData = {
      serial: cartonSerial,
      batchNumber: batch.batch_number,
      productCode: product.product_code,
      productName: product.name,
      paperSize: batch.paper_size,
      gsm: batch.gsm,
      reamCount: 5,
      reamSerials: reams.map((r) => r.serial_number),
      packingDate: new Date().toISOString().slice(0, 10),
    };

    const payload = await generateQrPayload("CARTON", internalData);

    const { data: qrCode } = await supabase
      .from("qr_codes")
      .insert({
        company_id: companyId,
        public_uuid: publicUuid,
        code_type: "carton",
        status: "packed",
        encrypted_token: payload.token,
        signature: payload.signature,
        checksum: payload.checksum,
        human_serial: cartonSerial,
        batch_id: batch.id,
        product_id: product.id,
        payload_version: 1,
        payload,
      })
      .select()
      .single();

    const { data: carton } = await supabase
      .from("cartons")
      .insert({
        company_id: companyId,
        batch_id: batch.id,
        product_id: product.id,
        qr_code_id: qrCode!.id,
        serial_number: cartonSerial,
        paper_size: batch.paper_size,
        gsm: batch.gsm,
        ream_count: 5,
        packed_by: packedBy,
        packed_at: new Date().toISOString(),
        packing_date: new Date().toISOString().slice(0, 10),
        inventory_status: "in_production",
      })
      .select()
      .single();

    await supabase
      .from("qr_codes")
      .update({ carton_id: carton!.id })
      .eq("id", qrCode!.id);

    for (const ream of reams) {
      await supabase
        .from("reams")
        .update({ carton_id: carton!.id, inventory_status: "in_production" })
        .eq("id", ream.id);

      await supabase
        .from("qr_codes")
        .update({ status: "packed", carton_id: carton!.id })
        .eq("id", ream.qr_code_id);
    }

    await supabase.from("inventory_movements").insert({
      company_id: companyId,
      movement_type: "carton_packed",
      item_type: "carton",
      carton_id: carton!.id,
      quantity: 1,
      performed_by: packedBy,
      notes: `Packed 5 reams: ${reams.map((r) => r.serial_number).join(", ")}`,
    });

    return new Response(
      JSON.stringify({
        success: true,
        carton: {
          id: carton!.id,
          serial: cartonSerial,
          qrCode: qrCode,
          payload: { ...payload, uuid: publicUuid },
          qrData: JSON.stringify({ ...payload, uuid: publicUuid }),
          reams: reams.map((r) => r.serial_number),
        },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Cartonization error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function getValidationMessage(failures: string[]): string {
  const messages: Record<string, string> = {
    sameProduct: "All reams must be the same product",
    sameBatch: "All reams must be from the same batch",
    sameGsm: "All reams must have the same GSM",
    sameSize: "All reams must have the same paper size",
    notPacked: "One or more reams are already packed into a carton",
    notDefective: "One or more reams are marked as defective",
  };
  return failures.map((f) => messages[f]).join(". ");
}
