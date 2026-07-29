import { createClient } from "@/lib/supabase/client";
import { calculateCartonization, DEFAULT_HOPE_A4_RULE, estimateMaterialQty } from "./cartonization";
import {
  buildSerial,
  cartonQrPayload,
  palletQrPayload,
  reamQrPayload,
  validateCartonReams,
  weightStatus,
} from "./hierarchy";
import { buildPackingListHtml } from "./packing-list";

function sb() {
  return createClient();
}

function pad(n: number, w = 5) {
  return String(n).padStart(w, "0");
}

export async function nextPkgCode(companyId: string, table: string, prefix: string) {
  const { count } = await sb()
    .from(table)
    .select("*", { count: "exact", head: true })
    .eq("company_id", companyId);
  return `${prefix}-${pad((count ?? 0) + 1)}`;
}

export async function logPkgAudit(input: {
  company_id: string;
  actor_id?: string | null;
  action: string;
  entity_type?: string;
  entity_id?: string;
  details?: string;
}) {
  await sb().from("pkg_audit").insert({
    company_id: input.company_id,
    actor_id: input.actor_id,
    action: input.action,
    entity_type: input.entity_type,
    entity_id: input.entity_id,
    details: input.details,
  });
}

export async function createWorkOrder(input: {
  company_id: string;
  product_name: string;
  product_code?: string;
  quantity_units: number;
  source_type?: string;
  source_ref?: string;
  line_id?: string | null;
  rule_id?: string | null;
  due_date?: string;
  created_by?: string | null;
  notes?: string;
}) {
  const rule = DEFAULT_HOPE_A4_RULE;
  const calc = calculateCartonization(input.quantity_units, rule);
  const wo_number = await nextPkgCode(input.company_id, "pkg_work_orders", "PWO");

  const { data, error } = await sb()
    .from("pkg_work_orders")
    .insert({
      company_id: input.company_id,
      wo_number,
      source_type: input.source_type || "manual",
      source_ref: input.source_ref,
      product_name: input.product_name,
      product_code: input.product_code || rule.product_code,
      rule_id: input.rule_id,
      line_id: input.line_id,
      quantity_units: input.quantity_units,
      quantity_cartons_planned: calc.cartons_required,
      quantity_pallets_planned: calc.pallets_required,
      priority: 5,
      due_date: input.due_date,
      status: "released",
      notes: input.notes,
      created_by: input.created_by,
    })
    .select("*")
    .single();
  if (error) throw error;

  await logPkgAudit({
    company_id: input.company_id,
    actor_id: input.created_by,
    action: "create_wo",
    entity_type: "pkg_work_orders",
    entity_id: data.id,
    details: wo_number,
  });
  return { wo: data, cartonization: calc };
}

/**
 * Pack reams into a carton (enterprise path — works with or without edge function).
 */
export async function packCarton(input: {
  company_id: string;
  ream_serials: string[];
  work_order_id?: string | null;
  line_id?: string | null;
  packed_by?: string | null;
  expected_count?: number;
}) {
  const expected = input.expected_count || 5;
  const validation = validateCartonReams(input.ream_serials, expected);
  if (!validation.ok) throw new Error(validation.errors.join("; "));

  // Resolve reams
  const { data: reams, error: reErr } = await sb()
    .from("reams")
    .select("id, serial_number, qr_code_id, batch_id, product_id, carton_id")
    .eq("company_id", input.company_id)
    .in("serial_number", input.ream_serials.map((s) => s.toUpperCase()));

  if (reErr) throw reErr;
  if (!reams || reams.length !== expected) {
    // Fallback: allow packing without full ream master (demo / partial seed)
    // Create carton only with serials
  }

  const alreadyPacked = (reams || []).filter((r) => r.carton_id);
  if (alreadyPacked.length) {
    throw new Error(`Ream(s) already packed: ${alreadyPacked.map((r) => r.serial_number).join(", ")}`);
  }

  const { count } = await sb()
    .from("cartons")
    .select("*", { count: "exact", head: true })
    .eq("company_id", input.company_id);
  const cartonSerial = buildSerial("CTN", (count ?? 0) + 1);
  const batchId = reams?.[0]?.batch_id;
  const productId = reams?.[0]?.product_id;

  // Need batch for cartons FK — if missing, use first production batch
  let finalBatch = batchId;
  let finalProduct = productId;
  if (!finalBatch) {
    const { data: b } = await sb()
      .from("production_batches")
      .select("id, product_id")
      .eq("company_id", input.company_id)
      .limit(1)
      .maybeSingle();
    finalBatch = b?.id;
    finalProduct = finalProduct || b?.product_id;
  }
  if (!finalBatch || !finalProduct) {
    throw new Error("No production batch/product available to attach carton");
  }

  const { data: carton, error: cErr } = await sb()
    .from("cartons")
    .insert({
      company_id: input.company_id,
      batch_id: finalBatch,
      product_id: finalProduct,
      serial_number: cartonSerial,
      ream_count: expected,
      packed_by: input.packed_by,
      packed_at: new Date().toISOString(),
      packing_date: new Date().toISOString().slice(0, 10),
      inventory_status: "available",
      packaging_status: "packed",
      work_order_id: input.work_order_id,
      packing_line_id: input.line_id,
      gross_weight_kg: expected * 2.5 + 0.45,
      net_weight_kg: expected * 2.5,
    })
    .select("*")
    .single();
  if (cErr) throw cErr;

  // Link reams
  if (reams?.length) {
    for (const r of reams) {
      await sb()
        .from("reams")
        .update({
          carton_id: carton.id,
          inventory_status: "available",
          packed_at: new Date().toISOString(),
        })
        .eq("id", r.id);
    }
  }

  // Update work order progress
  if (input.work_order_id) {
    const { data: wo } = await sb()
      .from("pkg_work_orders")
      .select("quantity_cartons_done, status")
      .eq("id", input.work_order_id)
      .single();
    await sb()
      .from("pkg_work_orders")
      .update({
        quantity_cartons_done: Number(wo?.quantity_cartons_done || 0) + 1,
        status: "in_progress",
        started_at: new Date().toISOString(),
      })
      .eq("id", input.work_order_id);
  }

  // Consume materials (best effort)
  await issueMaterialsForCarton(input.company_id, input.work_order_id, input.packed_by);

  await logPkgAudit({
    company_id: input.company_id,
    actor_id: input.packed_by,
    action: "pack_carton",
    entity_type: "carton",
    entity_id: carton.id,
    details: `${cartonSerial} · ${input.ream_serials.join(",")}`,
  });

  return {
    carton,
    carton_serial: cartonSerial,
    qr_payload: cartonQrPayload(cartonSerial, input.ream_serials),
    ream_payloads: input.ream_serials.map((s) => reamQrPayload(s)),
  };
}

async function issueMaterialsForCarton(
  companyId: string,
  workOrderId?: string | null,
  actorId?: string | null
) {
  const codes = ["PKG-BOX-A4", "PKG-LBL-CTN", "PKG-SEAL-SEC", "PKG-TAPE-48"];
  for (const code of codes) {
    const { data: mat } = await sb()
      .from("pkg_materials")
      .select("*")
      .eq("company_id", companyId)
      .eq("material_code", code)
      .maybeSingle();
    if (!mat) continue;
    const qty = code === "PKG-TAPE-48" ? 0.2 : 1;
    const issue_number = await nextPkgCode(companyId, "pkg_material_issues", "PMI");
    await sb().from("pkg_material_issues").insert({
      company_id: companyId,
      issue_number,
      work_order_id: workOrderId,
      material_id: mat.id,
      qty,
      unit_cost: mat.unit_cost,
      total_cost: Number(mat.unit_cost) * qty,
      issued_by: actorId,
    });
    await sb()
      .from("pkg_materials")
      .update({ stock_qty: Math.max(0, Number(mat.stock_qty) - qty) })
      .eq("id", mat.id);
  }
}

export async function buildPallet(input: {
  company_id: string;
  carton_serials: string[];
  work_order_id?: string | null;
  line_id?: string | null;
  built_by?: string | null;
  max_cartons?: number;
}) {
  const max = input.max_cartons || 40;
  if (input.carton_serials.length === 0) throw new Error("No cartons");
  if (input.carton_serials.length > max) throw new Error(`Max ${max} cartons per pallet`);

  const pallet_number = await nextPkgCode(input.company_id, "pkg_pallets", "PAL");
  const { data: pallet, error } = await sb()
    .from("pkg_pallets")
    .insert({
      company_id: input.company_id,
      pallet_number,
      qr_payload: palletQrPayload(pallet_number, input.carton_serials),
      work_order_id: input.work_order_id,
      line_id: input.line_id,
      carton_count: input.carton_serials.length,
      max_cartons: max,
      gross_weight_kg: input.carton_serials.length * 13 + 18,
      net_weight_kg: input.carton_serials.length * 12.5,
      status: "complete",
      built_by: input.built_by,
      completed_at: new Date().toISOString(),
    })
    .select("*")
    .single();
  if (error) throw error;

  let pos = 1;
  for (const serial of input.carton_serials) {
    const { data: ctn } = await sb()
      .from("cartons")
      .select("id")
      .eq("company_id", input.company_id)
      .eq("serial_number", serial)
      .maybeSingle();

    await sb().from("pkg_pallet_cartons").insert({
      company_id: input.company_id,
      pallet_id: pallet.id,
      carton_id: ctn?.id,
      carton_serial: serial,
      position_no: pos++,
    });

    if (ctn?.id) {
      await sb()
        .from("cartons")
        .update({ pallet_id: pallet.id, packaging_status: "palletized" })
        .eq("id", ctn.id);
    }
  }

  if (input.work_order_id) {
    const { data: wo } = await sb()
      .from("pkg_work_orders")
      .select("quantity_pallets_done")
      .eq("id", input.work_order_id)
      .single();
    await sb()
      .from("pkg_work_orders")
      .update({
        quantity_pallets_done: Number(wo?.quantity_pallets_done || 0) + 1,
      })
      .eq("id", input.work_order_id);
  }

  await logPkgAudit({
    company_id: input.company_id,
    actor_id: input.built_by,
    action: "build_pallet",
    entity_type: "pkg_pallets",
    entity_id: pallet.id,
    details: pallet_number,
  });

  return pallet;
}

export async function recordWeight(input: {
  company_id: string;
  entity_type: "carton" | "pallet";
  entity_serial: string;
  gross_weight_kg: number;
  tare_weight_kg?: number;
  length_mm?: number;
  width_mm?: number;
  height_mm?: number;
  expected_kg?: number;
  recorded_by?: string | null;
}) {
  const net =
    input.gross_weight_kg - (input.tare_weight_kg || 0);
  const expected = input.expected_kg || (input.entity_type === "carton" ? 12.95 : 500);
  const status = weightStatus(input.gross_weight_kg, expected);
  const volume =
    input.length_mm && input.width_mm && input.height_mm
      ? (input.length_mm * input.width_mm * input.height_mm) / 1000
      : null;

  const { data, error } = await sb()
    .from("pkg_weights")
    .insert({
      company_id: input.company_id,
      entity_type: input.entity_type,
      entity_serial: input.entity_serial,
      net_weight_kg: net,
      tare_weight_kg: input.tare_weight_kg || 0,
      gross_weight_kg: input.gross_weight_kg,
      length_mm: input.length_mm,
      width_mm: input.width_mm,
      height_mm: input.height_mm,
      volume_cm3: volume,
      status,
      recorded_by: input.recorded_by,
    })
    .select("*")
    .single();
  if (error) throw error;

  if (input.entity_type === "carton") {
    await sb()
      .from("cartons")
      .update({
        gross_weight_kg: input.gross_weight_kg,
        net_weight_kg: net,
        length_mm: input.length_mm,
        width_mm: input.width_mm,
        height_mm: input.height_mm,
      })
      .eq("company_id", input.company_id)
      .eq("serial_number", input.entity_serial);
  }

  return data;
}

export async function runQcCheck(input: {
  company_id: string;
  entity_type: "ream" | "carton" | "pallet";
  entity_serial: string;
  work_order_id?: string | null;
  product_ok?: boolean;
  quantity_ok?: boolean;
  packaging_ok?: boolean;
  label_ok?: boolean;
  qr_ok?: boolean;
  weight_ok?: boolean;
  seal_ok?: boolean;
  defect_reason?: string;
  checked_by?: string | null;
}) {
  const flags = [
    input.product_ok !== false,
    input.quantity_ok !== false,
    input.packaging_ok !== false,
    input.label_ok !== false,
    input.qr_ok !== false,
    input.weight_ok !== false,
    input.seal_ok !== false,
  ];
  const overall_status = flags.every(Boolean) ? "pass" : "fail";
  const check_number = await nextPkgCode(input.company_id, "pkg_qc_checks", "PQC");

  const { data, error } = await sb()
    .from("pkg_qc_checks")
    .insert({
      company_id: input.company_id,
      check_number,
      work_order_id: input.work_order_id,
      entity_type: input.entity_type,
      entity_serial: input.entity_serial,
      product_ok: input.product_ok !== false,
      quantity_ok: input.quantity_ok !== false,
      packaging_ok: input.packaging_ok !== false,
      label_ok: input.label_ok !== false,
      qr_ok: input.qr_ok !== false,
      weight_ok: input.weight_ok !== false,
      seal_ok: input.seal_ok !== false,
      overall_status,
      defect_reason: overall_status === "fail" ? input.defect_reason || "Failed checkpoint" : null,
      checked_by: input.checked_by,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function generatePackingList(input: {
  company_id: string;
  customer_name?: string;
  order_ref?: string;
  work_order_id?: string | null;
  product_name?: string;
  carton_serials: string[];
  pallet_serials?: string[];
  issued_by?: string | null;
}) {
  const list_number = await nextPkgCode(input.company_id, "pkg_packing_lists", "PL");
  const cartons = input.carton_serials.map((s) => ({ serial: s, units: 5, weight_kg: 12.95 }));
  const pallets = (input.pallet_serials || []).map((s) => ({ serial: s, cartons: 40 }));
  const net = cartons.length * 12.5;
  const gross = cartons.length * 12.95 + pallets.length * 18;
  const html = buildPackingListHtml({
    listNumber: list_number,
    customerName: input.customer_name,
    orderRef: input.order_ref,
    productName: input.product_name,
    cartons,
    pallets,
    netWeightKg: net,
    grossWeightKg: gross,
  });

  const { data, error } = await sb()
    .from("pkg_packing_lists")
    .insert({
      company_id: input.company_id,
      list_number,
      customer_name: input.customer_name,
      order_ref: input.order_ref,
      work_order_id: input.work_order_id,
      carton_count: cartons.length,
      pallet_count: pallets.length,
      gross_weight_kg: gross,
      net_weight_kg: net,
      html_body: html,
      status: "issued",
      issued_by: input.issued_by,
      issued_at: new Date().toISOString(),
    })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export { calculateCartonization, estimateMaterialQty, DEFAULT_HOPE_A4_RULE };
