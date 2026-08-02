import { createRouteHandlerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getEntityDefinition, EntityDefinition } from "@/lib/metadata/entity-registry";
import { logClientEvent } from "@/lib/audit";

interface CrudContext {
  tenantId: string;
  companyId: string;
  userId: string;
}

/**
 * Generic engine for CRUD operations that enforces tenant isolation,
 * permissions (checked at the caller level), audit logging, and workflow triggers.
 */
export async function getList<T = unknown>(
  ctx: CrudContext,
  entity: string,
  query: Record<string, unknown>
): Promise<{ data: T[] | null; error: string | null }> {
  const def = getEntityDefinition(entity);
  if (!def) return { data: null, error: `Unknown entity: ${entity}` };

  const supabase = createRouteHandlerClient({ cookies });
  let q = supabase.from(def.table).select("*").eq("tenant_id", ctx.tenantId);

  // Apply simple filters from query parameters (demo purpose)
  if (query.search && typeof query.search === "string") {
    q = q.ilike("name", `%${query.search}%`); // assumes a "name" column
  }
  // pagination, sorting, etc. can be added here

  const { data, error } = await q;
  if (error) return { data: null, error: error.message };

  return { data: data as T[], error: null };
}

export async function getById<T = unknown>(
  ctx: CrudContext,
  entity: string,
  id: string
): Promise<{ data: T | null; error: string | null }> {
  const def = getEntityDefinition(entity);
  if (!def) return { data: null, error: `Unknown entity: ${entity}` };

  const supabase = createRouteHandlerClient({ cookies });
  const { data, error } = await supabase
    .from(def.table)
    .select("*")
    .eq(def.primaryKey, id)
    .eq("tenant_id", ctx.tenantId)
    .maybeSingle();

  return { data: data as T | null, error: error?.message ?? null };
}

export async function createRecord<T = unknown>(
  ctx: CrudContext,
  entity: string,
  payload: Record<string, unknown>
): Promise<{ data: T | null; error: string | null }> {
  const def = getEntityDefinition(entity);
  if (!def) return { data: null, error: `Unknown entity: ${entity}` };

  const supabase = createRouteHandlerClient({ cookies });
  const enriched = {
    ...payload,
    tenant_id: ctx.tenantId,
    company_id: ctx.companyId,
    created_by: ctx.userId,
    updated_by: ctx.userId,
  };

  const { data, error } = await supabase.from(def.table).insert(enriched).select().single();
  if (error) return { data: null, error: error.message };

  // Audit
  await logClientEvent({
    event: `${entity}.created`,
    details: { id: (data as any)?.[def.primaryKey] },
    userId: ctx.userId,
    companyId: ctx.companyId,
  });

  // Trigger workflow if defined
  if (def.workflows?.onCreate) {
    await startWorkflowInstance(def.workflows.onCreate, ctx, data);
  }

  return { data: data as T, error: null };
}

export async function updateRecord<T = unknown>(
  ctx: CrudContext,
  entity: string,
  id: string,
  payload: Record<string, unknown>
): Promise<{ data: T | null; error: string | null }> {
  const def = getEntityDefinition(entity);
  if (!def) return { data: null, error: `Unknown entity: ${entity}` };

  const supabase = createRouteHandlerClient({ cookies });
  const enriched = {
    ...payload,
    updated_by: ctx.userId,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from(def.table)
    .update(enriched)
    .eq(def.primaryKey, id)
    .eq("tenant_id", ctx.tenantId)
    .select()
    .single();

  if (error) return { data: null, error: error.message };

  await logClientEvent({
    event: `${entity}.updated`,
    details: { id },
    userId: ctx.userId,
    companyId: ctx.companyId,
  });

  if (def.workflows?.onUpdate) {
    await startWorkflowInstance(def.workflows.onUpdate, ctx, data);
  }

  return { data: data as T, error: null };
}

export async function deleteRecord(
  ctx: CrudContext,
  entity: string,
  id: string
): Promise<{ error: string | null }> {
  const def = getEntityDefinition(entity);
  if (!def) return { error: `Unknown entity: ${entity}` };

  const supabase = createRouteHandlerClient({ cookies });

  if (def.softDelete && def.deletedColumn) {
    const { error } = await supabase
      .from(def.table)
      .update({ [def.deletedColumn]: new Date().toISOString(), updated_by: ctx.userId })
      .eq(def.primaryKey, id)
      .eq("tenant_id", ctx.tenantId);
    if (error) return { error: error.message };
  } else {
    const { error } = await supabase
      .from(def.table)
      .delete()
      .eq(def.primaryKey, id)
      .eq("tenant_id", ctx.tenantId);
    if (error) return { error: error.message };
  }

  await logClientEvent({
    event: `${entity}.deleted`,
    details: { id },
    userId: ctx.userId,
    companyId: ctx.companyId,
  });

  if (def.workflows?.onDelete) {
    await startWorkflowInstance(def.workflows.onDelete, ctx, { id });
  }

  return { error: null };
}

/* Placeholder for workflow instance creation – will be replaced by the
   full workflow engine once it is built. */
async function startWorkflowInstance(
  workflowType: string,
  ctx: CrudContext,
  record: unknown
) {
  const supabase = createRouteHandlerClient({ cookies });
  await supabase.from("workflow_instances").insert({
    tenant_id: ctx.tenantId,
    company_id: ctx.companyId,
    workflow_type: workflowType,
    status: "pending",
    payload: record,
    created_by: ctx.userId,
  });
}
