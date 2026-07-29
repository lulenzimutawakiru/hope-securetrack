import type { MrpSuggestionInput } from "./types";
import { flattenExplosion, type explodeBom } from "./bom";
import type { BomExplosionNode } from "./types";

export interface OnHandRow {
  code: string;
  qty: number;
  product_id?: string | null;
  name?: string;
}

/**
 * Net requirements: required − on_hand → shortage → purchase/produce suggestion
 */
export function runMrp(params: {
  explosion: BomExplosionNode;
  onHand: OnHandRow[];
  sourceOrder?: string | null;
  dueDate?: string | null;
  produceCodes?: Set<string>;
}): MrpSuggestionInput[] {
  const flat = flattenExplosion(params.explosion);
  const hand = new Map(
    params.onHand.map((r) => [r.code.toUpperCase(), r])
  );
  const produce = params.produceCodes || new Set<string>();

  // Aggregate by code
  const need = new Map<string, { name: string; qty: number; product_id?: string | null }>();
  for (const row of flat) {
    const key = row.code.toUpperCase();
    const prev = need.get(key);
    if (prev) prev.qty += row.qty;
    else
      need.set(key, {
        name: row.name,
        qty: row.qty,
        product_id: row.product_id,
      });
  }

  const suggestions: MrpSuggestionInput[] = [];
  for (const [code, req] of need) {
    const oh = hand.get(code);
    const onHandQty = Number(oh?.qty) || 0;
    const shortage = Math.max(0, req.qty - onHandQty);
    if (shortage <= 0) continue;

    suggestions.push({
      product_id: req.product_id ?? oh?.product_id ?? null,
      component_code: code,
      component_name: req.name || oh?.name || code,
      required_qty: round4(req.qty),
      on_hand_qty: round4(onHandQty),
      suggestion: produce.has(code) ? "produce" : "purchase",
      due_date: params.dueDate ?? null,
      source_order: params.sourceOrder ?? null,
    });
  }

  return suggestions.sort((a, b) => b.required_qty - a.required_qty);
}

/** Capacity check: load vs available hours */
export function capacityCheck(params: {
  workCenterCapacityPerHour: number;
  availableHours: number;
  efficiencyPct: number;
  requiredUnits: number;
  unitsPerHour: number;
}): {
  availableCapacity: number;
  requiredHours: number;
  loadPct: number;
  overloaded: boolean;
  shortfallUnits: number;
} {
  const eff = Math.max(1, params.efficiencyPct) / 100;
  const availableCapacity =
    params.workCenterCapacityPerHour * params.availableHours * eff;
  const uph = Math.max(0.001, params.unitsPerHour);
  const requiredHours = params.requiredUnits / uph;
  const loadPct =
    availableCapacity > 0
      ? (params.requiredUnits / availableCapacity) * 100
      : 100;
  const shortfall = Math.max(0, params.requiredUnits - availableCapacity);
  return {
    availableCapacity: round4(availableCapacity),
    requiredHours: round4(requiredHours),
    loadPct: round2(loadPct),
    overloaded: loadPct > 100,
    shortfallUnits: round4(shortfall),
  };
}

/** Simple demand → MPS planned qty with safety stock */
export function planMpsLine(params: {
  demandQty: number;
  availableQty: number;
  safetyStock?: number;
}): { plannedQty: number; netDemand: number } {
  const safety = Number(params.safetyStock) || 0;
  const net = Math.max(
    0,
    Number(params.demandQty) + safety - Number(params.availableQty)
  );
  return { plannedQty: round4(net), netDemand: round4(net) };
}

/** AI-style schedule ranking: priority + due urgency + machine efficiency */
export function recommendSchedule(
  orders: Array<{
    id: string;
    order_number: string;
    quantity_planned: number;
    priority: number;
    planned_finish?: string | null;
  }>,
  machines: Array<{ id: string; efficiency_pct: number; status: string }>
): Array<{ orderId: string; machineId: string; score: number; reason: string }> {
  const available = machines.filter(
    (m) => m.status === "idle" || m.status === "running"
  );
  const recs: Array<{
    orderId: string;
    machineId: string;
    score: number;
    reason: string;
  }> = [];

  const sorted = [...orders].sort((a, b) => {
    const pa = a.priority ?? 5;
    const pb = b.priority ?? 5;
    if (pa !== pb) return pa - pb;
    const da = a.planned_finish ? new Date(a.planned_finish).getTime() : Infinity;
    const db = b.planned_finish ? new Date(b.planned_finish).getTime() : Infinity;
    return da - db;
  });

  let mi = 0;
  for (const o of sorted) {
    if (available.length === 0) break;
    const m = available[mi % available.length];
    mi++;
    const urgency = o.planned_finish
      ? Math.max(
          0,
          10 -
            (new Date(o.planned_finish).getTime() - Date.now()) /
              (1000 * 60 * 60 * 24)
        )
      : 5;
    const score =
      (10 - (o.priority ?? 5)) * 10 +
      urgency * 5 +
      (Number(m.efficiency_pct) || 80) / 10;
    recs.push({
      orderId: o.id,
      machineId: m.id,
      score: round2(score),
      reason: `Priority ${o.priority}, machine eff ${m.efficiency_pct}%`,
    });
  }
  return recs.sort((a, b) => b.score - a.score);
}

// silence unused import if tree-shaken
void (0 as unknown as typeof explodeBom);

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
