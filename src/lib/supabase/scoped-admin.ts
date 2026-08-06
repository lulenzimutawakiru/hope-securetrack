/**
 * Service-role client with mandatory tenant/company isolation.
 *
 * Raw createAdminClient() bypasses RLS. Prefer this helper for authenticated
 * money/identity/posting paths so every query is scoped and every returned row
 * is re-asserted against the session scope.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  assertSameCompany,
  assertTenantAndCompany,
  type TenantScope,
} from "@/lib/tenant/context";
import type { AuthedContext } from "@/lib/security/api-auth";
import { scopeFromAuth } from "@/lib/tenant/context";

export type ScopedAdmin = {
  /** Underlying service-role client — use only via helpers when possible */
  client: SupabaseClient;
  scope: TenantScope;
};

export function createScopedAdmin(scope: TenantScope): ScopedAdmin {
  if (!scope.companyId && !scope.isElevated) {
    throw new Error("ScopedAdmin requires companyId unless elevated");
  }
  return { client: createAdminClient(), scope };
}

export function createScopedAdminFromAuth(ctx: AuthedContext): ScopedAdmin {
  return createScopedAdmin(scopeFromAuth(ctx));
}

/**
 * Fetch a single row by primary key, enforcing company (+ tenant when known).
 * Elevated platform break-glass may omit company filter.
 */
export async function adminGetById(
  scoped: ScopedAdmin,
  table: string,
  id: string,
  opts?: { select?: string; pk?: string; filterTenant?: boolean }
): Promise<Record<string, unknown> | null> {
  const pk = opts?.pk ?? "id";
  let q = scoped.client
    .from(table)
    .select(opts?.select ?? "*")
    .eq(pk, id);

  if (!scoped.scope.isElevated) {
    q = q.eq("company_id", scoped.scope.companyId);
    // Only filter tenant_id when the table is known to carry it
    if (opts?.filterTenant && scoped.scope.tenantId) {
      q = q.eq("tenant_id", scoped.scope.tenantId);
    }
  }

  const { data, error } = await q.maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;

  const row = data as unknown as Record<string, unknown>;
  assertTenantAndCompany(
    scoped.scope,
    {
      tenant_id: row.tenant_id as string | null | undefined,
      company_id: row.company_id as string | null | undefined,
    },
    table
  );
  return row;
}

/**
 * Insert a row, stamping company_id from scope (never the body).
 * Strips client-supplied ownership fields.
 * Set `stampTenant: true` only when the table has a tenant_id column.
 */
export async function adminInsert(
  scoped: ScopedAdmin,
  table: string,
  row: Record<string, unknown>,
  opts?: { select?: string; stampTenant?: boolean }
): Promise<Record<string, unknown>> {
  const body = { ...row };
  delete body.company_id;
  delete body.tenant_id;
  delete body.id;

  const payload: Record<string, unknown> = {
    ...body,
    company_id: scoped.scope.companyId,
  };
  if (opts?.stampTenant && scoped.scope.tenantId) {
    payload.tenant_id = scoped.scope.tenantId;
  }

  const { data, error } = await scoped.client
    .from(table)
    .insert(payload)
    .select(opts?.select ?? "*")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? `Insert into ${table} failed`);
  }

  const out = data as unknown as Record<string, unknown>;
  assertSameCompany(scoped.scope, out.company_id as string, table);
  return out;
}

/**
 * Update by id within company scope. Identity fields cannot be changed.
 */
export async function adminUpdateById(
  scoped: ScopedAdmin,
  table: string,
  id: string,
  patch: Record<string, unknown>,
  opts?: { select?: string; pk?: string }
): Promise<Record<string, unknown>> {
  const body = { ...patch };
  delete body.company_id;
  delete body.tenant_id;
  delete body.id;
  delete body.created_by;
  delete body.created_at;

  const pk = opts?.pk ?? "id";
  let q = scoped.client
    .from(table)
    .update({ ...body, updated_at: new Date().toISOString() })
    .eq(pk, id);

  if (!scoped.scope.isElevated) {
    q = q.eq("company_id", scoped.scope.companyId);
  }

  const { data, error } = await q.select(opts?.select ?? "*").maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error(`${table} row not found or outside company scope`);

  const out = data as unknown as Record<string, unknown>;
  assertTenantAndCompany(
    scoped.scope,
    {
      tenant_id: out.tenant_id as string | null | undefined,
      company_id: out.company_id as string | null | undefined,
    },
    table
  );
  return out;
}

/**
 * Assert a row loaded via any path is inside scope (defense in depth).
 */
export function assertScopedRow(
  scoped: ScopedAdmin,
  row: { company_id?: string | null; tenant_id?: string | null },
  label = "record"
): void {
  assertTenantAndCompany(scoped.scope, row, label);
}

/**
 * Build a company-scoped query builder starter.
 * Callers still own select/filter; company filter is pre-applied.
 */
export function adminFrom(scoped: ScopedAdmin, table: string) {
  const q = scoped.client.from(table);
  if (!scoped.scope.isElevated && scoped.scope.companyId) {
    // PostgREST filter is applied by chaining .eq after select in callers.
    // Return a thin wrapper that always injects company_id.
    return {
      select: (columns = "*") => {
        let s = scoped.client.from(table).select(columns);
        s = s.eq("company_id", scoped.scope.companyId);
        if (scoped.scope.tenantId) {
          s = s.eq("tenant_id", scoped.scope.tenantId);
        }
        return s;
      },
      insert: (values: Record<string, unknown> | Record<string, unknown>[]) => {
        const stamp = (v: Record<string, unknown>) => {
          const out = { ...v };
          delete out.company_id;
          delete out.tenant_id;
          out.company_id = scoped.scope.companyId;
          if (scoped.scope.tenantId) out.tenant_id = scoped.scope.tenantId;
          return out;
        };
        const payload = Array.isArray(values)
          ? values.map(stamp)
          : stamp(values);
        return scoped.client.from(table).insert(payload);
      },
      update: (values: Record<string, unknown>) => {
        const body = { ...values };
        delete body.company_id;
        delete body.tenant_id;
        let u = scoped.client
          .from(table)
          .update(body)
          .eq("company_id", scoped.scope.companyId);
        if (scoped.scope.tenantId) {
          u = u.eq("tenant_id", scoped.scope.tenantId);
        }
        return u;
      },
      delete: () => {
        let d = scoped.client
          .from(table)
          .delete()
          .eq("company_id", scoped.scope.companyId);
        if (scoped.scope.tenantId) {
          d = d.eq("tenant_id", scoped.scope.tenantId);
        }
        return d;
      },
      /** Escape hatch for RPCs / complex joins — still carries scope for asserts */
      raw: () => q,
    };
  }
  return {
    select: (columns = "*") => scoped.client.from(table).select(columns),
    insert: (values: Record<string, unknown> | Record<string, unknown>[]) =>
      scoped.client.from(table).insert(values),
    update: (values: Record<string, unknown>) =>
      scoped.client.from(table).update(values),
    delete: () => scoped.client.from(table).delete(),
    raw: () => q,
  };
}
