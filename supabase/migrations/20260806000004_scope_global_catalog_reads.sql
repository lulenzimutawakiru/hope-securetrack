-- ---------------------------------------------------------------------------
-- Scope global-catalog SELECT policies so cross-tenant reads are impossible.
--
-- intg_connectors:
--   * Global system rows (company_id IS NULL) are non-sensitive connector
--     definitions (code/name/protocol/category) and remain readable by any
--     authenticated user so the catalog UI keeps working.
--   * Company/tenant-scoped rows require tenant_company_access — the same
--     dual-key check enforced by the restrictive policy added in
--     20260801000036 — so no tenant can read another tenant's connector
--     rows, config_schema, or connection metadata.
--   * The restrictive policy is updated to match: company-scoped rows stay
--     isolated, global catalog rows stay visible. Writes remain gated by the
--     platform-admin-only intg_connectors_write policy.
--
-- ec_enterprise_groups:
--   * The table has no tenant/company column. Reads are limited to platform
--     admins and users whose tenant owns a company attached to the group
--     (mirrors the write policy from 20260804000002).
-- ---------------------------------------------------------------------------
BEGIN;

DROP POLICY IF EXISTS intg_connectors_read ON public.intg_connectors;
CREATE POLICY intg_connectors_read ON public.intg_connectors FOR SELECT
  USING (
    company_id IS NULL
    OR public.tenant_company_access(tenant_id, company_id)
  );

DROP POLICY IF EXISTS tenant_isolation_restrict ON public.intg_connectors;
CREATE POLICY tenant_isolation_restrict ON public.intg_connectors
  AS RESTRICTIVE FOR ALL
  USING (
    company_id IS NULL
    OR public.tenant_company_access(tenant_id, company_id)
  )
  WITH CHECK (
    company_id IS NULL
    OR public.tenant_company_access(tenant_id, company_id)
  );

DROP POLICY IF EXISTS ec_groups_select ON public.ec_enterprise_groups;
CREATE POLICY ec_groups_select ON public.ec_enterprise_groups FOR SELECT
  USING (
    public.is_platform_admin()
    OR EXISTS (
      SELECT 1 FROM public.companies c
      WHERE c.enterprise_group_id = ec_enterprise_groups.id
        AND c.tenant_id = public.user_tenant_id()
    )
  );

COMMIT;
