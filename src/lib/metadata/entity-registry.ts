/**
 * Entity registry ? the single source of truth for every business object
 * exposed through the generic CRUD surface (`/api/v2/crud/[entity]`).
 *
 * Each definition declares the database table, module, permission slugs,
 * lifecycle flags (soft delete / archive), searchable columns and audit
 * column availability. The registry drives the CRUD engine: registering an
 * entity here is the only step required to expose it through the API.
 *
 * Isolation rule: every business table is `tenantScoped` (company_id +
 * tenant_id). The engine always filters by the session-derived scope and
 * never trusts client-supplied identity fields.
 */

export type EntityModule =
  | "settings"
  | "hr"
  | "attendance"
  | "payroll"
  | "finance"
  | "inventory"
  | "procurement"
  | "crm"
  | "sales"
  | "sd"
  | "mes"
  | "fleet"
  | "ppm"
  | "ta"
  | "dispatch"
  | "print"
  | "notifications"
  | "crud"
  | "wfm"
  | "assets";

export type CrudAction =
  | "view"
  | "export"
  | "create"
  | "import"
  | "update"
  | "delete"
  | "restore"
  | "archive"
  | "bulk";

/** Permission spec: a single slug for every action, or per-action slugs. */
export type EntityPermissions =
  | string
  | { view?: string; create?: string; update?: string; delete?: string };

export interface EntityDefinition {
  /** Logical name used in API routes, e.g. "employees" (snake_case). */
  entity: string;
  /** Database table name. */
  table: string;
  /** Primary key column name (always "id" today). */
  primaryKey: string;
  /** Owning module for audit + permission grouping. */
  module: EntityModule;
  viewPermission: string;
  createPermission: string;
  updatePermission: string;
  deletePermission: string;
  /** Hard isolation: every query is scoped by company (and tenant when known). */
  tenantScoped: boolean;
  /** True when the table has deleted_at (soft delete). */
  softDelete: boolean;
  /** Column used for the soft-delete flag. */
  deletedColumn?: string;
  /** True when the table has archived_at. */
  archivedAt?: boolean;
  /** Optional boolean column that marks an archived row (e.g. is_archived). */
  archiveColumn?: string;
  /** Optional timestamp column set on archive (defaults to archived_at). */
  archiveTimestampColumn?: string;
  /** Columns searched by ?search= (ilike). Empty means not searchable. */
  searchable?: string[];
  /** Default sort column(s); the first entry is used without an explicit sort. */
  sortable?: string[];
  /** Audit / actor columns present on the table. */
  createdBy?: boolean;
  updatedBy?: boolean;
  hasCreatedAt?: boolean;
  hasUpdatedAt?: boolean;
  /** Workflow triggers, keyed by action (enqueued as jobs). */
  workflows?: {
    onCreate?: string;
    onUpdate?: string;
    onDelete?: string;
    onApprove?: string;
  };
}

/**
 * Fields that are never accepted from client payloads. The engine strips
 * them on create/update and re-derives identity from the session scope.
 */
export const DEFAULT_WRITE_BLACKLIST = [
  "id",
  "tenant_id",
  "company_id",
  "created_at",
  "updated_at",
  "created_by",
  "updated_by",
  "deleted_at",
  "archived_at",
  "is_archived",
];

export const ENTITY_REGISTRY: Record<string, EntityDefinition> = {};

export type DefineEntityOptions = {
  softDelete?: boolean;
  deletedColumn?: string;
  archivedAt?: boolean;
  archiveColumn?: string;
  archiveTimestampColumn?: string;
  searchable?: string[];
  sortable?: string[];
  createdBy?: boolean;
  updatedBy?: boolean;
  hasCreatedAt?: boolean;
  hasUpdatedAt?: boolean;
  workflows?: EntityDefinition["workflows"];
};

function defaultSortable(opts: DefineEntityOptions): string[] | undefined {
  if (opts.sortable) return opts.sortable;
  if (opts.hasCreatedAt === false) {
    if (opts.hasUpdatedAt !== false) return ["updated_at"];
    return undefined;
  }
  return ["created_at"];
}

export function defineEntity(
  entity: string,
  table: string,
  module: EntityModule,
  perms: EntityPermissions,
  opts: DefineEntityOptions = {}
): EntityDefinition {
  const p =
    typeof perms === "string"
      ? { view: perms, create: perms, update: perms, delete: perms }
      : perms;

  const viewPermission = p.view ?? p.create ?? p.update ?? p.delete ?? "";
  const createPermission = p.create ?? p.view ?? p.update ?? p.delete ?? "";
  const updatePermission = p.update ?? p.view ?? p.create ?? p.delete ?? "";
  const deletePermission = p.delete ?? p.view ?? p.create ?? p.update ?? "";

  const def: EntityDefinition = {
    entity,
    table,
    primaryKey: "id",
    module,
    viewPermission,
    createPermission,
    updatePermission,
    deletePermission,
    tenantScoped: true,
    softDelete: opts.softDelete ?? false,
    deletedColumn: opts.deletedColumn ?? (opts.softDelete ? "deleted_at" : undefined),
    archivedAt: opts.archivedAt,
    archiveColumn: opts.archiveColumn,
    archiveTimestampColumn: opts.archiveTimestampColumn,
    searchable: opts.searchable,
    sortable: defaultSortable(opts),
    createdBy: opts.createdBy,
    updatedBy: opts.updatedBy,
    hasCreatedAt: opts.hasCreatedAt,
    hasUpdatedAt: opts.hasUpdatedAt,
    workflows: opts.workflows,
  };

  ENTITY_REGISTRY[entity] = def;
  return def;
}

/** Map a CRUD action to the permission slug that guards it. */
export function permissionForAction(def: EntityDefinition, action: CrudAction): string {
  switch (action) {
    case "view":
    case "export":
      return def.viewPermission;
    case "create":
    case "import":
      return def.createPermission;
    case "update":
      return def.updatePermission;
    case "delete":
    case "restore":
    case "archive":
    case "bulk":
      return def.deletePermission;
    default:
      return def.viewPermission;
  }
}

/** Resolve an entity definition by logical name. */
export function getEntityDefinition(entity: string): EntityDefinition | undefined {
  return ENTITY_REGISTRY[entity];
}

/** All registered entities, in registration order. */
export function getRegisteredEntities(): EntityDefinition[] {
  return Object.values(ENTITY_REGISTRY);
}

/* ===================================================================
 * Registered entities
 * Permission slugs reference the `permissions` catalog seeded by
 * migrations (settings.*, hr.*, inventory.*, finance.*, ...).
 * =================================================================== */

// ---- Organization / settings ----------------------------------------
defineEntity("branches", "branches", "settings", {
  view: "settings.view",
  create: "settings.manage",
  update: "settings.manage",
  delete: "settings.manage",
}, {
  softDelete: true,
  searchable: ["name", "code"],
});

defineEntity("departments", "departments", "settings", {
  view: "settings.view",
  create: "settings.manage",
  update: "settings.manage",
  delete: "settings.manage",
}, {
  softDelete: true,
  searchable: ["name", "code"],
});

// ---- Inventory / products -------------------------------------------
defineEntity("warehouses", "warehouses", "inventory", {
  view: "inventory.view",
  create: "inventory.manage",
  update: "inventory.manage",
  delete: "inventory.manage",
}, {
  softDelete: true,
  searchable: ["name", "code"],
});

defineEntity("product_categories", "product_categories", "inventory", {
  view: "products.view",
  create: "inventory.manage",
  update: "inventory.manage",
  delete: "inventory.manage",
}, {
  searchable: ["name", "code"],
  hasUpdatedAt: false,
});

defineEntity("products", "products", "inventory", {
  view: "products.view",
  create: "inventory.manage",
  update: "inventory.manage",
  delete: "inventory.manage",
}, {
  softDelete: true,
  searchable: ["name", "product_code", "description", "sku", "barcode"],
});

defineEntity("warehouse_zones", "warehouse_zones", "inventory", {
  view: "inventory.view",
  create: "inventory.manage",
  update: "inventory.manage",
  delete: "inventory.manage",
}, {
  searchable: ["name", "code"],
  hasUpdatedAt: false,
});

defineEntity("warehouse_bins", "warehouse_bins", "inventory", {
  view: "inventory.view",
  create: "inventory.manage",
  update: "inventory.manage",
  delete: "inventory.manage",
}, {
  searchable: ["code", "bin_label", "barcode"],
  hasUpdatedAt: false,
});

defineEntity("stock_balances", "stock_balances", "inventory", {
  view: "inventory.view",
  create: "inventory.manage",
  update: "inventory.manage",
  delete: "inventory.manage",
}, {
  hasCreatedAt: false,
  searchable: [],
});

// ---- Print / notifications ------------------------------------------
defineEntity("print_jobs", "print_jobs", "print", {
  view: "print.view",
  create: "print.submit",
  update: "print.manage",
  delete: "print.manage",
}, {
  softDelete: true,
  searchable: [],
  createdBy: true,
});

defineEntity("notifications", "notifications", "notifications", {
  view: "notifications.view",
  create: "notifications.send",
  update: "notifications.manage",
  delete: "notifications.manage",
}, {
  archivedAt: true,
  archiveColumn: "is_archived",
  archiveTimestampColumn: "archived_at",
  searchable: ["title"],
  createdBy: true,
  hasUpdatedAt: false,
});

// ---- CRM --------------------------------------------------------------
defineEntity("customers", "customers", "crm", {
  view: "crm.view",
  create: "crm.manage",
  update: "crm.manage",
  delete: "crm.manage",
}, {
  softDelete: true,
  archivedAt: true,
  searchable: ["name", "code", "email"],
});

defineEntity("sales_leads", "sales_leads", "crm", {
  view: "crm.view",
  create: "crm.leads",
  update: "crm.manage",
  delete: "crm.manage",
}, {
  softDelete: true,
  searchable: ["company_name", "contact_name", "email", "lead_number"],
  createdBy: true,
  updatedBy: true,
});

defineEntity("sales_opportunities", "sales_opportunities", "crm", {
  view: "crm.view",
  create: "crm.opportunities",
  update: "crm.manage",
  delete: "crm.manage",
}, {
  softDelete: true,
  searchable: ["name", "opportunity_number"],
  createdBy: true,
  updatedBy: true,
});

defineEntity("crm_contacts", "crm_contacts", "crm", {
  view: "crm.view",
  create: "crm.manage",
  update: "crm.manage",
  delete: "crm.manage",
}, {
  softDelete: true,
  searchable: ["first_name", "last_name", "email"],
});

defineEntity("crm_activities", "crm_activities", "crm", {
  view: "crm.view",
  create: "crm.manage",
  update: "crm.manage",
  delete: "crm.manage",
}, {
  searchable: ["subject"],
  createdBy: true,
  hasUpdatedAt: false,
});

// ---- Sales -------------------------------------------------------------
defineEntity("sales_orders", "sales_orders", "sales", {
  view: "sales.view",
  create: "sales.manage",
  update: "sales.manage",
  delete: "sales.manage",
}, {
  softDelete: true,
  searchable: ["order_number"],
  createdBy: true,
  updatedBy: true,
});

defineEntity("invoices", "invoices", "sales", {
  view: "invoices.view",
  create: "invoices.manage",
  update: "invoices.manage",
  delete: "invoices.manage",
}, {
  softDelete: true,
  searchable: ["invoice_number"],
});

defineEntity("quotations", "quotations", "sales", {
  view: "sales.view",
  create: "sales.quotes",
  update: "sales.manage",
  delete: "sales.manage",
}, {
  softDelete: true,
  searchable: ["quote_number", "customer_name"],
  createdBy: true,
  updatedBy: true,
});

defineEntity("dispatches", "dispatches", "dispatch", {
  view: "dispatch.view",
  create: "dispatch.manage",
  update: "dispatch.manage",
  delete: "dispatch.manage",
}, {
  softDelete: true,
  searchable: ["dispatch_number", "waybill_number", "vehicle_reg"],
});

// ---- HR / attendance / workforce --------------------------------------
defineEntity("employees", "employees", "hr", {
  view: "hr.view",
  create: "hr.manage",
  update: "hr.manage",
  delete: "hr.manage",
}, {
  softDelete: true,
  archivedAt: true,
  searchable: ["first_name", "last_name", "email", "employee_number"],
  workflows: {
    onCreate: "employee_onboarding",
    onUpdate: "employee_update",
    onDelete: "employee_offboarding",
  },
});

defineEntity("leave_requests", "leave_requests", "hr", {
  view: "hr.view",
  create: "hr.self",
  update: "hr.manage",
  delete: "hr.manage",
}, {
  searchable: [],
});

defineEntity("leave_balances", "leave_balances", "hr", {
  view: "hr.view",
  create: "hr.manage",
  update: "hr.manage",
  delete: "hr.manage",
}, {
  hasCreatedAt: false,
  hasUpdatedAt: false,
  sortable: ["year"],
  searchable: [],
});

defineEntity("performance_reviews", "performance_reviews", "hr", {
  view: "hr.view",
  create: "hr.performance",
  update: "hr.performance",
  delete: "hr.manage",
}, {
  searchable: ["review_number", "period_label"],
  hasUpdatedAt: false,
});

defineEntity("training_courses", "training_courses", "hr", {
  view: "hr.view",
  create: "hr.training",
  update: "hr.training",
  delete: "hr.manage",
}, {
  searchable: ["title", "course_code"],
  hasUpdatedAt: false,
});

defineEntity("training_enrollments", "training_enrollments", "hr", {
  view: "hr.view",
  create: "hr.training",
  update: "hr.training",
  delete: "hr.manage",
}, {
  hasCreatedAt: false,
  hasUpdatedAt: false,
  sortable: ["enrolled_at"],
  searchable: [],
});

defineEntity("attendance_records", "attendance_records", "attendance", {
  view: "att.view",
  create: "att.manage",
  update: "att.manage",
  delete: "att.manage",
}, {
  softDelete: true,
  searchable: [],
});

defineEntity("shift_templates", "shift_templates", "wfm", {
  view: "wfm.view",
  create: "wfm.manage",
  update: "wfm.manage",
  delete: "wfm.manage",
}, {
  softDelete: true,
  searchable: ["name", "code"],
  hasUpdatedAt: false,
});

// ---- Service desk ------------------------------------------------------
defineEntity("support_tickets", "support_tickets", "sd", {
  view: "sd.view",
  create: "sd.agent",
  update: "sd.manage",
  delete: "sd.admin",
}, {
  softDelete: true,
  archivedAt: true,
  searchable: ["ticket_number", "subject", "requester_name"],
  createdBy: true,
});

// ---- Finance / accounting ----------------------------------------------
defineEntity("chart_of_accounts", "chart_of_accounts", "finance", {
  view: "finance.view",
  create: "finance.manage",
  update: "finance.manage",
  delete: "finance.manage",
}, {
  softDelete: true,
  archivedAt: true,
  searchable: ["account_code", "account_name"],
  createdBy: true,
});

defineEntity("gl_journals", "gl_journals", "finance", {
  view: "finance.view",
  create: "finance.post",
  update: "finance.manage",
  delete: "finance.admin",
}, {
  softDelete: true,
  searchable: ["journal_number", "reference"],
  createdBy: true,
});

defineEntity("suppliers", "suppliers", "procurement", {
  view: "srm.view",
  create: "srm.manage",
  update: "srm.manage",
  delete: "srm.manage",
}, {
  softDelete: true,
  archivedAt: true,
  searchable: ["name", "code", "email", "tin_vat"],
  createdBy: true,
});

defineEntity("ap_invoices", "ap_invoices", "finance", {
  view: "finance.view",
  create: "finance.manage",
  update: "finance.manage",
  delete: "finance.manage",
}, {
  softDelete: true,
  searchable: ["invoice_number", "supplier_invoice_ref"],
  createdBy: true,
});

defineEntity("ap_payments", "ap_payments", "finance", {
  view: "finance.view",
  create: "finance.manage",
  update: "finance.manage",
  delete: "finance.manage",
}, {
  softDelete: true,
  searchable: ["payment_number", "reference"],
  createdBy: true,
  hasUpdatedAt: false,
});

defineEntity("ar_receipts", "ar_receipts", "finance", {
  view: "finance.view",
  create: "finance.manage",
  update: "finance.manage",
  delete: "finance.manage",
}, {
  softDelete: true,
  searchable: ["receipt_number", "reference"],
  createdBy: true,
  hasUpdatedAt: false,
});

defineEntity("ar_credit_notes", "ar_credit_notes", "finance", {
  view: "finance.view",
  create: "finance.manage",
  update: "finance.manage",
  delete: "finance.manage",
}, {
  softDelete: true,
  searchable: ["credit_note_number"],
  createdBy: true,
  hasUpdatedAt: false,
});

defineEntity("bank_accounts", "bank_accounts", "finance", {
  view: "finance.view",
  create: "finance.bank",
  update: "finance.bank",
  delete: "finance.admin",
}, {
  softDelete: true,
  searchable: ["account_name", "account_number", "bank_name"],
  hasUpdatedAt: false,
});

defineEntity("bank_reconciliations", "bank_reconciliations", "finance", {
  view: "finance.view",
  create: "finance.bank",
  update: "finance.bank",
  delete: "finance.admin",
}, {
  softDelete: true,
  searchable: [],
  hasUpdatedAt: false,
});

defineEntity("fixed_assets", "fixed_assets", "finance", {
  view: "finance.view",
  create: "finance.manage",
  update: "finance.manage",
  delete: "finance.manage",
}, {
  softDelete: true,
  searchable: ["asset_code", "asset_name", "asset_domain"],
  createdBy: true,
});

defineEntity("budgets", "budgets", "finance", {
  view: "finance.view",
  create: "finance.manage",
  update: "finance.manage",
  delete: "finance.manage",
}, {
  softDelete: true,
  searchable: ["name", "budget_code"],
  createdBy: true,
});

defineEntity("fin_approvals", "fin_approvals", "finance", {
  view: "finance.view",
  create: "finance.approve",
  update: "finance.approve",
  delete: "finance.admin",
}, {
  softDelete: true,
  searchable: ["title", "approval_number", "entity_ref"],
  hasUpdatedAt: false,
});

defineEntity("fin_tax_returns", "fin_tax_returns", "finance", {
  view: "finance.view",
  create: "finance.tax",
  update: "finance.tax",
  delete: "finance.admin",
}, {
  softDelete: true,
  searchable: ["reference", "return_type"],
  hasUpdatedAt: false,
});

// ---- Procurement --------------------------------------------------------
defineEntity("purchase_requisitions", "purchase_requisitions", "procurement", {
  view: "procurement.view",
  create: "procurement.manage",
  update: "procurement.manage",
  delete: "procurement.manage",
}, {
  searchable: ["requisition_number", "project_code", "item_description"],
  createdBy: true,
});

defineEntity("purchase_orders", "purchase_orders", "procurement", {
  view: "procurement.view",
  create: "procurement.manage",
  update: "procurement.manage",
  delete: "procurement.manage",
}, {
  searchable: ["po_number"],
  createdBy: true,
});

defineEntity("purchase_order_lines", "purchase_order_lines", "procurement", {
  view: "procurement.view",
  create: "procurement.manage",
  update: "procurement.manage",
  delete: "procurement.manage",
}, {
  searchable: ["description"],
  hasUpdatedAt: false,
});

// ---- Fleet ---------------------------------------------------------------
defineEntity("fleet_vehicles", "fleet_vehicles", "fleet", {
  view: "fleet.view",
  create: "fleet.manage",
  update: "fleet.manage",
  delete: "fleet.manage",
}, {
  softDelete: true,
  archivedAt: true,
  searchable: ["vehicle_code", "registration", "vin", "chassis_number", "asset_tag"],
  createdBy: true,
  updatedBy: true,
});

defineEntity("fleet_fuel_logs", "fleet_fuel_logs", "fleet", {
  view: "fleet.view",
  create: "fleet.fuel",
  update: "fleet.fuel",
  delete: "fleet.manage",
}, {
  softDelete: true,
  searchable: [],
  createdBy: true,
  hasUpdatedAt: false,
});

// ---- Manufacturing / MES ------------------------------------------------
defineEntity("bom_headers", "bom_headers", "mes", {
  view: "mes.view",
  create: "mes.manage",
  update: "mes.manage",
  delete: "mes.manage",
}, {
  softDelete: true,
  searchable: ["bom_code", "description"],
  hasUpdatedAt: false,
});

defineEntity("mes_production_orders", "mes_production_orders", "mes", {
  view: "mes.view",
  create: "mes.plan",
  update: "mes.manage",
  delete: "mes.manage",
}, {
  softDelete: true,
  archivedAt: true,
  searchable: ["order_number", "customer_name"],
  createdBy: true,
  updatedBy: true,
});

defineEntity("mes_work_orders", "mes_work_orders", "mes", {
  view: "mes.view",
  create: "mes.operate",
  update: "mes.manage",
  delete: "mes.manage",
}, {
  softDelete: true,
  searchable: ["work_order_number", "operation_name"],
  hasUpdatedAt: false,
});

// ---- Payroll -------------------------------------------------------------
defineEntity("payroll_runs", "payroll_runs", "payroll", {
  view: "payroll.view",
  create: "payroll.process",
  update: "payroll.manage",
  delete: "payroll.admin",
}, {
  softDelete: true,
  searchable: ["run_number", "period_label"],
  createdBy: true,
  hasUpdatedAt: false,
});

defineEntity("pay_components", "pay_components", "payroll", {
  view: "payroll.view",
  create: "payroll.manage",
  update: "payroll.manage",
  delete: "payroll.manage",
}, {
  softDelete: true,
  searchable: ["name", "component_code"],
  hasUpdatedAt: false,
});

defineEntity("pay_loans", "pay_loans", "payroll", {
  view: "payroll.view",
  create: "payroll.manage",
  update: "payroll.manage",
  delete: "payroll.manage",
}, {
  softDelete: true,
  searchable: ["loan_number"],
  createdBy: true,
  hasUpdatedAt: false,
});

defineEntity("pay_payslips", "pay_payslips", "payroll", {
  view: "payroll.view",
  create: "payroll.manage",
  update: "payroll.manage",
  delete: "payroll.admin",
}, {
  searchable: ["payslip_number", "period_label"],
  hasUpdatedAt: false,
});

// ---- Fixed / IT assets ----------------------------------------------------
defineEntity("ast_assets", "ast_assets", "assets", {
  view: "ast.view",
  create: "ast.assign",
  update: "ast.manage",
  delete: "ast.manage",
}, {
  softDelete: true,
  searchable: ["name", "asset_tag", "serial_number"],
  createdBy: true,
});

// ---- Projects (PPM) ---------------------------------------------------------
defineEntity("ppm_projects", "ppm_projects", "ppm", {
  view: "ppm.view",
  create: "ppm.plan",
  update: "ppm.manage",
  delete: "ppm.manage",
}, {
  softDelete: true,
  archivedAt: true,
  searchable: ["name", "project_code", "customer_name", "description"],
  createdBy: true,
  updatedBy: true,
});

// ---- Talent acquisition -----------------------------------------------------
defineEntity("ta_vacancies", "ta_vacancies", "ta", {
  view: "ta.view",
  create: "ta.recruit",
  update: "ta.manage",
  delete: "ta.manage",
}, {
  softDelete: true,
  searchable: ["title", "vacancy_code", "requisition_number"],
  createdBy: true,
  updatedBy: true,
});

defineEntity("ta_candidates", "ta_candidates", "ta", {
  view: "ta.view",
  create: "ta.recruit",
  update: "ta.manage",
  delete: "ta.manage",
}, {
  softDelete: true,
  searchable: ["first_name", "last_name", "email", "candidate_number"],
  createdBy: true,
  updatedBy: true,
});

defineEntity("ta_applications", "ta_applications", "ta", {
  view: "ta.view",
  create: "ta.recruit",
  update: "ta.manage",
  delete: "ta.manage",
}, {
  softDelete: true,
  searchable: ["application_number", "candidate_name", "email", "vacancy_title"],
  createdBy: true,
  updatedBy: true,
});
