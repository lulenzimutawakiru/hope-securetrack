/**
 * Metadata registry for every business object in SecureTrack ERP.
 * Each definition declares how the object maps to the database and which
 * actions are permitted.
 */

export interface EntityDefinition {
  /** Logical name used in API routes, e.g., "employees" */
  entity: string;
  /** Database table name */
  table: string;
  /** Primary key column name */
  primaryKey: string;
  /** Whether the table supports soft‑delete (archiving) */
  softDelete: boolean;
  /** Column used for soft‑delete flag, if applicable */
  deletedColumn?: string;
  /** Required permission string prefix (e.g., "employees.view") */
  viewPermission: string;
  createPermission: string;
  updatePermission: string;
  deletePermission: string;
  /** Workflow types that can be triggered, keyed by action */
  workflows?: {
    onCreate?: string;
    onUpdate?: string;
    onDelete?: string;
    onApprove?: string;
  };
}

export const ENTITY_REGISTRY: Record<string, EntityDefinition> = {
  employees: {
    entity: "employees",
    table: "employees",
    primaryKey: "id",
    softDelete: true,
    deletedColumn: "deleted_at",
    viewPermission: "hr.view",
    createPermission: "hr.manage",
    updatePermission: "hr.manage",
    deletePermission: "hr.manage",
    workflows: {
      onCreate: "employee_onboarding",
      onUpdate: "employee_update",
      onDelete: "employee_offboarding",
    },
  },
  // Additional entities (products, invoices, etc.) are registered here
  // as they are implemented.  The UI automatically picks up new entities
  // from this registry.
};

/** Resolve an entity definition by logical name. */
export function getEntityDefinition(entity: string): EntityDefinition | undefined {
  return ENTITY_REGISTRY[entity];
}
