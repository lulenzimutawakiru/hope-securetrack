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
  | "billing"
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
  | "brand"
  | "assets"
  | "ast"
  | "bi"
  | "dsp"
  | "eal"
  | "ec"
  | "fraud"
  | "hc"
  | "iam"
  | "intg"
  | "pkg"
  | "scm"
  | "wid"
;

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
  | {
      view?: string | string[];
      create?: string | string[];
      update?: string | string[];
      delete?: string | string[];
    };

/**
 * Universal Business Object capabilities. Every registered entity exposes the
 * full capability surface by default so modules never re-implement common
 * object services (timeline, attachments, comments, QR, tags, AI, approvals,
 * audit, …). Individual entities may opt out via `defineEntity(..., { capabilities })`.
 */
export type EntityCapabilities = {
  /** Attachments / file storage (object storage). */
  attachments: boolean;
  /** Photo collection. */
  photos: boolean;
  /** Threaded comments. */
  comments: boolean;
  /** Free-form notes. */
  notes: boolean;
  /** Activity stream. */
  activities: boolean;
  /** Tasks / to-dos. */
  tasks: boolean;
  /** Related records / links. */
  relatedRecords: boolean;
  /** Timeline of state changes. */
  timeline: boolean;
  /** QR code identity. */
  qrCode: boolean;
  /** Barcode identity. */
  barcode: boolean;
  /** RFID identity. */
  rfid: boolean;
  /** Digital signature capture. */
  digitalSignature: boolean;
  /** Tags / labels. */
  tags: boolean;
  /** Custom fields (metadata-driven). */
  customFields: boolean;
  /** AI insights panel. */
  aiInsights: boolean;
  /** Risk scoring. */
  riskScore: boolean;
  /** Notifications. */
  notifications: boolean;
  /** Immutable audit trail. */
  auditTrail: boolean;
  /** Version history. */
  versionHistory: boolean;
  /** Search index. */
  searchIndex: boolean;
  /** Auto-generated API endpoint. */
  apiEndpoint: boolean;
  /** Lifecycle approvals / dual control. */
  approvals: boolean;
  /** Configurable workflow triggers. */
  workflow: boolean;
  /** Import. */
  import: boolean;
  /** Export. */
  export: boolean;
  /** Bulk operations. */
  bulk: boolean;
  /** RBAC + ABAC permissions. */
  permissions: boolean;
  /** Encryption at rest. */
  encryption: boolean;
  /** Data retention policy. */
  dataRetention: boolean;
};

/** Default capability surface — everything on unless an entity opts out. */
export const DEFAULT_CAPABILITIES: EntityCapabilities = {
  attachments: true,
  photos: true,
  comments: true,
  notes: true,
  activities: true,
  tasks: true,
  relatedRecords: true,
  timeline: true,
  qrCode: true,
  barcode: true,
  rfid: true,
  digitalSignature: true,
  tags: true,
  customFields: true,
  aiInsights: true,
  riskScore: true,
  notifications: true,
  auditTrail: true,
  versionHistory: true,
  searchIndex: true,
  apiEndpoint: true,
  approvals: true,
  workflow: true,
  import: true,
  export: true,
  bulk: true,
  permissions: true,
  encryption: true,
  dataRetention: true,
};

export interface EntityDefinition {
  /** Logical name used in API routes, e.g. "employees" (snake_case). */
  entity: string;
  /** Database table name. */
  table: string;
  /** Primary key column name (always "id" today). */
  primaryKey: string;
  /** Owning module for audit + permission grouping. */
  module: EntityModule;
  /**
   * Control-plane entity: generic CRUD access is restricted to SecureTrack
   * platform staff (is_platform_admin with no tenant).
   */
  staffOnly: boolean;
  viewPermission: string | string[];
  createPermission: string | string[];
  updatePermission: string | string[];
  deletePermission: string | string[];
  /** Hard isolation: every query is scoped by company (and tenant when known). */
  tenantScoped: boolean;
  /**
   * Company-level scoping. Defaults to true. Set false for root objects like
   * `companies` that carry no company_id column (they are the scope root);
   * they remain tenant-isolated through tenant_id.
   */
  companyScoped: boolean;
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
  /** Universal Business Object capability surface (defaults to all-on). */
  capabilities: EntityCapabilities;
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
  /** When true, generic CRUD access is restricted to SecureTrack platform staff. */
  staffOnly?: boolean;
  softDelete?: boolean;
  deletedColumn?: string;
  archivedAt?: boolean;
  archiveColumn?: string;
  archiveTimestampColumn?: string;
  /** Company-level scoping. Defaults to true; set false for scope-root entities. */
  companyScoped?: boolean;
  searchable?: string[];
  sortable?: string[];
  createdBy?: boolean;
  updatedBy?: boolean;
  hasCreatedAt?: boolean;
  hasUpdatedAt?: boolean;
  workflows?: EntityDefinition["workflows"];
  capabilities?: Partial<EntityCapabilities>;
};

/** Sorted catalog of every registered Business Object definition. */
export function getEntityCatalog(): EntityDefinition[] {
  return Object.values(ENTITY_REGISTRY).sort((a, b) =>
    a.entity.localeCompare(b.entity)
  );
}

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
    staffOnly: opts.staffOnly ?? false,
    viewPermission,
    createPermission,
    updatePermission,
    deletePermission,
    tenantScoped: true,
    companyScoped: opts.companyScoped ?? true,
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
    capabilities: { ...DEFAULT_CAPABILITIES, ...opts.capabilities },
  };

  ENTITY_REGISTRY[entity] = def;
  return def;
}

/** Map a CRUD action to the permission slug that guards it. */
export function permissionForAction(
  def: EntityDefinition,
  action: CrudAction
): string | string[] {
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
defineEntity("companies", "companies", "settings", {
  view: "settings.view",
  create: "settings.manage",
  update: "settings.manage",
  delete: "settings.admin",
}, {
  companyScoped: false,
  searchable: ["name", "code", "legal_name"],
});

defineEntity("ec_audit_log", "ec_audit_log", "ec", {
  view: "settings.view",
  create: "settings.manage",
  update: "settings.admin",
  delete: "settings.admin",
}, {
  hasUpdatedAt: false,
  searchable: ["action", "entity_table"],
});

// Enterprise company module tables
const EC_VIEW = { view: "settings.view", create: "settings.manage", update: "settings.manage", delete: "settings.manage" } as const;

defineEntity("ec_business_units", "ec_business_units", "ec", EC_VIEW, {
  softDelete: true,
  searchable: ["name", "code"],
});
defineEntity("ec_cost_centers", "ec_cost_centers", "ec", EC_VIEW, {
  softDelete: true,
  searchable: ["name", "code"],
});
defineEntity("ec_org_nodes", "ec_org_nodes", "ec", EC_VIEW, {
  softDelete: true,
  searchable: ["name", "code", "node_type"],
});
defineEntity("ec_company_settings", "ec_company_settings", "ec", EC_VIEW, {
  searchable: ["domain", "setting_key"],
});
defineEntity("ec_company_branding", "ec_company_branding", "ec", EC_VIEW, {
  searchable: [],
});
defineEntity("ec_company_documents", "ec_company_documents", "ec", EC_VIEW, {
  softDelete: true,
  searchable: ["title", "doc_type", "doc_number"],
});
defineEntity("ec_calendar_events", "ec_calendar_events", "ec", EC_VIEW, {
  createdBy: true,
  searchable: ["title", "event_type"],
});
defineEntity("ec_board_members", "ec_board_members", "ec", EC_VIEW, {
  searchable: ["full_name", "email", "title"],
});
defineEntity("ec_committees", "ec_committees", "ec", EC_VIEW, {
  searchable: ["name"],
});
defineEntity("ec_meetings", "ec_meetings", "ec", EC_VIEW, {
  createdBy: true,
  searchable: ["title", "meeting_number", "status"],
});
defineEntity("ec_authorized_signatories", "ec_authorized_signatories", "ec", EC_VIEW, {
  searchable: ["full_name"],
});
defineEntity("ec_risk_register", "ec_risk_register", "ec", EC_VIEW, {
  softDelete: true,
  searchable: ["risk_code", "title", "status"],
});
defineEntity("ec_insurance_policies", "ec_insurance_policies", "ec", EC_VIEW, {
  softDelete: true,
  searchable: ["policy_number", "policy_type", "insurer_name"],
});
defineEntity("ec_ai_insights", "ec_ai_insights", "ec", EC_VIEW, {
  hasUpdatedAt: false,
  searchable: ["title", "insight_type", "status"],
});
defineEntity("verification_logs", "verification_logs", "fraud", {
  view: "fraud.view",
  create: "fraud.investigate",
  update: "fraud.investigate",
  delete: "fraud.investigate",
}, {
  hasUpdatedAt: false,
  searchable: ["result", "serial_number"],
  sortable: ["verified_at", "created_at"],
});

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

defineEntity("stock_adjustments", "stock_adjustments", "inventory", {
  view: "inventory.view",
  create: "inventory.manage",
  update: "inventory.manage",
  delete: "inventory.admin",
}, {
  softDelete: true,
  searchable: ["adjustment_number", "reason"],
  createdBy: true,
  hasUpdatedAt: false,
});

defineEntity("inventory_movements", "inventory_movements", "inventory", {
  view: "inventory.view",
  create: "inventory.manage",
  update: "inventory.manage",
  delete: "inventory.admin",
}, {
  searchable: ["reference_number", "notes"],
  sortable: ["performed_at"],
  createdBy: false,
  hasCreatedAt: false,
  hasUpdatedAt: false,
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

// ---- CRM advanced --------------------------------------------------------
defineEntity("crm_notes", "crm_notes", "crm", {
  view: "crm.view",
  create: "crm.manage",
  update: "crm.manage",
  delete: "crm.manage",
}, {
  searchable: ["body"],
  createdBy: true,
  hasUpdatedAt: false,
});

defineEntity("crm_campaigns", "crm_campaigns", "crm", {
  view: "crm.view",
  create: "crm.marketing",
  update: "crm.manage",
  delete: "crm.manage",
}, {
  softDelete: true,
  searchable: ["name", "code"],
  createdBy: true,
  hasUpdatedAt: false,
});

defineEntity("crm_contracts", "crm_contracts", "crm", {
  view: "crm.view",
  create: "crm.manage",
  update: "crm.manage",
  delete: "crm.manage",
}, {
  searchable: ["contract_number", "title"],
  createdBy: true,
});

defineEntity("crm_documents", "crm_documents", "crm", {
  view: "crm.view",
  create: "crm.manage",
  update: "crm.manage",
  delete: "crm.manage",
}, {
  softDelete: true,
  searchable: ["title", "file_name"],
});

defineEntity("crm_loyalty_ledger", "crm_loyalty_ledger", "crm", {
  view: "crm.view",
  create: "crm.marketing",
  update: "crm.manage",
  delete: "crm.manage",
}, {
  searchable: [],
  createdBy: true,
  hasUpdatedAt: false,
});

defineEntity("crm_segments", "crm_segments", "crm", {
  view: "crm.view",
  create: "crm.marketing",
  update: "crm.manage",
  delete: "crm.manage",
}, {
  searchable: ["name", "code"],
  createdBy: true,
});

const CRM_STD = {
  view: "crm.view",
  create: "crm.manage",
  update: "crm.manage",
  delete: "crm.manage",
} as const;

defineEntity("crm_audit_log", "crm_audit_log", "crm", CRM_STD, {
  hasUpdatedAt: false,
  searchable: ["action", "entity_type"],
});
defineEntity("crm_timeline", "crm_timeline", "crm", CRM_STD, {
  hasUpdatedAt: false,
  searchable: ["title", "kind"],
  sortable: ["occurred_at", "created_at"],
});
defineEntity("crm_merge_log", "crm_merge_log", "crm", CRM_STD, {
  hasUpdatedAt: false,
  searchable: [],
});
defineEntity("crm_feedback", "crm_feedback", "crm", CRM_STD, {
  hasUpdatedAt: false,
  searchable: ["comment"],
});
defineEntity("crm_dealers", "crm_dealers", "crm", CRM_STD, {
  searchable: ["dealer_code", "territory"],
});
defineEntity("crm_tenders", "crm_tenders", "crm", CRM_STD, {
  softDelete: true,
  searchable: ["tender_number", "title"],
});
defineEntity("crm_portal_requests", "crm_portal_requests", "crm", CRM_STD, {
  searchable: ["status"],
});
defineEntity("crm_health_scores", "crm_health_scores", "crm", CRM_STD, {
  hasUpdatedAt: false,
  searchable: [],
});
defineEntity("crm_communications", "crm_communications", "crm", CRM_STD, {
  hasUpdatedAt: false,
  searchable: ["subject", "channel"],
  createdBy: true,
});
defineEntity("crm_insights", "crm_insights", "crm", CRM_STD, {
  hasUpdatedAt: false,
  searchable: ["title", "status"],
});

const FIN_STD = {
  view: "finance.view",
  create: "finance.manage",
  update: "finance.manage",
  delete: "finance.manage",
} as const;

defineEntity("fin_audit_log", "fin_audit_log", "finance", FIN_STD, {
  hasUpdatedAt: false,
  searchable: ["action", "entity_type"],
});
defineEntity("fin_cost_rolls", "fin_cost_rolls", "finance", FIN_STD, {
  searchable: ["roll_number", "product_name"],
  createdBy: true,
});
defineEntity("fin_wip", "fin_wip", "finance", FIN_STD, {
  searchable: ["status"],
});
defineEntity("fin_kpi_snapshots", "fin_kpi_snapshots", "finance", FIN_STD, {
  hasUpdatedAt: false,
  searchable: [],
  sortable: ["snapshot_date", "created_at"],
});
defineEntity("fin_cash_positions", "fin_cash_positions", "finance", FIN_STD, {
  hasUpdatedAt: false,
  sortable: ["position_date", "created_at"],
  searchable: [],
});
defineEntity("fin_cash_forecasts", "fin_cash_forecasts", "finance", FIN_STD, {
  sortable: ["forecast_date", "created_at"],
  searchable: [],
});
defineEntity("fin_petty_cash", "fin_petty_cash", "finance", FIN_STD, {
  searchable: ["voucher_number", "payee"],
  createdBy: true,
});
defineEntity("fin_mobile_money_txns", "fin_mobile_money_txns", "finance", FIN_STD, {
  searchable: ["reference", "status"],
});
defineEntity("finance_insights", "finance_insights", "finance", FIN_STD, {
  hasUpdatedAt: false,
  searchable: ["title", "status"],
});
defineEntity("fin_intercompany_txns", "fin_intercompany_txns", "finance", FIN_STD, {
  searchable: ["txn_number", "status"],
  createdBy: true,
});
defineEntity("fin_posting_rules", "fin_posting_rules", "finance", FIN_STD, {
  softDelete: true,
  searchable: ["rule_code", "event_type", "name"],
});
defineEntity("fin_auto_journals", "fin_auto_journals", "finance", FIN_STD, {
  softDelete: true,
  searchable: ["auto_number", "event_type", "status"],
  createdBy: true,
});

// Attendance hub KPI entities
const ATT_STD = {
  view: "attendance.view",
  create: "attendance.manage",
  update: "attendance.manage",
  delete: "attendance.manage",
} as const;
defineEntity("att_events", "att_events", "attendance", ATT_STD, {
  softDelete: true,
  searchable: ["employee_name", "event_code", "event_type"],
  sortable: ["event_at", "created_at"],
});
defineEntity("att_ai_insights", "att_ai_insights", "attendance", ATT_STD, {
  hasUpdatedAt: false,
  searchable: ["title", "severity"],
});
defineEntity("att_devices", "att_devices", "attendance", ATT_STD, {
  softDelete: true,
  searchable: ["name", "device_code", "status"],
});
defineEntity("att_corrections", "att_corrections", "attendance", ATT_STD, {
  softDelete: true,
  searchable: ["status"],
});
defineEntity("att_violations", "att_violations", "attendance", ATT_STD, {
  softDelete: true,
  searchable: ["status"],
});
defineEntity("att_locations", "att_locations", "attendance", ATT_STD, {
  softDelete: true,
  searchable: ["name", "status"],
});
defineEntity("attendance_records", "attendance_records", "attendance", ATT_STD, {
  searchable: ["work_date"],
  sortable: ["work_date", "created_at"],
});
defineEntity("att_settings", "att_settings", "attendance", ATT_STD, {
  searchable: ["setting_key"],
});
defineEntity("att_qr_tokens", "att_qr_tokens", "attendance", ATT_STD, {
  softDelete: true,
  searchable: ["token_code", "status"],
});
defineEntity("att_field_assignments", "att_field_assignments", "attendance", ATT_STD, {
  softDelete: true,
  searchable: ["employee_name", "status"],
});
defineEntity("att_notifications", "att_notifications", "attendance", ATT_STD, {
  hasUpdatedAt: false,
  searchable: ["title", "category"],
});
defineEntity("att_device_integrations", "att_device_integrations", "attendance", ATT_STD, {
  softDelete: true,
  searchable: ["vendor", "name"],
});
defineEntity("att_device_punches", "att_device_punches", "attendance", ATT_STD, {
  searchable: ["process_status"],
});

defineEntity("distributors", "distributors", "crm", {
  view: "crm.view",
  create: "crm.manage",
  update: "crm.manage",
  delete: "crm.manage",
}, {
  searchable: ["name", "code"],
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

defineEntity("invoice_payments", "invoice_payments", "sales", {
  view: "invoices.view",
  create: "invoices.manage",
  update: "invoices.manage",
  delete: "invoices.manage",
}, {
  searchable: ["reference", "method"],
  hasUpdatedAt: false,
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

// ---- Sales line items & returns ----------------------------------------
defineEntity("sales_order_lines", "sales_order_lines", "sales", {
  view: "sales.view",
  create: "sales.manage",
  update: "sales.manage",
  delete: "sales.manage",
}, {
  softDelete: true,
  searchable: ["product_code", "product_name", "description"],
  hasUpdatedAt: false,
});

defineEntity("quotation_lines", "quotation_lines", "sales", {
  view: "sales.view",
  create: "sales.quotes",
  update: "sales.manage",
  delete: "sales.manage",
}, {
  softDelete: true,
  searchable: ["product_code", "product_name", "description"],
  hasUpdatedAt: false,
});

defineEntity("sales_returns", "sales_returns", "sales", {
  view: "sales.view",
  create: "sales.returns",
  update: "sales.manage",
  delete: "sales.manage",
}, {
  softDelete: true,
  searchable: ["return_number", "rma_number", "customer_name"],
  createdBy: true,
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


defineEntity("public_holidays", "public_holidays", "hr", {
  view: "hr.view",
  create: "hr.manage",
  update: "hr.manage",
  delete: "hr.manage",
}, {
  searchable: ["name"],
  hasUpdatedAt: false,
  createdBy: false,
  updatedBy: false,
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
  create: ["sd.manage", "sd.agent", "sd.admin", "sd.portal"],
  update: ["sd.manage", "sd.agent", "sd.admin"],
  delete: "sd.admin",
}, {
  softDelete: true,
  archivedAt: true,
  searchable: ["ticket_number", "subject", "requester_name"],
  createdBy: true,
});


defineEntity("sd_ticket_events", "sd_ticket_events", "sd", {
  view: "sd.view",
  create: ["sd.manage", "sd.agent", "sd.field", "sd.portal"],
  update: "sd.manage",
  delete: "sd.admin",
}, {
  searchable: ["message", "event_type"],
  hasUpdatedAt: false,
  createdBy: false,
  updatedBy: false,
});

defineEntity("sd_escalation_events", "sd_escalation_events", "sd", {
  view: "sd.view",
  create: ["sd.manage", "sd.agent", "sd.admin"],
  update: "sd.manage",
  delete: "sd.admin",
}, {
  hasUpdatedAt: false,
  createdBy: false,
  updatedBy: false,
  searchable: [],
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

defineEntity("gl_journal_lines", "gl_journal_lines", "finance", {
  view: "finance.view",
  create: "finance.post",
  update: "finance.manage",
  delete: "finance.manage",
}, {
  searchable: ["description"],
  hasUpdatedAt: false,
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
// ---- Billing (bill_*) -----------------------------------------------------
defineEntity("bill_credit_notes", "bill_credit_notes", "billing", {
  view: "billing.view",
  create: "billing.manage",
  update: "billing.manage",
  delete: "billing.admin",
}, {
  softDelete: true,
  searchable: ["credit_note_number", "reason_code"],
  createdBy: true,
});

defineEntity("bill_debit_notes", "bill_debit_notes", "billing", {
  view: "billing.view",
  create: "billing.manage",
  update: "billing.manage",
  delete: "billing.admin",
}, {
  softDelete: true,
  searchable: ["debit_note_number"],
  createdBy: true,
});

defineEntity("bill_payment_gateways", "bill_payment_gateways", "billing", {
  view: "billing.view",
  create: "billing.manage",
  update: "billing.manage",
  delete: "billing.admin",
}, {
  searchable: ["gateway_code", "name", "provider"],
  hasUpdatedAt: false,
});

defineEntity("bill_recurring_schedules", "bill_recurring_schedules", "billing", {
  view: "billing.view",
  create: "billing.recurring",
  update: "billing.recurring",
  delete: "billing.admin",
}, {
  softDelete: true,
  searchable: ["schedule_name", "frequency"],
  createdBy: true,
});

defineEntity("bill_tax_codes", "bill_tax_codes", "billing", {
  view: "billing.view",
  create: "billing.tax",
  update: "billing.tax",
  delete: "billing.admin",
}, {
  searchable: ["code", "name"],
  hasUpdatedAt: false,
});

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

const PAY_STD = {
  view: "payroll.view",
  create: "payroll.manage",
  update: "payroll.manage",
  delete: "payroll.admin",
} as const;

defineEntity("pay_audit", "pay_audit", "payroll", PAY_STD, {
  hasUpdatedAt: false,
  searchable: ["action", "entity_type"],
});
defineEntity("pay_employee_profiles", "pay_employee_profiles", "payroll", PAY_STD, {
  softDelete: true,
  searchable: ["salary_grade", "bank_name"],
});
defineEntity("pay_bonuses", "pay_bonuses", "payroll", PAY_STD, {
  searchable: ["status"],
});
defineEntity("pay_employee_benefits", "pay_employee_benefits", "payroll", PAY_STD, {
  searchable: ["status"],
});
defineEntity("payroll_runs", "payroll_runs", "payroll", PAY_STD, {
  searchable: ["run_number", "period_label", "status"],
  createdBy: true,
});
defineEntity("pay_run_lines", "pay_run_lines", "payroll", PAY_STD, {
  searchable: [],
});
defineEntity("payroll_lines", "payroll_lines", "payroll", PAY_STD, {
  searchable: ["payslip_number", "status"],
});
defineEntity("pay_approvals", "pay_approvals", "payroll", PAY_STD, {
  searchable: ["stage", "status"],
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

defineEntity("pay_advances", "pay_advances", "payroll", {
  view: "payroll.view",
  create: "payroll.manage",
  update: "payroll.approve",
  delete: "payroll.admin",
}, {
  softDelete: true,
  searchable: ["advance_number", "reason"],
  createdBy: true,
  hasUpdatedAt: false,
});

defineEntity("pay_overtime_claims", "pay_overtime_claims", "payroll", {
  view: "payroll.view",
  create: "payroll.manage",
  update: "payroll.manage",
  delete: "payroll.admin",
}, {
  softDelete: true,
  searchable: ["claim_number"],
  createdBy: true,
  hasUpdatedAt: false,
});

defineEntity("pay_loan_schedules", "pay_loan_schedules", "payroll", {
  view: "payroll.view",
  create: "payroll.manage",
  update: "payroll.manage",
  delete: "payroll.admin",
}, {
  searchable: [],
  sortable: ["installment_no"],
  hasCreatedAt: false,
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
const AST_STD = {
  view: "ast.view",
  create: "ast.manage",
  update: "ast.manage",
  delete: "ast.manage",
} as const;

defineEntity("ast_audit_log", "ast_audit_log", "ast", AST_STD, {
  hasUpdatedAt: false,
  searchable: ["action", "entity_type"],
});
defineEntity("ast_number_sequences", "ast_number_sequences", "ast", AST_STD, {
  searchable: ["sequence_key"],
});
defineEntity("ast_identifiers", "ast_identifiers", "ast", AST_STD, {
  searchable: ["id_value", "id_type"],
});
defineEntity("ast_events", "ast_events", "ast", AST_STD, {
  hasUpdatedAt: false,
  searchable: ["title", "event_type"],
});
defineEntity("ast_assignments", "ast_assignments", "ast", AST_STD, {
  searchable: ["assignee_name", "status"],
  sortable: ["assigned_at", "created_at"],
});
defineEntity("ast_locations", "ast_locations", "ast", AST_STD, {
  searchable: ["location_label"],
  sortable: ["recorded_at", "created_at"],
});
defineEntity("ast_documents", "ast_documents", "ast", AST_STD, {
  searchable: ["title", "file_name"],
});
defineEntity("ast_tag_templates", "ast_tag_templates", "ast", AST_STD, {
  searchable: ["template_code", "name"],
});

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

defineEntity("ta_comments", "ta_comments", "ta", {
  view: "ta.view",
  create: "ta.manage",
  update: "ta.manage",
  delete: "ta.manage",
}, {
  softDelete: true,
  searchable: ["body", "author_name"],
});

defineEntity("ta_attachments", "ta_attachments", "ta", {
  view: "ta.view",
  create: "ta.manage",
  update: "ta.manage",
  delete: "ta.manage",
}, {
  softDelete: true,
  searchable: ["file_name"],
});

// ---- Branding / enterprise identity (DAM) --------------------------------
defineEntity("brand_ui_themes", "brand_ui_themes", "brand", {
  view: "brand.view",
  create: "brand.manage",
  update: "brand.manage",
  delete: "brand.manage",
}, {
  searchable: ["theme_name"],
  hasUpdatedAt: false,
});

defineEntity("brand_logos", "brand_logos", "brand", {
  view: "brand.view",
  create: "brand.assets",
  update: "brand.assets",
  delete: "brand.manage",
}, {
  softDelete: true,
  searchable: ["name", "logo_type"],
  createdBy: true,
  hasUpdatedAt: false,
});

defineEntity("brand_fonts", "brand_fonts", "brand", {
  view: "brand.view",
  create: "brand.design",
  update: "brand.design",
  delete: "brand.manage",
}, {
  searchable: ["family_name", "font_role"],
  hasUpdatedAt: false,
});

defineEntity("brand_guidelines", "brand_guidelines", "brand", {
  view: "brand.view",
  create: "brand.publish",
  update: "brand.publish",
  delete: "brand.manage",
}, {
  searchable: ["section_code", "title"],
  createdBy: true,
});

defineEntity("brand_email_signatures", "brand_email_signatures", "brand", {
  view: "brand.view",
  create: "brand.design",
  update: "brand.design",
  delete: "brand.manage",
}, {
  searchable: ["name"],
  hasUpdatedAt: false,
});

defineEntity("brand_product_profiles", "brand_product_profiles", "brand", {
  view: "brand.view",
  create: "brand.assets",
  update: "brand.assets",
  delete: "brand.manage",
}, {
  searchable: ["product_code", "product_name", "brand_label"],
  hasUpdatedAt: false,
});

defineEntity("brand_compliance_issues", "brand_compliance_issues", "brand", {
  view: "brand.view",
  create: "brand.view",
  update: "brand.approve",
  delete: "brand.manage",
}, {
  searchable: ["issue_type", "title", "status"],
  hasUpdatedAt: false,
});

defineEntity("approval_authority", "approval_authority", "settings", {
  view: "settings.view",
  create: "settings.workflows",
  update: "settings.workflows",
  delete: "settings.workflows",
}, {
  hasUpdatedAt: false,
  searchable: []
});

defineEntity("approval_workflows", "approval_workflows", "settings", {
  view: "settings.view",
  create: "settings.workflows",
  update: "settings.workflows",
  delete: "settings.workflows",
}, {
  searchable: ["name"]
});

defineEntity("ast_alerts", "ast_alerts", "ast", {
  view: "ast.view",
  create: "ast.manage",
  update: "ast.manage",
  delete: "ast.manage",
}, {
  hasUpdatedAt: false,
  searchable: ["title", "status", "alert_type"]
});

defineEntity("ast_audit_lines", "ast_audit_lines", "ast", {
  view: "ast.view",
  create: "ast.audit",
  update: "ast.audit",
  delete: "ast.audit",
}, {
  hasUpdatedAt: false,
  hasCreatedAt: false,
  sortable: ["id"],
  searchable: ["notes", "asset_tag"]
});

defineEntity("ast_audits", "ast_audits", "ast", {
  view: "ast.view",
  create: "ast.audit",
  update: "ast.audit",
  delete: "ast.audit",
}, {
  createdBy: true,
  hasUpdatedAt: false,
  searchable: ["name", "status"]
});

defineEntity("ast_categories", "ast_categories", "ast", {
  view: "ast.view",
  create: "ast.manage",
  update: "ast.manage",
  delete: "ast.manage",
}, {
  hasUpdatedAt: false,
  searchable: ["name"]
});

defineEntity("ast_maintenance_links", "ast_maintenance_links", "ast", {
  view: "ast.view",
  create: "ast.manage",
  update: "ast.manage",
  delete: "ast.manage",
}, {
  hasUpdatedAt: false,
  searchable: ["title", "status", "notes"]
});

defineEntity("att_geofences", "att_geofences", "attendance", {
  view: "att.view",
  create: "att.admin",
  update: "att.admin",
  delete: "att.admin",
}, {
  softDelete: true,
  hasUpdatedAt: false,
  searchable: ["name", "status", "notes"]
});

defineEntity("att_locations", "att_locations", "attendance", {
  view: "att.view",
  create: "att.admin",
  update: "att.admin",
  delete: "att.admin",
}, {
  softDelete: true,
  createdBy: true,
  searchable: ["name", "status", "notes"]
});

defineEntity("bank_transactions", "bank_transactions", "finance", {
  view: "finance.view",
  create: "finance.admin",
  update: "finance.admin",
  delete: "finance.admin",
}, {
  createdBy: true,
  hasUpdatedAt: false,
  searchable: ["description", "reference"]
});

defineEntity("bi_ai_insights", "bi_ai_insights", "bi", {
  view: "reports.view",
  create: "reports.ai",
  update: "reports.ai",
  delete: "reports.ai",
}, {
  hasUpdatedAt: false,
  searchable: ["title", "status"]
});

defineEntity("bi_assistant_messages", "bi_assistant_messages", "bi", {
  view: "reports.view",
  create: "reports.ai",
  update: "reports.ai",
  delete: "reports.ai",
}, {
  hasUpdatedAt: false,
  searchable: []
});

defineEntity("bi_assistant_playbooks", "bi_assistant_playbooks", "bi", {
  view: "reports.view",
  create: "reports.assistant",
  update: "reports.assistant",
  delete: "reports.assistant",
}, {
  hasUpdatedAt: false,
  hasCreatedAt: false,
  sortable: ["id"],
  searchable: []
});

defineEntity("bi_assistant_sessions", "bi_assistant_sessions", "bi", {
  view: "reports.view",
  create: "reports.ai",
  update: "reports.ai",
  delete: "reports.ai",
}, {
  hasUpdatedAt: false,
  searchable: ["title"]
});

defineEntity("bi_document_jobs", "bi_document_jobs", "bi", {
  view: "reports.view",
  create: "reports.documents",
  update: "reports.documents",
  delete: "reports.documents",
}, {
  hasUpdatedAt: false,
  searchable: ["title", "reference_number", "status"]
});

defineEntity("bi_document_revisions", "bi_document_revisions", "bi", {
  view: "reports.view",
  create: "reports.documents",
  update: "reports.documents",
  delete: "reports.documents",
}, {
  hasUpdatedAt: false,
  searchable: []
});

defineEntity("bi_forecast_results", "bi_forecast_results", "bi", {
  view: "reports.view",
  create: "reports.intelligence",
  update: "reports.intelligence",
  delete: "reports.intelligence",
}, {
  hasUpdatedAt: false,
  searchable: []
});

defineEntity("bi_intelligent_documents", "bi_intelligent_documents", "bi", {
  view: "reports.view",
  create: "reports.documents",
  update: "reports.documents",
  delete: "reports.documents",
}, {
  softDelete: true,
  searchable: ["title", "status"]
});

defineEntity("bi_kpi_snapshots", "bi_kpi_snapshots", "bi", {
  view: "reports.view",
  create: "reports.kpis",
  update: "reports.kpis",
  delete: "reports.kpis",
}, {
  hasUpdatedAt: false,
  searchable: ["notes"]
});

defineEntity("bi_kpis", "bi_kpis", "bi", {
  view: "reports.view",
  create: "reports.kpis",
  update: "reports.kpis",
  delete: "reports.kpis",
}, {
  softDelete: true,
  searchable: ["name", "description"]
});

defineEntity("bi_regulatory_packages", "bi_regulatory_packages", "bi", {
  view: "reports.view",
  create: "reports.manage",
  update: "reports.manage",
  delete: "reports.manage",
}, {
  hasUpdatedAt: false,
  searchable: ["name"]
});

defineEntity("bi_report_definitions", "bi_report_definitions", "bi", {
  view: "reports.view",
  create: "reports.export",
  update: "reports.export",
  delete: "reports.export",
}, {
  softDelete: true,
  searchable: ["name", "description"]
});

defineEntity("bi_report_runs", "bi_report_runs", "bi", {
  view: "reports.view",
  create: "reports.export",
  update: "reports.export",
  delete: "reports.export",
}, {
  hasUpdatedAt: false,
  hasCreatedAt: false,
  sortable: ["id"],
  searchable: ["status"]
});

defineEntity("bi_report_schedules", "bi_report_schedules", "bi", {
  view: "reports.view",
  create: "reports.manage",
  update: "reports.manage",
  delete: "reports.manage",
}, {
  createdBy: true,
  searchable: ["name"]
});

defineEntity("bill_ai_logs", "bill_ai_logs", "billing", {
  view: "billing.view",
  create: "billing.ai",
  update: "billing.ai",
  delete: "billing.ai",
}, {
  createdBy: true,
  hasUpdatedAt: false,
  searchable: []
});

defineEntity("bill_contract_milestones", "bill_contract_milestones", "billing", {
  view: "billing.view",
  create: "billing.contracts",
  update: "billing.contracts",
  delete: "billing.contracts",
}, {
  hasUpdatedAt: false,
  searchable: ["name", "status"]
});

defineEntity("bill_contracts", "bill_contracts", "billing", {
  view: "billing.view",
  create: "billing.contracts",
  update: "billing.contracts",
  delete: "billing.contracts",
}, {
  softDelete: true,
  createdBy: true,
  searchable: ["title", "status", "notes"]
});

defineEntity("bill_credit_approvals", "bill_credit_approvals", "billing", {
  view: "billing.view",
  create: "billing.approve",
  update: "billing.approve",
  delete: "billing.approve",
}, {
  hasUpdatedAt: false,
  searchable: ["status", "notes", "reason"]
});

defineEntity("bill_credit_events", "bill_credit_events", "billing", {
  view: "billing.view",
  create: "billing.approve",
  update: "billing.approve",
  delete: "billing.approve",
}, {
  hasUpdatedAt: false,
  searchable: []
});

defineEntity("bill_delivery_links", "bill_delivery_links", "billing", {
  view: "billing.view",
  create: "billing.design",
  update: "billing.design",
  delete: "billing.design",
}, {
  searchable: ["status", "notes"]
});

defineEntity("bill_delivery_logs", "bill_delivery_logs", "billing", {
  view: "billing.view",
  create: "billing.collect",
  update: "billing.collect",
  delete: "billing.collect",
}, {
  hasUpdatedAt: false,
  searchable: ["status"]
});

defineEntity("bill_dunning_rules", "bill_dunning_rules", "billing", {
  view: "billing.view",
  create: "billing.collect",
  update: "billing.collect",
  delete: "billing.collect",
}, {
  hasUpdatedAt: false,
  hasCreatedAt: false,
  sortable: ["id"],
  searchable: ["name"]
});

defineEntity("bill_invoice_templates", "bill_invoice_templates", "billing", {
  view: "billing.view",
  create: "billing.manage",
  update: "billing.manage",
  delete: "billing.manage",
}, {
  softDelete: true,
  createdBy: true,
  searchable: ["name", "description"]
});

defineEntity("bill_portal_disputes", "bill_portal_disputes", "billing", {
  view: "billing.view",
  create: "billing.manage",
  update: "billing.manage",
  delete: "billing.manage",
}, {
  hasUpdatedAt: false,
  searchable: ["description", "status", "subject"]
});

defineEntity("bill_portal_users", "bill_portal_users", "billing", {
  view: "billing.view",
  create: "billing.manage",
  update: "billing.manage",
  delete: "billing.manage",
}, {
  hasUpdatedAt: false,
  searchable: ["email"]
});

defineEntity("bill_project_entries", "bill_project_entries", "billing", {
  view: "billing.view",
  create: "billing.manage",
  update: "billing.manage",
  delete: "billing.manage",
}, {
  createdBy: true,
  hasUpdatedAt: false,
  searchable: ["description"]
});

defineEntity("bill_projects", "bill_projects", "billing", {
  view: "billing.view",
  create: "billing.manage",
  update: "billing.manage",
  delete: "billing.manage",
}, {
  softDelete: true,
  hasUpdatedAt: false,
  searchable: ["name", "status", "notes"]
});

defineEntity("bill_reconciliation_batches", "bill_reconciliation_batches", "billing", {
  view: "billing.view",
  create: "billing.collect",
  update: "billing.collect",
  delete: "billing.collect",
}, {
  createdBy: true,
  hasUpdatedAt: false,
  searchable: ["status", "notes", "batch_number"]
});

defineEntity("bill_reconciliation_lines", "bill_reconciliation_lines", "billing", {
  view: "billing.view",
  create: "billing.collect",
  update: "billing.collect",
  delete: "billing.collect",
}, {
  hasUpdatedAt: false,
  searchable: ["description", "reference", "status"]
});

defineEntity("bill_reminders", "bill_reminders", "billing", {
  view: "billing.view",
  create: "billing.collect",
  update: "billing.collect",
  delete: "billing.collect",
}, {
  hasUpdatedAt: false,
  searchable: ["status"]
});

defineEntity("bill_revenue_entries", "bill_revenue_entries", "billing", {
  view: "billing.view",
  create: "billing.manage",
  update: "billing.manage",
  delete: "billing.manage",
}, {
  hasUpdatedAt: false,
  searchable: ["status"]
});

defineEntity("bill_revenue_schedules", "bill_revenue_schedules", "billing", {
  view: "billing.view",
  create: "billing.manage",
  update: "billing.manage",
  delete: "billing.manage",
}, {
  hasUpdatedAt: false,
  searchable: ["description", "status"]
});

defineEntity("bill_sequences", "bill_sequences", "billing", {
  view: "billing.view",
  create: "billing.manage",
  update: "billing.manage",
  delete: "billing.manage",
}, {
  searchable: ["name"]
});

defineEntity("bill_tax_groups", "bill_tax_groups", "billing", {
  view: "billing.view",
  create: "billing.manage",
  update: "billing.manage",
  delete: "billing.manage",
}, {
  hasUpdatedAt: false,
  searchable: ["name"]
});

defineEntity("bom_lines", "bom_lines", "mes", {
  view: "mes.view",
  create: "mes.manage",
  update: "mes.manage",
  delete: "mes.manage",
}, {
  hasUpdatedAt: false,
  searchable: []
});

defineEntity("cartons", "cartons", "inventory", {
  view: "inventory.view",
  create: "inventory.manage",
  update: "inventory.manage",
  delete: "inventory.manage",
}, {
  searchable: ["serial_number"]
});

defineEntity("cost_centers", "cost_centers", "finance", {
  view: "finance.view",
  create: "finance.admin",
  update: "finance.admin",
  delete: "finance.admin",
}, {
  hasUpdatedAt: false,
  searchable: ["name", "code"]
});

defineEntity("credit_reviews", "credit_reviews", "crm", {
  view: "crm.view",
  create: "crm.credit",
  update: "crm.credit",
  delete: "crm.credit",
}, {
  hasUpdatedAt: false,
  searchable: ["notes"]
});

defineEntity("cycle_count_lines", "cycle_count_lines", "inventory", {
  view: "inventory.view",
  create: "inventory.manage",
  update: "inventory.manage",
  delete: "inventory.manage",
}, {
  hasUpdatedAt: false,
  searchable: ["notes", "batch_number"]
});

defineEntity("cycle_counts", "cycle_counts", "inventory", {
  view: "inventory.view",
  create: "inventory.manage",
  update: "inventory.manage",
  delete: "inventory.manage",
}, {
  createdBy: true,
  hasUpdatedAt: false,
  searchable: ["status", "notes"]
});

defineEntity("demand_forecasts", "demand_forecasts", "inventory", {
  view: "inventory.view",
  create: "inventory.manage",
  update: "inventory.manage",
  delete: "inventory.manage",
}, {
  createdBy: true,
  searchable: ["notes"]
});

defineEntity("depreciation_entries", "depreciation_entries", "finance", {
  view: "finance.view",
  create: "finance.admin",
  update: "finance.admin",
  delete: "finance.admin",
}, {
  hasUpdatedAt: false,
  searchable: ["notes"]
});

defineEntity("document_sequences", "document_sequences", "settings", {
  view: "settings.view",
  create: "settings.manage",
  update: "settings.manage",
  delete: "settings.manage",
}, {
  hasCreatedAt: false,
  searchable: []
});

defineEntity("drp_plans", "drp_plans", "ec", {
  view: "ec.view",
  create: "ec.manage",
  update: "ec.manage",
  delete: "ec.manage",
}, {
  hasUpdatedAt: false,
  searchable: ["status", "notes"]
});

defineEntity("dsp_drivers", "dsp_drivers", "dsp", {
  view: "dsp.view",
  create: "dsp.manage",
  update: "dsp.manage",
  delete: "dsp.manage",
}, {
  searchable: ["status", "notes"]
});

defineEntity("dsp_exceptions", "dsp_exceptions", "dsp", {
  view: "dsp.view",
  create: "dsp.approve",
  update: "dsp.approve",
  delete: "dsp.approve",
}, {
  createdBy: true,
  hasUpdatedAt: false,
  searchable: ["title", "status"]
});

defineEntity("dsp_returns", "dsp_returns", "dsp", {
  view: "dsp.view",
  create: "dsp.approve",
  update: "dsp.approve",
  delete: "dsp.approve",
}, {
  createdBy: true,
  hasUpdatedAt: false,
  searchable: ["status", "customer_name", "reason"]
});

const EAL_STD = {
  view: "audit.view",
  create: "audit.manage",
  update: "audit.manage",
  delete: "audit.admin",
} as const;

defineEntity("audit_logs", "audit_logs", "eal", EAL_STD, {
  hasUpdatedAt: false,
  searchable: ["action", "module", "user_email"],
});
defineEntity("eal_events", "eal_events", "eal", EAL_STD, {
  hasUpdatedAt: false,
  searchable: ["audit_id", "action", "module", "user_email"],
  sortable: ["chain_index", "created_at"],
});
defineEntity("eal_archive_batches", "eal_archive_batches", "eal", EAL_STD, {
  searchable: ["batch_number", "status"],
});
defineEntity("eal_archived_events", "eal_archived_events", "eal", EAL_STD, {
  hasUpdatedAt: false,
  searchable: ["audit_id"],
  sortable: ["chain_index", "created_at"],
});
defineEntity("eal_archive_retrievals", "eal_archive_retrievals", "eal", EAL_STD, {
  searchable: ["approval_status", "reason"],
});
defineEntity("eal_config_history", "eal_config_history", "eal", EAL_STD, {
  hasUpdatedAt: false,
  searchable: ["config_type", "action"],
});
defineEntity("eal_logging_policies", "eal_logging_policies", "eal", EAL_STD, {
  searchable: ["policy_code", "name"],
});
defineEntity("eal_approvals", "eal_approvals", "eal", EAL_STD, {
  hasUpdatedAt: false,
  searchable: ["module", "decision"],
});
defineEntity("eal_exports", "eal_exports", "eal", EAL_STD, {
  hasUpdatedAt: false,
  searchable: ["export_format", "module"],
});
defineEntity("eal_api_calls", "eal_api_calls", "eal", EAL_STD, {
  hasUpdatedAt: false,
  searchable: ["path", "method"],
});
defineEntity("eal_print_audit", "eal_print_audit", "eal", EAL_STD, {
  hasUpdatedAt: false,
  searchable: ["document_name"],
});
defineEntity("eal_file_audit", "eal_file_audit", "eal", EAL_STD, {
  hasUpdatedAt: false,
  searchable: ["file_name", "action"],
});
defineEntity("eal_integrity_checkpoints", "eal_integrity_checkpoints", "eal", EAL_STD, {
  hasUpdatedAt: false,
  searchable: ["checkpoint_number", "status"],
});
defineEntity("eal_audit_packages", "eal_audit_packages", "eal", EAL_STD, {
  searchable: ["package_number", "name"],
});
defineEntity("eal_controls", "eal_controls", "eal", EAL_STD, {
  searchable: ["control_code", "name"],
});
defineEntity("eal_siem_connectors", "eal_siem_connectors", "eal", EAL_STD, {
  searchable: ["provider", "name"],
});
defineEntity("eal_siem_outbox", "eal_siem_outbox", "eal", EAL_STD, {
  hasUpdatedAt: false,
  searchable: ["status"],
});
defineEntity("eal_report_runs", "eal_report_runs", "eal", EAL_STD, {
  hasUpdatedAt: false,
  searchable: ["report_code", "name"],
});

defineEntity("eal_alerts", "eal_alerts", "eal", {
  view: "eal.view",
  create: "eal.investigate",
  update: "eal.investigate",
  delete: "eal.investigate",
}, {
  hasUpdatedAt: false,
  searchable: ["title", "status", "alert_type"]
});

defineEntity("eal_findings", "eal_findings", "eal", {
  view: "eal.view",
  create: "eal.investigate",
  update: "eal.investigate",
  delete: "eal.investigate",
}, {
  createdBy: true,
  hasUpdatedAt: false,
  searchable: ["title", "description", "status"]
});

defineEntity("eal_incidents", "eal_incidents", "eal", {
  view: "eal.view",
  create: "eal.investigate",
  update: "eal.investigate",
  delete: "eal.investigate",
}, {
  createdBy: true,
  hasUpdatedAt: false,
  searchable: ["title", "description", "status"]
});

defineEntity("eal_retention_policies", "eal_retention_policies", "eal", {
  view: "eal.view",
  create: "eal.compliance",
  update: "eal.compliance",
  delete: "eal.compliance",
}, {
  hasUpdatedAt: false,
  searchable: ["name"]
});

defineEntity("eal_sessions", "eal_sessions", "eal", {
  view: "eal.view",
  create: "eal.manage",
  update: "eal.manage",
  delete: "eal.manage",
}, {
  hasUpdatedAt: false,
  hasCreatedAt: false,
  sortable: ["id"],
  searchable: ["status"]
});

defineEntity("employee_exits", "employee_exits", "hr", {
  view: "hr.view",
  create: "hr.manage",
  update: "hr.manage",
  delete: "hr.manage",
}, {
  hasUpdatedAt: false,
  searchable: ["status", "reason"]
});

defineEntity("employee_objectives", "employee_objectives", "hr", {
  view: "hr.view",
  create: "hr.manage",
  update: "hr.manage",
  delete: "hr.manage",
}, {
  hasUpdatedAt: false,
  searchable: ["title", "description", "status"]
});

defineEntity("employee_skills", "employee_skills", "hr", {
  view: "hr.view",
  create: "hr.manage",
  update: "hr.manage",
  delete: "hr.manage",
}, {
  hasUpdatedAt: false,
  searchable: ["notes"]
});

defineEntity("erp_modules", "erp_modules", "settings", {
  view: "settings.view",
  create: "settings.manage",
  update: "settings.manage",
  delete: "settings.manage",
}, {
  hasCreatedAt: false,
  searchable: []
});

defineEntity("factories", "factories", "mes", {
  view: "mes.view",
  create: "production.manage",
  update: "production.manage",
  delete: "production.manage",
}, {
  searchable: ["name", "code"]
});

defineEntity("field_jobs", "field_jobs", "dispatch", {
  view: "dispatch.view",
  create: "dispatch.manage",
  update: "dispatch.manage",
  delete: "dispatch.manage",
}, {
  createdBy: true,
  searchable: ["title", "status", "notes", "customer_name"]
});

defineEntity("fiscal_periods", "fiscal_periods", "finance", {
  view: "finance.view",
  create: "finance.close",
  update: "finance.close",
  delete: "finance.close",
}, {
  hasUpdatedAt: false,
  hasCreatedAt: false,
  sortable: ["id"],
  searchable: ["name", "status"]
});

defineEntity("fiscal_years", "fiscal_years", "finance", {
  view: "finance.view",
  create: "finance.close",
  update: "finance.close",
  delete: "finance.close",
}, {
  hasUpdatedAt: false,
  searchable: ["name", "status"]
});

defineEntity("fraud_alerts", "fraud_alerts", "fraud", {
  view: "fraud.view",
  create: "fraud.investigate",
  update: "fraud.investigate",
  delete: "fraud.investigate",
}, {
  searchable: ["title", "description", "status", "alert_type"]
});

defineEntity("goods_receipt_lines", "goods_receipt_lines", "inventory", {
  view: "inventory.view",
  create: "inventory.grn",
  update: "inventory.grn",
  delete: "inventory.grn",
}, {
  hasUpdatedAt: false,
  searchable: ["notes", "batch_number", "serial_number"]
});

defineEntity("goods_receipts", "goods_receipts", "inventory", {
  view: "inventory.view",
  create: "inventory.grn",
  update: "inventory.grn",
  delete: "inventory.grn",
}, {
  createdBy: true,
  searchable: ["status", "notes", "supplier_name"]
});

defineEntity("stock_reservations", "stock_reservations", "inventory", {
  view: "inventory.view",
  create: "inventory.manage",
  update: "inventory.manage",
  delete: "inventory.manage",
}, {
  createdBy: true,
  searchable: ["reservation_number", "status", "notes"],
});

defineEntity("stock_transfers", "stock_transfers", "inventory", {
  view: "inventory.view",
  create: "inventory.manage",
  update: "inventory.manage",
  delete: "inventory.manage",
}, {
  createdBy: true,
  searchable: ["transfer_number", "status", "reason"],
});

defineEntity("inventory_approvals", "inventory_approvals", "inventory", {
  view: "inventory.view",
  create: "inventory.manage",
  update: "inventory.manage",
  delete: "inventory.manage",
}, {
  hasUpdatedAt: false,
  searchable: ["document_type", "action", "document_number", "comments"],
});

defineEntity("batch_trace_events", "batch_trace_events", "inventory", {
  view: "inventory.view",
  create: "production.manage",
  update: "production.manage",
  delete: "inventory.manage",
}, {
  hasCreatedAt: false,
  hasUpdatedAt: false,
  sortable: ["event_at"],
  searchable: ["batch_number", "serial_number", "reference_number"],
});

defineEntity("hc_bots", "hc_bots", "hc", {
  view: "hc.view",
  create: "hc.manage",
  update: "hc.manage",
  delete: "hc.manage",
}, {
  hasUpdatedAt: false,
  searchable: ["name", "description"]
});

defineEntity("hc_knowledge", "hc_knowledge", "hc", {
  view: "hc.view",
  create: "hc.manage",
  update: "hc.manage",
  delete: "hc.manage",
}, {
  searchable: ["title", "status"]
});

defineEntity("hc_user_settings", "hc_user_settings", "hc", {
  view: "hc.view",
  create: "hc.manage",
  update: "hc.manage",
  delete: "hc.manage",
}, {
  hasUpdatedAt: false,
  hasCreatedAt: false,
  sortable: ["id"],
  searchable: []
});

defineEntity("hc_approvals", "hc_approvals", "hc", {
  view: "hc.view",
  create: "hc.manage",
  update: "hc.manage",
  delete: "hc.manage",
}, {
  softDelete: true,
  searchable: ["title", "description", "entity_label", "requester_name", "approver_name", "entity_type"]
});

defineEntity("hc_copilot_sessions", "hc_copilot_sessions", "hc", {
  view: "hc.view",
  create: "hc.ai",
  update: "hc.manage",
  delete: "hc.manage",
}, {
  softDelete: true,
  searchable: ["user_message", "answer", "intent"]
});

defineEntity("hc_external_participants", "hc_external_participants", "hc", {
  view: "hc.view",
  create: "hc.manage",
  update: "hc.manage",
  delete: "hc.manage",
}, {
  softDelete: true,
  searchable: ["display_name", "email", "external_type"]
});
defineEntity("idm_abac_rules", "idm_abac_rules", "iam", {
  view: "iam.view",
  create: "iam.abac",
  update: "iam.abac",
  delete: "iam.abac",
}, {
  hasUpdatedAt: false,
  searchable: ["name", "description"]
});

defineEntity("idm_access_requests", "idm_access_requests", "iam", {
  view: "iam.view",
  create: "iam.approvals",
  update: "iam.approvals",
  delete: "iam.approvals",
}, {
  hasUpdatedAt: false,
  searchable: ["title", "description", "status"]
});

defineEntity("idm_devices", "idm_devices", "iam", {
  view: "iam.view",
  create: "iam.manage",
  update: "iam.manage",
  delete: "iam.manage",
}, {
  hasUpdatedAt: false,
  searchable: ["device_name"]
});

defineEntity("idm_provision_requests", "idm_provision_requests", "iam", {
  view: "iam.view",
  create: "iam.approvals",
  update: "iam.approvals",
  delete: "iam.approvals",
}, {
  searchable: ["email", "status", "first_name", "last_name"]
});

defineEntity("idm_sso_providers", "idm_sso_providers", "iam", {
  view: "iam.view",
  create: "iam.manage",
  update: "iam.manage",
  delete: "iam.manage",
}, {
  hasUpdatedAt: false,
  searchable: ["name"]
});

defineEntity("idm_user_roles", "idm_user_roles", "iam", {
  view: "iam.view",
  create: "iam.manage",
  update: "iam.manage",
  delete: "iam.manage",
}, {
  hasUpdatedAt: false,
  hasCreatedAt: false,
  sortable: ["id"],
  searchable: []
});

defineEntity("inbound_shipments", "inbound_shipments", "procurement", {
  view: "procurement.view",
  create: "procurement.approve",
  update: "procurement.approve",
  delete: "procurement.approve",
}, {
  createdBy: true,
  searchable: ["status", "notes"]
});

defineEntity("integration_configs", "integration_configs", "intg", {
  view: "intg.view",
  create: "intg.manage",
  update: "intg.manage",
  delete: "intg.manage",
}, {
  hasCreatedAt: false,
  searchable: ["name"]
});

defineEntity("intg_alerts", "intg_alerts", "intg", {
  view: "intg.view",
  create: "intg.manage",
  update: "intg.manage",
  delete: "intg.manage",
}, {
  hasUpdatedAt: false,
  searchable: ["title", "status", "alert_type"]
});

defineEntity("intg_api_apps", "intg_api_apps", "intg", {
  view: "intg.view",
  create: "intg.api",
  update: "intg.api",
  delete: "intg.api",
}, {
  hasUpdatedAt: false,
  searchable: ["name", "description", "status"]
});

defineEntity("intg_api_keys", "intg_api_keys", "intg", {
  view: "intg.view",
  create: "intg.api",
  update: "intg.api",
  delete: "intg.api",
}, {
  createdBy: true,
  hasUpdatedAt: false,
  searchable: ["name"]
});

defineEntity("intg_api_logs", "intg_api_logs", "intg", {
  view: "intg.view",
  create: "intg.api",
  update: "intg.api",
  delete: "intg.api",
}, {
  hasUpdatedAt: false,
  searchable: []
});

defineEntity("intg_api_routes", "intg_api_routes", "intg", {
  view: "intg.view",
  create: "intg.api",
  update: "intg.api",
  delete: "intg.api",
}, {
  hasUpdatedAt: false,
  searchable: ["description"]
});

defineEntity("intg_connections", "intg_connections", "intg", {
  view: "intg.view",
  create: "intg.manage",
  update: "intg.manage",
  delete: "intg.manage",
}, {
  softDelete: true,
  createdBy: true,
  searchable: ["name", "status"]
});

defineEntity("intg_slack_workspaces", "intg_slack_workspaces", "intg", {
  view: "intg.view",
  create: "intg.manage",
  update: "intg.manage",
  delete: "intg.manage",
}, {
  softDelete: true,
  searchable: ["team_name", "team_id", "default_channel_name"],
});

defineEntity("intg_slack_delivery_log", "intg_slack_delivery_log", "intg", {
  view: "intg.view",
  create: "intg.manage",
  update: "intg.manage",
  delete: "intg.admin",
}, {
  softDelete: false,
  searchable: ["event_type", "status"],
});

defineEntity("intg_mtn_kyc_verifications", "intg_mtn_kyc_verifications", "intg", {
  view: "intg.view",
  create: "intg.manage",
  update: "intg.manage",
  delete: "intg.admin",
}, {
  softDelete: false,
  searchable: ["transaction_id", "target_system", "status_code"],
});

defineEntity("intg_connectors", "intg_connectors", "intg", {
  view: "intg.view",
  create: "intg.manage",
  update: "intg.manage",
  delete: "intg.manage",
}, {
  hasUpdatedAt: false,
  searchable: ["name", "description"]
});

defineEntity("intg_field_maps", "intg_field_maps", "intg", {
  view: "intg.view",
  create: "intg.manage",
  update: "intg.manage",
  delete: "intg.manage",
}, {
  hasUpdatedAt: false,
  searchable: ["name"]
});

defineEntity("intg_gps_positions", "intg_gps_positions", "intg", {
  view: "intg.view",
  create: "intg.iot",
  update: "intg.iot",
  delete: "intg.iot",
}, {
  hasUpdatedAt: false,
  hasCreatedAt: false,
  sortable: ["id"],
  searchable: ["vehicle_code"]
});

defineEntity("intg_hardware_devices", "intg_hardware_devices", "intg", {
  view: "intg.view",
  create: "intg.iot",
  update: "intg.iot",
  delete: "intg.iot",
}, {
  hasUpdatedAt: false,
  searchable: ["name", "status"]
});

defineEntity("intg_health_checks", "intg_health_checks", "intg", {
  view: "intg.view",
  create: "intg.manage",
  update: "intg.manage",
  delete: "intg.manage",
}, {
  hasUpdatedAt: false,
  hasCreatedAt: false,
  sortable: ["id"],
  searchable: []
});

defineEntity("intg_iot_devices", "intg_iot_devices", "intg", {
  view: "intg.view",
  create: "intg.iot",
  update: "intg.iot",
  delete: "intg.iot",
}, {
  hasUpdatedAt: false,
  searchable: ["name", "status", "location_name"]
});

defineEntity("intg_iot_telemetry", "intg_iot_telemetry", "intg", {
  view: "intg.view",
  create: "intg.iot",
  update: "intg.iot",
  delete: "intg.iot",
}, {
  hasUpdatedAt: false,
  hasCreatedAt: false,
  sortable: ["id"],
  searchable: []
});

defineEntity("intg_queue_messages", "intg_queue_messages", "intg", {
  view: "intg.view",
  create: "intg.manage",
  update: "intg.manage",
  delete: "intg.manage",
}, {
  hasUpdatedAt: false,
  searchable: ["status"]
});

defineEntity("intg_sdk_downloads", "intg_sdk_downloads", "intg", {
  view: "intg.view",
  create: "intg.api",
  update: "intg.api",
  delete: "intg.api",
}, {
  hasUpdatedAt: false,
  searchable: []
});

defineEntity("intg_secrets", "intg_secrets", "intg", {
  view: "intg.view",
  create: "intg.manage",
  update: "intg.manage",
  delete: "intg.manage",
}, {
  hasUpdatedAt: false,
  searchable: ["name"]
});

defineEntity("intg_sync_jobs", "intg_sync_jobs", "intg", {
  view: "intg.view",
  create: "intg.manage",
  update: "intg.manage",
  delete: "intg.manage",
}, {
  hasUpdatedAt: false,
  searchable: ["name", "status"]
});

defineEntity("intg_sync_runs", "intg_sync_runs", "intg", {
  view: "intg.view",
  create: "intg.manage",
  update: "intg.manage",
  delete: "intg.manage",
}, {
  hasUpdatedAt: false,
  hasCreatedAt: false,
  sortable: ["id"],
  searchable: ["status"]
});

defineEntity("intg_webhook_deliveries", "intg_webhook_deliveries", "intg", {
  view: "intg.view",
  create: "intg.manage",
  update: "intg.manage",
  delete: "intg.manage",
}, {
  hasUpdatedAt: false,
  searchable: []
});

defineEntity("intg_webhook_subscriptions", "intg_webhook_subscriptions", "intg", {
  view: "intg.view",
  create: "intg.manage",
  update: "intg.manage",
  delete: "intg.manage",
}, {
  hasUpdatedAt: false,
  searchable: ["name"]
});

defineEntity("intg_workflow_runs", "intg_workflow_runs", "intg", {
  view: "intg.view",
  create: "intg.manage",
  update: "intg.manage",
  delete: "intg.manage",
}, {
  hasUpdatedAt: false,
  hasCreatedAt: false,
  sortable: ["id"],
  searchable: ["status"]
});

defineEntity("intg_workflows", "intg_workflows", "intg", {
  view: "intg.view",
  create: "intg.manage",
  update: "intg.manage",
  delete: "intg.manage",
}, {
  softDelete: true,
  createdBy: true,
  searchable: ["name", "description"]
});

defineEntity("inventory_insights", "inventory_insights", "inventory", {
  view: "inventory.view",
  create: "inventory.adjust",
  update: "inventory.adjust",
  delete: "inventory.adjust",
}, {
  hasUpdatedAt: false,
  searchable: ["title", "status"]
});

defineEntity("inventory_valuations", "inventory_valuations", "inventory", {
  view: "inventory.view",
  create: "inventory.manage",
  update: "inventory.manage",
  delete: "inventory.manage",
}, {
  createdBy: true,
  hasUpdatedAt: false,
  searchable: ["notes"]
});

defineEntity("invoice_lines", "invoice_lines", "finance", {
  view: "finance.view",
  create: "finance.admin",
  update: "finance.admin",
  delete: "finance.admin",
}, {
  hasUpdatedAt: false,
  searchable: ["description"]
});

defineEntity("mes_ai_insights", "mes_ai_insights", "mes", {
  view: "mes.view",
  create: "mes.ai",
  update: "mes.ai",
  delete: "mes.ai",
}, {
  hasUpdatedAt: false,
  searchable: ["title", "status"]
});

defineEntity("mes_mps_lines", "mes_mps_lines", "mes", {
  view: "mes.view",
  create: "mes.manage",
  update: "mes.manage",
  delete: "mes.manage",
}, {
  hasUpdatedAt: false,
  searchable: ["status"]
});

defineEntity("mes_mrp_suggestions", "mes_mrp_suggestions", "mes", {
  view: "mes.view",
  create: "mes.manage",
  update: "mes.manage",
  delete: "mes.manage",
}, {
  hasUpdatedAt: false,
  searchable: ["status"]
});

defineEntity("mes_ncr", "mes_ncr", "mes", {
  view: "mes.view",
  create: "mes.manage",
  update: "mes.manage",
  delete: "mes.manage",
}, {
  createdBy: true,
  hasUpdatedAt: false,
  searchable: ["title", "description", "status"]
});

defineEntity("mes_quality_inspections", "mes_quality_inspections", "mes", {
  view: "mes.view",
  create: "mes.manage",
  update: "mes.manage",
  delete: "mes.manage",
}, {
  hasUpdatedAt: false,
  searchable: ["status", "notes"]
});

defineEntity("mes_quality_plans", "mes_quality_plans", "mes", {
  view: "mes.view",
  create: "mes.manage",
  update: "mes.manage",
  delete: "mes.manage",
}, {
  hasUpdatedAt: false,
  searchable: ["name"]
});

defineEntity("mes_routing_operations", "mes_routing_operations", "mes", {
  view: "mes.view",
  create: "mes.manage",
  update: "mes.manage",
  delete: "mes.manage",
}, {
  hasUpdatedAt: false,
  searchable: ["name"]
});

defineEntity("mes_routings", "mes_routings", "mes", {
  view: "mes.view",
  create: "mes.manage",
  update: "mes.manage",
  delete: "mes.manage",
}, {
  softDelete: true,
  hasUpdatedAt: false,
  searchable: ["name", "description", "status"]
});

defineEntity("mes_work_centers", "mes_work_centers", "mes", {
  view: "mes.view",
  create: "mes.manage",
  update: "mes.manage",
  delete: "mes.manage",
}, {
  hasUpdatedAt: false,
  searchable: ["name", "status", "notes", "location_name"]
});

defineEntity("mrp_recommendations", "mrp_recommendations", "mes", {
  view: "mes.view",
  create: "mes.planning",
  update: "mes.planning",
  delete: "mes.planning",
}, {
  hasUpdatedAt: false,
  searchable: ["status"]
});

defineEntity("mrp_runs", "mrp_runs", "mes", {
  view: "mes.view",
  create: "mes.planning",
  update: "mes.planning",
  delete: "mes.planning",
}, {
  createdBy: true,
  hasUpdatedAt: false,
  searchable: ["status", "notes"]
});

defineEntity("notification_rules", "notification_rules", "notifications", {
  view: "notifications.view",
  create: "notifications.manage",
  update: "notifications.manage",
  delete: "notifications.manage",
}, {
  searchable: ["name", "description"]
});

defineEntity("notification_templates", "notification_templates", "notifications", {
  view: "notifications.view",
  create: "notifications.manage",
  update: "notifications.manage",
  delete: "notifications.manage",
}, {
  hasCreatedAt: false,
  searchable: ["name", "subject"]
});

defineEntity("overtime_requests", "overtime_requests", "hr", {
  view: "hr.view",
  create: "hr.manage",
  update: "hr.manage",
  delete: "hr.manage",
}, {
  searchable: ["status", "reason"]
});

defineEntity("pay_payment_batches", "pay_payment_batches", "payroll", {
  view: "payroll.view",
  create: "payroll.admin",
  update: "payroll.admin",
  delete: "payroll.admin",
}, {
  createdBy: true,
  hasUpdatedAt: false,
  searchable: ["status", "batch_number"]
});

defineEntity("payroll_lines", "payroll_lines", "payroll", {
  view: "payroll.view",
  create: "payroll.admin",
  update: "payroll.admin",
  delete: "payroll.admin",
}, {
  hasUpdatedAt: false,
  searchable: ["notes"]
});

defineEntity("pkg_lines", "pkg_lines", "pkg", {
  view: "pkg.view",
  create: "pkg.manage",
  update: "pkg.manage",
  delete: "pkg.manage",
}, {
  hasUpdatedAt: false,
  searchable: ["name", "status", "notes"]
});

defineEntity("pkg_materials", "pkg_materials", "pkg", {
  view: "pkg.view",
  create: "pkg.manage",
  update: "pkg.manage",
  delete: "pkg.manage",
}, {
  softDelete: true,
  hasUpdatedAt: false,
  searchable: ["name", "supplier_name"]
});

defineEntity("pkg_product_rules", "pkg_product_rules", "pkg", {
  view: "pkg.view",
  create: "pkg.manage",
  update: "pkg.manage",
  delete: "pkg.manage",
}, {
  searchable: []
});

defineEntity("pkg_work_orders", "pkg_work_orders", "pkg", {
  view: "pkg.view",
  create: "pkg.approve",
  update: "pkg.approve",
  delete: "pkg.approve",
}, {
  softDelete: true,
  createdBy: true,
  hasUpdatedAt: false,
  searchable: ["status", "notes"]
});

defineEntity("ppe_issuances", "ppe_issuances", "hr", {
  view: "hr.view",
  create: "hr.manage",
  update: "hr.manage",
  delete: "hr.manage",
}, {
  hasUpdatedAt: false,
  searchable: ["status", "notes"]
});

defineEntity("printers", "printers", "print", {
  view: "print.view",
  create: "print.admin",
  update: "print.admin",
  delete: "print.admin",
}, {
  searchable: ["name", "status", "serial_number"]
});

defineEntity("production_batches", "production_batches", "mes", {
  view: "mes.view",
  create: "mes.manage",
  update: "mes.manage",
  delete: "mes.manage",
}, {
  createdBy: true,
  searchable: ["notes", "batch_number"]
});

defineEntity("production_machines", "production_machines", "mes", {
  view: "mes.view",
  create: "mes.manage",
  update: "mes.manage",
  delete: "mes.manage",
}, {
  hasUpdatedAt: false,
  searchable: ["name", "code"]
});

defineEntity("profile_documents", "profile_documents", "iam", {
  view: "profile.view",
  create: "profile.documents",
  update: "profile.documents",
  delete: "profile.documents",
}, {
  softDelete: true,
  searchable: ["title", "status", "notes"]
});

defineEntity("prt_alerts", "prt_alerts", "print", {
  view: "print.view",
  create: "print.manage",
  update: "print.manage",
  delete: "print.manage",
}, {
  hasUpdatedAt: false,
  searchable: ["title", "status", "alert_type"]
});

defineEntity("prt_automation_log", "prt_automation_log", "print", {
  view: "print.view",
  create: "print.manage",
  update: "print.manage",
  delete: "print.manage",
}, {
  hasUpdatedAt: false,
  searchable: ["status"]
});

defineEntity("prt_automation_rules", "prt_automation_rules", "print", {
  view: "print.view",
  create: "print.admin",
  update: "print.admin",
  delete: "print.admin",
}, {
  hasUpdatedAt: false,
  searchable: ["name"]
});

defineEntity("prt_consumables", "prt_consumables", "print", {
  view: "print.view",
  create: "print.manage",
  update: "print.manage",
  delete: "print.manage",
}, {
  searchable: ["name", "status"]
});

defineEntity("prt_department_access", "prt_department_access", "print", {
  view: "print.view",
  create: "print.admin",
  update: "print.admin",
  delete: "print.admin",
}, {
  hasUpdatedAt: false,
  hasCreatedAt: false,
  sortable: ["id"],
  searchable: []
});

defineEntity("prt_document_profiles", "prt_document_profiles", "print", {
  view: "print.view",
  create: "print.design",
  update: "print.design",
  delete: "print.design",
}, {
  hasUpdatedAt: false,
  searchable: ["name"]
});

defineEntity("prt_id_card_jobs", "prt_id_card_jobs", "print", {
  view: "print.view",
  create: "print.manage",
  update: "print.manage",
  delete: "print.manage",
}, {
  createdBy: true,
  hasUpdatedAt: false,
  searchable: ["status"]
});

defineEntity("prt_inventory_labels", "prt_inventory_labels", "print", {
  view: "print.view",
  create: "print.manage",
  update: "print.manage",
  delete: "print.manage",
}, {
  createdBy: true,
  hasUpdatedAt: false,
  searchable: ["status"]
});

defineEntity("prt_media", "prt_media", "print", {
  view: "print.view",
  create: "print.design",
  update: "print.design",
  delete: "print.design",
}, {
  hasUpdatedAt: false,
  searchable: ["name"]
});

defineEntity("prt_product_label_jobs", "prt_product_label_jobs", "print", {
  view: "print.view",
  create: "print.manage",
  update: "print.manage",
  delete: "print.manage",
}, {
  createdBy: true,
  hasUpdatedAt: false,
  searchable: ["status", "batch_number"]
});

defineEntity("prt_quotas", "prt_quotas", "print", {
  view: "print.view",
  create: "print.admin",
  update: "print.admin",
  delete: "print.admin",
}, {
  hasUpdatedAt: false,
  searchable: []
});

defineEntity("prt_schedules", "prt_schedules", "print", {
  view: "print.view",
  create: "print.manage",
  update: "print.manage",
  delete: "print.manage",
}, {
  hasUpdatedAt: false,
  searchable: ["name"]
});

defineEntity("prt_secure_pdfs", "prt_secure_pdfs", "print", {
  view: "print.view",
  create: "print.manage",
  update: "print.manage",
  delete: "print.manage",
}, {
  createdBy: true,
  hasUpdatedAt: false,
  searchable: ["title"]
});

defineEntity("prt_security_profiles", "prt_security_profiles", "print", {
  view: "print.view",
  create: "print.admin",
  update: "print.admin",
  delete: "print.admin",
}, {
  hasUpdatedAt: false,
  searchable: ["name", "notes"]
});

defineEntity("prt_server_printers", "prt_server_printers", "print", {
  view: "print.view",
  create: "print.admin",
  update: "print.admin",
  delete: "print.admin",
}, {
  hasUpdatedAt: false,
  hasCreatedAt: false,
  sortable: ["id"],
  searchable: []
});

defineEntity("prt_servers", "prt_servers", "print", {
  view: "print.view",
  create: "print.admin",
  update: "print.admin",
  delete: "print.admin",
}, {
  hasUpdatedAt: false,
  searchable: ["name", "status"]
});

defineEntity("prt_service_logs", "prt_service_logs", "print", {
  view: "print.view",
  create: "print.manage",
  update: "print.manage",
  delete: "print.manage",
}, {
  createdBy: true,
  hasUpdatedAt: false,
  searchable: ["description"]
});

defineEntity("prt_templates", "prt_templates", "print", {
  view: "print.view",
  create: "print.design",
  update: "print.design",
  delete: "print.design",
}, {
  softDelete: true,
  createdBy: true,
  searchable: ["name", "status"]
});

defineEntity("reams", "reams", "inventory", {
  view: "inventory.view",
  create: "inventory.manage",
  update: "inventory.manage",
  delete: "inventory.manage",
}, {
  searchable: ["serial_number"]
});

defineEntity("qr_codes", "qr_codes", "inventory", {
  view: "qr.view",
  create: "qr.generate",
  update: "qr.generate",
  delete: "qr.generate",
}, {
  searchable: ["human_serial", "status"]
});

defineEntity("rfqs", "rfqs", "procurement", {
  view: "procurement.view",
  create: "procurement.approve",
  update: "procurement.approve",
  delete: "procurement.approve",
}, {
  createdBy: true,
  searchable: ["title", "description", "status"]
});

defineEntity("safety_incidents", "safety_incidents", "hr", {
  view: "hr.view",
  create: "hr.manage",
  update: "hr.manage",
  delete: "hr.manage",
}, {
  searchable: ["title", "description", "status"]
});

defineEntity("sales_commissions", "sales_commissions", "sales", {
  view: "sales.view",
  create: "sales.admin",
  update: "sales.admin",
  delete: "sales.admin",
}, {
  hasUpdatedAt: false,
  searchable: ["status"]
});

defineEntity("sd_agents", "sd_agents", "sd", {
  view: "sd.view",
  create: "sd.admin",
  update: "sd.admin",
  delete: "sd.admin",
}, {
  hasUpdatedAt: false,
  searchable: []
});

defineEntity("sd_automations", "sd_automations", "sd", {
  view: "sd.view",
  create: "sd.admin",
  update: "sd.admin",
  delete: "sd.admin",
}, {
  hasUpdatedAt: false,
  searchable: ["name"]
});

defineEntity("sd_categories", "sd_categories", "sd", {
  view: "sd.view",
  create: "sd.manage",
  update: "sd.manage",
  delete: "sd.manage",
}, {
  hasUpdatedAt: false,
  searchable: ["name"]
});

defineEntity("sd_changes", "sd_changes", "sd", {
  view: "sd.view",
  create: "sd.change",
  update: "sd.change",
  delete: "sd.change",
}, {
  hasUpdatedAt: false,
  searchable: ["title", "description", "status"]
});

defineEntity("sd_channels", "sd_channels", "sd", {
  view: "sd.view",
  create: "sd.manage",
  update: "sd.manage",
  delete: "sd.manage",
}, {
  hasUpdatedAt: false,
  searchable: ["name"]
});

defineEntity("sd_escalation_rules", "sd_escalation_rules", "sd", {
  view: "sd.view",
  create: "sd.admin",
  update: "sd.admin",
  delete: "sd.admin",
}, {
  hasUpdatedAt: false,
  searchable: ["name"]
});

defineEntity("sd_field_jobs", "sd_field_jobs", "sd", {
  view: "sd.view",
  create: "sd.field",
  update: "sd.field",
  delete: "sd.field",
}, {
  hasUpdatedAt: false,
  searchable: ["title", "status", "notes", "location_name"]
});

defineEntity("sd_inbound_items", "sd_inbound_items", "sd", {
  view: "sd.view",
  create: "sd.agent",
  update: "sd.agent",
  delete: "sd.agent",
}, {
  hasUpdatedAt: false,
  hasCreatedAt: false,
  sortable: ["id"],
  searchable: ["status", "subject"]
});

defineEntity("sd_knowledge_articles", "sd_knowledge_articles", "sd", {
  view: "sd.view",
  create: "sd.knowledge",
  update: "sd.knowledge",
  delete: "sd.knowledge",
}, {
  softDelete: true,
  searchable: ["title", "status"]
});

defineEntity("sd_major_incidents", "sd_major_incidents", "sd", {
  view: "sd.view",
  create: "sd.major",
  update: "sd.major",
  delete: "sd.major",
}, {
  hasUpdatedAt: false,
  searchable: ["title", "status"]
});

defineEntity("sd_problems", "sd_problems", "sd", {
  view: "sd.view",
  create: "sd.manage",
  update: "sd.manage",
  delete: "sd.manage",
}, {
  createdBy: true,
  hasUpdatedAt: false,
  searchable: ["title", "description", "status"]
});

defineEntity("sd_sla_policies", "sd_sla_policies", "sd", {
  view: "sd.view",
  create: "sd.admin",
  update: "sd.admin",
  delete: "sd.admin",
}, {
  hasUpdatedAt: false,
  searchable: ["name"]
});

defineEntity("sd_teams", "sd_teams", "sd", {
  view: "sd.view",
  create: "sd.manage",
  update: "sd.manage",
  delete: "sd.manage",
}, {
  hasUpdatedAt: false,
  searchable: ["name", "email"]
});

defineEntity("security_alerts", "security_alerts", "iam", {
  view: "iam.view",
  create: "iam.manage",
  update: "iam.manage",
  delete: "iam.manage",
}, {
  hasUpdatedAt: false,
  searchable: ["title", "description", "status", "alert_type"]
});

defineEntity("security_policies", "security_policies", "iam", {
  view: "iam.view",
  create: "iam.manage",
  update: "iam.manage",
  delete: "iam.manage",
}, {
  hasCreatedAt: false,
  searchable: []
});

defineEntity("shift_assignments", "shift_assignments", "attendance", {
  view: "att.view",
  create: "att.admin",
  update: "att.admin",
  delete: "att.admin",
}, {
  hasUpdatedAt: false,
  searchable: ["status", "notes"]
});

defineEntity("skill_catalog", "skill_catalog", "hr", {
  view: "hr.view",
  create: "hr.manage",
  update: "hr.manage",
  delete: "hr.manage",
}, {
  hasUpdatedAt: false,
  hasCreatedAt: false,
  sortable: ["id"],
  searchable: ["name", "code", "description"]
});

defineEntity("sop_cycles", "sop_cycles", "scm", {
  view: "scm.view",
  create: "scm.manage",
  update: "scm.manage",
  delete: "scm.manage",
}, {
  createdBy: true,
  searchable: ["name", "status"]
});

defineEntity("sop_line_items", "sop_line_items", "scm", {
  view: "scm.view",
  create: "scm.manage",
  update: "scm.manage",
  delete: "scm.manage",
}, {
  hasUpdatedAt: false,
  searchable: ["notes"]
});

defineEntity("stock_adjustment_lines", "stock_adjustment_lines", "inventory", {
  view: "inventory.view",
  create: "inventory.adjust",
  update: "inventory.adjust",
  delete: "inventory.adjust",
}, {
  hasUpdatedAt: false,
  searchable: ["notes", "batch_number"]
});

defineEntity("supplier_quotations", "supplier_quotations", "procurement", {
  view: "procurement.view",
  create: "procurement.approve",
  update: "procurement.approve",
  delete: "procurement.approve",
}, {
  hasUpdatedAt: false,
  searchable: ["status", "notes"]
});

defineEntity("supply_chain_risks", "supply_chain_risks", "scm", {
  view: "scm.view",
  create: "scm.manage",
  update: "scm.manage",
  delete: "scm.manage",
}, {
  hasUpdatedAt: false,
  searchable: ["title", "status"]
});

defineEntity("tax_codes", "tax_codes", "finance", {
  view: "finance.view",
  create: "finance.admin",
  update: "finance.admin",
  delete: "finance.admin",
}, {
  hasUpdatedAt: false,
  searchable: ["name", "code", "description"]
});

defineEntity("treasury_facilities", "treasury_facilities", "finance", {
  view: "finance.view",
  create: "finance.admin",
  update: "finance.admin",
  delete: "finance.admin",
}, {
  hasUpdatedAt: false,
  searchable: ["status", "notes"]
});

defineEntity("wid_access_assignments", "wid_access_assignments", "wid", {
  view: "wid.view",
  create: "wid.access",
  update: "wid.access",
  delete: "wid.access",
}, {
  searchable: ["status", "reason"]
});

defineEntity("wid_access_events", "wid_access_events", "wid", {
  view: "wid.view",
  create: "wid.access",
  update: "wid.access",
  delete: "wid.access",
}, {
  hasUpdatedAt: false,
  hasCreatedAt: false,
  sortable: ["id"],
  searchable: ["reason"]
});

defineEntity("wid_access_profiles", "wid_access_profiles", "wid", {
  view: "wid.view",
  create: "wid.access",
  update: "wid.access",
  delete: "wid.access",
}, {
  softDelete: true,
  searchable: ["name", "description"]
});

defineEntity("wid_access_zones", "wid_access_zones", "wid", {
  view: "wid.view",
  create: "wid.access",
  update: "wid.access",
  delete: "wid.access",
}, {
  softDelete: true,
  hasUpdatedAt: false,
  searchable: ["name", "description"]
});

defineEntity("wid_ai_design_logs", "wid_ai_design_logs", "wid", {
  view: "wid.view",
  create: "wid.design",
  update: "wid.design",
  delete: "wid.design",
}, {
  createdBy: true,
  hasUpdatedAt: false,
  searchable: []
});

defineEntity("wid_biometric_enrollments", "wid_biometric_enrollments", "wid", {
  view: "wid.view",
  create: "wid.biometrics",
  update: "wid.biometrics",
  delete: "wid.biometrics",
}, {
  searchable: ["notes", "device_name"]
});

defineEntity("wid_card_brands", "wid_card_brands", "wid", {
  view: "wid.view",
  create: "wid.design",
  update: "wid.design",
  delete: "wid.design",
}, {
  softDelete: true,
  searchable: ["name"]
});

defineEntity("wid_card_incidents", "wid_card_incidents", "wid", {
  view: "wid.view",
  create: "wid.manage",
  update: "wid.manage",
  delete: "wid.manage",
}, {
  searchable: ["description", "status", "notes"]
});

defineEntity("wid_card_inventory", "wid_card_inventory", "wid", {
  view: "wid.view",
  create: "wid.access",
  update: "wid.access",
  delete: "wid.access",
}, {
  softDelete: true,
  searchable: ["status", "notes", "supplier_name", "batch_number"]
});

defineEntity("wid_card_templates", "wid_card_templates", "wid", {
  view: "wid.view",
  create: "wid.design",
  update: "wid.design",
  delete: "wid.design",
}, {
  softDelete: true,
  createdBy: true,
  searchable: ["name", "description"]
});

defineEntity("wid_credentials", "wid_credentials", "wid", {
  view: "wid.view",
  create: "wid.manage",
  update: "wid.manage",
  delete: "wid.manage",
}, {
  softDelete: true,
  createdBy: true,
  searchable: ["status", "notes"]
});

defineEntity("wid_id_sequences", "wid_id_sequences", "wid", {
  view: "wid.view",
  create: "wid.design",
  update: "wid.design",
  delete: "wid.design",
}, {
  searchable: ["name"]
});

defineEntity("wid_identities", "wid_identities", "wid", {
  view: "wid.view",
  create: "wid.manage",
  update: "wid.manage",
  delete: "wid.manage",
}, {
  softDelete: true,
  createdBy: true,
  searchable: ["email", "status", "notes", "first_name"]
});

defineEntity("wid_mobile_badges", "wid_mobile_badges", "wid", {
  view: "wid.view",
  create: "wid.manage",
  update: "wid.manage",
  delete: "wid.manage",
}, {
  searchable: ["status"]
});

defineEntity("wid_print_history", "wid_print_history", "wid", {
  view: "wid.view",
  create: "wid.manage",
  update: "wid.manage",
  delete: "wid.manage",
}, {
  hasUpdatedAt: false,
  searchable: []
});

defineEntity("wid_print_jobs", "wid_print_jobs", "wid", {
  view: "wid.view",
  create: "wid.manage",
  update: "wid.manage",
  delete: "wid.manage",
}, {
  searchable: ["status", "notes"]
});

defineEntity("wid_template_versions", "wid_template_versions", "wid", {
  view: "wid.view",
  create: "wid.design",
  update: "wid.design",
  delete: "wid.design",
}, {
  createdBy: true,
  hasUpdatedAt: false,
  searchable: []
});

defineEntity("wid_workflow_runs", "wid_workflow_runs", "wid", {
  view: "wid.view",
  create: "wid.manage",
  update: "wid.manage",
  delete: "wid.manage",
}, {
  hasUpdatedAt: false,
  hasCreatedAt: false,
  sortable: ["id"],
  searchable: ["status"]
});

defineEntity("wid_workflows", "wid_workflows", "wid", {
  view: "wid.view",
  create: "wid.manage",
  update: "wid.manage",
  delete: "wid.manage",
}, {
  searchable: ["name", "description"]
});

// ---- Service Desk enterprise: integrations / calendars / holidays -----
defineEntity("sd_integrations", "sd_integrations", "sd", {
  view: "sd.view",
  create: "sd.admin",
  update: "sd.admin",
  delete: "sd.admin",
}, {
  softDelete: true,
  searchable: ["name", "integration_type", "category"]
});

defineEntity("sd_calendars", "sd_calendars", "sd", {
  view: "sd.view",
  create: "sd.manage",
  update: "sd.manage",
  delete: "sd.manage",
}, {
  softDelete: true,
  searchable: ["name", "calendar_code", "timezone"]
});

defineEntity("sd_holidays", "sd_holidays", "sd", {
  view: "sd.view",
  create: "sd.manage",
  update: "sd.manage",
  delete: "sd.manage",
}, {
  softDelete: true,
  searchable: ["name"]
});

// ---- Service Desk current trends: AI sessions + NPS ----
defineEntity("sd_ai_sessions", "sd_ai_sessions", "sd", {
  view: "sd.view",
  create: "sd.agent",
  update: "sd.agent",
  delete: "sd.agent",
}, {
  softDelete: true,
  searchable: ["user_message", "assistant_reply", "intent", "outcome", "suggested_category"]
});

defineEntity("sd_nps_responses", "sd_nps_responses", "sd", {
  view: "sd.view",
  create: "sd.agent",
  update: "sd.agent",
  delete: "sd.agent",
}, {
  softDelete: true,
  searchable: ["respondent_name", "comment"]
});

// ── Bulk registrations for remaining domain modules (auto) ──

defineEntity("attachments", "attachments", "crud", { view: "settings.view", create: "settings.manage", update: "settings.manage", delete: "settings.admin" }, { softDelete: true, searchable: [] });
defineEntity("brand_approvals", "brand_approvals", "brand", { view: "settings.view", create: "settings.manage", update: "settings.manage", delete: "settings.admin" }, { softDelete: true, searchable: [] });
defineEntity("brand_assets", "brand_assets", "brand", { view: "settings.view", create: "settings.manage", update: "settings.manage", delete: "settings.admin" }, { softDelete: true, searchable: [] });
defineEntity("brand_audit", "brand_audit", "brand", { view: "settings.view", create: "settings.manage", update: "settings.manage", delete: "settings.admin" }, { softDelete: true, searchable: [] });
defineEntity("brand_colors", "brand_colors", "brand", { view: "settings.view", create: "settings.manage", update: "settings.manage", delete: "settings.admin" }, { softDelete: true, searchable: [] });
defineEntity("brand_profiles", "brand_profiles", "brand", { view: "settings.view", create: "settings.manage", update: "settings.manage", delete: "settings.admin" }, { softDelete: true, searchable: [] });
defineEntity("brand_templates", "brand_templates", "brand", { view: "settings.view", create: "settings.manage", update: "settings.manage", delete: "settings.admin" }, { softDelete: true, searchable: [] });
defineEntity("comm_announcements", "comm_announcements", "sd", { view: "sd.view", create: "sd.manage", update: "sd.manage", delete: "sd.admin" }, { softDelete: true, searchable: [] });
defineEntity("comm_attachments", "comm_attachments", "sd", { view: "sd.view", create: "sd.manage", update: "sd.manage", delete: "sd.admin" }, { softDelete: true, searchable: [] });
defineEntity("comm_audit_log", "comm_audit_log", "sd", { view: "sd.view", create: "sd.manage", update: "sd.manage", delete: "sd.admin" }, { softDelete: true, searchable: [] });
defineEntity("comm_campaigns", "comm_campaigns", "sd", { view: "sd.view", create: "sd.manage", update: "sd.manage", delete: "sd.admin" }, { softDelete: true, searchable: [] });
defineEntity("comm_delivery_events", "comm_delivery_events", "sd", { view: "sd.view", create: "sd.manage", update: "sd.manage", delete: "sd.admin" }, { softDelete: true, searchable: [] });
defineEntity("comm_document_jobs", "comm_document_jobs", "sd", { view: "sd.view", create: "sd.manage", update: "sd.manage", delete: "sd.admin" }, { softDelete: true, searchable: [] });
defineEntity("comm_event_rules", "comm_event_rules", "sd", { view: "sd.view", create: "sd.manage", update: "sd.manage", delete: "sd.admin" }, { softDelete: true, searchable: [] });
defineEntity("comm_messages", "comm_messages", "sd", { view: "sd.view", create: "sd.manage", update: "sd.manage", delete: "sd.admin" }, { softDelete: true, searchable: [] });
defineEntity("comm_providers", "comm_providers", "sd", { view: "sd.view", create: "sd.manage", update: "sd.manage", delete: "sd.admin" }, { softDelete: true, searchable: [] });
defineEntity("comm_reminders", "comm_reminders", "sd", { view: "sd.view", create: "sd.manage", update: "sd.manage", delete: "sd.admin" }, { softDelete: true, searchable: [] });
defineEntity("comm_schedules", "comm_schedules", "sd", { view: "sd.view", create: "sd.manage", update: "sd.manage", delete: "sd.admin" }, { softDelete: true, searchable: [] });
defineEntity("comm_templates", "comm_templates", "sd", { view: "sd.view", create: "sd.manage", update: "sd.manage", delete: "sd.admin" }, { softDelete: true, searchable: [] });
defineEntity("config_change_log", "config_change_log", "settings", { view: "settings.view", create: "settings.manage", update: "settings.manage", delete: "settings.admin" }, { softDelete: true, searchable: [] });
defineEntity("di_ai_insights", "di_ai_insights", "crud", { view: "iam.view", create: "iam.manage", update: "iam.manage", delete: "iam.admin" }, { softDelete: true, searchable: [] });
defineEntity("di_approval_routes", "di_approval_routes", "crud", { view: "iam.view", create: "iam.manage", update: "iam.manage", delete: "iam.admin" }, { softDelete: true, searchable: [] });
defineEntity("di_asset_assignments", "di_asset_assignments", "crud", { view: "iam.view", create: "iam.manage", update: "iam.manage", delete: "iam.admin" }, { softDelete: true, searchable: [] });
defineEntity("di_biometric_devices", "di_biometric_devices", "crud", { view: "iam.view", create: "iam.manage", update: "iam.manage", delete: "iam.admin" }, { softDelete: true, searchable: [] });
defineEntity("di_biometric_profiles", "di_biometric_profiles", "crud", { view: "iam.view", create: "iam.manage", update: "iam.manage", delete: "iam.admin" }, { softDelete: true, searchable: [] });
defineEntity("di_clearance_assignments", "di_clearance_assignments", "crud", { view: "iam.view", create: "iam.manage", update: "iam.manage", delete: "iam.admin" }, { softDelete: true, searchable: [] });
defineEntity("di_clearance_matrix", "di_clearance_matrix", "crud", { view: "iam.view", create: "iam.manage", update: "iam.manage", delete: "iam.admin" }, { softDelete: true, searchable: [] });
defineEntity("di_document_vault", "di_document_vault", "crud", { view: "iam.view", create: "iam.manage", update: "iam.manage", delete: "iam.admin" }, { softDelete: true, searchable: [] });
defineEntity("di_id_cards", "di_id_cards", "crud", { view: "iam.view", create: "iam.manage", update: "iam.manage", delete: "iam.admin" }, { softDelete: true, searchable: [] });
defineEntity("di_lifecycle_events", "di_lifecycle_events", "crud", { view: "iam.view", create: "iam.manage", update: "iam.manage", delete: "iam.admin" }, { softDelete: true, searchable: [] });
defineEntity("di_org_units", "di_org_units", "crud", { view: "iam.view", create: "iam.manage", update: "iam.manage", delete: "iam.admin" }, { softDelete: true, searchable: [] });
defineEntity("di_provision_checklist", "di_provision_checklist", "crud", { view: "iam.view", create: "iam.manage", update: "iam.manage", delete: "iam.admin" }, { softDelete: true, searchable: [] });
defineEntity("di_provision_jobs", "di_provision_jobs", "crud", { view: "iam.view", create: "iam.manage", update: "iam.manage", delete: "iam.admin" }, { softDelete: true, searchable: [] });
defineEntity("di_provision_templates", "di_provision_templates", "crud", { view: "iam.view", create: "iam.manage", update: "iam.manage", delete: "iam.admin" }, { softDelete: true, searchable: [] });
defineEntity("di_sync_log", "di_sync_log", "crud", { view: "iam.view", create: "iam.manage", update: "iam.manage", delete: "iam.admin" }, { softDelete: true, searchable: [] });
defineEntity("di_sync_rules", "di_sync_rules", "crud", { view: "iam.view", create: "iam.manage", update: "iam.manage", delete: "iam.admin" }, { softDelete: true, searchable: [] });
defineEntity("domain_events", "domain_events", "settings", { view: "settings.view", create: "settings.manage", update: "settings.manage", delete: "settings.admin" }, { softDelete: true, searchable: [] });
defineEntity("dsp_audit_log", "dsp_audit_log", "dispatch", { view: "dispatch.view", create: "dispatch.manage", update: "dispatch.manage", delete: "dispatch.admin" }, { softDelete: true, searchable: [] });
defineEntity("dsp_documents", "dsp_documents", "dispatch", { view: "dispatch.view", create: "dispatch.manage", update: "dispatch.manage", delete: "dispatch.admin" }, { softDelete: true, searchable: [] });
defineEntity("dsp_gps_points", "dsp_gps_points", "dispatch", { view: "dispatch.view", create: "dispatch.manage", update: "dispatch.manage", delete: "dispatch.admin" }, { softDelete: true, searchable: [] });
defineEntity("dsp_loading_scans", "dsp_loading_scans", "dispatch", { view: "dispatch.view", create: "dispatch.manage", update: "dispatch.manage", delete: "dispatch.admin" }, { softDelete: true, searchable: [] });
defineEntity("dsp_loading_sessions", "dsp_loading_sessions", "dispatch", { view: "dispatch.view", create: "dispatch.manage", update: "dispatch.manage", delete: "dispatch.admin" }, { softDelete: true, searchable: [] });
defineEntity("dsp_notifications", "dsp_notifications", "dispatch", { view: "dispatch.view", create: "dispatch.manage", update: "dispatch.manage", delete: "dispatch.admin" }, { softDelete: true, searchable: [] });
defineEntity("dsp_pods", "dsp_pods", "dispatch", { view: "dispatch.view", create: "dispatch.manage", update: "dispatch.manage", delete: "dispatch.admin" }, { softDelete: true, searchable: [] });
defineEntity("dsp_request_lines", "dsp_request_lines", "dispatch", { view: "dispatch.view", create: "dispatch.manage", update: "dispatch.manage", delete: "dispatch.admin" }, { softDelete: true, searchable: [] });
defineEntity("dsp_requests", "dsp_requests", "dispatch", { view: "dispatch.view", create: "dispatch.manage", update: "dispatch.manage", delete: "dispatch.admin" }, { softDelete: true, searchable: [] });
defineEntity("dsp_route_stops", "dsp_route_stops", "dispatch", { view: "dispatch.view", create: "dispatch.manage", update: "dispatch.manage", delete: "dispatch.admin" }, { softDelete: true, searchable: [] });
defineEntity("dsp_routes", "dsp_routes", "dispatch", { view: "dispatch.view", create: "dispatch.manage", update: "dispatch.manage", delete: "dispatch.admin" }, { softDelete: true, searchable: [] });
defineEntity("employee_assets", "employee_assets", "crud", { view: "settings.view", create: "settings.manage", update: "settings.manage", delete: "settings.admin" }, { softDelete: true, searchable: [] });
defineEntity("fin_government_contracts", "fin_government_contracts", "crud", { view: "settings.view", create: "settings.manage", update: "settings.manage", delete: "settings.admin" }, { softDelete: true, searchable: [] });
defineEntity("fleet_ai_insights", "fleet_ai_insights", "fleet", { view: "fleet.view", create: "fleet.manage", update: "fleet.manage", delete: "fleet.admin" }, { softDelete: true, searchable: [] });
defineEntity("fleet_costs", "fleet_costs", "fleet", { view: "fleet.view", create: "fleet.manage", update: "fleet.manage", delete: "fleet.admin" }, { softDelete: true, searchable: [] });
defineEntity("fleet_drivers", "fleet_drivers", "fleet", { view: "fleet.view", create: "fleet.manage", update: "fleet.manage", delete: "fleet.admin" }, { softDelete: true, searchable: [] });
defineEntity("fleet_fuel_transactions", "fleet_fuel_transactions", "fleet", { view: "fleet.view", create: "fleet.manage", update: "fleet.manage", delete: "fleet.admin" }, { softDelete: true, searchable: [] });
defineEntity("fleet_gps_devices", "fleet_gps_devices", "fleet", { view: "fleet.view", create: "fleet.manage", update: "fleet.manage", delete: "fleet.admin" }, { softDelete: true, searchable: [] });
defineEntity("fleet_gps_locations", "fleet_gps_locations", "fleet", { view: "fleet.view", create: "fleet.manage", update: "fleet.manage", delete: "fleet.admin" }, { softDelete: true, searchable: [] });
defineEntity("fleet_insurance_policies", "fleet_insurance_policies", "fleet", { view: "fleet.view", create: "fleet.manage", update: "fleet.manage", delete: "fleet.admin" }, { softDelete: true, searchable: [] });
defineEntity("fleet_maintenance_plans", "fleet_maintenance_plans", "fleet", { view: "fleet.view", create: "fleet.manage", update: "fleet.manage", delete: "fleet.admin" }, { softDelete: true, searchable: [] });
defineEntity("fleet_odometer_logs", "fleet_odometer_logs", "fleet", { view: "fleet.view", create: "fleet.manage", update: "fleet.manage", delete: "fleet.admin" }, { softDelete: true, searchable: [] });
defineEntity("fleet_trips", "fleet_trips", "fleet", { view: "fleet.view", create: "fleet.manage", update: "fleet.manage", delete: "fleet.admin" }, { softDelete: true, searchable: [] });
defineEntity("fleet_vehicle_assignments", "fleet_vehicle_assignments", "fleet", { view: "fleet.view", create: "fleet.manage", update: "fleet.manage", delete: "fleet.admin" }, { softDelete: true, searchable: [] });
defineEntity("fleet_work_orders", "fleet_work_orders", "fleet", { view: "fleet.view", create: "fleet.manage", update: "fleet.manage", delete: "fleet.admin" }, { softDelete: true, searchable: [] });
// HopeChat entities — hc.* permissions (not service-desk). Prefer browser RLS path.
defineEntity("hc_announcement_acks", "hc_announcement_acks", "hc", { view: "hc.view", create: "hc.view", update: "hc.view", delete: "hc.manage" }, { softDelete: true, searchable: [] });
defineEntity("hc_announcements", "hc_announcements", "hc", { view: "hc.view", create: "hc.manage", update: "hc.manage", delete: "hc.admin" }, { softDelete: true, searchable: [] });
defineEntity("hc_audit_log", "hc_audit_log", "hc", { view: "hc.view", create: "hc.view", update: "hc.manage", delete: "hc.admin" }, { softDelete: true, searchable: [] });
defineEntity("hc_channel_members", "hc_channel_members", "hc", { view: "hc.view", create: "hc.view", update: "hc.view", delete: "hc.manage" }, { softDelete: true, searchable: [] });
defineEntity("hc_channels", "hc_channels", "hc", { view: "hc.view", create: "hc.view", update: "hc.manage", delete: "hc.admin" }, { softDelete: true, searchable: [] });
defineEntity("hc_chat_tasks", "hc_chat_tasks", "hc", { view: "hc.view", create: "hc.view", update: "hc.view", delete: "hc.manage" }, { softDelete: true, searchable: [] });
defineEntity("hc_files", "hc_files", "hc", { view: "hc.view", create: "hc.view", update: "hc.view", delete: "hc.manage" }, { softDelete: true, searchable: [] });
defineEntity("hc_meetings", "hc_meetings", "hc", { view: "hc.view", create: "hc.meetings", update: "hc.meetings", delete: "hc.manage" }, { softDelete: true, searchable: [] });
defineEntity("hc_messages", "hc_messages", "hc", { view: "hc.view", create: "hc.view", update: "hc.view", delete: "hc.manage" }, { softDelete: true, searchable: [] });
defineEntity("hc_reactions", "hc_reactions", "hc", { view: "hc.view", create: "hc.view", update: "hc.view", delete: "hc.view" }, { softDelete: true, searchable: [] });
defineEntity("idm_api_accounts", "idm_api_accounts", "iam", { view: "iam.view", create: "iam.manage", update: "iam.manage", delete: "iam.admin" }, { softDelete: true, searchable: [] });
defineEntity("idm_api_keys", "idm_api_keys", "iam", { view: "iam.view", create: "iam.manage", update: "iam.manage", delete: "iam.admin" }, { softDelete: true, searchable: [] });
defineEntity("idm_audit", "idm_audit", "iam", { view: "iam.view", create: "iam.manage", update: "iam.manage", delete: "iam.admin" }, { softDelete: true, searchable: [] });
defineEntity("idm_import_batches", "idm_import_batches", "iam", { view: "iam.view", create: "iam.manage", update: "iam.manage", delete: "iam.admin" }, { softDelete: true, searchable: [] });
defineEntity("idm_offboarding", "idm_offboarding", "iam", { view: "iam.view", create: "iam.manage", update: "iam.manage", delete: "iam.admin" }, { softDelete: true, searchable: [] });
defineEntity("idm_temp_access", "idm_temp_access", "iam", { view: "iam.view", create: "iam.manage", update: "iam.manage", delete: "iam.admin" }, { softDelete: true, searchable: [] });
defineEntity("idm_user_activity", "idm_user_activity", "iam", { view: "iam.view", create: "iam.manage", update: "iam.manage", delete: "iam.admin" }, { softDelete: true, searchable: [] });
defineEntity("idm_username_rules", "idm_username_rules", "iam", { view: "iam.view", create: "iam.manage", update: "iam.manage", delete: "iam.admin" }, { softDelete: true, searchable: [] });
defineEntity("inventory_balances", "inventory_balances", "crud", { view: "settings.view", create: "settings.manage", update: "settings.manage", delete: "settings.admin" }, { softDelete: true, searchable: [] });
defineEntity("lbl_ai_insights", "lbl_ai_insights", "print", { view: "print.view", create: "print.manage", update: "print.manage", delete: "print.admin" }, { softDelete: true, searchable: [] });
defineEntity("lbl_batches", "lbl_batches", "print", { view: "print.view", create: "print.manage", update: "print.manage", delete: "print.admin" }, { softDelete: true, searchable: [] });
defineEntity("lbl_formats", "lbl_formats", "print", { view: "print.view", create: "print.manage", update: "print.manage", delete: "print.admin" }, { softDelete: true, searchable: [] });
defineEntity("lbl_instances", "lbl_instances", "print", { view: "print.view", create: "print.manage", update: "print.manage", delete: "print.admin" }, { softDelete: true, searchable: [] });
defineEntity("lbl_jobs", "lbl_jobs", "print", { view: "print.view", create: "print.manage", update: "print.manage", delete: "print.admin" }, { softDelete: true, searchable: [] });
defineEntity("lbl_materials", "lbl_materials", "print", { view: "print.view", create: "print.manage", update: "print.manage", delete: "print.admin" }, { softDelete: true, searchable: [] });
defineEntity("lbl_pallet", "lbl_pallet", "print", { view: "print.view", create: "print.manage", update: "print.manage", delete: "print.admin" }, { softDelete: true, searchable: [] });
defineEntity("lbl_reprints", "lbl_reprints", "print", { view: "print.view", create: "print.manage", update: "print.manage", delete: "print.admin" }, { softDelete: true, searchable: [] });
defineEntity("lbl_shipping", "lbl_shipping", "print", { view: "print.view", create: "print.manage", update: "print.manage", delete: "print.admin" }, { softDelete: true, searchable: [] });
defineEntity("lbl_stock", "lbl_stock", "print", { view: "print.view", create: "print.manage", update: "print.manage", delete: "print.admin" }, { softDelete: true, searchable: [] });
defineEntity("lbl_templates", "lbl_templates", "print", { view: "print.view", create: "print.manage", update: "print.manage", delete: "print.admin" }, { softDelete: true, searchable: [] });
defineEntity("media_files", "media_files", "settings", { view: "settings.view", create: "settings.manage", update: "settings.manage", delete: "settings.admin" }, { softDelete: true, searchable: [] });
defineEntity("mes_cost_layers", "mes_cost_layers", "mes", { view: "mes.view", create: "mes.manage", update: "mes.manage", delete: "mes.admin" }, { softDelete: true, searchable: [] });
defineEntity("mes_downtime", "mes_downtime", "mes", { view: "mes.view", create: "mes.manage", update: "mes.manage", delete: "mes.admin" }, { softDelete: true, searchable: [] });
defineEntity("mes_genealogy", "mes_genealogy", "mes", { view: "mes.view", create: "mes.manage", update: "mes.manage", delete: "mes.admin" }, { softDelete: true, searchable: [] });
defineEntity("mes_maintenance_orders", "mes_maintenance_orders", "mes", { view: "mes.view", create: "mes.manage", update: "mes.manage", delete: "mes.admin" }, { softDelete: true, searchable: [] });
defineEntity("mes_material_issues", "mes_material_issues", "mes", { view: "mes.view", create: "mes.manage", update: "mes.manage", delete: "mes.admin" }, { softDelete: true, searchable: [] });
defineEntity("mes_oee_snapshots", "mes_oee_snapshots", "mes", { view: "mes.view", create: "mes.manage", update: "mes.manage", delete: "mes.admin" }, { softDelete: true, searchable: [] });
defineEntity("mes_packaging_units", "mes_packaging_units", "mes", { view: "mes.view", create: "mes.manage", update: "mes.manage", delete: "mes.admin" }, { softDelete: true, searchable: [] });
defineEntity("mes_shop_floor_events", "mes_shop_floor_events", "mes", { view: "mes.view", create: "mes.manage", update: "mes.manage", delete: "mes.admin" }, { softDelete: true, searchable: [] });
defineEntity("pkg_audit", "pkg_audit", "scm", { view: "inventory.view", create: "inventory.manage", update: "inventory.manage", delete: "inventory.admin" }, { softDelete: true, searchable: [] });
defineEntity("pkg_material_issues", "pkg_material_issues", "scm", { view: "inventory.view", create: "inventory.manage", update: "inventory.manage", delete: "inventory.admin" }, { softDelete: true, searchable: [] });
defineEntity("pkg_packing_lists", "pkg_packing_lists", "scm", { view: "inventory.view", create: "inventory.manage", update: "inventory.manage", delete: "inventory.admin" }, { softDelete: true, searchable: [] });
defineEntity("pkg_pallet_cartons", "pkg_pallet_cartons", "scm", { view: "inventory.view", create: "inventory.manage", update: "inventory.manage", delete: "inventory.admin" }, { softDelete: true, searchable: [] });
defineEntity("pkg_pallets", "pkg_pallets", "scm", { view: "inventory.view", create: "inventory.manage", update: "inventory.manage", delete: "inventory.admin" }, { softDelete: true, searchable: [] });
defineEntity("pkg_qc_checks", "pkg_qc_checks", "scm", { view: "inventory.view", create: "inventory.manage", update: "inventory.manage", delete: "inventory.admin" }, { softDelete: true, searchable: [] });
defineEntity("pkg_weights", "pkg_weights", "scm", { view: "inventory.view", create: "inventory.manage", update: "inventory.manage", delete: "inventory.admin" }, { softDelete: true, searchable: [] });
defineEntity("platform_announcements", "platform_announcements", "settings", { view: "settings.view", create: "settings.manage", update: "settings.manage", delete: "settings.admin" }, { staffOnly: true, softDelete: true, searchable: [] });
defineEntity("platform_feature_flags", "platform_feature_flags", "settings", { view: "settings.view", create: "settings.manage", update: "settings.manage", delete: "settings.admin" }, { staffOnly: true, softDelete: true, searchable: [] });
defineEntity("platform_health_checks", "platform_health_checks", "settings", { view: "settings.view", create: "settings.manage", update: "settings.manage", delete: "settings.admin" }, { staffOnly: true, softDelete: true, searchable: [] });
defineEntity("platform_modules", "platform_modules", "settings", { view: "settings.view", create: "settings.manage", update: "settings.manage", delete: "settings.admin" }, { staffOnly: true, softDelete: true, searchable: [] });
defineEntity("platform_plans", "platform_plans", "settings", { view: "settings.view", create: "settings.manage", update: "settings.manage", delete: "settings.admin" }, { staffOnly: true, softDelete: true, searchable: [] });
defineEntity("ppm_ai_insights", "ppm_ai_insights", "ppm", { view: "ppm.view", create: "ppm.manage", update: "ppm.manage", delete: "ppm.admin" }, { softDelete: true, searchable: [] });
defineEntity("ppm_approvals", "ppm_approvals", "ppm", { view: "ppm.view", create: "ppm.manage", update: "ppm.manage", delete: "ppm.admin" }, { softDelete: true, searchable: [] });
defineEntity("ppm_budgets", "ppm_budgets", "ppm", { view: "ppm.view", create: "ppm.manage", update: "ppm.manage", delete: "ppm.admin" }, { softDelete: true, searchable: [] });
defineEntity("ppm_issues", "ppm_issues", "ppm", { view: "ppm.view", create: "ppm.manage", update: "ppm.manage", delete: "ppm.admin" }, { softDelete: true, searchable: [] });
defineEntity("ppm_milestones", "ppm_milestones", "ppm", { view: "ppm.view", create: "ppm.manage", update: "ppm.manage", delete: "ppm.admin" }, { softDelete: true, searchable: [] });
defineEntity("ppm_risks", "ppm_risks", "ppm", { view: "ppm.view", create: "ppm.manage", update: "ppm.manage", delete: "ppm.admin" }, { softDelete: true, searchable: [] });
defineEntity("ppm_tasks", "ppm_tasks", "ppm", { view: "ppm.view", create: "ppm.manage", update: "ppm.manage", delete: "ppm.admin" }, { softDelete: true, searchable: [] });
defineEntity("ppm_timesheets", "ppm_timesheets", "ppm", { view: "ppm.view", create: "ppm.manage", update: "ppm.manage", delete: "ppm.admin" }, { softDelete: true, searchable: [] });
defineEntity("procurement_contracts", "procurement_contracts", "crud", { view: "settings.view", create: "settings.manage", update: "settings.manage", delete: "settings.admin" }, { softDelete: true, searchable: [] });
defineEntity("profile_audit", "profile_audit", "iam", { view: "iam.view", create: "iam.manage", update: "iam.manage", delete: "iam.admin" }, { softDelete: true, searchable: [] });
defineEntity("profile_certifications", "profile_certifications", "iam", { view: "iam.view", create: "iam.manage", update: "iam.manage", delete: "iam.admin" }, { softDelete: true, searchable: [] });
defineEntity("profile_completion", "profile_completion", "iam", { view: "iam.view", create: "iam.manage", update: "iam.manage", delete: "iam.admin" }, { softDelete: true, searchable: [] });
defineEntity("profile_consents", "profile_consents", "iam", { view: "iam.view", create: "iam.manage", update: "iam.manage", delete: "iam.admin" }, { softDelete: true, searchable: [] });
defineEntity("profile_projects", "profile_projects", "iam", { view: "iam.view", create: "iam.manage", update: "iam.manage", delete: "iam.admin" }, { softDelete: true, searchable: [] });
defineEntity("profile_requests", "profile_requests", "iam", { view: "iam.view", create: "iam.manage", update: "iam.manage", delete: "iam.admin" }, { softDelete: true, searchable: [] });
defineEntity("profile_security_events", "profile_security_events", "iam", { view: "iam.view", create: "iam.manage", update: "iam.manage", delete: "iam.admin" }, { softDelete: true, searchable: [] });
defineEntity("profile_skills", "profile_skills", "iam", { view: "iam.view", create: "iam.manage", update: "iam.manage", delete: "iam.admin" }, { softDelete: true, searchable: [] });
defineEntity("profile_timeline", "profile_timeline", "iam", { view: "iam.view", create: "iam.manage", update: "iam.manage", delete: "iam.admin" }, { softDelete: true, searchable: [] });
defineEntity("profile_visibility", "profile_visibility", "iam", { view: "iam.view", create: "iam.manage", update: "iam.manage", delete: "iam.admin" }, { softDelete: true, searchable: [] });
defineEntity("prt_audit", "prt_audit", "print", { view: "print.view", create: "print.manage", update: "print.manage", delete: "print.admin" }, { softDelete: true, searchable: [] });
defineEntity("prt_batches", "prt_batches", "print", { view: "print.view", create: "print.manage", update: "print.manage", delete: "print.admin" }, { softDelete: true, searchable: [] });
defineEntity("prt_queue", "prt_queue", "print", { view: "print.view", create: "print.manage", update: "print.manage", delete: "print.admin" }, { softDelete: true, searchable: [] });
defineEntity("role_permissions", "role_permissions", "crud", { view: "settings.view", create: "settings.manage", update: "settings.manage", delete: "settings.admin" }, { softDelete: true, searchable: [] });
defineEntity("roles", "roles", "crud", { view: "settings.view", create: "settings.manage", update: "settings.manage", delete: "settings.admin" }, { softDelete: true, searchable: [] });
defineEntity("sales_ai_insights", "sales_ai_insights", "sales", { view: "sales.view", create: "sales.manage", update: "sales.manage", delete: "sales.admin" }, { softDelete: true, searchable: [] });
defineEntity("sales_contract_lines", "sales_contract_lines", "sales", { view: "sales.view", create: "sales.manage", update: "sales.manage", delete: "sales.admin" }, { softDelete: true, searchable: [] });
defineEntity("sales_contracts", "sales_contracts", "sales", { view: "sales.view", create: "sales.manage", update: "sales.manage", delete: "sales.admin" }, { softDelete: true, searchable: [] });
defineEntity("sales_forecasts", "sales_forecasts", "sales", { view: "sales.view", create: "sales.manage", update: "sales.manage", delete: "sales.admin" }, { softDelete: true, searchable: [] });
defineEntity("sales_targets", "sales_targets", "sales", { view: "sales.view", create: "sales.manage", update: "sales.manage", delete: "sales.admin" }, { softDelete: true, searchable: [] });
defineEntity("sd_approvals", "sd_approvals", "sd", { view: "sd.view", create: "sd.manage", update: "sd.manage", delete: "sd.admin" }, { softDelete: true, searchable: [] });
defineEntity("sd_catalog_items", "sd_catalog_items", "sd", { view: "sd.view", create: "sd.manage", update: "sd.manage", delete: "sd.admin" }, { softDelete: true, searchable: [] });
defineEntity("sd_catalog_requests", "sd_catalog_requests", "sd", { view: "sd.view", create: "sd.manage", update: "sd.manage", delete: "sd.admin" }, { softDelete: true, searchable: [] });
defineEntity("sd_cmdb_cis", "sd_cmdb_cis", "sd", { view: "sd.view", create: "sd.manage", update: "sd.manage", delete: "sd.admin" }, { softDelete: true, searchable: [] });
defineEntity("sd_csat_responses", "sd_csat_responses", "sd", { view: "sd.view", create: "sd.manage", update: "sd.manage", delete: "sd.admin" }, { softDelete: true, searchable: [] });
defineEntity("sd_messages", "sd_messages", "sd", { view: "sd.view", create: "sd.manage", update: "sd.manage", delete: "sd.admin" }, { softDelete: true, searchable: [] });
defineEntity("sd_work_logs", "sd_work_logs", "sd", { view: "sd.view", create: "sd.manage", update: "sd.manage", delete: "sd.admin" }, { softDelete: true, searchable: [] });
defineEntity("srm_audit_log", "srm_audit_log", "procurement", { view: "procurement.view", create: "procurement.manage", update: "procurement.manage", delete: "procurement.admin" }, { softDelete: true, searchable: [] });
defineEntity("srm_capacity_confirmations", "srm_capacity_confirmations", "procurement", { view: "procurement.view", create: "procurement.manage", update: "procurement.manage", delete: "procurement.admin" }, { softDelete: true, searchable: [] });
defineEntity("srm_categories", "srm_categories", "procurement", { view: "procurement.view", create: "procurement.manage", update: "procurement.manage", delete: "procurement.admin" }, { softDelete: true, searchable: [] });
defineEntity("srm_collab_documents", "srm_collab_documents", "procurement", { view: "procurement.view", create: "procurement.manage", update: "procurement.manage", delete: "procurement.admin" }, { softDelete: true, searchable: [] });
defineEntity("srm_compliance_items", "srm_compliance_items", "procurement", { view: "procurement.view", create: "procurement.manage", update: "procurement.manage", delete: "procurement.admin" }, { softDelete: true, searchable: [] });
defineEntity("srm_contacts", "srm_contacts", "procurement", { view: "procurement.view", create: "procurement.manage", update: "procurement.manage", delete: "procurement.admin" }, { softDelete: true, searchable: [] });
defineEntity("srm_delivery_slots", "srm_delivery_slots", "procurement", { view: "procurement.view", create: "procurement.manage", update: "procurement.manage", delete: "procurement.admin" }, { softDelete: true, searchable: [] });
defineEntity("srm_demand_forecasts", "srm_demand_forecasts", "procurement", { view: "procurement.view", create: "procurement.manage", update: "procurement.manage", delete: "procurement.admin" }, { softDelete: true, searchable: [] });
defineEntity("srm_documents", "srm_documents", "procurement", { view: "procurement.view", create: "procurement.manage", update: "procurement.manage", delete: "procurement.admin" }, { softDelete: true, searchable: [] });
defineEntity("srm_insights", "srm_insights", "procurement", { view: "procurement.view", create: "procurement.manage", update: "procurement.manage", delete: "procurement.admin" }, { softDelete: true, searchable: [] });
defineEntity("srm_match_logs", "srm_match_logs", "procurement", { view: "procurement.view", create: "procurement.manage", update: "procurement.manage", delete: "procurement.admin" }, { softDelete: true, searchable: [] });
defineEntity("srm_material_lots", "srm_material_lots", "procurement", { view: "procurement.view", create: "procurement.manage", update: "procurement.manage", delete: "procurement.admin" }, { softDelete: true, searchable: [] });
defineEntity("srm_merge_log", "srm_merge_log", "procurement", { view: "procurement.view", create: "procurement.manage", update: "procurement.manage", delete: "procurement.admin" }, { softDelete: true, searchable: [] });
defineEntity("srm_ncrs", "srm_ncrs", "procurement", { view: "procurement.view", create: "procurement.manage", update: "procurement.manage", delete: "procurement.admin" }, { softDelete: true, searchable: [] });
defineEntity("srm_onboarding", "srm_onboarding", "procurement", { view: "procurement.view", create: "procurement.manage", update: "procurement.manage", delete: "procurement.admin" }, { softDelete: true, searchable: [] });
defineEntity("srm_portal_requests", "srm_portal_requests", "procurement", { view: "procurement.view", create: "procurement.manage", update: "procurement.manage", delete: "procurement.admin" }, { softDelete: true, searchable: [] });
defineEntity("srm_procurement_savings", "srm_procurement_savings", "procurement", { view: "procurement.view", create: "procurement.manage", update: "procurement.manage", delete: "procurement.admin" }, { softDelete: true, searchable: [] });
defineEntity("srm_quality_inspections", "srm_quality_inspections", "procurement", { view: "procurement.view", create: "procurement.manage", update: "procurement.manage", delete: "procurement.admin" }, { softDelete: true, searchable: [] });
defineEntity("srm_registry_approvals", "srm_registry_approvals", "procurement", { view: "procurement.view", create: "procurement.manage", update: "procurement.manage", delete: "procurement.admin" }, { softDelete: true, searchable: [] });
defineEntity("srm_registry_items", "srm_registry_items", "procurement", { view: "procurement.view", create: "procurement.manage", update: "procurement.manage", delete: "procurement.admin" }, { softDelete: true, searchable: [] });
defineEntity("srm_risks", "srm_risks", "procurement", { view: "procurement.view", create: "procurement.manage", update: "procurement.manage", delete: "procurement.admin" }, { softDelete: true, searchable: [] });
defineEntity("srm_scorecards", "srm_scorecards", "procurement", { view: "procurement.view", create: "procurement.manage", update: "procurement.manage", delete: "procurement.admin" }, { softDelete: true, searchable: [] });
defineEntity("srm_timeline", "srm_timeline", "procurement", { view: "procurement.view", create: "procurement.manage", update: "procurement.manage", delete: "procurement.admin" }, { softDelete: true, searchable: [] });
defineEntity("srm_trace_links", "srm_trace_links", "procurement", { view: "procurement.view", create: "procurement.manage", update: "procurement.manage", delete: "procurement.admin" }, { softDelete: true, searchable: [] });
defineEntity("system_settings", "system_settings", "settings", { view: "settings.view", create: "settings.manage", update: "settings.manage", delete: "settings.admin" }, { softDelete: true, searchable: [] });
defineEntity("ta_ai_insights", "ta_ai_insights", "ta", { view: "ta.view", create: "ta.manage", update: "ta.manage", delete: "ta.admin" }, { softDelete: true, searchable: [] });
defineEntity("ta_interviews", "ta_interviews", "ta", { view: "ta.view", create: "ta.manage", update: "ta.manage", delete: "ta.admin" }, { softDelete: true, searchable: [] });
defineEntity("ta_offers", "ta_offers", "ta", { view: "ta.view", create: "ta.manage", update: "ta.manage", delete: "ta.admin" }, { softDelete: true, searchable: [] });
defineEntity("ta_onboarding_tasks", "ta_onboarding_tasks", "ta", { view: "ta.view", create: "ta.manage", update: "ta.manage", delete: "ta.admin" }, { softDelete: true, searchable: [] });
defineEntity("ta_requisitions", "ta_requisitions", "ta", { view: "ta.view", create: "ta.manage", update: "ta.manage", delete: "ta.admin" }, { softDelete: true, searchable: [] });
defineEntity("tenant_feature_flags", "tenant_feature_flags", "settings", { view: "settings.view", create: "settings.manage", update: "settings.manage", delete: "settings.admin" }, { staffOnly: true, softDelete: true, searchable: [] });
defineEntity("tenant_provisioning_jobs", "tenant_provisioning_jobs", "settings", { view: "settings.view", create: "settings.manage", update: "settings.manage", delete: "settings.admin" }, { staffOnly: true, softDelete: true, searchable: [] });
defineEntity("tenant_setup_progress", "tenant_setup_progress", "settings", { view: "settings.view", create: "settings.manage", update: "settings.manage", delete: "settings.admin" }, { softDelete: true, searchable: [] });
defineEntity("tenant_subscriptions", "tenant_subscriptions", "settings", { view: "settings.view", create: "settings.manage", update: "settings.manage", delete: "settings.admin" }, { staffOnly: true, softDelete: true, searchable: [] });
defineEntity("tenants", "tenants", "crud", { view: "settings.view", create: "settings.manage", update: "settings.manage", delete: "settings.admin" }, { staffOnly: true, softDelete: true, searchable: [] });
defineEntity("user_company_memberships", "user_company_memberships", "crud", { view: "settings.view", create: "settings.manage", update: "settings.manage", delete: "settings.admin" }, { softDelete: true, searchable: [] });
defineEntity("user_profiles", "user_profiles", "iam", { view: "iam.view", create: "iam.manage", update: "iam.manage", delete: "iam.admin" }, { softDelete: true, searchable: [] });
defineEntity("user_role_changes", "user_role_changes", "crud", { view: "settings.view", create: "settings.manage", update: "settings.manage", delete: "settings.admin" }, { softDelete: true, searchable: [] });
defineEntity("user_sessions", "user_sessions", "iam", { view: "iam.view", create: "iam.manage", update: "iam.manage", delete: "iam.admin" }, { softDelete: true, searchable: [] });
defineEntity("uw_identity_events", "uw_identity_events", "iam", { view: "iam.view", create: "iam.manage", update: "iam.manage", delete: "iam.admin" }, { softDelete: true, searchable: [] });
defineEntity("uw_merge_log", "uw_merge_log", "iam", { view: "iam.view", create: "iam.manage", update: "iam.manage", delete: "iam.admin" }, { softDelete: true, searchable: [] });
defineEntity("uw_module_entitlements", "uw_module_entitlements", "iam", { view: "iam.view", create: "iam.manage", update: "iam.manage", delete: "iam.admin" }, { softDelete: true, searchable: [] });
defineEntity("uw_person_360", "uw_person_360", "iam", { view: "iam.view", create: "iam.manage", update: "iam.manage", delete: "iam.admin" }, { softDelete: true, searchable: [] });
defineEntity("uw_person_links", "uw_person_links", "iam", { view: "iam.view", create: "iam.manage", update: "iam.manage", delete: "iam.admin" }, { softDelete: true, searchable: [] });
defineEntity("uw_persons", "uw_persons", "iam", { view: "iam.view", create: "iam.manage", update: "iam.manage", delete: "iam.admin" }, { softDelete: true, searchable: [] });
defineEntity("uw_upid_sequences", "uw_upid_sequences", "iam", { view: "iam.view", create: "iam.manage", update: "iam.manage", delete: "iam.admin" }, { softDelete: true, searchable: [] });

// ── Bulk registrations (UI tables) ──
defineEntity("bi_analytics_models", "bi_analytics_models", "crud", { view: "settings.view", create: "settings.manage", update: "settings.manage", delete: "settings.admin" }, { softDelete: true, searchable: [] });
defineEntity("bi_chart_catalog", "bi_chart_catalog", "crud", { view: "settings.view", create: "settings.manage", update: "settings.manage", delete: "settings.admin" }, { softDelete: true, searchable: [] });
defineEntity("bi_dashboard_widgets", "bi_dashboard_widgets", "crud", { view: "settings.view", create: "settings.manage", update: "settings.manage", delete: "settings.admin" }, { softDelete: true, searchable: [] });
defineEntity("bi_dashboards", "bi_dashboards", "crud", { view: "settings.view", create: "settings.manage", update: "settings.manage", delete: "settings.admin" }, { softDelete: true, searchable: [] });
defineEntity("bi_data_marts", "bi_data_marts", "crud", { view: "settings.view", create: "settings.manage", update: "settings.manage", delete: "settings.admin" }, { softDelete: true, searchable: [] });
defineEntity("bi_dwh_objects", "bi_dwh_objects", "crud", { view: "settings.view", create: "settings.manage", update: "settings.manage", delete: "settings.admin" }, { softDelete: true, searchable: [] });
defineEntity("bi_search_index", "bi_search_index", "crud", { view: "settings.view", create: "settings.manage", update: "settings.manage", delete: "settings.admin" }, { softDelete: true, searchable: [] });
defineEntity("bi_service_registry", "bi_service_registry", "crud", { view: "settings.view", create: "settings.manage", update: "settings.manage", delete: "settings.admin" }, { softDelete: true, searchable: [] });
defineEntity("bill_approval_actions", "bill_approval_actions", "crud", { view: "settings.view", create: "settings.manage", update: "settings.manage", delete: "settings.admin" }, { softDelete: true, searchable: [] });
defineEntity("bill_approval_steps", "bill_approval_steps", "crud", { view: "settings.view", create: "settings.manage", update: "settings.manage", delete: "settings.admin" }, { softDelete: true, searchable: [] });
defineEntity("bill_communications", "bill_communications", "crud", { view: "settings.view", create: "settings.manage", update: "settings.manage", delete: "settings.admin" }, { softDelete: true, searchable: [] });
defineEntity("crm_sales_targets", "crm_sales_targets", "crud", { view: "settings.view", create: "settings.manage", update: "settings.manage", delete: "settings.admin" }, { softDelete: true, searchable: [] });
defineEntity("dispatch_items", "dispatch_items", "crud", { view: "settings.view", create: "settings.manage", update: "settings.manage", delete: "settings.admin" }, { softDelete: true, searchable: [] });
defineEntity("dsp_ai_insights", "dsp_ai_insights", "dispatch", { view: "dispatch.view", create: "dispatch.manage", update: "dispatch.manage", delete: "dispatch.admin" }, { softDelete: true, searchable: [] });
defineEntity("dsp_loading_bays", "dsp_loading_bays", "dispatch", { view: "dispatch.view", create: "dispatch.manage", update: "dispatch.manage", delete: "dispatch.admin" }, { softDelete: true, searchable: [] });
defineEntity("eal_frameworks", "eal_frameworks", "crud", { view: "settings.view", create: "settings.manage", update: "settings.manage", delete: "settings.admin" }, { softDelete: true, searchable: [] });
defineEntity("eal_report_defs", "eal_report_defs", "crud", { view: "settings.view", create: "settings.manage", update: "settings.manage", delete: "settings.admin" }, { softDelete: true, searchable: [] });
defineEntity("email_outbox", "email_outbox", "crud", { view: "settings.view", create: "settings.manage", update: "settings.manage", delete: "settings.admin" }, { softDelete: true, searchable: [] });
defineEntity("hr_insights", "hr_insights", "crud", { view: "settings.view", create: "settings.manage", update: "settings.manage", delete: "settings.admin" }, { softDelete: true, searchable: [] });
defineEntity("intg_events", "intg_events", "crud", { view: "settings.view", create: "settings.manage", update: "settings.manage", delete: "settings.admin" }, { softDelete: true, searchable: [] });
defineEntity("intg_module_links", "intg_module_links", "crud", { view: "settings.view", create: "settings.manage", update: "settings.manage", delete: "settings.admin" }, { softDelete: true, searchable: [] });
defineEntity("job_applicants", "job_applicants", "crud", { view: "settings.view", create: "settings.manage", update: "settings.manage", delete: "settings.admin" }, { softDelete: true, searchable: [] });
defineEntity("job_requisitions", "job_requisitions", "crud", { view: "settings.view", create: "settings.manage", update: "settings.manage", delete: "settings.admin" }, { softDelete: true, searchable: [] });
defineEntity("labor_cost_entries", "labor_cost_entries", "crud", { view: "settings.view", create: "settings.manage", update: "settings.manage", delete: "settings.admin" }, { softDelete: true, searchable: [] });
defineEntity("login_history", "login_history", "crud", { view: "settings.view", create: "settings.manage", update: "settings.manage", delete: "settings.admin" }, { softDelete: true, searchable: [] });
defineEntity("mes_production_plans", "mes_production_plans", "mes", { view: "mes.view", create: "mes.manage", update: "mes.manage", delete: "mes.admin" }, { softDelete: true, searchable: [] });
defineEntity("mes_waste_records", "mes_waste_records", "mes", { view: "mes.view", create: "mes.manage", update: "mes.manage", delete: "mes.admin" }, { softDelete: true, searchable: [] });
defineEntity("notification_broadcasts", "notification_broadcasts", "crud", { view: "settings.view", create: "settings.manage", update: "settings.manage", delete: "settings.admin" }, { softDelete: true, searchable: [] });
defineEntity("pay_benefit_plans", "pay_benefit_plans", "crud", { view: "settings.view", create: "settings.manage", update: "settings.manage", delete: "settings.admin" }, { softDelete: true, searchable: [] });
defineEntity("pay_corrections", "pay_corrections", "crud", { view: "settings.view", create: "settings.manage", update: "settings.manage", delete: "settings.admin" }, { softDelete: true, searchable: [] });
defineEntity("pay_mobile_money", "pay_mobile_money", "crud", { view: "settings.view", create: "settings.manage", update: "settings.manage", delete: "settings.admin" }, { softDelete: true, searchable: [] });
defineEntity("pay_periods", "pay_periods", "crud", { view: "settings.view", create: "settings.manage", update: "settings.manage", delete: "settings.admin" }, { softDelete: true, searchable: [] });
defineEntity("pay_salary_structures", "pay_salary_structures", "crud", { view: "settings.view", create: "settings.manage", update: "settings.manage", delete: "settings.admin" }, { softDelete: true, searchable: [] });
defineEntity("pay_statutory_rates", "pay_statutory_rates", "crud", { view: "settings.view", create: "settings.manage", update: "settings.manage", delete: "settings.admin" }, { softDelete: true, searchable: [] });
defineEntity("pay_structure_lines", "pay_structure_lines", "crud", { view: "settings.view", create: "settings.manage", update: "settings.manage", delete: "settings.admin" }, { softDelete: true, searchable: [] });
defineEntity("pay_tax_brackets", "pay_tax_brackets", "crud", { view: "settings.view", create: "settings.manage", update: "settings.manage", delete: "settings.admin" }, { softDelete: true, searchable: [] });
defineEntity("permissions", "permissions", "crud", { view: "settings.view", create: "settings.manage", update: "settings.manage", delete: "settings.admin" }, { softDelete: true, searchable: [] });
defineEntity("prt_barcode_presets", "prt_barcode_presets", "print", { view: "print.view", create: "print.manage", update: "print.manage", delete: "print.admin" }, { softDelete: true, searchable: [] });
defineEntity("scm_insights", "scm_insights", "crud", { view: "settings.view", create: "settings.manage", update: "settings.manage", delete: "settings.admin" }, { softDelete: true, searchable: [] });
defineEntity("scm_kpi_snapshots", "scm_kpi_snapshots", "crud", { view: "settings.view", create: "settings.manage", update: "settings.manage", delete: "settings.admin" }, { softDelete: true, searchable: [] });
defineEntity("scm_sustainability", "scm_sustainability", "crud", { view: "settings.view", create: "settings.manage", update: "settings.manage", delete: "settings.admin" }, { softDelete: true, searchable: [] });
defineEntity("sd_catalog_categories", "sd_catalog_categories", "sd", { view: "sd.view", create: "sd.manage", update: "sd.manage", delete: "sd.admin" }, { softDelete: true, searchable: [] });
defineEntity("sd_cmdb_relations", "sd_cmdb_relations", "sd", { view: "sd.view", create: "sd.manage", update: "sd.manage", delete: "sd.admin" }, { softDelete: true, searchable: [] });
defineEntity("sd_ticket_templates", "sd_ticket_templates", "sd", { view: "sd.view", create: "sd.manage", update: "sd.manage", delete: "sd.admin" }, { softDelete: true, searchable: [] });
defineEntity("supplier_scorecards", "supplier_scorecards", "crud", { view: "settings.view", create: "settings.manage", update: "settings.manage", delete: "settings.admin" }, { softDelete: true, searchable: [] });
defineEntity("ta_pipeline_stages", "ta_pipeline_stages", "ta", { view: "ta.view", create: "ta.manage", update: "ta.manage", delete: "ta.admin" }, { softDelete: true, searchable: [] });
defineEntity("wid_verification_logs", "wid_verification_logs", "iam", { view: "iam.view", create: "iam.manage", update: "iam.manage", delete: "iam.admin" }, { softDelete: true, searchable: [] });
defineEntity("workforce_insights", "workforce_insights", "crud", { view: "settings.view", create: "settings.manage", update: "settings.manage", delete: "settings.admin" }, { softDelete: true, searchable: [] });
