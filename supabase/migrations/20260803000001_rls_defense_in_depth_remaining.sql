-- ============================================================================
-- RLS defense-in-depth: last unmapped write surfaces
-- 2026-08-03
--
-- Phase 3-8 swept permission-gated RESTRICTIVE write policies across ~905
-- company tables. Three tables were skipped by that sweep because they already
-- carried permission-gated permissive policies (print_jobs, fraud_alerts) or an
-- append-only insert policy (config_change_log). This migration adds explicit
-- RESTRICTIVE write policies so the enforcement contract is uniform:
--
--   * print_jobs          - insert/update gated by printing.* permissions,
--                           delete hard-denied (previously implicit).
--   * fraud_alerts        - update gated by fraud.* permissions,
--                           insert/delete hard-denied.
--   * config_change_log   - append-only guarantee: update/delete hard-denied
--                           even if a future permissive policy is added.
--
-- All policies target authenticated users only and mirror the exact permission
-- slugs already used by the existing permissive policies, so there is zero
-- behavior change for legitimate flows.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- print_jobs
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS print_jobs_write_restrict_insert ON print_jobs;
CREATE POLICY print_jobs_write_restrict_insert ON print_jobs AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (
    (company_id = public.user_company_id())
    AND (public.is_super_admin() OR public.has_any_permission(ARRAY['printing.create', 'printing.manage']))
  );

DROP POLICY IF EXISTS print_jobs_write_restrict_update ON print_jobs;
CREATE POLICY print_jobs_write_restrict_update ON print_jobs AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (
    (company_id = public.user_company_id())
    AND (public.is_super_admin() OR public.has_any_permission(ARRAY['printing.manage', 'printing.reprint']))
  )
  WITH CHECK (
    (company_id = public.user_company_id())
    AND (public.is_super_admin() OR public.has_any_permission(ARRAY['printing.manage', 'printing.reprint']))
  );

DROP POLICY IF EXISTS print_jobs_write_restrict_delete ON print_jobs;
CREATE POLICY print_jobs_write_restrict_delete ON print_jobs AS RESTRICTIVE FOR DELETE TO authenticated
  USING (false);

-- ----------------------------------------------------------------------------
-- fraud_alerts
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS fraud_alerts_write_restrict_insert ON fraud_alerts;
CREATE POLICY fraud_alerts_write_restrict_insert ON fraud_alerts AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (
    (company_id = public.user_company_id())
    AND (public.is_super_admin() OR public.has_any_permission(ARRAY['fraud.manage', 'fraud.investigate']))
  );

DROP POLICY IF EXISTS fraud_alerts_write_restrict_update ON fraud_alerts;
CREATE POLICY fraud_alerts_write_restrict_update ON fraud_alerts AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (
    (company_id = public.user_company_id())
    AND (public.is_super_admin() OR public.has_any_permission(ARRAY['fraud.manage', 'fraud.investigate']))
  )
  WITH CHECK (
    (company_id = public.user_company_id())
    AND (public.is_super_admin() OR public.has_any_permission(ARRAY['fraud.manage', 'fraud.investigate']))
  );

DROP POLICY IF EXISTS fraud_alerts_write_restrict_delete ON fraud_alerts;
CREATE POLICY fraud_alerts_write_restrict_delete ON fraud_alerts AS RESTRICTIVE FOR DELETE TO authenticated
  USING (false);

-- ----------------------------------------------------------------------------
-- config_change_log - append-only audit trail
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS config_change_log_write_restrict_update ON config_change_log;
CREATE POLICY config_change_log_write_restrict_update ON config_change_log AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (false);

DROP POLICY IF EXISTS config_change_log_write_restrict_delete ON config_change_log;
CREATE POLICY config_change_log_write_restrict_delete ON config_change_log AS RESTRICTIVE FOR DELETE TO authenticated
  USING (false);
