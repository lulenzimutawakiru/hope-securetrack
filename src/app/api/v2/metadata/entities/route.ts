/**
 * Enterprise BOS — Business Object metadata catalog.
 *
 * GET  /api/v2/metadata/entities           — full catalog (registry, always fresh)
 * GET  /api/v2/metadata/entities?entity=X  — single definition
 * POST /api/v2/metadata/entities           — sync registry → entity_metadata (platform staff)
 *
 * The catalog describes every Business Object the platform can CRUD, together
 * with its permission surface, lifecycle flags and universal capabilities.
 * Definitions are metadata, not code paths: modules consume the registry.
 */

import { createApiHandler, apiOk, apiError } from "@/lib/api/handler";
import {
  getEntityCatalog,
  getEntityDefinition,
  type EntityDefinition,
} from "@/lib/metadata/entity-registry";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function toCatalogEntry(def: EntityDefinition) {
  return {
    entity: def.entity,
    table: def.table,
    primaryKey: def.primaryKey,
    module: def.module,
    staffOnly: def.staffOnly,
    tenantScoped: def.tenantScoped,
    softDelete: def.softDelete,
    deletedColumn: def.deletedColumn ?? null,
    archivedAt: def.archivedAt ?? false,
    archiveColumn: def.archiveColumn ?? null,
    archiveTimestampColumn: def.archiveTimestampColumn ?? null,
    permissions: {
      view: def.viewPermission,
      create: def.createPermission,
      update: def.updatePermission,
      delete: def.deletePermission,
    },
    searchable: def.searchable ?? [],
    sortable: def.sortable ?? [],
    workflows: def.workflows ?? {},
    capabilities: def.capabilities,
  };
}

export const GET = createApiHandler(
  {
    auth: true,
    permissions: ["settings.view", "platform.view"],
    allowPlatformAdmin: true,
    module: "bos-metadata",
    rateLimit: { limit: 120, windowMs: 60_000 },
  },
  async ({ ctx, req }) => {
    if (!ctx) return apiError("UNAUTHORIZED", "Sign in required", 401);
    const entity = req.nextUrl.searchParams.get("entity");
    if (entity) {
      const def = getEntityDefinition(entity);
      if (!def) return apiError("NOT_FOUND", `Unknown entity: ${entity}`, 404);
      return apiOk({ entity: toCatalogEntry(def) });
    }
    const catalog = getEntityCatalog().map(toCatalogEntry);
    return apiOk({ entities: catalog, total: catalog.length });
  }
);

export const POST = createApiHandler(
  {
    auth: true,
    permissions: ["platform.view"],
    allowPlatformAdmin: true,
    module: "bos-metadata",
    rateLimit: { limit: 10, windowMs: 60_000 },
  },
  async ({ ctx }) => {
    if (!ctx) return apiError("UNAUTHORIZED", "Sign in required", 401);
    if (!ctx.isPlatformAdmin) {
      return apiError(
        "FORBIDDEN",
        "Syncing the Business Object catalog requires platform admin",
        403
      );
    }
    const admin = createAdminClient();
    const now = new Date().toISOString();
    const rows = getEntityCatalog().map((def) => ({
      entity: def.entity,
      table_name: def.table,
      primary_key_column: def.primaryKey,
      module: def.module,
      staff_only: def.staffOnly,
      tenant_scoped: def.tenantScoped,
      soft_delete: def.softDelete,
      deleted_column: def.deletedColumn ?? null,
      archived_at: def.archivedAt ?? false,
      archive_column: def.archiveColumn ?? null,
      archive_timestamp_column: def.archiveTimestampColumn ?? null,
      has_created_at: def.hasCreatedAt ?? true,
      has_updated_at: def.hasUpdatedAt ?? true,
      created_by: def.createdBy ?? false,
      updated_by: def.updatedBy ?? false,
      view_permission: def.viewPermission,
      create_permission: def.createPermission,
      update_permission: def.updatePermission,
      delete_permission: def.deletePermission,
      workflow_config: def.workflows ?? {},
      searchable: def.searchable ?? [],
      sortable: def.sortable ?? [],
      capabilities: def.capabilities,
      updated_at: now,
    }));
    const { data, error } = await admin
      .from("entity_metadata")
      .upsert(rows, { onConflict: "entity" })
      .select("entity");
    if (error) {
      return apiError("INTERNAL", error.message, 500);
    }
    return apiOk({
      synced: (data ?? rows).length,
      total: rows.length,
    });
  }
);
