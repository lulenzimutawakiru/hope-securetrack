-- ============================================================================
-- RLS Business Permission Enforcement - Part 4 (Phase 5)
--
-- Closes the data-layer RBAC gap for the remaining ERP modules: asset
-- tracking, digital identity, underwriting, supplier relationship
-- management, business intelligence / reporting, the remaining finance &
-- accounting tables, print / labels / packaging, communications, and the
-- shared org / inventory / SCM / HR / dispatch / SD catalog / workflow
-- support tables. As in Phases 2-4, any authenticated company member could
-- previously INSERT / UPDATE / DELETE these records directly through the
-- browser client because the permissive *_all policies were gated only by
-- company_id = user_company_id().
--
-- This migration adds RESTRICTIVE write policies (INSERT / UPDATE / DELETE) to
-- 269 core business tables. Restrictive policies AND with the existing
-- permissive policies and the migration-71 tenant_isolation_restrict policy, so
-- writes now require:
--   1. tenant + company scope (existing policies), AND
--   2. a matching module permission (new policies) OR super_administrator.
--
-- SELECT stays open to any company member (the 900+ page client UI reads
-- directly); only WRITE paths are hardened. Every permission slug below was
-- verified against the live permissions catalog, and each union is a superset of
-- the permission slugs the CRUD engine registry uses for the same table, so no
-- API flow that passes the registry check is denied at the database layer.
-- Every table in this phase carries its own company_id / tenant_id, so the
-- write gates bind directly to the caller's company via the migration-71
-- tenant_isolation_restrict policy (no parent-scoped indirection required).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Asset Tracking: ast_assets  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS ast_assets_write_restrict_insert ON ast_assets;
CREATE POLICY ast_assets_write_restrict_insert ON ast_assets AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['ast.manage','ast.assign']));
DROP POLICY IF EXISTS ast_assets_write_restrict_update ON ast_assets;
CREATE POLICY ast_assets_write_restrict_update ON ast_assets AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['ast.manage','ast.assign']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['ast.manage','ast.assign']));
DROP POLICY IF EXISTS ast_assets_write_restrict_delete ON ast_assets;
CREATE POLICY ast_assets_write_restrict_delete ON ast_assets AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['ast.manage','ast.assign']));
-- ----------------------------------------------------------------------------
-- Asset Tracking: ast_categories  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS ast_categories_write_restrict_insert ON ast_categories;
CREATE POLICY ast_categories_write_restrict_insert ON ast_categories AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['ast.manage']));
DROP POLICY IF EXISTS ast_categories_write_restrict_update ON ast_categories;
CREATE POLICY ast_categories_write_restrict_update ON ast_categories AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['ast.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['ast.manage']));
DROP POLICY IF EXISTS ast_categories_write_restrict_delete ON ast_categories;
CREATE POLICY ast_categories_write_restrict_delete ON ast_categories AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['ast.manage']));
-- ----------------------------------------------------------------------------
-- Asset Tracking: ast_assignments  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS ast_assignments_write_restrict_insert ON ast_assignments;
CREATE POLICY ast_assignments_write_restrict_insert ON ast_assignments AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['ast.assign','ast.manage']));
DROP POLICY IF EXISTS ast_assignments_write_restrict_update ON ast_assignments;
CREATE POLICY ast_assignments_write_restrict_update ON ast_assignments AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['ast.assign','ast.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['ast.assign','ast.manage']));
DROP POLICY IF EXISTS ast_assignments_write_restrict_delete ON ast_assignments;
CREATE POLICY ast_assignments_write_restrict_delete ON ast_assignments AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['ast.assign','ast.manage']));
-- ----------------------------------------------------------------------------
-- Asset Tracking: ast_locations  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS ast_locations_write_restrict_insert ON ast_locations;
CREATE POLICY ast_locations_write_restrict_insert ON ast_locations AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['ast.manage']));
DROP POLICY IF EXISTS ast_locations_write_restrict_update ON ast_locations;
CREATE POLICY ast_locations_write_restrict_update ON ast_locations AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['ast.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['ast.manage']));
DROP POLICY IF EXISTS ast_locations_write_restrict_delete ON ast_locations;
CREATE POLICY ast_locations_write_restrict_delete ON ast_locations AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['ast.manage']));
-- ----------------------------------------------------------------------------
-- Asset Tracking: ast_documents  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS ast_documents_write_restrict_insert ON ast_documents;
CREATE POLICY ast_documents_write_restrict_insert ON ast_documents AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['ast.manage']));
DROP POLICY IF EXISTS ast_documents_write_restrict_update ON ast_documents;
CREATE POLICY ast_documents_write_restrict_update ON ast_documents AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['ast.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['ast.manage']));
DROP POLICY IF EXISTS ast_documents_write_restrict_delete ON ast_documents;
CREATE POLICY ast_documents_write_restrict_delete ON ast_documents AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['ast.manage']));
-- ----------------------------------------------------------------------------
-- Asset Tracking: ast_identifiers  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS ast_identifiers_write_restrict_insert ON ast_identifiers;
CREATE POLICY ast_identifiers_write_restrict_insert ON ast_identifiers AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['ast.manage']));
DROP POLICY IF EXISTS ast_identifiers_write_restrict_update ON ast_identifiers;
CREATE POLICY ast_identifiers_write_restrict_update ON ast_identifiers AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['ast.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['ast.manage']));
DROP POLICY IF EXISTS ast_identifiers_write_restrict_delete ON ast_identifiers;
CREATE POLICY ast_identifiers_write_restrict_delete ON ast_identifiers AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['ast.manage']));
-- ----------------------------------------------------------------------------
-- Asset Tracking: ast_number_sequences  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS ast_number_sequences_write_restrict_insert ON ast_number_sequences;
CREATE POLICY ast_number_sequences_write_restrict_insert ON ast_number_sequences AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['ast.manage']));
DROP POLICY IF EXISTS ast_number_sequences_write_restrict_update ON ast_number_sequences;
CREATE POLICY ast_number_sequences_write_restrict_update ON ast_number_sequences AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['ast.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['ast.manage']));
DROP POLICY IF EXISTS ast_number_sequences_write_restrict_delete ON ast_number_sequences;
CREATE POLICY ast_number_sequences_write_restrict_delete ON ast_number_sequences AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['ast.manage']));
-- ----------------------------------------------------------------------------
-- Asset Tracking: ast_tag_templates  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS ast_tag_templates_write_restrict_insert ON ast_tag_templates;
CREATE POLICY ast_tag_templates_write_restrict_insert ON ast_tag_templates AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['ast.manage','ast.print']));
DROP POLICY IF EXISTS ast_tag_templates_write_restrict_update ON ast_tag_templates;
CREATE POLICY ast_tag_templates_write_restrict_update ON ast_tag_templates AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['ast.manage','ast.print']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['ast.manage','ast.print']));
DROP POLICY IF EXISTS ast_tag_templates_write_restrict_delete ON ast_tag_templates;
CREATE POLICY ast_tag_templates_write_restrict_delete ON ast_tag_templates AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['ast.manage','ast.print']));
-- ----------------------------------------------------------------------------
-- Asset Tracking: ast_maintenance_links  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS ast_maintenance_links_write_restrict_insert ON ast_maintenance_links;
CREATE POLICY ast_maintenance_links_write_restrict_insert ON ast_maintenance_links AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['ast.manage']));
DROP POLICY IF EXISTS ast_maintenance_links_write_restrict_update ON ast_maintenance_links;
CREATE POLICY ast_maintenance_links_write_restrict_update ON ast_maintenance_links AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['ast.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['ast.manage']));
DROP POLICY IF EXISTS ast_maintenance_links_write_restrict_delete ON ast_maintenance_links;
CREATE POLICY ast_maintenance_links_write_restrict_delete ON ast_maintenance_links AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['ast.manage']));
-- ----------------------------------------------------------------------------
-- Asset Tracking: ast_audits  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS ast_audits_write_restrict_insert ON ast_audits;
CREATE POLICY ast_audits_write_restrict_insert ON ast_audits AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['ast.audit','ast.manage']));
DROP POLICY IF EXISTS ast_audits_write_restrict_update ON ast_audits;
CREATE POLICY ast_audits_write_restrict_update ON ast_audits AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['ast.audit','ast.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['ast.audit','ast.manage']));
DROP POLICY IF EXISTS ast_audits_write_restrict_delete ON ast_audits;
CREATE POLICY ast_audits_write_restrict_delete ON ast_audits AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['ast.audit','ast.manage']));
-- ----------------------------------------------------------------------------
-- Asset Tracking: ast_audit_lines  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS ast_audit_lines_write_restrict_insert ON ast_audit_lines;
CREATE POLICY ast_audit_lines_write_restrict_insert ON ast_audit_lines AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['ast.audit','ast.manage']));
DROP POLICY IF EXISTS ast_audit_lines_write_restrict_update ON ast_audit_lines;
CREATE POLICY ast_audit_lines_write_restrict_update ON ast_audit_lines AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['ast.audit','ast.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['ast.audit','ast.manage']));
DROP POLICY IF EXISTS ast_audit_lines_write_restrict_delete ON ast_audit_lines;
CREATE POLICY ast_audit_lines_write_restrict_delete ON ast_audit_lines AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['ast.audit','ast.manage']));
-- ----------------------------------------------------------------------------
-- Asset Tracking: ast_events  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS ast_events_write_restrict_insert ON ast_events;
CREATE POLICY ast_events_write_restrict_insert ON ast_events AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['ast.assign','ast.manage']));
DROP POLICY IF EXISTS ast_events_write_restrict_update ON ast_events;
CREATE POLICY ast_events_write_restrict_update ON ast_events AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['ast.assign','ast.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['ast.assign','ast.manage']));
DROP POLICY IF EXISTS ast_events_write_restrict_delete ON ast_events;
CREATE POLICY ast_events_write_restrict_delete ON ast_events AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['ast.assign','ast.manage']));
-- ----------------------------------------------------------------------------
-- Asset Tracking: ast_alerts  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS ast_alerts_write_restrict_insert ON ast_alerts;
CREATE POLICY ast_alerts_write_restrict_insert ON ast_alerts AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['ast.manage']));
DROP POLICY IF EXISTS ast_alerts_write_restrict_update ON ast_alerts;
CREATE POLICY ast_alerts_write_restrict_update ON ast_alerts AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['ast.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['ast.manage']));
DROP POLICY IF EXISTS ast_alerts_write_restrict_delete ON ast_alerts;
CREATE POLICY ast_alerts_write_restrict_delete ON ast_alerts AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['ast.manage']));
-- ----------------------------------------------------------------------------
-- Digital Identity: di_org_units  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS di_org_units_write_restrict_insert ON di_org_units;
CREATE POLICY di_org_units_write_restrict_insert ON di_org_units AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['di.org','di.manage']));
DROP POLICY IF EXISTS di_org_units_write_restrict_update ON di_org_units;
CREATE POLICY di_org_units_write_restrict_update ON di_org_units AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['di.org','di.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['di.org','di.manage']));
DROP POLICY IF EXISTS di_org_units_write_restrict_delete ON di_org_units;
CREATE POLICY di_org_units_write_restrict_delete ON di_org_units AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['di.org','di.manage']));
-- ----------------------------------------------------------------------------
-- Digital Identity: di_lifecycle_events  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS di_lifecycle_events_write_restrict_insert ON di_lifecycle_events;
CREATE POLICY di_lifecycle_events_write_restrict_insert ON di_lifecycle_events AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['di.manage','di.admin']));
DROP POLICY IF EXISTS di_lifecycle_events_write_restrict_update ON di_lifecycle_events;
CREATE POLICY di_lifecycle_events_write_restrict_update ON di_lifecycle_events AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['di.manage','di.admin']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['di.manage','di.admin']));
DROP POLICY IF EXISTS di_lifecycle_events_write_restrict_delete ON di_lifecycle_events;
CREATE POLICY di_lifecycle_events_write_restrict_delete ON di_lifecycle_events AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['di.manage','di.admin']));
-- ----------------------------------------------------------------------------
-- Digital Identity: di_provision_templates  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS di_provision_templates_write_restrict_insert ON di_provision_templates;
CREATE POLICY di_provision_templates_write_restrict_insert ON di_provision_templates AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['di.provision','di.manage']));
DROP POLICY IF EXISTS di_provision_templates_write_restrict_update ON di_provision_templates;
CREATE POLICY di_provision_templates_write_restrict_update ON di_provision_templates AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['di.provision','di.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['di.provision','di.manage']));
DROP POLICY IF EXISTS di_provision_templates_write_restrict_delete ON di_provision_templates;
CREATE POLICY di_provision_templates_write_restrict_delete ON di_provision_templates AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['di.provision','di.manage']));
-- ----------------------------------------------------------------------------
-- Digital Identity: di_provision_jobs  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS di_provision_jobs_write_restrict_insert ON di_provision_jobs;
CREATE POLICY di_provision_jobs_write_restrict_insert ON di_provision_jobs AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['di.provision','di.manage']));
DROP POLICY IF EXISTS di_provision_jobs_write_restrict_update ON di_provision_jobs;
CREATE POLICY di_provision_jobs_write_restrict_update ON di_provision_jobs AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['di.provision','di.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['di.provision','di.manage']));
DROP POLICY IF EXISTS di_provision_jobs_write_restrict_delete ON di_provision_jobs;
CREATE POLICY di_provision_jobs_write_restrict_delete ON di_provision_jobs AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['di.provision','di.manage']));
-- ----------------------------------------------------------------------------
-- Digital Identity: di_provision_checklist  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS di_provision_checklist_write_restrict_insert ON di_provision_checklist;
CREATE POLICY di_provision_checklist_write_restrict_insert ON di_provision_checklist AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['di.provision','di.manage']));
DROP POLICY IF EXISTS di_provision_checklist_write_restrict_update ON di_provision_checklist;
CREATE POLICY di_provision_checklist_write_restrict_update ON di_provision_checklist AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['di.provision','di.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['di.provision','di.manage']));
DROP POLICY IF EXISTS di_provision_checklist_write_restrict_delete ON di_provision_checklist;
CREATE POLICY di_provision_checklist_write_restrict_delete ON di_provision_checklist AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['di.provision','di.manage']));
-- ----------------------------------------------------------------------------
-- Digital Identity: di_job_sequences  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS di_job_sequences_write_restrict_insert ON di_job_sequences;
CREATE POLICY di_job_sequences_write_restrict_insert ON di_job_sequences AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['di.provision','di.manage']));
DROP POLICY IF EXISTS di_job_sequences_write_restrict_update ON di_job_sequences;
CREATE POLICY di_job_sequences_write_restrict_update ON di_job_sequences AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['di.provision','di.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['di.provision','di.manage']));
DROP POLICY IF EXISTS di_job_sequences_write_restrict_delete ON di_job_sequences;
CREATE POLICY di_job_sequences_write_restrict_delete ON di_job_sequences AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['di.provision','di.manage']));
-- ----------------------------------------------------------------------------
-- Digital Identity: di_sync_rules  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS di_sync_rules_write_restrict_insert ON di_sync_rules;
CREATE POLICY di_sync_rules_write_restrict_insert ON di_sync_rules AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['di.manage','di.admin']));
DROP POLICY IF EXISTS di_sync_rules_write_restrict_update ON di_sync_rules;
CREATE POLICY di_sync_rules_write_restrict_update ON di_sync_rules AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['di.manage','di.admin']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['di.manage','di.admin']));
DROP POLICY IF EXISTS di_sync_rules_write_restrict_delete ON di_sync_rules;
CREATE POLICY di_sync_rules_write_restrict_delete ON di_sync_rules AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['di.manage','di.admin']));
-- ----------------------------------------------------------------------------
-- Digital Identity: di_clearance_assignments  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS di_clearance_assignments_write_restrict_insert ON di_clearance_assignments;
CREATE POLICY di_clearance_assignments_write_restrict_insert ON di_clearance_assignments AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['di.clearance','di.manage']));
DROP POLICY IF EXISTS di_clearance_assignments_write_restrict_update ON di_clearance_assignments;
CREATE POLICY di_clearance_assignments_write_restrict_update ON di_clearance_assignments AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['di.clearance','di.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['di.clearance','di.manage']));
DROP POLICY IF EXISTS di_clearance_assignments_write_restrict_delete ON di_clearance_assignments;
CREATE POLICY di_clearance_assignments_write_restrict_delete ON di_clearance_assignments AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['di.clearance','di.manage']));
-- ----------------------------------------------------------------------------
-- Digital Identity: di_clearance_matrix  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS di_clearance_matrix_write_restrict_insert ON di_clearance_matrix;
CREATE POLICY di_clearance_matrix_write_restrict_insert ON di_clearance_matrix AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['di.clearance','di.manage']));
DROP POLICY IF EXISTS di_clearance_matrix_write_restrict_update ON di_clearance_matrix;
CREATE POLICY di_clearance_matrix_write_restrict_update ON di_clearance_matrix AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['di.clearance','di.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['di.clearance','di.manage']));
DROP POLICY IF EXISTS di_clearance_matrix_write_restrict_delete ON di_clearance_matrix;
CREATE POLICY di_clearance_matrix_write_restrict_delete ON di_clearance_matrix AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['di.clearance','di.manage']));
-- ----------------------------------------------------------------------------
-- Digital Identity: di_id_card_templates  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS di_id_card_templates_write_restrict_insert ON di_id_card_templates;
CREATE POLICY di_id_card_templates_write_restrict_insert ON di_id_card_templates AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['di.cards','di.manage']));
DROP POLICY IF EXISTS di_id_card_templates_write_restrict_update ON di_id_card_templates;
CREATE POLICY di_id_card_templates_write_restrict_update ON di_id_card_templates AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['di.cards','di.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['di.cards','di.manage']));
DROP POLICY IF EXISTS di_id_card_templates_write_restrict_delete ON di_id_card_templates;
CREATE POLICY di_id_card_templates_write_restrict_delete ON di_id_card_templates AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['di.cards','di.manage']));
-- ----------------------------------------------------------------------------
-- Digital Identity: di_id_cards  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS di_id_cards_write_restrict_insert ON di_id_cards;
CREATE POLICY di_id_cards_write_restrict_insert ON di_id_cards AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['di.cards','di.manage']));
DROP POLICY IF EXISTS di_id_cards_write_restrict_update ON di_id_cards;
CREATE POLICY di_id_cards_write_restrict_update ON di_id_cards AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['di.cards','di.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['di.cards','di.manage']));
DROP POLICY IF EXISTS di_id_cards_write_restrict_delete ON di_id_cards;
CREATE POLICY di_id_cards_write_restrict_delete ON di_id_cards AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['di.cards','di.manage']));
-- ----------------------------------------------------------------------------
-- Digital Identity: di_biometric_profiles  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS di_biometric_profiles_write_restrict_insert ON di_biometric_profiles;
CREATE POLICY di_biometric_profiles_write_restrict_insert ON di_biometric_profiles AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['di.biometrics','di.manage']));
DROP POLICY IF EXISTS di_biometric_profiles_write_restrict_update ON di_biometric_profiles;
CREATE POLICY di_biometric_profiles_write_restrict_update ON di_biometric_profiles AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['di.biometrics','di.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['di.biometrics','di.manage']));
DROP POLICY IF EXISTS di_biometric_profiles_write_restrict_delete ON di_biometric_profiles;
CREATE POLICY di_biometric_profiles_write_restrict_delete ON di_biometric_profiles AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['di.biometrics','di.manage']));
-- ----------------------------------------------------------------------------
-- Digital Identity: di_biometric_devices  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS di_biometric_devices_write_restrict_insert ON di_biometric_devices;
CREATE POLICY di_biometric_devices_write_restrict_insert ON di_biometric_devices AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['di.biometrics','di.manage','di.admin']));
DROP POLICY IF EXISTS di_biometric_devices_write_restrict_update ON di_biometric_devices;
CREATE POLICY di_biometric_devices_write_restrict_update ON di_biometric_devices AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['di.biometrics','di.manage','di.admin']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['di.biometrics','di.manage','di.admin']));
DROP POLICY IF EXISTS di_biometric_devices_write_restrict_delete ON di_biometric_devices;
CREATE POLICY di_biometric_devices_write_restrict_delete ON di_biometric_devices AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['di.biometrics','di.manage','di.admin']));
-- ----------------------------------------------------------------------------
-- Digital Identity: di_document_vault  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS di_document_vault_write_restrict_insert ON di_document_vault;
CREATE POLICY di_document_vault_write_restrict_insert ON di_document_vault AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['di.manage','di.admin']));
DROP POLICY IF EXISTS di_document_vault_write_restrict_update ON di_document_vault;
CREATE POLICY di_document_vault_write_restrict_update ON di_document_vault AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['di.manage','di.admin']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['di.manage','di.admin']));
DROP POLICY IF EXISTS di_document_vault_write_restrict_delete ON di_document_vault;
CREATE POLICY di_document_vault_write_restrict_delete ON di_document_vault AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['di.manage','di.admin']));
-- ----------------------------------------------------------------------------
-- Digital Identity: di_asset_assignments  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS di_asset_assignments_write_restrict_insert ON di_asset_assignments;
CREATE POLICY di_asset_assignments_write_restrict_insert ON di_asset_assignments AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['di.manage','di.admin']));
DROP POLICY IF EXISTS di_asset_assignments_write_restrict_update ON di_asset_assignments;
CREATE POLICY di_asset_assignments_write_restrict_update ON di_asset_assignments AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['di.manage','di.admin']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['di.manage','di.admin']));
DROP POLICY IF EXISTS di_asset_assignments_write_restrict_delete ON di_asset_assignments;
CREATE POLICY di_asset_assignments_write_restrict_delete ON di_asset_assignments AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['di.manage','di.admin']));
-- ----------------------------------------------------------------------------
-- Digital Identity: di_approval_routes  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS di_approval_routes_write_restrict_insert ON di_approval_routes;
CREATE POLICY di_approval_routes_write_restrict_insert ON di_approval_routes AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['di.manage','di.admin','workflow.manage']));
DROP POLICY IF EXISTS di_approval_routes_write_restrict_update ON di_approval_routes;
CREATE POLICY di_approval_routes_write_restrict_update ON di_approval_routes AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['di.manage','di.admin','workflow.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['di.manage','di.admin','workflow.manage']));
DROP POLICY IF EXISTS di_approval_routes_write_restrict_delete ON di_approval_routes;
CREATE POLICY di_approval_routes_write_restrict_delete ON di_approval_routes AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['di.manage','di.admin','workflow.manage']));
-- ----------------------------------------------------------------------------
-- Underwriting: uw_persons  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS uw_persons_write_restrict_insert ON uw_persons;
CREATE POLICY uw_persons_write_restrict_insert ON uw_persons AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['uw.manage','uw.admin','hr.manage']));
DROP POLICY IF EXISTS uw_persons_write_restrict_update ON uw_persons;
CREATE POLICY uw_persons_write_restrict_update ON uw_persons AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['uw.manage','uw.admin','hr.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['uw.manage','uw.admin','hr.manage']));
DROP POLICY IF EXISTS uw_persons_write_restrict_delete ON uw_persons;
CREATE POLICY uw_persons_write_restrict_delete ON uw_persons AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['uw.manage','uw.admin','hr.manage']));
-- ----------------------------------------------------------------------------
-- Underwriting: uw_person_links  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS uw_person_links_write_restrict_insert ON uw_person_links;
CREATE POLICY uw_person_links_write_restrict_insert ON uw_person_links AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['uw.manage','uw.admin']));
DROP POLICY IF EXISTS uw_person_links_write_restrict_update ON uw_person_links;
CREATE POLICY uw_person_links_write_restrict_update ON uw_person_links AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['uw.manage','uw.admin']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['uw.manage','uw.admin']));
DROP POLICY IF EXISTS uw_person_links_write_restrict_delete ON uw_person_links;
CREATE POLICY uw_person_links_write_restrict_delete ON uw_person_links AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['uw.manage','uw.admin']));
-- ----------------------------------------------------------------------------
-- Underwriting: uw_module_entitlements  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS uw_module_entitlements_write_restrict_insert ON uw_module_entitlements;
CREATE POLICY uw_module_entitlements_write_restrict_insert ON uw_module_entitlements AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['uw.manage','uw.admin']));
DROP POLICY IF EXISTS uw_module_entitlements_write_restrict_update ON uw_module_entitlements;
CREATE POLICY uw_module_entitlements_write_restrict_update ON uw_module_entitlements AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['uw.manage','uw.admin']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['uw.manage','uw.admin']));
DROP POLICY IF EXISTS uw_module_entitlements_write_restrict_delete ON uw_module_entitlements;
CREATE POLICY uw_module_entitlements_write_restrict_delete ON uw_module_entitlements AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['uw.manage','uw.admin']));
-- ----------------------------------------------------------------------------
-- Underwriting: uw_identity_events  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS uw_identity_events_write_restrict_insert ON uw_identity_events;
CREATE POLICY uw_identity_events_write_restrict_insert ON uw_identity_events AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['uw.manage','uw.admin','iam.manage']));
DROP POLICY IF EXISTS uw_identity_events_write_restrict_update ON uw_identity_events;
CREATE POLICY uw_identity_events_write_restrict_update ON uw_identity_events AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['uw.manage','uw.admin','iam.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['uw.manage','uw.admin','iam.manage']));
DROP POLICY IF EXISTS uw_identity_events_write_restrict_delete ON uw_identity_events;
CREATE POLICY uw_identity_events_write_restrict_delete ON uw_identity_events AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['uw.manage','uw.admin','iam.manage']));
-- ----------------------------------------------------------------------------
-- Underwriting: uw_upid_sequences  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS uw_upid_sequences_write_restrict_insert ON uw_upid_sequences;
CREATE POLICY uw_upid_sequences_write_restrict_insert ON uw_upid_sequences AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['uw.manage','uw.admin']));
DROP POLICY IF EXISTS uw_upid_sequences_write_restrict_update ON uw_upid_sequences;
CREATE POLICY uw_upid_sequences_write_restrict_update ON uw_upid_sequences AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['uw.manage','uw.admin']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['uw.manage','uw.admin']));
DROP POLICY IF EXISTS uw_upid_sequences_write_restrict_delete ON uw_upid_sequences;
CREATE POLICY uw_upid_sequences_write_restrict_delete ON uw_upid_sequences AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['uw.manage','uw.admin']));
-- ----------------------------------------------------------------------------
-- Underwriting: uw_merge_log  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS uw_merge_log_write_restrict_insert ON uw_merge_log;
CREATE POLICY uw_merge_log_write_restrict_insert ON uw_merge_log AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['uw.merge','uw.admin']));
DROP POLICY IF EXISTS uw_merge_log_write_restrict_update ON uw_merge_log;
CREATE POLICY uw_merge_log_write_restrict_update ON uw_merge_log AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['uw.merge','uw.admin']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['uw.merge','uw.admin']));
DROP POLICY IF EXISTS uw_merge_log_write_restrict_delete ON uw_merge_log;
CREATE POLICY uw_merge_log_write_restrict_delete ON uw_merge_log AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['uw.merge','uw.admin']));
-- ----------------------------------------------------------------------------
-- Supplier Relationship Management: srm_categories  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS srm_categories_write_restrict_insert ON srm_categories;
CREATE POLICY srm_categories_write_restrict_insert ON srm_categories AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['srm.manage']));
DROP POLICY IF EXISTS srm_categories_write_restrict_update ON srm_categories;
CREATE POLICY srm_categories_write_restrict_update ON srm_categories AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['srm.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['srm.manage']));
DROP POLICY IF EXISTS srm_categories_write_restrict_delete ON srm_categories;
CREATE POLICY srm_categories_write_restrict_delete ON srm_categories AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['srm.manage']));
-- ----------------------------------------------------------------------------
-- Supplier Relationship Management: srm_contacts  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS srm_contacts_write_restrict_insert ON srm_contacts;
CREATE POLICY srm_contacts_write_restrict_insert ON srm_contacts AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['srm.manage','procurement.manage']));
DROP POLICY IF EXISTS srm_contacts_write_restrict_update ON srm_contacts;
CREATE POLICY srm_contacts_write_restrict_update ON srm_contacts AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['srm.manage','procurement.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['srm.manage','procurement.manage']));
DROP POLICY IF EXISTS srm_contacts_write_restrict_delete ON srm_contacts;
CREATE POLICY srm_contacts_write_restrict_delete ON srm_contacts AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['srm.manage','procurement.manage']));
-- ----------------------------------------------------------------------------
-- Supplier Relationship Management: srm_onboarding  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS srm_onboarding_write_restrict_insert ON srm_onboarding;
CREATE POLICY srm_onboarding_write_restrict_insert ON srm_onboarding AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['srm.manage','srm.admin']));
DROP POLICY IF EXISTS srm_onboarding_write_restrict_update ON srm_onboarding;
CREATE POLICY srm_onboarding_write_restrict_update ON srm_onboarding AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['srm.manage','srm.admin']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['srm.manage','srm.admin']));
DROP POLICY IF EXISTS srm_onboarding_write_restrict_delete ON srm_onboarding;
CREATE POLICY srm_onboarding_write_restrict_delete ON srm_onboarding AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['srm.manage','srm.admin']));
-- ----------------------------------------------------------------------------
-- Supplier Relationship Management: srm_documents  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS srm_documents_write_restrict_insert ON srm_documents;
CREATE POLICY srm_documents_write_restrict_insert ON srm_documents AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['srm.manage','srm.contracts']));
DROP POLICY IF EXISTS srm_documents_write_restrict_update ON srm_documents;
CREATE POLICY srm_documents_write_restrict_update ON srm_documents AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['srm.manage','srm.contracts']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['srm.manage','srm.contracts']));
DROP POLICY IF EXISTS srm_documents_write_restrict_delete ON srm_documents;
CREATE POLICY srm_documents_write_restrict_delete ON srm_documents AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['srm.manage','srm.contracts']));
-- ----------------------------------------------------------------------------
-- Supplier Relationship Management: srm_timeline  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS srm_timeline_write_restrict_insert ON srm_timeline;
CREATE POLICY srm_timeline_write_restrict_insert ON srm_timeline AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['srm.manage']));
DROP POLICY IF EXISTS srm_timeline_write_restrict_update ON srm_timeline;
CREATE POLICY srm_timeline_write_restrict_update ON srm_timeline AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['srm.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['srm.manage']));
DROP POLICY IF EXISTS srm_timeline_write_restrict_delete ON srm_timeline;
CREATE POLICY srm_timeline_write_restrict_delete ON srm_timeline AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['srm.manage']));
-- ----------------------------------------------------------------------------
-- Supplier Relationship Management: srm_quality_inspections  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS srm_quality_inspections_write_restrict_insert ON srm_quality_inspections;
CREATE POLICY srm_quality_inspections_write_restrict_insert ON srm_quality_inspections AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['srm.quality','srm.manage']));
DROP POLICY IF EXISTS srm_quality_inspections_write_restrict_update ON srm_quality_inspections;
CREATE POLICY srm_quality_inspections_write_restrict_update ON srm_quality_inspections AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['srm.quality','srm.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['srm.quality','srm.manage']));
DROP POLICY IF EXISTS srm_quality_inspections_write_restrict_delete ON srm_quality_inspections;
CREATE POLICY srm_quality_inspections_write_restrict_delete ON srm_quality_inspections AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['srm.quality','srm.manage']));
-- ----------------------------------------------------------------------------
-- Supplier Relationship Management: srm_ncrs  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS srm_ncrs_write_restrict_insert ON srm_ncrs;
CREATE POLICY srm_ncrs_write_restrict_insert ON srm_ncrs AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['srm.quality','srm.manage']));
DROP POLICY IF EXISTS srm_ncrs_write_restrict_update ON srm_ncrs;
CREATE POLICY srm_ncrs_write_restrict_update ON srm_ncrs AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['srm.quality','srm.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['srm.quality','srm.manage']));
DROP POLICY IF EXISTS srm_ncrs_write_restrict_delete ON srm_ncrs;
CREATE POLICY srm_ncrs_write_restrict_delete ON srm_ncrs AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['srm.quality','srm.manage']));
-- ----------------------------------------------------------------------------
-- Supplier Relationship Management: srm_scorecards  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS srm_scorecards_write_restrict_insert ON srm_scorecards;
CREATE POLICY srm_scorecards_write_restrict_insert ON srm_scorecards AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['srm.manage','srm.admin']));
DROP POLICY IF EXISTS srm_scorecards_write_restrict_update ON srm_scorecards;
CREATE POLICY srm_scorecards_write_restrict_update ON srm_scorecards AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['srm.manage','srm.admin']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['srm.manage','srm.admin']));
DROP POLICY IF EXISTS srm_scorecards_write_restrict_delete ON srm_scorecards;
CREATE POLICY srm_scorecards_write_restrict_delete ON srm_scorecards AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['srm.manage','srm.admin']));
-- ----------------------------------------------------------------------------
-- Supplier Relationship Management: srm_risks  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS srm_risks_write_restrict_insert ON srm_risks;
CREATE POLICY srm_risks_write_restrict_insert ON srm_risks AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['srm.manage','srm.admin','scm.risk']));
DROP POLICY IF EXISTS srm_risks_write_restrict_update ON srm_risks;
CREATE POLICY srm_risks_write_restrict_update ON srm_risks AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['srm.manage','srm.admin','scm.risk']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['srm.manage','srm.admin','scm.risk']));
DROP POLICY IF EXISTS srm_risks_write_restrict_delete ON srm_risks;
CREATE POLICY srm_risks_write_restrict_delete ON srm_risks AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['srm.manage','srm.admin','scm.risk']));
-- ----------------------------------------------------------------------------
-- Supplier Relationship Management: srm_communications  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS srm_communications_write_restrict_insert ON srm_communications;
CREATE POLICY srm_communications_write_restrict_insert ON srm_communications AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['srm.manage','comm.manage']));
DROP POLICY IF EXISTS srm_communications_write_restrict_update ON srm_communications;
CREATE POLICY srm_communications_write_restrict_update ON srm_communications AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['srm.manage','comm.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['srm.manage','comm.manage']));
DROP POLICY IF EXISTS srm_communications_write_restrict_delete ON srm_communications;
CREATE POLICY srm_communications_write_restrict_delete ON srm_communications AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['srm.manage','comm.manage']));
-- ----------------------------------------------------------------------------
-- Supplier Relationship Management: srm_portal_requests  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS srm_portal_requests_write_restrict_insert ON srm_portal_requests;
CREATE POLICY srm_portal_requests_write_restrict_insert ON srm_portal_requests AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['srm.portal','srm.manage']));
DROP POLICY IF EXISTS srm_portal_requests_write_restrict_update ON srm_portal_requests;
CREATE POLICY srm_portal_requests_write_restrict_update ON srm_portal_requests AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['srm.portal','srm.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['srm.portal','srm.manage']));
DROP POLICY IF EXISTS srm_portal_requests_write_restrict_delete ON srm_portal_requests;
CREATE POLICY srm_portal_requests_write_restrict_delete ON srm_portal_requests AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['srm.portal','srm.manage']));
-- ----------------------------------------------------------------------------
-- Supplier Relationship Management: srm_rfq_evaluations  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS srm_rfq_evaluations_write_restrict_insert ON srm_rfq_evaluations;
CREATE POLICY srm_rfq_evaluations_write_restrict_insert ON srm_rfq_evaluations AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['srm.manage','procurement.manage']));
DROP POLICY IF EXISTS srm_rfq_evaluations_write_restrict_update ON srm_rfq_evaluations;
CREATE POLICY srm_rfq_evaluations_write_restrict_update ON srm_rfq_evaluations AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['srm.manage','procurement.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['srm.manage','procurement.manage']));
DROP POLICY IF EXISTS srm_rfq_evaluations_write_restrict_delete ON srm_rfq_evaluations;
CREATE POLICY srm_rfq_evaluations_write_restrict_delete ON srm_rfq_evaluations AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['srm.manage','procurement.manage']));
-- ----------------------------------------------------------------------------
-- Supplier Relationship Management: srm_match_logs  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS srm_match_logs_write_restrict_insert ON srm_match_logs;
CREATE POLICY srm_match_logs_write_restrict_insert ON srm_match_logs AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['srm.manage','srm.admin']));
DROP POLICY IF EXISTS srm_match_logs_write_restrict_update ON srm_match_logs;
CREATE POLICY srm_match_logs_write_restrict_update ON srm_match_logs AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['srm.manage','srm.admin']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['srm.manage','srm.admin']));
DROP POLICY IF EXISTS srm_match_logs_write_restrict_delete ON srm_match_logs;
CREATE POLICY srm_match_logs_write_restrict_delete ON srm_match_logs AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['srm.manage','srm.admin']));
-- ----------------------------------------------------------------------------
-- Supplier Relationship Management: srm_registry_items  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS srm_registry_items_write_restrict_insert ON srm_registry_items;
CREATE POLICY srm_registry_items_write_restrict_insert ON srm_registry_items AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['srm.manage','srm.admin']));
DROP POLICY IF EXISTS srm_registry_items_write_restrict_update ON srm_registry_items;
CREATE POLICY srm_registry_items_write_restrict_update ON srm_registry_items AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['srm.manage','srm.admin']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['srm.manage','srm.admin']));
DROP POLICY IF EXISTS srm_registry_items_write_restrict_delete ON srm_registry_items;
CREATE POLICY srm_registry_items_write_restrict_delete ON srm_registry_items AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['srm.manage','srm.admin']));
-- ----------------------------------------------------------------------------
-- Supplier Relationship Management: srm_registry_approvals  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS srm_registry_approvals_write_restrict_insert ON srm_registry_approvals;
CREATE POLICY srm_registry_approvals_write_restrict_insert ON srm_registry_approvals AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['srm.manage','srm.approve']));
DROP POLICY IF EXISTS srm_registry_approvals_write_restrict_update ON srm_registry_approvals;
CREATE POLICY srm_registry_approvals_write_restrict_update ON srm_registry_approvals AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['srm.manage','srm.approve']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['srm.manage','srm.approve']));
DROP POLICY IF EXISTS srm_registry_approvals_write_restrict_delete ON srm_registry_approvals;
CREATE POLICY srm_registry_approvals_write_restrict_delete ON srm_registry_approvals AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['srm.manage','srm.approve']));
-- ----------------------------------------------------------------------------
-- Supplier Relationship Management: srm_material_lots  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS srm_material_lots_write_restrict_insert ON srm_material_lots;
CREATE POLICY srm_material_lots_write_restrict_insert ON srm_material_lots AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['srm.manage','inventory.manage']));
DROP POLICY IF EXISTS srm_material_lots_write_restrict_update ON srm_material_lots;
CREATE POLICY srm_material_lots_write_restrict_update ON srm_material_lots AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['srm.manage','inventory.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['srm.manage','inventory.manage']));
DROP POLICY IF EXISTS srm_material_lots_write_restrict_delete ON srm_material_lots;
CREATE POLICY srm_material_lots_write_restrict_delete ON srm_material_lots AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['srm.manage','inventory.manage']));
-- ----------------------------------------------------------------------------
-- Supplier Relationship Management: srm_trace_links  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS srm_trace_links_write_restrict_insert ON srm_trace_links;
CREATE POLICY srm_trace_links_write_restrict_insert ON srm_trace_links AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['srm.manage','srm.admin']));
DROP POLICY IF EXISTS srm_trace_links_write_restrict_update ON srm_trace_links;
CREATE POLICY srm_trace_links_write_restrict_update ON srm_trace_links AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['srm.manage','srm.admin']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['srm.manage','srm.admin']));
DROP POLICY IF EXISTS srm_trace_links_write_restrict_delete ON srm_trace_links;
CREATE POLICY srm_trace_links_write_restrict_delete ON srm_trace_links AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['srm.manage','srm.admin']));
-- ----------------------------------------------------------------------------
-- Supplier Relationship Management: srm_compliance_items  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS srm_compliance_items_write_restrict_insert ON srm_compliance_items;
CREATE POLICY srm_compliance_items_write_restrict_insert ON srm_compliance_items AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['srm.manage','srm.admin','scm.risk']));
DROP POLICY IF EXISTS srm_compliance_items_write_restrict_update ON srm_compliance_items;
CREATE POLICY srm_compliance_items_write_restrict_update ON srm_compliance_items AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['srm.manage','srm.admin','scm.risk']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['srm.manage','srm.admin','scm.risk']));
DROP POLICY IF EXISTS srm_compliance_items_write_restrict_delete ON srm_compliance_items;
CREATE POLICY srm_compliance_items_write_restrict_delete ON srm_compliance_items AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['srm.manage','srm.admin','scm.risk']));
-- ----------------------------------------------------------------------------
-- Supplier Relationship Management: srm_demand_forecasts  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS srm_demand_forecasts_write_restrict_insert ON srm_demand_forecasts;
CREATE POLICY srm_demand_forecasts_write_restrict_insert ON srm_demand_forecasts AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['srm.manage','sales.forecast']));
DROP POLICY IF EXISTS srm_demand_forecasts_write_restrict_update ON srm_demand_forecasts;
CREATE POLICY srm_demand_forecasts_write_restrict_update ON srm_demand_forecasts AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['srm.manage','sales.forecast']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['srm.manage','sales.forecast']));
DROP POLICY IF EXISTS srm_demand_forecasts_write_restrict_delete ON srm_demand_forecasts;
CREATE POLICY srm_demand_forecasts_write_restrict_delete ON srm_demand_forecasts AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['srm.manage','sales.forecast']));
-- ----------------------------------------------------------------------------
-- Supplier Relationship Management: srm_capacity_confirmations  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS srm_capacity_confirmations_write_restrict_insert ON srm_capacity_confirmations;
CREATE POLICY srm_capacity_confirmations_write_restrict_insert ON srm_capacity_confirmations AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['srm.manage','srm.portal']));
DROP POLICY IF EXISTS srm_capacity_confirmations_write_restrict_update ON srm_capacity_confirmations;
CREATE POLICY srm_capacity_confirmations_write_restrict_update ON srm_capacity_confirmations AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['srm.manage','srm.portal']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['srm.manage','srm.portal']));
DROP POLICY IF EXISTS srm_capacity_confirmations_write_restrict_delete ON srm_capacity_confirmations;
CREATE POLICY srm_capacity_confirmations_write_restrict_delete ON srm_capacity_confirmations AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['srm.manage','srm.portal']));
-- ----------------------------------------------------------------------------
-- Supplier Relationship Management: srm_delivery_slots  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS srm_delivery_slots_write_restrict_insert ON srm_delivery_slots;
CREATE POLICY srm_delivery_slots_write_restrict_insert ON srm_delivery_slots AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['srm.manage','srm.portal','dispatch.manage']));
DROP POLICY IF EXISTS srm_delivery_slots_write_restrict_update ON srm_delivery_slots;
CREATE POLICY srm_delivery_slots_write_restrict_update ON srm_delivery_slots AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['srm.manage','srm.portal','dispatch.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['srm.manage','srm.portal','dispatch.manage']));
DROP POLICY IF EXISTS srm_delivery_slots_write_restrict_delete ON srm_delivery_slots;
CREATE POLICY srm_delivery_slots_write_restrict_delete ON srm_delivery_slots AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['srm.manage','srm.portal','dispatch.manage']));
-- ----------------------------------------------------------------------------
-- Supplier Relationship Management: srm_collab_documents  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS srm_collab_documents_write_restrict_insert ON srm_collab_documents;
CREATE POLICY srm_collab_documents_write_restrict_insert ON srm_collab_documents AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['srm.manage','srm.contracts']));
DROP POLICY IF EXISTS srm_collab_documents_write_restrict_update ON srm_collab_documents;
CREATE POLICY srm_collab_documents_write_restrict_update ON srm_collab_documents AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['srm.manage','srm.contracts']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['srm.manage','srm.contracts']));
DROP POLICY IF EXISTS srm_collab_documents_write_restrict_delete ON srm_collab_documents;
CREATE POLICY srm_collab_documents_write_restrict_delete ON srm_collab_documents AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['srm.manage','srm.contracts']));
-- ----------------------------------------------------------------------------
-- Supplier Relationship Management: srm_procurement_savings  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS srm_procurement_savings_write_restrict_insert ON srm_procurement_savings;
CREATE POLICY srm_procurement_savings_write_restrict_insert ON srm_procurement_savings AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['srm.manage','procurement.manage']));
DROP POLICY IF EXISTS srm_procurement_savings_write_restrict_update ON srm_procurement_savings;
CREATE POLICY srm_procurement_savings_write_restrict_update ON srm_procurement_savings AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['srm.manage','procurement.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['srm.manage','procurement.manage']));
DROP POLICY IF EXISTS srm_procurement_savings_write_restrict_delete ON srm_procurement_savings;
CREATE POLICY srm_procurement_savings_write_restrict_delete ON srm_procurement_savings AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['srm.manage','procurement.manage']));
-- ----------------------------------------------------------------------------
-- Business Intelligence / Reporting: bi_dashboards  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS bi_dashboards_write_restrict_insert ON bi_dashboards;
CREATE POLICY bi_dashboards_write_restrict_insert ON bi_dashboards AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['reports.dashboards','reports.manage']));
DROP POLICY IF EXISTS bi_dashboards_write_restrict_update ON bi_dashboards;
CREATE POLICY bi_dashboards_write_restrict_update ON bi_dashboards AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['reports.dashboards','reports.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['reports.dashboards','reports.manage']));
DROP POLICY IF EXISTS bi_dashboards_write_restrict_delete ON bi_dashboards;
CREATE POLICY bi_dashboards_write_restrict_delete ON bi_dashboards AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['reports.dashboards','reports.manage']));
-- ----------------------------------------------------------------------------
-- Business Intelligence / Reporting: bi_dashboard_widgets  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS bi_dashboard_widgets_write_restrict_insert ON bi_dashboard_widgets;
CREATE POLICY bi_dashboard_widgets_write_restrict_insert ON bi_dashboard_widgets AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['reports.dashboards','reports.manage']));
DROP POLICY IF EXISTS bi_dashboard_widgets_write_restrict_update ON bi_dashboard_widgets;
CREATE POLICY bi_dashboard_widgets_write_restrict_update ON bi_dashboard_widgets AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['reports.dashboards','reports.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['reports.dashboards','reports.manage']));
DROP POLICY IF EXISTS bi_dashboard_widgets_write_restrict_delete ON bi_dashboard_widgets;
CREATE POLICY bi_dashboard_widgets_write_restrict_delete ON bi_dashboard_widgets AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['reports.dashboards','reports.manage']));
-- ----------------------------------------------------------------------------
-- Business Intelligence / Reporting: bi_kpis  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS bi_kpis_write_restrict_insert ON bi_kpis;
CREATE POLICY bi_kpis_write_restrict_insert ON bi_kpis AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['reports.kpis','reports.manage']));
DROP POLICY IF EXISTS bi_kpis_write_restrict_update ON bi_kpis;
CREATE POLICY bi_kpis_write_restrict_update ON bi_kpis AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['reports.kpis','reports.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['reports.kpis','reports.manage']));
DROP POLICY IF EXISTS bi_kpis_write_restrict_delete ON bi_kpis;
CREATE POLICY bi_kpis_write_restrict_delete ON bi_kpis AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['reports.kpis','reports.manage']));
-- ----------------------------------------------------------------------------
-- Business Intelligence / Reporting: bi_kpi_snapshots  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS bi_kpi_snapshots_write_restrict_insert ON bi_kpi_snapshots;
CREATE POLICY bi_kpi_snapshots_write_restrict_insert ON bi_kpi_snapshots AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['reports.kpis','reports.manage']));
DROP POLICY IF EXISTS bi_kpi_snapshots_write_restrict_update ON bi_kpi_snapshots;
CREATE POLICY bi_kpi_snapshots_write_restrict_update ON bi_kpi_snapshots AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['reports.kpis','reports.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['reports.kpis','reports.manage']));
DROP POLICY IF EXISTS bi_kpi_snapshots_write_restrict_delete ON bi_kpi_snapshots;
CREATE POLICY bi_kpi_snapshots_write_restrict_delete ON bi_kpi_snapshots AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['reports.kpis','reports.manage']));
-- ----------------------------------------------------------------------------
-- Business Intelligence / Reporting: bi_report_definitions  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS bi_report_definitions_write_restrict_insert ON bi_report_definitions;
CREATE POLICY bi_report_definitions_write_restrict_insert ON bi_report_definitions AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['reports.manage','reports.export']));
DROP POLICY IF EXISTS bi_report_definitions_write_restrict_update ON bi_report_definitions;
CREATE POLICY bi_report_definitions_write_restrict_update ON bi_report_definitions AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['reports.manage','reports.export']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['reports.manage','reports.export']));
DROP POLICY IF EXISTS bi_report_definitions_write_restrict_delete ON bi_report_definitions;
CREATE POLICY bi_report_definitions_write_restrict_delete ON bi_report_definitions AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['reports.manage','reports.export']));
-- ----------------------------------------------------------------------------
-- Business Intelligence / Reporting: bi_report_runs  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS bi_report_runs_write_restrict_insert ON bi_report_runs;
CREATE POLICY bi_report_runs_write_restrict_insert ON bi_report_runs AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['reports.manage','reports.export']));
DROP POLICY IF EXISTS bi_report_runs_write_restrict_update ON bi_report_runs;
CREATE POLICY bi_report_runs_write_restrict_update ON bi_report_runs AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['reports.manage','reports.export']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['reports.manage','reports.export']));
DROP POLICY IF EXISTS bi_report_runs_write_restrict_delete ON bi_report_runs;
CREATE POLICY bi_report_runs_write_restrict_delete ON bi_report_runs AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['reports.manage','reports.export']));
-- ----------------------------------------------------------------------------
-- Business Intelligence / Reporting: bi_report_schedules  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS bi_report_schedules_write_restrict_insert ON bi_report_schedules;
CREATE POLICY bi_report_schedules_write_restrict_insert ON bi_report_schedules AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['reports.schedule','reports.manage']));
DROP POLICY IF EXISTS bi_report_schedules_write_restrict_update ON bi_report_schedules;
CREATE POLICY bi_report_schedules_write_restrict_update ON bi_report_schedules AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['reports.schedule','reports.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['reports.schedule','reports.manage']));
DROP POLICY IF EXISTS bi_report_schedules_write_restrict_delete ON bi_report_schedules;
CREATE POLICY bi_report_schedules_write_restrict_delete ON bi_report_schedules AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['reports.schedule','reports.manage']));
-- ----------------------------------------------------------------------------
-- Business Intelligence / Reporting: bi_report_shares  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS bi_report_shares_write_restrict_insert ON bi_report_shares;
CREATE POLICY bi_report_shares_write_restrict_insert ON bi_report_shares AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['reports.manage','reports.export']));
DROP POLICY IF EXISTS bi_report_shares_write_restrict_update ON bi_report_shares;
CREATE POLICY bi_report_shares_write_restrict_update ON bi_report_shares AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['reports.manage','reports.export']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['reports.manage','reports.export']));
DROP POLICY IF EXISTS bi_report_shares_write_restrict_delete ON bi_report_shares;
CREATE POLICY bi_report_shares_write_restrict_delete ON bi_report_shares AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['reports.manage','reports.export']));
-- ----------------------------------------------------------------------------
-- Business Intelligence / Reporting: bi_report_approvals  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS bi_report_approvals_write_restrict_insert ON bi_report_approvals;
CREATE POLICY bi_report_approvals_write_restrict_insert ON bi_report_approvals AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['reports.manage','reports.regulatory']));
DROP POLICY IF EXISTS bi_report_approvals_write_restrict_update ON bi_report_approvals;
CREATE POLICY bi_report_approvals_write_restrict_update ON bi_report_approvals AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['reports.manage','reports.regulatory']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['reports.manage','reports.regulatory']));
DROP POLICY IF EXISTS bi_report_approvals_write_restrict_delete ON bi_report_approvals;
CREATE POLICY bi_report_approvals_write_restrict_delete ON bi_report_approvals AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['reports.manage','reports.regulatory']));
-- ----------------------------------------------------------------------------
-- Business Intelligence / Reporting: bi_analytics_models  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS bi_analytics_models_write_restrict_insert ON bi_analytics_models;
CREATE POLICY bi_analytics_models_write_restrict_insert ON bi_analytics_models AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['reports.intelligence','reports.manage']));
DROP POLICY IF EXISTS bi_analytics_models_write_restrict_update ON bi_analytics_models;
CREATE POLICY bi_analytics_models_write_restrict_update ON bi_analytics_models AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['reports.intelligence','reports.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['reports.intelligence','reports.manage']));
DROP POLICY IF EXISTS bi_analytics_models_write_restrict_delete ON bi_analytics_models;
CREATE POLICY bi_analytics_models_write_restrict_delete ON bi_analytics_models AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['reports.intelligence','reports.manage']));
-- ----------------------------------------------------------------------------
-- Business Intelligence / Reporting: bi_data_marts  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS bi_data_marts_write_restrict_insert ON bi_data_marts;
CREATE POLICY bi_data_marts_write_restrict_insert ON bi_data_marts AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['reports.dwh','reports.manage']));
DROP POLICY IF EXISTS bi_data_marts_write_restrict_update ON bi_data_marts;
CREATE POLICY bi_data_marts_write_restrict_update ON bi_data_marts AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['reports.dwh','reports.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['reports.dwh','reports.manage']));
DROP POLICY IF EXISTS bi_data_marts_write_restrict_delete ON bi_data_marts;
CREATE POLICY bi_data_marts_write_restrict_delete ON bi_data_marts AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['reports.dwh','reports.manage']));
-- ----------------------------------------------------------------------------
-- Business Intelligence / Reporting: bi_dwh_objects  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS bi_dwh_objects_write_restrict_insert ON bi_dwh_objects;
CREATE POLICY bi_dwh_objects_write_restrict_insert ON bi_dwh_objects AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['reports.dwh','reports.manage']));
DROP POLICY IF EXISTS bi_dwh_objects_write_restrict_update ON bi_dwh_objects;
CREATE POLICY bi_dwh_objects_write_restrict_update ON bi_dwh_objects AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['reports.dwh','reports.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['reports.dwh','reports.manage']));
DROP POLICY IF EXISTS bi_dwh_objects_write_restrict_delete ON bi_dwh_objects;
CREATE POLICY bi_dwh_objects_write_restrict_delete ON bi_dwh_objects AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['reports.dwh','reports.manage']));
-- ----------------------------------------------------------------------------
-- Business Intelligence / Reporting: bi_chart_catalog  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS bi_chart_catalog_write_restrict_insert ON bi_chart_catalog;
CREATE POLICY bi_chart_catalog_write_restrict_insert ON bi_chart_catalog AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['reports.dashboards','reports.manage']));
DROP POLICY IF EXISTS bi_chart_catalog_write_restrict_update ON bi_chart_catalog;
CREATE POLICY bi_chart_catalog_write_restrict_update ON bi_chart_catalog AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['reports.dashboards','reports.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['reports.dashboards','reports.manage']));
DROP POLICY IF EXISTS bi_chart_catalog_write_restrict_delete ON bi_chart_catalog;
CREATE POLICY bi_chart_catalog_write_restrict_delete ON bi_chart_catalog AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['reports.dashboards','reports.manage']));
-- ----------------------------------------------------------------------------
-- Business Intelligence / Reporting: bi_document_jobs  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS bi_document_jobs_write_restrict_insert ON bi_document_jobs;
CREATE POLICY bi_document_jobs_write_restrict_insert ON bi_document_jobs AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['reports.documents','reports.manage']));
DROP POLICY IF EXISTS bi_document_jobs_write_restrict_update ON bi_document_jobs;
CREATE POLICY bi_document_jobs_write_restrict_update ON bi_document_jobs AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['reports.documents','reports.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['reports.documents','reports.manage']));
DROP POLICY IF EXISTS bi_document_jobs_write_restrict_delete ON bi_document_jobs;
CREATE POLICY bi_document_jobs_write_restrict_delete ON bi_document_jobs AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['reports.documents','reports.manage']));
-- ----------------------------------------------------------------------------
-- Business Intelligence / Reporting: bi_document_revisions  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS bi_document_revisions_write_restrict_insert ON bi_document_revisions;
CREATE POLICY bi_document_revisions_write_restrict_insert ON bi_document_revisions AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['reports.documents','reports.manage']));
DROP POLICY IF EXISTS bi_document_revisions_write_restrict_update ON bi_document_revisions;
CREATE POLICY bi_document_revisions_write_restrict_update ON bi_document_revisions AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['reports.documents','reports.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['reports.documents','reports.manage']));
DROP POLICY IF EXISTS bi_document_revisions_write_restrict_delete ON bi_document_revisions;
CREATE POLICY bi_document_revisions_write_restrict_delete ON bi_document_revisions AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['reports.documents','reports.manage']));
-- ----------------------------------------------------------------------------
-- Business Intelligence / Reporting: bi_intelligent_documents  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS bi_intelligent_documents_write_restrict_insert ON bi_intelligent_documents;
CREATE POLICY bi_intelligent_documents_write_restrict_insert ON bi_intelligent_documents AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['reports.documents','reports.intelligence']));
DROP POLICY IF EXISTS bi_intelligent_documents_write_restrict_update ON bi_intelligent_documents;
CREATE POLICY bi_intelligent_documents_write_restrict_update ON bi_intelligent_documents AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['reports.documents','reports.intelligence']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['reports.documents','reports.intelligence']));
DROP POLICY IF EXISTS bi_intelligent_documents_write_restrict_delete ON bi_intelligent_documents;
CREATE POLICY bi_intelligent_documents_write_restrict_delete ON bi_intelligent_documents AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['reports.documents','reports.intelligence']));
-- ----------------------------------------------------------------------------
-- Business Intelligence / Reporting: bi_forecast_results  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS bi_forecast_results_write_restrict_insert ON bi_forecast_results;
CREATE POLICY bi_forecast_results_write_restrict_insert ON bi_forecast_results AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['reports.intelligence','reports.manage']));
DROP POLICY IF EXISTS bi_forecast_results_write_restrict_update ON bi_forecast_results;
CREATE POLICY bi_forecast_results_write_restrict_update ON bi_forecast_results AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['reports.intelligence','reports.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['reports.intelligence','reports.manage']));
DROP POLICY IF EXISTS bi_forecast_results_write_restrict_delete ON bi_forecast_results;
CREATE POLICY bi_forecast_results_write_restrict_delete ON bi_forecast_results AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['reports.intelligence','reports.manage']));
-- ----------------------------------------------------------------------------
-- Business Intelligence / Reporting: bi_regulatory_packages  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS bi_regulatory_packages_write_restrict_insert ON bi_regulatory_packages;
CREATE POLICY bi_regulatory_packages_write_restrict_insert ON bi_regulatory_packages AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['reports.regulatory','reports.manage']));
DROP POLICY IF EXISTS bi_regulatory_packages_write_restrict_update ON bi_regulatory_packages;
CREATE POLICY bi_regulatory_packages_write_restrict_update ON bi_regulatory_packages AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['reports.regulatory','reports.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['reports.regulatory','reports.manage']));
DROP POLICY IF EXISTS bi_regulatory_packages_write_restrict_delete ON bi_regulatory_packages;
CREATE POLICY bi_regulatory_packages_write_restrict_delete ON bi_regulatory_packages AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['reports.regulatory','reports.manage']));
-- ----------------------------------------------------------------------------
-- Business Intelligence / Reporting: bi_service_registry  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS bi_service_registry_write_restrict_insert ON bi_service_registry;
CREATE POLICY bi_service_registry_write_restrict_insert ON bi_service_registry AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['reports.manage','reports.assistant']));
DROP POLICY IF EXISTS bi_service_registry_write_restrict_update ON bi_service_registry;
CREATE POLICY bi_service_registry_write_restrict_update ON bi_service_registry AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['reports.manage','reports.assistant']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['reports.manage','reports.assistant']));
DROP POLICY IF EXISTS bi_service_registry_write_restrict_delete ON bi_service_registry;
CREATE POLICY bi_service_registry_write_restrict_delete ON bi_service_registry AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['reports.manage','reports.assistant']));
-- ----------------------------------------------------------------------------
-- Finance / Accounting: fin_banks  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS fin_banks_write_restrict_insert ON fin_banks;
CREATE POLICY fin_banks_write_restrict_insert ON fin_banks AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.bank','finance.manage']));
DROP POLICY IF EXISTS fin_banks_write_restrict_update ON fin_banks;
CREATE POLICY fin_banks_write_restrict_update ON fin_banks AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.bank','finance.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.bank','finance.manage']));
DROP POLICY IF EXISTS fin_banks_write_restrict_delete ON fin_banks;
CREATE POLICY fin_banks_write_restrict_delete ON fin_banks AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.bank','finance.manage']));
-- ----------------------------------------------------------------------------
-- Finance / Accounting: fin_bank_statements  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS fin_bank_statements_write_restrict_insert ON fin_bank_statements;
CREATE POLICY fin_bank_statements_write_restrict_insert ON fin_bank_statements AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.bank','finance.manage']));
DROP POLICY IF EXISTS fin_bank_statements_write_restrict_update ON fin_bank_statements;
CREATE POLICY fin_bank_statements_write_restrict_update ON fin_bank_statements AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.bank','finance.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.bank','finance.manage']));
DROP POLICY IF EXISTS fin_bank_statements_write_restrict_delete ON fin_bank_statements;
CREATE POLICY fin_bank_statements_write_restrict_delete ON fin_bank_statements AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.bank','finance.manage']));
-- ----------------------------------------------------------------------------
-- Finance / Accounting: fin_account_groups  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS fin_account_groups_write_restrict_insert ON fin_account_groups;
CREATE POLICY fin_account_groups_write_restrict_insert ON fin_account_groups AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage']));
DROP POLICY IF EXISTS fin_account_groups_write_restrict_update ON fin_account_groups;
CREATE POLICY fin_account_groups_write_restrict_update ON fin_account_groups AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage']));
DROP POLICY IF EXISTS fin_account_groups_write_restrict_delete ON fin_account_groups;
CREATE POLICY fin_account_groups_write_restrict_delete ON fin_account_groups AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage']));
-- ----------------------------------------------------------------------------
-- Finance / Accounting: fin_ap_credit_notes  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS fin_ap_credit_notes_write_restrict_insert ON fin_ap_credit_notes;
CREATE POLICY fin_ap_credit_notes_write_restrict_insert ON fin_ap_credit_notes AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage','finance.post']));
DROP POLICY IF EXISTS fin_ap_credit_notes_write_restrict_update ON fin_ap_credit_notes;
CREATE POLICY fin_ap_credit_notes_write_restrict_update ON fin_ap_credit_notes AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage','finance.post']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage','finance.post']));
DROP POLICY IF EXISTS fin_ap_credit_notes_write_restrict_delete ON fin_ap_credit_notes;
CREATE POLICY fin_ap_credit_notes_write_restrict_delete ON fin_ap_credit_notes AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage','finance.post']));
-- ----------------------------------------------------------------------------
-- Finance / Accounting: fin_ap_debit_notes  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS fin_ap_debit_notes_write_restrict_insert ON fin_ap_debit_notes;
CREATE POLICY fin_ap_debit_notes_write_restrict_insert ON fin_ap_debit_notes AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage','finance.post']));
DROP POLICY IF EXISTS fin_ap_debit_notes_write_restrict_update ON fin_ap_debit_notes;
CREATE POLICY fin_ap_debit_notes_write_restrict_update ON fin_ap_debit_notes AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage','finance.post']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage','finance.post']));
DROP POLICY IF EXISTS fin_ap_debit_notes_write_restrict_delete ON fin_ap_debit_notes;
CREATE POLICY fin_ap_debit_notes_write_restrict_delete ON fin_ap_debit_notes AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage','finance.post']));
-- ----------------------------------------------------------------------------
-- Finance / Accounting: fin_ar_debit_notes  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS fin_ar_debit_notes_write_restrict_insert ON fin_ar_debit_notes;
CREATE POLICY fin_ar_debit_notes_write_restrict_insert ON fin_ar_debit_notes AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage','finance.post']));
DROP POLICY IF EXISTS fin_ar_debit_notes_write_restrict_update ON fin_ar_debit_notes;
CREATE POLICY fin_ar_debit_notes_write_restrict_update ON fin_ar_debit_notes AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage','finance.post']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage','finance.post']));
DROP POLICY IF EXISTS fin_ar_debit_notes_write_restrict_delete ON fin_ar_debit_notes;
CREATE POLICY fin_ar_debit_notes_write_restrict_delete ON fin_ar_debit_notes AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage','finance.post']));
-- ----------------------------------------------------------------------------
-- Finance / Accounting: fin_approvals  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS fin_approvals_write_restrict_insert ON fin_approvals;
CREATE POLICY fin_approvals_write_restrict_insert ON fin_approvals AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.approve','finance.manage']));
DROP POLICY IF EXISTS fin_approvals_write_restrict_update ON fin_approvals;
CREATE POLICY fin_approvals_write_restrict_update ON fin_approvals AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.approve','finance.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.approve','finance.manage']));
DROP POLICY IF EXISTS fin_approvals_write_restrict_delete ON fin_approvals;
CREATE POLICY fin_approvals_write_restrict_delete ON fin_approvals AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.approve','finance.manage']));
-- ----------------------------------------------------------------------------
-- Finance / Accounting: fin_asset_capitalizations  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS fin_asset_capitalizations_write_restrict_insert ON fin_asset_capitalizations;
CREATE POLICY fin_asset_capitalizations_write_restrict_insert ON fin_asset_capitalizations AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage']));
DROP POLICY IF EXISTS fin_asset_capitalizations_write_restrict_update ON fin_asset_capitalizations;
CREATE POLICY fin_asset_capitalizations_write_restrict_update ON fin_asset_capitalizations AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage']));
DROP POLICY IF EXISTS fin_asset_capitalizations_write_restrict_delete ON fin_asset_capitalizations;
CREATE POLICY fin_asset_capitalizations_write_restrict_delete ON fin_asset_capitalizations AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage']));
-- ----------------------------------------------------------------------------
-- Finance / Accounting: fin_asset_disposals  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS fin_asset_disposals_write_restrict_insert ON fin_asset_disposals;
CREATE POLICY fin_asset_disposals_write_restrict_insert ON fin_asset_disposals AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage']));
DROP POLICY IF EXISTS fin_asset_disposals_write_restrict_update ON fin_asset_disposals;
CREATE POLICY fin_asset_disposals_write_restrict_update ON fin_asset_disposals AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage']));
DROP POLICY IF EXISTS fin_asset_disposals_write_restrict_delete ON fin_asset_disposals;
CREATE POLICY fin_asset_disposals_write_restrict_delete ON fin_asset_disposals AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage']));
-- ----------------------------------------------------------------------------
-- Finance / Accounting: fin_asset_impairments  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS fin_asset_impairments_write_restrict_insert ON fin_asset_impairments;
CREATE POLICY fin_asset_impairments_write_restrict_insert ON fin_asset_impairments AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage']));
DROP POLICY IF EXISTS fin_asset_impairments_write_restrict_update ON fin_asset_impairments;
CREATE POLICY fin_asset_impairments_write_restrict_update ON fin_asset_impairments AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage']));
DROP POLICY IF EXISTS fin_asset_impairments_write_restrict_delete ON fin_asset_impairments;
CREATE POLICY fin_asset_impairments_write_restrict_delete ON fin_asset_impairments AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage']));
-- ----------------------------------------------------------------------------
-- Finance / Accounting: fin_asset_revaluations  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS fin_asset_revaluations_write_restrict_insert ON fin_asset_revaluations;
CREATE POLICY fin_asset_revaluations_write_restrict_insert ON fin_asset_revaluations AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage']));
DROP POLICY IF EXISTS fin_asset_revaluations_write_restrict_update ON fin_asset_revaluations;
CREATE POLICY fin_asset_revaluations_write_restrict_update ON fin_asset_revaluations AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage']));
DROP POLICY IF EXISTS fin_asset_revaluations_write_restrict_delete ON fin_asset_revaluations;
CREATE POLICY fin_asset_revaluations_write_restrict_delete ON fin_asset_revaluations AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage']));
-- ----------------------------------------------------------------------------
-- Finance / Accounting: fin_asset_transfers  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS fin_asset_transfers_write_restrict_insert ON fin_asset_transfers;
CREATE POLICY fin_asset_transfers_write_restrict_insert ON fin_asset_transfers AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage']));
DROP POLICY IF EXISTS fin_asset_transfers_write_restrict_update ON fin_asset_transfers;
CREATE POLICY fin_asset_transfers_write_restrict_update ON fin_asset_transfers AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage']));
DROP POLICY IF EXISTS fin_asset_transfers_write_restrict_delete ON fin_asset_transfers;
CREATE POLICY fin_asset_transfers_write_restrict_delete ON fin_asset_transfers AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage']));
-- ----------------------------------------------------------------------------
-- Finance / Accounting: fin_budget_revisions  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS fin_budget_revisions_write_restrict_insert ON fin_budget_revisions;
CREATE POLICY fin_budget_revisions_write_restrict_insert ON fin_budget_revisions AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.fpa','finance.manage']));
DROP POLICY IF EXISTS fin_budget_revisions_write_restrict_update ON fin_budget_revisions;
CREATE POLICY fin_budget_revisions_write_restrict_update ON fin_budget_revisions AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.fpa','finance.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.fpa','finance.manage']));
DROP POLICY IF EXISTS fin_budget_revisions_write_restrict_delete ON fin_budget_revisions;
CREATE POLICY fin_budget_revisions_write_restrict_delete ON fin_budget_revisions AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.fpa','finance.manage']));
-- ----------------------------------------------------------------------------
-- Finance / Accounting: fin_budget_templates  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS fin_budget_templates_write_restrict_insert ON fin_budget_templates;
CREATE POLICY fin_budget_templates_write_restrict_insert ON fin_budget_templates AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.fpa','finance.manage']));
DROP POLICY IF EXISTS fin_budget_templates_write_restrict_update ON fin_budget_templates;
CREATE POLICY fin_budget_templates_write_restrict_update ON fin_budget_templates AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.fpa','finance.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.fpa','finance.manage']));
DROP POLICY IF EXISTS fin_budget_templates_write_restrict_delete ON fin_budget_templates;
CREATE POLICY fin_budget_templates_write_restrict_delete ON fin_budget_templates AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.fpa','finance.manage']));
-- ----------------------------------------------------------------------------
-- Finance / Accounting: fin_budget_variance  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS fin_budget_variance_write_restrict_insert ON fin_budget_variance;
CREATE POLICY fin_budget_variance_write_restrict_insert ON fin_budget_variance AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.fpa','finance.manage']));
DROP POLICY IF EXISTS fin_budget_variance_write_restrict_update ON fin_budget_variance;
CREATE POLICY fin_budget_variance_write_restrict_update ON fin_budget_variance AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.fpa','finance.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.fpa','finance.manage']));
DROP POLICY IF EXISTS fin_budget_variance_write_restrict_delete ON fin_budget_variance;
CREATE POLICY fin_budget_variance_write_restrict_delete ON fin_budget_variance AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.fpa','finance.manage']));
-- ----------------------------------------------------------------------------
-- Finance / Accounting: fin_business_units  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS fin_business_units_write_restrict_insert ON fin_business_units;
CREATE POLICY fin_business_units_write_restrict_insert ON fin_business_units AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage']));
DROP POLICY IF EXISTS fin_business_units_write_restrict_update ON fin_business_units;
CREATE POLICY fin_business_units_write_restrict_update ON fin_business_units AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage']));
DROP POLICY IF EXISTS fin_business_units_write_restrict_delete ON fin_business_units;
CREATE POLICY fin_business_units_write_restrict_delete ON fin_business_units AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage']));
-- ----------------------------------------------------------------------------
-- Finance / Accounting: fin_cash_counts  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS fin_cash_counts_write_restrict_insert ON fin_cash_counts;
CREATE POLICY fin_cash_counts_write_restrict_insert ON fin_cash_counts AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.treasury','finance.manage']));
DROP POLICY IF EXISTS fin_cash_counts_write_restrict_update ON fin_cash_counts;
CREATE POLICY fin_cash_counts_write_restrict_update ON fin_cash_counts AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.treasury','finance.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.treasury','finance.manage']));
DROP POLICY IF EXISTS fin_cash_counts_write_restrict_delete ON fin_cash_counts;
CREATE POLICY fin_cash_counts_write_restrict_delete ON fin_cash_counts AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.treasury','finance.manage']));
-- ----------------------------------------------------------------------------
-- Finance / Accounting: fin_cash_forecasts  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS fin_cash_forecasts_write_restrict_insert ON fin_cash_forecasts;
CREATE POLICY fin_cash_forecasts_write_restrict_insert ON fin_cash_forecasts AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.fpa','finance.manage']));
DROP POLICY IF EXISTS fin_cash_forecasts_write_restrict_update ON fin_cash_forecasts;
CREATE POLICY fin_cash_forecasts_write_restrict_update ON fin_cash_forecasts AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.fpa','finance.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.fpa','finance.manage']));
DROP POLICY IF EXISTS fin_cash_forecasts_write_restrict_delete ON fin_cash_forecasts;
CREATE POLICY fin_cash_forecasts_write_restrict_delete ON fin_cash_forecasts AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.fpa','finance.manage']));
-- ----------------------------------------------------------------------------
-- Finance / Accounting: fin_cip  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS fin_cip_write_restrict_insert ON fin_cip;
CREATE POLICY fin_cip_write_restrict_insert ON fin_cip AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage']));
DROP POLICY IF EXISTS fin_cip_write_restrict_update ON fin_cip;
CREATE POLICY fin_cip_write_restrict_update ON fin_cip AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage']));
DROP POLICY IF EXISTS fin_cip_write_restrict_delete ON fin_cip;
CREATE POLICY fin_cip_write_restrict_delete ON fin_cip AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage']));
-- ----------------------------------------------------------------------------
-- Finance / Accounting: fin_close_adjustments  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS fin_close_adjustments_write_restrict_insert ON fin_close_adjustments;
CREATE POLICY fin_close_adjustments_write_restrict_insert ON fin_close_adjustments AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.close','finance.manage']));
DROP POLICY IF EXISTS fin_close_adjustments_write_restrict_update ON fin_close_adjustments;
CREATE POLICY fin_close_adjustments_write_restrict_update ON fin_close_adjustments AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.close','finance.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.close','finance.manage']));
DROP POLICY IF EXISTS fin_close_adjustments_write_restrict_delete ON fin_close_adjustments;
CREATE POLICY fin_close_adjustments_write_restrict_delete ON fin_close_adjustments AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.close','finance.manage']));
-- ----------------------------------------------------------------------------
-- Finance / Accounting: fin_close_checklists  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS fin_close_checklists_write_restrict_insert ON fin_close_checklists;
CREATE POLICY fin_close_checklists_write_restrict_insert ON fin_close_checklists AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.close','finance.manage']));
DROP POLICY IF EXISTS fin_close_checklists_write_restrict_update ON fin_close_checklists;
CREATE POLICY fin_close_checklists_write_restrict_update ON fin_close_checklists AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.close','finance.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.close','finance.manage']));
DROP POLICY IF EXISTS fin_close_checklists_write_restrict_delete ON fin_close_checklists;
CREATE POLICY fin_close_checklists_write_restrict_delete ON fin_close_checklists AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.close','finance.manage']));
-- ----------------------------------------------------------------------------
-- Finance / Accounting: fin_collections  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS fin_collections_write_restrict_insert ON fin_collections;
CREATE POLICY fin_collections_write_restrict_insert ON fin_collections AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage','finance.approve']));
DROP POLICY IF EXISTS fin_collections_write_restrict_update ON fin_collections;
CREATE POLICY fin_collections_write_restrict_update ON fin_collections AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage','finance.approve']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage','finance.approve']));
DROP POLICY IF EXISTS fin_collections_write_restrict_delete ON fin_collections;
CREATE POLICY fin_collections_write_restrict_delete ON fin_collections AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage','finance.approve']));
-- ----------------------------------------------------------------------------
-- Finance / Accounting: fin_corporate_tax  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS fin_corporate_tax_write_restrict_insert ON fin_corporate_tax;
CREATE POLICY fin_corporate_tax_write_restrict_insert ON fin_corporate_tax AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.tax','finance.manage']));
DROP POLICY IF EXISTS fin_corporate_tax_write_restrict_update ON fin_corporate_tax;
CREATE POLICY fin_corporate_tax_write_restrict_update ON fin_corporate_tax AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.tax','finance.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.tax','finance.manage']));
DROP POLICY IF EXISTS fin_corporate_tax_write_restrict_delete ON fin_corporate_tax;
CREATE POLICY fin_corporate_tax_write_restrict_delete ON fin_corporate_tax AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.tax','finance.manage']));
-- ----------------------------------------------------------------------------
-- Finance / Accounting: fin_cost_rolls  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS fin_cost_rolls_write_restrict_insert ON fin_cost_rolls;
CREATE POLICY fin_cost_rolls_write_restrict_insert ON fin_cost_rolls AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.costing','finance.manage']));
DROP POLICY IF EXISTS fin_cost_rolls_write_restrict_update ON fin_cost_rolls;
CREATE POLICY fin_cost_rolls_write_restrict_update ON fin_cost_rolls AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.costing','finance.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.costing','finance.manage']));
DROP POLICY IF EXISTS fin_cost_rolls_write_restrict_delete ON fin_cost_rolls;
CREATE POLICY fin_cost_rolls_write_restrict_delete ON fin_cost_rolls AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.costing','finance.manage']));
-- ----------------------------------------------------------------------------
-- Finance / Accounting: fin_cost_variances  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS fin_cost_variances_write_restrict_insert ON fin_cost_variances;
CREATE POLICY fin_cost_variances_write_restrict_insert ON fin_cost_variances AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.costing','finance.manage']));
DROP POLICY IF EXISTS fin_cost_variances_write_restrict_update ON fin_cost_variances;
CREATE POLICY fin_cost_variances_write_restrict_update ON fin_cost_variances AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.costing','finance.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.costing','finance.manage']));
DROP POLICY IF EXISTS fin_cost_variances_write_restrict_delete ON fin_cost_variances;
CREATE POLICY fin_cost_variances_write_restrict_delete ON fin_cost_variances AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.costing','finance.manage']));
-- ----------------------------------------------------------------------------
-- Finance / Accounting: fin_costing_methods  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS fin_costing_methods_write_restrict_insert ON fin_costing_methods;
CREATE POLICY fin_costing_methods_write_restrict_insert ON fin_costing_methods AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.costing','finance.manage']));
DROP POLICY IF EXISTS fin_costing_methods_write_restrict_update ON fin_costing_methods;
CREATE POLICY fin_costing_methods_write_restrict_update ON fin_costing_methods AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.costing','finance.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.costing','finance.manage']));
DROP POLICY IF EXISTS fin_costing_methods_write_restrict_delete ON fin_costing_methods;
CREATE POLICY fin_costing_methods_write_restrict_delete ON fin_costing_methods AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.costing','finance.manage']));
-- ----------------------------------------------------------------------------
-- Finance / Accounting: fin_currency_translation  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS fin_currency_translation_write_restrict_insert ON fin_currency_translation;
CREATE POLICY fin_currency_translation_write_restrict_insert ON fin_currency_translation AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.consolidate','finance.manage']));
DROP POLICY IF EXISTS fin_currency_translation_write_restrict_update ON fin_currency_translation;
CREATE POLICY fin_currency_translation_write_restrict_update ON fin_currency_translation AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.consolidate','finance.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.consolidate','finance.manage']));
DROP POLICY IF EXISTS fin_currency_translation_write_restrict_delete ON fin_currency_translation;
CREATE POLICY fin_currency_translation_write_restrict_delete ON fin_currency_translation AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.consolidate','finance.manage']));
-- ----------------------------------------------------------------------------
-- Finance / Accounting: fin_customer_statements  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS fin_customer_statements_write_restrict_insert ON fin_customer_statements;
CREATE POLICY fin_customer_statements_write_restrict_insert ON fin_customer_statements AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage','finance.admin']));
DROP POLICY IF EXISTS fin_customer_statements_write_restrict_update ON fin_customer_statements;
CREATE POLICY fin_customer_statements_write_restrict_update ON fin_customer_statements AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage','finance.admin']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage','finance.admin']));
DROP POLICY IF EXISTS fin_customer_statements_write_restrict_delete ON fin_customer_statements;
CREATE POLICY fin_customer_statements_write_restrict_delete ON fin_customer_statements AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage','finance.admin']));
-- ----------------------------------------------------------------------------
-- Finance / Accounting: fin_deferred_revenue  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS fin_deferred_revenue_write_restrict_insert ON fin_deferred_revenue;
CREATE POLICY fin_deferred_revenue_write_restrict_insert ON fin_deferred_revenue AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage']));
DROP POLICY IF EXISTS fin_deferred_revenue_write_restrict_update ON fin_deferred_revenue;
CREATE POLICY fin_deferred_revenue_write_restrict_update ON fin_deferred_revenue AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage']));
DROP POLICY IF EXISTS fin_deferred_revenue_write_restrict_delete ON fin_deferred_revenue;
CREATE POLICY fin_deferred_revenue_write_restrict_delete ON fin_deferred_revenue AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage']));
-- ----------------------------------------------------------------------------
-- Finance / Accounting: fin_dimension_values  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS fin_dimension_values_write_restrict_insert ON fin_dimension_values;
CREATE POLICY fin_dimension_values_write_restrict_insert ON fin_dimension_values AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage']));
DROP POLICY IF EXISTS fin_dimension_values_write_restrict_update ON fin_dimension_values;
CREATE POLICY fin_dimension_values_write_restrict_update ON fin_dimension_values AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage']));
DROP POLICY IF EXISTS fin_dimension_values_write_restrict_delete ON fin_dimension_values;
CREATE POLICY fin_dimension_values_write_restrict_delete ON fin_dimension_values AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage']));
-- ----------------------------------------------------------------------------
-- Finance / Accounting: fin_dimensions  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS fin_dimensions_write_restrict_insert ON fin_dimensions;
CREATE POLICY fin_dimensions_write_restrict_insert ON fin_dimensions AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage']));
DROP POLICY IF EXISTS fin_dimensions_write_restrict_update ON fin_dimensions;
CREATE POLICY fin_dimensions_write_restrict_update ON fin_dimensions AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage']));
DROP POLICY IF EXISTS fin_dimensions_write_restrict_delete ON fin_dimensions;
CREATE POLICY fin_dimensions_write_restrict_delete ON fin_dimensions AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage']));
-- ----------------------------------------------------------------------------
-- Finance / Accounting: fin_electronic_payments  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS fin_electronic_payments_write_restrict_insert ON fin_electronic_payments;
CREATE POLICY fin_electronic_payments_write_restrict_insert ON fin_electronic_payments AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.bank','finance.manage']));
DROP POLICY IF EXISTS fin_electronic_payments_write_restrict_update ON fin_electronic_payments;
CREATE POLICY fin_electronic_payments_write_restrict_update ON fin_electronic_payments AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.bank','finance.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.bank','finance.manage']));
DROP POLICY IF EXISTS fin_electronic_payments_write_restrict_delete ON fin_electronic_payments;
CREATE POLICY fin_electronic_payments_write_restrict_delete ON fin_electronic_payments AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.bank','finance.manage']));
-- ----------------------------------------------------------------------------
-- Finance / Accounting: fin_elimination_entries  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS fin_elimination_entries_write_restrict_insert ON fin_elimination_entries;
CREATE POLICY fin_elimination_entries_write_restrict_insert ON fin_elimination_entries AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.consolidate','finance.manage']));
DROP POLICY IF EXISTS fin_elimination_entries_write_restrict_update ON fin_elimination_entries;
CREATE POLICY fin_elimination_entries_write_restrict_update ON fin_elimination_entries AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.consolidate','finance.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.consolidate','finance.manage']));
DROP POLICY IF EXISTS fin_elimination_entries_write_restrict_delete ON fin_elimination_entries;
CREATE POLICY fin_elimination_entries_write_restrict_delete ON fin_elimination_entries AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.consolidate','finance.manage']));
-- ----------------------------------------------------------------------------
-- Finance / Accounting: fin_excise_duty  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS fin_excise_duty_write_restrict_insert ON fin_excise_duty;
CREATE POLICY fin_excise_duty_write_restrict_insert ON fin_excise_duty AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.tax','finance.manage']));
DROP POLICY IF EXISTS fin_excise_duty_write_restrict_update ON fin_excise_duty;
CREATE POLICY fin_excise_duty_write_restrict_update ON fin_excise_duty AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.tax','finance.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.tax','finance.manage']));
DROP POLICY IF EXISTS fin_excise_duty_write_restrict_delete ON fin_excise_duty;
CREATE POLICY fin_excise_duty_write_restrict_delete ON fin_excise_duty AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.tax','finance.manage']));
-- ----------------------------------------------------------------------------
-- Finance / Accounting: fin_expense_claims  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS fin_expense_claims_write_restrict_insert ON fin_expense_claims;
CREATE POLICY fin_expense_claims_write_restrict_insert ON fin_expense_claims AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage','finance.approve']));
DROP POLICY IF EXISTS fin_expense_claims_write_restrict_update ON fin_expense_claims;
CREATE POLICY fin_expense_claims_write_restrict_update ON fin_expense_claims AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage','finance.approve']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage','finance.approve']));
DROP POLICY IF EXISTS fin_expense_claims_write_restrict_delete ON fin_expense_claims;
CREATE POLICY fin_expense_claims_write_restrict_delete ON fin_expense_claims AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage','finance.approve']));
-- ----------------------------------------------------------------------------
-- Finance / Accounting: fin_export_revenue  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS fin_export_revenue_write_restrict_insert ON fin_export_revenue;
CREATE POLICY fin_export_revenue_write_restrict_insert ON fin_export_revenue AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage','finance.tax']));
DROP POLICY IF EXISTS fin_export_revenue_write_restrict_update ON fin_export_revenue;
CREATE POLICY fin_export_revenue_write_restrict_update ON fin_export_revenue AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage','finance.tax']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage','finance.tax']));
DROP POLICY IF EXISTS fin_export_revenue_write_restrict_delete ON fin_export_revenue;
CREATE POLICY fin_export_revenue_write_restrict_delete ON fin_export_revenue AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage','finance.tax']));
-- ----------------------------------------------------------------------------
-- Finance / Accounting: fin_forecasts  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS fin_forecasts_write_restrict_insert ON fin_forecasts;
CREATE POLICY fin_forecasts_write_restrict_insert ON fin_forecasts AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.fpa','finance.manage']));
DROP POLICY IF EXISTS fin_forecasts_write_restrict_update ON fin_forecasts;
CREATE POLICY fin_forecasts_write_restrict_update ON fin_forecasts AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.fpa','finance.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.fpa','finance.manage']));
DROP POLICY IF EXISTS fin_forecasts_write_restrict_delete ON fin_forecasts;
CREATE POLICY fin_forecasts_write_restrict_delete ON fin_forecasts AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.fpa','finance.manage']));
-- ----------------------------------------------------------------------------
-- Finance / Accounting: fin_government_contracts  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS fin_government_contracts_write_restrict_insert ON fin_government_contracts;
CREATE POLICY fin_government_contracts_write_restrict_insert ON fin_government_contracts AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage','finance.tax']));
DROP POLICY IF EXISTS fin_government_contracts_write_restrict_update ON fin_government_contracts;
CREATE POLICY fin_government_contracts_write_restrict_update ON fin_government_contracts AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage','finance.tax']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage','finance.tax']));
DROP POLICY IF EXISTS fin_government_contracts_write_restrict_delete ON fin_government_contracts;
CREATE POLICY fin_government_contracts_write_restrict_delete ON fin_government_contracts AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage','finance.tax']));
-- ----------------------------------------------------------------------------
-- Finance / Accounting: fin_group_consolidation  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS fin_group_consolidation_write_restrict_insert ON fin_group_consolidation;
CREATE POLICY fin_group_consolidation_write_restrict_insert ON fin_group_consolidation AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.consolidate','finance.manage']));
DROP POLICY IF EXISTS fin_group_consolidation_write_restrict_update ON fin_group_consolidation;
CREATE POLICY fin_group_consolidation_write_restrict_update ON fin_group_consolidation AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.consolidate','finance.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.consolidate','finance.manage']));
DROP POLICY IF EXISTS fin_group_consolidation_write_restrict_delete ON fin_group_consolidation;
CREATE POLICY fin_group_consolidation_write_restrict_delete ON fin_group_consolidation AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.consolidate','finance.manage']));
-- ----------------------------------------------------------------------------
-- Finance / Accounting: fin_guarantees  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS fin_guarantees_write_restrict_insert ON fin_guarantees;
CREATE POLICY fin_guarantees_write_restrict_insert ON fin_guarantees AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.treasury','finance.manage']));
DROP POLICY IF EXISTS fin_guarantees_write_restrict_update ON fin_guarantees;
CREATE POLICY fin_guarantees_write_restrict_update ON fin_guarantees AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.treasury','finance.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.treasury','finance.manage']));
DROP POLICY IF EXISTS fin_guarantees_write_restrict_delete ON fin_guarantees;
CREATE POLICY fin_guarantees_write_restrict_delete ON fin_guarantees AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.treasury','finance.manage']));
-- ----------------------------------------------------------------------------
-- Finance / Accounting: fin_import_duty  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS fin_import_duty_write_restrict_insert ON fin_import_duty;
CREATE POLICY fin_import_duty_write_restrict_insert ON fin_import_duty AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.tax','finance.manage']));
DROP POLICY IF EXISTS fin_import_duty_write_restrict_update ON fin_import_duty;
CREATE POLICY fin_import_duty_write_restrict_update ON fin_import_duty AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.tax','finance.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.tax','finance.manage']));
DROP POLICY IF EXISTS fin_import_duty_write_restrict_delete ON fin_import_duty;
CREATE POLICY fin_import_duty_write_restrict_delete ON fin_import_duty AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.tax','finance.manage']));
-- ----------------------------------------------------------------------------
-- Finance / Accounting: fin_intercompany_txns  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS fin_intercompany_txns_write_restrict_insert ON fin_intercompany_txns;
CREATE POLICY fin_intercompany_txns_write_restrict_insert ON fin_intercompany_txns AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.consolidate','finance.manage']));
DROP POLICY IF EXISTS fin_intercompany_txns_write_restrict_update ON fin_intercompany_txns;
CREATE POLICY fin_intercompany_txns_write_restrict_update ON fin_intercompany_txns AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.consolidate','finance.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.consolidate','finance.manage']));
DROP POLICY IF EXISTS fin_intercompany_txns_write_restrict_delete ON fin_intercompany_txns;
CREATE POLICY fin_intercompany_txns_write_restrict_delete ON fin_intercompany_txns AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.consolidate','finance.manage']));
-- ----------------------------------------------------------------------------
-- Finance / Accounting: fin_internal_controls  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS fin_internal_controls_write_restrict_insert ON fin_internal_controls;
CREATE POLICY fin_internal_controls_write_restrict_insert ON fin_internal_controls AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.admin','finance.manage']));
DROP POLICY IF EXISTS fin_internal_controls_write_restrict_update ON fin_internal_controls;
CREATE POLICY fin_internal_controls_write_restrict_update ON fin_internal_controls AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.admin','finance.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.admin','finance.manage']));
DROP POLICY IF EXISTS fin_internal_controls_write_restrict_delete ON fin_internal_controls;
CREATE POLICY fin_internal_controls_write_restrict_delete ON fin_internal_controls AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.admin','finance.manage']));
-- ----------------------------------------------------------------------------
-- Finance / Accounting: fin_inventory_adjustments  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS fin_inventory_adjustments_write_restrict_insert ON fin_inventory_adjustments;
CREATE POLICY fin_inventory_adjustments_write_restrict_insert ON fin_inventory_adjustments AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage','inventory.adjust']));
DROP POLICY IF EXISTS fin_inventory_adjustments_write_restrict_update ON fin_inventory_adjustments;
CREATE POLICY fin_inventory_adjustments_write_restrict_update ON fin_inventory_adjustments AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage','inventory.adjust']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage','inventory.adjust']));
DROP POLICY IF EXISTS fin_inventory_adjustments_write_restrict_delete ON fin_inventory_adjustments;
CREATE POLICY fin_inventory_adjustments_write_restrict_delete ON fin_inventory_adjustments AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage','inventory.adjust']));
-- ----------------------------------------------------------------------------
-- Finance / Accounting: fin_inventory_valuation  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS fin_inventory_valuation_write_restrict_insert ON fin_inventory_valuation;
CREATE POLICY fin_inventory_valuation_write_restrict_insert ON fin_inventory_valuation AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage','inventory.valuation']));
DROP POLICY IF EXISTS fin_inventory_valuation_write_restrict_update ON fin_inventory_valuation;
CREATE POLICY fin_inventory_valuation_write_restrict_update ON fin_inventory_valuation AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage','inventory.valuation']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage','inventory.valuation']));
DROP POLICY IF EXISTS fin_inventory_valuation_write_restrict_delete ON fin_inventory_valuation;
CREATE POLICY fin_inventory_valuation_write_restrict_delete ON fin_inventory_valuation AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage','inventory.valuation']));
-- ----------------------------------------------------------------------------
-- Finance / Accounting: fin_investments  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS fin_investments_write_restrict_insert ON fin_investments;
CREATE POLICY fin_investments_write_restrict_insert ON fin_investments AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.treasury','finance.manage']));
DROP POLICY IF EXISTS fin_investments_write_restrict_update ON fin_investments;
CREATE POLICY fin_investments_write_restrict_update ON fin_investments AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.treasury','finance.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.treasury','finance.manage']));
DROP POLICY IF EXISTS fin_investments_write_restrict_delete ON fin_investments;
CREATE POLICY fin_investments_write_restrict_delete ON fin_investments AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.treasury','finance.manage']));
-- ----------------------------------------------------------------------------
-- Finance / Accounting: fin_journal_templates  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS fin_journal_templates_write_restrict_insert ON fin_journal_templates;
CREATE POLICY fin_journal_templates_write_restrict_insert ON fin_journal_templates AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.post','finance.manage']));
DROP POLICY IF EXISTS fin_journal_templates_write_restrict_update ON fin_journal_templates;
CREATE POLICY fin_journal_templates_write_restrict_update ON fin_journal_templates AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.post','finance.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.post','finance.manage']));
DROP POLICY IF EXISTS fin_journal_templates_write_restrict_delete ON fin_journal_templates;
CREATE POLICY fin_journal_templates_write_restrict_delete ON fin_journal_templates AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.post','finance.manage']));
-- ----------------------------------------------------------------------------
-- Finance / Accounting: fin_leases  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS fin_leases_write_restrict_insert ON fin_leases;
CREATE POLICY fin_leases_write_restrict_insert ON fin_leases AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage']));
DROP POLICY IF EXISTS fin_leases_write_restrict_update ON fin_leases;
CREATE POLICY fin_leases_write_restrict_update ON fin_leases AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage']));
DROP POLICY IF EXISTS fin_leases_write_restrict_delete ON fin_leases;
CREATE POLICY fin_leases_write_restrict_delete ON fin_leases AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage']));
-- ----------------------------------------------------------------------------
-- Finance / Accounting: fin_letters_of_credit  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS fin_letters_of_credit_write_restrict_insert ON fin_letters_of_credit;
CREATE POLICY fin_letters_of_credit_write_restrict_insert ON fin_letters_of_credit AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.treasury','finance.manage']));
DROP POLICY IF EXISTS fin_letters_of_credit_write_restrict_update ON fin_letters_of_credit;
CREATE POLICY fin_letters_of_credit_write_restrict_update ON fin_letters_of_credit AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.treasury','finance.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.treasury','finance.manage']));
DROP POLICY IF EXISTS fin_letters_of_credit_write_restrict_delete ON fin_letters_of_credit;
CREATE POLICY fin_letters_of_credit_write_restrict_delete ON fin_letters_of_credit AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.treasury','finance.manage']));
-- ----------------------------------------------------------------------------
-- Finance / Accounting: fin_liquidity  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS fin_liquidity_write_restrict_insert ON fin_liquidity;
CREATE POLICY fin_liquidity_write_restrict_insert ON fin_liquidity AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.treasury','finance.manage']));
DROP POLICY IF EXISTS fin_liquidity_write_restrict_update ON fin_liquidity;
CREATE POLICY fin_liquidity_write_restrict_update ON fin_liquidity AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.treasury','finance.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.treasury','finance.manage']));
DROP POLICY IF EXISTS fin_liquidity_write_restrict_delete ON fin_liquidity;
CREATE POLICY fin_liquidity_write_restrict_delete ON fin_liquidity AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.treasury','finance.manage']));
-- ----------------------------------------------------------------------------
-- Finance / Accounting: fin_loans  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS fin_loans_write_restrict_insert ON fin_loans;
CREATE POLICY fin_loans_write_restrict_insert ON fin_loans AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.treasury','finance.manage']));
DROP POLICY IF EXISTS fin_loans_write_restrict_update ON fin_loans;
CREATE POLICY fin_loans_write_restrict_update ON fin_loans AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.treasury','finance.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.treasury','finance.manage']));
DROP POLICY IF EXISTS fin_loans_write_restrict_delete ON fin_loans;
CREATE POLICY fin_loans_write_restrict_delete ON fin_loans AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.treasury','finance.manage']));
-- ----------------------------------------------------------------------------
-- Finance / Accounting: fin_mobile_money_txns  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS fin_mobile_money_txns_write_restrict_insert ON fin_mobile_money_txns;
CREATE POLICY fin_mobile_money_txns_write_restrict_insert ON fin_mobile_money_txns AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.bank','finance.manage']));
DROP POLICY IF EXISTS fin_mobile_money_txns_write_restrict_update ON fin_mobile_money_txns;
CREATE POLICY fin_mobile_money_txns_write_restrict_update ON fin_mobile_money_txns AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.bank','finance.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.bank','finance.manage']));
DROP POLICY IF EXISTS fin_mobile_money_txns_write_restrict_delete ON fin_mobile_money_txns;
CREATE POLICY fin_mobile_money_txns_write_restrict_delete ON fin_mobile_money_txns AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.bank','finance.manage']));
-- ----------------------------------------------------------------------------
-- Finance / Accounting: fin_payment_plans  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS fin_payment_plans_write_restrict_insert ON fin_payment_plans;
CREATE POLICY fin_payment_plans_write_restrict_insert ON fin_payment_plans AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage']));
DROP POLICY IF EXISTS fin_payment_plans_write_restrict_update ON fin_payment_plans;
CREATE POLICY fin_payment_plans_write_restrict_update ON fin_payment_plans AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage']));
DROP POLICY IF EXISTS fin_payment_plans_write_restrict_delete ON fin_payment_plans;
CREATE POLICY fin_payment_plans_write_restrict_delete ON fin_payment_plans AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage']));
-- ----------------------------------------------------------------------------
-- Finance / Accounting: fin_payment_runs  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS fin_payment_runs_write_restrict_insert ON fin_payment_runs;
CREATE POLICY fin_payment_runs_write_restrict_insert ON fin_payment_runs AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.bank','finance.manage']));
DROP POLICY IF EXISTS fin_payment_runs_write_restrict_update ON fin_payment_runs;
CREATE POLICY fin_payment_runs_write_restrict_update ON fin_payment_runs AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.bank','finance.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.bank','finance.manage']));
DROP POLICY IF EXISTS fin_payment_runs_write_restrict_delete ON fin_payment_runs;
CREATE POLICY fin_payment_runs_write_restrict_delete ON fin_payment_runs AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.bank','finance.manage']));
-- ----------------------------------------------------------------------------
-- Finance / Accounting: fin_payroll_journals  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS fin_payroll_journals_write_restrict_insert ON fin_payroll_journals;
CREATE POLICY fin_payroll_journals_write_restrict_insert ON fin_payroll_journals AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage','payroll.manage']));
DROP POLICY IF EXISTS fin_payroll_journals_write_restrict_update ON fin_payroll_journals;
CREATE POLICY fin_payroll_journals_write_restrict_update ON fin_payroll_journals AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage','payroll.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage','payroll.manage']));
DROP POLICY IF EXISTS fin_payroll_journals_write_restrict_delete ON fin_payroll_journals;
CREATE POLICY fin_payroll_journals_write_restrict_delete ON fin_payroll_journals AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage','payroll.manage']));
-- ----------------------------------------------------------------------------
-- Finance / Accounting: fin_period_locks  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS fin_period_locks_write_restrict_insert ON fin_period_locks;
CREATE POLICY fin_period_locks_write_restrict_insert ON fin_period_locks AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.close','finance.manage']));
DROP POLICY IF EXISTS fin_period_locks_write_restrict_update ON fin_period_locks;
CREATE POLICY fin_period_locks_write_restrict_update ON fin_period_locks AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.close','finance.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.close','finance.manage']));
DROP POLICY IF EXISTS fin_period_locks_write_restrict_delete ON fin_period_locks;
CREATE POLICY fin_period_locks_write_restrict_delete ON fin_period_locks AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.close','finance.manage']));
-- ----------------------------------------------------------------------------
-- Finance / Accounting: fin_petty_cash  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS fin_petty_cash_write_restrict_insert ON fin_petty_cash;
CREATE POLICY fin_petty_cash_write_restrict_insert ON fin_petty_cash AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.treasury','finance.manage']));
DROP POLICY IF EXISTS fin_petty_cash_write_restrict_update ON fin_petty_cash;
CREATE POLICY fin_petty_cash_write_restrict_update ON fin_petty_cash AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.treasury','finance.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.treasury','finance.manage']));
DROP POLICY IF EXISTS fin_petty_cash_write_restrict_delete ON fin_petty_cash;
CREATE POLICY fin_petty_cash_write_restrict_delete ON fin_petty_cash AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.treasury','finance.manage']));
-- ----------------------------------------------------------------------------
-- Finance / Accounting: fin_policies  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS fin_policies_write_restrict_insert ON fin_policies;
CREATE POLICY fin_policies_write_restrict_insert ON fin_policies AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.admin','finance.manage']));
DROP POLICY IF EXISTS fin_policies_write_restrict_update ON fin_policies;
CREATE POLICY fin_policies_write_restrict_update ON fin_policies AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.admin','finance.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.admin','finance.manage']));
DROP POLICY IF EXISTS fin_policies_write_restrict_delete ON fin_policies;
CREATE POLICY fin_policies_write_restrict_delete ON fin_policies AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.admin','finance.manage']));
-- ----------------------------------------------------------------------------
-- Finance / Accounting: fin_posting_batches  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS fin_posting_batches_write_restrict_insert ON fin_posting_batches;
CREATE POLICY fin_posting_batches_write_restrict_insert ON fin_posting_batches AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.post','finance.manage']));
DROP POLICY IF EXISTS fin_posting_batches_write_restrict_update ON fin_posting_batches;
CREATE POLICY fin_posting_batches_write_restrict_update ON fin_posting_batches AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.post','finance.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.post','finance.manage']));
DROP POLICY IF EXISTS fin_posting_batches_write_restrict_delete ON fin_posting_batches;
CREATE POLICY fin_posting_batches_write_restrict_delete ON fin_posting_batches AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.post','finance.manage']));
-- ----------------------------------------------------------------------------
-- Finance / Accounting: fin_posting_rules  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS fin_posting_rules_write_restrict_insert ON fin_posting_rules;
CREATE POLICY fin_posting_rules_write_restrict_insert ON fin_posting_rules AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.post','finance.manage']));
DROP POLICY IF EXISTS fin_posting_rules_write_restrict_update ON fin_posting_rules;
CREATE POLICY fin_posting_rules_write_restrict_update ON fin_posting_rules AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.post','finance.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.post','finance.manage']));
DROP POLICY IF EXISTS fin_posting_rules_write_restrict_delete ON fin_posting_rules;
CREATE POLICY fin_posting_rules_write_restrict_delete ON fin_posting_rules AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.post','finance.manage']));
-- ----------------------------------------------------------------------------
-- Finance / Accounting: fin_production_profitability  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS fin_production_profitability_write_restrict_insert ON fin_production_profitability;
CREATE POLICY fin_production_profitability_write_restrict_insert ON fin_production_profitability AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.costing','finance.manage']));
DROP POLICY IF EXISTS fin_production_profitability_write_restrict_update ON fin_production_profitability;
CREATE POLICY fin_production_profitability_write_restrict_update ON fin_production_profitability AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.costing','finance.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.costing','finance.manage']));
DROP POLICY IF EXISTS fin_production_profitability_write_restrict_delete ON fin_production_profitability;
CREATE POLICY fin_production_profitability_write_restrict_delete ON fin_production_profitability AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.costing','finance.manage']));
-- ----------------------------------------------------------------------------
-- Finance / Accounting: fin_profit_centers  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS fin_profit_centers_write_restrict_insert ON fin_profit_centers;
CREATE POLICY fin_profit_centers_write_restrict_insert ON fin_profit_centers AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage']));
DROP POLICY IF EXISTS fin_profit_centers_write_restrict_update ON fin_profit_centers;
CREATE POLICY fin_profit_centers_write_restrict_update ON fin_profit_centers AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage']));
DROP POLICY IF EXISTS fin_profit_centers_write_restrict_delete ON fin_profit_centers;
CREATE POLICY fin_profit_centers_write_restrict_delete ON fin_profit_centers AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage']));
-- ----------------------------------------------------------------------------
-- Finance / Accounting: fin_project_billing  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS fin_project_billing_write_restrict_insert ON fin_project_billing;
CREATE POLICY fin_project_billing_write_restrict_insert ON fin_project_billing AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage','billing.projects']));
DROP POLICY IF EXISTS fin_project_billing_write_restrict_update ON fin_project_billing;
CREATE POLICY fin_project_billing_write_restrict_update ON fin_project_billing AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage','billing.projects']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage','billing.projects']));
DROP POLICY IF EXISTS fin_project_billing_write_restrict_delete ON fin_project_billing;
CREATE POLICY fin_project_billing_write_restrict_delete ON fin_project_billing AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage','billing.projects']));
-- ----------------------------------------------------------------------------
-- Finance / Accounting: fin_project_costs  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS fin_project_costs_write_restrict_insert ON fin_project_costs;
CREATE POLICY fin_project_costs_write_restrict_insert ON fin_project_costs AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage','ppm.finance']));
DROP POLICY IF EXISTS fin_project_costs_write_restrict_update ON fin_project_costs;
CREATE POLICY fin_project_costs_write_restrict_update ON fin_project_costs AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage','ppm.finance']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage','ppm.finance']));
DROP POLICY IF EXISTS fin_project_costs_write_restrict_delete ON fin_project_costs;
CREATE POLICY fin_project_costs_write_restrict_delete ON fin_project_costs AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage','ppm.finance']));
-- ----------------------------------------------------------------------------
-- Finance / Accounting: fin_project_profitability  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS fin_project_profitability_write_restrict_insert ON fin_project_profitability;
CREATE POLICY fin_project_profitability_write_restrict_insert ON fin_project_profitability AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage','ppm.finance']));
DROP POLICY IF EXISTS fin_project_profitability_write_restrict_update ON fin_project_profitability;
CREATE POLICY fin_project_profitability_write_restrict_update ON fin_project_profitability AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage','ppm.finance']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage','ppm.finance']));
DROP POLICY IF EXISTS fin_project_profitability_write_restrict_delete ON fin_project_profitability;
CREATE POLICY fin_project_profitability_write_restrict_delete ON fin_project_profitability AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage','ppm.finance']));
-- ----------------------------------------------------------------------------
-- Finance / Accounting: fin_reconciliations  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS fin_reconciliations_write_restrict_insert ON fin_reconciliations;
CREATE POLICY fin_reconciliations_write_restrict_insert ON fin_reconciliations AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage','finance.admin']));
DROP POLICY IF EXISTS fin_reconciliations_write_restrict_update ON fin_reconciliations;
CREATE POLICY fin_reconciliations_write_restrict_update ON fin_reconciliations AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage','finance.admin']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage','finance.admin']));
DROP POLICY IF EXISTS fin_reconciliations_write_restrict_delete ON fin_reconciliations;
CREATE POLICY fin_reconciliations_write_restrict_delete ON fin_reconciliations AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage','finance.admin']));
-- ----------------------------------------------------------------------------
-- Finance / Accounting: fin_recurring_invoices  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS fin_recurring_invoices_write_restrict_insert ON fin_recurring_invoices;
CREATE POLICY fin_recurring_invoices_write_restrict_insert ON fin_recurring_invoices AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage','billing.recurring']));
DROP POLICY IF EXISTS fin_recurring_invoices_write_restrict_update ON fin_recurring_invoices;
CREATE POLICY fin_recurring_invoices_write_restrict_update ON fin_recurring_invoices AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage','billing.recurring']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage','billing.recurring']));
DROP POLICY IF EXISTS fin_recurring_invoices_write_restrict_delete ON fin_recurring_invoices;
CREATE POLICY fin_recurring_invoices_write_restrict_delete ON fin_recurring_invoices AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage','billing.recurring']));
-- ----------------------------------------------------------------------------
-- Finance / Accounting: fin_recurring_journals  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS fin_recurring_journals_write_restrict_insert ON fin_recurring_journals;
CREATE POLICY fin_recurring_journals_write_restrict_insert ON fin_recurring_journals AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.post','finance.manage']));
DROP POLICY IF EXISTS fin_recurring_journals_write_restrict_update ON fin_recurring_journals;
CREATE POLICY fin_recurring_journals_write_restrict_update ON fin_recurring_journals AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.post','finance.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.post','finance.manage']));
DROP POLICY IF EXISTS fin_recurring_journals_write_restrict_delete ON fin_recurring_journals;
CREATE POLICY fin_recurring_journals_write_restrict_delete ON fin_recurring_journals AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.post','finance.manage']));
-- ----------------------------------------------------------------------------
-- Finance / Accounting: fin_revenue_recognition  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS fin_revenue_recognition_write_restrict_insert ON fin_revenue_recognition;
CREATE POLICY fin_revenue_recognition_write_restrict_insert ON fin_revenue_recognition AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage']));
DROP POLICY IF EXISTS fin_revenue_recognition_write_restrict_update ON fin_revenue_recognition;
CREATE POLICY fin_revenue_recognition_write_restrict_update ON fin_revenue_recognition AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage']));
DROP POLICY IF EXISTS fin_revenue_recognition_write_restrict_delete ON fin_revenue_recognition;
CREATE POLICY fin_revenue_recognition_write_restrict_delete ON fin_revenue_recognition AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage']));
-- ----------------------------------------------------------------------------
-- Finance / Accounting: fin_risk_register  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS fin_risk_register_write_restrict_insert ON fin_risk_register;
CREATE POLICY fin_risk_register_write_restrict_insert ON fin_risk_register AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage','ec.risk']));
DROP POLICY IF EXISTS fin_risk_register_write_restrict_update ON fin_risk_register;
CREATE POLICY fin_risk_register_write_restrict_update ON fin_risk_register AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage','ec.risk']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage','ec.risk']));
DROP POLICY IF EXISTS fin_risk_register_write_restrict_delete ON fin_risk_register;
CREATE POLICY fin_risk_register_write_restrict_delete ON fin_risk_register AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage','ec.risk']));
-- ----------------------------------------------------------------------------
-- Finance / Accounting: fin_settings  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS fin_settings_write_restrict_insert ON fin_settings;
CREATE POLICY fin_settings_write_restrict_insert ON fin_settings AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.admin','finance.manage']));
DROP POLICY IF EXISTS fin_settings_write_restrict_update ON fin_settings;
CREATE POLICY fin_settings_write_restrict_update ON fin_settings AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.admin','finance.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.admin','finance.manage']));
DROP POLICY IF EXISTS fin_settings_write_restrict_delete ON fin_settings;
CREATE POLICY fin_settings_write_restrict_delete ON fin_settings AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.admin','finance.manage']));
-- ----------------------------------------------------------------------------
-- Finance / Accounting: fin_sod_rules  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS fin_sod_rules_write_restrict_insert ON fin_sod_rules;
CREATE POLICY fin_sod_rules_write_restrict_insert ON fin_sod_rules AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.admin','finance.manage']));
DROP POLICY IF EXISTS fin_sod_rules_write_restrict_update ON fin_sod_rules;
CREATE POLICY fin_sod_rules_write_restrict_update ON fin_sod_rules AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.admin','finance.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.admin','finance.manage']));
DROP POLICY IF EXISTS fin_sod_rules_write_restrict_delete ON fin_sod_rules;
CREATE POLICY fin_sod_rules_write_restrict_delete ON fin_sod_rules AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.admin','finance.manage']));
-- ----------------------------------------------------------------------------
-- Finance / Accounting: fin_standard_costs  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS fin_standard_costs_write_restrict_insert ON fin_standard_costs;
CREATE POLICY fin_standard_costs_write_restrict_insert ON fin_standard_costs AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.costing','finance.manage']));
DROP POLICY IF EXISTS fin_standard_costs_write_restrict_update ON fin_standard_costs;
CREATE POLICY fin_standard_costs_write_restrict_update ON fin_standard_costs AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.costing','finance.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.costing','finance.manage']));
DROP POLICY IF EXISTS fin_standard_costs_write_restrict_delete ON fin_standard_costs;
CREATE POLICY fin_standard_costs_write_restrict_delete ON fin_standard_costs AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.costing','finance.manage']));
-- ----------------------------------------------------------------------------
-- Finance / Accounting: fin_stock_revaluations  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS fin_stock_revaluations_write_restrict_insert ON fin_stock_revaluations;
CREATE POLICY fin_stock_revaluations_write_restrict_insert ON fin_stock_revaluations AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.costing','finance.manage']));
DROP POLICY IF EXISTS fin_stock_revaluations_write_restrict_update ON fin_stock_revaluations;
CREATE POLICY fin_stock_revaluations_write_restrict_update ON fin_stock_revaluations AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.costing','finance.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.costing','finance.manage']));
DROP POLICY IF EXISTS fin_stock_revaluations_write_restrict_delete ON fin_stock_revaluations;
CREATE POLICY fin_stock_revaluations_write_restrict_delete ON fin_stock_revaluations AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.costing','finance.manage']));
-- ----------------------------------------------------------------------------
-- Finance / Accounting: fin_subscription_revenue  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS fin_subscription_revenue_write_restrict_insert ON fin_subscription_revenue;
CREATE POLICY fin_subscription_revenue_write_restrict_insert ON fin_subscription_revenue AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage','billing.recurring']));
DROP POLICY IF EXISTS fin_subscription_revenue_write_restrict_update ON fin_subscription_revenue;
CREATE POLICY fin_subscription_revenue_write_restrict_update ON fin_subscription_revenue AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage','billing.recurring']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage','billing.recurring']));
DROP POLICY IF EXISTS fin_subscription_revenue_write_restrict_delete ON fin_subscription_revenue;
CREATE POLICY fin_subscription_revenue_write_restrict_delete ON fin_subscription_revenue AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage','billing.recurring']));
-- ----------------------------------------------------------------------------
-- Finance / Accounting: fin_supplier_recon  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS fin_supplier_recon_write_restrict_insert ON fin_supplier_recon;
CREATE POLICY fin_supplier_recon_write_restrict_insert ON fin_supplier_recon AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage','finance.admin']));
DROP POLICY IF EXISTS fin_supplier_recon_write_restrict_update ON fin_supplier_recon;
CREATE POLICY fin_supplier_recon_write_restrict_update ON fin_supplier_recon AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage','finance.admin']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage','finance.admin']));
DROP POLICY IF EXISTS fin_supplier_recon_write_restrict_delete ON fin_supplier_recon;
CREATE POLICY fin_supplier_recon_write_restrict_delete ON fin_supplier_recon AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage','finance.admin']));
-- ----------------------------------------------------------------------------
-- Finance / Accounting: fin_supplier_statements  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS fin_supplier_statements_write_restrict_insert ON fin_supplier_statements;
CREATE POLICY fin_supplier_statements_write_restrict_insert ON fin_supplier_statements AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage','finance.admin']));
DROP POLICY IF EXISTS fin_supplier_statements_write_restrict_update ON fin_supplier_statements;
CREATE POLICY fin_supplier_statements_write_restrict_update ON fin_supplier_statements AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage','finance.admin']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage','finance.admin']));
DROP POLICY IF EXISTS fin_supplier_statements_write_restrict_delete ON fin_supplier_statements;
CREATE POLICY fin_supplier_statements_write_restrict_delete ON fin_supplier_statements AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage','finance.admin']));
-- ----------------------------------------------------------------------------
-- Finance / Accounting: fin_tax_calendar  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS fin_tax_calendar_write_restrict_insert ON fin_tax_calendar;
CREATE POLICY fin_tax_calendar_write_restrict_insert ON fin_tax_calendar AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.tax','finance.manage']));
DROP POLICY IF EXISTS fin_tax_calendar_write_restrict_update ON fin_tax_calendar;
CREATE POLICY fin_tax_calendar_write_restrict_update ON fin_tax_calendar AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.tax','finance.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.tax','finance.manage']));
DROP POLICY IF EXISTS fin_tax_calendar_write_restrict_delete ON fin_tax_calendar;
CREATE POLICY fin_tax_calendar_write_restrict_delete ON fin_tax_calendar AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.tax','finance.manage']));
-- ----------------------------------------------------------------------------
-- Finance / Accounting: fin_tax_jurisdictions  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS fin_tax_jurisdictions_write_restrict_insert ON fin_tax_jurisdictions;
CREATE POLICY fin_tax_jurisdictions_write_restrict_insert ON fin_tax_jurisdictions AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.tax','finance.manage']));
DROP POLICY IF EXISTS fin_tax_jurisdictions_write_restrict_update ON fin_tax_jurisdictions;
CREATE POLICY fin_tax_jurisdictions_write_restrict_update ON fin_tax_jurisdictions AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.tax','finance.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.tax','finance.manage']));
DROP POLICY IF EXISTS fin_tax_jurisdictions_write_restrict_delete ON fin_tax_jurisdictions;
CREATE POLICY fin_tax_jurisdictions_write_restrict_delete ON fin_tax_jurisdictions AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.tax','finance.manage']));
-- ----------------------------------------------------------------------------
-- Finance / Accounting: fin_trial_balance  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS fin_trial_balance_write_restrict_insert ON fin_trial_balance;
CREATE POLICY fin_trial_balance_write_restrict_insert ON fin_trial_balance AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.close','finance.manage']));
DROP POLICY IF EXISTS fin_trial_balance_write_restrict_update ON fin_trial_balance;
CREATE POLICY fin_trial_balance_write_restrict_update ON fin_trial_balance AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.close','finance.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.close','finance.manage']));
DROP POLICY IF EXISTS fin_trial_balance_write_restrict_delete ON fin_trial_balance;
CREATE POLICY fin_trial_balance_write_restrict_delete ON fin_trial_balance AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.close','finance.manage']));
-- ----------------------------------------------------------------------------
-- Finance / Accounting: fin_wip  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS fin_wip_write_restrict_insert ON fin_wip;
CREATE POLICY fin_wip_write_restrict_insert ON fin_wip AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.costing','finance.manage']));
DROP POLICY IF EXISTS fin_wip_write_restrict_update ON fin_wip;
CREATE POLICY fin_wip_write_restrict_update ON fin_wip AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.costing','finance.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.costing','finance.manage']));
DROP POLICY IF EXISTS fin_wip_write_restrict_delete ON fin_wip;
CREATE POLICY fin_wip_write_restrict_delete ON fin_wip AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.costing','finance.manage']));
-- ----------------------------------------------------------------------------
-- Finance / Accounting: fin_withholding_tax  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS fin_withholding_tax_write_restrict_insert ON fin_withholding_tax;
CREATE POLICY fin_withholding_tax_write_restrict_insert ON fin_withholding_tax AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.tax','finance.manage']));
DROP POLICY IF EXISTS fin_withholding_tax_write_restrict_update ON fin_withholding_tax;
CREATE POLICY fin_withholding_tax_write_restrict_update ON fin_withholding_tax AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.tax','finance.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.tax','finance.manage']));
DROP POLICY IF EXISTS fin_withholding_tax_write_restrict_delete ON fin_withholding_tax;
CREATE POLICY fin_withholding_tax_write_restrict_delete ON fin_withholding_tax AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.tax','finance.manage']));
-- ----------------------------------------------------------------------------
-- Finance / Accounting: fiscal_years  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS fiscal_years_write_restrict_insert ON fiscal_years;
CREATE POLICY fiscal_years_write_restrict_insert ON fiscal_years AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage','finance.close']));
DROP POLICY IF EXISTS fiscal_years_write_restrict_update ON fiscal_years;
CREATE POLICY fiscal_years_write_restrict_update ON fiscal_years AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage','finance.close']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage','finance.close']));
DROP POLICY IF EXISTS fiscal_years_write_restrict_delete ON fiscal_years;
CREATE POLICY fiscal_years_write_restrict_delete ON fiscal_years AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage','finance.close']));
-- ----------------------------------------------------------------------------
-- ERP: fiscal_periods  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS fiscal_periods_write_restrict_insert ON fiscal_periods;
CREATE POLICY fiscal_periods_write_restrict_insert ON fiscal_periods AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage','finance.close']));
DROP POLICY IF EXISTS fiscal_periods_write_restrict_update ON fiscal_periods;
CREATE POLICY fiscal_periods_write_restrict_update ON fiscal_periods AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage','finance.close']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage','finance.close']));
DROP POLICY IF EXISTS fiscal_periods_write_restrict_delete ON fiscal_periods;
CREATE POLICY fiscal_periods_write_restrict_delete ON fiscal_periods AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage','finance.close']));
-- ----------------------------------------------------------------------------
-- Finance / Accounting: fixed_assets  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS fixed_assets_write_restrict_insert ON fixed_assets;
CREATE POLICY fixed_assets_write_restrict_insert ON fixed_assets AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage','inventory.manage']));
DROP POLICY IF EXISTS fixed_assets_write_restrict_update ON fixed_assets;
CREATE POLICY fixed_assets_write_restrict_update ON fixed_assets AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage','inventory.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage','inventory.manage']));
DROP POLICY IF EXISTS fixed_assets_write_restrict_delete ON fixed_assets;
CREATE POLICY fixed_assets_write_restrict_delete ON fixed_assets AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage','inventory.manage']));
-- ----------------------------------------------------------------------------
-- Inventory / SCM: goods_receipts  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS goods_receipts_write_restrict_insert ON goods_receipts;
CREATE POLICY goods_receipts_write_restrict_insert ON goods_receipts AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['inventory.grn','inventory.manage']));
DROP POLICY IF EXISTS goods_receipts_write_restrict_update ON goods_receipts;
CREATE POLICY goods_receipts_write_restrict_update ON goods_receipts AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['inventory.grn','inventory.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['inventory.grn','inventory.manage']));
DROP POLICY IF EXISTS goods_receipts_write_restrict_delete ON goods_receipts;
CREATE POLICY goods_receipts_write_restrict_delete ON goods_receipts AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['inventory.grn','inventory.manage']));
-- ----------------------------------------------------------------------------
-- Inventory / SCM: goods_receipt_lines  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS goods_receipt_lines_write_restrict_insert ON goods_receipt_lines;
CREATE POLICY goods_receipt_lines_write_restrict_insert ON goods_receipt_lines AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['inventory.grn','inventory.manage']));
DROP POLICY IF EXISTS goods_receipt_lines_write_restrict_update ON goods_receipt_lines;
CREATE POLICY goods_receipt_lines_write_restrict_update ON goods_receipt_lines AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['inventory.grn','inventory.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['inventory.grn','inventory.manage']));
DROP POLICY IF EXISTS goods_receipt_lines_write_restrict_delete ON goods_receipt_lines;
CREATE POLICY goods_receipt_lines_write_restrict_delete ON goods_receipt_lines AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['inventory.grn','inventory.manage']));
-- ----------------------------------------------------------------------------
-- Inventory / SCM: inventory_inspections  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS inventory_inspections_write_restrict_insert ON inventory_inspections;
CREATE POLICY inventory_inspections_write_restrict_insert ON inventory_inspections AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['inventory.qc','inventory.manage']));
DROP POLICY IF EXISTS inventory_inspections_write_restrict_update ON inventory_inspections;
CREATE POLICY inventory_inspections_write_restrict_update ON inventory_inspections AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['inventory.qc','inventory.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['inventory.qc','inventory.manage']));
DROP POLICY IF EXISTS inventory_inspections_write_restrict_delete ON inventory_inspections;
CREATE POLICY inventory_inspections_write_restrict_delete ON inventory_inspections AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['inventory.qc','inventory.manage']));
-- ----------------------------------------------------------------------------
-- Inventory / SCM: inventory_valuations  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS inventory_valuations_write_restrict_insert ON inventory_valuations;
CREATE POLICY inventory_valuations_write_restrict_insert ON inventory_valuations AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['inventory.valuation','inventory.manage']));
DROP POLICY IF EXISTS inventory_valuations_write_restrict_update ON inventory_valuations;
CREATE POLICY inventory_valuations_write_restrict_update ON inventory_valuations AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['inventory.valuation','inventory.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['inventory.valuation','inventory.manage']));
DROP POLICY IF EXISTS inventory_valuations_write_restrict_delete ON inventory_valuations;
CREATE POLICY inventory_valuations_write_restrict_delete ON inventory_valuations AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['inventory.valuation','inventory.manage']));
-- ----------------------------------------------------------------------------
-- SCM / Supplier Management: scm_sustainability  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS scm_sustainability_write_restrict_insert ON scm_sustainability;
CREATE POLICY scm_sustainability_write_restrict_insert ON scm_sustainability AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['scm.manage']));
DROP POLICY IF EXISTS scm_sustainability_write_restrict_update ON scm_sustainability;
CREATE POLICY scm_sustainability_write_restrict_update ON scm_sustainability AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['scm.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['scm.manage']));
DROP POLICY IF EXISTS scm_sustainability_write_restrict_delete ON scm_sustainability;
CREATE POLICY scm_sustainability_write_restrict_delete ON scm_sustainability AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['scm.manage']));
-- ----------------------------------------------------------------------------
-- SCM / Supplier Management: supplier_scorecards  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS supplier_scorecards_write_restrict_insert ON supplier_scorecards;
CREATE POLICY supplier_scorecards_write_restrict_insert ON supplier_scorecards AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['scm.manage','srm.manage']));
DROP POLICY IF EXISTS supplier_scorecards_write_restrict_update ON supplier_scorecards;
CREATE POLICY supplier_scorecards_write_restrict_update ON supplier_scorecards AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['scm.manage','srm.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['scm.manage','srm.manage']));
DROP POLICY IF EXISTS supplier_scorecards_write_restrict_delete ON supplier_scorecards;
CREATE POLICY supplier_scorecards_write_restrict_delete ON supplier_scorecards AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['scm.manage','srm.manage']));
-- ----------------------------------------------------------------------------
-- SCM / Supplier Management: supply_chain_risks  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS supply_chain_risks_write_restrict_insert ON supply_chain_risks;
CREATE POLICY supply_chain_risks_write_restrict_insert ON supply_chain_risks AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['scm.risk','scm.manage']));
DROP POLICY IF EXISTS supply_chain_risks_write_restrict_update ON supply_chain_risks;
CREATE POLICY supply_chain_risks_write_restrict_update ON supply_chain_risks AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['scm.risk','scm.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['scm.risk','scm.manage']));
DROP POLICY IF EXISTS supply_chain_risks_write_restrict_delete ON supply_chain_risks;
CREATE POLICY supply_chain_risks_write_restrict_delete ON supply_chain_risks AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['scm.risk','scm.manage']));
-- ----------------------------------------------------------------------------
-- HR / Workforce: hr_cases  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS hr_cases_write_restrict_insert ON hr_cases;
CREATE POLICY hr_cases_write_restrict_insert ON hr_cases AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['hr.manage']));
DROP POLICY IF EXISTS hr_cases_write_restrict_update ON hr_cases;
CREATE POLICY hr_cases_write_restrict_update ON hr_cases AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['hr.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['hr.manage']));
DROP POLICY IF EXISTS hr_cases_write_restrict_delete ON hr_cases;
CREATE POLICY hr_cases_write_restrict_delete ON hr_cases AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['hr.manage']));
-- ----------------------------------------------------------------------------
-- HR / Workforce: labor_cost_entries  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS labor_cost_entries_write_restrict_insert ON labor_cost_entries;
CREATE POLICY labor_cost_entries_write_restrict_insert ON labor_cost_entries AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['hr.manage','payroll.costing']));
DROP POLICY IF EXISTS labor_cost_entries_write_restrict_update ON labor_cost_entries;
CREATE POLICY labor_cost_entries_write_restrict_update ON labor_cost_entries AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['hr.manage','payroll.costing']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['hr.manage','payroll.costing']));
DROP POLICY IF EXISTS labor_cost_entries_write_restrict_delete ON labor_cost_entries;
CREATE POLICY labor_cost_entries_write_restrict_delete ON labor_cost_entries AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['hr.manage','payroll.costing']));
-- ----------------------------------------------------------------------------
-- HR / Workforce: employee_skills  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS employee_skills_write_restrict_insert ON employee_skills;
CREATE POLICY employee_skills_write_restrict_insert ON employee_skills AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['hr.manage']));
DROP POLICY IF EXISTS employee_skills_write_restrict_update ON employee_skills;
CREATE POLICY employee_skills_write_restrict_update ON employee_skills AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['hr.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['hr.manage']));
DROP POLICY IF EXISTS employee_skills_write_restrict_delete ON employee_skills;
CREATE POLICY employee_skills_write_restrict_delete ON employee_skills AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['hr.manage']));
-- ----------------------------------------------------------------------------
-- HR / Workforce: employee_objectives  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS employee_objectives_write_restrict_insert ON employee_objectives;
CREATE POLICY employee_objectives_write_restrict_insert ON employee_objectives AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['hr.manage','hr.performance']));
DROP POLICY IF EXISTS employee_objectives_write_restrict_update ON employee_objectives;
CREATE POLICY employee_objectives_write_restrict_update ON employee_objectives AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['hr.manage','hr.performance']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['hr.manage','hr.performance']));
DROP POLICY IF EXISTS employee_objectives_write_restrict_delete ON employee_objectives;
CREATE POLICY employee_objectives_write_restrict_delete ON employee_objectives AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['hr.manage','hr.performance']));
-- ----------------------------------------------------------------------------
-- HR / Workforce: employee_assets  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS employee_assets_write_restrict_insert ON employee_assets;
CREATE POLICY employee_assets_write_restrict_insert ON employee_assets AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['hr.manage','ast.manage']));
DROP POLICY IF EXISTS employee_assets_write_restrict_update ON employee_assets;
CREATE POLICY employee_assets_write_restrict_update ON employee_assets AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['hr.manage','ast.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['hr.manage','ast.manage']));
DROP POLICY IF EXISTS employee_assets_write_restrict_delete ON employee_assets;
CREATE POLICY employee_assets_write_restrict_delete ON employee_assets AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['hr.manage','ast.manage']));
-- ----------------------------------------------------------------------------
-- HR / Workforce: employee_exits  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS employee_exits_write_restrict_insert ON employee_exits;
CREATE POLICY employee_exits_write_restrict_insert ON employee_exits AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['hr.manage']));
DROP POLICY IF EXISTS employee_exits_write_restrict_update ON employee_exits;
CREATE POLICY employee_exits_write_restrict_update ON employee_exits AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['hr.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['hr.manage']));
DROP POLICY IF EXISTS employee_exits_write_restrict_delete ON employee_exits;
CREATE POLICY employee_exits_write_restrict_delete ON employee_exits AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['hr.manage']));
-- ----------------------------------------------------------------------------
-- HR / Workforce: job_requisitions  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS job_requisitions_write_restrict_insert ON job_requisitions;
CREATE POLICY job_requisitions_write_restrict_insert ON job_requisitions AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['hr.recruit','hr.manage']));
DROP POLICY IF EXISTS job_requisitions_write_restrict_update ON job_requisitions;
CREATE POLICY job_requisitions_write_restrict_update ON job_requisitions AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['hr.recruit','hr.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['hr.recruit','hr.manage']));
DROP POLICY IF EXISTS job_requisitions_write_restrict_delete ON job_requisitions;
CREATE POLICY job_requisitions_write_restrict_delete ON job_requisitions AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['hr.recruit','hr.manage']));
-- ----------------------------------------------------------------------------
-- HR / Workforce: job_applicants  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS job_applicants_write_restrict_insert ON job_applicants;
CREATE POLICY job_applicants_write_restrict_insert ON job_applicants AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['hr.recruit','hr.manage']));
DROP POLICY IF EXISTS job_applicants_write_restrict_update ON job_applicants;
CREATE POLICY job_applicants_write_restrict_update ON job_applicants AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['hr.recruit','hr.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['hr.recruit','hr.manage']));
DROP POLICY IF EXISTS job_applicants_write_restrict_delete ON job_applicants;
CREATE POLICY job_applicants_write_restrict_delete ON job_applicants AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['hr.recruit','hr.manage']));
-- ----------------------------------------------------------------------------
-- HR / Workforce: skill_catalog  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS skill_catalog_write_restrict_insert ON skill_catalog;
CREATE POLICY skill_catalog_write_restrict_insert ON skill_catalog AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['hr.manage']));
DROP POLICY IF EXISTS skill_catalog_write_restrict_update ON skill_catalog;
CREATE POLICY skill_catalog_write_restrict_update ON skill_catalog AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['hr.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['hr.manage']));
DROP POLICY IF EXISTS skill_catalog_write_restrict_delete ON skill_catalog;
CREATE POLICY skill_catalog_write_restrict_delete ON skill_catalog AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['hr.manage']));
-- ----------------------------------------------------------------------------
-- Production / MRP: mrp_runs  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS mrp_runs_write_restrict_insert ON mrp_runs;
CREATE POLICY mrp_runs_write_restrict_insert ON mrp_runs AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['production.manage','mes.planning']));
DROP POLICY IF EXISTS mrp_runs_write_restrict_update ON mrp_runs;
CREATE POLICY mrp_runs_write_restrict_update ON mrp_runs AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['production.manage','mes.planning']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['production.manage','mes.planning']));
DROP POLICY IF EXISTS mrp_runs_write_restrict_delete ON mrp_runs;
CREATE POLICY mrp_runs_write_restrict_delete ON mrp_runs AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['production.manage','mes.planning']));
-- ----------------------------------------------------------------------------
-- Production / MRP: mrp_recommendations  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS mrp_recommendations_write_restrict_insert ON mrp_recommendations;
CREATE POLICY mrp_recommendations_write_restrict_insert ON mrp_recommendations AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['production.manage','mes.planning']));
DROP POLICY IF EXISTS mrp_recommendations_write_restrict_update ON mrp_recommendations;
CREATE POLICY mrp_recommendations_write_restrict_update ON mrp_recommendations AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['production.manage','mes.planning']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['production.manage','mes.planning']));
DROP POLICY IF EXISTS mrp_recommendations_write_restrict_delete ON mrp_recommendations;
CREATE POLICY mrp_recommendations_write_restrict_delete ON mrp_recommendations AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['production.manage','mes.planning']));
-- ----------------------------------------------------------------------------
-- Production / MRP: production_machines  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS production_machines_write_restrict_insert ON production_machines;
CREATE POLICY production_machines_write_restrict_insert ON production_machines AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['production.manage','mes.manage']));
DROP POLICY IF EXISTS production_machines_write_restrict_update ON production_machines;
CREATE POLICY production_machines_write_restrict_update ON production_machines AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['production.manage','mes.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['production.manage','mes.manage']));
DROP POLICY IF EXISTS production_machines_write_restrict_delete ON production_machines;
CREATE POLICY production_machines_write_restrict_delete ON production_machines AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['production.manage','mes.manage']));
-- ----------------------------------------------------------------------------
-- Production / MRP: demand_forecasts  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS demand_forecasts_write_restrict_insert ON demand_forecasts;
CREATE POLICY demand_forecasts_write_restrict_insert ON demand_forecasts AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['sales.forecast','inventory.manage']));
DROP POLICY IF EXISTS demand_forecasts_write_restrict_update ON demand_forecasts;
CREATE POLICY demand_forecasts_write_restrict_update ON demand_forecasts AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['sales.forecast','inventory.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['sales.forecast','inventory.manage']));
DROP POLICY IF EXISTS demand_forecasts_write_restrict_delete ON demand_forecasts;
CREATE POLICY demand_forecasts_write_restrict_delete ON demand_forecasts AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['sales.forecast','inventory.manage']));
-- ----------------------------------------------------------------------------
-- Inventory / SCM: cycle_counts  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS cycle_counts_write_restrict_insert ON cycle_counts;
CREATE POLICY cycle_counts_write_restrict_insert ON cycle_counts AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['inventory.manage','inventory.qc']));
DROP POLICY IF EXISTS cycle_counts_write_restrict_update ON cycle_counts;
CREATE POLICY cycle_counts_write_restrict_update ON cycle_counts AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['inventory.manage','inventory.qc']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['inventory.manage','inventory.qc']));
DROP POLICY IF EXISTS cycle_counts_write_restrict_delete ON cycle_counts;
CREATE POLICY cycle_counts_write_restrict_delete ON cycle_counts AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['inventory.manage','inventory.qc']));
-- ----------------------------------------------------------------------------
-- Inventory / SCM: cycle_count_lines  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS cycle_count_lines_write_restrict_insert ON cycle_count_lines;
CREATE POLICY cycle_count_lines_write_restrict_insert ON cycle_count_lines AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['inventory.manage','inventory.qc']));
DROP POLICY IF EXISTS cycle_count_lines_write_restrict_update ON cycle_count_lines;
CREATE POLICY cycle_count_lines_write_restrict_update ON cycle_count_lines AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['inventory.manage','inventory.qc']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['inventory.manage','inventory.qc']));
DROP POLICY IF EXISTS cycle_count_lines_write_restrict_delete ON cycle_count_lines;
CREATE POLICY cycle_count_lines_write_restrict_delete ON cycle_count_lines AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['inventory.manage','inventory.qc']));
-- ----------------------------------------------------------------------------
-- Inventory / SCM: cartons  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS cartons_write_restrict_insert ON cartons;
CREATE POLICY cartons_write_restrict_insert ON cartons AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['inventory.manage','pkg.manage']));
DROP POLICY IF EXISTS cartons_write_restrict_update ON cartons;
CREATE POLICY cartons_write_restrict_update ON cartons AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['inventory.manage','pkg.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['inventory.manage','pkg.manage']));
DROP POLICY IF EXISTS cartons_write_restrict_delete ON cartons;
CREATE POLICY cartons_write_restrict_delete ON cartons AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['inventory.manage','pkg.manage']));
-- ----------------------------------------------------------------------------
-- Inventory / SCM: reams  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS reams_write_restrict_insert ON reams;
CREATE POLICY reams_write_restrict_insert ON reams AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['inventory.manage']));
DROP POLICY IF EXISTS reams_write_restrict_update ON reams;
CREATE POLICY reams_write_restrict_update ON reams AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['inventory.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['inventory.manage']));
DROP POLICY IF EXISTS reams_write_restrict_delete ON reams;
CREATE POLICY reams_write_restrict_delete ON reams AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['inventory.manage']));
-- ----------------------------------------------------------------------------
-- Sales / CRM: retailers  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS retailers_write_restrict_insert ON retailers;
CREATE POLICY retailers_write_restrict_insert ON retailers AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['sales.manage','crm.manage']));
DROP POLICY IF EXISTS retailers_write_restrict_update ON retailers;
CREATE POLICY retailers_write_restrict_update ON retailers AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['sales.manage','crm.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['sales.manage','crm.manage']));
DROP POLICY IF EXISTS retailers_write_restrict_delete ON retailers;
CREATE POLICY retailers_write_restrict_delete ON retailers AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['sales.manage','crm.manage']));
-- ----------------------------------------------------------------------------
-- Sales / CRM: distributors  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS distributors_write_restrict_insert ON distributors;
CREATE POLICY distributors_write_restrict_insert ON distributors AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['sales.manage','crm.manage']));
DROP POLICY IF EXISTS distributors_write_restrict_update ON distributors;
CREATE POLICY distributors_write_restrict_update ON distributors AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['sales.manage','crm.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['sales.manage','crm.manage']));
DROP POLICY IF EXISTS distributors_write_restrict_delete ON distributors;
CREATE POLICY distributors_write_restrict_delete ON distributors AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['sales.manage','crm.manage']));
-- ----------------------------------------------------------------------------
-- Production / MRP: factories  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS factories_write_restrict_insert ON factories;
CREATE POLICY factories_write_restrict_insert ON factories AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['production.manage','settings.manage']));
DROP POLICY IF EXISTS factories_write_restrict_update ON factories;
CREATE POLICY factories_write_restrict_update ON factories AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['production.manage','settings.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['production.manage','settings.manage']));
DROP POLICY IF EXISTS factories_write_restrict_delete ON factories;
CREATE POLICY factories_write_restrict_delete ON factories AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['production.manage','settings.manage']));
-- ----------------------------------------------------------------------------
-- Org / Settings: branches  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS branches_write_restrict_insert ON branches;
CREATE POLICY branches_write_restrict_insert ON branches AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['settings.manage']));
DROP POLICY IF EXISTS branches_write_restrict_update ON branches;
CREATE POLICY branches_write_restrict_update ON branches AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['settings.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['settings.manage']));
DROP POLICY IF EXISTS branches_write_restrict_delete ON branches;
CREATE POLICY branches_write_restrict_delete ON branches AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['settings.manage']));
-- ----------------------------------------------------------------------------
-- Finance / Accounting: exchange_rates  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS exchange_rates_write_restrict_insert ON exchange_rates;
CREATE POLICY exchange_rates_write_restrict_insert ON exchange_rates AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage']));
DROP POLICY IF EXISTS exchange_rates_write_restrict_update ON exchange_rates;
CREATE POLICY exchange_rates_write_restrict_update ON exchange_rates AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage']));
DROP POLICY IF EXISTS exchange_rates_write_restrict_delete ON exchange_rates;
CREATE POLICY exchange_rates_write_restrict_delete ON exchange_rates AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage']));
-- ----------------------------------------------------------------------------
-- Settings: erp_modules  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS erp_modules_write_restrict_insert ON erp_modules;
CREATE POLICY erp_modules_write_restrict_insert ON erp_modules AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['settings.manage']));
DROP POLICY IF EXISTS erp_modules_write_restrict_update ON erp_modules;
CREATE POLICY erp_modules_write_restrict_update ON erp_modules AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['settings.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['settings.manage']));
DROP POLICY IF EXISTS erp_modules_write_restrict_delete ON erp_modules;
CREATE POLICY erp_modules_write_restrict_delete ON erp_modules AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['settings.manage']));
-- ----------------------------------------------------------------------------
-- Settings / Sequences: document_sequences  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS document_sequences_write_restrict_insert ON document_sequences;
CREATE POLICY document_sequences_write_restrict_insert ON document_sequences AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['settings.sequences','settings.manage']));
DROP POLICY IF EXISTS document_sequences_write_restrict_update ON document_sequences;
CREATE POLICY document_sequences_write_restrict_update ON document_sequences AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['settings.sequences','settings.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['settings.sequences','settings.manage']));
DROP POLICY IF EXISTS document_sequences_write_restrict_delete ON document_sequences;
CREATE POLICY document_sequences_write_restrict_delete ON document_sequences AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['settings.sequences','settings.manage']));
-- ----------------------------------------------------------------------------
-- Workflow: approval_authority  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS approval_authority_write_restrict_insert ON approval_authority;
CREATE POLICY approval_authority_write_restrict_insert ON approval_authority AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['workflow.manage','settings.workflows']));
DROP POLICY IF EXISTS approval_authority_write_restrict_update ON approval_authority;
CREATE POLICY approval_authority_write_restrict_update ON approval_authority AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['workflow.manage','settings.workflows']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['workflow.manage','settings.workflows']));
DROP POLICY IF EXISTS approval_authority_write_restrict_delete ON approval_authority;
CREATE POLICY approval_authority_write_restrict_delete ON approval_authority AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['workflow.manage','settings.workflows']));
-- ----------------------------------------------------------------------------
-- Workflow: approval_workflows  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS approval_workflows_write_restrict_insert ON approval_workflows;
CREATE POLICY approval_workflows_write_restrict_insert ON approval_workflows AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['workflow.manage','settings.workflows']));
DROP POLICY IF EXISTS approval_workflows_write_restrict_update ON approval_workflows;
CREATE POLICY approval_workflows_write_restrict_update ON approval_workflows AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['workflow.manage','settings.workflows']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['workflow.manage','settings.workflows']));
DROP POLICY IF EXISTS approval_workflows_write_restrict_delete ON approval_workflows;
CREATE POLICY approval_workflows_write_restrict_delete ON approval_workflows AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['workflow.manage','settings.workflows']));
-- ----------------------------------------------------------------------------
-- Workflow: wf_instances  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS wf_instances_write_restrict_insert ON wf_instances;
CREATE POLICY wf_instances_write_restrict_insert ON wf_instances AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['workflow.manage']));
DROP POLICY IF EXISTS wf_instances_write_restrict_update ON wf_instances;
CREATE POLICY wf_instances_write_restrict_update ON wf_instances AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['workflow.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['workflow.manage']));
DROP POLICY IF EXISTS wf_instances_write_restrict_delete ON wf_instances;
CREATE POLICY wf_instances_write_restrict_delete ON wf_instances AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['workflow.manage']));
-- ----------------------------------------------------------------------------
-- Security / Workflow: sec_dual_control_requests  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS sec_dual_control_requests_write_restrict_insert ON sec_dual_control_requests;
CREATE POLICY sec_dual_control_requests_write_restrict_insert ON sec_dual_control_requests AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['security.admin','workflow.manage']));
DROP POLICY IF EXISTS sec_dual_control_requests_write_restrict_update ON sec_dual_control_requests;
CREATE POLICY sec_dual_control_requests_write_restrict_update ON sec_dual_control_requests AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['security.admin','workflow.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['security.admin','workflow.manage']));
DROP POLICY IF EXISTS sec_dual_control_requests_write_restrict_delete ON sec_dual_control_requests;
CREATE POLICY sec_dual_control_requests_write_restrict_delete ON sec_dual_control_requests AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['security.admin','workflow.manage']));
-- ----------------------------------------------------------------------------
-- Dispatch / Field: dispatches  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS dispatches_write_restrict_insert ON dispatches;
CREATE POLICY dispatches_write_restrict_insert ON dispatches AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['dispatch.manage']));
DROP POLICY IF EXISTS dispatches_write_restrict_update ON dispatches;
CREATE POLICY dispatches_write_restrict_update ON dispatches AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['dispatch.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['dispatch.manage']));
DROP POLICY IF EXISTS dispatches_write_restrict_delete ON dispatches;
CREATE POLICY dispatches_write_restrict_delete ON dispatches AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['dispatch.manage']));
-- ----------------------------------------------------------------------------
-- Dispatch / Field: field_jobs  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS field_jobs_write_restrict_insert ON field_jobs;
CREATE POLICY field_jobs_write_restrict_insert ON field_jobs AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['dispatch.manage','wfm.field']));
DROP POLICY IF EXISTS field_jobs_write_restrict_update ON field_jobs;
CREATE POLICY field_jobs_write_restrict_update ON field_jobs AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['dispatch.manage','wfm.field']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['dispatch.manage','wfm.field']));
DROP POLICY IF EXISTS field_jobs_write_restrict_delete ON field_jobs;
CREATE POLICY field_jobs_write_restrict_delete ON field_jobs AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['dispatch.manage','wfm.field']));
-- ----------------------------------------------------------------------------
-- Sales / CRM: sales_call_logs  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS sales_call_logs_write_restrict_insert ON sales_call_logs;
CREATE POLICY sales_call_logs_write_restrict_insert ON sales_call_logs AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['sales.manage','crm.manage']));
DROP POLICY IF EXISTS sales_call_logs_write_restrict_update ON sales_call_logs;
CREATE POLICY sales_call_logs_write_restrict_update ON sales_call_logs AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['sales.manage','crm.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['sales.manage','crm.manage']));
DROP POLICY IF EXISTS sales_call_logs_write_restrict_delete ON sales_call_logs;
CREATE POLICY sales_call_logs_write_restrict_delete ON sales_call_logs AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['sales.manage','crm.manage']));
-- ----------------------------------------------------------------------------
-- Sales / CRM: sales_competitors  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS sales_competitors_write_restrict_insert ON sales_competitors;
CREATE POLICY sales_competitors_write_restrict_insert ON sales_competitors AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['sales.manage','crm.manage']));
DROP POLICY IF EXISTS sales_competitors_write_restrict_update ON sales_competitors;
CREATE POLICY sales_competitors_write_restrict_update ON sales_competitors AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['sales.manage','crm.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['sales.manage','crm.manage']));
DROP POLICY IF EXISTS sales_competitors_write_restrict_delete ON sales_competitors;
CREATE POLICY sales_competitors_write_restrict_delete ON sales_competitors AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['sales.manage','crm.manage']));
-- ----------------------------------------------------------------------------
-- Service Desk Catalog: sd_catalog_categories  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS sd_catalog_categories_write_restrict_insert ON sd_catalog_categories;
CREATE POLICY sd_catalog_categories_write_restrict_insert ON sd_catalog_categories AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['sd.manage']));
DROP POLICY IF EXISTS sd_catalog_categories_write_restrict_update ON sd_catalog_categories;
CREATE POLICY sd_catalog_categories_write_restrict_update ON sd_catalog_categories AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['sd.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['sd.manage']));
DROP POLICY IF EXISTS sd_catalog_categories_write_restrict_delete ON sd_catalog_categories;
CREATE POLICY sd_catalog_categories_write_restrict_delete ON sd_catalog_categories AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['sd.manage']));
-- ----------------------------------------------------------------------------
-- Service Desk Catalog: sd_catalog_items  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS sd_catalog_items_write_restrict_insert ON sd_catalog_items;
CREATE POLICY sd_catalog_items_write_restrict_insert ON sd_catalog_items AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['sd.manage']));
DROP POLICY IF EXISTS sd_catalog_items_write_restrict_update ON sd_catalog_items;
CREATE POLICY sd_catalog_items_write_restrict_update ON sd_catalog_items AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['sd.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['sd.manage']));
DROP POLICY IF EXISTS sd_catalog_items_write_restrict_delete ON sd_catalog_items;
CREATE POLICY sd_catalog_items_write_restrict_delete ON sd_catalog_items AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['sd.manage']));
-- ----------------------------------------------------------------------------
-- Service Desk Catalog: sd_catalog_requests  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS sd_catalog_requests_write_restrict_insert ON sd_catalog_requests;
CREATE POLICY sd_catalog_requests_write_restrict_insert ON sd_catalog_requests AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['sd.manage','sd.portal']));
DROP POLICY IF EXISTS sd_catalog_requests_write_restrict_update ON sd_catalog_requests;
CREATE POLICY sd_catalog_requests_write_restrict_update ON sd_catalog_requests AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['sd.manage','sd.portal']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['sd.manage','sd.portal']));
DROP POLICY IF EXISTS sd_catalog_requests_write_restrict_delete ON sd_catalog_requests;
CREATE POLICY sd_catalog_requests_write_restrict_delete ON sd_catalog_requests AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['sd.manage','sd.portal']));
-- ----------------------------------------------------------------------------
-- Print: printers  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS printers_write_restrict_insert ON printers;
CREATE POLICY printers_write_restrict_insert ON printers AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['print.manage','print.admin']));
DROP POLICY IF EXISTS printers_write_restrict_update ON printers;
CREATE POLICY printers_write_restrict_update ON printers AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['print.manage','print.admin']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['print.manage','print.admin']));
DROP POLICY IF EXISTS printers_write_restrict_delete ON printers;
CREATE POLICY printers_write_restrict_delete ON printers AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['print.manage','print.admin']));
-- ----------------------------------------------------------------------------
-- Print: prt_designs  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS prt_designs_write_restrict_insert ON prt_designs;
CREATE POLICY prt_designs_write_restrict_insert ON prt_designs AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['print.design','print.manage']));
DROP POLICY IF EXISTS prt_designs_write_restrict_update ON prt_designs;
CREATE POLICY prt_designs_write_restrict_update ON prt_designs AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['print.design','print.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['print.design','print.manage']));
DROP POLICY IF EXISTS prt_designs_write_restrict_delete ON prt_designs;
CREATE POLICY prt_designs_write_restrict_delete ON prt_designs AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['print.design','print.manage']));
-- ----------------------------------------------------------------------------
-- Print: prt_templates  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS prt_templates_write_restrict_insert ON prt_templates;
CREATE POLICY prt_templates_write_restrict_insert ON prt_templates AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['print.manage','print.design']));
DROP POLICY IF EXISTS prt_templates_write_restrict_update ON prt_templates;
CREATE POLICY prt_templates_write_restrict_update ON prt_templates AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['print.manage','print.design']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['print.manage','print.design']));
DROP POLICY IF EXISTS prt_templates_write_restrict_delete ON prt_templates;
CREATE POLICY prt_templates_write_restrict_delete ON prt_templates AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['print.manage','print.design']));
-- ----------------------------------------------------------------------------
-- Print: prt_servers  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS prt_servers_write_restrict_insert ON prt_servers;
CREATE POLICY prt_servers_write_restrict_insert ON prt_servers AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['print.admin','print.manage']));
DROP POLICY IF EXISTS prt_servers_write_restrict_update ON prt_servers;
CREATE POLICY prt_servers_write_restrict_update ON prt_servers AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['print.admin','print.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['print.admin','print.manage']));
DROP POLICY IF EXISTS prt_servers_write_restrict_delete ON prt_servers;
CREATE POLICY prt_servers_write_restrict_delete ON prt_servers AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['print.admin','print.manage']));
-- ----------------------------------------------------------------------------
-- Print: prt_server_printers  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS prt_server_printers_write_restrict_insert ON prt_server_printers;
CREATE POLICY prt_server_printers_write_restrict_insert ON prt_server_printers AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['print.admin','print.manage']));
DROP POLICY IF EXISTS prt_server_printers_write_restrict_update ON prt_server_printers;
CREATE POLICY prt_server_printers_write_restrict_update ON prt_server_printers AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['print.admin','print.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['print.admin','print.manage']));
DROP POLICY IF EXISTS prt_server_printers_write_restrict_delete ON prt_server_printers;
CREATE POLICY prt_server_printers_write_restrict_delete ON prt_server_printers AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['print.admin','print.manage']));
-- ----------------------------------------------------------------------------
-- Print: prt_batches  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS prt_batches_write_restrict_insert ON prt_batches;
CREATE POLICY prt_batches_write_restrict_insert ON prt_batches AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['print.manage','print.operate']));
DROP POLICY IF EXISTS prt_batches_write_restrict_update ON prt_batches;
CREATE POLICY prt_batches_write_restrict_update ON prt_batches AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['print.manage','print.operate']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['print.manage','print.operate']));
DROP POLICY IF EXISTS prt_batches_write_restrict_delete ON prt_batches;
CREATE POLICY prt_batches_write_restrict_delete ON prt_batches AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['print.manage','print.operate']));
-- ----------------------------------------------------------------------------
-- Print: prt_rules  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS prt_rules_write_restrict_insert ON prt_rules;
CREATE POLICY prt_rules_write_restrict_insert ON prt_rules AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['print.manage','print.admin']));
DROP POLICY IF EXISTS prt_rules_write_restrict_update ON prt_rules;
CREATE POLICY prt_rules_write_restrict_update ON prt_rules AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['print.manage','print.admin']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['print.manage','print.admin']));
DROP POLICY IF EXISTS prt_rules_write_restrict_delete ON prt_rules;
CREATE POLICY prt_rules_write_restrict_delete ON prt_rules AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['print.manage','print.admin']));
-- ----------------------------------------------------------------------------
-- Print: prt_automation_rules  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS prt_automation_rules_write_restrict_insert ON prt_automation_rules;
CREATE POLICY prt_automation_rules_write_restrict_insert ON prt_automation_rules AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['print.manage','print.admin']));
DROP POLICY IF EXISTS prt_automation_rules_write_restrict_update ON prt_automation_rules;
CREATE POLICY prt_automation_rules_write_restrict_update ON prt_automation_rules AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['print.manage','print.admin']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['print.manage','print.admin']));
DROP POLICY IF EXISTS prt_automation_rules_write_restrict_delete ON prt_automation_rules;
CREATE POLICY prt_automation_rules_write_restrict_delete ON prt_automation_rules AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['print.manage','print.admin']));
-- ----------------------------------------------------------------------------
-- Print: prt_schedules  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS prt_schedules_write_restrict_insert ON prt_schedules;
CREATE POLICY prt_schedules_write_restrict_insert ON prt_schedules AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['print.manage']));
DROP POLICY IF EXISTS prt_schedules_write_restrict_update ON prt_schedules;
CREATE POLICY prt_schedules_write_restrict_update ON prt_schedules AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['print.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['print.manage']));
DROP POLICY IF EXISTS prt_schedules_write_restrict_delete ON prt_schedules;
CREATE POLICY prt_schedules_write_restrict_delete ON prt_schedules AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['print.manage']));
-- ----------------------------------------------------------------------------
-- Print: prt_security_profiles  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS prt_security_profiles_write_restrict_insert ON prt_security_profiles;
CREATE POLICY prt_security_profiles_write_restrict_insert ON prt_security_profiles AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['print.security','print.admin']));
DROP POLICY IF EXISTS prt_security_profiles_write_restrict_update ON prt_security_profiles;
CREATE POLICY prt_security_profiles_write_restrict_update ON prt_security_profiles AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['print.security','print.admin']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['print.security','print.admin']));
DROP POLICY IF EXISTS prt_security_profiles_write_restrict_delete ON prt_security_profiles;
CREATE POLICY prt_security_profiles_write_restrict_delete ON prt_security_profiles AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['print.security','print.admin']));
-- ----------------------------------------------------------------------------
-- Print: prt_department_access  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS prt_department_access_write_restrict_insert ON prt_department_access;
CREATE POLICY prt_department_access_write_restrict_insert ON prt_department_access AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['print.admin','settings.manage']));
DROP POLICY IF EXISTS prt_department_access_write_restrict_update ON prt_department_access;
CREATE POLICY prt_department_access_write_restrict_update ON prt_department_access AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['print.admin','settings.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['print.admin','settings.manage']));
DROP POLICY IF EXISTS prt_department_access_write_restrict_delete ON prt_department_access;
CREATE POLICY prt_department_access_write_restrict_delete ON prt_department_access AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['print.admin','settings.manage']));
-- ----------------------------------------------------------------------------
-- Print: prt_quotas  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS prt_quotas_write_restrict_insert ON prt_quotas;
CREATE POLICY prt_quotas_write_restrict_insert ON prt_quotas AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['print.admin','print.manage']));
DROP POLICY IF EXISTS prt_quotas_write_restrict_update ON prt_quotas;
CREATE POLICY prt_quotas_write_restrict_update ON prt_quotas AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['print.admin','print.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['print.admin','print.manage']));
DROP POLICY IF EXISTS prt_quotas_write_restrict_delete ON prt_quotas;
CREATE POLICY prt_quotas_write_restrict_delete ON prt_quotas AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['print.admin','print.manage']));
-- ----------------------------------------------------------------------------
-- Print: prt_id_card_jobs  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS prt_id_card_jobs_write_restrict_insert ON prt_id_card_jobs;
CREATE POLICY prt_id_card_jobs_write_restrict_insert ON prt_id_card_jobs AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['print.operate','print.manage']));
DROP POLICY IF EXISTS prt_id_card_jobs_write_restrict_update ON prt_id_card_jobs;
CREATE POLICY prt_id_card_jobs_write_restrict_update ON prt_id_card_jobs AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['print.operate','print.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['print.operate','print.manage']));
DROP POLICY IF EXISTS prt_id_card_jobs_write_restrict_delete ON prt_id_card_jobs;
CREATE POLICY prt_id_card_jobs_write_restrict_delete ON prt_id_card_jobs AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['print.operate','print.manage']));
-- ----------------------------------------------------------------------------
-- Print: prt_product_label_jobs  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS prt_product_label_jobs_write_restrict_insert ON prt_product_label_jobs;
CREATE POLICY prt_product_label_jobs_write_restrict_insert ON prt_product_label_jobs AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['print.operate','print.manage']));
DROP POLICY IF EXISTS prt_product_label_jobs_write_restrict_update ON prt_product_label_jobs;
CREATE POLICY prt_product_label_jobs_write_restrict_update ON prt_product_label_jobs AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['print.operate','print.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['print.operate','print.manage']));
DROP POLICY IF EXISTS prt_product_label_jobs_write_restrict_delete ON prt_product_label_jobs;
CREATE POLICY prt_product_label_jobs_write_restrict_delete ON prt_product_label_jobs AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['print.operate','print.manage']));
-- ----------------------------------------------------------------------------
-- Print: prt_media  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS prt_media_write_restrict_insert ON prt_media;
CREATE POLICY prt_media_write_restrict_insert ON prt_media AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['print.manage','print.design']));
DROP POLICY IF EXISTS prt_media_write_restrict_update ON prt_media;
CREATE POLICY prt_media_write_restrict_update ON prt_media AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['print.manage','print.design']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['print.manage','print.design']));
DROP POLICY IF EXISTS prt_media_write_restrict_delete ON prt_media;
CREATE POLICY prt_media_write_restrict_delete ON prt_media AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['print.manage','print.design']));
-- ----------------------------------------------------------------------------
-- Print: prt_document_profiles  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS prt_document_profiles_write_restrict_insert ON prt_document_profiles;
CREATE POLICY prt_document_profiles_write_restrict_insert ON prt_document_profiles AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['print.design','print.manage']));
DROP POLICY IF EXISTS prt_document_profiles_write_restrict_update ON prt_document_profiles;
CREATE POLICY prt_document_profiles_write_restrict_update ON prt_document_profiles AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['print.design','print.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['print.design','print.manage']));
DROP POLICY IF EXISTS prt_document_profiles_write_restrict_delete ON prt_document_profiles;
CREATE POLICY prt_document_profiles_write_restrict_delete ON prt_document_profiles AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['print.design','print.manage']));
-- ----------------------------------------------------------------------------
-- Print: prt_consumables  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS prt_consumables_write_restrict_insert ON prt_consumables;
CREATE POLICY prt_consumables_write_restrict_insert ON prt_consumables AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['print.manage']));
DROP POLICY IF EXISTS prt_consumables_write_restrict_update ON prt_consumables;
CREATE POLICY prt_consumables_write_restrict_update ON prt_consumables AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['print.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['print.manage']));
DROP POLICY IF EXISTS prt_consumables_write_restrict_delete ON prt_consumables;
CREATE POLICY prt_consumables_write_restrict_delete ON prt_consumables AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['print.manage']));
-- ----------------------------------------------------------------------------
-- Print: prt_barcode_presets  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS prt_barcode_presets_write_restrict_insert ON prt_barcode_presets;
CREATE POLICY prt_barcode_presets_write_restrict_insert ON prt_barcode_presets AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['print.manage','print.operate']));
DROP POLICY IF EXISTS prt_barcode_presets_write_restrict_update ON prt_barcode_presets;
CREATE POLICY prt_barcode_presets_write_restrict_update ON prt_barcode_presets AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['print.manage','print.operate']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['print.manage','print.operate']));
DROP POLICY IF EXISTS prt_barcode_presets_write_restrict_delete ON prt_barcode_presets;
CREATE POLICY prt_barcode_presets_write_restrict_delete ON prt_barcode_presets AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['print.manage','print.operate']));
-- ----------------------------------------------------------------------------
-- Print: prt_inventory_labels  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS prt_inventory_labels_write_restrict_insert ON prt_inventory_labels;
CREATE POLICY prt_inventory_labels_write_restrict_insert ON prt_inventory_labels AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['print.manage','print.operate']));
DROP POLICY IF EXISTS prt_inventory_labels_write_restrict_update ON prt_inventory_labels;
CREATE POLICY prt_inventory_labels_write_restrict_update ON prt_inventory_labels AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['print.manage','print.operate']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['print.manage','print.operate']));
DROP POLICY IF EXISTS prt_inventory_labels_write_restrict_delete ON prt_inventory_labels;
CREATE POLICY prt_inventory_labels_write_restrict_delete ON prt_inventory_labels AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['print.manage','print.operate']));
-- ----------------------------------------------------------------------------
-- Print: prt_secure_pdfs  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS prt_secure_pdfs_write_restrict_insert ON prt_secure_pdfs;
CREATE POLICY prt_secure_pdfs_write_restrict_insert ON prt_secure_pdfs AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['print.security','print.manage']));
DROP POLICY IF EXISTS prt_secure_pdfs_write_restrict_update ON prt_secure_pdfs;
CREATE POLICY prt_secure_pdfs_write_restrict_update ON prt_secure_pdfs AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['print.security','print.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['print.security','print.manage']));
DROP POLICY IF EXISTS prt_secure_pdfs_write_restrict_delete ON prt_secure_pdfs;
CREATE POLICY prt_secure_pdfs_write_restrict_delete ON prt_secure_pdfs AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['print.security','print.manage']));
-- ----------------------------------------------------------------------------
-- Labels: lbl_barcodes  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS lbl_barcodes_write_restrict_insert ON lbl_barcodes;
CREATE POLICY lbl_barcodes_write_restrict_insert ON lbl_barcodes AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['lbl.manage','lbl.print']));
DROP POLICY IF EXISTS lbl_barcodes_write_restrict_update ON lbl_barcodes;
CREATE POLICY lbl_barcodes_write_restrict_update ON lbl_barcodes AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['lbl.manage','lbl.print']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['lbl.manage','lbl.print']));
DROP POLICY IF EXISTS lbl_barcodes_write_restrict_delete ON lbl_barcodes;
CREATE POLICY lbl_barcodes_write_restrict_delete ON lbl_barcodes AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['lbl.manage','lbl.print']));
-- ----------------------------------------------------------------------------
-- Labels: lbl_batches  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS lbl_batches_write_restrict_insert ON lbl_batches;
CREATE POLICY lbl_batches_write_restrict_insert ON lbl_batches AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['lbl.manage','lbl.print','lbl.approve']));
DROP POLICY IF EXISTS lbl_batches_write_restrict_update ON lbl_batches;
CREATE POLICY lbl_batches_write_restrict_update ON lbl_batches AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['lbl.manage','lbl.print','lbl.approve']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['lbl.manage','lbl.print','lbl.approve']));
DROP POLICY IF EXISTS lbl_batches_write_restrict_delete ON lbl_batches;
CREATE POLICY lbl_batches_write_restrict_delete ON lbl_batches AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['lbl.manage','lbl.print','lbl.approve']));
-- ----------------------------------------------------------------------------
-- Labels: lbl_categories  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS lbl_categories_write_restrict_insert ON lbl_categories;
CREATE POLICY lbl_categories_write_restrict_insert ON lbl_categories AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['lbl.manage']));
DROP POLICY IF EXISTS lbl_categories_write_restrict_update ON lbl_categories;
CREATE POLICY lbl_categories_write_restrict_update ON lbl_categories AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['lbl.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['lbl.manage']));
DROP POLICY IF EXISTS lbl_categories_write_restrict_delete ON lbl_categories;
CREATE POLICY lbl_categories_write_restrict_delete ON lbl_categories AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['lbl.manage']));
-- ----------------------------------------------------------------------------
-- Labels: lbl_compliance  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS lbl_compliance_write_restrict_insert ON lbl_compliance;
CREATE POLICY lbl_compliance_write_restrict_insert ON lbl_compliance AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['lbl.security','lbl.manage']));
DROP POLICY IF EXISTS lbl_compliance_write_restrict_update ON lbl_compliance;
CREATE POLICY lbl_compliance_write_restrict_update ON lbl_compliance AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['lbl.security','lbl.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['lbl.security','lbl.manage']));
DROP POLICY IF EXISTS lbl_compliance_write_restrict_delete ON lbl_compliance;
CREATE POLICY lbl_compliance_write_restrict_delete ON lbl_compliance AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['lbl.security','lbl.manage']));
-- ----------------------------------------------------------------------------
-- Labels: lbl_documents  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS lbl_documents_write_restrict_insert ON lbl_documents;
CREATE POLICY lbl_documents_write_restrict_insert ON lbl_documents AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['lbl.manage','lbl.design']));
DROP POLICY IF EXISTS lbl_documents_write_restrict_update ON lbl_documents;
CREATE POLICY lbl_documents_write_restrict_update ON lbl_documents AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['lbl.manage','lbl.design']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['lbl.manage','lbl.design']));
DROP POLICY IF EXISTS lbl_documents_write_restrict_delete ON lbl_documents;
CREATE POLICY lbl_documents_write_restrict_delete ON lbl_documents AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['lbl.manage','lbl.design']));
-- ----------------------------------------------------------------------------
-- Labels: lbl_fields  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS lbl_fields_write_restrict_insert ON lbl_fields;
CREATE POLICY lbl_fields_write_restrict_insert ON lbl_fields AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['lbl.manage','lbl.design']));
DROP POLICY IF EXISTS lbl_fields_write_restrict_update ON lbl_fields;
CREATE POLICY lbl_fields_write_restrict_update ON lbl_fields AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['lbl.manage','lbl.design']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['lbl.manage','lbl.design']));
DROP POLICY IF EXISTS lbl_fields_write_restrict_delete ON lbl_fields;
CREATE POLICY lbl_fields_write_restrict_delete ON lbl_fields AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['lbl.manage','lbl.design']));
-- ----------------------------------------------------------------------------
-- Labels: lbl_formats  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS lbl_formats_write_restrict_insert ON lbl_formats;
CREATE POLICY lbl_formats_write_restrict_insert ON lbl_formats AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['lbl.manage','lbl.design']));
DROP POLICY IF EXISTS lbl_formats_write_restrict_update ON lbl_formats;
CREATE POLICY lbl_formats_write_restrict_update ON lbl_formats AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['lbl.manage','lbl.design']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['lbl.manage','lbl.design']));
DROP POLICY IF EXISTS lbl_formats_write_restrict_delete ON lbl_formats;
CREATE POLICY lbl_formats_write_restrict_delete ON lbl_formats AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['lbl.manage','lbl.design']));
-- ----------------------------------------------------------------------------
-- Labels: lbl_gs1  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS lbl_gs1_write_restrict_insert ON lbl_gs1;
CREATE POLICY lbl_gs1_write_restrict_insert ON lbl_gs1 AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['lbl.security','lbl.manage']));
DROP POLICY IF EXISTS lbl_gs1_write_restrict_update ON lbl_gs1;
CREATE POLICY lbl_gs1_write_restrict_update ON lbl_gs1 AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['lbl.security','lbl.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['lbl.security','lbl.manage']));
DROP POLICY IF EXISTS lbl_gs1_write_restrict_delete ON lbl_gs1;
CREATE POLICY lbl_gs1_write_restrict_delete ON lbl_gs1 AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['lbl.security','lbl.manage']));
-- ----------------------------------------------------------------------------
-- Labels: lbl_instances  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS lbl_instances_write_restrict_insert ON lbl_instances;
CREATE POLICY lbl_instances_write_restrict_insert ON lbl_instances AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['lbl.manage','lbl.print']));
DROP POLICY IF EXISTS lbl_instances_write_restrict_update ON lbl_instances;
CREATE POLICY lbl_instances_write_restrict_update ON lbl_instances AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['lbl.manage','lbl.print']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['lbl.manage','lbl.print']));
DROP POLICY IF EXISTS lbl_instances_write_restrict_delete ON lbl_instances;
CREATE POLICY lbl_instances_write_restrict_delete ON lbl_instances AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['lbl.manage','lbl.print']));
-- ----------------------------------------------------------------------------
-- Labels: lbl_jobs  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS lbl_jobs_write_restrict_insert ON lbl_jobs;
CREATE POLICY lbl_jobs_write_restrict_insert ON lbl_jobs AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['lbl.manage','lbl.print','lbl.approve']));
DROP POLICY IF EXISTS lbl_jobs_write_restrict_update ON lbl_jobs;
CREATE POLICY lbl_jobs_write_restrict_update ON lbl_jobs AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['lbl.manage','lbl.print','lbl.approve']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['lbl.manage','lbl.print','lbl.approve']));
DROP POLICY IF EXISTS lbl_jobs_write_restrict_delete ON lbl_jobs;
CREATE POLICY lbl_jobs_write_restrict_delete ON lbl_jobs AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['lbl.manage','lbl.print','lbl.approve']));
-- ----------------------------------------------------------------------------
-- Labels: lbl_materials  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS lbl_materials_write_restrict_insert ON lbl_materials;
CREATE POLICY lbl_materials_write_restrict_insert ON lbl_materials AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['lbl.manage']));
DROP POLICY IF EXISTS lbl_materials_write_restrict_update ON lbl_materials;
CREATE POLICY lbl_materials_write_restrict_update ON lbl_materials AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['lbl.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['lbl.manage']));
DROP POLICY IF EXISTS lbl_materials_write_restrict_delete ON lbl_materials;
CREATE POLICY lbl_materials_write_restrict_delete ON lbl_materials AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['lbl.manage']));
-- ----------------------------------------------------------------------------
-- Labels: lbl_pallet  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS lbl_pallet_write_restrict_insert ON lbl_pallet;
CREATE POLICY lbl_pallet_write_restrict_insert ON lbl_pallet AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['lbl.manage','lbl.print']));
DROP POLICY IF EXISTS lbl_pallet_write_restrict_update ON lbl_pallet;
CREATE POLICY lbl_pallet_write_restrict_update ON lbl_pallet AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['lbl.manage','lbl.print']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['lbl.manage','lbl.print']));
DROP POLICY IF EXISTS lbl_pallet_write_restrict_delete ON lbl_pallet;
CREATE POLICY lbl_pallet_write_restrict_delete ON lbl_pallet AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['lbl.manage','lbl.print']));
-- ----------------------------------------------------------------------------
-- Labels: lbl_printer_profiles  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS lbl_printer_profiles_write_restrict_insert ON lbl_printer_profiles;
CREATE POLICY lbl_printer_profiles_write_restrict_insert ON lbl_printer_profiles AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['lbl.manage','lbl.print']));
DROP POLICY IF EXISTS lbl_printer_profiles_write_restrict_update ON lbl_printer_profiles;
CREATE POLICY lbl_printer_profiles_write_restrict_update ON lbl_printer_profiles AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['lbl.manage','lbl.print']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['lbl.manage','lbl.print']));
DROP POLICY IF EXISTS lbl_printer_profiles_write_restrict_delete ON lbl_printer_profiles;
CREATE POLICY lbl_printer_profiles_write_restrict_delete ON lbl_printer_profiles AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['lbl.manage','lbl.print']));
-- ----------------------------------------------------------------------------
-- Labels: lbl_reprints  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS lbl_reprints_write_restrict_insert ON lbl_reprints;
CREATE POLICY lbl_reprints_write_restrict_insert ON lbl_reprints AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['lbl.print','lbl.manage']));
DROP POLICY IF EXISTS lbl_reprints_write_restrict_update ON lbl_reprints;
CREATE POLICY lbl_reprints_write_restrict_update ON lbl_reprints AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['lbl.print','lbl.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['lbl.print','lbl.manage']));
DROP POLICY IF EXISTS lbl_reprints_write_restrict_delete ON lbl_reprints;
CREATE POLICY lbl_reprints_write_restrict_delete ON lbl_reprints AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['lbl.print','lbl.manage']));
-- ----------------------------------------------------------------------------
-- Labels: lbl_rules  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS lbl_rules_write_restrict_insert ON lbl_rules;
CREATE POLICY lbl_rules_write_restrict_insert ON lbl_rules AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['lbl.manage','lbl.security']));
DROP POLICY IF EXISTS lbl_rules_write_restrict_update ON lbl_rules;
CREATE POLICY lbl_rules_write_restrict_update ON lbl_rules AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['lbl.manage','lbl.security']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['lbl.manage','lbl.security']));
DROP POLICY IF EXISTS lbl_rules_write_restrict_delete ON lbl_rules;
CREATE POLICY lbl_rules_write_restrict_delete ON lbl_rules AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['lbl.manage','lbl.security']));
-- ----------------------------------------------------------------------------
-- Labels: lbl_security  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS lbl_security_write_restrict_insert ON lbl_security;
CREATE POLICY lbl_security_write_restrict_insert ON lbl_security AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['lbl.security','lbl.admin']));
DROP POLICY IF EXISTS lbl_security_write_restrict_update ON lbl_security;
CREATE POLICY lbl_security_write_restrict_update ON lbl_security AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['lbl.security','lbl.admin']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['lbl.security','lbl.admin']));
DROP POLICY IF EXISTS lbl_security_write_restrict_delete ON lbl_security;
CREATE POLICY lbl_security_write_restrict_delete ON lbl_security AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['lbl.security','lbl.admin']));
-- ----------------------------------------------------------------------------
-- Labels: lbl_settings  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS lbl_settings_write_restrict_insert ON lbl_settings;
CREATE POLICY lbl_settings_write_restrict_insert ON lbl_settings AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['lbl.admin','lbl.manage']));
DROP POLICY IF EXISTS lbl_settings_write_restrict_update ON lbl_settings;
CREATE POLICY lbl_settings_write_restrict_update ON lbl_settings AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['lbl.admin','lbl.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['lbl.admin','lbl.manage']));
DROP POLICY IF EXISTS lbl_settings_write_restrict_delete ON lbl_settings;
CREATE POLICY lbl_settings_write_restrict_delete ON lbl_settings AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['lbl.admin','lbl.manage']));
-- ----------------------------------------------------------------------------
-- Labels: lbl_shelf  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS lbl_shelf_write_restrict_insert ON lbl_shelf;
CREATE POLICY lbl_shelf_write_restrict_insert ON lbl_shelf AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['lbl.manage','lbl.print']));
DROP POLICY IF EXISTS lbl_shelf_write_restrict_update ON lbl_shelf;
CREATE POLICY lbl_shelf_write_restrict_update ON lbl_shelf AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['lbl.manage','lbl.print']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['lbl.manage','lbl.print']));
DROP POLICY IF EXISTS lbl_shelf_write_restrict_delete ON lbl_shelf;
CREATE POLICY lbl_shelf_write_restrict_delete ON lbl_shelf AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['lbl.manage','lbl.print']));
-- ----------------------------------------------------------------------------
-- Labels: lbl_shipping  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS lbl_shipping_write_restrict_insert ON lbl_shipping;
CREATE POLICY lbl_shipping_write_restrict_insert ON lbl_shipping AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['lbl.manage','lbl.print']));
DROP POLICY IF EXISTS lbl_shipping_write_restrict_update ON lbl_shipping;
CREATE POLICY lbl_shipping_write_restrict_update ON lbl_shipping AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['lbl.manage','lbl.print']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['lbl.manage','lbl.print']));
DROP POLICY IF EXISTS lbl_shipping_write_restrict_delete ON lbl_shipping;
CREATE POLICY lbl_shipping_write_restrict_delete ON lbl_shipping AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['lbl.manage','lbl.print']));
-- ----------------------------------------------------------------------------
-- Labels: lbl_stock  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS lbl_stock_write_restrict_insert ON lbl_stock;
CREATE POLICY lbl_stock_write_restrict_insert ON lbl_stock AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['lbl.manage','lbl.print']));
DROP POLICY IF EXISTS lbl_stock_write_restrict_update ON lbl_stock;
CREATE POLICY lbl_stock_write_restrict_update ON lbl_stock AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['lbl.manage','lbl.print']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['lbl.manage','lbl.print']));
DROP POLICY IF EXISTS lbl_stock_write_restrict_delete ON lbl_stock;
CREATE POLICY lbl_stock_write_restrict_delete ON lbl_stock AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['lbl.manage','lbl.print']));
-- ----------------------------------------------------------------------------
-- Labels: lbl_templates  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS lbl_templates_write_restrict_insert ON lbl_templates;
CREATE POLICY lbl_templates_write_restrict_insert ON lbl_templates AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['lbl.manage','lbl.design']));
DROP POLICY IF EXISTS lbl_templates_write_restrict_update ON lbl_templates;
CREATE POLICY lbl_templates_write_restrict_update ON lbl_templates AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['lbl.manage','lbl.design']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['lbl.manage','lbl.design']));
DROP POLICY IF EXISTS lbl_templates_write_restrict_delete ON lbl_templates;
CREATE POLICY lbl_templates_write_restrict_delete ON lbl_templates AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['lbl.manage','lbl.design']));
-- ----------------------------------------------------------------------------
-- Labels: lbl_variables  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS lbl_variables_write_restrict_insert ON lbl_variables;
CREATE POLICY lbl_variables_write_restrict_insert ON lbl_variables AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['lbl.manage','lbl.design']));
DROP POLICY IF EXISTS lbl_variables_write_restrict_update ON lbl_variables;
CREATE POLICY lbl_variables_write_restrict_update ON lbl_variables AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['lbl.manage','lbl.design']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['lbl.manage','lbl.design']));
DROP POLICY IF EXISTS lbl_variables_write_restrict_delete ON lbl_variables;
CREATE POLICY lbl_variables_write_restrict_delete ON lbl_variables AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['lbl.manage','lbl.design']));
-- ----------------------------------------------------------------------------
-- Packaging: pkg_carton_sizes  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS pkg_carton_sizes_write_restrict_insert ON pkg_carton_sizes;
CREATE POLICY pkg_carton_sizes_write_restrict_insert ON pkg_carton_sizes AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['pkg.manage']));
DROP POLICY IF EXISTS pkg_carton_sizes_write_restrict_update ON pkg_carton_sizes;
CREATE POLICY pkg_carton_sizes_write_restrict_update ON pkg_carton_sizes AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['pkg.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['pkg.manage']));
DROP POLICY IF EXISTS pkg_carton_sizes_write_restrict_delete ON pkg_carton_sizes;
CREATE POLICY pkg_carton_sizes_write_restrict_delete ON pkg_carton_sizes AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['pkg.manage']));
-- ----------------------------------------------------------------------------
-- Packaging: pkg_lines  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS pkg_lines_write_restrict_insert ON pkg_lines;
CREATE POLICY pkg_lines_write_restrict_insert ON pkg_lines AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['pkg.manage','pkg.operate']));
DROP POLICY IF EXISTS pkg_lines_write_restrict_update ON pkg_lines;
CREATE POLICY pkg_lines_write_restrict_update ON pkg_lines AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['pkg.manage','pkg.operate']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['pkg.manage','pkg.operate']));
DROP POLICY IF EXISTS pkg_lines_write_restrict_delete ON pkg_lines;
CREATE POLICY pkg_lines_write_restrict_delete ON pkg_lines AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['pkg.manage','pkg.operate']));
-- ----------------------------------------------------------------------------
-- Packaging: pkg_material_issues  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS pkg_material_issues_write_restrict_insert ON pkg_material_issues;
CREATE POLICY pkg_material_issues_write_restrict_insert ON pkg_material_issues AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['pkg.manage','inventory.manage']));
DROP POLICY IF EXISTS pkg_material_issues_write_restrict_update ON pkg_material_issues;
CREATE POLICY pkg_material_issues_write_restrict_update ON pkg_material_issues AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['pkg.manage','inventory.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['pkg.manage','inventory.manage']));
DROP POLICY IF EXISTS pkg_material_issues_write_restrict_delete ON pkg_material_issues;
CREATE POLICY pkg_material_issues_write_restrict_delete ON pkg_material_issues AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['pkg.manage','inventory.manage']));
-- ----------------------------------------------------------------------------
-- Packaging: pkg_materials  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS pkg_materials_write_restrict_insert ON pkg_materials;
CREATE POLICY pkg_materials_write_restrict_insert ON pkg_materials AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['pkg.manage']));
DROP POLICY IF EXISTS pkg_materials_write_restrict_update ON pkg_materials;
CREATE POLICY pkg_materials_write_restrict_update ON pkg_materials AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['pkg.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['pkg.manage']));
DROP POLICY IF EXISTS pkg_materials_write_restrict_delete ON pkg_materials;
CREATE POLICY pkg_materials_write_restrict_delete ON pkg_materials AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['pkg.manage']));
-- ----------------------------------------------------------------------------
-- Packaging: pkg_packing_lists  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS pkg_packing_lists_write_restrict_insert ON pkg_packing_lists;
CREATE POLICY pkg_packing_lists_write_restrict_insert ON pkg_packing_lists AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['pkg.manage','pkg.operate']));
DROP POLICY IF EXISTS pkg_packing_lists_write_restrict_update ON pkg_packing_lists;
CREATE POLICY pkg_packing_lists_write_restrict_update ON pkg_packing_lists AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['pkg.manage','pkg.operate']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['pkg.manage','pkg.operate']));
DROP POLICY IF EXISTS pkg_packing_lists_write_restrict_delete ON pkg_packing_lists;
CREATE POLICY pkg_packing_lists_write_restrict_delete ON pkg_packing_lists AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['pkg.manage','pkg.operate']));
-- ----------------------------------------------------------------------------
-- Packaging: pkg_pallet_cartons  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS pkg_pallet_cartons_write_restrict_insert ON pkg_pallet_cartons;
CREATE POLICY pkg_pallet_cartons_write_restrict_insert ON pkg_pallet_cartons AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['pkg.manage','pkg.operate']));
DROP POLICY IF EXISTS pkg_pallet_cartons_write_restrict_update ON pkg_pallet_cartons;
CREATE POLICY pkg_pallet_cartons_write_restrict_update ON pkg_pallet_cartons AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['pkg.manage','pkg.operate']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['pkg.manage','pkg.operate']));
DROP POLICY IF EXISTS pkg_pallet_cartons_write_restrict_delete ON pkg_pallet_cartons;
CREATE POLICY pkg_pallet_cartons_write_restrict_delete ON pkg_pallet_cartons AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['pkg.manage','pkg.operate']));
-- ----------------------------------------------------------------------------
-- Packaging: pkg_pallets  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS pkg_pallets_write_restrict_insert ON pkg_pallets;
CREATE POLICY pkg_pallets_write_restrict_insert ON pkg_pallets AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['pkg.manage','pkg.operate']));
DROP POLICY IF EXISTS pkg_pallets_write_restrict_update ON pkg_pallets;
CREATE POLICY pkg_pallets_write_restrict_update ON pkg_pallets AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['pkg.manage','pkg.operate']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['pkg.manage','pkg.operate']));
DROP POLICY IF EXISTS pkg_pallets_write_restrict_delete ON pkg_pallets;
CREATE POLICY pkg_pallets_write_restrict_delete ON pkg_pallets AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['pkg.manage','pkg.operate']));
-- ----------------------------------------------------------------------------
-- Packaging: pkg_product_rules  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS pkg_product_rules_write_restrict_insert ON pkg_product_rules;
CREATE POLICY pkg_product_rules_write_restrict_insert ON pkg_product_rules AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['pkg.manage','products.manage']));
DROP POLICY IF EXISTS pkg_product_rules_write_restrict_update ON pkg_product_rules;
CREATE POLICY pkg_product_rules_write_restrict_update ON pkg_product_rules AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['pkg.manage','products.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['pkg.manage','products.manage']));
DROP POLICY IF EXISTS pkg_product_rules_write_restrict_delete ON pkg_product_rules;
CREATE POLICY pkg_product_rules_write_restrict_delete ON pkg_product_rules AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['pkg.manage','products.manage']));
-- ----------------------------------------------------------------------------
-- Packaging: pkg_qc_checks  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS pkg_qc_checks_write_restrict_insert ON pkg_qc_checks;
CREATE POLICY pkg_qc_checks_write_restrict_insert ON pkg_qc_checks AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['pkg.approve','pkg.manage']));
DROP POLICY IF EXISTS pkg_qc_checks_write_restrict_update ON pkg_qc_checks;
CREATE POLICY pkg_qc_checks_write_restrict_update ON pkg_qc_checks AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['pkg.approve','pkg.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['pkg.approve','pkg.manage']));
DROP POLICY IF EXISTS pkg_qc_checks_write_restrict_delete ON pkg_qc_checks;
CREATE POLICY pkg_qc_checks_write_restrict_delete ON pkg_qc_checks AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['pkg.approve','pkg.manage']));
-- ----------------------------------------------------------------------------
-- Packaging: pkg_rule_materials  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS pkg_rule_materials_write_restrict_insert ON pkg_rule_materials;
CREATE POLICY pkg_rule_materials_write_restrict_insert ON pkg_rule_materials AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['pkg.manage']));
DROP POLICY IF EXISTS pkg_rule_materials_write_restrict_update ON pkg_rule_materials;
CREATE POLICY pkg_rule_materials_write_restrict_update ON pkg_rule_materials AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['pkg.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['pkg.manage']));
DROP POLICY IF EXISTS pkg_rule_materials_write_restrict_delete ON pkg_rule_materials;
CREATE POLICY pkg_rule_materials_write_restrict_delete ON pkg_rule_materials AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['pkg.manage']));
-- ----------------------------------------------------------------------------
-- Packaging: pkg_sessions  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS pkg_sessions_write_restrict_insert ON pkg_sessions;
CREATE POLICY pkg_sessions_write_restrict_insert ON pkg_sessions AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['pkg.manage','pkg.operate']));
DROP POLICY IF EXISTS pkg_sessions_write_restrict_update ON pkg_sessions;
CREATE POLICY pkg_sessions_write_restrict_update ON pkg_sessions AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['pkg.manage','pkg.operate']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['pkg.manage','pkg.operate']));
DROP POLICY IF EXISTS pkg_sessions_write_restrict_delete ON pkg_sessions;
CREATE POLICY pkg_sessions_write_restrict_delete ON pkg_sessions AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['pkg.manage','pkg.operate']));
-- ----------------------------------------------------------------------------
-- Packaging: pkg_weights  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS pkg_weights_write_restrict_insert ON pkg_weights;
CREATE POLICY pkg_weights_write_restrict_insert ON pkg_weights AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['pkg.manage','pkg.operate']));
DROP POLICY IF EXISTS pkg_weights_write_restrict_update ON pkg_weights;
CREATE POLICY pkg_weights_write_restrict_update ON pkg_weights AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['pkg.manage','pkg.operate']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['pkg.manage','pkg.operate']));
DROP POLICY IF EXISTS pkg_weights_write_restrict_delete ON pkg_weights;
CREATE POLICY pkg_weights_write_restrict_delete ON pkg_weights AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['pkg.manage','pkg.operate']));
-- ----------------------------------------------------------------------------
-- Packaging: pkg_work_orders  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS pkg_work_orders_write_restrict_insert ON pkg_work_orders;
CREATE POLICY pkg_work_orders_write_restrict_insert ON pkg_work_orders AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['pkg.manage','pkg.operate','pkg.approve']));
DROP POLICY IF EXISTS pkg_work_orders_write_restrict_update ON pkg_work_orders;
CREATE POLICY pkg_work_orders_write_restrict_update ON pkg_work_orders AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['pkg.manage','pkg.operate','pkg.approve']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['pkg.manage','pkg.operate','pkg.approve']));
DROP POLICY IF EXISTS pkg_work_orders_write_restrict_delete ON pkg_work_orders;
CREATE POLICY pkg_work_orders_write_restrict_delete ON pkg_work_orders AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['pkg.manage','pkg.operate','pkg.approve']));
-- ----------------------------------------------------------------------------
-- Communications: comm_announcements  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS comm_announcements_write_restrict_insert ON comm_announcements;
CREATE POLICY comm_announcements_write_restrict_insert ON comm_announcements AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['comm.broadcast','comm.manage']));
DROP POLICY IF EXISTS comm_announcements_write_restrict_update ON comm_announcements;
CREATE POLICY comm_announcements_write_restrict_update ON comm_announcements AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['comm.broadcast','comm.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['comm.broadcast','comm.manage']));
DROP POLICY IF EXISTS comm_announcements_write_restrict_delete ON comm_announcements;
CREATE POLICY comm_announcements_write_restrict_delete ON comm_announcements AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['comm.broadcast','comm.manage']));
-- ----------------------------------------------------------------------------
-- Communications: comm_campaigns  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS comm_campaigns_write_restrict_insert ON comm_campaigns;
CREATE POLICY comm_campaigns_write_restrict_insert ON comm_campaigns AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['comm.manage','comm.broadcast']));
DROP POLICY IF EXISTS comm_campaigns_write_restrict_update ON comm_campaigns;
CREATE POLICY comm_campaigns_write_restrict_update ON comm_campaigns AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['comm.manage','comm.broadcast']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['comm.manage','comm.broadcast']));
DROP POLICY IF EXISTS comm_campaigns_write_restrict_delete ON comm_campaigns;
CREATE POLICY comm_campaigns_write_restrict_delete ON comm_campaigns AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['comm.manage','comm.broadcast']));
-- ----------------------------------------------------------------------------
-- Communications: comm_document_jobs  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS comm_document_jobs_write_restrict_insert ON comm_document_jobs;
CREATE POLICY comm_document_jobs_write_restrict_insert ON comm_document_jobs AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['comm.manage','reports.documents']));
DROP POLICY IF EXISTS comm_document_jobs_write_restrict_update ON comm_document_jobs;
CREATE POLICY comm_document_jobs_write_restrict_update ON comm_document_jobs AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['comm.manage','reports.documents']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['comm.manage','reports.documents']));
DROP POLICY IF EXISTS comm_document_jobs_write_restrict_delete ON comm_document_jobs;
CREATE POLICY comm_document_jobs_write_restrict_delete ON comm_document_jobs AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['comm.manage','reports.documents']));
-- ----------------------------------------------------------------------------
-- Communications: comm_event_rules  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS comm_event_rules_write_restrict_insert ON comm_event_rules;
CREATE POLICY comm_event_rules_write_restrict_insert ON comm_event_rules AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['comm.manage','comm.templates']));
DROP POLICY IF EXISTS comm_event_rules_write_restrict_update ON comm_event_rules;
CREATE POLICY comm_event_rules_write_restrict_update ON comm_event_rules AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['comm.manage','comm.templates']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['comm.manage','comm.templates']));
DROP POLICY IF EXISTS comm_event_rules_write_restrict_delete ON comm_event_rules;
CREATE POLICY comm_event_rules_write_restrict_delete ON comm_event_rules AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['comm.manage','comm.templates']));
-- ----------------------------------------------------------------------------
-- Communications: comm_messages  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS comm_messages_write_restrict_insert ON comm_messages;
CREATE POLICY comm_messages_write_restrict_insert ON comm_messages AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['comm.manage','comm.broadcast']));
DROP POLICY IF EXISTS comm_messages_write_restrict_update ON comm_messages;
CREATE POLICY comm_messages_write_restrict_update ON comm_messages AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['comm.manage','comm.broadcast']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['comm.manage','comm.broadcast']));
DROP POLICY IF EXISTS comm_messages_write_restrict_delete ON comm_messages;
CREATE POLICY comm_messages_write_restrict_delete ON comm_messages AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['comm.manage','comm.broadcast']));
-- ----------------------------------------------------------------------------
-- Communications: comm_providers  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS comm_providers_write_restrict_insert ON comm_providers;
CREATE POLICY comm_providers_write_restrict_insert ON comm_providers AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['comm.admin','comm.manage']));
DROP POLICY IF EXISTS comm_providers_write_restrict_update ON comm_providers;
CREATE POLICY comm_providers_write_restrict_update ON comm_providers AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['comm.admin','comm.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['comm.admin','comm.manage']));
DROP POLICY IF EXISTS comm_providers_write_restrict_delete ON comm_providers;
CREATE POLICY comm_providers_write_restrict_delete ON comm_providers AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['comm.admin','comm.manage']));
-- ----------------------------------------------------------------------------
-- Communications: comm_reminders  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS comm_reminders_write_restrict_insert ON comm_reminders;
CREATE POLICY comm_reminders_write_restrict_insert ON comm_reminders AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['comm.manage']));
DROP POLICY IF EXISTS comm_reminders_write_restrict_update ON comm_reminders;
CREATE POLICY comm_reminders_write_restrict_update ON comm_reminders AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['comm.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['comm.manage']));
DROP POLICY IF EXISTS comm_reminders_write_restrict_delete ON comm_reminders;
CREATE POLICY comm_reminders_write_restrict_delete ON comm_reminders AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['comm.manage']));
-- ----------------------------------------------------------------------------
-- Communications: comm_schedules  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS comm_schedules_write_restrict_insert ON comm_schedules;
CREATE POLICY comm_schedules_write_restrict_insert ON comm_schedules AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['comm.manage','comm.templates']));
DROP POLICY IF EXISTS comm_schedules_write_restrict_update ON comm_schedules;
CREATE POLICY comm_schedules_write_restrict_update ON comm_schedules AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['comm.manage','comm.templates']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['comm.manage','comm.templates']));
DROP POLICY IF EXISTS comm_schedules_write_restrict_delete ON comm_schedules;
CREATE POLICY comm_schedules_write_restrict_delete ON comm_schedules AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['comm.manage','comm.templates']));
-- ----------------------------------------------------------------------------
-- Communications: comm_sequences  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS comm_sequences_write_restrict_insert ON comm_sequences;
CREATE POLICY comm_sequences_write_restrict_insert ON comm_sequences AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['comm.manage','comm.templates']));
DROP POLICY IF EXISTS comm_sequences_write_restrict_update ON comm_sequences;
CREATE POLICY comm_sequences_write_restrict_update ON comm_sequences AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['comm.manage','comm.templates']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['comm.manage','comm.templates']));
DROP POLICY IF EXISTS comm_sequences_write_restrict_delete ON comm_sequences;
CREATE POLICY comm_sequences_write_restrict_delete ON comm_sequences AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['comm.manage','comm.templates']));
-- ----------------------------------------------------------------------------
-- Communications: comm_templates  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS comm_templates_write_restrict_insert ON comm_templates;
CREATE POLICY comm_templates_write_restrict_insert ON comm_templates AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['comm.templates','comm.manage']));
DROP POLICY IF EXISTS comm_templates_write_restrict_update ON comm_templates;
CREATE POLICY comm_templates_write_restrict_update ON comm_templates AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['comm.templates','comm.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['comm.templates','comm.manage']));
DROP POLICY IF EXISTS comm_templates_write_restrict_delete ON comm_templates;
CREATE POLICY comm_templates_write_restrict_delete ON comm_templates AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['comm.templates','comm.manage']));
