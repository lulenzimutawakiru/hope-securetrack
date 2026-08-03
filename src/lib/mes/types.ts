/** SecureTrack ERP MES / Advanced Production types */

export const PRODUCT_ITEM_TYPES = [
  { value: "finished_good", label: "Finished Goods" },
  { value: "semi_finished", label: "Semi Finished" },
  { value: "raw_material", label: "Raw Materials" },
  { value: "packaging", label: "Packaging Materials" },
  { value: "consumable", label: "Consumables" },
  { value: "spare", label: "Spare Parts" },
  { value: "by_product", label: "By-products" },
  { value: "scrap", label: "Scrap Materials" },
] as const;

export const MACHINE_STATES = [
  { value: "running", label: "Running", color: "success" },
  { value: "idle", label: "Idle", color: "secondary" },
  { value: "breakdown", label: "Breakdown", color: "destructive" },
  { value: "maintenance", label: "Maintenance", color: "warning" },
  { value: "offline", label: "Offline", color: "outline" },
] as const;

export const PO_STATUSES = [
  "planned",
  "released",
  "in_progress",
  "paused",
  "qc",
  "completed",
  "cancelled",
  "closed",
] as const;

export const PO_TYPES = [
  { value: "manufacturing", label: "Manufacturing" },
  { value: "rework", label: "Rework" },
  { value: "repair", label: "Repair" },
  { value: "trial", label: "Trial" },
  { value: "planned", label: "Planned" },
] as const;

export const WO_STATUSES = [
  "pending",
  "ready",
  "running",
  "paused",
  "completed",
  "skipped",
] as const;

export const INSPECTION_TYPES = [
  { value: "incoming", label: "Incoming Inspection" },
  { value: "in_process", label: "In-process Inspection" },
  { value: "final", label: "Final Inspection" },
  { value: "random", label: "Random Sampling" },
  { value: "laboratory", label: "Laboratory Testing" },
] as const;

export const COST_TYPES = [
  "material",
  "labor",
  "machine",
  "energy",
  "maintenance",
  "overhead",
  "packaging",
  "waste",
] as const;

export const MAINTENANCE_TYPES = [
  { value: "preventive", label: "Preventive" },
  { value: "corrective", label: "Corrective" },
  { value: "predictive", label: "Predictive" },
  { value: "calibration", label: "Calibration" },
] as const;

export const DOWNTIME_REASONS = [
  { code: "SETUP", label: "Setup / Changeover" },
  { code: "BREAK", label: "Machine Breakdown" },
  { code: "MAT", label: "Material Shortage" },
  { code: "QUAL", label: "Quality Hold" },
  { code: "LABOR", label: "Operator Unavailable" },
  { code: "POWER", label: "Power / Utility" },
  { code: "PM", label: "Preventive Maintenance" },
  { code: "OTHER", label: "Other" },
] as const;

export const PACKAGING_TYPES = [
  { value: "ream", label: "Ream" },
  { value: "box", label: "Box" },
  { value: "pallet", label: "Pallet" },
  { value: "container", label: "Container" },
] as const;

export const GENEALOGY_STAGES = [
  "raw",
  "wip",
  "finished",
  "packed",
  "warehouse",
  "dispatch",
] as const;

export const MANUFACTURING_LIFECYCLE = [
  "Sales Forecast",
  "Demand Planning",
  "Production Planning",
  "MRP",
  "Purchase Planning",
  "Material Receiving",
  "Warehouse Allocation",
  "Production Orders",
  "Work Orders",
  "Machine Operations",
  "Quality Inspection",
  "Packaging",
  "Finished Goods",
  "Inventory",
  "Dispatch",
  "Customer Delivery",
] as const;

export type PoStatus = (typeof PO_STATUSES)[number];
export type CostType = (typeof COST_TYPES)[number];

export interface OeeInput {
  plannedMinutes: number;
  runMinutes: number;
  downtimeMinutes: number;
  goodQty: number;
  scrapQty: number;
  idealCycleSec: number;
}

export interface OeeResult {
  availability: number;
  performance: number;
  quality: number;
  oee: number;
}

export interface BomLineInput {
  component_product_id?: string | null;
  component_code: string;
  component_name: string;
  quantity: number;
  uom?: string;
  scrap_pct?: number;
  is_alternative?: boolean;
  substitute_group?: string | null;
  unit_cost?: number;
  level_no?: number;
}

export interface BomExplosionNode {
  product_id?: string | null;
  code: string;
  name: string;
  qty: number;
  uom: string;
  level: number;
  unit_cost: number;
  extended_cost: number;
  children: BomExplosionNode[];
}

export interface MrpSuggestionInput {
  product_id?: string | null;
  component_code: string;
  component_name: string;
  required_qty: number;
  on_hand_qty: number;
  suggestion?: "purchase" | "produce" | "transfer";
  due_date?: string | null;
  source_order?: string | null;
}

export interface CostLayerInput {
  cost_type: CostType | string;
  amount: number;
  currency?: string;
  notes?: string;
}

export interface ProductionCostSummary {
  material: number;
  labor: number;
  machine: number;
  energy: number;
  maintenance: number;
  overhead: number;
  packaging: number;
  waste: number;
  total: number;
  unitCost: number;
  quantity: number;
}
