/** Cartonization engine — optimize cartons & pallets */

import type { CartonizationResult, CartonSize, ProductPackRule } from "./types";

export const DEFAULT_HOPE_A4_RULE: ProductPackRule = {
  product_name: "Premium A4 Copy Paper",
  product_code: "HDG-PPR-A4",
  units_per_pack: 1,
  packs_per_carton: 5,
  cartons_per_pallet: 40,
  unit_weight_kg: 2.5,
  max_carton_weight_kg: 14,
  max_pallet_height_mm: 1800,
};

export const DEFAULT_CARTON_SIZES: CartonSize[] = [
  { size_code: "CTN-A4-5", name: "A4 5-Ream Carton", length_mm: 320, width_mm: 240, height_mm: 280, max_weight_kg: 15, max_volume_cm3: 21504 },
  { size_code: "CTN-MED", name: "Medium Mixed Carton", length_mm: 400, width_mm: 300, height_mm: 300, max_weight_kg: 20, max_volume_cm3: 36000 },
  { size_code: "CTN-LG", name: "Large Export Carton", length_mm: 500, width_mm: 400, height_mm: 400, max_weight_kg: 30, max_volume_cm3: 80000 },
];

export function cartonVolumeCm3(s: CartonSize): number {
  return (s.length_mm * s.width_mm * s.height_mm) / 1000;
}

/**
 * Calculate optimal packaging for a quantity of units (e.g. reams).
 */
export function calculateCartonization(
  totalUnits: number,
  rule: ProductPackRule = DEFAULT_HOPE_A4_RULE,
  cartonSizes: CartonSize[] = DEFAULT_CARTON_SIZES
): CartonizationResult {
  const warnings: string[] = [];
  const n = Math.max(0, Math.floor(totalUnits));
  const upc = Math.max(1, rule.packs_per_carton * rule.units_per_pack);
  const cpp = Math.max(1, rule.cartons_per_pallet);

  const full_cartons = Math.floor(n / upc);
  const remainder_units = n % upc;
  const cartons_required = full_cartons + (remainder_units > 0 ? 1 : 0);

  const carton_weight_kg = upc * rule.unit_weight_kg;
  if (carton_weight_kg > rule.max_carton_weight_kg) {
    warnings.push(
      `Full carton weight ${carton_weight_kg.toFixed(2)} kg exceeds max ${rule.max_carton_weight_kg} kg`
    );
  }

  // Pick recommended carton by weight capacity
  const sorted = [...cartonSizes].sort((a, b) => a.max_weight_kg - b.max_weight_kg);
  let recommended = sorted.find((s) => s.max_weight_kg >= carton_weight_kg) || sorted[sorted.length - 1];
  if (!recommended) {
    recommended = DEFAULT_CARTON_SIZES[0];
  }

  const plan: CartonizationResult["plan"] = [];
  for (let i = 0; i < full_cartons; i++) {
    plan.push({
      carton_no: i + 1,
      units: upc,
      weight_kg: Number((upc * rule.unit_weight_kg).toFixed(3)),
      is_partial: false,
    });
  }
  if (remainder_units > 0) {
    plan.push({
      carton_no: plan.length + 1,
      units: remainder_units,
      weight_kg: Number((remainder_units * rule.unit_weight_kg).toFixed(3)),
      is_partial: true,
    });
    warnings.push(`Last carton is partial (${remainder_units} of ${upc} units)`);
  }

  const pallets_required = cartons_required === 0 ? 0 : Math.ceil(cartons_required / cpp);
  const last_pallet_cartons =
    cartons_required === 0 ? 0 : cartons_required % cpp === 0 ? cpp : cartons_required % cpp;

  const pallet_plan: CartonizationResult["pallet_plan"] = [];
  let cartonCursor = 1;
  for (let p = 1; p <= pallets_required; p++) {
    const remaining = cartons_required - cartonCursor + 1;
    const count = Math.min(cpp, remaining);
    pallet_plan.push({
      pallet_no: p,
      carton_from: cartonCursor,
      carton_to: cartonCursor + count - 1,
      cartons: count,
    });
    cartonCursor += count;
  }

  const estimated_net_weight_kg = Number((n * rule.unit_weight_kg).toFixed(3));
  const packaging_tare = cartons_required * 0.45 + pallets_required * 18;
  const estimated_gross_weight_kg = Number((estimated_net_weight_kg + packaging_tare).toFixed(3));

  return {
    total_units: n,
    units_per_carton: upc,
    full_cartons,
    remainder_units,
    cartons_required,
    pallets_required,
    cartons_per_pallet: cpp,
    last_pallet_cartons,
    estimated_net_weight_kg,
    estimated_gross_weight_kg,
    carton_weight_kg: Number(carton_weight_kg.toFixed(3)),
    recommended_carton: recommended.size_code,
    plan,
    pallet_plan,
    warnings,
  };
}

export function suggestBetterCarton(
  units: number,
  unitWeightKg: number,
  sizes: CartonSize[] = DEFAULT_CARTON_SIZES
): { size: CartonSize; units_fit: number; utilization: number } | null {
  let best: { size: CartonSize; units_fit: number; utilization: number } | null = null;
  for (const s of sizes) {
    const maxByWeight = Math.floor(s.max_weight_kg / Math.max(0.001, unitWeightKg));
    if (maxByWeight < 1) continue;
    const fit = Math.min(maxByWeight, units);
    const util = fit / maxByWeight;
    if (!best || util > best.utilization) {
      best = { size: s, units_fit: fit, utilization: util };
    }
  }
  return best;
}

export function estimateMaterialQty(
  cartons: number,
  pallets: number,
  units: number
): Record<string, number> {
  return {
    wrap_rolls: Math.ceil(units / 100),
    ream_labels: units,
    carton_boxes: cartons,
    carton_labels: cartons,
    tape_rolls: Math.ceil(cartons / 50),
    security_seals: cartons,
    pallets: pallets,
  };
}
