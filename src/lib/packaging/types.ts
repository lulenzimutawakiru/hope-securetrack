/** Enterprise Packaging types */

export const PKG_LIFECYCLE = [
  "Production Done",
  "QC",
  "Instructions",
  "Materials",
  "Pack Line",
  "QR / Labels",
  "Weight",
  "Seal",
  "Palletize",
  "Warehouse",
  "Dispatch",
] as const;

export const MATERIAL_CATEGORIES = [
  { value: "carton", label: "Carton / Box" },
  { value: "wrap", label: "Plastic Wrap" },
  { value: "label", label: "Label / Sticker" },
  { value: "tape", label: "Tape" },
  { value: "seal", label: "Security Seal" },
  { value: "shrink", label: "Shrink Wrap" },
  { value: "pallet", label: "Pallet" },
  { value: "protective", label: "Protective" },
  { value: "other", label: "Other" },
] as const;

export const WO_STATUSES = [
  "draft",
  "released",
  "in_progress",
  "qc",
  "completed",
  "cancelled",
] as const;

export const LINE_STATUSES = ["idle", "running", "downtime", "offline"] as const;

export interface CartonSize {
  size_code: string;
  name: string;
  length_mm: number;
  width_mm: number;
  height_mm: number;
  max_weight_kg: number;
  max_volume_cm3?: number;
}

export interface ProductPackRule {
  product_name: string;
  product_code?: string;
  units_per_pack: number;
  packs_per_carton: number;
  cartons_per_pallet: number;
  unit_weight_kg: number;
  max_carton_weight_kg: number;
  max_pallet_height_mm?: number;
}

export interface CartonizationResult {
  total_units: number;
  units_per_carton: number;
  full_cartons: number;
  remainder_units: number;
  cartons_required: number;
  pallets_required: number;
  cartons_per_pallet: number;
  last_pallet_cartons: number;
  estimated_net_weight_kg: number;
  estimated_gross_weight_kg: number;
  carton_weight_kg: number;
  recommended_carton: string;
  plan: Array<{
    carton_no: number;
    units: number;
    weight_kg: number;
    is_partial: boolean;
  }>;
  pallet_plan: Array<{
    pallet_no: number;
    carton_from: number;
    carton_to: number;
    cartons: number;
  }>;
  warnings: string[];
}

export interface QrHierarchyNode {
  level: "pallet" | "carton" | "ream";
  serial: string;
  qr_payload?: string;
  children?: QrHierarchyNode[];
}
