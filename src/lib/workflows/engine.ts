/**
 * SecureTrack enterprise workflow engine — state machines for business processes.
 * Pure logic layer (testable); persistence via workflow instances table / domain services.
 */

export type WorkflowTransition = {
  from: string | string[];
  to: string;
  event: string;
  /** Optional guard name evaluated by caller */
  guard?: string;
  /** Side-effect hooks (caller implements) */
  effects?: string[];
  /** Requires dual-control / maker-checker */
  dualControl?: boolean;
  label?: string;
};

export type WorkflowDefinition = {
  id: string;
  name: string;
  module: string;
  initial: string;
  terminal: string[];
  transitions: WorkflowTransition[];
  /** Human-readable stages for UI pipeline */
  stages: Array<{ key: string; label: string; description?: string }>;
};

export type WorkflowInstance = {
  id?: string;
  definitionId: string;
  companyId: string;
  entityType: string;
  entityId: string;
  status: string;
  history: Array<{
    at: string;
    from: string;
    to: string;
    event: string;
    actorId?: string | null;
    notes?: string;
  }>;
  metadata?: Record<string, unknown>;
};

export type TransitionResult =
  | {
      ok: true;
      from: string;
      to: string;
      event: string;
      effects: string[];
      dualControl: boolean;
      instance: WorkflowInstance;
    }
  | { ok: false; error: string; allowedEvents?: string[] };

function matchesFrom(from: string | string[], status: string): boolean {
  if (Array.isArray(from)) return from.includes(status) || from.includes("*");
  return from === status || from === "*";
}

export function getAllowedEvents(
  def: WorkflowDefinition,
  status: string
): WorkflowTransition[] {
  return def.transitions.filter((t) => matchesFrom(t.from, status));
}

export function applyTransition(
  def: WorkflowDefinition,
  instance: WorkflowInstance,
  event: string,
  opts?: { actorId?: string | null; notes?: string; force?: boolean }
): TransitionResult {
  if (def.terminal.includes(instance.status) && !opts?.force) {
    return {
      ok: false,
      error: `Workflow is terminal (${instance.status})`,
      allowedEvents: [],
    };
  }

  const candidates = getAllowedEvents(def, instance.status).filter(
    (t) => t.event === event
  );
  if (!candidates.length) {
    return {
      ok: false,
      error: `Event "${event}" not allowed from status "${instance.status}"`,
      allowedEvents: getAllowedEvents(def, instance.status).map((t) => t.event),
    };
  }

  const t = candidates[0];
  const from = instance.status;
  const to = t.to;
  const next: WorkflowInstance = {
    ...instance,
    status: to,
    history: [
      ...instance.history,
      {
        at: new Date().toISOString(),
        from,
        to,
        event,
        actorId: opts?.actorId,
        notes: opts?.notes,
      },
    ],
  };

  return {
    ok: true,
    from,
    to,
    event,
    effects: t.effects || [],
    dualControl: Boolean(t.dualControl),
    instance: next,
  };
}

export function createInstance(
  def: WorkflowDefinition,
  input: {
    companyId: string;
    entityType: string;
    entityId: string;
    metadata?: Record<string, unknown>;
  }
): WorkflowInstance {
  return {
    definitionId: def.id,
    companyId: input.companyId,
    entityType: input.entityType,
    entityId: input.entityId,
    status: def.initial,
    history: [
      {
        at: new Date().toISOString(),
        from: "",
        to: def.initial,
        event: "create",
        notes: "Workflow started",
      },
    ],
    metadata: input.metadata,
  };
}

/** Built-in enterprise process definitions */
export const WORKFLOW_DEFS: Record<string, WorkflowDefinition> = {
  recruitment: {
    id: "recruitment",
    name: "Talent Acquisition",
    module: "talent",
    initial: "job_request",
    terminal: ["hired", "cancelled", "rejected"],
    stages: [
      { key: "job_request", label: "Job Request" },
      { key: "approved", label: "Approved" },
      { key: "vacancy", label: "Vacancy Open" },
      { key: "applied", label: "Applications" },
      { key: "screening", label: "AI Screening" },
      { key: "shortlisted", label: "Shortlisted" },
      { key: "interview", label: "Interview" },
      { key: "assessment", label: "Assessment" },
      { key: "offer", label: "Offer" },
      { key: "accepted", label: "Accepted" },
      { key: "onboarding", label: "Onboarding" },
      { key: "hired", label: "Hired · Payroll" },
    ],
    transitions: [
      { from: "job_request", to: "approved", event: "approve", dualControl: true, effects: ["notify_hr"] },
      { from: "job_request", to: "cancelled", event: "cancel" },
      { from: "approved", to: "vacancy", event: "publish_vacancy", effects: ["create_vacancy"] },
      { from: "vacancy", to: "applied", event: "receive_application", effects: ["notify_recruiter"] },
      { from: "applied", to: "screening", event: "start_screening", effects: ["ai_screen"] },
      { from: "screening", to: "shortlisted", event: "shortlist" },
      { from: "screening", to: "rejected", event: "reject" },
      { from: "shortlisted", to: "interview", event: "schedule_interview" },
      { from: "interview", to: "assessment", event: "pass_interview" },
      { from: "interview", to: "rejected", event: "fail_interview" },
      { from: "assessment", to: "offer", event: "issue_offer", dualControl: true },
      { from: "offer", to: "accepted", event: "accept_offer" },
      { from: "offer", to: "rejected", event: "decline_offer" },
      { from: "accepted", to: "onboarding", event: "start_onboarding", effects: ["create_employee"] },
      { from: "onboarding", to: "hired", event: "complete_onboarding", effects: ["enroll_payroll", "create_identity"] },
    ],
  },
  procurement: {
    id: "procurement",
    name: "Procure-to-Pay",
    module: "procurement",
    initial: "requisition",
    terminal: ["paid", "cancelled"],
    stages: [
      { key: "requisition", label: "Requisition" },
      { key: "budget_ok", label: "Budget Check" },
      { key: "approved", label: "Approved" },
      { key: "rfq", label: "RFQ" },
      { key: "evaluated", label: "Supplier Evaluation" },
      { key: "po", label: "Purchase Order" },
      { key: "received", label: "Goods Receipt" },
      { key: "inspected", label: "Quality Inspection" },
      { key: "invoiced", label: "Supplier Invoice" },
      { key: "matched", label: "Three-Way Match" },
      { key: "paid", label: "Payment" },
    ],
    transitions: [
      { from: "requisition", to: "budget_ok", event: "budget_check", effects: ["check_budget"] },
      { from: "requisition", to: "cancelled", event: "cancel" },
      { from: "budget_ok", to: "approved", event: "approve", dualControl: true },
      { from: "budget_ok", to: "cancelled", event: "reject" },
      { from: "approved", to: "rfq", event: "issue_rfq" },
      { from: "rfq", to: "evaluated", event: "evaluate_suppliers" },
      { from: "evaluated", to: "po", event: "create_po", dualControl: true, effects: ["create_purchase_order"] },
      { from: "po", to: "received", event: "goods_receipt", effects: ["inventory_receive"] },
      { from: "received", to: "inspected", event: "quality_pass" },
      { from: "received", to: "po", event: "quality_fail", effects: ["raise_ncr"] },
      { from: "inspected", to: "invoiced", event: "supplier_invoice" },
      { from: "invoiced", to: "matched", event: "three_way_match", effects: ["match_po_grn_invoice"] },
      { from: "matched", to: "paid", event: "pay", dualControl: true, effects: ["ap_payment", "gl_post"] },
    ],
  },
  manufacturing: {
    id: "manufacturing",
    name: "Order-to-Dispatch (MES)",
    module: "production",
    initial: "sales_order",
    terminal: ["invoiced", "cancelled"],
    stages: [
      { key: "sales_order", label: "Sales Order" },
      { key: "planned", label: "Production Planning" },
      { key: "reserved", label: "Material Reservation" },
      { key: "work_order", label: "Work Order" },
      { key: "in_production", label: "Production" },
      { key: "qc", label: "Quality Control" },
      { key: "finished_goods", label: "Finished Goods" },
      { key: "inventory", label: "Inventory" },
      { key: "dispatched", label: "Dispatch" },
      { key: "invoiced", label: "Invoice" },
    ],
    transitions: [
      { from: "sales_order", to: "planned", event: "plan", effects: ["mrp_run"] },
      { from: "planned", to: "reserved", event: "reserve_materials", effects: ["material_reserve"] },
      { from: "reserved", to: "work_order", event: "release_wo" },
      { from: "work_order", to: "in_production", event: "start_production" },
      { from: "in_production", to: "qc", event: "complete_production" },
      { from: "qc", to: "finished_goods", event: "qc_pass", effects: ["fg_receipt"] },
      { from: "qc", to: "in_production", event: "qc_fail", effects: ["rework"] },
      { from: "finished_goods", to: "inventory", event: "putaway" },
      { from: "inventory", to: "dispatched", event: "dispatch", effects: ["create_shipment"] },
      { from: "dispatched", to: "invoiced", event: "invoice", effects: ["create_invoice", "gl_post"] },
      { from: "*", to: "cancelled", event: "cancel" },
    ],
  },
  payroll: {
    id: "payroll",
    name: "Payroll Cycle",
    module: "payroll",
    initial: "attendance",
    terminal: ["posted", "cancelled"],
    stages: [
      { key: "attendance", label: "Attendance" },
      { key: "overtime", label: "Overtime" },
      { key: "leave", label: "Leave" },
      { key: "allowances", label: "Allowances" },
      { key: "deductions", label: "Deductions" },
      { key: "tax", label: "Tax · NSSF" },
      { key: "processing", label: "Processing" },
      { key: "approval", label: "Approval" },
      { key: "bank_file", label: "Bank File" },
      { key: "payslips", label: "Payslips" },
      { key: "posted", label: "Finance Posting" },
    ],
    transitions: [
      { from: "attendance", to: "overtime", event: "close_attendance" },
      { from: "overtime", to: "leave", event: "close_overtime" },
      { from: "leave", to: "allowances", event: "close_leave" },
      { from: "allowances", to: "deductions", event: "apply_allowances" },
      { from: "deductions", to: "tax", event: "apply_deductions" },
      { from: "tax", to: "processing", event: "calculate_statutory", effects: ["calc_paye_nssf"] },
      { from: "processing", to: "approval", event: "submit_for_approval", dualControl: true },
      { from: "approval", to: "bank_file", event: "approve", dualControl: true, effects: ["lock_period"] },
      { from: "approval", to: "processing", event: "reject" },
      { from: "bank_file", to: "payslips", event: "generate_bank_file", effects: ["bank_export"] },
      { from: "payslips", to: "posted", event: "post_finance", dualControl: true, effects: ["gl_post", "release_payslips"] },
      { from: "*", to: "cancelled", event: "cancel" },
    ],
  },
  paper_pipeline: {
    id: "paper_pipeline",
    name: "SecureTrack Paper · QR · Dispatch",
    module: "production",
    initial: "production",
    terminal: ["delivered", "cancelled"],
    stages: [
      { key: "production", label: "Production batch" },
      { key: "qr", label: "Generate QR" },
      { key: "print", label: "Print labels" },
      { key: "pack", label: "Pack cartons" },
      { key: "warehouse", label: "Warehouse" },
      { key: "sales", label: "Sales order" },
      { key: "invoice", label: "Invoice" },
      { key: "dispatch", label: "Dispatch" },
      { key: "delivered", label: "Delivered" },
    ],
    transitions: [
      { from: "production", to: "qr", event: "complete_batch", effects: ["create_batch"] },
      { from: "qr", to: "print", event: "issue_codes", effects: ["generate_qr"] },
      { from: "print", to: "pack", event: "print_labels" },
      { from: "pack", to: "warehouse", event: "cartonize", effects: ["pack_validation"] },
      { from: "warehouse", to: "sales", event: "receive_stock", effects: ["inventory_receive"] },
      { from: "sales", to: "invoice", event: "confirm_order" },
      { from: "invoice", to: "dispatch", event: "issue_invoice", effects: ["create_invoice"] },
      { from: "dispatch", to: "delivered", event: "deliver", effects: ["proof_of_delivery"] },
      { from: "*", to: "cancelled", event: "cancel" },
    ],
  },
};

export function getWorkflowDef(id: string): WorkflowDefinition | null {
  return WORKFLOW_DEFS[id] || null;
}

export function listWorkflowDefs(): WorkflowDefinition[] {
  return Object.values(WORKFLOW_DEFS);
}
