/**
 * Enterprise workflow surface — re-exports engine + legacy paper pipeline helpers.
 */

export {
  WORKFLOW_DEFS,
  getWorkflowDef,
  listWorkflowDefs,
  createInstance,
  applyTransition,
  getAllowedEvents,
  type WorkflowDefinition,
  type WorkflowInstance,
  type WorkflowTransition,
  type TransitionResult,
} from "./workflows/engine";

import { WORKFLOW_DEFS } from "./workflows/engine";

/** @deprecated Prefer WorkflowStage keys from WORKFLOW_DEFS.paper_pipeline */
export type WorkflowStage =
  | "production"
  | "qr"
  | "print"
  | "pack"
  | "warehouse"
  | "sales"
  | "invoice"
  | "dispatch"
  | "delivered";

const PAPER_HREFS: Record<string, string> = {
  production: "/dashboard/production",
  qr: "/dashboard/qr-codes",
  print: "/dashboard/labels",
  pack: "/dashboard/packing",
  warehouse: "/dashboard/inventory",
  sales: "/dashboard/sales",
  invoice: "/dashboard/invoices",
  dispatch: "/dashboard/dispatch",
  delivered: "/dashboard/dispatch",
};

/** UI pipeline for SecureTrack paper → dispatch (backed by workflow engine) */
export const ENTERPRISE_PIPELINE: {
  stage: WorkflowStage;
  title: string;
  href: string;
  description: string;
}[] = (WORKFLOW_DEFS.paper_pipeline?.stages || []).map((s, i) => ({
  stage: s.key as WorkflowStage,
  title: `${i + 1}. ${s.label}`,
  href: PAPER_HREFS[s.key] || "/dashboard",
  description: s.description || s.label,
}));

export function moneyKES(amount: number): string {
  return new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function moneyUGX(amount: number): string {
  return new Intl.NumberFormat("en-UG", {
    style: "currency",
    currency: "UGX",
    maximumFractionDigits: 0,
  }).format(amount);
}
