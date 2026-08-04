import { createClient } from "@/lib/supabase/crud-compat";
import { calculateOee } from "./oee";
import { explodeBom, flattenExplosion, rollupBomCost, requiredQty } from "./bom";
import { runMrp } from "./mrp";
import { estimateManufacturingCost, summarizeCosts } from "./costing";
import type { BomLineInput, CostLayerInput, MrpSuggestionInput } from "./types";

function sb() {
  return createClient();
}

function pad(n: number, w = 6) {
  return String(n).padStart(w, "0");
}

export async function nextOrderNumber(companyId: string, prefix = "PO"): Promise<string> {
  const year = new Date().getFullYear();
  const { count } = await sb()
    .from("mes_production_orders")
    .select("*", { count: "exact", head: true })
    .eq("company_id", companyId);
  return `HDG-${prefix}-${year}-${pad((count ?? 0) + 1)}`;
}

export async function nextWorkOrderNumber(companyId: string): Promise<string> {
  const year = new Date().getFullYear();
  const { count } = await sb()
    .from("mes_work_orders")
    .select("*", { count: "exact", head: true })
    .eq("company_id", companyId);
  return `HDG-WO-${year}-${pad((count ?? 0) + 1)}`;
}

export async function nextInspectionNumber(companyId: string): Promise<string> {
  const year = new Date().getFullYear();
  const { count } = await sb()
    .from("mes_quality_inspections")
    .select("*", { count: "exact", head: true })
    .eq("company_id", companyId);
  return `HDG-QI-${year}-${pad((count ?? 0) + 1)}`;
}

export async function nextNcrNumber(companyId: string): Promise<string> {
  const year = new Date().getFullYear();
  const { count } = await sb()
    .from("mes_ncr")
    .select("*", { count: "exact", head: true })
    .eq("company_id", companyId);
  return `HDG-NCR-${year}-${pad((count ?? 0) + 1)}`;
}

export async function nextMoNumber(companyId: string): Promise<string> {
  const year = new Date().getFullYear();
  const { count } = await sb()
    .from("mes_maintenance_orders")
    .select("*", { count: "exact", head: true })
    .eq("company_id", companyId);
  return `HDG-MO-${year}-${pad((count ?? 0) + 1)}`;
}

export async function createProductionOrder(input: {
  company_id: string;
  product_id: string;
  product_code?: string;
  product_name?: string;
  quantity_planned: number;
  uom?: string;
  order_type?: string;
  bom_id?: string | null;
  routing_id?: string | null;
  work_center_id?: string | null;
  machine_id?: string | null;
  planned_start?: string | null;
  planned_finish?: string | null;
  shift?: string | null;
  priority?: number;
  notes?: string | null;
  created_by?: string | null;
  batch_number?: string | null;
}) {
  const order_number = await nextOrderNumber(input.company_id);
  const batch =
    input.batch_number ||
    `BAT-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${Math.floor(Math.random() * 9000) + 1000}`;

  const { data, error } = await sb()
    .from("mes_production_orders")
    .insert({
      company_id: input.company_id,
      order_number,
      order_type: input.order_type || "manufacturing",
      product_id: input.product_id,
      product_code: input.product_code,
      product_name: input.product_name,
      quantity_planned: input.quantity_planned,
      uom: input.uom || "REAM",
      batch_number: batch,
      bom_id: input.bom_id,
      routing_id: input.routing_id,
      work_center_id: input.work_center_id,
      machine_id: input.machine_id,
      planned_start: input.planned_start,
      planned_finish: input.planned_finish,
      shift: input.shift,
      priority: input.priority ?? 5,
      notes: input.notes,
      created_by: input.created_by,
      status: "planned",
    })
    .select("*")
    .single();

  if (error) throw error;

  // Generate work orders from routing
  if (input.routing_id) {
    await generateWorkOrdersFromRouting({
      company_id: input.company_id,
      production_order_id: data.id,
      routing_id: input.routing_id,
      quantity: input.quantity_planned,
    });
  }

  // Plan material issues from BOM
  if (input.bom_id) {
    await planMaterialIssues({
      company_id: input.company_id,
      production_order_id: data.id,
      bom_id: input.bom_id,
      quantity: input.quantity_planned,
    });
  }

  // Genealogy root
  await sb().from("mes_genealogy").insert({
    company_id: input.company_id,
    production_order_id: data.id,
    batch_number: batch,
    product_code: input.product_code,
    stage: "wip",
    metadata: { order_number },
  });

  return data;
}

export async function generateWorkOrdersFromRouting(params: {
  company_id: string;
  production_order_id: string;
  routing_id: string;
  quantity: number;
}) {
  const { data: ops } = await sb()
    .from("mes_routing_operations")
    .select("*")
    .eq("routing_id", params.routing_id)
    .order("operation_no");

  if (!ops?.length) return [];

  const rows = [];
  for (const op of ops) {
    const work_order_number = await nextWorkOrderNumber(params.company_id);
    const run_minutes =
      (Number(op.run_minutes_per_unit) || 0) * params.quantity +
      (Number(op.setup_minutes) || 0);
    rows.push({
      company_id: params.company_id,
      production_order_id: params.production_order_id,
      work_order_number,
      operation_no: op.operation_no,
      operation_name: op.name,
      work_center_id: op.work_center_id,
      machine_id: op.machine_id,
      status: "pending",
      planned_qty: params.quantity,
      setup_minutes: op.setup_minutes,
      run_minutes,
    });
  }

  const { data, error } = await sb().from("mes_work_orders").insert(rows).select("*");
  if (error) throw error;
  return data || [];
}

export async function planMaterialIssues(params: {
  company_id: string;
  production_order_id: string;
  bom_id: string;
  quantity: number;
}) {
  const { data: header } = await sb()
    .from("bom_headers")
    .select("id, yield_pct, scrap_pct")
    .eq("id", params.bom_id)
    .single();

  const { data: lines } = await sb()
    .from("bom_lines")
    .select("*")
    .eq("bom_id", params.bom_id);

  if (!lines?.length) return [];

  const yieldPct = Number(header?.yield_pct) || 100;
  const headerScrap = Number(header?.scrap_pct) || 0;

  const issues = lines
    .filter((l: { is_alternative?: boolean }) => !l.is_alternative)
    .map((l: Record<string, unknown>) => {
      const base = params.quantity * (Number(l.quantity) || 0);
      const planned = requiredQty(base, Number(l.scrap_pct) || headerScrap, yieldPct);
      return {
        company_id: params.company_id,
        production_order_id: params.production_order_id,
        product_id: l.component_product_id || l.product_id || null,
        component_code: String(l.component_code || l.product_code || ""),
        component_name: String(l.component_name || l.description || ""),
        planned_qty: planned,
        issued_qty: 0,
        uom: String(l.uom || "EA"),
        issue_method: "manual",
      };
    });

  const { data, error } = await sb().from("mes_material_issues").insert(issues).select("*");
  if (error) throw error;
  return data || [];
}

export async function releaseProductionOrder(orderId: string) {
  const { data, error } = await sb()
    .from("mes_production_orders")
    .update({ status: "released", updated_at: new Date().toISOString() })
    .eq("id", orderId)
    .select("*")
    .single();
  if (error) throw error;

  await sb()
    .from("mes_work_orders")
    .update({ status: "ready" })
    .eq("production_order_id", orderId)
    .eq("status", "pending");

  return data;
}

export async function shopFloorEvent(input: {
  company_id: string;
  production_order_id?: string | null;
  work_order_id?: string | null;
  machine_id?: string | null;
  event_type: string;
  quantity?: number | null;
  reason_code?: string | null;
  message?: string | null;
  operator_id?: string | null;
  photo_url?: string | null;
}) {
  const { data: event, error } = await sb()
    .from("mes_shop_floor_events")
    .insert({
      company_id: input.company_id,
      production_order_id: input.production_order_id,
      work_order_id: input.work_order_id,
      machine_id: input.machine_id,
      event_type: input.event_type,
      quantity: input.quantity,
      reason_code: input.reason_code,
      message: input.message,
      operator_id: input.operator_id,
      photo_url: input.photo_url,
    })
    .select("*")
    .single();
  if (error) throw error;

  const now = new Date().toISOString();

  if (input.work_order_id) {
    if (input.event_type === "start") {
      await sb()
        .from("mes_work_orders")
        .update({ status: "running", started_at: now })
        .eq("id", input.work_order_id);
      if (input.production_order_id) {
        await sb()
          .from("mes_production_orders")
          .update({ status: "in_progress", actual_start: now, updated_at: now })
          .eq("id", input.production_order_id)
          .in("status", ["planned", "released", "paused"]);
      }
      if (input.machine_id) {
        await sb()
          .from("production_machines")
          .update({ status: "running" })
          .eq("id", input.machine_id);
      }
    } else if (input.event_type === "pause") {
      await sb()
        .from("mes_work_orders")
        .update({ status: "paused" })
        .eq("id", input.work_order_id);
      if (input.production_order_id) {
        await sb()
          .from("mes_production_orders")
          .update({ status: "paused", updated_at: now })
          .eq("id", input.production_order_id);
      }
    } else if (input.event_type === "resume") {
      await sb()
        .from("mes_work_orders")
        .update({ status: "running" })
        .eq("id", input.work_order_id);
      if (input.production_order_id) {
        await sb()
          .from("mes_production_orders")
          .update({ status: "in_progress", updated_at: now })
          .eq("id", input.production_order_id);
      }
    } else if (input.event_type === "complete") {
      const qty = Number(input.quantity) || 0;
      const { data: wo } = await sb()
        .from("mes_work_orders")
        .select("completed_qty, planned_qty")
        .eq("id", input.work_order_id)
        .single();
      await sb()
        .from("mes_work_orders")
        .update({
          status: "completed",
          finished_at: now,
          completed_qty: (Number(wo?.completed_qty) || 0) + qty,
        })
        .eq("id", input.work_order_id);

      if (input.production_order_id && qty > 0) {
        const { data: po } = await sb()
          .from("mes_production_orders")
          .select("quantity_completed, quantity_planned")
          .eq("id", input.production_order_id)
          .single();
        const completed = (Number(po?.quantity_completed) || 0) + qty;
        const planned = Number(po?.quantity_planned) || 0;
        await sb()
          .from("mes_production_orders")
          .update({
            quantity_completed: completed,
            status: completed >= planned ? "qc" : "in_progress",
            actual_finish: completed >= planned ? now : null,
            updated_at: now,
          })
          .eq("id", input.production_order_id);
      }
      if (input.machine_id) {
        await sb()
          .from("production_machines")
          .update({ status: "idle" })
          .eq("id", input.machine_id);
      }
    } else if (input.event_type === "scrap" && input.production_order_id) {
      const { data: po } = await sb()
        .from("mes_production_orders")
        .select("quantity_scrap")
        .eq("id", input.production_order_id)
        .single();
      await sb()
        .from("mes_production_orders")
        .update({
          quantity_scrap: (Number(po?.quantity_scrap) || 0) + (Number(input.quantity) || 0),
          updated_at: now,
        })
        .eq("id", input.production_order_id);
    }
  }

  if (input.event_type === "downtime" && input.machine_id) {
    await sb().from("mes_downtime").insert({
      company_id: input.company_id,
      machine_id: input.machine_id,
      production_order_id: input.production_order_id,
      reason_code: input.reason_code || "OTHER",
      reason_label: input.message || input.reason_code || "Downtime",
      reported_by: input.operator_id,
    });
    await sb()
      .from("production_machines")
      .update({ status: "breakdown" })
      .eq("id", input.machine_id);
  }

  return event;
}

export async function issueMaterial(input: {
  issue_id: string;
  issued_qty: number;
  issue_method?: string;
  issued_by?: string | null;
}) {
  const { data, error } = await sb()
    .from("mes_material_issues")
    .update({
      issued_qty: input.issued_qty,
      issue_method: input.issue_method || "manual",
      issued_at: new Date().toISOString(),
      issued_by: input.issued_by,
    })
    .eq("id", input.issue_id)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function backflushMaterials(productionOrderId: string, completedQty: number) {
  const { data: issues } = await sb()
    .from("mes_material_issues")
    .select("*")
    .eq("production_order_id", productionOrderId);

  if (!issues?.length) return [];

  const { data: po } = await sb()
    .from("mes_production_orders")
    .select("quantity_planned")
    .eq("id", productionOrderId)
    .single();

  const planned = Number(po?.quantity_planned) || 1;
  const ratio = completedQty / planned;

  const updates = [];
  for (const issue of issues) {
    const issued = round4((Number(issue.planned_qty) || 0) * ratio);
    const { data } = await sb()
      .from("mes_material_issues")
      .update({
        issued_qty: issued,
        issue_method: "backflush",
        issued_at: new Date().toISOString(),
      })
      .eq("id", issue.id)
      .select("*")
      .single();
    if (data) updates.push(data);
  }
  return updates;
}

export async function recordOeeSnapshot(input: {
  company_id: string;
  machine_id?: string | null;
  work_center_id?: string | null;
  snapshot_date?: string;
  shift?: string | null;
  planned_minutes: number;
  run_minutes: number;
  downtime_minutes: number;
  good_qty: number;
  scrap_qty: number;
  ideal_cycle_sec?: number;
}) {
  const oee = calculateOee({
    plannedMinutes: input.planned_minutes,
    runMinutes: input.run_minutes,
    downtimeMinutes: input.downtime_minutes,
    goodQty: input.good_qty,
    scrapQty: input.scrap_qty,
    idealCycleSec: input.ideal_cycle_sec || 60,
  });

  const { data, error } = await sb()
    .from("mes_oee_snapshots")
    .insert({
      company_id: input.company_id,
      machine_id: input.machine_id,
      work_center_id: input.work_center_id,
      snapshot_date: input.snapshot_date || new Date().toISOString().slice(0, 10),
      shift: input.shift,
      availability_pct: oee.availability,
      performance_pct: oee.performance,
      quality_pct: oee.quality,
      oee_pct: oee.oee,
      planned_minutes: input.planned_minutes,
      run_minutes: input.run_minutes,
      downtime_minutes: input.downtime_minutes,
      good_qty: input.good_qty,
      scrap_qty: input.scrap_qty,
      ideal_cycle_sec: input.ideal_cycle_sec || 60,
    })
    .select("*")
    .single();
  if (error) throw error;
  return { snapshot: data, oee };
}

export async function createInspection(input: {
  company_id: string;
  production_order_id?: string | null;
  product_id?: string | null;
  plan_id?: string | null;
  inspection_type?: string;
  sample_size?: number;
  inspector_id?: string | null;
  notes?: string | null;
}) {
  const inspection_number = await nextInspectionNumber(input.company_id);
  const { data, error } = await sb()
    .from("mes_quality_inspections")
    .insert({
      company_id: input.company_id,
      inspection_number,
      production_order_id: input.production_order_id,
      product_id: input.product_id,
      plan_id: input.plan_id,
      inspection_type: input.inspection_type || "final",
      sample_size: input.sample_size || 0,
      inspector_id: input.inspector_id,
      notes: input.notes,
      status: "pending",
    })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function completeInspection(input: {
  inspection_id: string;
  passed: boolean;
  defects?: number;
  result_json?: Record<string, unknown>;
  notes?: string | null;
  create_ncr?: boolean;
  ncr_title?: string;
  company_id?: string;
  production_order_id?: string | null;
  created_by?: string | null;
}) {
  const status = input.passed ? "passed" : "failed";
  const { data, error } = await sb()
    .from("mes_quality_inspections")
    .update({
      status,
      defects: input.defects || 0,
      result_json: input.result_json || {},
      notes: input.notes,
      inspected_at: new Date().toISOString(),
    })
    .eq("id", input.inspection_id)
    .select("*")
    .single();
  if (error) throw error;

  if (input.passed && input.production_order_id) {
    await sb()
      .from("mes_production_orders")
      .update({ status: "completed", updated_at: new Date().toISOString() })
      .eq("id", input.production_order_id)
      .eq("status", "qc");
  }

  if (!input.passed && input.create_ncr && input.company_id) {
    const ncr_number = await nextNcrNumber(input.company_id);
    await sb().from("mes_ncr").insert({
      company_id: input.company_id,
      ncr_number,
      production_order_id: input.production_order_id,
      inspection_id: input.inspection_id,
      title: input.ncr_title || `NCR for ${data.inspection_number}`,
      description: input.notes,
      severity: (input.defects || 0) > 10 ? "high" : "medium",
      status: "open",
      created_by: input.created_by,
    });
  }

  return data;
}

export async function createPackagingHierarchy(input: {
  company_id: string;
  production_order_id: string;
  reams: number;
  reams_per_box?: number;
  boxes_per_pallet?: number;
  batch_prefix?: string;
}) {
  const reamsPerBox = input.reams_per_box || 5;
  const boxesPerPallet = input.boxes_per_pallet || 40;
  const prefix =
    input.batch_prefix ||
    `PKG-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}`;
  const units: Array<Record<string, unknown>> = [];
  const reamIds: string[] = [];

  // Create reams
  for (let i = 1; i <= input.reams; i++) {
    const unit_code = `${prefix}-R${pad(i, 4)}`;
    const qr_code = `QR-${unit_code}`;
    const { data } = await sb()
      .from("mes_packaging_units")
      .insert({
        company_id: input.company_id,
        production_order_id: input.production_order_id,
        unit_type: "ream",
        unit_code,
        qr_code,
        quantity: 1,
        status: "created",
      })
      .select("id")
      .single();
    if (data) {
      reamIds.push(data.id);
      units.push({ unit_code, type: "ream", qr_code });
    }
  }

  // Boxes
  const boxCount = Math.ceil(input.reams / reamsPerBox);
  const boxIds: string[] = [];
  for (let b = 0; b < boxCount; b++) {
    const unit_code = `${prefix}-B${pad(b + 1, 3)}`;
    const qr_code = `QR-${unit_code}`;
    const { data: box } = await sb()
      .from("mes_packaging_units")
      .insert({
        company_id: input.company_id,
        production_order_id: input.production_order_id,
        unit_type: "box",
        unit_code,
        qr_code,
        quantity: reamsPerBox,
        status: "created",
      })
      .select("id")
      .single();
    if (box) {
      boxIds.push(box.id);
      units.push({ unit_code, type: "box", qr_code });
      // Link reams to box
      const slice = reamIds.slice(b * reamsPerBox, (b + 1) * reamsPerBox);
      if (slice.length) {
        await sb()
          .from("mes_packaging_units")
          .update({ parent_unit_id: box.id })
          .in("id", slice);
      }
    }
  }

  // Pallets
  const palletCount = Math.ceil(boxCount / boxesPerPallet);
  for (let p = 0; p < palletCount; p++) {
    const unit_code = `${prefix}-P${pad(p + 1, 2)}`;
    const qr_code = `QR-${unit_code}`;
    const { data: pallet } = await sb()
      .from("mes_packaging_units")
      .insert({
        company_id: input.company_id,
        production_order_id: input.production_order_id,
        unit_type: "pallet",
        unit_code,
        qr_code,
        quantity: boxesPerPallet,
        status: "created",
      })
      .select("id")
      .single();
    if (pallet) {
      units.push({ unit_code, type: "pallet", qr_code });
      const slice = boxIds.slice(p * boxesPerPallet, (p + 1) * boxesPerPallet);
      if (slice.length) {
        await sb()
          .from("mes_packaging_units")
          .update({ parent_unit_id: pallet.id })
          .in("id", slice);
      }
    }
  }

  await sb().from("mes_genealogy").insert({
    company_id: input.company_id,
    production_order_id: input.production_order_id,
    stage: "packed",
    batch_number: prefix,
    metadata: { reams: input.reams, boxes: boxCount, pallets: palletCount },
  });

  return { units, reams: input.reams, boxes: boxCount, pallets: palletCount };
}

export async function postProductionCosts(input: {
  company_id: string;
  production_order_id: string;
  layers: CostLayerInput[];
  quantity?: number;
}) {
  const rows = input.layers.map((l) => ({
    company_id: input.company_id,
    production_order_id: input.production_order_id,
    cost_type: l.cost_type,
    amount: l.amount,
    currency: l.currency || "UGX",
    notes: l.notes,
  }));

  const { error } = await sb().from("mes_cost_layers").insert(rows);
  if (error) throw error;

  const summary = summarizeCosts(input.layers, input.quantity || 1);
  await sb()
    .from("mes_production_orders")
    .update({
      total_cost: summary.total,
      unit_cost: summary.unitCost,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.production_order_id);

  return summary;
}

export async function runMrpForOrder(params: {
  company_id: string;
  production_order_id: string;
}) {
  const { data: po } = await sb()
    .from("mes_production_orders")
    .select("*")
    .eq("id", params.production_order_id)
    .single();
  if (!po) throw new Error("Order not found");

  let lines: BomLineInput[] = [];
  if (po.bom_id) {
    const { data: bomLines } = await sb()
      .from("bom_lines")
      .select("*")
      .eq("bom_id", po.bom_id);
    lines = (bomLines || []).map((l: Record<string, unknown>) => ({
      component_product_id: (l.component_product_id || l.product_id) as string | null,
      component_code: String(l.component_code || l.product_code || ""),
      component_name: String(l.component_name || l.description || ""),
      quantity: Number(l.quantity) || 0,
      uom: String(l.uom || "EA"),
      scrap_pct: Number(l.scrap_pct) || 0,
      unit_cost: Number(l.unit_cost) || 0,
      is_alternative: Boolean(l.is_alternative),
    }));
  }

  const bomMap = new Map<string, BomLineInput[]>();
  bomMap.set(String(po.product_code || "ROOT"), lines);

  const explosion = explodeBom(
    String(po.product_code || "ROOT"),
    String(po.product_name || "Product"),
    Number(po.quantity_planned) || 0,
    bomMap
  );

  // On-hand from inventory balances if available
  const { data: balances } = await sb()
    .from("inventory_balances")
    .select("product_id, quantity, products(product_code, name)")
    .limit(500);

  const onHand: Array<{
    code: string;
    qty: number;
    product_id?: string | null;
    name?: string;
  }> = (balances || []).map((b: Record<string, unknown>) => {
    const p = b.products as { product_code?: string; name?: string } | null;
    return {
      code: p?.product_code || String(b.product_id),
      qty: Number(b.quantity) || 0,
      product_id: (b.product_id as string) || null,
      name: p?.name,
    };
  });

  // Also seed on-hand 0 for components not in inventory
  for (const line of lines) {
    if (!onHand.find((o) => o.code.toUpperCase() === line.component_code.toUpperCase())) {
      onHand.push({
        code: line.component_code,
        qty: 0,
        product_id: line.component_product_id ?? null,
        name: line.component_name,
      });
    }
  }

  const suggestions = runMrp({
    explosion,
    onHand,
    sourceOrder: po.order_number,
    dueDate: po.planned_start
      ? String(po.planned_start).slice(0, 10)
      : new Date().toISOString().slice(0, 10),
  });

  if (suggestions.length) {
    await sb().from("mes_mrp_suggestions").insert(
      suggestions.map((s: MrpSuggestionInput) => ({
        company_id: params.company_id,
        product_id: s.product_id,
        component_code: s.component_code,
        component_name: s.component_name,
        required_qty: s.required_qty,
        on_hand_qty: s.on_hand_qty,
        shortage_qty: Math.max(0, s.required_qty - s.on_hand_qty),
        suggestion: s.suggestion || "purchase",
        due_date: s.due_date,
        source_order: s.source_order,
        status: "open",
      }))
    );
  }

  return { explosion: flattenExplosion(explosion), suggestions };
}

export async function rollupBomHeaderCost(bomId: string) {
  const { data: header } = await sb()
    .from("bom_headers")
    .select("yield_pct")
    .eq("id", bomId)
    .single();
  const { data: lines } = await sb().from("bom_lines").select("*").eq("bom_id", bomId);
  const total = rollupBomCost(
    (lines || []).map((l: Record<string, unknown>) => ({
      quantity: Number(l.quantity) || 0,
      unit_cost: Number(l.unit_cost) || 0,
      scrap_pct: Number(l.scrap_pct) || 0,
    })),
    Number(header?.yield_pct) || 100
  );
  await sb().from("bom_headers").update({ total_cost: total }).eq("id", bomId);
  return total;
}

export async function softDeleteProductionOrder(orderId: string) {
  const { error } = await sb()
    .from("mes_production_orders")
    .update({ deleted_at: new Date().toISOString(), status: "cancelled" })
    .eq("id", orderId);
  if (error) throw error;
}

export async function duplicateProductionOrder(orderId: string, companyId: string) {
  const { data: src } = await sb()
    .from("mes_production_orders")
    .select("*")
    .eq("id", orderId)
    .single();
  if (!src) throw new Error("Order not found");

  return createProductionOrder({
    company_id: companyId,
    product_id: src.product_id,
    product_code: src.product_code,
    product_name: src.product_name,
    quantity_planned: src.quantity_planned,
    uom: src.uom,
    order_type: src.order_type,
    bom_id: src.bom_id,
    routing_id: src.routing_id,
    work_center_id: src.work_center_id,
    machine_id: src.machine_id,
    planned_start: src.planned_start,
    planned_finish: src.planned_finish,
    shift: src.shift,
    priority: src.priority,
    notes: src.notes ? `Copy of ${src.order_number}: ${src.notes}` : `Copy of ${src.order_number}`,
    created_by: src.created_by,
  });
}

export function estimateOrderCost(params: {
  materialCost: number;
  laborHours: number;
  laborRate: number;
  machineHours: number;
  machineRate: number;
  quantity: number;
  overheadPct?: number;
  wastePct?: number;
}) {
  return estimateManufacturingCost({
    materialCost: params.materialCost,
    laborHours: params.laborHours,
    laborRate: params.laborRate,
    machineHours: params.machineHours,
    machineRate: params.machineRate,
    quantity: params.quantity,
    overheadPct: params.overheadPct ?? 10,
    wastePct: params.wastePct ?? 2,
  });
}

function round4(n: number) {
  return Math.round(n * 10000) / 10000;
}
