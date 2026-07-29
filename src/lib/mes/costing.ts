import type { CostLayerInput, CostType, ProductionCostSummary } from "./types";
import { COST_TYPES } from "./types";

export function summarizeCosts(
  layers: CostLayerInput[],
  quantity = 1
): ProductionCostSummary {
  const base: ProductionCostSummary = {
    material: 0,
    labor: 0,
    machine: 0,
    energy: 0,
    maintenance: 0,
    overhead: 0,
    packaging: 0,
    waste: 0,
    total: 0,
    unitCost: 0,
    quantity: Math.max(0, quantity),
  };

  for (const layer of layers) {
    const t = (layer.cost_type || "overhead") as CostType;
    const amt = Number(layer.amount) || 0;
    if (COST_TYPES.includes(t as (typeof COST_TYPES)[number])) {
      base[t as keyof Omit<ProductionCostSummary, "total" | "unitCost" | "quantity">] +=
        amt;
    } else {
      base.overhead += amt;
    }
  }

  base.total =
    base.material +
    base.labor +
    base.machine +
    base.energy +
    base.maintenance +
    base.overhead +
    base.packaging +
    base.waste;

  base.unitCost = base.quantity > 0 ? base.total / base.quantity : base.total;
  return roundSummary(base);
}

/** Standard cost estimate from rates */
export function estimateManufacturingCost(params: {
  materialCost: number;
  laborHours: number;
  laborRate: number;
  machineHours: number;
  machineRate: number;
  energyKwh?: number;
  energyRate?: number;
  packagingCost?: number;
  wastePct?: number;
  overheadPct?: number;
  quantity: number;
}): ProductionCostSummary {
  const material = Number(params.materialCost) || 0;
  const labor = (Number(params.laborHours) || 0) * (Number(params.laborRate) || 0);
  const machine =
    (Number(params.machineHours) || 0) * (Number(params.machineRate) || 0);
  const energy =
    (Number(params.energyKwh) || 0) * (Number(params.energyRate) || 0);
  const packaging = Number(params.packagingCost) || 0;
  const sub = material + labor + machine + energy + packaging;
  const waste = sub * (Math.max(0, Number(params.wastePct) || 0) / 100);
  const overhead = (sub + waste) * (Math.max(0, Number(params.overheadPct) || 0) / 100);

  return summarizeCosts(
    [
      { cost_type: "material", amount: material },
      { cost_type: "labor", amount: labor },
      { cost_type: "machine", amount: machine },
      { cost_type: "energy", amount: energy },
      { cost_type: "packaging", amount: packaging },
      { cost_type: "waste", amount: waste },
      { cost_type: "overhead", amount: overhead },
    ],
    params.quantity
  );
}

export function profitMargin(
  unitCost: number,
  sellingPrice: number
): { margin: number; marginPct: number } {
  const margin = sellingPrice - unitCost;
  const marginPct = sellingPrice > 0 ? (margin / sellingPrice) * 100 : 0;
  return {
    margin: Math.round(margin * 100) / 100,
    marginPct: Math.round(marginPct * 100) / 100,
  };
}

function roundSummary(s: ProductionCostSummary): ProductionCostSummary {
  const r = (n: number) => Math.round(n * 100) / 100;
  return {
    material: r(s.material),
    labor: r(s.labor),
    machine: r(s.machine),
    energy: r(s.energy),
    maintenance: r(s.maintenance),
    overhead: r(s.overhead),
    packaging: r(s.packaging),
    waste: r(s.waste),
    total: r(s.total),
    unitCost: r(s.unitCost),
    quantity: s.quantity,
  };
}
