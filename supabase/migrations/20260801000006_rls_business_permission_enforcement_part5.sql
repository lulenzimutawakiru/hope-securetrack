-- ============================================================================
-- RLS Business Permission Enforcement - Part 5 (Phase 6)
--
-- Closes the data-layer RBAC gap for the final tier of company-scoped ERP
-- tables: fleet operations, projects (PPM), manufacturing (MES), enterprise
-- archive & logging (EAL), enterprise company (org) data, dispatch, talent
-- acquisition, branding, HR communications, identity management, integrations,
-- workforce identity, attendance support, employee / entity profiles,
-- reporting (BI), billing, print platform, labels, payroll support, sales,
-- communications, CRM, finance support, service-desk, SCM / SOP, supplier
-- relationship management and notification routing. As in Phases 2-5, any
-- authenticated company member could previously INSERT / UPDATE / DELETE these
-- records directly through the browser client because the permissive *_all
-- policies were gated only by company_id = user_company_id().
--
-- This migration adds RESTRICTIVE write policies (INSERT / UPDATE / DELETE) to
-- 385 core business tables. Restrictive policies AND with the existing
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
--
-- Deliberately excluded from this phase:
--   * 16 control-plane / plumbing tables written by auth, membership, audit,
--     workflow-engine and service-role paths (tenants, audit_logs,
--     notifications, user_sessions, login_history, batch_trace_events,
--     config_change_log, email_outbox, notification_preferences, media_files,
--     tenant_audit, domain_events, tenant_provisioning_jobs,
--     tenant_setup_progress, job_queue, api_idempotency_keys), and
--   * 15 legacy identity / control-plane / plumbing tables that remain written
--     by the legacy client identity flow, the audit service or service-role
--     workers (profiles, audit_log, workflow_instances, roles, user_profiles,
--     qr_codes, print_agents, print_jobs, print_logs, verification_logs,
--     counterfeit_reports, fraud_alerts, system_settings,
--     user_company_memberships, job_dead_letters). These are addressed by the
--     identity-convergence and audit-hardening workstreams.
--
-- With this phase the write-gate programme is complete: 904 company-scoped
-- tables across five migrations carry 2,712 RESTRICTIVE write policies.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Asset Tracking: ast_ai_insights  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS ast_ai_insights_write_restrict_insert ON ast_ai_insights;
CREATE POLICY ast_ai_insights_write_restrict_insert ON ast_ai_insights AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['ast.ai','ast.manage','ast.view']));
DROP POLICY IF EXISTS ast_ai_insights_write_restrict_update ON ast_ai_insights;
CREATE POLICY ast_ai_insights_write_restrict_update ON ast_ai_insights AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['ast.ai','ast.manage','ast.view']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['ast.ai','ast.manage','ast.view']));
DROP POLICY IF EXISTS ast_ai_insights_write_restrict_delete ON ast_ai_insights;
CREATE POLICY ast_ai_insights_write_restrict_delete ON ast_ai_insights AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['ast.ai','ast.manage','ast.view']));
-- ----------------------------------------------------------------------------
-- Asset Tracking: ast_audit_log  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS ast_audit_log_write_restrict_insert ON ast_audit_log;
CREATE POLICY ast_audit_log_write_restrict_insert ON ast_audit_log AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['ast.audit','ast.manage']));
DROP POLICY IF EXISTS ast_audit_log_write_restrict_update ON ast_audit_log;
CREATE POLICY ast_audit_log_write_restrict_update ON ast_audit_log AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['ast.audit','ast.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['ast.audit','ast.manage']));
DROP POLICY IF EXISTS ast_audit_log_write_restrict_delete ON ast_audit_log;
CREATE POLICY ast_audit_log_write_restrict_delete ON ast_audit_log AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['ast.audit','ast.manage']));
-- ----------------------------------------------------------------------------
-- Attendance: att_ai_insights  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS att_ai_insights_write_restrict_insert ON att_ai_insights;
CREATE POLICY att_ai_insights_write_restrict_insert ON att_ai_insights AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['att.ai','att.manage','att.view']));
DROP POLICY IF EXISTS att_ai_insights_write_restrict_update ON att_ai_insights;
CREATE POLICY att_ai_insights_write_restrict_update ON att_ai_insights AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['att.ai','att.manage','att.view']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['att.ai','att.manage','att.view']));
DROP POLICY IF EXISTS att_ai_insights_write_restrict_delete ON att_ai_insights;
CREATE POLICY att_ai_insights_write_restrict_delete ON att_ai_insights AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['att.ai','att.manage','att.view']));
-- ----------------------------------------------------------------------------
-- Attendance: att_audit_log  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS att_audit_log_write_restrict_insert ON att_audit_log;
CREATE POLICY att_audit_log_write_restrict_insert ON att_audit_log AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['att.manage','att.admin']));
DROP POLICY IF EXISTS att_audit_log_write_restrict_update ON att_audit_log;
CREATE POLICY att_audit_log_write_restrict_update ON att_audit_log AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['att.manage','att.admin']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['att.manage','att.admin']));
DROP POLICY IF EXISTS att_audit_log_write_restrict_delete ON att_audit_log;
CREATE POLICY att_audit_log_write_restrict_delete ON att_audit_log AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['att.manage','att.admin']));
-- ----------------------------------------------------------------------------
-- Attendance: att_beacons  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS att_beacons_write_restrict_insert ON att_beacons;
CREATE POLICY att_beacons_write_restrict_insert ON att_beacons AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['att.manage','att.admin','att.devices']));
DROP POLICY IF EXISTS att_beacons_write_restrict_update ON att_beacons;
CREATE POLICY att_beacons_write_restrict_update ON att_beacons AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['att.manage','att.admin','att.devices']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['att.manage','att.admin','att.devices']));
DROP POLICY IF EXISTS att_beacons_write_restrict_delete ON att_beacons;
CREATE POLICY att_beacons_write_restrict_delete ON att_beacons AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['att.manage','att.admin','att.devices']));
-- ----------------------------------------------------------------------------
-- Attendance: att_breaks  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS att_breaks_write_restrict_insert ON att_breaks;
CREATE POLICY att_breaks_write_restrict_insert ON att_breaks AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['att.manage','att.admin','att.clock']));
DROP POLICY IF EXISTS att_breaks_write_restrict_update ON att_breaks;
CREATE POLICY att_breaks_write_restrict_update ON att_breaks AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['att.manage','att.admin','att.clock']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['att.manage','att.admin','att.clock']));
DROP POLICY IF EXISTS att_breaks_write_restrict_delete ON att_breaks;
CREATE POLICY att_breaks_write_restrict_delete ON att_breaks AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['att.manage','att.admin','att.clock']));
-- ----------------------------------------------------------------------------
-- Attendance: att_device_integrations  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS att_device_integrations_write_restrict_insert ON att_device_integrations;
CREATE POLICY att_device_integrations_write_restrict_insert ON att_device_integrations AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['att.manage','att.admin','att.devices']));
DROP POLICY IF EXISTS att_device_integrations_write_restrict_update ON att_device_integrations;
CREATE POLICY att_device_integrations_write_restrict_update ON att_device_integrations AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['att.manage','att.admin','att.devices']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['att.manage','att.admin','att.devices']));
DROP POLICY IF EXISTS att_device_integrations_write_restrict_delete ON att_device_integrations;
CREATE POLICY att_device_integrations_write_restrict_delete ON att_device_integrations AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['att.manage','att.admin','att.devices']));
-- ----------------------------------------------------------------------------
-- Attendance: att_device_punches  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS att_device_punches_write_restrict_insert ON att_device_punches;
CREATE POLICY att_device_punches_write_restrict_insert ON att_device_punches AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['att.devices','att.manage','att.admin']));
DROP POLICY IF EXISTS att_device_punches_write_restrict_update ON att_device_punches;
CREATE POLICY att_device_punches_write_restrict_update ON att_device_punches AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['att.devices','att.manage','att.admin']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['att.devices','att.manage','att.admin']));
DROP POLICY IF EXISTS att_device_punches_write_restrict_delete ON att_device_punches;
CREATE POLICY att_device_punches_write_restrict_delete ON att_device_punches AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['att.devices','att.manage','att.admin']));
-- ----------------------------------------------------------------------------
-- Attendance: att_device_sync_logs  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS att_device_sync_logs_write_restrict_insert ON att_device_sync_logs;
CREATE POLICY att_device_sync_logs_write_restrict_insert ON att_device_sync_logs AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['att.manage','att.admin','att.devices']));
DROP POLICY IF EXISTS att_device_sync_logs_write_restrict_update ON att_device_sync_logs;
CREATE POLICY att_device_sync_logs_write_restrict_update ON att_device_sync_logs AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['att.manage','att.admin','att.devices']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['att.manage','att.admin','att.devices']));
DROP POLICY IF EXISTS att_device_sync_logs_write_restrict_delete ON att_device_sync_logs;
CREATE POLICY att_device_sync_logs_write_restrict_delete ON att_device_sync_logs AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['att.manage','att.admin','att.devices']));
-- ----------------------------------------------------------------------------
-- Attendance: att_device_users  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS att_device_users_write_restrict_insert ON att_device_users;
CREATE POLICY att_device_users_write_restrict_insert ON att_device_users AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['att.manage','att.admin','att.devices']));
DROP POLICY IF EXISTS att_device_users_write_restrict_update ON att_device_users;
CREATE POLICY att_device_users_write_restrict_update ON att_device_users AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['att.manage','att.admin','att.devices']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['att.manage','att.admin','att.devices']));
DROP POLICY IF EXISTS att_device_users_write_restrict_delete ON att_device_users;
CREATE POLICY att_device_users_write_restrict_delete ON att_device_users AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['att.manage','att.admin','att.devices']));
-- ----------------------------------------------------------------------------
-- Attendance: att_devices  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS att_devices_write_restrict_insert ON att_devices;
CREATE POLICY att_devices_write_restrict_insert ON att_devices AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['att.manage','att.admin','att.devices']));
DROP POLICY IF EXISTS att_devices_write_restrict_update ON att_devices;
CREATE POLICY att_devices_write_restrict_update ON att_devices AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['att.manage','att.admin','att.devices']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['att.manage','att.admin','att.devices']));
DROP POLICY IF EXISTS att_devices_write_restrict_delete ON att_devices;
CREATE POLICY att_devices_write_restrict_delete ON att_devices AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['att.manage','att.admin','att.devices']));
-- ----------------------------------------------------------------------------
-- Attendance: att_events  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS att_events_write_restrict_insert ON att_events;
CREATE POLICY att_events_write_restrict_insert ON att_events AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['att.manage','att.admin','att.clock']));
DROP POLICY IF EXISTS att_events_write_restrict_update ON att_events;
CREATE POLICY att_events_write_restrict_update ON att_events AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['att.manage','att.admin','att.clock']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['att.manage','att.admin','att.clock']));
DROP POLICY IF EXISTS att_events_write_restrict_delete ON att_events;
CREATE POLICY att_events_write_restrict_delete ON att_events AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['att.manage','att.admin','att.clock']));
-- ----------------------------------------------------------------------------
-- Attendance: att_field_assignments  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS att_field_assignments_write_restrict_insert ON att_field_assignments;
CREATE POLICY att_field_assignments_write_restrict_insert ON att_field_assignments AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['att.manage','att.admin','att.field']));
DROP POLICY IF EXISTS att_field_assignments_write_restrict_update ON att_field_assignments;
CREATE POLICY att_field_assignments_write_restrict_update ON att_field_assignments AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['att.manage','att.admin','att.field']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['att.manage','att.admin','att.field']));
DROP POLICY IF EXISTS att_field_assignments_write_restrict_delete ON att_field_assignments;
CREATE POLICY att_field_assignments_write_restrict_delete ON att_field_assignments AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['att.manage','att.admin','att.field']));
-- ----------------------------------------------------------------------------
-- Attendance: att_geofences  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS att_geofences_write_restrict_insert ON att_geofences;
CREATE POLICY att_geofences_write_restrict_insert ON att_geofences AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['att.manage','att.admin','att.field']));
DROP POLICY IF EXISTS att_geofences_write_restrict_update ON att_geofences;
CREATE POLICY att_geofences_write_restrict_update ON att_geofences AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['att.manage','att.admin','att.field']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['att.manage','att.admin','att.field']));
DROP POLICY IF EXISTS att_geofences_write_restrict_delete ON att_geofences;
CREATE POLICY att_geofences_write_restrict_delete ON att_geofences AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['att.manage','att.admin','att.field']));
-- ----------------------------------------------------------------------------
-- Attendance: att_locations  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS att_locations_write_restrict_insert ON att_locations;
CREATE POLICY att_locations_write_restrict_insert ON att_locations AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['att.manage','att.admin','att.field']));
DROP POLICY IF EXISTS att_locations_write_restrict_update ON att_locations;
CREATE POLICY att_locations_write_restrict_update ON att_locations AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['att.manage','att.admin','att.field']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['att.manage','att.admin','att.field']));
DROP POLICY IF EXISTS att_locations_write_restrict_delete ON att_locations;
CREATE POLICY att_locations_write_restrict_delete ON att_locations AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['att.manage','att.admin','att.field']));
-- ----------------------------------------------------------------------------
-- Attendance: att_nfc_tags  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS att_nfc_tags_write_restrict_insert ON att_nfc_tags;
CREATE POLICY att_nfc_tags_write_restrict_insert ON att_nfc_tags AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['att.manage','att.admin','att.devices']));
DROP POLICY IF EXISTS att_nfc_tags_write_restrict_update ON att_nfc_tags;
CREATE POLICY att_nfc_tags_write_restrict_update ON att_nfc_tags AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['att.manage','att.admin','att.devices']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['att.manage','att.admin','att.devices']));
DROP POLICY IF EXISTS att_nfc_tags_write_restrict_delete ON att_nfc_tags;
CREATE POLICY att_nfc_tags_write_restrict_delete ON att_nfc_tags AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['att.manage','att.admin','att.devices']));
-- ----------------------------------------------------------------------------
-- Attendance: att_notifications  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS att_notifications_write_restrict_insert ON att_notifications;
CREATE POLICY att_notifications_write_restrict_insert ON att_notifications AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['att.manage','att.admin']));
DROP POLICY IF EXISTS att_notifications_write_restrict_update ON att_notifications;
CREATE POLICY att_notifications_write_restrict_update ON att_notifications AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['att.manage','att.admin']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['att.manage','att.admin']));
DROP POLICY IF EXISTS att_notifications_write_restrict_delete ON att_notifications;
CREATE POLICY att_notifications_write_restrict_delete ON att_notifications AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['att.manage','att.admin']));
-- ----------------------------------------------------------------------------
-- Attendance: att_policies  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS att_policies_write_restrict_insert ON att_policies;
CREATE POLICY att_policies_write_restrict_insert ON att_policies AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['att.manage','att.admin']));
DROP POLICY IF EXISTS att_policies_write_restrict_update ON att_policies;
CREATE POLICY att_policies_write_restrict_update ON att_policies AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['att.manage','att.admin']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['att.manage','att.admin']));
DROP POLICY IF EXISTS att_policies_write_restrict_delete ON att_policies;
CREATE POLICY att_policies_write_restrict_delete ON att_policies AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['att.manage','att.admin']));
-- ----------------------------------------------------------------------------
-- Attendance: att_qr_tokens  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS att_qr_tokens_write_restrict_insert ON att_qr_tokens;
CREATE POLICY att_qr_tokens_write_restrict_insert ON att_qr_tokens AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['att.manage','att.admin','att.devices']));
DROP POLICY IF EXISTS att_qr_tokens_write_restrict_update ON att_qr_tokens;
CREATE POLICY att_qr_tokens_write_restrict_update ON att_qr_tokens AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['att.manage','att.admin','att.devices']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['att.manage','att.admin','att.devices']));
DROP POLICY IF EXISTS att_qr_tokens_write_restrict_delete ON att_qr_tokens;
CREATE POLICY att_qr_tokens_write_restrict_delete ON att_qr_tokens AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['att.manage','att.admin','att.devices']));
-- ----------------------------------------------------------------------------
-- Attendance: att_rfid_badges  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS att_rfid_badges_write_restrict_insert ON att_rfid_badges;
CREATE POLICY att_rfid_badges_write_restrict_insert ON att_rfid_badges AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['att.manage','att.admin','att.devices']));
DROP POLICY IF EXISTS att_rfid_badges_write_restrict_update ON att_rfid_badges;
CREATE POLICY att_rfid_badges_write_restrict_update ON att_rfid_badges AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['att.manage','att.admin','att.devices']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['att.manage','att.admin','att.devices']));
DROP POLICY IF EXISTS att_rfid_badges_write_restrict_delete ON att_rfid_badges;
CREATE POLICY att_rfid_badges_write_restrict_delete ON att_rfid_badges AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['att.manage','att.admin','att.devices']));
-- ----------------------------------------------------------------------------
-- Attendance: att_shift_rotations  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS att_shift_rotations_write_restrict_insert ON att_shift_rotations;
CREATE POLICY att_shift_rotations_write_restrict_insert ON att_shift_rotations AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['att.manage','att.admin']));
DROP POLICY IF EXISTS att_shift_rotations_write_restrict_update ON att_shift_rotations;
CREATE POLICY att_shift_rotations_write_restrict_update ON att_shift_rotations AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['att.manage','att.admin']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['att.manage','att.admin']));
DROP POLICY IF EXISTS att_shift_rotations_write_restrict_delete ON att_shift_rotations;
CREATE POLICY att_shift_rotations_write_restrict_delete ON att_shift_rotations AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['att.manage','att.admin']));
-- ----------------------------------------------------------------------------
-- Attendance: att_violations  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS att_violations_write_restrict_insert ON att_violations;
CREATE POLICY att_violations_write_restrict_insert ON att_violations AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['att.manage','att.admin','att.approve']));
DROP POLICY IF EXISTS att_violations_write_restrict_update ON att_violations;
CREATE POLICY att_violations_write_restrict_update ON att_violations AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['att.manage','att.admin','att.approve']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['att.manage','att.admin','att.approve']));
DROP POLICY IF EXISTS att_violations_write_restrict_delete ON att_violations;
CREATE POLICY att_violations_write_restrict_delete ON att_violations AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['att.manage','att.admin','att.approve']));
-- ----------------------------------------------------------------------------
-- Business Intelligence: bi_ai_insights  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS bi_ai_insights_write_restrict_insert ON bi_ai_insights;
CREATE POLICY bi_ai_insights_write_restrict_insert ON bi_ai_insights AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['reports.ai','reports.manage','reports.view']));
DROP POLICY IF EXISTS bi_ai_insights_write_restrict_update ON bi_ai_insights;
CREATE POLICY bi_ai_insights_write_restrict_update ON bi_ai_insights AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['reports.ai','reports.manage','reports.view']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['reports.ai','reports.manage','reports.view']));
DROP POLICY IF EXISTS bi_ai_insights_write_restrict_delete ON bi_ai_insights;
CREATE POLICY bi_ai_insights_write_restrict_delete ON bi_ai_insights AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['reports.ai','reports.manage','reports.view']));
-- ----------------------------------------------------------------------------
-- Business Intelligence: bi_assistant_messages  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS bi_assistant_messages_write_restrict_insert ON bi_assistant_messages;
CREATE POLICY bi_assistant_messages_write_restrict_insert ON bi_assistant_messages AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['reports.manage','reports.ai','reports.assistant']));
DROP POLICY IF EXISTS bi_assistant_messages_write_restrict_update ON bi_assistant_messages;
CREATE POLICY bi_assistant_messages_write_restrict_update ON bi_assistant_messages AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['reports.manage','reports.ai','reports.assistant']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['reports.manage','reports.ai','reports.assistant']));
DROP POLICY IF EXISTS bi_assistant_messages_write_restrict_delete ON bi_assistant_messages;
CREATE POLICY bi_assistant_messages_write_restrict_delete ON bi_assistant_messages AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['reports.manage','reports.ai','reports.assistant']));
-- ----------------------------------------------------------------------------
-- Business Intelligence: bi_assistant_playbooks  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS bi_assistant_playbooks_write_restrict_insert ON bi_assistant_playbooks;
CREATE POLICY bi_assistant_playbooks_write_restrict_insert ON bi_assistant_playbooks AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['reports.manage','reports.assistant']));
DROP POLICY IF EXISTS bi_assistant_playbooks_write_restrict_update ON bi_assistant_playbooks;
CREATE POLICY bi_assistant_playbooks_write_restrict_update ON bi_assistant_playbooks AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['reports.manage','reports.assistant']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['reports.manage','reports.assistant']));
DROP POLICY IF EXISTS bi_assistant_playbooks_write_restrict_delete ON bi_assistant_playbooks;
CREATE POLICY bi_assistant_playbooks_write_restrict_delete ON bi_assistant_playbooks AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['reports.manage','reports.assistant']));
-- ----------------------------------------------------------------------------
-- Business Intelligence: bi_assistant_sessions  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS bi_assistant_sessions_write_restrict_insert ON bi_assistant_sessions;
CREATE POLICY bi_assistant_sessions_write_restrict_insert ON bi_assistant_sessions AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['reports.manage','reports.ai','reports.assistant']));
DROP POLICY IF EXISTS bi_assistant_sessions_write_restrict_update ON bi_assistant_sessions;
CREATE POLICY bi_assistant_sessions_write_restrict_update ON bi_assistant_sessions AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['reports.manage','reports.ai','reports.assistant']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['reports.manage','reports.ai','reports.assistant']));
DROP POLICY IF EXISTS bi_assistant_sessions_write_restrict_delete ON bi_assistant_sessions;
CREATE POLICY bi_assistant_sessions_write_restrict_delete ON bi_assistant_sessions AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['reports.manage','reports.ai','reports.assistant']));
-- ----------------------------------------------------------------------------
-- Business Intelligence: bi_notification_queue  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS bi_notification_queue_write_restrict_insert ON bi_notification_queue;
CREATE POLICY bi_notification_queue_write_restrict_insert ON bi_notification_queue AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['reports.manage','reports.schedule']));
DROP POLICY IF EXISTS bi_notification_queue_write_restrict_update ON bi_notification_queue;
CREATE POLICY bi_notification_queue_write_restrict_update ON bi_notification_queue AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['reports.manage','reports.schedule']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['reports.manage','reports.schedule']));
DROP POLICY IF EXISTS bi_notification_queue_write_restrict_delete ON bi_notification_queue;
CREATE POLICY bi_notification_queue_write_restrict_delete ON bi_notification_queue AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['reports.manage','reports.schedule']));
-- ----------------------------------------------------------------------------
-- Business Intelligence: bi_search_index  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS bi_search_index_write_restrict_insert ON bi_search_index;
CREATE POLICY bi_search_index_write_restrict_insert ON bi_search_index AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['reports.manage','reports.search']));
DROP POLICY IF EXISTS bi_search_index_write_restrict_update ON bi_search_index;
CREATE POLICY bi_search_index_write_restrict_update ON bi_search_index AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['reports.manage','reports.search']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['reports.manage','reports.search']));
DROP POLICY IF EXISTS bi_search_index_write_restrict_delete ON bi_search_index;
CREATE POLICY bi_search_index_write_restrict_delete ON bi_search_index AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['reports.manage','reports.search']));
-- ----------------------------------------------------------------------------
-- Billing: bill_ai_logs  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS bill_ai_logs_write_restrict_insert ON bill_ai_logs;
CREATE POLICY bill_ai_logs_write_restrict_insert ON bill_ai_logs AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['billing.manage','billing.ai']));
DROP POLICY IF EXISTS bill_ai_logs_write_restrict_update ON bill_ai_logs;
CREATE POLICY bill_ai_logs_write_restrict_update ON bill_ai_logs AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['billing.manage','billing.ai']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['billing.manage','billing.ai']));
DROP POLICY IF EXISTS bill_ai_logs_write_restrict_delete ON bill_ai_logs;
CREATE POLICY bill_ai_logs_write_restrict_delete ON bill_ai_logs AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['billing.manage','billing.ai']));
-- ----------------------------------------------------------------------------
-- Billing: bill_communications  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS bill_communications_write_restrict_insert ON bill_communications;
CREATE POLICY bill_communications_write_restrict_insert ON bill_communications AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['billing.manage','comm.manage']));
DROP POLICY IF EXISTS bill_communications_write_restrict_update ON bill_communications;
CREATE POLICY bill_communications_write_restrict_update ON bill_communications AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['billing.manage','comm.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['billing.manage','comm.manage']));
DROP POLICY IF EXISTS bill_communications_write_restrict_delete ON bill_communications;
CREATE POLICY bill_communications_write_restrict_delete ON bill_communications AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['billing.manage','comm.manage']));
-- ----------------------------------------------------------------------------
-- Billing: bill_credit_events  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS bill_credit_events_write_restrict_insert ON bill_credit_events;
CREATE POLICY bill_credit_events_write_restrict_insert ON bill_credit_events AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['billing.manage','billing.credit','billing.approve']));
DROP POLICY IF EXISTS bill_credit_events_write_restrict_update ON bill_credit_events;
CREATE POLICY bill_credit_events_write_restrict_update ON bill_credit_events AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['billing.manage','billing.credit','billing.approve']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['billing.manage','billing.credit','billing.approve']));
DROP POLICY IF EXISTS bill_credit_events_write_restrict_delete ON bill_credit_events;
CREATE POLICY bill_credit_events_write_restrict_delete ON bill_credit_events AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['billing.manage','billing.credit','billing.approve']));
-- ----------------------------------------------------------------------------
-- Billing: bill_delivery_logs  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS bill_delivery_logs_write_restrict_insert ON bill_delivery_logs;
CREATE POLICY bill_delivery_logs_write_restrict_insert ON bill_delivery_logs AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['billing.manage','billing.collect','billing.portal']));
DROP POLICY IF EXISTS bill_delivery_logs_write_restrict_update ON bill_delivery_logs;
CREATE POLICY bill_delivery_logs_write_restrict_update ON bill_delivery_logs AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['billing.manage','billing.collect','billing.portal']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['billing.manage','billing.collect','billing.portal']));
DROP POLICY IF EXISTS bill_delivery_logs_write_restrict_delete ON bill_delivery_logs;
CREATE POLICY bill_delivery_logs_write_restrict_delete ON bill_delivery_logs AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['billing.manage','billing.collect','billing.portal']));
-- ----------------------------------------------------------------------------
-- Branding: brand_approvals  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS brand_approvals_write_restrict_insert ON brand_approvals;
CREATE POLICY brand_approvals_write_restrict_insert ON brand_approvals AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['brand.manage','brand.approve']));
DROP POLICY IF EXISTS brand_approvals_write_restrict_update ON brand_approvals;
CREATE POLICY brand_approvals_write_restrict_update ON brand_approvals AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['brand.manage','brand.approve']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['brand.manage','brand.approve']));
DROP POLICY IF EXISTS brand_approvals_write_restrict_delete ON brand_approvals;
CREATE POLICY brand_approvals_write_restrict_delete ON brand_approvals AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['brand.manage','brand.approve']));
-- ----------------------------------------------------------------------------
-- Branding: brand_assets  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS brand_assets_write_restrict_insert ON brand_assets;
CREATE POLICY brand_assets_write_restrict_insert ON brand_assets AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['brand.manage','brand.assets']));
DROP POLICY IF EXISTS brand_assets_write_restrict_update ON brand_assets;
CREATE POLICY brand_assets_write_restrict_update ON brand_assets AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['brand.manage','brand.assets']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['brand.manage','brand.assets']));
DROP POLICY IF EXISTS brand_assets_write_restrict_delete ON brand_assets;
CREATE POLICY brand_assets_write_restrict_delete ON brand_assets AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['brand.manage','brand.assets']));
-- ----------------------------------------------------------------------------
-- Branding: brand_audit  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS brand_audit_write_restrict_insert ON brand_audit;
CREATE POLICY brand_audit_write_restrict_insert ON brand_audit AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['brand.manage','brand.view']));
DROP POLICY IF EXISTS brand_audit_write_restrict_update ON brand_audit;
CREATE POLICY brand_audit_write_restrict_update ON brand_audit AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['brand.manage','brand.view']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['brand.manage','brand.view']));
DROP POLICY IF EXISTS brand_audit_write_restrict_delete ON brand_audit;
CREATE POLICY brand_audit_write_restrict_delete ON brand_audit AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['brand.manage','brand.view']));
-- ----------------------------------------------------------------------------
-- Branding: brand_branch_overrides  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS brand_branch_overrides_write_restrict_insert ON brand_branch_overrides;
CREATE POLICY brand_branch_overrides_write_restrict_insert ON brand_branch_overrides AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['brand.manage','brand.publish']));
DROP POLICY IF EXISTS brand_branch_overrides_write_restrict_update ON brand_branch_overrides;
CREATE POLICY brand_branch_overrides_write_restrict_update ON brand_branch_overrides AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['brand.manage','brand.publish']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['brand.manage','brand.publish']));
DROP POLICY IF EXISTS brand_branch_overrides_write_restrict_delete ON brand_branch_overrides;
CREATE POLICY brand_branch_overrides_write_restrict_delete ON brand_branch_overrides AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['brand.manage','brand.publish']));
-- ----------------------------------------------------------------------------
-- Branding: brand_colors  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS brand_colors_write_restrict_insert ON brand_colors;
CREATE POLICY brand_colors_write_restrict_insert ON brand_colors AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['brand.manage','brand.design']));
DROP POLICY IF EXISTS brand_colors_write_restrict_update ON brand_colors;
CREATE POLICY brand_colors_write_restrict_update ON brand_colors AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['brand.manage','brand.design']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['brand.manage','brand.design']));
DROP POLICY IF EXISTS brand_colors_write_restrict_delete ON brand_colors;
CREATE POLICY brand_colors_write_restrict_delete ON brand_colors AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['brand.manage','brand.design']));
-- ----------------------------------------------------------------------------
-- Branding: brand_compliance_issues  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS brand_compliance_issues_write_restrict_insert ON brand_compliance_issues;
CREATE POLICY brand_compliance_issues_write_restrict_insert ON brand_compliance_issues AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['brand.manage','brand.approve','brand.view']));
DROP POLICY IF EXISTS brand_compliance_issues_write_restrict_update ON brand_compliance_issues;
CREATE POLICY brand_compliance_issues_write_restrict_update ON brand_compliance_issues AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['brand.manage','brand.approve','brand.view']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['brand.manage','brand.approve','brand.view']));
DROP POLICY IF EXISTS brand_compliance_issues_write_restrict_delete ON brand_compliance_issues;
CREATE POLICY brand_compliance_issues_write_restrict_delete ON brand_compliance_issues AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['brand.manage','brand.approve','brand.view']));
-- ----------------------------------------------------------------------------
-- Branding: brand_email_signatures  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS brand_email_signatures_write_restrict_insert ON brand_email_signatures;
CREATE POLICY brand_email_signatures_write_restrict_insert ON brand_email_signatures AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['brand.manage','brand.design']));
DROP POLICY IF EXISTS brand_email_signatures_write_restrict_update ON brand_email_signatures;
CREATE POLICY brand_email_signatures_write_restrict_update ON brand_email_signatures AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['brand.manage','brand.design']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['brand.manage','brand.design']));
DROP POLICY IF EXISTS brand_email_signatures_write_restrict_delete ON brand_email_signatures;
CREATE POLICY brand_email_signatures_write_restrict_delete ON brand_email_signatures AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['brand.manage','brand.design']));
-- ----------------------------------------------------------------------------
-- Branding: brand_fonts  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS brand_fonts_write_restrict_insert ON brand_fonts;
CREATE POLICY brand_fonts_write_restrict_insert ON brand_fonts AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['brand.manage','brand.design']));
DROP POLICY IF EXISTS brand_fonts_write_restrict_update ON brand_fonts;
CREATE POLICY brand_fonts_write_restrict_update ON brand_fonts AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['brand.manage','brand.design']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['brand.manage','brand.design']));
DROP POLICY IF EXISTS brand_fonts_write_restrict_delete ON brand_fonts;
CREATE POLICY brand_fonts_write_restrict_delete ON brand_fonts AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['brand.manage','brand.design']));
-- ----------------------------------------------------------------------------
-- Branding: brand_guidelines  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS brand_guidelines_write_restrict_insert ON brand_guidelines;
CREATE POLICY brand_guidelines_write_restrict_insert ON brand_guidelines AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['brand.manage','brand.publish','brand.design']));
DROP POLICY IF EXISTS brand_guidelines_write_restrict_update ON brand_guidelines;
CREATE POLICY brand_guidelines_write_restrict_update ON brand_guidelines AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['brand.manage','brand.publish','brand.design']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['brand.manage','brand.publish','brand.design']));
DROP POLICY IF EXISTS brand_guidelines_write_restrict_delete ON brand_guidelines;
CREATE POLICY brand_guidelines_write_restrict_delete ON brand_guidelines AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['brand.manage','brand.publish','brand.design']));
-- ----------------------------------------------------------------------------
-- Branding: brand_logos  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS brand_logos_write_restrict_insert ON brand_logos;
CREATE POLICY brand_logos_write_restrict_insert ON brand_logos AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['brand.manage','brand.assets','brand.design']));
DROP POLICY IF EXISTS brand_logos_write_restrict_update ON brand_logos;
CREATE POLICY brand_logos_write_restrict_update ON brand_logos AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['brand.manage','brand.assets','brand.design']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['brand.manage','brand.assets','brand.design']));
DROP POLICY IF EXISTS brand_logos_write_restrict_delete ON brand_logos;
CREATE POLICY brand_logos_write_restrict_delete ON brand_logos AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['brand.manage','brand.assets','brand.design']));
-- ----------------------------------------------------------------------------
-- Branding: brand_product_profiles  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS brand_product_profiles_write_restrict_insert ON brand_product_profiles;
CREATE POLICY brand_product_profiles_write_restrict_insert ON brand_product_profiles AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['brand.manage','brand.assets']));
DROP POLICY IF EXISTS brand_product_profiles_write_restrict_update ON brand_product_profiles;
CREATE POLICY brand_product_profiles_write_restrict_update ON brand_product_profiles AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['brand.manage','brand.assets']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['brand.manage','brand.assets']));
DROP POLICY IF EXISTS brand_product_profiles_write_restrict_delete ON brand_product_profiles;
CREATE POLICY brand_product_profiles_write_restrict_delete ON brand_product_profiles AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['brand.manage','brand.assets']));
-- ----------------------------------------------------------------------------
-- Branding: brand_profiles  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS brand_profiles_write_restrict_insert ON brand_profiles;
CREATE POLICY brand_profiles_write_restrict_insert ON brand_profiles AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['brand.manage','brand.publish']));
DROP POLICY IF EXISTS brand_profiles_write_restrict_update ON brand_profiles;
CREATE POLICY brand_profiles_write_restrict_update ON brand_profiles AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['brand.manage','brand.publish']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['brand.manage','brand.publish']));
DROP POLICY IF EXISTS brand_profiles_write_restrict_delete ON brand_profiles;
CREATE POLICY brand_profiles_write_restrict_delete ON brand_profiles AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['brand.manage','brand.publish']));
-- ----------------------------------------------------------------------------
-- Branding: brand_templates  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS brand_templates_write_restrict_insert ON brand_templates;
CREATE POLICY brand_templates_write_restrict_insert ON brand_templates AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['brand.manage','brand.design']));
DROP POLICY IF EXISTS brand_templates_write_restrict_update ON brand_templates;
CREATE POLICY brand_templates_write_restrict_update ON brand_templates AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['brand.manage','brand.design']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['brand.manage','brand.design']));
DROP POLICY IF EXISTS brand_templates_write_restrict_delete ON brand_templates;
CREATE POLICY brand_templates_write_restrict_delete ON brand_templates AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['brand.manage','brand.design']));
-- ----------------------------------------------------------------------------
-- Branding: brand_ui_themes  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS brand_ui_themes_write_restrict_insert ON brand_ui_themes;
CREATE POLICY brand_ui_themes_write_restrict_insert ON brand_ui_themes AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['brand.manage','brand.design']));
DROP POLICY IF EXISTS brand_ui_themes_write_restrict_update ON brand_ui_themes;
CREATE POLICY brand_ui_themes_write_restrict_update ON brand_ui_themes AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['brand.manage','brand.design']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['brand.manage','brand.design']));
DROP POLICY IF EXISTS brand_ui_themes_write_restrict_delete ON brand_ui_themes;
CREATE POLICY brand_ui_themes_write_restrict_delete ON brand_ui_themes AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['brand.manage','brand.design']));
-- ----------------------------------------------------------------------------
-- Communications: comm_attachments  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS comm_attachments_write_restrict_insert ON comm_attachments;
CREATE POLICY comm_attachments_write_restrict_insert ON comm_attachments AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['comm.manage','comm.broadcast','comm.templates']));
DROP POLICY IF EXISTS comm_attachments_write_restrict_update ON comm_attachments;
CREATE POLICY comm_attachments_write_restrict_update ON comm_attachments AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['comm.manage','comm.broadcast','comm.templates']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['comm.manage','comm.broadcast','comm.templates']));
DROP POLICY IF EXISTS comm_attachments_write_restrict_delete ON comm_attachments;
CREATE POLICY comm_attachments_write_restrict_delete ON comm_attachments AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['comm.manage','comm.broadcast','comm.templates']));
-- ----------------------------------------------------------------------------
-- Communications: comm_audit_log  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS comm_audit_log_write_restrict_insert ON comm_audit_log;
CREATE POLICY comm_audit_log_write_restrict_insert ON comm_audit_log AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['comm.manage','comm.admin']));
DROP POLICY IF EXISTS comm_audit_log_write_restrict_update ON comm_audit_log;
CREATE POLICY comm_audit_log_write_restrict_update ON comm_audit_log AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['comm.manage','comm.admin']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['comm.manage','comm.admin']));
DROP POLICY IF EXISTS comm_audit_log_write_restrict_delete ON comm_audit_log;
CREATE POLICY comm_audit_log_write_restrict_delete ON comm_audit_log AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['comm.manage','comm.admin']));
-- ----------------------------------------------------------------------------
-- Communications: comm_delivery_events  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS comm_delivery_events_write_restrict_insert ON comm_delivery_events;
CREATE POLICY comm_delivery_events_write_restrict_insert ON comm_delivery_events AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['comm.manage','comm.broadcast','comm.admin']));
DROP POLICY IF EXISTS comm_delivery_events_write_restrict_update ON comm_delivery_events;
CREATE POLICY comm_delivery_events_write_restrict_update ON comm_delivery_events AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['comm.manage','comm.broadcast','comm.admin']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['comm.manage','comm.broadcast','comm.admin']));
DROP POLICY IF EXISTS comm_delivery_events_write_restrict_delete ON comm_delivery_events;
CREATE POLICY comm_delivery_events_write_restrict_delete ON comm_delivery_events AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['comm.manage','comm.broadcast','comm.admin']));
-- ----------------------------------------------------------------------------
-- CRM: crm_audit_log  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS crm_audit_log_write_restrict_insert ON crm_audit_log;
CREATE POLICY crm_audit_log_write_restrict_insert ON crm_audit_log AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['crm.manage','crm.admin']));
DROP POLICY IF EXISTS crm_audit_log_write_restrict_update ON crm_audit_log;
CREATE POLICY crm_audit_log_write_restrict_update ON crm_audit_log AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['crm.manage','crm.admin']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['crm.manage','crm.admin']));
DROP POLICY IF EXISTS crm_audit_log_write_restrict_delete ON crm_audit_log;
CREATE POLICY crm_audit_log_write_restrict_delete ON crm_audit_log AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['crm.manage','crm.admin']));
-- ----------------------------------------------------------------------------
-- CRM: crm_feedback  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS crm_feedback_write_restrict_insert ON crm_feedback;
CREATE POLICY crm_feedback_write_restrict_insert ON crm_feedback AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['crm.manage','crm.service','crm.view']));
DROP POLICY IF EXISTS crm_feedback_write_restrict_update ON crm_feedback;
CREATE POLICY crm_feedback_write_restrict_update ON crm_feedback AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['crm.manage','crm.service','crm.view']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['crm.manage','crm.service','crm.view']));
DROP POLICY IF EXISTS crm_feedback_write_restrict_delete ON crm_feedback;
CREATE POLICY crm_feedback_write_restrict_delete ON crm_feedback AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['crm.manage','crm.service','crm.view']));
-- ----------------------------------------------------------------------------
-- CRM: crm_merge_log  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS crm_merge_log_write_restrict_insert ON crm_merge_log;
CREATE POLICY crm_merge_log_write_restrict_insert ON crm_merge_log AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['crm.manage','crm.admin','crm.export']));
DROP POLICY IF EXISTS crm_merge_log_write_restrict_update ON crm_merge_log;
CREATE POLICY crm_merge_log_write_restrict_update ON crm_merge_log AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['crm.manage','crm.admin','crm.export']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['crm.manage','crm.admin','crm.export']));
DROP POLICY IF EXISTS crm_merge_log_write_restrict_delete ON crm_merge_log;
CREATE POLICY crm_merge_log_write_restrict_delete ON crm_merge_log AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['crm.manage','crm.admin','crm.export']));
-- ----------------------------------------------------------------------------
-- Digital Identity: di_ai_insights  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS di_ai_insights_write_restrict_insert ON di_ai_insights;
CREATE POLICY di_ai_insights_write_restrict_insert ON di_ai_insights AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['di.manage','di.ai','di.view']));
DROP POLICY IF EXISTS di_ai_insights_write_restrict_update ON di_ai_insights;
CREATE POLICY di_ai_insights_write_restrict_update ON di_ai_insights AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['di.manage','di.ai','di.view']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['di.manage','di.ai','di.view']));
DROP POLICY IF EXISTS di_ai_insights_write_restrict_delete ON di_ai_insights;
CREATE POLICY di_ai_insights_write_restrict_delete ON di_ai_insights AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['di.manage','di.ai','di.view']));
-- ----------------------------------------------------------------------------
-- Digital Identity: di_sync_log  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS di_sync_log_write_restrict_insert ON di_sync_log;
CREATE POLICY di_sync_log_write_restrict_insert ON di_sync_log AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['di.manage','di.admin']));
DROP POLICY IF EXISTS di_sync_log_write_restrict_update ON di_sync_log;
CREATE POLICY di_sync_log_write_restrict_update ON di_sync_log AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['di.manage','di.admin']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['di.manage','di.admin']));
DROP POLICY IF EXISTS di_sync_log_write_restrict_delete ON di_sync_log;
CREATE POLICY di_sync_log_write_restrict_delete ON di_sync_log AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['di.manage','di.admin']));
-- ----------------------------------------------------------------------------
-- Disaster Recovery: drp_plans  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS drp_plans_write_restrict_insert ON drp_plans;
CREATE POLICY drp_plans_write_restrict_insert ON drp_plans AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['ec.risk','scm.risk','security.admin','ec.manage']));
DROP POLICY IF EXISTS drp_plans_write_restrict_update ON drp_plans;
CREATE POLICY drp_plans_write_restrict_update ON drp_plans AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['ec.risk','scm.risk','security.admin','ec.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['ec.risk','scm.risk','security.admin','ec.manage']));
DROP POLICY IF EXISTS drp_plans_write_restrict_delete ON drp_plans;
CREATE POLICY drp_plans_write_restrict_delete ON drp_plans AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['ec.risk','scm.risk','security.admin','ec.manage']));
-- ----------------------------------------------------------------------------
-- Dispatch: dsp_ai_insights  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS dsp_ai_insights_write_restrict_insert ON dsp_ai_insights;
CREATE POLICY dsp_ai_insights_write_restrict_insert ON dsp_ai_insights AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['dsp.manage','dsp.ai','dsp.view']));
DROP POLICY IF EXISTS dsp_ai_insights_write_restrict_update ON dsp_ai_insights;
CREATE POLICY dsp_ai_insights_write_restrict_update ON dsp_ai_insights AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['dsp.manage','dsp.ai','dsp.view']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['dsp.manage','dsp.ai','dsp.view']));
DROP POLICY IF EXISTS dsp_ai_insights_write_restrict_delete ON dsp_ai_insights;
CREATE POLICY dsp_ai_insights_write_restrict_delete ON dsp_ai_insights AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['dsp.manage','dsp.ai','dsp.view']));
-- ----------------------------------------------------------------------------
-- Dispatch: dsp_audit_log  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS dsp_audit_log_write_restrict_insert ON dsp_audit_log;
CREATE POLICY dsp_audit_log_write_restrict_insert ON dsp_audit_log AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['dsp.manage','dispatch.manage','dsp.view']));
DROP POLICY IF EXISTS dsp_audit_log_write_restrict_update ON dsp_audit_log;
CREATE POLICY dsp_audit_log_write_restrict_update ON dsp_audit_log AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['dsp.manage','dispatch.manage','dsp.view']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['dsp.manage','dispatch.manage','dsp.view']));
DROP POLICY IF EXISTS dsp_audit_log_write_restrict_delete ON dsp_audit_log;
CREATE POLICY dsp_audit_log_write_restrict_delete ON dsp_audit_log AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['dsp.manage','dispatch.manage','dsp.view']));
-- ----------------------------------------------------------------------------
-- Dispatch: dsp_documents  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS dsp_documents_write_restrict_insert ON dsp_documents;
CREATE POLICY dsp_documents_write_restrict_insert ON dsp_documents AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['dsp.manage','dsp.operate']));
DROP POLICY IF EXISTS dsp_documents_write_restrict_update ON dsp_documents;
CREATE POLICY dsp_documents_write_restrict_update ON dsp_documents AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['dsp.manage','dsp.operate']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['dsp.manage','dsp.operate']));
DROP POLICY IF EXISTS dsp_documents_write_restrict_delete ON dsp_documents;
CREATE POLICY dsp_documents_write_restrict_delete ON dsp_documents AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['dsp.manage','dsp.operate']));
-- ----------------------------------------------------------------------------
-- Dispatch: dsp_drivers  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS dsp_drivers_write_restrict_insert ON dsp_drivers;
CREATE POLICY dsp_drivers_write_restrict_insert ON dsp_drivers AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['dsp.manage','dsp.operate']));
DROP POLICY IF EXISTS dsp_drivers_write_restrict_update ON dsp_drivers;
CREATE POLICY dsp_drivers_write_restrict_update ON dsp_drivers AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['dsp.manage','dsp.operate']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['dsp.manage','dsp.operate']));
DROP POLICY IF EXISTS dsp_drivers_write_restrict_delete ON dsp_drivers;
CREATE POLICY dsp_drivers_write_restrict_delete ON dsp_drivers AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['dsp.manage','dsp.operate']));
-- ----------------------------------------------------------------------------
-- Dispatch: dsp_exceptions  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS dsp_exceptions_write_restrict_insert ON dsp_exceptions;
CREATE POLICY dsp_exceptions_write_restrict_insert ON dsp_exceptions AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['dsp.manage','dsp.approve','dsp.operate']));
DROP POLICY IF EXISTS dsp_exceptions_write_restrict_update ON dsp_exceptions;
CREATE POLICY dsp_exceptions_write_restrict_update ON dsp_exceptions AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['dsp.manage','dsp.approve','dsp.operate']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['dsp.manage','dsp.approve','dsp.operate']));
DROP POLICY IF EXISTS dsp_exceptions_write_restrict_delete ON dsp_exceptions;
CREATE POLICY dsp_exceptions_write_restrict_delete ON dsp_exceptions AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['dsp.manage','dsp.approve','dsp.operate']));
-- ----------------------------------------------------------------------------
-- Dispatch: dsp_gps_points  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS dsp_gps_points_write_restrict_insert ON dsp_gps_points;
CREATE POLICY dsp_gps_points_write_restrict_insert ON dsp_gps_points AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['dsp.manage','dsp.operate','dsp.track']));
DROP POLICY IF EXISTS dsp_gps_points_write_restrict_update ON dsp_gps_points;
CREATE POLICY dsp_gps_points_write_restrict_update ON dsp_gps_points AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['dsp.manage','dsp.operate','dsp.track']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['dsp.manage','dsp.operate','dsp.track']));
DROP POLICY IF EXISTS dsp_gps_points_write_restrict_delete ON dsp_gps_points;
CREATE POLICY dsp_gps_points_write_restrict_delete ON dsp_gps_points AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['dsp.manage','dsp.operate','dsp.track']));
-- ----------------------------------------------------------------------------
-- Dispatch: dsp_loading_bays  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS dsp_loading_bays_write_restrict_insert ON dsp_loading_bays;
CREATE POLICY dsp_loading_bays_write_restrict_insert ON dsp_loading_bays AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['dsp.manage','dsp.operate']));
DROP POLICY IF EXISTS dsp_loading_bays_write_restrict_update ON dsp_loading_bays;
CREATE POLICY dsp_loading_bays_write_restrict_update ON dsp_loading_bays AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['dsp.manage','dsp.operate']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['dsp.manage','dsp.operate']));
DROP POLICY IF EXISTS dsp_loading_bays_write_restrict_delete ON dsp_loading_bays;
CREATE POLICY dsp_loading_bays_write_restrict_delete ON dsp_loading_bays AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['dsp.manage','dsp.operate']));
-- ----------------------------------------------------------------------------
-- Dispatch: dsp_loading_scans  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS dsp_loading_scans_write_restrict_insert ON dsp_loading_scans;
CREATE POLICY dsp_loading_scans_write_restrict_insert ON dsp_loading_scans AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['dsp.manage','dsp.operate']));
DROP POLICY IF EXISTS dsp_loading_scans_write_restrict_update ON dsp_loading_scans;
CREATE POLICY dsp_loading_scans_write_restrict_update ON dsp_loading_scans AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['dsp.manage','dsp.operate']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['dsp.manage','dsp.operate']));
DROP POLICY IF EXISTS dsp_loading_scans_write_restrict_delete ON dsp_loading_scans;
CREATE POLICY dsp_loading_scans_write_restrict_delete ON dsp_loading_scans AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['dsp.manage','dsp.operate']));
-- ----------------------------------------------------------------------------
-- Dispatch: dsp_loading_sessions  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS dsp_loading_sessions_write_restrict_insert ON dsp_loading_sessions;
CREATE POLICY dsp_loading_sessions_write_restrict_insert ON dsp_loading_sessions AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['dsp.manage','dsp.operate']));
DROP POLICY IF EXISTS dsp_loading_sessions_write_restrict_update ON dsp_loading_sessions;
CREATE POLICY dsp_loading_sessions_write_restrict_update ON dsp_loading_sessions AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['dsp.manage','dsp.operate']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['dsp.manage','dsp.operate']));
DROP POLICY IF EXISTS dsp_loading_sessions_write_restrict_delete ON dsp_loading_sessions;
CREATE POLICY dsp_loading_sessions_write_restrict_delete ON dsp_loading_sessions AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['dsp.manage','dsp.operate']));
-- ----------------------------------------------------------------------------
-- Dispatch: dsp_notifications  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS dsp_notifications_write_restrict_insert ON dsp_notifications;
CREATE POLICY dsp_notifications_write_restrict_insert ON dsp_notifications AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['dsp.manage','dispatch.manage']));
DROP POLICY IF EXISTS dsp_notifications_write_restrict_update ON dsp_notifications;
CREATE POLICY dsp_notifications_write_restrict_update ON dsp_notifications AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['dsp.manage','dispatch.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['dsp.manage','dispatch.manage']));
DROP POLICY IF EXISTS dsp_notifications_write_restrict_delete ON dsp_notifications;
CREATE POLICY dsp_notifications_write_restrict_delete ON dsp_notifications AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['dsp.manage','dispatch.manage']));
-- ----------------------------------------------------------------------------
-- Dispatch: dsp_pods  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS dsp_pods_write_restrict_insert ON dsp_pods;
CREATE POLICY dsp_pods_write_restrict_insert ON dsp_pods AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['dsp.manage','dsp.operate','dsp.track']));
DROP POLICY IF EXISTS dsp_pods_write_restrict_update ON dsp_pods;
CREATE POLICY dsp_pods_write_restrict_update ON dsp_pods AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['dsp.manage','dsp.operate','dsp.track']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['dsp.manage','dsp.operate','dsp.track']));
DROP POLICY IF EXISTS dsp_pods_write_restrict_delete ON dsp_pods;
CREATE POLICY dsp_pods_write_restrict_delete ON dsp_pods AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['dsp.manage','dsp.operate','dsp.track']));
-- ----------------------------------------------------------------------------
-- Dispatch: dsp_request_lines  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS dsp_request_lines_write_restrict_insert ON dsp_request_lines;
CREATE POLICY dsp_request_lines_write_restrict_insert ON dsp_request_lines AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['dsp.manage','dsp.approve','dsp.operate']));
DROP POLICY IF EXISTS dsp_request_lines_write_restrict_update ON dsp_request_lines;
CREATE POLICY dsp_request_lines_write_restrict_update ON dsp_request_lines AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['dsp.manage','dsp.approve','dsp.operate']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['dsp.manage','dsp.approve','dsp.operate']));
DROP POLICY IF EXISTS dsp_request_lines_write_restrict_delete ON dsp_request_lines;
CREATE POLICY dsp_request_lines_write_restrict_delete ON dsp_request_lines AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['dsp.manage','dsp.approve','dsp.operate']));
-- ----------------------------------------------------------------------------
-- Dispatch: dsp_requests  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS dsp_requests_write_restrict_insert ON dsp_requests;
CREATE POLICY dsp_requests_write_restrict_insert ON dsp_requests AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['dsp.manage','dsp.approve','dsp.operate']));
DROP POLICY IF EXISTS dsp_requests_write_restrict_update ON dsp_requests;
CREATE POLICY dsp_requests_write_restrict_update ON dsp_requests AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['dsp.manage','dsp.approve','dsp.operate']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['dsp.manage','dsp.approve','dsp.operate']));
DROP POLICY IF EXISTS dsp_requests_write_restrict_delete ON dsp_requests;
CREATE POLICY dsp_requests_write_restrict_delete ON dsp_requests AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['dsp.manage','dsp.approve','dsp.operate']));
-- ----------------------------------------------------------------------------
-- Dispatch: dsp_returns  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS dsp_returns_write_restrict_insert ON dsp_returns;
CREATE POLICY dsp_returns_write_restrict_insert ON dsp_returns AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['dsp.manage','dsp.operate','dsp.approve']));
DROP POLICY IF EXISTS dsp_returns_write_restrict_update ON dsp_returns;
CREATE POLICY dsp_returns_write_restrict_update ON dsp_returns AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['dsp.manage','dsp.operate','dsp.approve']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['dsp.manage','dsp.operate','dsp.approve']));
DROP POLICY IF EXISTS dsp_returns_write_restrict_delete ON dsp_returns;
CREATE POLICY dsp_returns_write_restrict_delete ON dsp_returns AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['dsp.manage','dsp.operate','dsp.approve']));
-- ----------------------------------------------------------------------------
-- Dispatch: dsp_route_stops  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS dsp_route_stops_write_restrict_insert ON dsp_route_stops;
CREATE POLICY dsp_route_stops_write_restrict_insert ON dsp_route_stops AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['dsp.manage','dsp.operate','dsp.track']));
DROP POLICY IF EXISTS dsp_route_stops_write_restrict_update ON dsp_route_stops;
CREATE POLICY dsp_route_stops_write_restrict_update ON dsp_route_stops AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['dsp.manage','dsp.operate','dsp.track']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['dsp.manage','dsp.operate','dsp.track']));
DROP POLICY IF EXISTS dsp_route_stops_write_restrict_delete ON dsp_route_stops;
CREATE POLICY dsp_route_stops_write_restrict_delete ON dsp_route_stops AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['dsp.manage','dsp.operate','dsp.track']));
-- ----------------------------------------------------------------------------
-- Dispatch: dsp_routes  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS dsp_routes_write_restrict_insert ON dsp_routes;
CREATE POLICY dsp_routes_write_restrict_insert ON dsp_routes AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['dsp.manage','dsp.operate','dsp.track']));
DROP POLICY IF EXISTS dsp_routes_write_restrict_update ON dsp_routes;
CREATE POLICY dsp_routes_write_restrict_update ON dsp_routes AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['dsp.manage','dsp.operate','dsp.track']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['dsp.manage','dsp.operate','dsp.track']));
DROP POLICY IF EXISTS dsp_routes_write_restrict_delete ON dsp_routes;
CREATE POLICY dsp_routes_write_restrict_delete ON dsp_routes AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['dsp.manage','dsp.operate','dsp.track']));
-- ----------------------------------------------------------------------------
-- Enterprise Archive & Logging: eal_ai_insights  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS eal_ai_insights_write_restrict_insert ON eal_ai_insights;
CREATE POLICY eal_ai_insights_write_restrict_insert ON eal_ai_insights AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['eal.manage','eal.ai','eal.view']));
DROP POLICY IF EXISTS eal_ai_insights_write_restrict_update ON eal_ai_insights;
CREATE POLICY eal_ai_insights_write_restrict_update ON eal_ai_insights AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['eal.manage','eal.ai','eal.view']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['eal.manage','eal.ai','eal.view']));
DROP POLICY IF EXISTS eal_ai_insights_write_restrict_delete ON eal_ai_insights;
CREATE POLICY eal_ai_insights_write_restrict_delete ON eal_ai_insights AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['eal.manage','eal.ai','eal.view']));
-- ----------------------------------------------------------------------------
-- Enterprise Archive & Logging: eal_alerts  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS eal_alerts_write_restrict_insert ON eal_alerts;
CREATE POLICY eal_alerts_write_restrict_insert ON eal_alerts AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['eal.manage','eal.security','eal.investigate']));
DROP POLICY IF EXISTS eal_alerts_write_restrict_update ON eal_alerts;
CREATE POLICY eal_alerts_write_restrict_update ON eal_alerts AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['eal.manage','eal.security','eal.investigate']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['eal.manage','eal.security','eal.investigate']));
DROP POLICY IF EXISTS eal_alerts_write_restrict_delete ON eal_alerts;
CREATE POLICY eal_alerts_write_restrict_delete ON eal_alerts AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['eal.manage','eal.security','eal.investigate']));
-- ----------------------------------------------------------------------------
-- Enterprise Archive & Logging: eal_api_calls  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS eal_api_calls_write_restrict_insert ON eal_api_calls;
CREATE POLICY eal_api_calls_write_restrict_insert ON eal_api_calls AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['eal.manage','eal.security','eal.infra']));
DROP POLICY IF EXISTS eal_api_calls_write_restrict_update ON eal_api_calls;
CREATE POLICY eal_api_calls_write_restrict_update ON eal_api_calls AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['eal.manage','eal.security','eal.infra']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['eal.manage','eal.security','eal.infra']));
DROP POLICY IF EXISTS eal_api_calls_write_restrict_delete ON eal_api_calls;
CREATE POLICY eal_api_calls_write_restrict_delete ON eal_api_calls AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['eal.manage','eal.security','eal.infra']));
-- ----------------------------------------------------------------------------
-- Enterprise Archive & Logging: eal_approvals  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS eal_approvals_write_restrict_insert ON eal_approvals;
CREATE POLICY eal_approvals_write_restrict_insert ON eal_approvals AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['eal.manage','eal.executive','eal.security']));
DROP POLICY IF EXISTS eal_approvals_write_restrict_update ON eal_approvals;
CREATE POLICY eal_approvals_write_restrict_update ON eal_approvals AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['eal.manage','eal.executive','eal.security']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['eal.manage','eal.executive','eal.security']));
DROP POLICY IF EXISTS eal_approvals_write_restrict_delete ON eal_approvals;
CREATE POLICY eal_approvals_write_restrict_delete ON eal_approvals AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['eal.manage','eal.executive','eal.security']));
-- ----------------------------------------------------------------------------
-- Enterprise Archive & Logging: eal_archive_batches  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS eal_archive_batches_write_restrict_insert ON eal_archive_batches;
CREATE POLICY eal_archive_batches_write_restrict_insert ON eal_archive_batches AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['eal.manage','eal.archive']));
DROP POLICY IF EXISTS eal_archive_batches_write_restrict_update ON eal_archive_batches;
CREATE POLICY eal_archive_batches_write_restrict_update ON eal_archive_batches AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['eal.manage','eal.archive']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['eal.manage','eal.archive']));
DROP POLICY IF EXISTS eal_archive_batches_write_restrict_delete ON eal_archive_batches;
CREATE POLICY eal_archive_batches_write_restrict_delete ON eal_archive_batches AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['eal.manage','eal.archive']));
-- ----------------------------------------------------------------------------
-- Enterprise Archive & Logging: eal_archive_retrievals  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS eal_archive_retrievals_write_restrict_insert ON eal_archive_retrievals;
CREATE POLICY eal_archive_retrievals_write_restrict_insert ON eal_archive_retrievals AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['eal.manage','eal.archive']));
DROP POLICY IF EXISTS eal_archive_retrievals_write_restrict_update ON eal_archive_retrievals;
CREATE POLICY eal_archive_retrievals_write_restrict_update ON eal_archive_retrievals AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['eal.manage','eal.archive']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['eal.manage','eal.archive']));
DROP POLICY IF EXISTS eal_archive_retrievals_write_restrict_delete ON eal_archive_retrievals;
CREATE POLICY eal_archive_retrievals_write_restrict_delete ON eal_archive_retrievals AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['eal.manage','eal.archive']));
-- ----------------------------------------------------------------------------
-- Enterprise Archive & Logging: eal_archived_events  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS eal_archived_events_write_restrict_insert ON eal_archived_events;
CREATE POLICY eal_archived_events_write_restrict_insert ON eal_archived_events AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['eal.manage','eal.archive']));
DROP POLICY IF EXISTS eal_archived_events_write_restrict_update ON eal_archived_events;
CREATE POLICY eal_archived_events_write_restrict_update ON eal_archived_events AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['eal.manage','eal.archive']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['eal.manage','eal.archive']));
DROP POLICY IF EXISTS eal_archived_events_write_restrict_delete ON eal_archived_events;
CREATE POLICY eal_archived_events_write_restrict_delete ON eal_archived_events AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['eal.manage','eal.archive']));
-- ----------------------------------------------------------------------------
-- Enterprise Archive & Logging: eal_audit_packages  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS eal_audit_packages_write_restrict_insert ON eal_audit_packages;
CREATE POLICY eal_audit_packages_write_restrict_insert ON eal_audit_packages AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['eal.manage','eal.security','eal.export']));
DROP POLICY IF EXISTS eal_audit_packages_write_restrict_update ON eal_audit_packages;
CREATE POLICY eal_audit_packages_write_restrict_update ON eal_audit_packages AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['eal.manage','eal.security','eal.export']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['eal.manage','eal.security','eal.export']));
DROP POLICY IF EXISTS eal_audit_packages_write_restrict_delete ON eal_audit_packages;
CREATE POLICY eal_audit_packages_write_restrict_delete ON eal_audit_packages AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['eal.manage','eal.security','eal.export']));
-- ----------------------------------------------------------------------------
-- Enterprise Archive & Logging: eal_config  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS eal_config_write_restrict_insert ON eal_config;
CREATE POLICY eal_config_write_restrict_insert ON eal_config AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['eal.manage','eal.config']));
DROP POLICY IF EXISTS eal_config_write_restrict_update ON eal_config;
CREATE POLICY eal_config_write_restrict_update ON eal_config AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['eal.manage','eal.config']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['eal.manage','eal.config']));
DROP POLICY IF EXISTS eal_config_write_restrict_delete ON eal_config;
CREATE POLICY eal_config_write_restrict_delete ON eal_config AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['eal.manage','eal.config']));
-- ----------------------------------------------------------------------------
-- Enterprise Archive & Logging: eal_config_history  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS eal_config_history_write_restrict_insert ON eal_config_history;
CREATE POLICY eal_config_history_write_restrict_insert ON eal_config_history AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['eal.manage','eal.config']));
DROP POLICY IF EXISTS eal_config_history_write_restrict_update ON eal_config_history;
CREATE POLICY eal_config_history_write_restrict_update ON eal_config_history AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['eal.manage','eal.config']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['eal.manage','eal.config']));
DROP POLICY IF EXISTS eal_config_history_write_restrict_delete ON eal_config_history;
CREATE POLICY eal_config_history_write_restrict_delete ON eal_config_history AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['eal.manage','eal.config']));
-- ----------------------------------------------------------------------------
-- Enterprise Archive & Logging: eal_controls  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS eal_controls_write_restrict_insert ON eal_controls;
CREATE POLICY eal_controls_write_restrict_insert ON eal_controls AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['eal.manage','eal.security','eal.compliance']));
DROP POLICY IF EXISTS eal_controls_write_restrict_update ON eal_controls;
CREATE POLICY eal_controls_write_restrict_update ON eal_controls AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['eal.manage','eal.security','eal.compliance']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['eal.manage','eal.security','eal.compliance']));
DROP POLICY IF EXISTS eal_controls_write_restrict_delete ON eal_controls;
CREATE POLICY eal_controls_write_restrict_delete ON eal_controls AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['eal.manage','eal.security','eal.compliance']));
-- ----------------------------------------------------------------------------
-- Enterprise Archive & Logging: eal_events  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS eal_events_write_restrict_insert ON eal_events;
CREATE POLICY eal_events_write_restrict_insert ON eal_events AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['eal.manage','eal.security','eal.infra']));
DROP POLICY IF EXISTS eal_events_write_restrict_update ON eal_events;
CREATE POLICY eal_events_write_restrict_update ON eal_events AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['eal.manage','eal.security','eal.infra']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['eal.manage','eal.security','eal.infra']));
DROP POLICY IF EXISTS eal_events_write_restrict_delete ON eal_events;
CREATE POLICY eal_events_write_restrict_delete ON eal_events AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['eal.manage','eal.security','eal.infra']));
-- ----------------------------------------------------------------------------
-- Enterprise Archive & Logging: eal_evidence  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS eal_evidence_write_restrict_insert ON eal_evidence;
CREATE POLICY eal_evidence_write_restrict_insert ON eal_evidence AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['eal.manage','eal.security','eal.investigate']));
DROP POLICY IF EXISTS eal_evidence_write_restrict_update ON eal_evidence;
CREATE POLICY eal_evidence_write_restrict_update ON eal_evidence AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['eal.manage','eal.security','eal.investigate']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['eal.manage','eal.security','eal.investigate']));
DROP POLICY IF EXISTS eal_evidence_write_restrict_delete ON eal_evidence;
CREATE POLICY eal_evidence_write_restrict_delete ON eal_evidence AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['eal.manage','eal.security','eal.investigate']));
-- ----------------------------------------------------------------------------
-- Enterprise Archive & Logging: eal_exports  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS eal_exports_write_restrict_insert ON eal_exports;
CREATE POLICY eal_exports_write_restrict_insert ON eal_exports AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['eal.manage','eal.export']));
DROP POLICY IF EXISTS eal_exports_write_restrict_update ON eal_exports;
CREATE POLICY eal_exports_write_restrict_update ON eal_exports AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['eal.manage','eal.export']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['eal.manage','eal.export']));
DROP POLICY IF EXISTS eal_exports_write_restrict_delete ON eal_exports;
CREATE POLICY eal_exports_write_restrict_delete ON eal_exports AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['eal.manage','eal.export']));
-- ----------------------------------------------------------------------------
-- Enterprise Archive & Logging: eal_file_audit  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS eal_file_audit_write_restrict_insert ON eal_file_audit;
CREATE POLICY eal_file_audit_write_restrict_insert ON eal_file_audit AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['eal.manage','eal.security']));
DROP POLICY IF EXISTS eal_file_audit_write_restrict_update ON eal_file_audit;
CREATE POLICY eal_file_audit_write_restrict_update ON eal_file_audit AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['eal.manage','eal.security']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['eal.manage','eal.security']));
DROP POLICY IF EXISTS eal_file_audit_write_restrict_delete ON eal_file_audit;
CREATE POLICY eal_file_audit_write_restrict_delete ON eal_file_audit AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['eal.manage','eal.security']));
-- ----------------------------------------------------------------------------
-- Enterprise Archive & Logging: eal_findings  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS eal_findings_write_restrict_insert ON eal_findings;
CREATE POLICY eal_findings_write_restrict_insert ON eal_findings AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['eal.manage','eal.investigate','eal.security']));
DROP POLICY IF EXISTS eal_findings_write_restrict_update ON eal_findings;
CREATE POLICY eal_findings_write_restrict_update ON eal_findings AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['eal.manage','eal.investigate','eal.security']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['eal.manage','eal.investigate','eal.security']));
DROP POLICY IF EXISTS eal_findings_write_restrict_delete ON eal_findings;
CREATE POLICY eal_findings_write_restrict_delete ON eal_findings AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['eal.manage','eal.investigate','eal.security']));
-- ----------------------------------------------------------------------------
-- Enterprise Archive & Logging: eal_frameworks  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS eal_frameworks_write_restrict_insert ON eal_frameworks;
CREATE POLICY eal_frameworks_write_restrict_insert ON eal_frameworks AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['eal.manage','eal.compliance']));
DROP POLICY IF EXISTS eal_frameworks_write_restrict_update ON eal_frameworks;
CREATE POLICY eal_frameworks_write_restrict_update ON eal_frameworks AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['eal.manage','eal.compliance']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['eal.manage','eal.compliance']));
DROP POLICY IF EXISTS eal_frameworks_write_restrict_delete ON eal_frameworks;
CREATE POLICY eal_frameworks_write_restrict_delete ON eal_frameworks AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['eal.manage','eal.compliance']));
-- ----------------------------------------------------------------------------
-- Enterprise Archive & Logging: eal_incidents  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS eal_incidents_write_restrict_insert ON eal_incidents;
CREATE POLICY eal_incidents_write_restrict_insert ON eal_incidents AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['eal.manage','eal.investigate','eal.security']));
DROP POLICY IF EXISTS eal_incidents_write_restrict_update ON eal_incidents;
CREATE POLICY eal_incidents_write_restrict_update ON eal_incidents AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['eal.manage','eal.investigate','eal.security']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['eal.manage','eal.investigate','eal.security']));
DROP POLICY IF EXISTS eal_incidents_write_restrict_delete ON eal_incidents;
CREATE POLICY eal_incidents_write_restrict_delete ON eal_incidents AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['eal.manage','eal.investigate','eal.security']));
-- ----------------------------------------------------------------------------
-- Enterprise Archive & Logging: eal_integrity_checkpoints  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS eal_integrity_checkpoints_write_restrict_insert ON eal_integrity_checkpoints;
CREATE POLICY eal_integrity_checkpoints_write_restrict_insert ON eal_integrity_checkpoints AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['eal.manage','eal.security','eal.infra']));
DROP POLICY IF EXISTS eal_integrity_checkpoints_write_restrict_update ON eal_integrity_checkpoints;
CREATE POLICY eal_integrity_checkpoints_write_restrict_update ON eal_integrity_checkpoints AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['eal.manage','eal.security','eal.infra']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['eal.manage','eal.security','eal.infra']));
DROP POLICY IF EXISTS eal_integrity_checkpoints_write_restrict_delete ON eal_integrity_checkpoints;
CREATE POLICY eal_integrity_checkpoints_write_restrict_delete ON eal_integrity_checkpoints AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['eal.manage','eal.security','eal.infra']));
-- ----------------------------------------------------------------------------
-- Enterprise Archive & Logging: eal_logging_policies  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS eal_logging_policies_write_restrict_insert ON eal_logging_policies;
CREATE POLICY eal_logging_policies_write_restrict_insert ON eal_logging_policies AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['eal.manage','eal.config','eal.security']));
DROP POLICY IF EXISTS eal_logging_policies_write_restrict_update ON eal_logging_policies;
CREATE POLICY eal_logging_policies_write_restrict_update ON eal_logging_policies AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['eal.manage','eal.config','eal.security']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['eal.manage','eal.config','eal.security']));
DROP POLICY IF EXISTS eal_logging_policies_write_restrict_delete ON eal_logging_policies;
CREATE POLICY eal_logging_policies_write_restrict_delete ON eal_logging_policies AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['eal.manage','eal.config','eal.security']));
-- ----------------------------------------------------------------------------
-- Enterprise Archive & Logging: eal_print_audit  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS eal_print_audit_write_restrict_insert ON eal_print_audit;
CREATE POLICY eal_print_audit_write_restrict_insert ON eal_print_audit AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['eal.manage','eal.security','print.manage']));
DROP POLICY IF EXISTS eal_print_audit_write_restrict_update ON eal_print_audit;
CREATE POLICY eal_print_audit_write_restrict_update ON eal_print_audit AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['eal.manage','eal.security','print.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['eal.manage','eal.security','print.manage']));
DROP POLICY IF EXISTS eal_print_audit_write_restrict_delete ON eal_print_audit;
CREATE POLICY eal_print_audit_write_restrict_delete ON eal_print_audit AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['eal.manage','eal.security','print.manage']));
-- ----------------------------------------------------------------------------
-- Enterprise Archive & Logging: eal_report_defs  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS eal_report_defs_write_restrict_insert ON eal_report_defs;
CREATE POLICY eal_report_defs_write_restrict_insert ON eal_report_defs AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['eal.manage','eal.executive','eal.export']));
DROP POLICY IF EXISTS eal_report_defs_write_restrict_update ON eal_report_defs;
CREATE POLICY eal_report_defs_write_restrict_update ON eal_report_defs AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['eal.manage','eal.executive','eal.export']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['eal.manage','eal.executive','eal.export']));
DROP POLICY IF EXISTS eal_report_defs_write_restrict_delete ON eal_report_defs;
CREATE POLICY eal_report_defs_write_restrict_delete ON eal_report_defs AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['eal.manage','eal.executive','eal.export']));
-- ----------------------------------------------------------------------------
-- Enterprise Archive & Logging: eal_report_runs  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS eal_report_runs_write_restrict_insert ON eal_report_runs;
CREATE POLICY eal_report_runs_write_restrict_insert ON eal_report_runs AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['eal.manage','eal.executive','eal.export']));
DROP POLICY IF EXISTS eal_report_runs_write_restrict_update ON eal_report_runs;
CREATE POLICY eal_report_runs_write_restrict_update ON eal_report_runs AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['eal.manage','eal.executive','eal.export']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['eal.manage','eal.executive','eal.export']));
DROP POLICY IF EXISTS eal_report_runs_write_restrict_delete ON eal_report_runs;
CREATE POLICY eal_report_runs_write_restrict_delete ON eal_report_runs AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['eal.manage','eal.executive','eal.export']));
-- ----------------------------------------------------------------------------
-- Enterprise Archive & Logging: eal_retention_policies  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS eal_retention_policies_write_restrict_insert ON eal_retention_policies;
CREATE POLICY eal_retention_policies_write_restrict_insert ON eal_retention_policies AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['eal.manage','eal.config','eal.compliance']));
DROP POLICY IF EXISTS eal_retention_policies_write_restrict_update ON eal_retention_policies;
CREATE POLICY eal_retention_policies_write_restrict_update ON eal_retention_policies AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['eal.manage','eal.config','eal.compliance']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['eal.manage','eal.config','eal.compliance']));
DROP POLICY IF EXISTS eal_retention_policies_write_restrict_delete ON eal_retention_policies;
CREATE POLICY eal_retention_policies_write_restrict_delete ON eal_retention_policies AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['eal.manage','eal.config','eal.compliance']));
-- ----------------------------------------------------------------------------
-- Enterprise Archive & Logging: eal_saved_filters  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS eal_saved_filters_write_restrict_insert ON eal_saved_filters;
CREATE POLICY eal_saved_filters_write_restrict_insert ON eal_saved_filters AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['eal.manage','eal.view']));
DROP POLICY IF EXISTS eal_saved_filters_write_restrict_update ON eal_saved_filters;
CREATE POLICY eal_saved_filters_write_restrict_update ON eal_saved_filters AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['eal.manage','eal.view']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['eal.manage','eal.view']));
DROP POLICY IF EXISTS eal_saved_filters_write_restrict_delete ON eal_saved_filters;
CREATE POLICY eal_saved_filters_write_restrict_delete ON eal_saved_filters AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['eal.manage','eal.view']));
-- ----------------------------------------------------------------------------
-- Enterprise Archive & Logging: eal_sessions  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS eal_sessions_write_restrict_insert ON eal_sessions;
CREATE POLICY eal_sessions_write_restrict_insert ON eal_sessions AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['eal.manage','eal.security']));
DROP POLICY IF EXISTS eal_sessions_write_restrict_update ON eal_sessions;
CREATE POLICY eal_sessions_write_restrict_update ON eal_sessions AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['eal.manage','eal.security']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['eal.manage','eal.security']));
DROP POLICY IF EXISTS eal_sessions_write_restrict_delete ON eal_sessions;
CREATE POLICY eal_sessions_write_restrict_delete ON eal_sessions AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['eal.manage','eal.security']));
-- ----------------------------------------------------------------------------
-- Enterprise Archive & Logging: eal_siem_connectors  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS eal_siem_connectors_write_restrict_insert ON eal_siem_connectors;
CREATE POLICY eal_siem_connectors_write_restrict_insert ON eal_siem_connectors AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['eal.manage','eal.security','eal.infra','intg.manage']));
DROP POLICY IF EXISTS eal_siem_connectors_write_restrict_update ON eal_siem_connectors;
CREATE POLICY eal_siem_connectors_write_restrict_update ON eal_siem_connectors AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['eal.manage','eal.security','eal.infra','intg.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['eal.manage','eal.security','eal.infra','intg.manage']));
DROP POLICY IF EXISTS eal_siem_connectors_write_restrict_delete ON eal_siem_connectors;
CREATE POLICY eal_siem_connectors_write_restrict_delete ON eal_siem_connectors AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['eal.manage','eal.security','eal.infra','intg.manage']));
-- ----------------------------------------------------------------------------
-- Enterprise Archive & Logging: eal_siem_outbox  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS eal_siem_outbox_write_restrict_insert ON eal_siem_outbox;
CREATE POLICY eal_siem_outbox_write_restrict_insert ON eal_siem_outbox AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['eal.manage','eal.security','eal.infra','jobs.manage']));
DROP POLICY IF EXISTS eal_siem_outbox_write_restrict_update ON eal_siem_outbox;
CREATE POLICY eal_siem_outbox_write_restrict_update ON eal_siem_outbox AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['eal.manage','eal.security','eal.infra','jobs.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['eal.manage','eal.security','eal.infra','jobs.manage']));
DROP POLICY IF EXISTS eal_siem_outbox_write_restrict_delete ON eal_siem_outbox;
CREATE POLICY eal_siem_outbox_write_restrict_delete ON eal_siem_outbox AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['eal.manage','eal.security','eal.infra','jobs.manage']));
-- ----------------------------------------------------------------------------
-- Enterprise Company: ec_ai_insights  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS ec_ai_insights_write_restrict_insert ON ec_ai_insights;
CREATE POLICY ec_ai_insights_write_restrict_insert ON ec_ai_insights AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['ec.manage','ec.ai','ec.view']));
DROP POLICY IF EXISTS ec_ai_insights_write_restrict_update ON ec_ai_insights;
CREATE POLICY ec_ai_insights_write_restrict_update ON ec_ai_insights AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['ec.manage','ec.ai','ec.view']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['ec.manage','ec.ai','ec.view']));
DROP POLICY IF EXISTS ec_ai_insights_write_restrict_delete ON ec_ai_insights;
CREATE POLICY ec_ai_insights_write_restrict_delete ON ec_ai_insights AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['ec.manage','ec.ai','ec.view']));
-- ----------------------------------------------------------------------------
-- Enterprise Company: ec_audit_log  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS ec_audit_log_write_restrict_insert ON ec_audit_log;
CREATE POLICY ec_audit_log_write_restrict_insert ON ec_audit_log AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['ec.manage','ec.admin']));
DROP POLICY IF EXISTS ec_audit_log_write_restrict_update ON ec_audit_log;
CREATE POLICY ec_audit_log_write_restrict_update ON ec_audit_log AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['ec.manage','ec.admin']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['ec.manage','ec.admin']));
DROP POLICY IF EXISTS ec_audit_log_write_restrict_delete ON ec_audit_log;
CREATE POLICY ec_audit_log_write_restrict_delete ON ec_audit_log AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['ec.manage','ec.admin']));
-- ----------------------------------------------------------------------------
-- Enterprise Company: ec_authorized_signatories  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS ec_authorized_signatories_write_restrict_insert ON ec_authorized_signatories;
CREATE POLICY ec_authorized_signatories_write_restrict_insert ON ec_authorized_signatories AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['ec.manage','ec.governance','finance.approve']));
DROP POLICY IF EXISTS ec_authorized_signatories_write_restrict_update ON ec_authorized_signatories;
CREATE POLICY ec_authorized_signatories_write_restrict_update ON ec_authorized_signatories AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['ec.manage','ec.governance','finance.approve']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['ec.manage','ec.governance','finance.approve']));
DROP POLICY IF EXISTS ec_authorized_signatories_write_restrict_delete ON ec_authorized_signatories;
CREATE POLICY ec_authorized_signatories_write_restrict_delete ON ec_authorized_signatories AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['ec.manage','ec.governance','finance.approve']));
-- ----------------------------------------------------------------------------
-- Enterprise Company: ec_board_members  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS ec_board_members_write_restrict_insert ON ec_board_members;
CREATE POLICY ec_board_members_write_restrict_insert ON ec_board_members AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['ec.manage','ec.governance']));
DROP POLICY IF EXISTS ec_board_members_write_restrict_update ON ec_board_members;
CREATE POLICY ec_board_members_write_restrict_update ON ec_board_members AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['ec.manage','ec.governance']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['ec.manage','ec.governance']));
DROP POLICY IF EXISTS ec_board_members_write_restrict_delete ON ec_board_members;
CREATE POLICY ec_board_members_write_restrict_delete ON ec_board_members AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['ec.manage','ec.governance']));
-- ----------------------------------------------------------------------------
-- Enterprise Company: ec_business_units  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS ec_business_units_write_restrict_insert ON ec_business_units;
CREATE POLICY ec_business_units_write_restrict_insert ON ec_business_units AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['ec.manage','ec.structure']));
DROP POLICY IF EXISTS ec_business_units_write_restrict_update ON ec_business_units;
CREATE POLICY ec_business_units_write_restrict_update ON ec_business_units AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['ec.manage','ec.structure']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['ec.manage','ec.structure']));
DROP POLICY IF EXISTS ec_business_units_write_restrict_delete ON ec_business_units;
CREATE POLICY ec_business_units_write_restrict_delete ON ec_business_units AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['ec.manage','ec.structure']));
-- ----------------------------------------------------------------------------
-- Enterprise Company: ec_calendar_events  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS ec_calendar_events_write_restrict_insert ON ec_calendar_events;
CREATE POLICY ec_calendar_events_write_restrict_insert ON ec_calendar_events AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['ec.manage','ec.governance']));
DROP POLICY IF EXISTS ec_calendar_events_write_restrict_update ON ec_calendar_events;
CREATE POLICY ec_calendar_events_write_restrict_update ON ec_calendar_events AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['ec.manage','ec.governance']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['ec.manage','ec.governance']));
DROP POLICY IF EXISTS ec_calendar_events_write_restrict_delete ON ec_calendar_events;
CREATE POLICY ec_calendar_events_write_restrict_delete ON ec_calendar_events AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['ec.manage','ec.governance']));
-- ----------------------------------------------------------------------------
-- Enterprise Company: ec_committees  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS ec_committees_write_restrict_insert ON ec_committees;
CREATE POLICY ec_committees_write_restrict_insert ON ec_committees AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['ec.manage','ec.governance']));
DROP POLICY IF EXISTS ec_committees_write_restrict_update ON ec_committees;
CREATE POLICY ec_committees_write_restrict_update ON ec_committees AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['ec.manage','ec.governance']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['ec.manage','ec.governance']));
DROP POLICY IF EXISTS ec_committees_write_restrict_delete ON ec_committees;
CREATE POLICY ec_committees_write_restrict_delete ON ec_committees AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['ec.manage','ec.governance']));
-- ----------------------------------------------------------------------------
-- Enterprise Company: ec_company_branding  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS ec_company_branding_write_restrict_insert ON ec_company_branding;
CREATE POLICY ec_company_branding_write_restrict_insert ON ec_company_branding AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['ec.manage','settings.branding']));
DROP POLICY IF EXISTS ec_company_branding_write_restrict_update ON ec_company_branding;
CREATE POLICY ec_company_branding_write_restrict_update ON ec_company_branding AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['ec.manage','settings.branding']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['ec.manage','settings.branding']));
DROP POLICY IF EXISTS ec_company_branding_write_restrict_delete ON ec_company_branding;
CREATE POLICY ec_company_branding_write_restrict_delete ON ec_company_branding AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['ec.manage','settings.branding']));
-- ----------------------------------------------------------------------------
-- Enterprise Company: ec_company_documents  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS ec_company_documents_write_restrict_insert ON ec_company_documents;
CREATE POLICY ec_company_documents_write_restrict_insert ON ec_company_documents AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['ec.manage','ec.documents']));
DROP POLICY IF EXISTS ec_company_documents_write_restrict_update ON ec_company_documents;
CREATE POLICY ec_company_documents_write_restrict_update ON ec_company_documents AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['ec.manage','ec.documents']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['ec.manage','ec.documents']));
DROP POLICY IF EXISTS ec_company_documents_write_restrict_delete ON ec_company_documents;
CREATE POLICY ec_company_documents_write_restrict_delete ON ec_company_documents AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['ec.manage','ec.documents']));
-- ----------------------------------------------------------------------------
-- Enterprise Company: ec_company_settings  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS ec_company_settings_write_restrict_insert ON ec_company_settings;
CREATE POLICY ec_company_settings_write_restrict_insert ON ec_company_settings AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['ec.manage','ec.admin','settings.manage']));
DROP POLICY IF EXISTS ec_company_settings_write_restrict_update ON ec_company_settings;
CREATE POLICY ec_company_settings_write_restrict_update ON ec_company_settings AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['ec.manage','ec.admin','settings.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['ec.manage','ec.admin','settings.manage']));
DROP POLICY IF EXISTS ec_company_settings_write_restrict_delete ON ec_company_settings;
CREATE POLICY ec_company_settings_write_restrict_delete ON ec_company_settings AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['ec.manage','ec.admin','settings.manage']));
-- ----------------------------------------------------------------------------
-- Enterprise Company: ec_cost_centers  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS ec_cost_centers_write_restrict_insert ON ec_cost_centers;
CREATE POLICY ec_cost_centers_write_restrict_insert ON ec_cost_centers AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['ec.manage','finance.costing']));
DROP POLICY IF EXISTS ec_cost_centers_write_restrict_update ON ec_cost_centers;
CREATE POLICY ec_cost_centers_write_restrict_update ON ec_cost_centers AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['ec.manage','finance.costing']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['ec.manage','finance.costing']));
DROP POLICY IF EXISTS ec_cost_centers_write_restrict_delete ON ec_cost_centers;
CREATE POLICY ec_cost_centers_write_restrict_delete ON ec_cost_centers AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['ec.manage','finance.costing']));
-- ----------------------------------------------------------------------------
-- Enterprise Company: ec_insurance_policies  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS ec_insurance_policies_write_restrict_insert ON ec_insurance_policies;
CREATE POLICY ec_insurance_policies_write_restrict_insert ON ec_insurance_policies AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['ec.manage','ec.risk']));
DROP POLICY IF EXISTS ec_insurance_policies_write_restrict_update ON ec_insurance_policies;
CREATE POLICY ec_insurance_policies_write_restrict_update ON ec_insurance_policies AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['ec.manage','ec.risk']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['ec.manage','ec.risk']));
DROP POLICY IF EXISTS ec_insurance_policies_write_restrict_delete ON ec_insurance_policies;
CREATE POLICY ec_insurance_policies_write_restrict_delete ON ec_insurance_policies AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['ec.manage','ec.risk']));
-- ----------------------------------------------------------------------------
-- Enterprise Company: ec_meetings  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS ec_meetings_write_restrict_insert ON ec_meetings;
CREATE POLICY ec_meetings_write_restrict_insert ON ec_meetings AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['ec.manage','ec.governance']));
DROP POLICY IF EXISTS ec_meetings_write_restrict_update ON ec_meetings;
CREATE POLICY ec_meetings_write_restrict_update ON ec_meetings AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['ec.manage','ec.governance']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['ec.manage','ec.governance']));
DROP POLICY IF EXISTS ec_meetings_write_restrict_delete ON ec_meetings;
CREATE POLICY ec_meetings_write_restrict_delete ON ec_meetings AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['ec.manage','ec.governance']));
-- ----------------------------------------------------------------------------
-- Enterprise Company: ec_org_nodes  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS ec_org_nodes_write_restrict_insert ON ec_org_nodes;
CREATE POLICY ec_org_nodes_write_restrict_insert ON ec_org_nodes AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['ec.manage','ec.structure']));
DROP POLICY IF EXISTS ec_org_nodes_write_restrict_update ON ec_org_nodes;
CREATE POLICY ec_org_nodes_write_restrict_update ON ec_org_nodes AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['ec.manage','ec.structure']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['ec.manage','ec.structure']));
DROP POLICY IF EXISTS ec_org_nodes_write_restrict_delete ON ec_org_nodes;
CREATE POLICY ec_org_nodes_write_restrict_delete ON ec_org_nodes AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['ec.manage','ec.structure']));
-- ----------------------------------------------------------------------------
-- Enterprise Company: ec_profit_centers  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS ec_profit_centers_write_restrict_insert ON ec_profit_centers;
CREATE POLICY ec_profit_centers_write_restrict_insert ON ec_profit_centers AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['ec.manage','finance.manage']));
DROP POLICY IF EXISTS ec_profit_centers_write_restrict_update ON ec_profit_centers;
CREATE POLICY ec_profit_centers_write_restrict_update ON ec_profit_centers AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['ec.manage','finance.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['ec.manage','finance.manage']));
DROP POLICY IF EXISTS ec_profit_centers_write_restrict_delete ON ec_profit_centers;
CREATE POLICY ec_profit_centers_write_restrict_delete ON ec_profit_centers AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['ec.manage','finance.manage']));
-- ----------------------------------------------------------------------------
-- Enterprise Company: ec_risk_register  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS ec_risk_register_write_restrict_insert ON ec_risk_register;
CREATE POLICY ec_risk_register_write_restrict_insert ON ec_risk_register AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['ec.manage','ec.risk']));
DROP POLICY IF EXISTS ec_risk_register_write_restrict_update ON ec_risk_register;
CREATE POLICY ec_risk_register_write_restrict_update ON ec_risk_register AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['ec.manage','ec.risk']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['ec.manage','ec.risk']));
DROP POLICY IF EXISTS ec_risk_register_write_restrict_delete ON ec_risk_register;
CREATE POLICY ec_risk_register_write_restrict_delete ON ec_risk_register AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['ec.manage','ec.risk']));
-- ----------------------------------------------------------------------------
-- Enterprise Company: ec_shareholders  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS ec_shareholders_write_restrict_insert ON ec_shareholders;
CREATE POLICY ec_shareholders_write_restrict_insert ON ec_shareholders AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['ec.manage','ec.governance']));
DROP POLICY IF EXISTS ec_shareholders_write_restrict_update ON ec_shareholders;
CREATE POLICY ec_shareholders_write_restrict_update ON ec_shareholders AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['ec.manage','ec.governance']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['ec.manage','ec.governance']));
DROP POLICY IF EXISTS ec_shareholders_write_restrict_delete ON ec_shareholders;
CREATE POLICY ec_shareholders_write_restrict_delete ON ec_shareholders AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['ec.manage','ec.governance']));
-- ----------------------------------------------------------------------------
-- Enterprise Import: enterprise_import_batches  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS enterprise_import_batches_write_restrict_insert ON enterprise_import_batches;
CREATE POLICY enterprise_import_batches_write_restrict_insert ON enterprise_import_batches AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['data.import','finance.manage','finance.admin','payroll.manage','payroll.admin']));
DROP POLICY IF EXISTS enterprise_import_batches_write_restrict_update ON enterprise_import_batches;
CREATE POLICY enterprise_import_batches_write_restrict_update ON enterprise_import_batches AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['data.import','finance.manage','finance.admin','payroll.manage','payroll.admin']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['data.import','finance.manage','finance.admin','payroll.manage','payroll.admin']));
DROP POLICY IF EXISTS enterprise_import_batches_write_restrict_delete ON enterprise_import_batches;
CREATE POLICY enterprise_import_batches_write_restrict_delete ON enterprise_import_batches AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['data.import','finance.manage','finance.admin','payroll.manage','payroll.admin']));
-- ----------------------------------------------------------------------------
-- Finance: fin_audit_log  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS fin_audit_log_write_restrict_insert ON fin_audit_log;
CREATE POLICY fin_audit_log_write_restrict_insert ON fin_audit_log AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage','finance.admin']));
DROP POLICY IF EXISTS fin_audit_log_write_restrict_update ON fin_audit_log;
CREATE POLICY fin_audit_log_write_restrict_update ON fin_audit_log AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage','finance.admin']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage','finance.admin']));
DROP POLICY IF EXISTS fin_audit_log_write_restrict_delete ON fin_audit_log;
CREATE POLICY fin_audit_log_write_restrict_delete ON fin_audit_log AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage','finance.admin']));
-- ----------------------------------------------------------------------------
-- Finance: fin_kpi_snapshots  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS fin_kpi_snapshots_write_restrict_insert ON fin_kpi_snapshots;
CREATE POLICY fin_kpi_snapshots_write_restrict_insert ON fin_kpi_snapshots AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage','finance.cfo']));
DROP POLICY IF EXISTS fin_kpi_snapshots_write_restrict_update ON fin_kpi_snapshots;
CREATE POLICY fin_kpi_snapshots_write_restrict_update ON fin_kpi_snapshots AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage','finance.cfo']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage','finance.cfo']));
DROP POLICY IF EXISTS fin_kpi_snapshots_write_restrict_delete ON fin_kpi_snapshots;
CREATE POLICY fin_kpi_snapshots_write_restrict_delete ON fin_kpi_snapshots AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage','finance.cfo']));
-- ----------------------------------------------------------------------------
-- Finance: fin_notifications  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS fin_notifications_write_restrict_insert ON fin_notifications;
CREATE POLICY fin_notifications_write_restrict_insert ON fin_notifications AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage','finance.admin']));
DROP POLICY IF EXISTS fin_notifications_write_restrict_update ON fin_notifications;
CREATE POLICY fin_notifications_write_restrict_update ON fin_notifications AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage','finance.admin']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage','finance.admin']));
DROP POLICY IF EXISTS fin_notifications_write_restrict_delete ON fin_notifications;
CREATE POLICY fin_notifications_write_restrict_delete ON fin_notifications AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage','finance.admin']));
-- ----------------------------------------------------------------------------
-- Finance: finance_insights  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS finance_insights_write_restrict_insert ON finance_insights;
CREATE POLICY finance_insights_write_restrict_insert ON finance_insights AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage','finance.ai','finance.view']));
DROP POLICY IF EXISTS finance_insights_write_restrict_update ON finance_insights;
CREATE POLICY finance_insights_write_restrict_update ON finance_insights AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage','finance.ai','finance.view']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage','finance.ai','finance.view']));
DROP POLICY IF EXISTS finance_insights_write_restrict_delete ON finance_insights;
CREATE POLICY finance_insights_write_restrict_delete ON finance_insights AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage','finance.ai','finance.view']));
-- ----------------------------------------------------------------------------
-- Fleet: fleet_accidents  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS fleet_accidents_write_restrict_insert ON fleet_accidents;
CREATE POLICY fleet_accidents_write_restrict_insert ON fleet_accidents AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['fleet.manage','fleet.admin','fleet.approve']));
DROP POLICY IF EXISTS fleet_accidents_write_restrict_update ON fleet_accidents;
CREATE POLICY fleet_accidents_write_restrict_update ON fleet_accidents AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['fleet.manage','fleet.admin','fleet.approve']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['fleet.manage','fleet.admin','fleet.approve']));
DROP POLICY IF EXISTS fleet_accidents_write_restrict_delete ON fleet_accidents;
CREATE POLICY fleet_accidents_write_restrict_delete ON fleet_accidents AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['fleet.manage','fleet.admin','fleet.approve']));
-- ----------------------------------------------------------------------------
-- Fleet: fleet_ai_insights  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS fleet_ai_insights_write_restrict_insert ON fleet_ai_insights;
CREATE POLICY fleet_ai_insights_write_restrict_insert ON fleet_ai_insights AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['fleet.manage','fleet.admin']));
DROP POLICY IF EXISTS fleet_ai_insights_write_restrict_update ON fleet_ai_insights;
CREATE POLICY fleet_ai_insights_write_restrict_update ON fleet_ai_insights AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['fleet.manage','fleet.admin']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['fleet.manage','fleet.admin']));
DROP POLICY IF EXISTS fleet_ai_insights_write_restrict_delete ON fleet_ai_insights;
CREATE POLICY fleet_ai_insights_write_restrict_delete ON fleet_ai_insights AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['fleet.manage','fleet.admin']));
-- ----------------------------------------------------------------------------
-- Fleet: fleet_approvals  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS fleet_approvals_write_restrict_insert ON fleet_approvals;
CREATE POLICY fleet_approvals_write_restrict_insert ON fleet_approvals AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['fleet.manage','fleet.admin','fleet.approve']));
DROP POLICY IF EXISTS fleet_approvals_write_restrict_update ON fleet_approvals;
CREATE POLICY fleet_approvals_write_restrict_update ON fleet_approvals AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['fleet.manage','fleet.admin','fleet.approve']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['fleet.manage','fleet.admin','fleet.approve']));
DROP POLICY IF EXISTS fleet_approvals_write_restrict_delete ON fleet_approvals;
CREATE POLICY fleet_approvals_write_restrict_delete ON fleet_approvals AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['fleet.manage','fleet.admin','fleet.approve']));
-- ----------------------------------------------------------------------------
-- Fleet: fleet_attachments  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS fleet_attachments_write_restrict_insert ON fleet_attachments;
CREATE POLICY fleet_attachments_write_restrict_insert ON fleet_attachments AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['fleet.manage','fleet.admin']));
DROP POLICY IF EXISTS fleet_attachments_write_restrict_update ON fleet_attachments;
CREATE POLICY fleet_attachments_write_restrict_update ON fleet_attachments AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['fleet.manage','fleet.admin']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['fleet.manage','fleet.admin']));
DROP POLICY IF EXISTS fleet_attachments_write_restrict_delete ON fleet_attachments;
CREATE POLICY fleet_attachments_write_restrict_delete ON fleet_attachments AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['fleet.manage','fleet.admin']));
-- ----------------------------------------------------------------------------
-- Fleet: fleet_audit_log  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS fleet_audit_log_write_restrict_insert ON fleet_audit_log;
CREATE POLICY fleet_audit_log_write_restrict_insert ON fleet_audit_log AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['fleet.manage','fleet.admin']));
DROP POLICY IF EXISTS fleet_audit_log_write_restrict_update ON fleet_audit_log;
CREATE POLICY fleet_audit_log_write_restrict_update ON fleet_audit_log AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['fleet.manage','fleet.admin']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['fleet.manage','fleet.admin']));
DROP POLICY IF EXISTS fleet_audit_log_write_restrict_delete ON fleet_audit_log;
CREATE POLICY fleet_audit_log_write_restrict_delete ON fleet_audit_log AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['fleet.manage','fleet.admin']));
-- ----------------------------------------------------------------------------
-- Fleet: fleet_batteries  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS fleet_batteries_write_restrict_insert ON fleet_batteries;
CREATE POLICY fleet_batteries_write_restrict_insert ON fleet_batteries AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['fleet.manage','fleet.admin','fleet.maintenance']));
DROP POLICY IF EXISTS fleet_batteries_write_restrict_update ON fleet_batteries;
CREATE POLICY fleet_batteries_write_restrict_update ON fleet_batteries AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['fleet.manage','fleet.admin','fleet.maintenance']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['fleet.manage','fleet.admin','fleet.maintenance']));
DROP POLICY IF EXISTS fleet_batteries_write_restrict_delete ON fleet_batteries;
CREATE POLICY fleet_batteries_write_restrict_delete ON fleet_batteries AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['fleet.manage','fleet.admin','fleet.maintenance']));
-- ----------------------------------------------------------------------------
-- Fleet: fleet_cargo  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS fleet_cargo_write_restrict_insert ON fleet_cargo;
CREATE POLICY fleet_cargo_write_restrict_insert ON fleet_cargo AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['fleet.manage','fleet.admin','fleet.dispatch']));
DROP POLICY IF EXISTS fleet_cargo_write_restrict_update ON fleet_cargo;
CREATE POLICY fleet_cargo_write_restrict_update ON fleet_cargo AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['fleet.manage','fleet.admin','fleet.dispatch']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['fleet.manage','fleet.admin','fleet.dispatch']));
DROP POLICY IF EXISTS fleet_cargo_write_restrict_delete ON fleet_cargo;
CREATE POLICY fleet_cargo_write_restrict_delete ON fleet_cargo AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['fleet.manage','fleet.admin','fleet.dispatch']));
-- ----------------------------------------------------------------------------
-- Fleet: fleet_claims  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS fleet_claims_write_restrict_insert ON fleet_claims;
CREATE POLICY fleet_claims_write_restrict_insert ON fleet_claims AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['fleet.manage','fleet.admin','fleet.approve']));
DROP POLICY IF EXISTS fleet_claims_write_restrict_update ON fleet_claims;
CREATE POLICY fleet_claims_write_restrict_update ON fleet_claims AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['fleet.manage','fleet.admin','fleet.approve']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['fleet.manage','fleet.admin','fleet.approve']));
DROP POLICY IF EXISTS fleet_claims_write_restrict_delete ON fleet_claims;
CREATE POLICY fleet_claims_write_restrict_delete ON fleet_claims AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['fleet.manage','fleet.admin','fleet.approve']));
-- ----------------------------------------------------------------------------
-- Fleet: fleet_comments  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS fleet_comments_write_restrict_insert ON fleet_comments;
CREATE POLICY fleet_comments_write_restrict_insert ON fleet_comments AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['fleet.manage','fleet.admin']));
DROP POLICY IF EXISTS fleet_comments_write_restrict_update ON fleet_comments;
CREATE POLICY fleet_comments_write_restrict_update ON fleet_comments AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['fleet.manage','fleet.admin']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['fleet.manage','fleet.admin']));
DROP POLICY IF EXISTS fleet_comments_write_restrict_delete ON fleet_comments;
CREATE POLICY fleet_comments_write_restrict_delete ON fleet_comments AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['fleet.manage','fleet.admin']));
-- ----------------------------------------------------------------------------
-- Fleet: fleet_containers  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS fleet_containers_write_restrict_insert ON fleet_containers;
CREATE POLICY fleet_containers_write_restrict_insert ON fleet_containers AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['fleet.manage','fleet.admin','fleet.dispatch']));
DROP POLICY IF EXISTS fleet_containers_write_restrict_update ON fleet_containers;
CREATE POLICY fleet_containers_write_restrict_update ON fleet_containers AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['fleet.manage','fleet.admin','fleet.dispatch']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['fleet.manage','fleet.admin','fleet.dispatch']));
DROP POLICY IF EXISTS fleet_containers_write_restrict_delete ON fleet_containers;
CREATE POLICY fleet_containers_write_restrict_delete ON fleet_containers AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['fleet.manage','fleet.admin','fleet.dispatch']));
-- ----------------------------------------------------------------------------
-- Fleet: fleet_costs  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS fleet_costs_write_restrict_insert ON fleet_costs;
CREATE POLICY fleet_costs_write_restrict_insert ON fleet_costs AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['fleet.manage','fleet.admin','fleet.fuel']));
DROP POLICY IF EXISTS fleet_costs_write_restrict_update ON fleet_costs;
CREATE POLICY fleet_costs_write_restrict_update ON fleet_costs AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['fleet.manage','fleet.admin','fleet.fuel']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['fleet.manage','fleet.admin','fleet.fuel']));
DROP POLICY IF EXISTS fleet_costs_write_restrict_delete ON fleet_costs;
CREATE POLICY fleet_costs_write_restrict_delete ON fleet_costs AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['fleet.manage','fleet.admin','fleet.fuel']));
-- ----------------------------------------------------------------------------
-- Fleet: fleet_deliveries  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS fleet_deliveries_write_restrict_insert ON fleet_deliveries;
CREATE POLICY fleet_deliveries_write_restrict_insert ON fleet_deliveries AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['fleet.manage','fleet.admin','fleet.dispatch']));
DROP POLICY IF EXISTS fleet_deliveries_write_restrict_update ON fleet_deliveries;
CREATE POLICY fleet_deliveries_write_restrict_update ON fleet_deliveries AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['fleet.manage','fleet.admin','fleet.dispatch']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['fleet.manage','fleet.admin','fleet.dispatch']));
DROP POLICY IF EXISTS fleet_deliveries_write_restrict_delete ON fleet_deliveries;
CREATE POLICY fleet_deliveries_write_restrict_delete ON fleet_deliveries AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['fleet.manage','fleet.admin','fleet.dispatch']));
-- ----------------------------------------------------------------------------
-- Fleet: fleet_dispatch_orders  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS fleet_dispatch_orders_write_restrict_insert ON fleet_dispatch_orders;
CREATE POLICY fleet_dispatch_orders_write_restrict_insert ON fleet_dispatch_orders AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['fleet.manage','fleet.admin','fleet.dispatch']));
DROP POLICY IF EXISTS fleet_dispatch_orders_write_restrict_update ON fleet_dispatch_orders;
CREATE POLICY fleet_dispatch_orders_write_restrict_update ON fleet_dispatch_orders AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['fleet.manage','fleet.admin','fleet.dispatch']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['fleet.manage','fleet.admin','fleet.dispatch']));
DROP POLICY IF EXISTS fleet_dispatch_orders_write_restrict_delete ON fleet_dispatch_orders;
CREATE POLICY fleet_dispatch_orders_write_restrict_delete ON fleet_dispatch_orders AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['fleet.manage','fleet.admin','fleet.dispatch']));
-- ----------------------------------------------------------------------------
-- Fleet: fleet_driver_attendance  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS fleet_driver_attendance_write_restrict_insert ON fleet_driver_attendance;
CREATE POLICY fleet_driver_attendance_write_restrict_insert ON fleet_driver_attendance AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['fleet.manage','fleet.admin','fleet.drivers']));
DROP POLICY IF EXISTS fleet_driver_attendance_write_restrict_update ON fleet_driver_attendance;
CREATE POLICY fleet_driver_attendance_write_restrict_update ON fleet_driver_attendance AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['fleet.manage','fleet.admin','fleet.drivers']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['fleet.manage','fleet.admin','fleet.drivers']));
DROP POLICY IF EXISTS fleet_driver_attendance_write_restrict_delete ON fleet_driver_attendance;
CREATE POLICY fleet_driver_attendance_write_restrict_delete ON fleet_driver_attendance AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['fleet.manage','fleet.admin','fleet.drivers']));
-- ----------------------------------------------------------------------------
-- Fleet: fleet_driver_certifications  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS fleet_driver_certifications_write_restrict_insert ON fleet_driver_certifications;
CREATE POLICY fleet_driver_certifications_write_restrict_insert ON fleet_driver_certifications AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['fleet.manage','fleet.admin','fleet.drivers']));
DROP POLICY IF EXISTS fleet_driver_certifications_write_restrict_update ON fleet_driver_certifications;
CREATE POLICY fleet_driver_certifications_write_restrict_update ON fleet_driver_certifications AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['fleet.manage','fleet.admin','fleet.drivers']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['fleet.manage','fleet.admin','fleet.drivers']));
DROP POLICY IF EXISTS fleet_driver_certifications_write_restrict_delete ON fleet_driver_certifications;
CREATE POLICY fleet_driver_certifications_write_restrict_delete ON fleet_driver_certifications AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['fleet.manage','fleet.admin','fleet.drivers']));
-- ----------------------------------------------------------------------------
-- Fleet: fleet_driver_licenses  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS fleet_driver_licenses_write_restrict_insert ON fleet_driver_licenses;
CREATE POLICY fleet_driver_licenses_write_restrict_insert ON fleet_driver_licenses AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['fleet.manage','fleet.admin','fleet.drivers']));
DROP POLICY IF EXISTS fleet_driver_licenses_write_restrict_update ON fleet_driver_licenses;
CREATE POLICY fleet_driver_licenses_write_restrict_update ON fleet_driver_licenses AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['fleet.manage','fleet.admin','fleet.drivers']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['fleet.manage','fleet.admin','fleet.drivers']));
DROP POLICY IF EXISTS fleet_driver_licenses_write_restrict_delete ON fleet_driver_licenses;
CREATE POLICY fleet_driver_licenses_write_restrict_delete ON fleet_driver_licenses AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['fleet.manage','fleet.admin','fleet.drivers']));
-- ----------------------------------------------------------------------------
-- Fleet: fleet_driver_medicals  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS fleet_driver_medicals_write_restrict_insert ON fleet_driver_medicals;
CREATE POLICY fleet_driver_medicals_write_restrict_insert ON fleet_driver_medicals AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['fleet.manage','fleet.admin','fleet.drivers']));
DROP POLICY IF EXISTS fleet_driver_medicals_write_restrict_update ON fleet_driver_medicals;
CREATE POLICY fleet_driver_medicals_write_restrict_update ON fleet_driver_medicals AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['fleet.manage','fleet.admin','fleet.drivers']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['fleet.manage','fleet.admin','fleet.drivers']));
DROP POLICY IF EXISTS fleet_driver_medicals_write_restrict_delete ON fleet_driver_medicals;
CREATE POLICY fleet_driver_medicals_write_restrict_delete ON fleet_driver_medicals AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['fleet.manage','fleet.admin','fleet.drivers']));
-- ----------------------------------------------------------------------------
-- Fleet: fleet_driver_performance  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS fleet_driver_performance_write_restrict_insert ON fleet_driver_performance;
CREATE POLICY fleet_driver_performance_write_restrict_insert ON fleet_driver_performance AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['fleet.manage','fleet.admin','fleet.drivers']));
DROP POLICY IF EXISTS fleet_driver_performance_write_restrict_update ON fleet_driver_performance;
CREATE POLICY fleet_driver_performance_write_restrict_update ON fleet_driver_performance AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['fleet.manage','fleet.admin','fleet.drivers']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['fleet.manage','fleet.admin','fleet.drivers']));
DROP POLICY IF EXISTS fleet_driver_performance_write_restrict_delete ON fleet_driver_performance;
CREATE POLICY fleet_driver_performance_write_restrict_delete ON fleet_driver_performance AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['fleet.manage','fleet.admin','fleet.drivers']));
-- ----------------------------------------------------------------------------
-- Fleet: fleet_driver_training  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS fleet_driver_training_write_restrict_insert ON fleet_driver_training;
CREATE POLICY fleet_driver_training_write_restrict_insert ON fleet_driver_training AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['fleet.manage','fleet.admin','fleet.drivers']));
DROP POLICY IF EXISTS fleet_driver_training_write_restrict_update ON fleet_driver_training;
CREATE POLICY fleet_driver_training_write_restrict_update ON fleet_driver_training AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['fleet.manage','fleet.admin','fleet.drivers']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['fleet.manage','fleet.admin','fleet.drivers']));
DROP POLICY IF EXISTS fleet_driver_training_write_restrict_delete ON fleet_driver_training;
CREATE POLICY fleet_driver_training_write_restrict_delete ON fleet_driver_training AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['fleet.manage','fleet.admin','fleet.drivers']));
-- ----------------------------------------------------------------------------
-- Fleet: fleet_driver_violations  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS fleet_driver_violations_write_restrict_insert ON fleet_driver_violations;
CREATE POLICY fleet_driver_violations_write_restrict_insert ON fleet_driver_violations AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['fleet.manage','fleet.admin','fleet.drivers']));
DROP POLICY IF EXISTS fleet_driver_violations_write_restrict_update ON fleet_driver_violations;
CREATE POLICY fleet_driver_violations_write_restrict_update ON fleet_driver_violations AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['fleet.manage','fleet.admin','fleet.drivers']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['fleet.manage','fleet.admin','fleet.drivers']));
DROP POLICY IF EXISTS fleet_driver_violations_write_restrict_delete ON fleet_driver_violations;
CREATE POLICY fleet_driver_violations_write_restrict_delete ON fleet_driver_violations AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['fleet.manage','fleet.admin','fleet.drivers']));
-- ----------------------------------------------------------------------------
-- Fleet: fleet_fuel_cards  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS fleet_fuel_cards_write_restrict_insert ON fleet_fuel_cards;
CREATE POLICY fleet_fuel_cards_write_restrict_insert ON fleet_fuel_cards AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['fleet.manage','fleet.admin','fleet.fuel']));
DROP POLICY IF EXISTS fleet_fuel_cards_write_restrict_update ON fleet_fuel_cards;
CREATE POLICY fleet_fuel_cards_write_restrict_update ON fleet_fuel_cards AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['fleet.manage','fleet.admin','fleet.fuel']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['fleet.manage','fleet.admin','fleet.fuel']));
DROP POLICY IF EXISTS fleet_fuel_cards_write_restrict_delete ON fleet_fuel_cards;
CREATE POLICY fleet_fuel_cards_write_restrict_delete ON fleet_fuel_cards AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['fleet.manage','fleet.admin','fleet.fuel']));
-- ----------------------------------------------------------------------------
-- Fleet: fleet_fuel_stations  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS fleet_fuel_stations_write_restrict_insert ON fleet_fuel_stations;
CREATE POLICY fleet_fuel_stations_write_restrict_insert ON fleet_fuel_stations AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['fleet.manage','fleet.admin','fleet.fuel']));
DROP POLICY IF EXISTS fleet_fuel_stations_write_restrict_update ON fleet_fuel_stations;
CREATE POLICY fleet_fuel_stations_write_restrict_update ON fleet_fuel_stations AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['fleet.manage','fleet.admin','fleet.fuel']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['fleet.manage','fleet.admin','fleet.fuel']));
DROP POLICY IF EXISTS fleet_fuel_stations_write_restrict_delete ON fleet_fuel_stations;
CREATE POLICY fleet_fuel_stations_write_restrict_delete ON fleet_fuel_stations AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['fleet.manage','fleet.admin','fleet.fuel']));
-- ----------------------------------------------------------------------------
-- Fleet: fleet_fuel_transactions  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS fleet_fuel_transactions_write_restrict_insert ON fleet_fuel_transactions;
CREATE POLICY fleet_fuel_transactions_write_restrict_insert ON fleet_fuel_transactions AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['fleet.manage','fleet.admin','fleet.fuel']));
DROP POLICY IF EXISTS fleet_fuel_transactions_write_restrict_update ON fleet_fuel_transactions;
CREATE POLICY fleet_fuel_transactions_write_restrict_update ON fleet_fuel_transactions AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['fleet.manage','fleet.admin','fleet.fuel']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['fleet.manage','fleet.admin','fleet.fuel']));
DROP POLICY IF EXISTS fleet_fuel_transactions_write_restrict_delete ON fleet_fuel_transactions;
CREATE POLICY fleet_fuel_transactions_write_restrict_delete ON fleet_fuel_transactions AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['fleet.manage','fleet.admin','fleet.fuel']));
-- ----------------------------------------------------------------------------
-- Fleet: fleet_geofences  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS fleet_geofences_write_restrict_insert ON fleet_geofences;
CREATE POLICY fleet_geofences_write_restrict_insert ON fleet_geofences AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['fleet.manage','fleet.admin','fleet.track']));
DROP POLICY IF EXISTS fleet_geofences_write_restrict_update ON fleet_geofences;
CREATE POLICY fleet_geofences_write_restrict_update ON fleet_geofences AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['fleet.manage','fleet.admin','fleet.track']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['fleet.manage','fleet.admin','fleet.track']));
DROP POLICY IF EXISTS fleet_geofences_write_restrict_delete ON fleet_geofences;
CREATE POLICY fleet_geofences_write_restrict_delete ON fleet_geofences AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['fleet.manage','fleet.admin','fleet.track']));
-- ----------------------------------------------------------------------------
-- Fleet: fleet_gps_devices  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS fleet_gps_devices_write_restrict_insert ON fleet_gps_devices;
CREATE POLICY fleet_gps_devices_write_restrict_insert ON fleet_gps_devices AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['fleet.manage','fleet.admin','fleet.track']));
DROP POLICY IF EXISTS fleet_gps_devices_write_restrict_update ON fleet_gps_devices;
CREATE POLICY fleet_gps_devices_write_restrict_update ON fleet_gps_devices AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['fleet.manage','fleet.admin','fleet.track']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['fleet.manage','fleet.admin','fleet.track']));
DROP POLICY IF EXISTS fleet_gps_devices_write_restrict_delete ON fleet_gps_devices;
CREATE POLICY fleet_gps_devices_write_restrict_delete ON fleet_gps_devices AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['fleet.manage','fleet.admin','fleet.track']));
-- ----------------------------------------------------------------------------
-- Fleet: fleet_gps_locations  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS fleet_gps_locations_write_restrict_insert ON fleet_gps_locations;
CREATE POLICY fleet_gps_locations_write_restrict_insert ON fleet_gps_locations AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['fleet.manage','fleet.admin','fleet.track']));
DROP POLICY IF EXISTS fleet_gps_locations_write_restrict_update ON fleet_gps_locations;
CREATE POLICY fleet_gps_locations_write_restrict_update ON fleet_gps_locations AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['fleet.manage','fleet.admin','fleet.track']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['fleet.manage','fleet.admin','fleet.track']));
DROP POLICY IF EXISTS fleet_gps_locations_write_restrict_delete ON fleet_gps_locations;
CREATE POLICY fleet_gps_locations_write_restrict_delete ON fleet_gps_locations AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['fleet.manage','fleet.admin','fleet.track']));
-- ----------------------------------------------------------------------------
-- Fleet: fleet_iot_devices  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS fleet_iot_devices_write_restrict_insert ON fleet_iot_devices;
CREATE POLICY fleet_iot_devices_write_restrict_insert ON fleet_iot_devices AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['fleet.manage','fleet.admin','fleet.track']));
DROP POLICY IF EXISTS fleet_iot_devices_write_restrict_update ON fleet_iot_devices;
CREATE POLICY fleet_iot_devices_write_restrict_update ON fleet_iot_devices AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['fleet.manage','fleet.admin','fleet.track']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['fleet.manage','fleet.admin','fleet.track']));
DROP POLICY IF EXISTS fleet_iot_devices_write_restrict_delete ON fleet_iot_devices;
CREATE POLICY fleet_iot_devices_write_restrict_delete ON fleet_iot_devices AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['fleet.manage','fleet.admin','fleet.track']));
-- ----------------------------------------------------------------------------
-- Fleet: fleet_maintenance_plans  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS fleet_maintenance_plans_write_restrict_insert ON fleet_maintenance_plans;
CREATE POLICY fleet_maintenance_plans_write_restrict_insert ON fleet_maintenance_plans AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['fleet.manage','fleet.admin','fleet.maintenance']));
DROP POLICY IF EXISTS fleet_maintenance_plans_write_restrict_update ON fleet_maintenance_plans;
CREATE POLICY fleet_maintenance_plans_write_restrict_update ON fleet_maintenance_plans AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['fleet.manage','fleet.admin','fleet.maintenance']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['fleet.manage','fleet.admin','fleet.maintenance']));
DROP POLICY IF EXISTS fleet_maintenance_plans_write_restrict_delete ON fleet_maintenance_plans;
CREATE POLICY fleet_maintenance_plans_write_restrict_delete ON fleet_maintenance_plans AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['fleet.manage','fleet.admin','fleet.maintenance']));
-- ----------------------------------------------------------------------------
-- Fleet: fleet_mechanics  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS fleet_mechanics_write_restrict_insert ON fleet_mechanics;
CREATE POLICY fleet_mechanics_write_restrict_insert ON fleet_mechanics AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['fleet.manage','fleet.admin','fleet.maintenance']));
DROP POLICY IF EXISTS fleet_mechanics_write_restrict_update ON fleet_mechanics;
CREATE POLICY fleet_mechanics_write_restrict_update ON fleet_mechanics AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['fleet.manage','fleet.admin','fleet.maintenance']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['fleet.manage','fleet.admin','fleet.maintenance']));
DROP POLICY IF EXISTS fleet_mechanics_write_restrict_delete ON fleet_mechanics;
CREATE POLICY fleet_mechanics_write_restrict_delete ON fleet_mechanics AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['fleet.manage','fleet.admin','fleet.maintenance']));
-- ----------------------------------------------------------------------------
-- Fleet: fleet_notifications  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS fleet_notifications_write_restrict_insert ON fleet_notifications;
CREATE POLICY fleet_notifications_write_restrict_insert ON fleet_notifications AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['fleet.manage','fleet.admin']));
DROP POLICY IF EXISTS fleet_notifications_write_restrict_update ON fleet_notifications;
CREATE POLICY fleet_notifications_write_restrict_update ON fleet_notifications AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['fleet.manage','fleet.admin']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['fleet.manage','fleet.admin']));
DROP POLICY IF EXISTS fleet_notifications_write_restrict_delete ON fleet_notifications;
CREATE POLICY fleet_notifications_write_restrict_delete ON fleet_notifications AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['fleet.manage','fleet.admin']));
-- ----------------------------------------------------------------------------
-- Fleet: fleet_odometer_logs  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS fleet_odometer_logs_write_restrict_insert ON fleet_odometer_logs;
CREATE POLICY fleet_odometer_logs_write_restrict_insert ON fleet_odometer_logs AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['fleet.manage','fleet.admin','fleet.track']));
DROP POLICY IF EXISTS fleet_odometer_logs_write_restrict_update ON fleet_odometer_logs;
CREATE POLICY fleet_odometer_logs_write_restrict_update ON fleet_odometer_logs AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['fleet.manage','fleet.admin','fleet.track']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['fleet.manage','fleet.admin','fleet.track']));
DROP POLICY IF EXISTS fleet_odometer_logs_write_restrict_delete ON fleet_odometer_logs;
CREATE POLICY fleet_odometer_logs_write_restrict_delete ON fleet_odometer_logs AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['fleet.manage','fleet.admin','fleet.track']));
-- ----------------------------------------------------------------------------
-- Fleet: fleet_proof_of_delivery  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS fleet_proof_of_delivery_write_restrict_insert ON fleet_proof_of_delivery;
CREATE POLICY fleet_proof_of_delivery_write_restrict_insert ON fleet_proof_of_delivery AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['fleet.manage','fleet.admin','fleet.dispatch']));
DROP POLICY IF EXISTS fleet_proof_of_delivery_write_restrict_update ON fleet_proof_of_delivery;
CREATE POLICY fleet_proof_of_delivery_write_restrict_update ON fleet_proof_of_delivery AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['fleet.manage','fleet.admin','fleet.dispatch']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['fleet.manage','fleet.admin','fleet.dispatch']));
DROP POLICY IF EXISTS fleet_proof_of_delivery_write_restrict_delete ON fleet_proof_of_delivery;
CREATE POLICY fleet_proof_of_delivery_write_restrict_delete ON fleet_proof_of_delivery AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['fleet.manage','fleet.admin','fleet.dispatch']));
-- ----------------------------------------------------------------------------
-- Fleet: fleet_road_licenses  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS fleet_road_licenses_write_restrict_insert ON fleet_road_licenses;
CREATE POLICY fleet_road_licenses_write_restrict_insert ON fleet_road_licenses AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['fleet.manage','fleet.admin','fleet.drivers']));
DROP POLICY IF EXISTS fleet_road_licenses_write_restrict_update ON fleet_road_licenses;
CREATE POLICY fleet_road_licenses_write_restrict_update ON fleet_road_licenses AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['fleet.manage','fleet.admin','fleet.drivers']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['fleet.manage','fleet.admin','fleet.drivers']));
DROP POLICY IF EXISTS fleet_road_licenses_write_restrict_delete ON fleet_road_licenses;
CREATE POLICY fleet_road_licenses_write_restrict_delete ON fleet_road_licenses AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['fleet.manage','fleet.admin','fleet.drivers']));
-- ----------------------------------------------------------------------------
-- Fleet: fleet_spare_parts  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS fleet_spare_parts_write_restrict_insert ON fleet_spare_parts;
CREATE POLICY fleet_spare_parts_write_restrict_insert ON fleet_spare_parts AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['fleet.manage','fleet.admin','fleet.maintenance']));
DROP POLICY IF EXISTS fleet_spare_parts_write_restrict_update ON fleet_spare_parts;
CREATE POLICY fleet_spare_parts_write_restrict_update ON fleet_spare_parts AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['fleet.manage','fleet.admin','fleet.maintenance']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['fleet.manage','fleet.admin','fleet.maintenance']));
DROP POLICY IF EXISTS fleet_spare_parts_write_restrict_delete ON fleet_spare_parts;
CREATE POLICY fleet_spare_parts_write_restrict_delete ON fleet_spare_parts AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['fleet.manage','fleet.admin','fleet.maintenance']));
-- ----------------------------------------------------------------------------
-- Fleet: fleet_telematics  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS fleet_telematics_write_restrict_insert ON fleet_telematics;
CREATE POLICY fleet_telematics_write_restrict_insert ON fleet_telematics AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['fleet.manage','fleet.admin','fleet.track']));
DROP POLICY IF EXISTS fleet_telematics_write_restrict_update ON fleet_telematics;
CREATE POLICY fleet_telematics_write_restrict_update ON fleet_telematics AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['fleet.manage','fleet.admin','fleet.track']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['fleet.manage','fleet.admin','fleet.track']));
DROP POLICY IF EXISTS fleet_telematics_write_restrict_delete ON fleet_telematics;
CREATE POLICY fleet_telematics_write_restrict_delete ON fleet_telematics AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['fleet.manage','fleet.admin','fleet.track']));
-- ----------------------------------------------------------------------------
-- Fleet: fleet_trip_requests  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS fleet_trip_requests_write_restrict_insert ON fleet_trip_requests;
CREATE POLICY fleet_trip_requests_write_restrict_insert ON fleet_trip_requests AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['fleet.manage','fleet.admin','fleet.dispatch','fleet.approve']));
DROP POLICY IF EXISTS fleet_trip_requests_write_restrict_update ON fleet_trip_requests;
CREATE POLICY fleet_trip_requests_write_restrict_update ON fleet_trip_requests AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['fleet.manage','fleet.admin','fleet.dispatch','fleet.approve']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['fleet.manage','fleet.admin','fleet.dispatch','fleet.approve']));
DROP POLICY IF EXISTS fleet_trip_requests_write_restrict_delete ON fleet_trip_requests;
CREATE POLICY fleet_trip_requests_write_restrict_delete ON fleet_trip_requests AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['fleet.manage','fleet.admin','fleet.dispatch','fleet.approve']));
-- ----------------------------------------------------------------------------
-- Fleet: fleet_trip_routes  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS fleet_trip_routes_write_restrict_insert ON fleet_trip_routes;
CREATE POLICY fleet_trip_routes_write_restrict_insert ON fleet_trip_routes AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['fleet.manage','fleet.admin','fleet.dispatch']));
DROP POLICY IF EXISTS fleet_trip_routes_write_restrict_update ON fleet_trip_routes;
CREATE POLICY fleet_trip_routes_write_restrict_update ON fleet_trip_routes AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['fleet.manage','fleet.admin','fleet.dispatch']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['fleet.manage','fleet.admin','fleet.dispatch']));
DROP POLICY IF EXISTS fleet_trip_routes_write_restrict_delete ON fleet_trip_routes;
CREATE POLICY fleet_trip_routes_write_restrict_delete ON fleet_trip_routes AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['fleet.manage','fleet.admin','fleet.dispatch']));
-- ----------------------------------------------------------------------------
-- Fleet: fleet_tyres  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS fleet_tyres_write_restrict_insert ON fleet_tyres;
CREATE POLICY fleet_tyres_write_restrict_insert ON fleet_tyres AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['fleet.manage','fleet.admin','fleet.maintenance']));
DROP POLICY IF EXISTS fleet_tyres_write_restrict_update ON fleet_tyres;
CREATE POLICY fleet_tyres_write_restrict_update ON fleet_tyres AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['fleet.manage','fleet.admin','fleet.maintenance']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['fleet.manage','fleet.admin','fleet.maintenance']));
DROP POLICY IF EXISTS fleet_tyres_write_restrict_delete ON fleet_tyres;
CREATE POLICY fleet_tyres_write_restrict_delete ON fleet_tyres AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['fleet.manage','fleet.admin','fleet.maintenance']));
-- ----------------------------------------------------------------------------
-- Fleet: fleet_vehicle_brands  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS fleet_vehicle_brands_write_restrict_insert ON fleet_vehicle_brands;
CREATE POLICY fleet_vehicle_brands_write_restrict_insert ON fleet_vehicle_brands AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['fleet.manage','fleet.admin']));
DROP POLICY IF EXISTS fleet_vehicle_brands_write_restrict_update ON fleet_vehicle_brands;
CREATE POLICY fleet_vehicle_brands_write_restrict_update ON fleet_vehicle_brands AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['fleet.manage','fleet.admin']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['fleet.manage','fleet.admin']));
DROP POLICY IF EXISTS fleet_vehicle_brands_write_restrict_delete ON fleet_vehicle_brands;
CREATE POLICY fleet_vehicle_brands_write_restrict_delete ON fleet_vehicle_brands AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['fleet.manage','fleet.admin']));
-- ----------------------------------------------------------------------------
-- Fleet: fleet_vehicle_categories  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS fleet_vehicle_categories_write_restrict_insert ON fleet_vehicle_categories;
CREATE POLICY fleet_vehicle_categories_write_restrict_insert ON fleet_vehicle_categories AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['fleet.manage','fleet.admin']));
DROP POLICY IF EXISTS fleet_vehicle_categories_write_restrict_update ON fleet_vehicle_categories;
CREATE POLICY fleet_vehicle_categories_write_restrict_update ON fleet_vehicle_categories AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['fleet.manage','fleet.admin']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['fleet.manage','fleet.admin']));
DROP POLICY IF EXISTS fleet_vehicle_categories_write_restrict_delete ON fleet_vehicle_categories;
CREATE POLICY fleet_vehicle_categories_write_restrict_delete ON fleet_vehicle_categories AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['fleet.manage','fleet.admin']));
-- ----------------------------------------------------------------------------
-- Fleet: fleet_vehicle_documents  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS fleet_vehicle_documents_write_restrict_insert ON fleet_vehicle_documents;
CREATE POLICY fleet_vehicle_documents_write_restrict_insert ON fleet_vehicle_documents AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['fleet.manage','fleet.admin']));
DROP POLICY IF EXISTS fleet_vehicle_documents_write_restrict_update ON fleet_vehicle_documents;
CREATE POLICY fleet_vehicle_documents_write_restrict_update ON fleet_vehicle_documents AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['fleet.manage','fleet.admin']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['fleet.manage','fleet.admin']));
DROP POLICY IF EXISTS fleet_vehicle_documents_write_restrict_delete ON fleet_vehicle_documents;
CREATE POLICY fleet_vehicle_documents_write_restrict_delete ON fleet_vehicle_documents AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['fleet.manage','fleet.admin']));
-- ----------------------------------------------------------------------------
-- Fleet: fleet_vehicle_models  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS fleet_vehicle_models_write_restrict_insert ON fleet_vehicle_models;
CREATE POLICY fleet_vehicle_models_write_restrict_insert ON fleet_vehicle_models AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['fleet.manage','fleet.admin']));
DROP POLICY IF EXISTS fleet_vehicle_models_write_restrict_update ON fleet_vehicle_models;
CREATE POLICY fleet_vehicle_models_write_restrict_update ON fleet_vehicle_models AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['fleet.manage','fleet.admin']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['fleet.manage','fleet.admin']));
DROP POLICY IF EXISTS fleet_vehicle_models_write_restrict_delete ON fleet_vehicle_models;
CREATE POLICY fleet_vehicle_models_write_restrict_delete ON fleet_vehicle_models AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['fleet.manage','fleet.admin']));
-- ----------------------------------------------------------------------------
-- Fleet: fleet_vehicle_photos  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS fleet_vehicle_photos_write_restrict_insert ON fleet_vehicle_photos;
CREATE POLICY fleet_vehicle_photos_write_restrict_insert ON fleet_vehicle_photos AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['fleet.manage','fleet.admin']));
DROP POLICY IF EXISTS fleet_vehicle_photos_write_restrict_update ON fleet_vehicle_photos;
CREATE POLICY fleet_vehicle_photos_write_restrict_update ON fleet_vehicle_photos AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['fleet.manage','fleet.admin']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['fleet.manage','fleet.admin']));
DROP POLICY IF EXISTS fleet_vehicle_photos_write_restrict_delete ON fleet_vehicle_photos;
CREATE POLICY fleet_vehicle_photos_write_restrict_delete ON fleet_vehicle_photos AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['fleet.manage','fleet.admin']));
-- ----------------------------------------------------------------------------
-- Fleet: fleet_vehicle_types  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS fleet_vehicle_types_write_restrict_insert ON fleet_vehicle_types;
CREATE POLICY fleet_vehicle_types_write_restrict_insert ON fleet_vehicle_types AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['fleet.manage','fleet.admin']));
DROP POLICY IF EXISTS fleet_vehicle_types_write_restrict_update ON fleet_vehicle_types;
CREATE POLICY fleet_vehicle_types_write_restrict_update ON fleet_vehicle_types AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['fleet.manage','fleet.admin']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['fleet.manage','fleet.admin']));
DROP POLICY IF EXISTS fleet_vehicle_types_write_restrict_delete ON fleet_vehicle_types;
CREATE POLICY fleet_vehicle_types_write_restrict_delete ON fleet_vehicle_types AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['fleet.manage','fleet.admin']));
-- ----------------------------------------------------------------------------
-- Fleet: fleet_workshops  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS fleet_workshops_write_restrict_insert ON fleet_workshops;
CREATE POLICY fleet_workshops_write_restrict_insert ON fleet_workshops AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['fleet.manage','fleet.admin','fleet.maintenance']));
DROP POLICY IF EXISTS fleet_workshops_write_restrict_update ON fleet_workshops;
CREATE POLICY fleet_workshops_write_restrict_update ON fleet_workshops AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['fleet.manage','fleet.admin','fleet.maintenance']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['fleet.manage','fleet.admin','fleet.maintenance']));
DROP POLICY IF EXISTS fleet_workshops_write_restrict_delete ON fleet_workshops;
CREATE POLICY fleet_workshops_write_restrict_delete ON fleet_workshops AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['fleet.manage','fleet.admin','fleet.maintenance']));
-- ----------------------------------------------------------------------------
-- HR Communications: hc_ai_insights  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS hc_ai_insights_write_restrict_insert ON hc_ai_insights;
CREATE POLICY hc_ai_insights_write_restrict_insert ON hc_ai_insights AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['hc.manage','hc.ai','hc.view']));
DROP POLICY IF EXISTS hc_ai_insights_write_restrict_update ON hc_ai_insights;
CREATE POLICY hc_ai_insights_write_restrict_update ON hc_ai_insights AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['hc.manage','hc.ai','hc.view']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['hc.manage','hc.ai','hc.view']));
DROP POLICY IF EXISTS hc_ai_insights_write_restrict_delete ON hc_ai_insights;
CREATE POLICY hc_ai_insights_write_restrict_delete ON hc_ai_insights AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['hc.manage','hc.ai','hc.view']));
-- ----------------------------------------------------------------------------
-- HR Communications: hc_announcement_acks  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS hc_announcement_acks_write_restrict_insert ON hc_announcement_acks;
CREATE POLICY hc_announcement_acks_write_restrict_insert ON hc_announcement_acks AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['hc.manage','hc.announce']));
DROP POLICY IF EXISTS hc_announcement_acks_write_restrict_update ON hc_announcement_acks;
CREATE POLICY hc_announcement_acks_write_restrict_update ON hc_announcement_acks AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['hc.manage','hc.announce']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['hc.manage','hc.announce']));
DROP POLICY IF EXISTS hc_announcement_acks_write_restrict_delete ON hc_announcement_acks;
CREATE POLICY hc_announcement_acks_write_restrict_delete ON hc_announcement_acks AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['hc.manage','hc.announce']));
-- ----------------------------------------------------------------------------
-- HR Communications: hc_announcements  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS hc_announcements_write_restrict_insert ON hc_announcements;
CREATE POLICY hc_announcements_write_restrict_insert ON hc_announcements AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['hc.manage','hc.admin','hc.announce']));
DROP POLICY IF EXISTS hc_announcements_write_restrict_update ON hc_announcements;
CREATE POLICY hc_announcements_write_restrict_update ON hc_announcements AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['hc.manage','hc.admin','hc.announce']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['hc.manage','hc.admin','hc.announce']));
DROP POLICY IF EXISTS hc_announcements_write_restrict_delete ON hc_announcements;
CREATE POLICY hc_announcements_write_restrict_delete ON hc_announcements AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['hc.manage','hc.admin','hc.announce']));
-- ----------------------------------------------------------------------------
-- HR Communications: hc_audit_log  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS hc_audit_log_write_restrict_insert ON hc_audit_log;
CREATE POLICY hc_audit_log_write_restrict_insert ON hc_audit_log AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['hc.manage','hc.admin']));
DROP POLICY IF EXISTS hc_audit_log_write_restrict_update ON hc_audit_log;
CREATE POLICY hc_audit_log_write_restrict_update ON hc_audit_log AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['hc.manage','hc.admin']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['hc.manage','hc.admin']));
DROP POLICY IF EXISTS hc_audit_log_write_restrict_delete ON hc_audit_log;
CREATE POLICY hc_audit_log_write_restrict_delete ON hc_audit_log AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['hc.manage','hc.admin']));
-- ----------------------------------------------------------------------------
-- HR Communications: hc_bots  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS hc_bots_write_restrict_insert ON hc_bots;
CREATE POLICY hc_bots_write_restrict_insert ON hc_bots AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['hc.manage','hc.view']));
DROP POLICY IF EXISTS hc_bots_write_restrict_update ON hc_bots;
CREATE POLICY hc_bots_write_restrict_update ON hc_bots AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['hc.manage','hc.view']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['hc.manage','hc.view']));
DROP POLICY IF EXISTS hc_bots_write_restrict_delete ON hc_bots;
CREATE POLICY hc_bots_write_restrict_delete ON hc_bots AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['hc.manage','hc.view']));
-- ----------------------------------------------------------------------------
-- HR Communications: hc_channel_members  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS hc_channel_members_write_restrict_insert ON hc_channel_members;
CREATE POLICY hc_channel_members_write_restrict_insert ON hc_channel_members AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['hc.manage','hc.view']));
DROP POLICY IF EXISTS hc_channel_members_write_restrict_update ON hc_channel_members;
CREATE POLICY hc_channel_members_write_restrict_update ON hc_channel_members AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['hc.manage','hc.view']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['hc.manage','hc.view']));
DROP POLICY IF EXISTS hc_channel_members_write_restrict_delete ON hc_channel_members;
CREATE POLICY hc_channel_members_write_restrict_delete ON hc_channel_members AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['hc.manage','hc.view']));
-- ----------------------------------------------------------------------------
-- HR Communications: hc_channels  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS hc_channels_write_restrict_insert ON hc_channels;
CREATE POLICY hc_channels_write_restrict_insert ON hc_channels AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['hc.manage','hc.view']));
DROP POLICY IF EXISTS hc_channels_write_restrict_update ON hc_channels;
CREATE POLICY hc_channels_write_restrict_update ON hc_channels AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['hc.manage','hc.view']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['hc.manage','hc.view']));
DROP POLICY IF EXISTS hc_channels_write_restrict_delete ON hc_channels;
CREATE POLICY hc_channels_write_restrict_delete ON hc_channels AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['hc.manage','hc.view']));
-- ----------------------------------------------------------------------------
-- HR Communications: hc_chat_tasks  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS hc_chat_tasks_write_restrict_insert ON hc_chat_tasks;
CREATE POLICY hc_chat_tasks_write_restrict_insert ON hc_chat_tasks AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['hc.manage','hc.view']));
DROP POLICY IF EXISTS hc_chat_tasks_write_restrict_update ON hc_chat_tasks;
CREATE POLICY hc_chat_tasks_write_restrict_update ON hc_chat_tasks AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['hc.manage','hc.view']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['hc.manage','hc.view']));
DROP POLICY IF EXISTS hc_chat_tasks_write_restrict_delete ON hc_chat_tasks;
CREATE POLICY hc_chat_tasks_write_restrict_delete ON hc_chat_tasks AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['hc.manage','hc.view']));
-- ----------------------------------------------------------------------------
-- HR Communications: hc_favorites  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS hc_favorites_write_restrict_insert ON hc_favorites;
CREATE POLICY hc_favorites_write_restrict_insert ON hc_favorites AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['hc.manage','hc.view']));
DROP POLICY IF EXISTS hc_favorites_write_restrict_update ON hc_favorites;
CREATE POLICY hc_favorites_write_restrict_update ON hc_favorites AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['hc.manage','hc.view']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['hc.manage','hc.view']));
DROP POLICY IF EXISTS hc_favorites_write_restrict_delete ON hc_favorites;
CREATE POLICY hc_favorites_write_restrict_delete ON hc_favorites AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['hc.manage','hc.view']));
-- ----------------------------------------------------------------------------
-- HR Communications: hc_files  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS hc_files_write_restrict_insert ON hc_files;
CREATE POLICY hc_files_write_restrict_insert ON hc_files AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['hc.manage','hc.view']));
DROP POLICY IF EXISTS hc_files_write_restrict_update ON hc_files;
CREATE POLICY hc_files_write_restrict_update ON hc_files AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['hc.manage','hc.view']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['hc.manage','hc.view']));
DROP POLICY IF EXISTS hc_files_write_restrict_delete ON hc_files;
CREATE POLICY hc_files_write_restrict_delete ON hc_files AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['hc.manage','hc.view']));
-- ----------------------------------------------------------------------------
-- HR Communications: hc_knowledge  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS hc_knowledge_write_restrict_insert ON hc_knowledge;
CREATE POLICY hc_knowledge_write_restrict_insert ON hc_knowledge AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['hc.manage','hc.view']));
DROP POLICY IF EXISTS hc_knowledge_write_restrict_update ON hc_knowledge;
CREATE POLICY hc_knowledge_write_restrict_update ON hc_knowledge AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['hc.manage','hc.view']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['hc.manage','hc.view']));
DROP POLICY IF EXISTS hc_knowledge_write_restrict_delete ON hc_knowledge;
CREATE POLICY hc_knowledge_write_restrict_delete ON hc_knowledge AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['hc.manage','hc.view']));
-- ----------------------------------------------------------------------------
-- HR Communications: hc_meeting_participants  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS hc_meeting_participants_write_restrict_insert ON hc_meeting_participants;
CREATE POLICY hc_meeting_participants_write_restrict_insert ON hc_meeting_participants AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['hc.manage','hc.meetings']));
DROP POLICY IF EXISTS hc_meeting_participants_write_restrict_update ON hc_meeting_participants;
CREATE POLICY hc_meeting_participants_write_restrict_update ON hc_meeting_participants AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['hc.manage','hc.meetings']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['hc.manage','hc.meetings']));
DROP POLICY IF EXISTS hc_meeting_participants_write_restrict_delete ON hc_meeting_participants;
CREATE POLICY hc_meeting_participants_write_restrict_delete ON hc_meeting_participants AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['hc.manage','hc.meetings']));
-- ----------------------------------------------------------------------------
-- HR Communications: hc_meetings  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS hc_meetings_write_restrict_insert ON hc_meetings;
CREATE POLICY hc_meetings_write_restrict_insert ON hc_meetings AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['hc.manage','hc.meetings']));
DROP POLICY IF EXISTS hc_meetings_write_restrict_update ON hc_meetings;
CREATE POLICY hc_meetings_write_restrict_update ON hc_meetings AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['hc.manage','hc.meetings']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['hc.manage','hc.meetings']));
DROP POLICY IF EXISTS hc_meetings_write_restrict_delete ON hc_meetings;
CREATE POLICY hc_meetings_write_restrict_delete ON hc_meetings AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['hc.manage','hc.meetings']));
-- ----------------------------------------------------------------------------
-- HR Communications: hc_messages  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS hc_messages_write_restrict_insert ON hc_messages;
CREATE POLICY hc_messages_write_restrict_insert ON hc_messages AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['hc.manage','hc.view']));
DROP POLICY IF EXISTS hc_messages_write_restrict_update ON hc_messages;
CREATE POLICY hc_messages_write_restrict_update ON hc_messages AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['hc.manage','hc.view']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['hc.manage','hc.view']));
DROP POLICY IF EXISTS hc_messages_write_restrict_delete ON hc_messages;
CREATE POLICY hc_messages_write_restrict_delete ON hc_messages AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['hc.manage','hc.view']));
-- ----------------------------------------------------------------------------
-- HR Communications: hc_reactions  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS hc_reactions_write_restrict_insert ON hc_reactions;
CREATE POLICY hc_reactions_write_restrict_insert ON hc_reactions AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['hc.manage','hc.view']));
DROP POLICY IF EXISTS hc_reactions_write_restrict_update ON hc_reactions;
CREATE POLICY hc_reactions_write_restrict_update ON hc_reactions AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['hc.manage','hc.view']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['hc.manage','hc.view']));
DROP POLICY IF EXISTS hc_reactions_write_restrict_delete ON hc_reactions;
CREATE POLICY hc_reactions_write_restrict_delete ON hc_reactions AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['hc.manage','hc.view']));
-- ----------------------------------------------------------------------------
-- HR Communications: hc_read_receipts  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS hc_read_receipts_write_restrict_insert ON hc_read_receipts;
CREATE POLICY hc_read_receipts_write_restrict_insert ON hc_read_receipts AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['hc.manage','hc.view']));
DROP POLICY IF EXISTS hc_read_receipts_write_restrict_update ON hc_read_receipts;
CREATE POLICY hc_read_receipts_write_restrict_update ON hc_read_receipts AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['hc.manage','hc.view']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['hc.manage','hc.view']));
DROP POLICY IF EXISTS hc_read_receipts_write_restrict_delete ON hc_read_receipts;
CREATE POLICY hc_read_receipts_write_restrict_delete ON hc_read_receipts AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['hc.manage','hc.view']));
-- ----------------------------------------------------------------------------
-- HR Communications: hc_user_settings  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS hc_user_settings_write_restrict_insert ON hc_user_settings;
CREATE POLICY hc_user_settings_write_restrict_insert ON hc_user_settings AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['hc.manage','hc.view']));
DROP POLICY IF EXISTS hc_user_settings_write_restrict_update ON hc_user_settings;
CREATE POLICY hc_user_settings_write_restrict_update ON hc_user_settings AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['hc.manage','hc.view']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['hc.manage','hc.view']));
DROP POLICY IF EXISTS hc_user_settings_write_restrict_delete ON hc_user_settings;
CREATE POLICY hc_user_settings_write_restrict_delete ON hc_user_settings AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['hc.manage','hc.view']));
-- ----------------------------------------------------------------------------
-- HR Communications: hc_workspaces  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS hc_workspaces_write_restrict_insert ON hc_workspaces;
CREATE POLICY hc_workspaces_write_restrict_insert ON hc_workspaces AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['hc.manage','hc.admin']));
DROP POLICY IF EXISTS hc_workspaces_write_restrict_update ON hc_workspaces;
CREATE POLICY hc_workspaces_write_restrict_update ON hc_workspaces AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['hc.manage','hc.admin']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['hc.manage','hc.admin']));
DROP POLICY IF EXISTS hc_workspaces_write_restrict_delete ON hc_workspaces;
CREATE POLICY hc_workspaces_write_restrict_delete ON hc_workspaces AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['hc.manage','hc.admin']));
-- ----------------------------------------------------------------------------
-- HR: hr_insights  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS hr_insights_write_restrict_insert ON hr_insights;
CREATE POLICY hr_insights_write_restrict_insert ON hr_insights AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['hr.manage','hr.view','hr.self','hr.performance','hr.recruit','hr.training']));
DROP POLICY IF EXISTS hr_insights_write_restrict_update ON hr_insights;
CREATE POLICY hr_insights_write_restrict_update ON hr_insights AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['hr.manage','hr.view','hr.self','hr.performance','hr.recruit','hr.training']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['hr.manage','hr.view','hr.self','hr.performance','hr.recruit','hr.training']));
DROP POLICY IF EXISTS hr_insights_write_restrict_delete ON hr_insights;
CREATE POLICY hr_insights_write_restrict_delete ON hr_insights AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['hr.manage','hr.view','hr.self','hr.performance','hr.recruit','hr.training']));
-- ----------------------------------------------------------------------------
-- Identity Management: idm_abac_rules  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS idm_abac_rules_write_restrict_insert ON idm_abac_rules;
CREATE POLICY idm_abac_rules_write_restrict_insert ON idm_abac_rules AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['iam.manage','iam.abac']));
DROP POLICY IF EXISTS idm_abac_rules_write_restrict_update ON idm_abac_rules;
CREATE POLICY idm_abac_rules_write_restrict_update ON idm_abac_rules AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['iam.manage','iam.abac']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['iam.manage','iam.abac']));
DROP POLICY IF EXISTS idm_abac_rules_write_restrict_delete ON idm_abac_rules;
CREATE POLICY idm_abac_rules_write_restrict_delete ON idm_abac_rules AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['iam.manage','iam.abac']));
-- ----------------------------------------------------------------------------
-- Identity Management: idm_access_requests  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS idm_access_requests_write_restrict_insert ON idm_access_requests;
CREATE POLICY idm_access_requests_write_restrict_insert ON idm_access_requests AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['iam.manage','iam.approvals']));
DROP POLICY IF EXISTS idm_access_requests_write_restrict_update ON idm_access_requests;
CREATE POLICY idm_access_requests_write_restrict_update ON idm_access_requests AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['iam.manage','iam.approvals']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['iam.manage','iam.approvals']));
DROP POLICY IF EXISTS idm_access_requests_write_restrict_delete ON idm_access_requests;
CREATE POLICY idm_access_requests_write_restrict_delete ON idm_access_requests AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['iam.manage','iam.approvals']));
-- ----------------------------------------------------------------------------
-- Identity Management: idm_access_review_items  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS idm_access_review_items_write_restrict_insert ON idm_access_review_items;
CREATE POLICY idm_access_review_items_write_restrict_insert ON idm_access_review_items AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['iam.manage','iam.governance']));
DROP POLICY IF EXISTS idm_access_review_items_write_restrict_update ON idm_access_review_items;
CREATE POLICY idm_access_review_items_write_restrict_update ON idm_access_review_items AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['iam.manage','iam.governance']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['iam.manage','iam.governance']));
DROP POLICY IF EXISTS idm_access_review_items_write_restrict_delete ON idm_access_review_items;
CREATE POLICY idm_access_review_items_write_restrict_delete ON idm_access_review_items AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['iam.manage','iam.governance']));
-- ----------------------------------------------------------------------------
-- Identity Management: idm_access_reviews  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS idm_access_reviews_write_restrict_insert ON idm_access_reviews;
CREATE POLICY idm_access_reviews_write_restrict_insert ON idm_access_reviews AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['iam.manage','iam.governance']));
DROP POLICY IF EXISTS idm_access_reviews_write_restrict_update ON idm_access_reviews;
CREATE POLICY idm_access_reviews_write_restrict_update ON idm_access_reviews AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['iam.manage','iam.governance']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['iam.manage','iam.governance']));
DROP POLICY IF EXISTS idm_access_reviews_write_restrict_delete ON idm_access_reviews;
CREATE POLICY idm_access_reviews_write_restrict_delete ON idm_access_reviews AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['iam.manage','iam.governance']));
-- ----------------------------------------------------------------------------
-- Identity Management: idm_api_accounts  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS idm_api_accounts_write_restrict_insert ON idm_api_accounts;
CREATE POLICY idm_api_accounts_write_restrict_insert ON idm_api_accounts AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['iam.manage','iam.provision']));
DROP POLICY IF EXISTS idm_api_accounts_write_restrict_update ON idm_api_accounts;
CREATE POLICY idm_api_accounts_write_restrict_update ON idm_api_accounts AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['iam.manage','iam.provision']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['iam.manage','iam.provision']));
DROP POLICY IF EXISTS idm_api_accounts_write_restrict_delete ON idm_api_accounts;
CREATE POLICY idm_api_accounts_write_restrict_delete ON idm_api_accounts AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['iam.manage','iam.provision']));
-- ----------------------------------------------------------------------------
-- Identity Management: idm_api_keys  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS idm_api_keys_write_restrict_insert ON idm_api_keys;
CREATE POLICY idm_api_keys_write_restrict_insert ON idm_api_keys AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['iam.manage','iam.provision']));
DROP POLICY IF EXISTS idm_api_keys_write_restrict_update ON idm_api_keys;
CREATE POLICY idm_api_keys_write_restrict_update ON idm_api_keys AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['iam.manage','iam.provision']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['iam.manage','iam.provision']));
DROP POLICY IF EXISTS idm_api_keys_write_restrict_delete ON idm_api_keys;
CREATE POLICY idm_api_keys_write_restrict_delete ON idm_api_keys AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['iam.manage','iam.provision']));
-- ----------------------------------------------------------------------------
-- Identity Management: idm_audit  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS idm_audit_write_restrict_insert ON idm_audit;
CREATE POLICY idm_audit_write_restrict_insert ON idm_audit AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['iam.manage','audit.manage']));
DROP POLICY IF EXISTS idm_audit_write_restrict_update ON idm_audit;
CREATE POLICY idm_audit_write_restrict_update ON idm_audit AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['iam.manage','audit.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['iam.manage','audit.manage']));
DROP POLICY IF EXISTS idm_audit_write_restrict_delete ON idm_audit;
CREATE POLICY idm_audit_write_restrict_delete ON idm_audit AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['iam.manage','audit.manage']));
-- ----------------------------------------------------------------------------
-- Identity Management: idm_devices  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS idm_devices_write_restrict_insert ON idm_devices;
CREATE POLICY idm_devices_write_restrict_insert ON idm_devices AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['iam.manage','iam.security']));
DROP POLICY IF EXISTS idm_devices_write_restrict_update ON idm_devices;
CREATE POLICY idm_devices_write_restrict_update ON idm_devices AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['iam.manage','iam.security']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['iam.manage','iam.security']));
DROP POLICY IF EXISTS idm_devices_write_restrict_delete ON idm_devices;
CREATE POLICY idm_devices_write_restrict_delete ON idm_devices AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['iam.manage','iam.security']));
-- ----------------------------------------------------------------------------
-- Identity Management: idm_import_batches  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS idm_import_batches_write_restrict_insert ON idm_import_batches;
CREATE POLICY idm_import_batches_write_restrict_insert ON idm_import_batches AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['iam.manage','iam.import']));
DROP POLICY IF EXISTS idm_import_batches_write_restrict_update ON idm_import_batches;
CREATE POLICY idm_import_batches_write_restrict_update ON idm_import_batches AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['iam.manage','iam.import']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['iam.manage','iam.import']));
DROP POLICY IF EXISTS idm_import_batches_write_restrict_delete ON idm_import_batches;
CREATE POLICY idm_import_batches_write_restrict_delete ON idm_import_batches AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['iam.manage','iam.import']));
-- ----------------------------------------------------------------------------
-- Identity Management: idm_mfa_policies  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS idm_mfa_policies_write_restrict_insert ON idm_mfa_policies;
CREATE POLICY idm_mfa_policies_write_restrict_insert ON idm_mfa_policies AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['iam.manage','iam.mfa']));
DROP POLICY IF EXISTS idm_mfa_policies_write_restrict_update ON idm_mfa_policies;
CREATE POLICY idm_mfa_policies_write_restrict_update ON idm_mfa_policies AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['iam.manage','iam.mfa']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['iam.manage','iam.mfa']));
DROP POLICY IF EXISTS idm_mfa_policies_write_restrict_delete ON idm_mfa_policies;
CREATE POLICY idm_mfa_policies_write_restrict_delete ON idm_mfa_policies AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['iam.manage','iam.mfa']));
-- ----------------------------------------------------------------------------
-- Identity Management: idm_offboarding  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS idm_offboarding_write_restrict_insert ON idm_offboarding;
CREATE POLICY idm_offboarding_write_restrict_insert ON idm_offboarding AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['iam.manage','iam.provision']));
DROP POLICY IF EXISTS idm_offboarding_write_restrict_update ON idm_offboarding;
CREATE POLICY idm_offboarding_write_restrict_update ON idm_offboarding AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['iam.manage','iam.provision']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['iam.manage','iam.provision']));
DROP POLICY IF EXISTS idm_offboarding_write_restrict_delete ON idm_offboarding;
CREATE POLICY idm_offboarding_write_restrict_delete ON idm_offboarding AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['iam.manage','iam.provision']));
-- ----------------------------------------------------------------------------
-- Identity Management: idm_password_history  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS idm_password_history_write_restrict_insert ON idm_password_history;
CREATE POLICY idm_password_history_write_restrict_insert ON idm_password_history AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['iam.manage','iam.password']));
DROP POLICY IF EXISTS idm_password_history_write_restrict_update ON idm_password_history;
CREATE POLICY idm_password_history_write_restrict_update ON idm_password_history AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['iam.manage','iam.password']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['iam.manage','iam.password']));
DROP POLICY IF EXISTS idm_password_history_write_restrict_delete ON idm_password_history;
CREATE POLICY idm_password_history_write_restrict_delete ON idm_password_history AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['iam.manage','iam.password']));
-- ----------------------------------------------------------------------------
-- Identity Management: idm_password_resets  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS idm_password_resets_write_restrict_insert ON idm_password_resets;
CREATE POLICY idm_password_resets_write_restrict_insert ON idm_password_resets AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['iam.manage','iam.password']));
DROP POLICY IF EXISTS idm_password_resets_write_restrict_update ON idm_password_resets;
CREATE POLICY idm_password_resets_write_restrict_update ON idm_password_resets AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['iam.manage','iam.password']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['iam.manage','iam.password']));
DROP POLICY IF EXISTS idm_password_resets_write_restrict_delete ON idm_password_resets;
CREATE POLICY idm_password_resets_write_restrict_delete ON idm_password_resets AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['iam.manage','iam.password']));
-- ----------------------------------------------------------------------------
-- Identity Management: idm_provision_requests  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS idm_provision_requests_write_restrict_insert ON idm_provision_requests;
CREATE POLICY idm_provision_requests_write_restrict_insert ON idm_provision_requests AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['iam.manage','iam.provision','iam.approvals']));
DROP POLICY IF EXISTS idm_provision_requests_write_restrict_update ON idm_provision_requests;
CREATE POLICY idm_provision_requests_write_restrict_update ON idm_provision_requests AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['iam.manage','iam.provision','iam.approvals']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['iam.manage','iam.provision','iam.approvals']));
DROP POLICY IF EXISTS idm_provision_requests_write_restrict_delete ON idm_provision_requests;
CREATE POLICY idm_provision_requests_write_restrict_delete ON idm_provision_requests AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['iam.manage','iam.provision','iam.approvals']));
-- ----------------------------------------------------------------------------
-- Identity Management: idm_sso_links  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS idm_sso_links_write_restrict_insert ON idm_sso_links;
CREATE POLICY idm_sso_links_write_restrict_insert ON idm_sso_links AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['iam.manage','iam.security']));
DROP POLICY IF EXISTS idm_sso_links_write_restrict_update ON idm_sso_links;
CREATE POLICY idm_sso_links_write_restrict_update ON idm_sso_links AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['iam.manage','iam.security']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['iam.manage','iam.security']));
DROP POLICY IF EXISTS idm_sso_links_write_restrict_delete ON idm_sso_links;
CREATE POLICY idm_sso_links_write_restrict_delete ON idm_sso_links AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['iam.manage','iam.security']));
-- ----------------------------------------------------------------------------
-- Identity Management: idm_sso_providers  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS idm_sso_providers_write_restrict_insert ON idm_sso_providers;
CREATE POLICY idm_sso_providers_write_restrict_insert ON idm_sso_providers AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['iam.manage','iam.security']));
DROP POLICY IF EXISTS idm_sso_providers_write_restrict_update ON idm_sso_providers;
CREATE POLICY idm_sso_providers_write_restrict_update ON idm_sso_providers AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['iam.manage','iam.security']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['iam.manage','iam.security']));
DROP POLICY IF EXISTS idm_sso_providers_write_restrict_delete ON idm_sso_providers;
CREATE POLICY idm_sso_providers_write_restrict_delete ON idm_sso_providers AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['iam.manage','iam.security']));
-- ----------------------------------------------------------------------------
-- Identity Management: idm_temp_access  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS idm_temp_access_write_restrict_insert ON idm_temp_access;
CREATE POLICY idm_temp_access_write_restrict_insert ON idm_temp_access AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['iam.manage','iam.security','iam.approvals']));
DROP POLICY IF EXISTS idm_temp_access_write_restrict_update ON idm_temp_access;
CREATE POLICY idm_temp_access_write_restrict_update ON idm_temp_access AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['iam.manage','iam.security','iam.approvals']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['iam.manage','iam.security','iam.approvals']));
DROP POLICY IF EXISTS idm_temp_access_write_restrict_delete ON idm_temp_access;
CREATE POLICY idm_temp_access_write_restrict_delete ON idm_temp_access AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['iam.manage','iam.security','iam.approvals']));
-- ----------------------------------------------------------------------------
-- Identity Management: idm_user_activity  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS idm_user_activity_write_restrict_insert ON idm_user_activity;
CREATE POLICY idm_user_activity_write_restrict_insert ON idm_user_activity AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['iam.manage','iam.sessions']));
DROP POLICY IF EXISTS idm_user_activity_write_restrict_update ON idm_user_activity;
CREATE POLICY idm_user_activity_write_restrict_update ON idm_user_activity AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['iam.manage','iam.sessions']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['iam.manage','iam.sessions']));
DROP POLICY IF EXISTS idm_user_activity_write_restrict_delete ON idm_user_activity;
CREATE POLICY idm_user_activity_write_restrict_delete ON idm_user_activity AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['iam.manage','iam.sessions']));
-- ----------------------------------------------------------------------------
-- Identity Management: idm_user_roles  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS idm_user_roles_write_restrict_insert ON idm_user_roles;
CREATE POLICY idm_user_roles_write_restrict_insert ON idm_user_roles AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['iam.manage','iam.roles']));
DROP POLICY IF EXISTS idm_user_roles_write_restrict_update ON idm_user_roles;
CREATE POLICY idm_user_roles_write_restrict_update ON idm_user_roles AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['iam.manage','iam.roles']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['iam.manage','iam.roles']));
DROP POLICY IF EXISTS idm_user_roles_write_restrict_delete ON idm_user_roles;
CREATE POLICY idm_user_roles_write_restrict_delete ON idm_user_roles AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['iam.manage','iam.roles']));
-- ----------------------------------------------------------------------------
-- Identity Management: idm_username_rules  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS idm_username_rules_write_restrict_insert ON idm_username_rules;
CREATE POLICY idm_username_rules_write_restrict_insert ON idm_username_rules AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['iam.manage','iam.provision']));
DROP POLICY IF EXISTS idm_username_rules_write_restrict_update ON idm_username_rules;
CREATE POLICY idm_username_rules_write_restrict_update ON idm_username_rules AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['iam.manage','iam.provision']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['iam.manage','iam.provision']));
DROP POLICY IF EXISTS idm_username_rules_write_restrict_delete ON idm_username_rules;
CREATE POLICY idm_username_rules_write_restrict_delete ON idm_username_rules AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['iam.manage','iam.provision']));
-- ----------------------------------------------------------------------------
-- Integrations: integration_configs  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS integration_configs_write_restrict_insert ON integration_configs;
CREATE POLICY integration_configs_write_restrict_insert ON integration_configs AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['settings.integrations','intg.manage','settings.manage']));
DROP POLICY IF EXISTS integration_configs_write_restrict_update ON integration_configs;
CREATE POLICY integration_configs_write_restrict_update ON integration_configs AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['settings.integrations','intg.manage','settings.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['settings.integrations','intg.manage','settings.manage']));
DROP POLICY IF EXISTS integration_configs_write_restrict_delete ON integration_configs;
CREATE POLICY integration_configs_write_restrict_delete ON integration_configs AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['settings.integrations','intg.manage','settings.manage']));
-- ----------------------------------------------------------------------------
-- Integrations: intg_alerts  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS intg_alerts_write_restrict_insert ON intg_alerts;
CREATE POLICY intg_alerts_write_restrict_insert ON intg_alerts AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['intg.manage','intg.monitor']));
DROP POLICY IF EXISTS intg_alerts_write_restrict_update ON intg_alerts;
CREATE POLICY intg_alerts_write_restrict_update ON intg_alerts AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['intg.manage','intg.monitor']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['intg.manage','intg.monitor']));
DROP POLICY IF EXISTS intg_alerts_write_restrict_delete ON intg_alerts;
CREATE POLICY intg_alerts_write_restrict_delete ON intg_alerts AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['intg.manage','intg.monitor']));
-- ----------------------------------------------------------------------------
-- Integrations: intg_api_apps  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS intg_api_apps_write_restrict_insert ON intg_api_apps;
CREATE POLICY intg_api_apps_write_restrict_insert ON intg_api_apps AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['intg.manage','intg.api']));
DROP POLICY IF EXISTS intg_api_apps_write_restrict_update ON intg_api_apps;
CREATE POLICY intg_api_apps_write_restrict_update ON intg_api_apps AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['intg.manage','intg.api']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['intg.manage','intg.api']));
DROP POLICY IF EXISTS intg_api_apps_write_restrict_delete ON intg_api_apps;
CREATE POLICY intg_api_apps_write_restrict_delete ON intg_api_apps AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['intg.manage','intg.api']));
-- ----------------------------------------------------------------------------
-- Integrations: intg_api_keys  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS intg_api_keys_write_restrict_insert ON intg_api_keys;
CREATE POLICY intg_api_keys_write_restrict_insert ON intg_api_keys AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['intg.manage','intg.api']));
DROP POLICY IF EXISTS intg_api_keys_write_restrict_update ON intg_api_keys;
CREATE POLICY intg_api_keys_write_restrict_update ON intg_api_keys AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['intg.manage','intg.api']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['intg.manage','intg.api']));
DROP POLICY IF EXISTS intg_api_keys_write_restrict_delete ON intg_api_keys;
CREATE POLICY intg_api_keys_write_restrict_delete ON intg_api_keys AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['intg.manage','intg.api']));
-- ----------------------------------------------------------------------------
-- Integrations: intg_api_logs  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS intg_api_logs_write_restrict_insert ON intg_api_logs;
CREATE POLICY intg_api_logs_write_restrict_insert ON intg_api_logs AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['intg.manage','intg.api']));
DROP POLICY IF EXISTS intg_api_logs_write_restrict_update ON intg_api_logs;
CREATE POLICY intg_api_logs_write_restrict_update ON intg_api_logs AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['intg.manage','intg.api']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['intg.manage','intg.api']));
DROP POLICY IF EXISTS intg_api_logs_write_restrict_delete ON intg_api_logs;
CREATE POLICY intg_api_logs_write_restrict_delete ON intg_api_logs AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['intg.manage','intg.api']));
-- ----------------------------------------------------------------------------
-- Integrations: intg_api_routes  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS intg_api_routes_write_restrict_insert ON intg_api_routes;
CREATE POLICY intg_api_routes_write_restrict_insert ON intg_api_routes AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['intg.manage','intg.api']));
DROP POLICY IF EXISTS intg_api_routes_write_restrict_update ON intg_api_routes;
CREATE POLICY intg_api_routes_write_restrict_update ON intg_api_routes AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['intg.manage','intg.api']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['intg.manage','intg.api']));
DROP POLICY IF EXISTS intg_api_routes_write_restrict_delete ON intg_api_routes;
CREATE POLICY intg_api_routes_write_restrict_delete ON intg_api_routes AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['intg.manage','intg.api']));
-- ----------------------------------------------------------------------------
-- Integrations: intg_connections  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS intg_connections_write_restrict_insert ON intg_connections;
CREATE POLICY intg_connections_write_restrict_insert ON intg_connections AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['intg.manage','settings.integrations']));
DROP POLICY IF EXISTS intg_connections_write_restrict_update ON intg_connections;
CREATE POLICY intg_connections_write_restrict_update ON intg_connections AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['intg.manage','settings.integrations']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['intg.manage','settings.integrations']));
DROP POLICY IF EXISTS intg_connections_write_restrict_delete ON intg_connections;
CREATE POLICY intg_connections_write_restrict_delete ON intg_connections AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['intg.manage','settings.integrations']));
-- ----------------------------------------------------------------------------
-- Integrations: intg_connectors  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS intg_connectors_write_restrict_insert ON intg_connectors;
CREATE POLICY intg_connectors_write_restrict_insert ON intg_connectors AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['intg.manage','settings.integrations']));
DROP POLICY IF EXISTS intg_connectors_write_restrict_update ON intg_connectors;
CREATE POLICY intg_connectors_write_restrict_update ON intg_connectors AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['intg.manage','settings.integrations']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['intg.manage','settings.integrations']));
DROP POLICY IF EXISTS intg_connectors_write_restrict_delete ON intg_connectors;
CREATE POLICY intg_connectors_write_restrict_delete ON intg_connectors AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['intg.manage','settings.integrations']));
-- ----------------------------------------------------------------------------
-- Integrations: intg_developer_apps  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS intg_developer_apps_write_restrict_insert ON intg_developer_apps;
CREATE POLICY intg_developer_apps_write_restrict_insert ON intg_developer_apps AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['intg.manage','intg.api']));
DROP POLICY IF EXISTS intg_developer_apps_write_restrict_update ON intg_developer_apps;
CREATE POLICY intg_developer_apps_write_restrict_update ON intg_developer_apps AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['intg.manage','intg.api']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['intg.manage','intg.api']));
DROP POLICY IF EXISTS intg_developer_apps_write_restrict_delete ON intg_developer_apps;
CREATE POLICY intg_developer_apps_write_restrict_delete ON intg_developer_apps AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['intg.manage','intg.api']));
-- ----------------------------------------------------------------------------
-- Integrations: intg_events  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS intg_events_write_restrict_insert ON intg_events;
CREATE POLICY intg_events_write_restrict_insert ON intg_events AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['intg.manage','intg.monitor']));
DROP POLICY IF EXISTS intg_events_write_restrict_update ON intg_events;
CREATE POLICY intg_events_write_restrict_update ON intg_events AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['intg.manage','intg.monitor']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['intg.manage','intg.monitor']));
DROP POLICY IF EXISTS intg_events_write_restrict_delete ON intg_events;
CREATE POLICY intg_events_write_restrict_delete ON intg_events AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['intg.manage','intg.monitor']));
-- ----------------------------------------------------------------------------
-- Integrations: intg_field_maps  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS intg_field_maps_write_restrict_insert ON intg_field_maps;
CREATE POLICY intg_field_maps_write_restrict_insert ON intg_field_maps AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['intg.manage','intg.workflows']));
DROP POLICY IF EXISTS intg_field_maps_write_restrict_update ON intg_field_maps;
CREATE POLICY intg_field_maps_write_restrict_update ON intg_field_maps AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['intg.manage','intg.workflows']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['intg.manage','intg.workflows']));
DROP POLICY IF EXISTS intg_field_maps_write_restrict_delete ON intg_field_maps;
CREATE POLICY intg_field_maps_write_restrict_delete ON intg_field_maps AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['intg.manage','intg.workflows']));
-- ----------------------------------------------------------------------------
-- Integrations: intg_gps_positions  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS intg_gps_positions_write_restrict_insert ON intg_gps_positions;
CREATE POLICY intg_gps_positions_write_restrict_insert ON intg_gps_positions AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['intg.manage','intg.iot']));
DROP POLICY IF EXISTS intg_gps_positions_write_restrict_update ON intg_gps_positions;
CREATE POLICY intg_gps_positions_write_restrict_update ON intg_gps_positions AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['intg.manage','intg.iot']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['intg.manage','intg.iot']));
DROP POLICY IF EXISTS intg_gps_positions_write_restrict_delete ON intg_gps_positions;
CREATE POLICY intg_gps_positions_write_restrict_delete ON intg_gps_positions AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['intg.manage','intg.iot']));
-- ----------------------------------------------------------------------------
-- Integrations: intg_hardware_devices  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS intg_hardware_devices_write_restrict_insert ON intg_hardware_devices;
CREATE POLICY intg_hardware_devices_write_restrict_insert ON intg_hardware_devices AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['intg.manage','intg.iot']));
DROP POLICY IF EXISTS intg_hardware_devices_write_restrict_update ON intg_hardware_devices;
CREATE POLICY intg_hardware_devices_write_restrict_update ON intg_hardware_devices AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['intg.manage','intg.iot']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['intg.manage','intg.iot']));
DROP POLICY IF EXISTS intg_hardware_devices_write_restrict_delete ON intg_hardware_devices;
CREATE POLICY intg_hardware_devices_write_restrict_delete ON intg_hardware_devices AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['intg.manage','intg.iot']));
-- ----------------------------------------------------------------------------
-- Integrations: intg_health_checks  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS intg_health_checks_write_restrict_insert ON intg_health_checks;
CREATE POLICY intg_health_checks_write_restrict_insert ON intg_health_checks AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['intg.manage','intg.monitor']));
DROP POLICY IF EXISTS intg_health_checks_write_restrict_update ON intg_health_checks;
CREATE POLICY intg_health_checks_write_restrict_update ON intg_health_checks AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['intg.manage','intg.monitor']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['intg.manage','intg.monitor']));
DROP POLICY IF EXISTS intg_health_checks_write_restrict_delete ON intg_health_checks;
CREATE POLICY intg_health_checks_write_restrict_delete ON intg_health_checks AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['intg.manage','intg.monitor']));
-- ----------------------------------------------------------------------------
-- Integrations: intg_iot_devices  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS intg_iot_devices_write_restrict_insert ON intg_iot_devices;
CREATE POLICY intg_iot_devices_write_restrict_insert ON intg_iot_devices AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['intg.manage','intg.iot']));
DROP POLICY IF EXISTS intg_iot_devices_write_restrict_update ON intg_iot_devices;
CREATE POLICY intg_iot_devices_write_restrict_update ON intg_iot_devices AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['intg.manage','intg.iot']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['intg.manage','intg.iot']));
DROP POLICY IF EXISTS intg_iot_devices_write_restrict_delete ON intg_iot_devices;
CREATE POLICY intg_iot_devices_write_restrict_delete ON intg_iot_devices AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['intg.manage','intg.iot']));
-- ----------------------------------------------------------------------------
-- Integrations: intg_iot_telemetry  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS intg_iot_telemetry_write_restrict_insert ON intg_iot_telemetry;
CREATE POLICY intg_iot_telemetry_write_restrict_insert ON intg_iot_telemetry AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['intg.manage','intg.iot']));
DROP POLICY IF EXISTS intg_iot_telemetry_write_restrict_update ON intg_iot_telemetry;
CREATE POLICY intg_iot_telemetry_write_restrict_update ON intg_iot_telemetry AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['intg.manage','intg.iot']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['intg.manage','intg.iot']));
DROP POLICY IF EXISTS intg_iot_telemetry_write_restrict_delete ON intg_iot_telemetry;
CREATE POLICY intg_iot_telemetry_write_restrict_delete ON intg_iot_telemetry AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['intg.manage','intg.iot']));
-- ----------------------------------------------------------------------------
-- Integrations: intg_module_links  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS intg_module_links_write_restrict_insert ON intg_module_links;
CREATE POLICY intg_module_links_write_restrict_insert ON intg_module_links AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['intg.manage']));
DROP POLICY IF EXISTS intg_module_links_write_restrict_update ON intg_module_links;
CREATE POLICY intg_module_links_write_restrict_update ON intg_module_links AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['intg.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['intg.manage']));
DROP POLICY IF EXISTS intg_module_links_write_restrict_delete ON intg_module_links;
CREATE POLICY intg_module_links_write_restrict_delete ON intg_module_links AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['intg.manage']));
-- ----------------------------------------------------------------------------
-- Integrations: intg_queue_messages  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS intg_queue_messages_write_restrict_insert ON intg_queue_messages;
CREATE POLICY intg_queue_messages_write_restrict_insert ON intg_queue_messages AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['intg.manage','intg.workflows']));
DROP POLICY IF EXISTS intg_queue_messages_write_restrict_update ON intg_queue_messages;
CREATE POLICY intg_queue_messages_write_restrict_update ON intg_queue_messages AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['intg.manage','intg.workflows']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['intg.manage','intg.workflows']));
DROP POLICY IF EXISTS intg_queue_messages_write_restrict_delete ON intg_queue_messages;
CREATE POLICY intg_queue_messages_write_restrict_delete ON intg_queue_messages AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['intg.manage','intg.workflows']));
-- ----------------------------------------------------------------------------
-- Integrations: intg_sdk_downloads  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS intg_sdk_downloads_write_restrict_insert ON intg_sdk_downloads;
CREATE POLICY intg_sdk_downloads_write_restrict_insert ON intg_sdk_downloads AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['intg.manage','intg.api']));
DROP POLICY IF EXISTS intg_sdk_downloads_write_restrict_update ON intg_sdk_downloads;
CREATE POLICY intg_sdk_downloads_write_restrict_update ON intg_sdk_downloads AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['intg.manage','intg.api']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['intg.manage','intg.api']));
DROP POLICY IF EXISTS intg_sdk_downloads_write_restrict_delete ON intg_sdk_downloads;
CREATE POLICY intg_sdk_downloads_write_restrict_delete ON intg_sdk_downloads AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['intg.manage','intg.api']));
-- ----------------------------------------------------------------------------
-- Integrations: intg_secrets  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS intg_secrets_write_restrict_insert ON intg_secrets;
CREATE POLICY intg_secrets_write_restrict_insert ON intg_secrets AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['intg.manage','intg.security']));
DROP POLICY IF EXISTS intg_secrets_write_restrict_update ON intg_secrets;
CREATE POLICY intg_secrets_write_restrict_update ON intg_secrets AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['intg.manage','intg.security']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['intg.manage','intg.security']));
DROP POLICY IF EXISTS intg_secrets_write_restrict_delete ON intg_secrets;
CREATE POLICY intg_secrets_write_restrict_delete ON intg_secrets AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['intg.manage','intg.security']));
-- ----------------------------------------------------------------------------
-- Integrations: intg_sync_jobs  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS intg_sync_jobs_write_restrict_insert ON intg_sync_jobs;
CREATE POLICY intg_sync_jobs_write_restrict_insert ON intg_sync_jobs AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['intg.manage','intg.workflows']));
DROP POLICY IF EXISTS intg_sync_jobs_write_restrict_update ON intg_sync_jobs;
CREATE POLICY intg_sync_jobs_write_restrict_update ON intg_sync_jobs AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['intg.manage','intg.workflows']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['intg.manage','intg.workflows']));
DROP POLICY IF EXISTS intg_sync_jobs_write_restrict_delete ON intg_sync_jobs;
CREATE POLICY intg_sync_jobs_write_restrict_delete ON intg_sync_jobs AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['intg.manage','intg.workflows']));
-- ----------------------------------------------------------------------------
-- Integrations: intg_sync_runs  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS intg_sync_runs_write_restrict_insert ON intg_sync_runs;
CREATE POLICY intg_sync_runs_write_restrict_insert ON intg_sync_runs AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['intg.manage','intg.monitor']));
DROP POLICY IF EXISTS intg_sync_runs_write_restrict_update ON intg_sync_runs;
CREATE POLICY intg_sync_runs_write_restrict_update ON intg_sync_runs AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['intg.manage','intg.monitor']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['intg.manage','intg.monitor']));
DROP POLICY IF EXISTS intg_sync_runs_write_restrict_delete ON intg_sync_runs;
CREATE POLICY intg_sync_runs_write_restrict_delete ON intg_sync_runs AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['intg.manage','intg.monitor']));
-- ----------------------------------------------------------------------------
-- Integrations: intg_webhook_deliveries  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS intg_webhook_deliveries_write_restrict_insert ON intg_webhook_deliveries;
CREATE POLICY intg_webhook_deliveries_write_restrict_insert ON intg_webhook_deliveries AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['intg.manage','intg.webhooks']));
DROP POLICY IF EXISTS intg_webhook_deliveries_write_restrict_update ON intg_webhook_deliveries;
CREATE POLICY intg_webhook_deliveries_write_restrict_update ON intg_webhook_deliveries AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['intg.manage','intg.webhooks']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['intg.manage','intg.webhooks']));
DROP POLICY IF EXISTS intg_webhook_deliveries_write_restrict_delete ON intg_webhook_deliveries;
CREATE POLICY intg_webhook_deliveries_write_restrict_delete ON intg_webhook_deliveries AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['intg.manage','intg.webhooks']));
-- ----------------------------------------------------------------------------
-- Integrations: intg_webhook_subscriptions  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS intg_webhook_subscriptions_write_restrict_insert ON intg_webhook_subscriptions;
CREATE POLICY intg_webhook_subscriptions_write_restrict_insert ON intg_webhook_subscriptions AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['intg.manage','intg.webhooks']));
DROP POLICY IF EXISTS intg_webhook_subscriptions_write_restrict_update ON intg_webhook_subscriptions;
CREATE POLICY intg_webhook_subscriptions_write_restrict_update ON intg_webhook_subscriptions AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['intg.manage','intg.webhooks']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['intg.manage','intg.webhooks']));
DROP POLICY IF EXISTS intg_webhook_subscriptions_write_restrict_delete ON intg_webhook_subscriptions;
CREATE POLICY intg_webhook_subscriptions_write_restrict_delete ON intg_webhook_subscriptions AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['intg.manage','intg.webhooks']));
-- ----------------------------------------------------------------------------
-- Integrations: intg_workflow_runs  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS intg_workflow_runs_write_restrict_insert ON intg_workflow_runs;
CREATE POLICY intg_workflow_runs_write_restrict_insert ON intg_workflow_runs AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['intg.manage','intg.workflows']));
DROP POLICY IF EXISTS intg_workflow_runs_write_restrict_update ON intg_workflow_runs;
CREATE POLICY intg_workflow_runs_write_restrict_update ON intg_workflow_runs AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['intg.manage','intg.workflows']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['intg.manage','intg.workflows']));
DROP POLICY IF EXISTS intg_workflow_runs_write_restrict_delete ON intg_workflow_runs;
CREATE POLICY intg_workflow_runs_write_restrict_delete ON intg_workflow_runs AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['intg.manage','intg.workflows']));
-- ----------------------------------------------------------------------------
-- Integrations: intg_workflows  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS intg_workflows_write_restrict_insert ON intg_workflows;
CREATE POLICY intg_workflows_write_restrict_insert ON intg_workflows AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['intg.manage','intg.workflows']));
DROP POLICY IF EXISTS intg_workflows_write_restrict_update ON intg_workflows;
CREATE POLICY intg_workflows_write_restrict_update ON intg_workflows AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['intg.manage','intg.workflows']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['intg.manage','intg.workflows']));
DROP POLICY IF EXISTS intg_workflows_write_restrict_delete ON intg_workflows;
CREATE POLICY intg_workflows_write_restrict_delete ON intg_workflows AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['intg.manage','intg.workflows']));
-- ----------------------------------------------------------------------------
-- Inventory: inventory_insights  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS inventory_insights_write_restrict_insert ON inventory_insights;
CREATE POLICY inventory_insights_write_restrict_insert ON inventory_insights AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['inventory.manage','inventory.adjust','inventory.move']));
DROP POLICY IF EXISTS inventory_insights_write_restrict_update ON inventory_insights;
CREATE POLICY inventory_insights_write_restrict_update ON inventory_insights AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['inventory.manage','inventory.adjust','inventory.move']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['inventory.manage','inventory.adjust','inventory.move']));
DROP POLICY IF EXISTS inventory_insights_write_restrict_delete ON inventory_insights;
CREATE POLICY inventory_insights_write_restrict_delete ON inventory_insights AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['inventory.manage','inventory.adjust','inventory.move']));
-- ----------------------------------------------------------------------------
-- Inventory: inventory_movements  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS inventory_movements_write_restrict_insert ON inventory_movements;
CREATE POLICY inventory_movements_write_restrict_insert ON inventory_movements AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['inventory.manage','inventory.move','inventory.adjust','inventory.grn','inventory.qc','inventory.valuation']));
DROP POLICY IF EXISTS inventory_movements_write_restrict_update ON inventory_movements;
CREATE POLICY inventory_movements_write_restrict_update ON inventory_movements AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['inventory.manage','inventory.move','inventory.adjust','inventory.grn','inventory.qc','inventory.valuation']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['inventory.manage','inventory.move','inventory.adjust','inventory.grn','inventory.qc','inventory.valuation']));
DROP POLICY IF EXISTS inventory_movements_write_restrict_delete ON inventory_movements;
CREATE POLICY inventory_movements_write_restrict_delete ON inventory_movements AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['inventory.manage','inventory.move','inventory.adjust','inventory.grn','inventory.qc','inventory.valuation']));
-- ----------------------------------------------------------------------------
-- Labels: lbl_ai_insights  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS lbl_ai_insights_write_restrict_insert ON lbl_ai_insights;
CREATE POLICY lbl_ai_insights_write_restrict_insert ON lbl_ai_insights AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['lbl.manage','lbl.ai','lbl.view']));
DROP POLICY IF EXISTS lbl_ai_insights_write_restrict_update ON lbl_ai_insights;
CREATE POLICY lbl_ai_insights_write_restrict_update ON lbl_ai_insights AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['lbl.manage','lbl.ai','lbl.view']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['lbl.manage','lbl.ai','lbl.view']));
DROP POLICY IF EXISTS lbl_ai_insights_write_restrict_delete ON lbl_ai_insights;
CREATE POLICY lbl_ai_insights_write_restrict_delete ON lbl_ai_insights AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['lbl.manage','lbl.ai','lbl.view']));
-- ----------------------------------------------------------------------------
-- Labels: lbl_approvals  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS lbl_approvals_write_restrict_insert ON lbl_approvals;
CREATE POLICY lbl_approvals_write_restrict_insert ON lbl_approvals AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['lbl.manage','lbl.approve']));
DROP POLICY IF EXISTS lbl_approvals_write_restrict_update ON lbl_approvals;
CREATE POLICY lbl_approvals_write_restrict_update ON lbl_approvals AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['lbl.manage','lbl.approve']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['lbl.manage','lbl.approve']));
DROP POLICY IF EXISTS lbl_approvals_write_restrict_delete ON lbl_approvals;
CREATE POLICY lbl_approvals_write_restrict_delete ON lbl_approvals AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['lbl.manage','lbl.approve']));
-- ----------------------------------------------------------------------------
-- Labels: lbl_audit_log  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS lbl_audit_log_write_restrict_insert ON lbl_audit_log;
CREATE POLICY lbl_audit_log_write_restrict_insert ON lbl_audit_log AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['lbl.manage','lbl.admin']));
DROP POLICY IF EXISTS lbl_audit_log_write_restrict_update ON lbl_audit_log;
CREATE POLICY lbl_audit_log_write_restrict_update ON lbl_audit_log AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['lbl.manage','lbl.admin']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['lbl.manage','lbl.admin']));
DROP POLICY IF EXISTS lbl_audit_log_write_restrict_delete ON lbl_audit_log;
CREATE POLICY lbl_audit_log_write_restrict_delete ON lbl_audit_log AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['lbl.manage','lbl.admin']));
-- ----------------------------------------------------------------------------
-- Labels: lbl_notifications  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS lbl_notifications_write_restrict_insert ON lbl_notifications;
CREATE POLICY lbl_notifications_write_restrict_insert ON lbl_notifications AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['lbl.manage','lbl.admin']));
DROP POLICY IF EXISTS lbl_notifications_write_restrict_update ON lbl_notifications;
CREATE POLICY lbl_notifications_write_restrict_update ON lbl_notifications AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['lbl.manage','lbl.admin']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['lbl.manage','lbl.admin']));
DROP POLICY IF EXISTS lbl_notifications_write_restrict_delete ON lbl_notifications;
CREATE POLICY lbl_notifications_write_restrict_delete ON lbl_notifications AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['lbl.manage','lbl.admin']));
-- ----------------------------------------------------------------------------
-- Manufacturing (MES): mes_ai_insights  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS mes_ai_insights_write_restrict_insert ON mes_ai_insights;
CREATE POLICY mes_ai_insights_write_restrict_insert ON mes_ai_insights AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['mes.manage','mes.ai','mes.view']));
DROP POLICY IF EXISTS mes_ai_insights_write_restrict_update ON mes_ai_insights;
CREATE POLICY mes_ai_insights_write_restrict_update ON mes_ai_insights AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['mes.manage','mes.ai','mes.view']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['mes.manage','mes.ai','mes.view']));
DROP POLICY IF EXISTS mes_ai_insights_write_restrict_delete ON mes_ai_insights;
CREATE POLICY mes_ai_insights_write_restrict_delete ON mes_ai_insights AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['mes.manage','mes.ai','mes.view']));
-- ----------------------------------------------------------------------------
-- Manufacturing (MES): mes_attachments  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS mes_attachments_write_restrict_insert ON mes_attachments;
CREATE POLICY mes_attachments_write_restrict_insert ON mes_attachments AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['mes.manage','mes.operate']));
DROP POLICY IF EXISTS mes_attachments_write_restrict_update ON mes_attachments;
CREATE POLICY mes_attachments_write_restrict_update ON mes_attachments AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['mes.manage','mes.operate']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['mes.manage','mes.operate']));
DROP POLICY IF EXISTS mes_attachments_write_restrict_delete ON mes_attachments;
CREATE POLICY mes_attachments_write_restrict_delete ON mes_attachments AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['mes.manage','mes.operate']));
-- ----------------------------------------------------------------------------
-- Manufacturing (MES): mes_audit_log  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS mes_audit_log_write_restrict_insert ON mes_audit_log;
CREATE POLICY mes_audit_log_write_restrict_insert ON mes_audit_log AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['mes.manage','mes.admin']));
DROP POLICY IF EXISTS mes_audit_log_write_restrict_update ON mes_audit_log;
CREATE POLICY mes_audit_log_write_restrict_update ON mes_audit_log AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['mes.manage','mes.admin']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['mes.manage','mes.admin']));
DROP POLICY IF EXISTS mes_audit_log_write_restrict_delete ON mes_audit_log;
CREATE POLICY mes_audit_log_write_restrict_delete ON mes_audit_log AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['mes.manage','mes.admin']));
-- ----------------------------------------------------------------------------
-- Manufacturing (MES): mes_consumables  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS mes_consumables_write_restrict_insert ON mes_consumables;
CREATE POLICY mes_consumables_write_restrict_insert ON mes_consumables AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['mes.manage','mes.operate']));
DROP POLICY IF EXISTS mes_consumables_write_restrict_update ON mes_consumables;
CREATE POLICY mes_consumables_write_restrict_update ON mes_consumables AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['mes.manage','mes.operate']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['mes.manage','mes.operate']));
DROP POLICY IF EXISTS mes_consumables_write_restrict_delete ON mes_consumables;
CREATE POLICY mes_consumables_write_restrict_delete ON mes_consumables AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['mes.manage','mes.operate']));
-- ----------------------------------------------------------------------------
-- Manufacturing (MES): mes_cost_layers  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS mes_cost_layers_write_restrict_insert ON mes_cost_layers;
CREATE POLICY mes_cost_layers_write_restrict_insert ON mes_cost_layers AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['mes.manage','mes.cost']));
DROP POLICY IF EXISTS mes_cost_layers_write_restrict_update ON mes_cost_layers;
CREATE POLICY mes_cost_layers_write_restrict_update ON mes_cost_layers AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['mes.manage','mes.cost']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['mes.manage','mes.cost']));
DROP POLICY IF EXISTS mes_cost_layers_write_restrict_delete ON mes_cost_layers;
CREATE POLICY mes_cost_layers_write_restrict_delete ON mes_cost_layers AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['mes.manage','mes.cost']));
-- ----------------------------------------------------------------------------
-- Manufacturing (MES): mes_downtime  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS mes_downtime_write_restrict_insert ON mes_downtime;
CREATE POLICY mes_downtime_write_restrict_insert ON mes_downtime AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['mes.manage','mes.maintenance']));
DROP POLICY IF EXISTS mes_downtime_write_restrict_update ON mes_downtime;
CREATE POLICY mes_downtime_write_restrict_update ON mes_downtime AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['mes.manage','mes.maintenance']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['mes.manage','mes.maintenance']));
DROP POLICY IF EXISTS mes_downtime_write_restrict_delete ON mes_downtime;
CREATE POLICY mes_downtime_write_restrict_delete ON mes_downtime AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['mes.manage','mes.maintenance']));
-- ----------------------------------------------------------------------------
-- Manufacturing (MES): mes_energy_readings  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS mes_energy_readings_write_restrict_insert ON mes_energy_readings;
CREATE POLICY mes_energy_readings_write_restrict_insert ON mes_energy_readings AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['mes.manage','mes.maintenance']));
DROP POLICY IF EXISTS mes_energy_readings_write_restrict_update ON mes_energy_readings;
CREATE POLICY mes_energy_readings_write_restrict_update ON mes_energy_readings AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['mes.manage','mes.maintenance']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['mes.manage','mes.maintenance']));
DROP POLICY IF EXISTS mes_energy_readings_write_restrict_delete ON mes_energy_readings;
CREATE POLICY mes_energy_readings_write_restrict_delete ON mes_energy_readings AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['mes.manage','mes.maintenance']));
-- ----------------------------------------------------------------------------
-- Manufacturing (MES): mes_genealogy  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS mes_genealogy_write_restrict_insert ON mes_genealogy;
CREATE POLICY mes_genealogy_write_restrict_insert ON mes_genealogy AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['mes.manage','mes.quality']));
DROP POLICY IF EXISTS mes_genealogy_write_restrict_update ON mes_genealogy;
CREATE POLICY mes_genealogy_write_restrict_update ON mes_genealogy AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['mes.manage','mes.quality']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['mes.manage','mes.quality']));
DROP POLICY IF EXISTS mes_genealogy_write_restrict_delete ON mes_genealogy;
CREATE POLICY mes_genealogy_write_restrict_delete ON mes_genealogy AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['mes.manage','mes.quality']));
-- ----------------------------------------------------------------------------
-- Manufacturing (MES): mes_iot_devices  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS mes_iot_devices_write_restrict_insert ON mes_iot_devices;
CREATE POLICY mes_iot_devices_write_restrict_insert ON mes_iot_devices AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['mes.manage','mes.maintenance']));
DROP POLICY IF EXISTS mes_iot_devices_write_restrict_update ON mes_iot_devices;
CREATE POLICY mes_iot_devices_write_restrict_update ON mes_iot_devices AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['mes.manage','mes.maintenance']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['mes.manage','mes.maintenance']));
DROP POLICY IF EXISTS mes_iot_devices_write_restrict_delete ON mes_iot_devices;
CREATE POLICY mes_iot_devices_write_restrict_delete ON mes_iot_devices AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['mes.manage','mes.maintenance']));
-- ----------------------------------------------------------------------------
-- Manufacturing (MES): mes_job_cards  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS mes_job_cards_write_restrict_insert ON mes_job_cards;
CREATE POLICY mes_job_cards_write_restrict_insert ON mes_job_cards AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['mes.manage','mes.operate','mes.shopfloor']));
DROP POLICY IF EXISTS mes_job_cards_write_restrict_update ON mes_job_cards;
CREATE POLICY mes_job_cards_write_restrict_update ON mes_job_cards AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['mes.manage','mes.operate','mes.shopfloor']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['mes.manage','mes.operate','mes.shopfloor']));
DROP POLICY IF EXISTS mes_job_cards_write_restrict_delete ON mes_job_cards;
CREATE POLICY mes_job_cards_write_restrict_delete ON mes_job_cards AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['mes.manage','mes.operate','mes.shopfloor']));
-- ----------------------------------------------------------------------------
-- Manufacturing (MES): mes_labels  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS mes_labels_write_restrict_insert ON mes_labels;
CREATE POLICY mes_labels_write_restrict_insert ON mes_labels AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['mes.manage','mes.quality']));
DROP POLICY IF EXISTS mes_labels_write_restrict_update ON mes_labels;
CREATE POLICY mes_labels_write_restrict_update ON mes_labels AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['mes.manage','mes.quality']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['mes.manage','mes.quality']));
DROP POLICY IF EXISTS mes_labels_write_restrict_delete ON mes_labels;
CREATE POLICY mes_labels_write_restrict_delete ON mes_labels AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['mes.manage','mes.quality']));
-- ----------------------------------------------------------------------------
-- Manufacturing (MES): mes_machine_groups  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS mes_machine_groups_write_restrict_insert ON mes_machine_groups;
CREATE POLICY mes_machine_groups_write_restrict_insert ON mes_machine_groups AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['mes.manage','mes.maintenance']));
DROP POLICY IF EXISTS mes_machine_groups_write_restrict_update ON mes_machine_groups;
CREATE POLICY mes_machine_groups_write_restrict_update ON mes_machine_groups AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['mes.manage','mes.maintenance']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['mes.manage','mes.maintenance']));
DROP POLICY IF EXISTS mes_machine_groups_write_restrict_delete ON mes_machine_groups;
CREATE POLICY mes_machine_groups_write_restrict_delete ON mes_machine_groups AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['mes.manage','mes.maintenance']));
-- ----------------------------------------------------------------------------
-- Manufacturing (MES): mes_maintenance_orders  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS mes_maintenance_orders_write_restrict_insert ON mes_maintenance_orders;
CREATE POLICY mes_maintenance_orders_write_restrict_insert ON mes_maintenance_orders AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['mes.manage','mes.maintenance']));
DROP POLICY IF EXISTS mes_maintenance_orders_write_restrict_update ON mes_maintenance_orders;
CREATE POLICY mes_maintenance_orders_write_restrict_update ON mes_maintenance_orders AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['mes.manage','mes.maintenance']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['mes.manage','mes.maintenance']));
DROP POLICY IF EXISTS mes_maintenance_orders_write_restrict_delete ON mes_maintenance_orders;
CREATE POLICY mes_maintenance_orders_write_restrict_delete ON mes_maintenance_orders AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['mes.manage','mes.maintenance']));
-- ----------------------------------------------------------------------------
-- Manufacturing (MES): mes_material_issues  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS mes_material_issues_write_restrict_insert ON mes_material_issues;
CREATE POLICY mes_material_issues_write_restrict_insert ON mes_material_issues AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['mes.manage','mes.operate']));
DROP POLICY IF EXISTS mes_material_issues_write_restrict_update ON mes_material_issues;
CREATE POLICY mes_material_issues_write_restrict_update ON mes_material_issues AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['mes.manage','mes.operate']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['mes.manage','mes.operate']));
DROP POLICY IF EXISTS mes_material_issues_write_restrict_delete ON mes_material_issues;
CREATE POLICY mes_material_issues_write_restrict_delete ON mes_material_issues AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['mes.manage','mes.operate']));
-- ----------------------------------------------------------------------------
-- Manufacturing (MES): mes_mps_lines  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS mes_mps_lines_write_restrict_insert ON mes_mps_lines;
CREATE POLICY mes_mps_lines_write_restrict_insert ON mes_mps_lines AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['mes.manage','mes.plan']));
DROP POLICY IF EXISTS mes_mps_lines_write_restrict_update ON mes_mps_lines;
CREATE POLICY mes_mps_lines_write_restrict_update ON mes_mps_lines AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['mes.manage','mes.plan']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['mes.manage','mes.plan']));
DROP POLICY IF EXISTS mes_mps_lines_write_restrict_delete ON mes_mps_lines;
CREATE POLICY mes_mps_lines_write_restrict_delete ON mes_mps_lines AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['mes.manage','mes.plan']));
-- ----------------------------------------------------------------------------
-- Manufacturing (MES): mes_mrp_suggestions  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS mes_mrp_suggestions_write_restrict_insert ON mes_mrp_suggestions;
CREATE POLICY mes_mrp_suggestions_write_restrict_insert ON mes_mrp_suggestions AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['mes.manage','mes.plan']));
DROP POLICY IF EXISTS mes_mrp_suggestions_write_restrict_update ON mes_mrp_suggestions;
CREATE POLICY mes_mrp_suggestions_write_restrict_update ON mes_mrp_suggestions AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['mes.manage','mes.plan']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['mes.manage','mes.plan']));
DROP POLICY IF EXISTS mes_mrp_suggestions_write_restrict_delete ON mes_mrp_suggestions;
CREATE POLICY mes_mrp_suggestions_write_restrict_delete ON mes_mrp_suggestions AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['mes.manage','mes.plan']));
-- ----------------------------------------------------------------------------
-- Manufacturing (MES): mes_ncr  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS mes_ncr_write_restrict_insert ON mes_ncr;
CREATE POLICY mes_ncr_write_restrict_insert ON mes_ncr AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['mes.manage','mes.quality']));
DROP POLICY IF EXISTS mes_ncr_write_restrict_update ON mes_ncr;
CREATE POLICY mes_ncr_write_restrict_update ON mes_ncr AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['mes.manage','mes.quality']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['mes.manage','mes.quality']));
DROP POLICY IF EXISTS mes_ncr_write_restrict_delete ON mes_ncr;
CREATE POLICY mes_ncr_write_restrict_delete ON mes_ncr AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['mes.manage','mes.quality']));
-- ----------------------------------------------------------------------------
-- Manufacturing (MES): mes_notes  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS mes_notes_write_restrict_insert ON mes_notes;
CREATE POLICY mes_notes_write_restrict_insert ON mes_notes AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['mes.manage','mes.operate']));
DROP POLICY IF EXISTS mes_notes_write_restrict_update ON mes_notes;
CREATE POLICY mes_notes_write_restrict_update ON mes_notes AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['mes.manage','mes.operate']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['mes.manage','mes.operate']));
DROP POLICY IF EXISTS mes_notes_write_restrict_delete ON mes_notes;
CREATE POLICY mes_notes_write_restrict_delete ON mes_notes AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['mes.manage','mes.operate']));
-- ----------------------------------------------------------------------------
-- Manufacturing (MES): mes_oee_snapshots  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS mes_oee_snapshots_write_restrict_insert ON mes_oee_snapshots;
CREATE POLICY mes_oee_snapshots_write_restrict_insert ON mes_oee_snapshots AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['mes.manage','mes.maintenance']));
DROP POLICY IF EXISTS mes_oee_snapshots_write_restrict_update ON mes_oee_snapshots;
CREATE POLICY mes_oee_snapshots_write_restrict_update ON mes_oee_snapshots AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['mes.manage','mes.maintenance']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['mes.manage','mes.maintenance']));
DROP POLICY IF EXISTS mes_oee_snapshots_write_restrict_delete ON mes_oee_snapshots;
CREATE POLICY mes_oee_snapshots_write_restrict_delete ON mes_oee_snapshots AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['mes.manage','mes.maintenance']));
-- ----------------------------------------------------------------------------
-- Manufacturing (MES): mes_operators  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS mes_operators_write_restrict_insert ON mes_operators;
CREATE POLICY mes_operators_write_restrict_insert ON mes_operators AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['mes.manage','mes.operate']));
DROP POLICY IF EXISTS mes_operators_write_restrict_update ON mes_operators;
CREATE POLICY mes_operators_write_restrict_update ON mes_operators AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['mes.manage','mes.operate']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['mes.manage','mes.operate']));
DROP POLICY IF EXISTS mes_operators_write_restrict_delete ON mes_operators;
CREATE POLICY mes_operators_write_restrict_delete ON mes_operators AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['mes.manage','mes.operate']));
-- ----------------------------------------------------------------------------
-- Manufacturing (MES): mes_packaging_orders  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS mes_packaging_orders_write_restrict_insert ON mes_packaging_orders;
CREATE POLICY mes_packaging_orders_write_restrict_insert ON mes_packaging_orders AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['mes.manage','mes.operate','mes.planning']));
DROP POLICY IF EXISTS mes_packaging_orders_write_restrict_update ON mes_packaging_orders;
CREATE POLICY mes_packaging_orders_write_restrict_update ON mes_packaging_orders AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['mes.manage','mes.operate','mes.planning']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['mes.manage','mes.operate','mes.planning']));
DROP POLICY IF EXISTS mes_packaging_orders_write_restrict_delete ON mes_packaging_orders;
CREATE POLICY mes_packaging_orders_write_restrict_delete ON mes_packaging_orders AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['mes.manage','mes.operate','mes.planning']));
-- ----------------------------------------------------------------------------
-- Manufacturing (MES): mes_packaging_units  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS mes_packaging_units_write_restrict_insert ON mes_packaging_units;
CREATE POLICY mes_packaging_units_write_restrict_insert ON mes_packaging_units AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['mes.manage','mes.operate']));
DROP POLICY IF EXISTS mes_packaging_units_write_restrict_update ON mes_packaging_units;
CREATE POLICY mes_packaging_units_write_restrict_update ON mes_packaging_units AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['mes.manage','mes.operate']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['mes.manage','mes.operate']));
DROP POLICY IF EXISTS mes_packaging_units_write_restrict_delete ON mes_packaging_units;
CREATE POLICY mes_packaging_units_write_restrict_delete ON mes_packaging_units AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['mes.manage','mes.operate']));
-- ----------------------------------------------------------------------------
-- Manufacturing (MES): mes_production_lines  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS mes_production_lines_write_restrict_insert ON mes_production_lines;
CREATE POLICY mes_production_lines_write_restrict_insert ON mes_production_lines AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['mes.manage','mes.shopfloor']));
DROP POLICY IF EXISTS mes_production_lines_write_restrict_update ON mes_production_lines;
CREATE POLICY mes_production_lines_write_restrict_update ON mes_production_lines AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['mes.manage','mes.shopfloor']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['mes.manage','mes.shopfloor']));
DROP POLICY IF EXISTS mes_production_lines_write_restrict_delete ON mes_production_lines;
CREATE POLICY mes_production_lines_write_restrict_delete ON mes_production_lines AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['mes.manage','mes.shopfloor']));
-- ----------------------------------------------------------------------------
-- Manufacturing (MES): mes_production_plan_lines  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS mes_production_plan_lines_write_restrict_insert ON mes_production_plan_lines;
CREATE POLICY mes_production_plan_lines_write_restrict_insert ON mes_production_plan_lines AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['mes.manage','mes.planning']));
DROP POLICY IF EXISTS mes_production_plan_lines_write_restrict_update ON mes_production_plan_lines;
CREATE POLICY mes_production_plan_lines_write_restrict_update ON mes_production_plan_lines AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['mes.manage','mes.planning']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['mes.manage','mes.planning']));
DROP POLICY IF EXISTS mes_production_plan_lines_write_restrict_delete ON mes_production_plan_lines;
CREATE POLICY mes_production_plan_lines_write_restrict_delete ON mes_production_plan_lines AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['mes.manage','mes.planning']));
-- ----------------------------------------------------------------------------
-- Manufacturing (MES): mes_quality_plans  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS mes_quality_plans_write_restrict_insert ON mes_quality_plans;
CREATE POLICY mes_quality_plans_write_restrict_insert ON mes_quality_plans AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['mes.manage','mes.quality']));
DROP POLICY IF EXISTS mes_quality_plans_write_restrict_update ON mes_quality_plans;
CREATE POLICY mes_quality_plans_write_restrict_update ON mes_quality_plans AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['mes.manage','mes.quality']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['mes.manage','mes.quality']));
DROP POLICY IF EXISTS mes_quality_plans_write_restrict_delete ON mes_quality_plans;
CREATE POLICY mes_quality_plans_write_restrict_delete ON mes_quality_plans AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['mes.manage','mes.quality']));
-- ----------------------------------------------------------------------------
-- Manufacturing (MES): mes_serial_numbers  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS mes_serial_numbers_write_restrict_insert ON mes_serial_numbers;
CREATE POLICY mes_serial_numbers_write_restrict_insert ON mes_serial_numbers AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['mes.manage','mes.quality','mes.operate']));
DROP POLICY IF EXISTS mes_serial_numbers_write_restrict_update ON mes_serial_numbers;
CREATE POLICY mes_serial_numbers_write_restrict_update ON mes_serial_numbers AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['mes.manage','mes.quality','mes.operate']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['mes.manage','mes.quality','mes.operate']));
DROP POLICY IF EXISTS mes_serial_numbers_write_restrict_delete ON mes_serial_numbers;
CREATE POLICY mes_serial_numbers_write_restrict_delete ON mes_serial_numbers AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['mes.manage','mes.quality','mes.operate']));
-- ----------------------------------------------------------------------------
-- Manufacturing (MES): mes_settings  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS mes_settings_write_restrict_insert ON mes_settings;
CREATE POLICY mes_settings_write_restrict_insert ON mes_settings AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['mes.manage','mes.admin']));
DROP POLICY IF EXISTS mes_settings_write_restrict_update ON mes_settings;
CREATE POLICY mes_settings_write_restrict_update ON mes_settings AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['mes.manage','mes.admin']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['mes.manage','mes.admin']));
DROP POLICY IF EXISTS mes_settings_write_restrict_delete ON mes_settings;
CREATE POLICY mes_settings_write_restrict_delete ON mes_settings AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['mes.manage','mes.admin']));
-- ----------------------------------------------------------------------------
-- Manufacturing (MES): mes_shifts  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS mes_shifts_write_restrict_insert ON mes_shifts;
CREATE POLICY mes_shifts_write_restrict_insert ON mes_shifts AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['mes.manage','mes.operate']));
DROP POLICY IF EXISTS mes_shifts_write_restrict_update ON mes_shifts;
CREATE POLICY mes_shifts_write_restrict_update ON mes_shifts AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['mes.manage','mes.operate']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['mes.manage','mes.operate']));
DROP POLICY IF EXISTS mes_shifts_write_restrict_delete ON mes_shifts;
CREATE POLICY mes_shifts_write_restrict_delete ON mes_shifts AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['mes.manage','mes.operate']));
-- ----------------------------------------------------------------------------
-- Manufacturing (MES): mes_shop_floor_events  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS mes_shop_floor_events_write_restrict_insert ON mes_shop_floor_events;
CREATE POLICY mes_shop_floor_events_write_restrict_insert ON mes_shop_floor_events AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['mes.manage','mes.shopfloor']));
DROP POLICY IF EXISTS mes_shop_floor_events_write_restrict_update ON mes_shop_floor_events;
CREATE POLICY mes_shop_floor_events_write_restrict_update ON mes_shop_floor_events AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['mes.manage','mes.shopfloor']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['mes.manage','mes.shopfloor']));
DROP POLICY IF EXISTS mes_shop_floor_events_write_restrict_delete ON mes_shop_floor_events;
CREATE POLICY mes_shop_floor_events_write_restrict_delete ON mes_shop_floor_events AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['mes.manage','mes.shopfloor']));
-- ----------------------------------------------------------------------------
-- Manufacturing (MES): mes_waste_records  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS mes_waste_records_write_restrict_insert ON mes_waste_records;
CREATE POLICY mes_waste_records_write_restrict_insert ON mes_waste_records AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['mes.manage','mes.quality']));
DROP POLICY IF EXISTS mes_waste_records_write_restrict_update ON mes_waste_records;
CREATE POLICY mes_waste_records_write_restrict_update ON mes_waste_records AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['mes.manage','mes.quality']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['mes.manage','mes.quality']));
DROP POLICY IF EXISTS mes_waste_records_write_restrict_delete ON mes_waste_records;
CREATE POLICY mes_waste_records_write_restrict_delete ON mes_waste_records AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['mes.manage','mes.quality']));
-- ----------------------------------------------------------------------------
-- Manufacturing (MES): mes_work_instructions  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS mes_work_instructions_write_restrict_insert ON mes_work_instructions;
CREATE POLICY mes_work_instructions_write_restrict_insert ON mes_work_instructions AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['mes.manage','mes.planning','mes.operate']));
DROP POLICY IF EXISTS mes_work_instructions_write_restrict_update ON mes_work_instructions;
CREATE POLICY mes_work_instructions_write_restrict_update ON mes_work_instructions AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['mes.manage','mes.planning','mes.operate']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['mes.manage','mes.planning','mes.operate']));
DROP POLICY IF EXISTS mes_work_instructions_write_restrict_delete ON mes_work_instructions;
CREATE POLICY mes_work_instructions_write_restrict_delete ON mes_work_instructions AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['mes.manage','mes.planning','mes.operate']));
-- ----------------------------------------------------------------------------
-- Notifications: notification_broadcasts  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS notification_broadcasts_write_restrict_insert ON notification_broadcasts;
CREATE POLICY notification_broadcasts_write_restrict_insert ON notification_broadcasts AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['notifications.manage','notifications.send','notifications.view']));
DROP POLICY IF EXISTS notification_broadcasts_write_restrict_update ON notification_broadcasts;
CREATE POLICY notification_broadcasts_write_restrict_update ON notification_broadcasts AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['notifications.manage','notifications.send','notifications.view']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['notifications.manage','notifications.send','notifications.view']));
DROP POLICY IF EXISTS notification_broadcasts_write_restrict_delete ON notification_broadcasts;
CREATE POLICY notification_broadcasts_write_restrict_delete ON notification_broadcasts AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['notifications.manage','notifications.send','notifications.view']));
-- ----------------------------------------------------------------------------
-- Notifications: notification_deliveries  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS notification_deliveries_write_restrict_insert ON notification_deliveries;
CREATE POLICY notification_deliveries_write_restrict_insert ON notification_deliveries AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['notifications.manage','notifications.send','notifications.view']));
DROP POLICY IF EXISTS notification_deliveries_write_restrict_update ON notification_deliveries;
CREATE POLICY notification_deliveries_write_restrict_update ON notification_deliveries AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['notifications.manage','notifications.send','notifications.view']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['notifications.manage','notifications.send','notifications.view']));
DROP POLICY IF EXISTS notification_deliveries_write_restrict_delete ON notification_deliveries;
CREATE POLICY notification_deliveries_write_restrict_delete ON notification_deliveries AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['notifications.manage','notifications.send','notifications.view']));
-- ----------------------------------------------------------------------------
-- Notifications: notification_rules  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS notification_rules_write_restrict_insert ON notification_rules;
CREATE POLICY notification_rules_write_restrict_insert ON notification_rules AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['notifications.manage','notifications.send','notifications.view']));
DROP POLICY IF EXISTS notification_rules_write_restrict_update ON notification_rules;
CREATE POLICY notification_rules_write_restrict_update ON notification_rules AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['notifications.manage','notifications.send','notifications.view']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['notifications.manage','notifications.send','notifications.view']));
DROP POLICY IF EXISTS notification_rules_write_restrict_delete ON notification_rules;
CREATE POLICY notification_rules_write_restrict_delete ON notification_rules AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['notifications.manage','notifications.send','notifications.view']));
-- ----------------------------------------------------------------------------
-- Notifications: notification_subscriptions  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS notification_subscriptions_write_restrict_insert ON notification_subscriptions;
CREATE POLICY notification_subscriptions_write_restrict_insert ON notification_subscriptions AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['notifications.manage','notifications.send','notifications.view']));
DROP POLICY IF EXISTS notification_subscriptions_write_restrict_update ON notification_subscriptions;
CREATE POLICY notification_subscriptions_write_restrict_update ON notification_subscriptions AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['notifications.manage','notifications.send','notifications.view']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['notifications.manage','notifications.send','notifications.view']));
DROP POLICY IF EXISTS notification_subscriptions_write_restrict_delete ON notification_subscriptions;
CREATE POLICY notification_subscriptions_write_restrict_delete ON notification_subscriptions AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['notifications.manage','notifications.send','notifications.view']));
-- ----------------------------------------------------------------------------
-- Notifications: notification_templates  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS notification_templates_write_restrict_insert ON notification_templates;
CREATE POLICY notification_templates_write_restrict_insert ON notification_templates AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['notifications.manage','notifications.send','notifications.view','settings.manage']));
DROP POLICY IF EXISTS notification_templates_write_restrict_update ON notification_templates;
CREATE POLICY notification_templates_write_restrict_update ON notification_templates AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['notifications.manage','notifications.send','notifications.view','settings.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['notifications.manage','notifications.send','notifications.view','settings.manage']));
DROP POLICY IF EXISTS notification_templates_write_restrict_delete ON notification_templates;
CREATE POLICY notification_templates_write_restrict_delete ON notification_templates AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['notifications.manage','notifications.send','notifications.view','settings.manage']));
-- ----------------------------------------------------------------------------
-- Payroll: pay_ai_insights  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS pay_ai_insights_write_restrict_insert ON pay_ai_insights;
CREATE POLICY pay_ai_insights_write_restrict_insert ON pay_ai_insights AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['payroll.manage','payroll.ai','payroll.view']));
DROP POLICY IF EXISTS pay_ai_insights_write_restrict_update ON pay_ai_insights;
CREATE POLICY pay_ai_insights_write_restrict_update ON pay_ai_insights AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['payroll.manage','payroll.ai','payroll.view']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['payroll.manage','payroll.ai','payroll.view']));
DROP POLICY IF EXISTS pay_ai_insights_write_restrict_delete ON pay_ai_insights;
CREATE POLICY pay_ai_insights_write_restrict_delete ON pay_ai_insights AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['payroll.manage','payroll.ai','payroll.view']));
-- ----------------------------------------------------------------------------
-- Payroll: pay_audit  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS pay_audit_write_restrict_insert ON pay_audit;
CREATE POLICY pay_audit_write_restrict_insert ON pay_audit AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['payroll.manage','payroll.admin']));
DROP POLICY IF EXISTS pay_audit_write_restrict_update ON pay_audit;
CREATE POLICY pay_audit_write_restrict_update ON pay_audit AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['payroll.manage','payroll.admin']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['payroll.manage','payroll.admin']));
DROP POLICY IF EXISTS pay_audit_write_restrict_delete ON pay_audit;
CREATE POLICY pay_audit_write_restrict_delete ON pay_audit AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['payroll.manage','payroll.admin']));
-- ----------------------------------------------------------------------------
-- Payroll: pay_bank_files  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS pay_bank_files_write_restrict_insert ON pay_bank_files;
CREATE POLICY pay_bank_files_write_restrict_insert ON pay_bank_files AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['payroll.manage','payroll.admin','payroll.bank']));
DROP POLICY IF EXISTS pay_bank_files_write_restrict_update ON pay_bank_files;
CREATE POLICY pay_bank_files_write_restrict_update ON pay_bank_files AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['payroll.manage','payroll.admin','payroll.bank']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['payroll.manage','payroll.admin','payroll.bank']));
DROP POLICY IF EXISTS pay_bank_files_write_restrict_delete ON pay_bank_files;
CREATE POLICY pay_bank_files_write_restrict_delete ON pay_bank_files AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['payroll.manage','payroll.admin','payroll.bank']));
-- ----------------------------------------------------------------------------
-- Payroll: pay_employee_profiles  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS pay_employee_profiles_write_restrict_insert ON pay_employee_profiles;
CREATE POLICY pay_employee_profiles_write_restrict_insert ON pay_employee_profiles AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['payroll.manage','payroll.admin','payroll.self']));
DROP POLICY IF EXISTS pay_employee_profiles_write_restrict_update ON pay_employee_profiles;
CREATE POLICY pay_employee_profiles_write_restrict_update ON pay_employee_profiles AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['payroll.manage','payroll.admin','payroll.self']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['payroll.manage','payroll.admin','payroll.self']));
DROP POLICY IF EXISTS pay_employee_profiles_write_restrict_delete ON pay_employee_profiles;
CREATE POLICY pay_employee_profiles_write_restrict_delete ON pay_employee_profiles AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['payroll.manage','payroll.admin','payroll.self']));
-- ----------------------------------------------------------------------------
-- Packaging: pkg_ai_insights  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS pkg_ai_insights_write_restrict_insert ON pkg_ai_insights;
CREATE POLICY pkg_ai_insights_write_restrict_insert ON pkg_ai_insights AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['pkg.manage','pkg.ai','pkg.view']));
DROP POLICY IF EXISTS pkg_ai_insights_write_restrict_update ON pkg_ai_insights;
CREATE POLICY pkg_ai_insights_write_restrict_update ON pkg_ai_insights AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['pkg.manage','pkg.ai','pkg.view']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['pkg.manage','pkg.ai','pkg.view']));
DROP POLICY IF EXISTS pkg_ai_insights_write_restrict_delete ON pkg_ai_insights;
CREATE POLICY pkg_ai_insights_write_restrict_delete ON pkg_ai_insights AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['pkg.manage','pkg.ai','pkg.view']));
-- ----------------------------------------------------------------------------
-- Packaging: pkg_audit  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS pkg_audit_write_restrict_insert ON pkg_audit;
CREATE POLICY pkg_audit_write_restrict_insert ON pkg_audit AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['pkg.manage','pkg.operate']));
DROP POLICY IF EXISTS pkg_audit_write_restrict_update ON pkg_audit;
CREATE POLICY pkg_audit_write_restrict_update ON pkg_audit AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['pkg.manage','pkg.operate']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['pkg.manage','pkg.operate']));
DROP POLICY IF EXISTS pkg_audit_write_restrict_delete ON pkg_audit;
CREATE POLICY pkg_audit_write_restrict_delete ON pkg_audit AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['pkg.manage','pkg.operate']));
-- ----------------------------------------------------------------------------
-- Projects (PPM): ppm_ai_insights  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS ppm_ai_insights_write_restrict_insert ON ppm_ai_insights;
CREATE POLICY ppm_ai_insights_write_restrict_insert ON ppm_ai_insights AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['ppm.manage','ppm.ai','ppm.view']));
DROP POLICY IF EXISTS ppm_ai_insights_write_restrict_update ON ppm_ai_insights;
CREATE POLICY ppm_ai_insights_write_restrict_update ON ppm_ai_insights AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['ppm.manage','ppm.ai','ppm.view']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['ppm.manage','ppm.ai','ppm.view']));
DROP POLICY IF EXISTS ppm_ai_insights_write_restrict_delete ON ppm_ai_insights;
CREATE POLICY ppm_ai_insights_write_restrict_delete ON ppm_ai_insights AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['ppm.manage','ppm.ai','ppm.view']));
-- ----------------------------------------------------------------------------
-- Projects (PPM): ppm_asset_allocations  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS ppm_asset_allocations_write_restrict_insert ON ppm_asset_allocations;
CREATE POLICY ppm_asset_allocations_write_restrict_insert ON ppm_asset_allocations AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['ppm.manage','ppm.execute']));
DROP POLICY IF EXISTS ppm_asset_allocations_write_restrict_update ON ppm_asset_allocations;
CREATE POLICY ppm_asset_allocations_write_restrict_update ON ppm_asset_allocations AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['ppm.manage','ppm.execute']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['ppm.manage','ppm.execute']));
DROP POLICY IF EXISTS ppm_asset_allocations_write_restrict_delete ON ppm_asset_allocations;
CREATE POLICY ppm_asset_allocations_write_restrict_delete ON ppm_asset_allocations AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['ppm.manage','ppm.execute']));
-- ----------------------------------------------------------------------------
-- Projects (PPM): ppm_audit_log  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS ppm_audit_log_write_restrict_insert ON ppm_audit_log;
CREATE POLICY ppm_audit_log_write_restrict_insert ON ppm_audit_log AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['ppm.manage','ppm.admin']));
DROP POLICY IF EXISTS ppm_audit_log_write_restrict_update ON ppm_audit_log;
CREATE POLICY ppm_audit_log_write_restrict_update ON ppm_audit_log AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['ppm.manage','ppm.admin']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['ppm.manage','ppm.admin']));
DROP POLICY IF EXISTS ppm_audit_log_write_restrict_delete ON ppm_audit_log;
CREATE POLICY ppm_audit_log_write_restrict_delete ON ppm_audit_log AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['ppm.manage','ppm.admin']));
-- ----------------------------------------------------------------------------
-- Projects (PPM): ppm_backlog  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS ppm_backlog_write_restrict_insert ON ppm_backlog;
CREATE POLICY ppm_backlog_write_restrict_insert ON ppm_backlog AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['ppm.manage','ppm.execute']));
DROP POLICY IF EXISTS ppm_backlog_write_restrict_update ON ppm_backlog;
CREATE POLICY ppm_backlog_write_restrict_update ON ppm_backlog AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['ppm.manage','ppm.execute']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['ppm.manage','ppm.execute']));
DROP POLICY IF EXISTS ppm_backlog_write_restrict_delete ON ppm_backlog;
CREATE POLICY ppm_backlog_write_restrict_delete ON ppm_backlog AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['ppm.manage','ppm.execute']));
-- ----------------------------------------------------------------------------
-- Projects (PPM): ppm_baselines  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS ppm_baselines_write_restrict_insert ON ppm_baselines;
CREATE POLICY ppm_baselines_write_restrict_insert ON ppm_baselines AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['ppm.manage','ppm.plan']));
DROP POLICY IF EXISTS ppm_baselines_write_restrict_update ON ppm_baselines;
CREATE POLICY ppm_baselines_write_restrict_update ON ppm_baselines AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['ppm.manage','ppm.plan']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['ppm.manage','ppm.plan']));
DROP POLICY IF EXISTS ppm_baselines_write_restrict_delete ON ppm_baselines;
CREATE POLICY ppm_baselines_write_restrict_delete ON ppm_baselines AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['ppm.manage','ppm.plan']));
-- ----------------------------------------------------------------------------
-- Projects (PPM): ppm_business_cases  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS ppm_business_cases_write_restrict_insert ON ppm_business_cases;
CREATE POLICY ppm_business_cases_write_restrict_insert ON ppm_business_cases AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['ppm.manage','ppm.finance']));
DROP POLICY IF EXISTS ppm_business_cases_write_restrict_update ON ppm_business_cases;
CREATE POLICY ppm_business_cases_write_restrict_update ON ppm_business_cases AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['ppm.manage','ppm.finance']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['ppm.manage','ppm.finance']));
DROP POLICY IF EXISTS ppm_business_cases_write_restrict_delete ON ppm_business_cases;
CREATE POLICY ppm_business_cases_write_restrict_delete ON ppm_business_cases AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['ppm.manage','ppm.finance']));
-- ----------------------------------------------------------------------------
-- Projects (PPM): ppm_calendar_events  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS ppm_calendar_events_write_restrict_insert ON ppm_calendar_events;
CREATE POLICY ppm_calendar_events_write_restrict_insert ON ppm_calendar_events AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['ppm.manage','ppm.execute']));
DROP POLICY IF EXISTS ppm_calendar_events_write_restrict_update ON ppm_calendar_events;
CREATE POLICY ppm_calendar_events_write_restrict_update ON ppm_calendar_events AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['ppm.manage','ppm.execute']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['ppm.manage','ppm.execute']));
DROP POLICY IF EXISTS ppm_calendar_events_write_restrict_delete ON ppm_calendar_events;
CREATE POLICY ppm_calendar_events_write_restrict_delete ON ppm_calendar_events AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['ppm.manage','ppm.execute']));
-- ----------------------------------------------------------------------------
-- Projects (PPM): ppm_categories  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS ppm_categories_write_restrict_insert ON ppm_categories;
CREATE POLICY ppm_categories_write_restrict_insert ON ppm_categories AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['ppm.manage']));
DROP POLICY IF EXISTS ppm_categories_write_restrict_update ON ppm_categories;
CREATE POLICY ppm_categories_write_restrict_update ON ppm_categories AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['ppm.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['ppm.manage']));
DROP POLICY IF EXISTS ppm_categories_write_restrict_delete ON ppm_categories;
CREATE POLICY ppm_categories_write_restrict_delete ON ppm_categories AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['ppm.manage']));
-- ----------------------------------------------------------------------------
-- Projects (PPM): ppm_checklists  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS ppm_checklists_write_restrict_insert ON ppm_checklists;
CREATE POLICY ppm_checklists_write_restrict_insert ON ppm_checklists AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['ppm.manage','ppm.execute']));
DROP POLICY IF EXISTS ppm_checklists_write_restrict_update ON ppm_checklists;
CREATE POLICY ppm_checklists_write_restrict_update ON ppm_checklists AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['ppm.manage','ppm.execute']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['ppm.manage','ppm.execute']));
DROP POLICY IF EXISTS ppm_checklists_write_restrict_delete ON ppm_checklists;
CREATE POLICY ppm_checklists_write_restrict_delete ON ppm_checklists AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['ppm.manage','ppm.execute']));
-- ----------------------------------------------------------------------------
-- Projects (PPM): ppm_comments  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS ppm_comments_write_restrict_insert ON ppm_comments;
CREATE POLICY ppm_comments_write_restrict_insert ON ppm_comments AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['ppm.manage','ppm.execute']));
DROP POLICY IF EXISTS ppm_comments_write_restrict_update ON ppm_comments;
CREATE POLICY ppm_comments_write_restrict_update ON ppm_comments AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['ppm.manage','ppm.execute']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['ppm.manage','ppm.execute']));
DROP POLICY IF EXISTS ppm_comments_write_restrict_delete ON ppm_comments;
CREATE POLICY ppm_comments_write_restrict_delete ON ppm_comments AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['ppm.manage','ppm.execute']));
-- ----------------------------------------------------------------------------
-- Projects (PPM): ppm_decisions  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS ppm_decisions_write_restrict_insert ON ppm_decisions;
CREATE POLICY ppm_decisions_write_restrict_insert ON ppm_decisions AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['ppm.manage','ppm.approve']));
DROP POLICY IF EXISTS ppm_decisions_write_restrict_update ON ppm_decisions;
CREATE POLICY ppm_decisions_write_restrict_update ON ppm_decisions AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['ppm.manage','ppm.approve']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['ppm.manage','ppm.approve']));
DROP POLICY IF EXISTS ppm_decisions_write_restrict_delete ON ppm_decisions;
CREATE POLICY ppm_decisions_write_restrict_delete ON ppm_decisions AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['ppm.manage','ppm.approve']));
-- ----------------------------------------------------------------------------
-- Projects (PPM): ppm_dependencies  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS ppm_dependencies_write_restrict_insert ON ppm_dependencies;
CREATE POLICY ppm_dependencies_write_restrict_insert ON ppm_dependencies AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['ppm.manage','ppm.plan']));
DROP POLICY IF EXISTS ppm_dependencies_write_restrict_update ON ppm_dependencies;
CREATE POLICY ppm_dependencies_write_restrict_update ON ppm_dependencies AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['ppm.manage','ppm.plan']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['ppm.manage','ppm.plan']));
DROP POLICY IF EXISTS ppm_dependencies_write_restrict_delete ON ppm_dependencies;
CREATE POLICY ppm_dependencies_write_restrict_delete ON ppm_dependencies AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['ppm.manage','ppm.plan']));
-- ----------------------------------------------------------------------------
-- Projects (PPM): ppm_documents  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS ppm_documents_write_restrict_insert ON ppm_documents;
CREATE POLICY ppm_documents_write_restrict_insert ON ppm_documents AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['ppm.manage','ppm.execute']));
DROP POLICY IF EXISTS ppm_documents_write_restrict_update ON ppm_documents;
CREATE POLICY ppm_documents_write_restrict_update ON ppm_documents AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['ppm.manage','ppm.execute']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['ppm.manage','ppm.execute']));
DROP POLICY IF EXISTS ppm_documents_write_restrict_delete ON ppm_documents;
CREATE POLICY ppm_documents_write_restrict_delete ON ppm_documents AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['ppm.manage','ppm.execute']));
-- ----------------------------------------------------------------------------
-- Projects (PPM): ppm_inspections  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS ppm_inspections_write_restrict_insert ON ppm_inspections;
CREATE POLICY ppm_inspections_write_restrict_insert ON ppm_inspections AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['ppm.manage','ppm.execute']));
DROP POLICY IF EXISTS ppm_inspections_write_restrict_update ON ppm_inspections;
CREATE POLICY ppm_inspections_write_restrict_update ON ppm_inspections AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['ppm.manage','ppm.execute']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['ppm.manage','ppm.execute']));
DROP POLICY IF EXISTS ppm_inspections_write_restrict_delete ON ppm_inspections;
CREATE POLICY ppm_inspections_write_restrict_delete ON ppm_inspections AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['ppm.manage','ppm.execute']));
-- ----------------------------------------------------------------------------
-- Projects (PPM): ppm_inventory_allocations  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS ppm_inventory_allocations_write_restrict_insert ON ppm_inventory_allocations;
CREATE POLICY ppm_inventory_allocations_write_restrict_insert ON ppm_inventory_allocations AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['ppm.manage','ppm.execute','inventory.manage']));
DROP POLICY IF EXISTS ppm_inventory_allocations_write_restrict_update ON ppm_inventory_allocations;
CREATE POLICY ppm_inventory_allocations_write_restrict_update ON ppm_inventory_allocations AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['ppm.manage','ppm.execute','inventory.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['ppm.manage','ppm.execute','inventory.manage']));
DROP POLICY IF EXISTS ppm_inventory_allocations_write_restrict_delete ON ppm_inventory_allocations;
CREATE POLICY ppm_inventory_allocations_write_restrict_delete ON ppm_inventory_allocations AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['ppm.manage','ppm.execute','inventory.manage']));
-- ----------------------------------------------------------------------------
-- Projects (PPM): ppm_invoices  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS ppm_invoices_write_restrict_insert ON ppm_invoices;
CREATE POLICY ppm_invoices_write_restrict_insert ON ppm_invoices AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['ppm.manage','ppm.finance']));
DROP POLICY IF EXISTS ppm_invoices_write_restrict_update ON ppm_invoices;
CREATE POLICY ppm_invoices_write_restrict_update ON ppm_invoices AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['ppm.manage','ppm.finance']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['ppm.manage','ppm.finance']));
DROP POLICY IF EXISTS ppm_invoices_write_restrict_delete ON ppm_invoices;
CREATE POLICY ppm_invoices_write_restrict_delete ON ppm_invoices AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['ppm.manage','ppm.finance']));
-- ----------------------------------------------------------------------------
-- Projects (PPM): ppm_lessons  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS ppm_lessons_write_restrict_insert ON ppm_lessons;
CREATE POLICY ppm_lessons_write_restrict_insert ON ppm_lessons AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['ppm.manage','ppm.execute']));
DROP POLICY IF EXISTS ppm_lessons_write_restrict_update ON ppm_lessons;
CREATE POLICY ppm_lessons_write_restrict_update ON ppm_lessons AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['ppm.manage','ppm.execute']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['ppm.manage','ppm.execute']));
DROP POLICY IF EXISTS ppm_lessons_write_restrict_delete ON ppm_lessons;
CREATE POLICY ppm_lessons_write_restrict_delete ON ppm_lessons AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['ppm.manage','ppm.execute']));
-- ----------------------------------------------------------------------------
-- Projects (PPM): ppm_meetings  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS ppm_meetings_write_restrict_insert ON ppm_meetings;
CREATE POLICY ppm_meetings_write_restrict_insert ON ppm_meetings AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['ppm.manage','ppm.execute']));
DROP POLICY IF EXISTS ppm_meetings_write_restrict_update ON ppm_meetings;
CREATE POLICY ppm_meetings_write_restrict_update ON ppm_meetings AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['ppm.manage','ppm.execute']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['ppm.manage','ppm.execute']));
DROP POLICY IF EXISTS ppm_meetings_write_restrict_delete ON ppm_meetings;
CREATE POLICY ppm_meetings_write_restrict_delete ON ppm_meetings AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['ppm.manage','ppm.execute']));
-- ----------------------------------------------------------------------------
-- Projects (PPM): ppm_ncr  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS ppm_ncr_write_restrict_insert ON ppm_ncr;
CREATE POLICY ppm_ncr_write_restrict_insert ON ppm_ncr AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['ppm.manage','ppm.approve']));
DROP POLICY IF EXISTS ppm_ncr_write_restrict_update ON ppm_ncr;
CREATE POLICY ppm_ncr_write_restrict_update ON ppm_ncr AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['ppm.manage','ppm.approve']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['ppm.manage','ppm.approve']));
DROP POLICY IF EXISTS ppm_ncr_write_restrict_delete ON ppm_ncr;
CREATE POLICY ppm_ncr_write_restrict_delete ON ppm_ncr AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['ppm.manage','ppm.approve']));
-- ----------------------------------------------------------------------------
-- Projects (PPM): ppm_notifications  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS ppm_notifications_write_restrict_insert ON ppm_notifications;
CREATE POLICY ppm_notifications_write_restrict_insert ON ppm_notifications AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['ppm.manage']));
DROP POLICY IF EXISTS ppm_notifications_write_restrict_update ON ppm_notifications;
CREATE POLICY ppm_notifications_write_restrict_update ON ppm_notifications AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['ppm.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['ppm.manage']));
DROP POLICY IF EXISTS ppm_notifications_write_restrict_delete ON ppm_notifications;
CREATE POLICY ppm_notifications_write_restrict_delete ON ppm_notifications AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['ppm.manage']));
-- ----------------------------------------------------------------------------
-- Projects (PPM): ppm_portfolios  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS ppm_portfolios_write_restrict_insert ON ppm_portfolios;
CREATE POLICY ppm_portfolios_write_restrict_insert ON ppm_portfolios AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['ppm.manage','ppm.plan']));
DROP POLICY IF EXISTS ppm_portfolios_write_restrict_update ON ppm_portfolios;
CREATE POLICY ppm_portfolios_write_restrict_update ON ppm_portfolios AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['ppm.manage','ppm.plan']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['ppm.manage','ppm.plan']));
DROP POLICY IF EXISTS ppm_portfolios_write_restrict_delete ON ppm_portfolios;
CREATE POLICY ppm_portfolios_write_restrict_delete ON ppm_portfolios AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['ppm.manage','ppm.plan']));
-- ----------------------------------------------------------------------------
-- Projects (PPM): ppm_programs  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS ppm_programs_write_restrict_insert ON ppm_programs;
CREATE POLICY ppm_programs_write_restrict_insert ON ppm_programs AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['ppm.manage','ppm.plan']));
DROP POLICY IF EXISTS ppm_programs_write_restrict_update ON ppm_programs;
CREATE POLICY ppm_programs_write_restrict_update ON ppm_programs AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['ppm.manage','ppm.plan']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['ppm.manage','ppm.plan']));
DROP POLICY IF EXISTS ppm_programs_write_restrict_delete ON ppm_programs;
CREATE POLICY ppm_programs_write_restrict_delete ON ppm_programs AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['ppm.manage','ppm.plan']));
-- ----------------------------------------------------------------------------
-- Projects (PPM): ppm_progress_claims  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS ppm_progress_claims_write_restrict_insert ON ppm_progress_claims;
CREATE POLICY ppm_progress_claims_write_restrict_insert ON ppm_progress_claims AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['ppm.manage','ppm.approve']));
DROP POLICY IF EXISTS ppm_progress_claims_write_restrict_update ON ppm_progress_claims;
CREATE POLICY ppm_progress_claims_write_restrict_update ON ppm_progress_claims AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['ppm.manage','ppm.approve']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['ppm.manage','ppm.approve']));
DROP POLICY IF EXISTS ppm_progress_claims_write_restrict_delete ON ppm_progress_claims;
CREATE POLICY ppm_progress_claims_write_restrict_delete ON ppm_progress_claims AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['ppm.manage','ppm.approve']));
-- ----------------------------------------------------------------------------
-- Projects (PPM): ppm_project_requests  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS ppm_project_requests_write_restrict_insert ON ppm_project_requests;
CREATE POLICY ppm_project_requests_write_restrict_insert ON ppm_project_requests AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['ppm.manage','ppm.approve']));
DROP POLICY IF EXISTS ppm_project_requests_write_restrict_update ON ppm_project_requests;
CREATE POLICY ppm_project_requests_write_restrict_update ON ppm_project_requests AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['ppm.manage','ppm.approve']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['ppm.manage','ppm.approve']));
DROP POLICY IF EXISTS ppm_project_requests_write_restrict_delete ON ppm_project_requests;
CREATE POLICY ppm_project_requests_write_restrict_delete ON ppm_project_requests AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['ppm.manage','ppm.approve']));
-- ----------------------------------------------------------------------------
-- Projects (PPM): ppm_project_types  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS ppm_project_types_write_restrict_insert ON ppm_project_types;
CREATE POLICY ppm_project_types_write_restrict_insert ON ppm_project_types AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['ppm.manage']));
DROP POLICY IF EXISTS ppm_project_types_write_restrict_update ON ppm_project_types;
CREATE POLICY ppm_project_types_write_restrict_update ON ppm_project_types AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['ppm.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['ppm.manage']));
DROP POLICY IF EXISTS ppm_project_types_write_restrict_delete ON ppm_project_types;
CREATE POLICY ppm_project_types_write_restrict_delete ON ppm_project_types AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['ppm.manage']));
-- ----------------------------------------------------------------------------
-- Projects (PPM): ppm_purchase_requests  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS ppm_purchase_requests_write_restrict_insert ON ppm_purchase_requests;
CREATE POLICY ppm_purchase_requests_write_restrict_insert ON ppm_purchase_requests AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['ppm.manage','ppm.finance','procurement.manage']));
DROP POLICY IF EXISTS ppm_purchase_requests_write_restrict_update ON ppm_purchase_requests;
CREATE POLICY ppm_purchase_requests_write_restrict_update ON ppm_purchase_requests AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['ppm.manage','ppm.finance','procurement.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['ppm.manage','ppm.finance','procurement.manage']));
DROP POLICY IF EXISTS ppm_purchase_requests_write_restrict_delete ON ppm_purchase_requests;
CREATE POLICY ppm_purchase_requests_write_restrict_delete ON ppm_purchase_requests AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['ppm.manage','ppm.finance','procurement.manage']));
-- ----------------------------------------------------------------------------
-- Projects (PPM): ppm_resource_allocations  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS ppm_resource_allocations_write_restrict_insert ON ppm_resource_allocations;
CREATE POLICY ppm_resource_allocations_write_restrict_insert ON ppm_resource_allocations AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['ppm.manage','ppm.execute']));
DROP POLICY IF EXISTS ppm_resource_allocations_write_restrict_update ON ppm_resource_allocations;
CREATE POLICY ppm_resource_allocations_write_restrict_update ON ppm_resource_allocations AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['ppm.manage','ppm.execute']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['ppm.manage','ppm.execute']));
DROP POLICY IF EXISTS ppm_resource_allocations_write_restrict_delete ON ppm_resource_allocations;
CREATE POLICY ppm_resource_allocations_write_restrict_delete ON ppm_resource_allocations AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['ppm.manage','ppm.execute']));
-- ----------------------------------------------------------------------------
-- Projects (PPM): ppm_resources  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS ppm_resources_write_restrict_insert ON ppm_resources;
CREATE POLICY ppm_resources_write_restrict_insert ON ppm_resources AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['ppm.manage','ppm.execute']));
DROP POLICY IF EXISTS ppm_resources_write_restrict_update ON ppm_resources;
CREATE POLICY ppm_resources_write_restrict_update ON ppm_resources AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['ppm.manage','ppm.execute']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['ppm.manage','ppm.execute']));
DROP POLICY IF EXISTS ppm_resources_write_restrict_delete ON ppm_resources;
CREATE POLICY ppm_resources_write_restrict_delete ON ppm_resources AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['ppm.manage','ppm.execute']));
-- ----------------------------------------------------------------------------
-- Projects (PPM): ppm_retentions  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS ppm_retentions_write_restrict_insert ON ppm_retentions;
CREATE POLICY ppm_retentions_write_restrict_insert ON ppm_retentions AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['ppm.manage','ppm.finance']));
DROP POLICY IF EXISTS ppm_retentions_write_restrict_update ON ppm_retentions;
CREATE POLICY ppm_retentions_write_restrict_update ON ppm_retentions AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['ppm.manage','ppm.finance']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['ppm.manage','ppm.finance']));
DROP POLICY IF EXISTS ppm_retentions_write_restrict_delete ON ppm_retentions;
CREATE POLICY ppm_retentions_write_restrict_delete ON ppm_retentions AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['ppm.manage','ppm.finance']));
-- ----------------------------------------------------------------------------
-- Projects (PPM): ppm_revenue  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS ppm_revenue_write_restrict_insert ON ppm_revenue;
CREATE POLICY ppm_revenue_write_restrict_insert ON ppm_revenue AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['ppm.manage','ppm.finance']));
DROP POLICY IF EXISTS ppm_revenue_write_restrict_update ON ppm_revenue;
CREATE POLICY ppm_revenue_write_restrict_update ON ppm_revenue AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['ppm.manage','ppm.finance']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['ppm.manage','ppm.finance']));
DROP POLICY IF EXISTS ppm_revenue_write_restrict_delete ON ppm_revenue;
CREATE POLICY ppm_revenue_write_restrict_delete ON ppm_revenue AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['ppm.manage','ppm.finance']));
-- ----------------------------------------------------------------------------
-- Projects (PPM): ppm_roadmap  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS ppm_roadmap_write_restrict_insert ON ppm_roadmap;
CREATE POLICY ppm_roadmap_write_restrict_insert ON ppm_roadmap AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['ppm.manage','ppm.plan']));
DROP POLICY IF EXISTS ppm_roadmap_write_restrict_update ON ppm_roadmap;
CREATE POLICY ppm_roadmap_write_restrict_update ON ppm_roadmap AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['ppm.manage','ppm.plan']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['ppm.manage','ppm.plan']));
DROP POLICY IF EXISTS ppm_roadmap_write_restrict_delete ON ppm_roadmap;
CREATE POLICY ppm_roadmap_write_restrict_delete ON ppm_roadmap AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['ppm.manage','ppm.plan']));
-- ----------------------------------------------------------------------------
-- Projects (PPM): ppm_settings  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS ppm_settings_write_restrict_insert ON ppm_settings;
CREATE POLICY ppm_settings_write_restrict_insert ON ppm_settings AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['ppm.manage','ppm.admin']));
DROP POLICY IF EXISTS ppm_settings_write_restrict_update ON ppm_settings;
CREATE POLICY ppm_settings_write_restrict_update ON ppm_settings AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['ppm.manage','ppm.admin']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['ppm.manage','ppm.admin']));
DROP POLICY IF EXISTS ppm_settings_write_restrict_delete ON ppm_settings;
CREATE POLICY ppm_settings_write_restrict_delete ON ppm_settings AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['ppm.manage','ppm.admin']));
-- ----------------------------------------------------------------------------
-- Projects (PPM): ppm_sprints  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS ppm_sprints_write_restrict_insert ON ppm_sprints;
CREATE POLICY ppm_sprints_write_restrict_insert ON ppm_sprints AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['ppm.manage','ppm.execute']));
DROP POLICY IF EXISTS ppm_sprints_write_restrict_update ON ppm_sprints;
CREATE POLICY ppm_sprints_write_restrict_update ON ppm_sprints AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['ppm.manage','ppm.execute']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['ppm.manage','ppm.execute']));
DROP POLICY IF EXISTS ppm_sprints_write_restrict_delete ON ppm_sprints;
CREATE POLICY ppm_sprints_write_restrict_delete ON ppm_sprints AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['ppm.manage','ppm.execute']));
-- ----------------------------------------------------------------------------
-- Projects (PPM): ppm_templates  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS ppm_templates_write_restrict_insert ON ppm_templates;
CREATE POLICY ppm_templates_write_restrict_insert ON ppm_templates AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['ppm.manage']));
DROP POLICY IF EXISTS ppm_templates_write_restrict_update ON ppm_templates;
CREATE POLICY ppm_templates_write_restrict_update ON ppm_templates AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['ppm.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['ppm.manage']));
DROP POLICY IF EXISTS ppm_templates_write_restrict_delete ON ppm_templates;
CREATE POLICY ppm_templates_write_restrict_delete ON ppm_templates AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['ppm.manage']));
-- ----------------------------------------------------------------------------
-- Projects (PPM): ppm_wbs  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS ppm_wbs_write_restrict_insert ON ppm_wbs;
CREATE POLICY ppm_wbs_write_restrict_insert ON ppm_wbs AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['ppm.manage','ppm.plan']));
DROP POLICY IF EXISTS ppm_wbs_write_restrict_update ON ppm_wbs;
CREATE POLICY ppm_wbs_write_restrict_update ON ppm_wbs AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['ppm.manage','ppm.plan']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['ppm.manage','ppm.plan']));
DROP POLICY IF EXISTS ppm_wbs_write_restrict_delete ON ppm_wbs;
CREATE POLICY ppm_wbs_write_restrict_delete ON ppm_wbs AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['ppm.manage','ppm.plan']));
-- ----------------------------------------------------------------------------
-- Procurement: procurement_insights  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS procurement_insights_write_restrict_insert ON procurement_insights;
CREATE POLICY procurement_insights_write_restrict_insert ON procurement_insights AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['procurement.manage','procurement.approve','procurement.view','procurement.suppliers']));
DROP POLICY IF EXISTS procurement_insights_write_restrict_update ON procurement_insights;
CREATE POLICY procurement_insights_write_restrict_update ON procurement_insights AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['procurement.manage','procurement.approve','procurement.view','procurement.suppliers']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['procurement.manage','procurement.approve','procurement.view','procurement.suppliers']));
DROP POLICY IF EXISTS procurement_insights_write_restrict_delete ON procurement_insights;
CREATE POLICY procurement_insights_write_restrict_delete ON procurement_insights AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['procurement.manage','procurement.approve','procurement.view','procurement.suppliers']));
-- ----------------------------------------------------------------------------
-- Profiles: profile_audit  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS profile_audit_write_restrict_insert ON profile_audit;
CREATE POLICY profile_audit_write_restrict_insert ON profile_audit AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['profile.manage','profile.security']));
DROP POLICY IF EXISTS profile_audit_write_restrict_update ON profile_audit;
CREATE POLICY profile_audit_write_restrict_update ON profile_audit AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['profile.manage','profile.security']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['profile.manage','profile.security']));
DROP POLICY IF EXISTS profile_audit_write_restrict_delete ON profile_audit;
CREATE POLICY profile_audit_write_restrict_delete ON profile_audit AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['profile.manage','profile.security']));
-- ----------------------------------------------------------------------------
-- Profiles: profile_certifications  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS profile_certifications_write_restrict_insert ON profile_certifications;
CREATE POLICY profile_certifications_write_restrict_insert ON profile_certifications AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['profile.self','profile.manage','profile.documents']));
DROP POLICY IF EXISTS profile_certifications_write_restrict_update ON profile_certifications;
CREATE POLICY profile_certifications_write_restrict_update ON profile_certifications AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['profile.self','profile.manage','profile.documents']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['profile.self','profile.manage','profile.documents']));
DROP POLICY IF EXISTS profile_certifications_write_restrict_delete ON profile_certifications;
CREATE POLICY profile_certifications_write_restrict_delete ON profile_certifications AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['profile.self','profile.manage','profile.documents']));
-- ----------------------------------------------------------------------------
-- Profiles: profile_completion  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS profile_completion_write_restrict_insert ON profile_completion;
CREATE POLICY profile_completion_write_restrict_insert ON profile_completion AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['profile.self','profile.manage']));
DROP POLICY IF EXISTS profile_completion_write_restrict_update ON profile_completion;
CREATE POLICY profile_completion_write_restrict_update ON profile_completion AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['profile.self','profile.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['profile.self','profile.manage']));
DROP POLICY IF EXISTS profile_completion_write_restrict_delete ON profile_completion;
CREATE POLICY profile_completion_write_restrict_delete ON profile_completion AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['profile.self','profile.manage']));
-- ----------------------------------------------------------------------------
-- Profiles: profile_consents  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS profile_consents_write_restrict_insert ON profile_consents;
CREATE POLICY profile_consents_write_restrict_insert ON profile_consents AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['profile.self','profile.manage','profile.security']));
DROP POLICY IF EXISTS profile_consents_write_restrict_update ON profile_consents;
CREATE POLICY profile_consents_write_restrict_update ON profile_consents AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['profile.self','profile.manage','profile.security']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['profile.self','profile.manage','profile.security']));
DROP POLICY IF EXISTS profile_consents_write_restrict_delete ON profile_consents;
CREATE POLICY profile_consents_write_restrict_delete ON profile_consents AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['profile.self','profile.manage','profile.security']));
-- ----------------------------------------------------------------------------
-- Profiles: profile_documents  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS profile_documents_write_restrict_insert ON profile_documents;
CREATE POLICY profile_documents_write_restrict_insert ON profile_documents AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['profile.self','profile.manage','profile.documents']));
DROP POLICY IF EXISTS profile_documents_write_restrict_update ON profile_documents;
CREATE POLICY profile_documents_write_restrict_update ON profile_documents AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['profile.self','profile.manage','profile.documents']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['profile.self','profile.manage','profile.documents']));
DROP POLICY IF EXISTS profile_documents_write_restrict_delete ON profile_documents;
CREATE POLICY profile_documents_write_restrict_delete ON profile_documents AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['profile.self','profile.manage','profile.documents']));
-- ----------------------------------------------------------------------------
-- Profiles: profile_projects  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS profile_projects_write_restrict_insert ON profile_projects;
CREATE POLICY profile_projects_write_restrict_insert ON profile_projects AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['profile.self','profile.manage']));
DROP POLICY IF EXISTS profile_projects_write_restrict_update ON profile_projects;
CREATE POLICY profile_projects_write_restrict_update ON profile_projects AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['profile.self','profile.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['profile.self','profile.manage']));
DROP POLICY IF EXISTS profile_projects_write_restrict_delete ON profile_projects;
CREATE POLICY profile_projects_write_restrict_delete ON profile_projects AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['profile.self','profile.manage']));
-- ----------------------------------------------------------------------------
-- Profiles: profile_requests  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS profile_requests_write_restrict_insert ON profile_requests;
CREATE POLICY profile_requests_write_restrict_insert ON profile_requests AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['profile.self','profile.manage','profile.manager']));
DROP POLICY IF EXISTS profile_requests_write_restrict_update ON profile_requests;
CREATE POLICY profile_requests_write_restrict_update ON profile_requests AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['profile.self','profile.manage','profile.manager']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['profile.self','profile.manage','profile.manager']));
DROP POLICY IF EXISTS profile_requests_write_restrict_delete ON profile_requests;
CREATE POLICY profile_requests_write_restrict_delete ON profile_requests AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['profile.self','profile.manage','profile.manager']));
-- ----------------------------------------------------------------------------
-- Profiles: profile_security_events  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS profile_security_events_write_restrict_insert ON profile_security_events;
CREATE POLICY profile_security_events_write_restrict_insert ON profile_security_events AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['profile.manage','profile.security']));
DROP POLICY IF EXISTS profile_security_events_write_restrict_update ON profile_security_events;
CREATE POLICY profile_security_events_write_restrict_update ON profile_security_events AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['profile.manage','profile.security']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['profile.manage','profile.security']));
DROP POLICY IF EXISTS profile_security_events_write_restrict_delete ON profile_security_events;
CREATE POLICY profile_security_events_write_restrict_delete ON profile_security_events AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['profile.manage','profile.security']));
-- ----------------------------------------------------------------------------
-- Profiles: profile_skills  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS profile_skills_write_restrict_insert ON profile_skills;
CREATE POLICY profile_skills_write_restrict_insert ON profile_skills AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['profile.self','profile.manage']));
DROP POLICY IF EXISTS profile_skills_write_restrict_update ON profile_skills;
CREATE POLICY profile_skills_write_restrict_update ON profile_skills AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['profile.self','profile.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['profile.self','profile.manage']));
DROP POLICY IF EXISTS profile_skills_write_restrict_delete ON profile_skills;
CREATE POLICY profile_skills_write_restrict_delete ON profile_skills AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['profile.self','profile.manage']));
-- ----------------------------------------------------------------------------
-- Profiles: profile_timeline  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS profile_timeline_write_restrict_insert ON profile_timeline;
CREATE POLICY profile_timeline_write_restrict_insert ON profile_timeline AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['profile.self','profile.manage']));
DROP POLICY IF EXISTS profile_timeline_write_restrict_update ON profile_timeline;
CREATE POLICY profile_timeline_write_restrict_update ON profile_timeline AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['profile.self','profile.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['profile.self','profile.manage']));
DROP POLICY IF EXISTS profile_timeline_write_restrict_delete ON profile_timeline;
CREATE POLICY profile_timeline_write_restrict_delete ON profile_timeline AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['profile.self','profile.manage']));
-- ----------------------------------------------------------------------------
-- Profiles: profile_visibility  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS profile_visibility_write_restrict_insert ON profile_visibility;
CREATE POLICY profile_visibility_write_restrict_insert ON profile_visibility AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['profile.self','profile.manage']));
DROP POLICY IF EXISTS profile_visibility_write_restrict_update ON profile_visibility;
CREATE POLICY profile_visibility_write_restrict_update ON profile_visibility AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['profile.self','profile.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['profile.self','profile.manage']));
DROP POLICY IF EXISTS profile_visibility_write_restrict_delete ON profile_visibility;
CREATE POLICY profile_visibility_write_restrict_delete ON profile_visibility AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['profile.self','profile.manage']));
-- ----------------------------------------------------------------------------
-- Print Platform: prt_ai_insights  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS prt_ai_insights_write_restrict_insert ON prt_ai_insights;
CREATE POLICY prt_ai_insights_write_restrict_insert ON prt_ai_insights AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['print.manage','print.ai','print.view']));
DROP POLICY IF EXISTS prt_ai_insights_write_restrict_update ON prt_ai_insights;
CREATE POLICY prt_ai_insights_write_restrict_update ON prt_ai_insights AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['print.manage','print.ai','print.view']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['print.manage','print.ai','print.view']));
DROP POLICY IF EXISTS prt_ai_insights_write_restrict_delete ON prt_ai_insights;
CREATE POLICY prt_ai_insights_write_restrict_delete ON prt_ai_insights AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['print.manage','print.ai','print.view']));
-- ----------------------------------------------------------------------------
-- Print Platform: prt_alerts  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS prt_alerts_write_restrict_insert ON prt_alerts;
CREATE POLICY prt_alerts_write_restrict_insert ON prt_alerts AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['print.manage','print.operate','print.security']));
DROP POLICY IF EXISTS prt_alerts_write_restrict_update ON prt_alerts;
CREATE POLICY prt_alerts_write_restrict_update ON prt_alerts AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['print.manage','print.operate','print.security']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['print.manage','print.operate','print.security']));
DROP POLICY IF EXISTS prt_alerts_write_restrict_delete ON prt_alerts;
CREATE POLICY prt_alerts_write_restrict_delete ON prt_alerts AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['print.manage','print.operate','print.security']));
-- ----------------------------------------------------------------------------
-- Print Platform: prt_audit  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS prt_audit_write_restrict_insert ON prt_audit;
CREATE POLICY prt_audit_write_restrict_insert ON prt_audit AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['print.manage','print.security','print.admin']));
DROP POLICY IF EXISTS prt_audit_write_restrict_update ON prt_audit;
CREATE POLICY prt_audit_write_restrict_update ON prt_audit AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['print.manage','print.security','print.admin']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['print.manage','print.security','print.admin']));
DROP POLICY IF EXISTS prt_audit_write_restrict_delete ON prt_audit;
CREATE POLICY prt_audit_write_restrict_delete ON prt_audit AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['print.manage','print.security','print.admin']));
-- ----------------------------------------------------------------------------
-- Print Platform: prt_automation_log  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS prt_automation_log_write_restrict_insert ON prt_automation_log;
CREATE POLICY prt_automation_log_write_restrict_insert ON prt_automation_log AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['print.manage','print.operate']));
DROP POLICY IF EXISTS prt_automation_log_write_restrict_update ON prt_automation_log;
CREATE POLICY prt_automation_log_write_restrict_update ON prt_automation_log AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['print.manage','print.operate']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['print.manage','print.operate']));
DROP POLICY IF EXISTS prt_automation_log_write_restrict_delete ON prt_automation_log;
CREATE POLICY prt_automation_log_write_restrict_delete ON prt_automation_log AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['print.manage','print.operate']));
-- ----------------------------------------------------------------------------
-- Print Platform: prt_queue  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS prt_queue_write_restrict_insert ON prt_queue;
CREATE POLICY prt_queue_write_restrict_insert ON prt_queue AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['print.manage','print.operate','print.submit']));
DROP POLICY IF EXISTS prt_queue_write_restrict_update ON prt_queue;
CREATE POLICY prt_queue_write_restrict_update ON prt_queue AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['print.manage','print.operate','print.submit']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['print.manage','print.operate','print.submit']));
DROP POLICY IF EXISTS prt_queue_write_restrict_delete ON prt_queue;
CREATE POLICY prt_queue_write_restrict_delete ON prt_queue AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['print.manage','print.operate','print.submit']));
-- ----------------------------------------------------------------------------
-- Print Platform: prt_service_logs  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS prt_service_logs_write_restrict_insert ON prt_service_logs;
CREATE POLICY prt_service_logs_write_restrict_insert ON prt_service_logs AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['print.manage','print.operate','print.security']));
DROP POLICY IF EXISTS prt_service_logs_write_restrict_update ON prt_service_logs;
CREATE POLICY prt_service_logs_write_restrict_update ON prt_service_logs AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['print.manage','print.operate','print.security']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['print.manage','print.operate','print.security']));
DROP POLICY IF EXISTS prt_service_logs_write_restrict_delete ON prt_service_logs;
CREATE POLICY prt_service_logs_write_restrict_delete ON prt_service_logs AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['print.manage','print.operate','print.security']));
-- ----------------------------------------------------------------------------
-- Sales: sales_ai_insights  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS sales_ai_insights_write_restrict_insert ON sales_ai_insights;
CREATE POLICY sales_ai_insights_write_restrict_insert ON sales_ai_insights AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['sales.manage','sales.ai','sales.view']));
DROP POLICY IF EXISTS sales_ai_insights_write_restrict_update ON sales_ai_insights;
CREATE POLICY sales_ai_insights_write_restrict_update ON sales_ai_insights AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['sales.manage','sales.ai','sales.view']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['sales.manage','sales.ai','sales.view']));
DROP POLICY IF EXISTS sales_ai_insights_write_restrict_delete ON sales_ai_insights;
CREATE POLICY sales_ai_insights_write_restrict_delete ON sales_ai_insights AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['sales.manage','sales.ai','sales.view']));
-- ----------------------------------------------------------------------------
-- Sales: sales_audit_log  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS sales_audit_log_write_restrict_insert ON sales_audit_log;
CREATE POLICY sales_audit_log_write_restrict_insert ON sales_audit_log AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['sales.manage','sales.admin']));
DROP POLICY IF EXISTS sales_audit_log_write_restrict_update ON sales_audit_log;
CREATE POLICY sales_audit_log_write_restrict_update ON sales_audit_log AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['sales.manage','sales.admin']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['sales.manage','sales.admin']));
DROP POLICY IF EXISTS sales_audit_log_write_restrict_delete ON sales_audit_log;
CREATE POLICY sales_audit_log_write_restrict_delete ON sales_audit_log AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['sales.manage','sales.admin']));
-- ----------------------------------------------------------------------------
-- Sales: sales_insights  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS sales_insights_write_restrict_insert ON sales_insights;
CREATE POLICY sales_insights_write_restrict_insert ON sales_insights AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['sales.manage','sales.ai','sales.view']));
DROP POLICY IF EXISTS sales_insights_write_restrict_update ON sales_insights;
CREATE POLICY sales_insights_write_restrict_update ON sales_insights AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['sales.manage','sales.ai','sales.view']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['sales.manage','sales.ai','sales.view']));
DROP POLICY IF EXISTS sales_insights_write_restrict_delete ON sales_insights;
CREATE POLICY sales_insights_write_restrict_delete ON sales_insights AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['sales.manage','sales.ai','sales.view']));
-- ----------------------------------------------------------------------------
-- Sales: sales_notifications  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS sales_notifications_write_restrict_insert ON sales_notifications;
CREATE POLICY sales_notifications_write_restrict_insert ON sales_notifications AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['sales.manage','sales.admin']));
DROP POLICY IF EXISTS sales_notifications_write_restrict_update ON sales_notifications;
CREATE POLICY sales_notifications_write_restrict_update ON sales_notifications AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['sales.manage','sales.admin']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['sales.manage','sales.admin']));
DROP POLICY IF EXISTS sales_notifications_write_restrict_delete ON sales_notifications;
CREATE POLICY sales_notifications_write_restrict_delete ON sales_notifications AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['sales.manage','sales.admin']));
-- ----------------------------------------------------------------------------
-- SCM: scm_insights  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS scm_insights_write_restrict_insert ON scm_insights;
CREATE POLICY scm_insights_write_restrict_insert ON scm_insights AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['scm.manage','scm.view','scm.risk','scm.sop']));
DROP POLICY IF EXISTS scm_insights_write_restrict_update ON scm_insights;
CREATE POLICY scm_insights_write_restrict_update ON scm_insights AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['scm.manage','scm.view','scm.risk','scm.sop']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['scm.manage','scm.view','scm.risk','scm.sop']));
DROP POLICY IF EXISTS scm_insights_write_restrict_delete ON scm_insights;
CREATE POLICY scm_insights_write_restrict_delete ON scm_insights AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['scm.manage','scm.view','scm.risk','scm.sop']));
-- ----------------------------------------------------------------------------
-- SCM: scm_kpi_snapshots  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS scm_kpi_snapshots_write_restrict_insert ON scm_kpi_snapshots;
CREATE POLICY scm_kpi_snapshots_write_restrict_insert ON scm_kpi_snapshots AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['scm.manage','scm.view']));
DROP POLICY IF EXISTS scm_kpi_snapshots_write_restrict_update ON scm_kpi_snapshots;
CREATE POLICY scm_kpi_snapshots_write_restrict_update ON scm_kpi_snapshots AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['scm.manage','scm.view']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['scm.manage','scm.view']));
DROP POLICY IF EXISTS scm_kpi_snapshots_write_restrict_delete ON scm_kpi_snapshots;
CREATE POLICY scm_kpi_snapshots_write_restrict_delete ON scm_kpi_snapshots AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['scm.manage','scm.view']));
-- ----------------------------------------------------------------------------
-- Service Desk: sd_messages  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS sd_messages_write_restrict_insert ON sd_messages;
CREATE POLICY sd_messages_write_restrict_insert ON sd_messages AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['sd.manage','sd.agent','sd.portal','sd.field']));
DROP POLICY IF EXISTS sd_messages_write_restrict_update ON sd_messages;
CREATE POLICY sd_messages_write_restrict_update ON sd_messages AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['sd.manage','sd.agent','sd.portal','sd.field']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['sd.manage','sd.agent','sd.portal','sd.field']));
DROP POLICY IF EXISTS sd_messages_write_restrict_delete ON sd_messages;
CREATE POLICY sd_messages_write_restrict_delete ON sd_messages AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['sd.manage','sd.agent','sd.portal','sd.field']));
-- ----------------------------------------------------------------------------
-- Service Desk: sd_ticket_events  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS sd_ticket_events_write_restrict_insert ON sd_ticket_events;
CREATE POLICY sd_ticket_events_write_restrict_insert ON sd_ticket_events AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['sd.manage','sd.agent','sd.field']));
DROP POLICY IF EXISTS sd_ticket_events_write_restrict_update ON sd_ticket_events;
CREATE POLICY sd_ticket_events_write_restrict_update ON sd_ticket_events AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['sd.manage','sd.agent','sd.field']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['sd.manage','sd.agent','sd.field']));
DROP POLICY IF EXISTS sd_ticket_events_write_restrict_delete ON sd_ticket_events;
CREATE POLICY sd_ticket_events_write_restrict_delete ON sd_ticket_events AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['sd.manage','sd.agent','sd.field']));
-- ----------------------------------------------------------------------------
-- Service Desk: sd_work_logs  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS sd_work_logs_write_restrict_insert ON sd_work_logs;
CREATE POLICY sd_work_logs_write_restrict_insert ON sd_work_logs AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['sd.manage','sd.agent','sd.field']));
DROP POLICY IF EXISTS sd_work_logs_write_restrict_update ON sd_work_logs;
CREATE POLICY sd_work_logs_write_restrict_update ON sd_work_logs AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['sd.manage','sd.agent','sd.field']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['sd.manage','sd.agent','sd.field']));
DROP POLICY IF EXISTS sd_work_logs_write_restrict_delete ON sd_work_logs;
CREATE POLICY sd_work_logs_write_restrict_delete ON sd_work_logs AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['sd.manage','sd.agent','sd.field']));
-- ----------------------------------------------------------------------------
-- Security: security_alerts  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS security_alerts_write_restrict_insert ON security_alerts;
CREATE POLICY security_alerts_write_restrict_insert ON security_alerts AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['iam.security','security.admin','iam.manage']));
DROP POLICY IF EXISTS security_alerts_write_restrict_update ON security_alerts;
CREATE POLICY security_alerts_write_restrict_update ON security_alerts AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['iam.security','security.admin','iam.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['iam.security','security.admin','iam.manage']));
DROP POLICY IF EXISTS security_alerts_write_restrict_delete ON security_alerts;
CREATE POLICY security_alerts_write_restrict_delete ON security_alerts AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['iam.security','security.admin','iam.manage']));
-- ----------------------------------------------------------------------------
-- Security: security_policies  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS security_policies_write_restrict_insert ON security_policies;
CREATE POLICY security_policies_write_restrict_insert ON security_policies AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['iam.security','security.admin','iam.manage']));
DROP POLICY IF EXISTS security_policies_write_restrict_update ON security_policies;
CREATE POLICY security_policies_write_restrict_update ON security_policies AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['iam.security','security.admin','iam.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['iam.security','security.admin','iam.manage']));
DROP POLICY IF EXISTS security_policies_write_restrict_delete ON security_policies;
CREATE POLICY security_policies_write_restrict_delete ON security_policies AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['iam.security','security.admin','iam.manage']));
-- ----------------------------------------------------------------------------
-- SOP: sop_cycles  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS sop_cycles_write_restrict_insert ON sop_cycles;
CREATE POLICY sop_cycles_write_restrict_insert ON sop_cycles AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['scm.manage','scm.sop','scm.risk']));
DROP POLICY IF EXISTS sop_cycles_write_restrict_update ON sop_cycles;
CREATE POLICY sop_cycles_write_restrict_update ON sop_cycles AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['scm.manage','scm.sop','scm.risk']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['scm.manage','scm.sop','scm.risk']));
DROP POLICY IF EXISTS sop_cycles_write_restrict_delete ON sop_cycles;
CREATE POLICY sop_cycles_write_restrict_delete ON sop_cycles AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['scm.manage','scm.sop','scm.risk']));
-- ----------------------------------------------------------------------------
-- SOP: sop_line_items  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS sop_line_items_write_restrict_insert ON sop_line_items;
CREATE POLICY sop_line_items_write_restrict_insert ON sop_line_items AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['scm.manage','scm.sop','scm.risk']));
DROP POLICY IF EXISTS sop_line_items_write_restrict_update ON sop_line_items;
CREATE POLICY sop_line_items_write_restrict_update ON sop_line_items AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['scm.manage','scm.sop','scm.risk']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['scm.manage','scm.sop','scm.risk']));
DROP POLICY IF EXISTS sop_line_items_write_restrict_delete ON sop_line_items;
CREATE POLICY sop_line_items_write_restrict_delete ON sop_line_items AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['scm.manage','scm.sop','scm.risk']));
-- ----------------------------------------------------------------------------
-- Supplier Relationship Management: srm_audit_log  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS srm_audit_log_write_restrict_insert ON srm_audit_log;
CREATE POLICY srm_audit_log_write_restrict_insert ON srm_audit_log AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['srm.manage','srm.admin']));
DROP POLICY IF EXISTS srm_audit_log_write_restrict_update ON srm_audit_log;
CREATE POLICY srm_audit_log_write_restrict_update ON srm_audit_log AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['srm.manage','srm.admin']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['srm.manage','srm.admin']));
DROP POLICY IF EXISTS srm_audit_log_write_restrict_delete ON srm_audit_log;
CREATE POLICY srm_audit_log_write_restrict_delete ON srm_audit_log AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['srm.manage','srm.admin']));
-- ----------------------------------------------------------------------------
-- Supplier Relationship Management: srm_insights  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS srm_insights_write_restrict_insert ON srm_insights;
CREATE POLICY srm_insights_write_restrict_insert ON srm_insights AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['srm.manage','srm.ai','srm.view']));
DROP POLICY IF EXISTS srm_insights_write_restrict_update ON srm_insights;
CREATE POLICY srm_insights_write_restrict_update ON srm_insights AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['srm.manage','srm.ai','srm.view']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['srm.manage','srm.ai','srm.view']));
DROP POLICY IF EXISTS srm_insights_write_restrict_delete ON srm_insights;
CREATE POLICY srm_insights_write_restrict_delete ON srm_insights AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['srm.manage','srm.ai','srm.view']));
-- ----------------------------------------------------------------------------
-- Supplier Relationship Management: srm_merge_log  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS srm_merge_log_write_restrict_insert ON srm_merge_log;
CREATE POLICY srm_merge_log_write_restrict_insert ON srm_merge_log AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['srm.manage','srm.admin']));
DROP POLICY IF EXISTS srm_merge_log_write_restrict_update ON srm_merge_log;
CREATE POLICY srm_merge_log_write_restrict_update ON srm_merge_log AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['srm.manage','srm.admin']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['srm.manage','srm.admin']));
DROP POLICY IF EXISTS srm_merge_log_write_restrict_delete ON srm_merge_log;
CREATE POLICY srm_merge_log_write_restrict_delete ON srm_merge_log AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['srm.manage','srm.admin']));
-- ----------------------------------------------------------------------------
-- Talent Acquisition: ta_agencies  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS ta_agencies_write_restrict_insert ON ta_agencies;
CREATE POLICY ta_agencies_write_restrict_insert ON ta_agencies AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['ta.manage','ta.admin','ta.recruit']));
DROP POLICY IF EXISTS ta_agencies_write_restrict_update ON ta_agencies;
CREATE POLICY ta_agencies_write_restrict_update ON ta_agencies AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['ta.manage','ta.admin','ta.recruit']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['ta.manage','ta.admin','ta.recruit']));
DROP POLICY IF EXISTS ta_agencies_write_restrict_delete ON ta_agencies;
CREATE POLICY ta_agencies_write_restrict_delete ON ta_agencies AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['ta.manage','ta.admin','ta.recruit']));
-- ----------------------------------------------------------------------------
-- Talent Acquisition: ta_ai_insights  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS ta_ai_insights_write_restrict_insert ON ta_ai_insights;
CREATE POLICY ta_ai_insights_write_restrict_insert ON ta_ai_insights AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['ta.manage','ta.ai','ta.view']));
DROP POLICY IF EXISTS ta_ai_insights_write_restrict_update ON ta_ai_insights;
CREATE POLICY ta_ai_insights_write_restrict_update ON ta_ai_insights AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['ta.manage','ta.ai','ta.view']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['ta.manage','ta.ai','ta.view']));
DROP POLICY IF EXISTS ta_ai_insights_write_restrict_delete ON ta_ai_insights;
CREATE POLICY ta_ai_insights_write_restrict_delete ON ta_ai_insights AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['ta.manage','ta.ai','ta.view']));
-- ----------------------------------------------------------------------------
-- Talent Acquisition: ta_assessment_attempts  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS ta_assessment_attempts_write_restrict_insert ON ta_assessment_attempts;
CREATE POLICY ta_assessment_attempts_write_restrict_insert ON ta_assessment_attempts AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['ta.manage','ta.recruit','ta.admin']));
DROP POLICY IF EXISTS ta_assessment_attempts_write_restrict_update ON ta_assessment_attempts;
CREATE POLICY ta_assessment_attempts_write_restrict_update ON ta_assessment_attempts AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['ta.manage','ta.recruit','ta.admin']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['ta.manage','ta.recruit','ta.admin']));
DROP POLICY IF EXISTS ta_assessment_attempts_write_restrict_delete ON ta_assessment_attempts;
CREATE POLICY ta_assessment_attempts_write_restrict_delete ON ta_assessment_attempts AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['ta.manage','ta.recruit','ta.admin']));
-- ----------------------------------------------------------------------------
-- Talent Acquisition: ta_audit_log  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS ta_audit_log_write_restrict_insert ON ta_audit_log;
CREATE POLICY ta_audit_log_write_restrict_insert ON ta_audit_log AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['ta.manage','ta.admin']));
DROP POLICY IF EXISTS ta_audit_log_write_restrict_update ON ta_audit_log;
CREATE POLICY ta_audit_log_write_restrict_update ON ta_audit_log AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['ta.manage','ta.admin']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['ta.manage','ta.admin']));
DROP POLICY IF EXISTS ta_audit_log_write_restrict_delete ON ta_audit_log;
CREATE POLICY ta_audit_log_write_restrict_delete ON ta_audit_log AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['ta.manage','ta.admin']));
-- ----------------------------------------------------------------------------
-- Talent Acquisition: ta_campus_events  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS ta_campus_events_write_restrict_insert ON ta_campus_events;
CREATE POLICY ta_campus_events_write_restrict_insert ON ta_campus_events AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['ta.manage','ta.recruit']));
DROP POLICY IF EXISTS ta_campus_events_write_restrict_update ON ta_campus_events;
CREATE POLICY ta_campus_events_write_restrict_update ON ta_campus_events AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['ta.manage','ta.recruit']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['ta.manage','ta.recruit']));
DROP POLICY IF EXISTS ta_campus_events_write_restrict_delete ON ta_campus_events;
CREATE POLICY ta_campus_events_write_restrict_delete ON ta_campus_events AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['ta.manage','ta.recruit']));
-- ----------------------------------------------------------------------------
-- Talent Acquisition: ta_documents  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS ta_documents_write_restrict_insert ON ta_documents;
CREATE POLICY ta_documents_write_restrict_insert ON ta_documents AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['ta.manage','ta.recruit']));
DROP POLICY IF EXISTS ta_documents_write_restrict_update ON ta_documents;
CREATE POLICY ta_documents_write_restrict_update ON ta_documents AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['ta.manage','ta.recruit']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['ta.manage','ta.recruit']));
DROP POLICY IF EXISTS ta_documents_write_restrict_delete ON ta_documents;
CREATE POLICY ta_documents_write_restrict_delete ON ta_documents AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['ta.manage','ta.recruit']));
-- ----------------------------------------------------------------------------
-- Talent Acquisition: ta_headcount_plans  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS ta_headcount_plans_write_restrict_insert ON ta_headcount_plans;
CREATE POLICY ta_headcount_plans_write_restrict_insert ON ta_headcount_plans AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['ta.manage','ta.admin','ta.approve']));
DROP POLICY IF EXISTS ta_headcount_plans_write_restrict_update ON ta_headcount_plans;
CREATE POLICY ta_headcount_plans_write_restrict_update ON ta_headcount_plans AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['ta.manage','ta.admin','ta.approve']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['ta.manage','ta.admin','ta.approve']));
DROP POLICY IF EXISTS ta_headcount_plans_write_restrict_delete ON ta_headcount_plans;
CREATE POLICY ta_headcount_plans_write_restrict_delete ON ta_headcount_plans AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['ta.manage','ta.admin','ta.approve']));
-- ----------------------------------------------------------------------------
-- Talent Acquisition: ta_job_library  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS ta_job_library_write_restrict_insert ON ta_job_library;
CREATE POLICY ta_job_library_write_restrict_insert ON ta_job_library AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['ta.manage','ta.recruit']));
DROP POLICY IF EXISTS ta_job_library_write_restrict_update ON ta_job_library;
CREATE POLICY ta_job_library_write_restrict_update ON ta_job_library AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['ta.manage','ta.recruit']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['ta.manage','ta.recruit']));
DROP POLICY IF EXISTS ta_job_library_write_restrict_delete ON ta_job_library;
CREATE POLICY ta_job_library_write_restrict_delete ON ta_job_library AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['ta.manage','ta.recruit']));
-- ----------------------------------------------------------------------------
-- Talent Acquisition: ta_medical_exams  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS ta_medical_exams_write_restrict_insert ON ta_medical_exams;
CREATE POLICY ta_medical_exams_write_restrict_insert ON ta_medical_exams AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['ta.manage','ta.recruit']));
DROP POLICY IF EXISTS ta_medical_exams_write_restrict_update ON ta_medical_exams;
CREATE POLICY ta_medical_exams_write_restrict_update ON ta_medical_exams AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['ta.manage','ta.recruit']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['ta.manage','ta.recruit']));
DROP POLICY IF EXISTS ta_medical_exams_write_restrict_delete ON ta_medical_exams;
CREATE POLICY ta_medical_exams_write_restrict_delete ON ta_medical_exams AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['ta.manage','ta.recruit']));
-- ----------------------------------------------------------------------------
-- Talent Acquisition: ta_onboarding_tasks  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS ta_onboarding_tasks_write_restrict_insert ON ta_onboarding_tasks;
CREATE POLICY ta_onboarding_tasks_write_restrict_insert ON ta_onboarding_tasks AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['ta.manage','ta.recruit','ta.admin']));
DROP POLICY IF EXISTS ta_onboarding_tasks_write_restrict_update ON ta_onboarding_tasks;
CREATE POLICY ta_onboarding_tasks_write_restrict_update ON ta_onboarding_tasks AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['ta.manage','ta.recruit','ta.admin']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['ta.manage','ta.recruit','ta.admin']));
DROP POLICY IF EXISTS ta_onboarding_tasks_write_restrict_delete ON ta_onboarding_tasks;
CREATE POLICY ta_onboarding_tasks_write_restrict_delete ON ta_onboarding_tasks AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['ta.manage','ta.recruit','ta.admin']));
-- ----------------------------------------------------------------------------
-- Talent Acquisition: ta_pipeline_stages  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS ta_pipeline_stages_write_restrict_insert ON ta_pipeline_stages;
CREATE POLICY ta_pipeline_stages_write_restrict_insert ON ta_pipeline_stages AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['ta.manage','ta.recruit']));
DROP POLICY IF EXISTS ta_pipeline_stages_write_restrict_update ON ta_pipeline_stages;
CREATE POLICY ta_pipeline_stages_write_restrict_update ON ta_pipeline_stages AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['ta.manage','ta.recruit']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['ta.manage','ta.recruit']));
DROP POLICY IF EXISTS ta_pipeline_stages_write_restrict_delete ON ta_pipeline_stages;
CREATE POLICY ta_pipeline_stages_write_restrict_delete ON ta_pipeline_stages AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['ta.manage','ta.recruit']));
-- ----------------------------------------------------------------------------
-- Talent Acquisition: ta_references  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS ta_references_write_restrict_insert ON ta_references;
CREATE POLICY ta_references_write_restrict_insert ON ta_references AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['ta.manage','ta.recruit']));
DROP POLICY IF EXISTS ta_references_write_restrict_update ON ta_references;
CREATE POLICY ta_references_write_restrict_update ON ta_references AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['ta.manage','ta.recruit']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['ta.manage','ta.recruit']));
DROP POLICY IF EXISTS ta_references_write_restrict_delete ON ta_references;
CREATE POLICY ta_references_write_restrict_delete ON ta_references AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['ta.manage','ta.recruit']));
-- ----------------------------------------------------------------------------
-- Talent Acquisition: ta_referrals  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS ta_referrals_write_restrict_insert ON ta_referrals;
CREATE POLICY ta_referrals_write_restrict_insert ON ta_referrals AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['ta.manage','ta.recruit']));
DROP POLICY IF EXISTS ta_referrals_write_restrict_update ON ta_referrals;
CREATE POLICY ta_referrals_write_restrict_update ON ta_referrals AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['ta.manage','ta.recruit']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['ta.manage','ta.recruit']));
DROP POLICY IF EXISTS ta_referrals_write_restrict_delete ON ta_referrals;
CREATE POLICY ta_referrals_write_restrict_delete ON ta_referrals AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['ta.manage','ta.recruit']));
-- ----------------------------------------------------------------------------
-- Talent Acquisition: ta_settings  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS ta_settings_write_restrict_insert ON ta_settings;
CREATE POLICY ta_settings_write_restrict_insert ON ta_settings AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['ta.manage','ta.admin']));
DROP POLICY IF EXISTS ta_settings_write_restrict_update ON ta_settings;
CREATE POLICY ta_settings_write_restrict_update ON ta_settings AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['ta.manage','ta.admin']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['ta.manage','ta.admin']));
DROP POLICY IF EXISTS ta_settings_write_restrict_delete ON ta_settings;
CREATE POLICY ta_settings_write_restrict_delete ON ta_settings AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['ta.manage','ta.admin']));
-- ----------------------------------------------------------------------------
-- Talent Acquisition: ta_talent_pool  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS ta_talent_pool_write_restrict_insert ON ta_talent_pool;
CREATE POLICY ta_talent_pool_write_restrict_insert ON ta_talent_pool AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['ta.manage','ta.recruit']));
DROP POLICY IF EXISTS ta_talent_pool_write_restrict_update ON ta_talent_pool;
CREATE POLICY ta_talent_pool_write_restrict_update ON ta_talent_pool AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['ta.manage','ta.recruit']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['ta.manage','ta.recruit']));
DROP POLICY IF EXISTS ta_talent_pool_write_restrict_delete ON ta_talent_pool;
CREATE POLICY ta_talent_pool_write_restrict_delete ON ta_talent_pool AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['ta.manage','ta.recruit']));
-- ----------------------------------------------------------------------------
-- Identity: user_role_changes  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS user_role_changes_write_restrict_insert ON user_role_changes;
CREATE POLICY user_role_changes_write_restrict_insert ON user_role_changes AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['iam.manage','iam.roles','iam.governance']));
DROP POLICY IF EXISTS user_role_changes_write_restrict_update ON user_role_changes;
CREATE POLICY user_role_changes_write_restrict_update ON user_role_changes AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['iam.manage','iam.roles','iam.governance']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['iam.manage','iam.roles','iam.governance']));
DROP POLICY IF EXISTS user_role_changes_write_restrict_delete ON user_role_changes;
CREATE POLICY user_role_changes_write_restrict_delete ON user_role_changes AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['iam.manage','iam.roles','iam.governance']));
-- ----------------------------------------------------------------------------
-- Workforce Identity: wid_access_assignments  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS wid_access_assignments_write_restrict_insert ON wid_access_assignments;
CREATE POLICY wid_access_assignments_write_restrict_insert ON wid_access_assignments AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['wid.manage','wid.access']));
DROP POLICY IF EXISTS wid_access_assignments_write_restrict_update ON wid_access_assignments;
CREATE POLICY wid_access_assignments_write_restrict_update ON wid_access_assignments AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['wid.manage','wid.access']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['wid.manage','wid.access']));
DROP POLICY IF EXISTS wid_access_assignments_write_restrict_delete ON wid_access_assignments;
CREATE POLICY wid_access_assignments_write_restrict_delete ON wid_access_assignments AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['wid.manage','wid.access']));
-- ----------------------------------------------------------------------------
-- Workforce Identity: wid_access_events  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS wid_access_events_write_restrict_insert ON wid_access_events;
CREATE POLICY wid_access_events_write_restrict_insert ON wid_access_events AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['wid.manage','wid.access']));
DROP POLICY IF EXISTS wid_access_events_write_restrict_update ON wid_access_events;
CREATE POLICY wid_access_events_write_restrict_update ON wid_access_events AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['wid.manage','wid.access']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['wid.manage','wid.access']));
DROP POLICY IF EXISTS wid_access_events_write_restrict_delete ON wid_access_events;
CREATE POLICY wid_access_events_write_restrict_delete ON wid_access_events AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['wid.manage','wid.access']));
-- ----------------------------------------------------------------------------
-- Workforce Identity: wid_access_profiles  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS wid_access_profiles_write_restrict_insert ON wid_access_profiles;
CREATE POLICY wid_access_profiles_write_restrict_insert ON wid_access_profiles AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['wid.manage','wid.access']));
DROP POLICY IF EXISTS wid_access_profiles_write_restrict_update ON wid_access_profiles;
CREATE POLICY wid_access_profiles_write_restrict_update ON wid_access_profiles AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['wid.manage','wid.access']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['wid.manage','wid.access']));
DROP POLICY IF EXISTS wid_access_profiles_write_restrict_delete ON wid_access_profiles;
CREATE POLICY wid_access_profiles_write_restrict_delete ON wid_access_profiles AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['wid.manage','wid.access']));
-- ----------------------------------------------------------------------------
-- Workforce Identity: wid_access_zones  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS wid_access_zones_write_restrict_insert ON wid_access_zones;
CREATE POLICY wid_access_zones_write_restrict_insert ON wid_access_zones AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['wid.manage','wid.access']));
DROP POLICY IF EXISTS wid_access_zones_write_restrict_update ON wid_access_zones;
CREATE POLICY wid_access_zones_write_restrict_update ON wid_access_zones AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['wid.manage','wid.access']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['wid.manage','wid.access']));
DROP POLICY IF EXISTS wid_access_zones_write_restrict_delete ON wid_access_zones;
CREATE POLICY wid_access_zones_write_restrict_delete ON wid_access_zones AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['wid.manage','wid.access']));
-- ----------------------------------------------------------------------------
-- Workforce Identity: wid_ai_design_logs  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS wid_ai_design_logs_write_restrict_insert ON wid_ai_design_logs;
CREATE POLICY wid_ai_design_logs_write_restrict_insert ON wid_ai_design_logs AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['wid.manage','wid.design']));
DROP POLICY IF EXISTS wid_ai_design_logs_write_restrict_update ON wid_ai_design_logs;
CREATE POLICY wid_ai_design_logs_write_restrict_update ON wid_ai_design_logs AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['wid.manage','wid.design']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['wid.manage','wid.design']));
DROP POLICY IF EXISTS wid_ai_design_logs_write_restrict_delete ON wid_ai_design_logs;
CREATE POLICY wid_ai_design_logs_write_restrict_delete ON wid_ai_design_logs AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['wid.manage','wid.design']));
-- ----------------------------------------------------------------------------
-- Workforce Identity: wid_biometric_enrollments  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS wid_biometric_enrollments_write_restrict_insert ON wid_biometric_enrollments;
CREATE POLICY wid_biometric_enrollments_write_restrict_insert ON wid_biometric_enrollments AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['wid.manage','wid.biometrics']));
DROP POLICY IF EXISTS wid_biometric_enrollments_write_restrict_update ON wid_biometric_enrollments;
CREATE POLICY wid_biometric_enrollments_write_restrict_update ON wid_biometric_enrollments AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['wid.manage','wid.biometrics']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['wid.manage','wid.biometrics']));
DROP POLICY IF EXISTS wid_biometric_enrollments_write_restrict_delete ON wid_biometric_enrollments;
CREATE POLICY wid_biometric_enrollments_write_restrict_delete ON wid_biometric_enrollments AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['wid.manage','wid.biometrics']));
-- ----------------------------------------------------------------------------
-- Workforce Identity: wid_card_brands  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS wid_card_brands_write_restrict_insert ON wid_card_brands;
CREATE POLICY wid_card_brands_write_restrict_insert ON wid_card_brands AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['wid.manage','wid.design']));
DROP POLICY IF EXISTS wid_card_brands_write_restrict_update ON wid_card_brands;
CREATE POLICY wid_card_brands_write_restrict_update ON wid_card_brands AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['wid.manage','wid.design']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['wid.manage','wid.design']));
DROP POLICY IF EXISTS wid_card_brands_write_restrict_delete ON wid_card_brands;
CREATE POLICY wid_card_brands_write_restrict_delete ON wid_card_brands AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['wid.manage','wid.design']));
-- ----------------------------------------------------------------------------
-- Workforce Identity: wid_card_incidents  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS wid_card_incidents_write_restrict_insert ON wid_card_incidents;
CREATE POLICY wid_card_incidents_write_restrict_insert ON wid_card_incidents AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['wid.manage','wid.security']));
DROP POLICY IF EXISTS wid_card_incidents_write_restrict_update ON wid_card_incidents;
CREATE POLICY wid_card_incidents_write_restrict_update ON wid_card_incidents AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['wid.manage','wid.security']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['wid.manage','wid.security']));
DROP POLICY IF EXISTS wid_card_incidents_write_restrict_delete ON wid_card_incidents;
CREATE POLICY wid_card_incidents_write_restrict_delete ON wid_card_incidents AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['wid.manage','wid.security']));
-- ----------------------------------------------------------------------------
-- Workforce Identity: wid_card_inventory  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS wid_card_inventory_write_restrict_insert ON wid_card_inventory;
CREATE POLICY wid_card_inventory_write_restrict_insert ON wid_card_inventory AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['wid.manage','wid.access']));
DROP POLICY IF EXISTS wid_card_inventory_write_restrict_update ON wid_card_inventory;
CREATE POLICY wid_card_inventory_write_restrict_update ON wid_card_inventory AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['wid.manage','wid.access']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['wid.manage','wid.access']));
DROP POLICY IF EXISTS wid_card_inventory_write_restrict_delete ON wid_card_inventory;
CREATE POLICY wid_card_inventory_write_restrict_delete ON wid_card_inventory AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['wid.manage','wid.access']));
-- ----------------------------------------------------------------------------
-- Workforce Identity: wid_card_templates  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS wid_card_templates_write_restrict_insert ON wid_card_templates;
CREATE POLICY wid_card_templates_write_restrict_insert ON wid_card_templates AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['wid.manage','wid.design']));
DROP POLICY IF EXISTS wid_card_templates_write_restrict_update ON wid_card_templates;
CREATE POLICY wid_card_templates_write_restrict_update ON wid_card_templates AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['wid.manage','wid.design']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['wid.manage','wid.design']));
DROP POLICY IF EXISTS wid_card_templates_write_restrict_delete ON wid_card_templates;
CREATE POLICY wid_card_templates_write_restrict_delete ON wid_card_templates AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['wid.manage','wid.design']));
-- ----------------------------------------------------------------------------
-- Workforce Identity: wid_credentials  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS wid_credentials_write_restrict_insert ON wid_credentials;
CREATE POLICY wid_credentials_write_restrict_insert ON wid_credentials AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['wid.manage','wid.verify']));
DROP POLICY IF EXISTS wid_credentials_write_restrict_update ON wid_credentials;
CREATE POLICY wid_credentials_write_restrict_update ON wid_credentials AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['wid.manage','wid.verify']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['wid.manage','wid.verify']));
DROP POLICY IF EXISTS wid_credentials_write_restrict_delete ON wid_credentials;
CREATE POLICY wid_credentials_write_restrict_delete ON wid_credentials AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['wid.manage','wid.verify']));
-- ----------------------------------------------------------------------------
-- Workforce Identity: wid_id_sequences  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS wid_id_sequences_write_restrict_insert ON wid_id_sequences;
CREATE POLICY wid_id_sequences_write_restrict_insert ON wid_id_sequences AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['wid.manage','wid.design']));
DROP POLICY IF EXISTS wid_id_sequences_write_restrict_update ON wid_id_sequences;
CREATE POLICY wid_id_sequences_write_restrict_update ON wid_id_sequences AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['wid.manage','wid.design']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['wid.manage','wid.design']));
DROP POLICY IF EXISTS wid_id_sequences_write_restrict_delete ON wid_id_sequences;
CREATE POLICY wid_id_sequences_write_restrict_delete ON wid_id_sequences AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['wid.manage','wid.design']));
-- ----------------------------------------------------------------------------
-- Workforce Identity: wid_identities  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS wid_identities_write_restrict_insert ON wid_identities;
CREATE POLICY wid_identities_write_restrict_insert ON wid_identities AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['wid.manage','wid.verify']));
DROP POLICY IF EXISTS wid_identities_write_restrict_update ON wid_identities;
CREATE POLICY wid_identities_write_restrict_update ON wid_identities AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['wid.manage','wid.verify']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['wid.manage','wid.verify']));
DROP POLICY IF EXISTS wid_identities_write_restrict_delete ON wid_identities;
CREATE POLICY wid_identities_write_restrict_delete ON wid_identities AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['wid.manage','wid.verify']));
-- ----------------------------------------------------------------------------
-- Workforce Identity: wid_mobile_badges  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS wid_mobile_badges_write_restrict_insert ON wid_mobile_badges;
CREATE POLICY wid_mobile_badges_write_restrict_insert ON wid_mobile_badges AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['wid.manage','wid.verify']));
DROP POLICY IF EXISTS wid_mobile_badges_write_restrict_update ON wid_mobile_badges;
CREATE POLICY wid_mobile_badges_write_restrict_update ON wid_mobile_badges AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['wid.manage','wid.verify']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['wid.manage','wid.verify']));
DROP POLICY IF EXISTS wid_mobile_badges_write_restrict_delete ON wid_mobile_badges;
CREATE POLICY wid_mobile_badges_write_restrict_delete ON wid_mobile_badges AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['wid.manage','wid.verify']));
-- ----------------------------------------------------------------------------
-- Workforce Identity: wid_print_history  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS wid_print_history_write_restrict_insert ON wid_print_history;
CREATE POLICY wid_print_history_write_restrict_insert ON wid_print_history AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['wid.manage','wid.print']));
DROP POLICY IF EXISTS wid_print_history_write_restrict_update ON wid_print_history;
CREATE POLICY wid_print_history_write_restrict_update ON wid_print_history AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['wid.manage','wid.print']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['wid.manage','wid.print']));
DROP POLICY IF EXISTS wid_print_history_write_restrict_delete ON wid_print_history;
CREATE POLICY wid_print_history_write_restrict_delete ON wid_print_history AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['wid.manage','wid.print']));
-- ----------------------------------------------------------------------------
-- Workforce Identity: wid_print_jobs  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS wid_print_jobs_write_restrict_insert ON wid_print_jobs;
CREATE POLICY wid_print_jobs_write_restrict_insert ON wid_print_jobs AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['wid.manage','wid.print']));
DROP POLICY IF EXISTS wid_print_jobs_write_restrict_update ON wid_print_jobs;
CREATE POLICY wid_print_jobs_write_restrict_update ON wid_print_jobs AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['wid.manage','wid.print']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['wid.manage','wid.print']));
DROP POLICY IF EXISTS wid_print_jobs_write_restrict_delete ON wid_print_jobs;
CREATE POLICY wid_print_jobs_write_restrict_delete ON wid_print_jobs AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['wid.manage','wid.print']));
-- ----------------------------------------------------------------------------
-- Workforce Identity: wid_template_versions  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS wid_template_versions_write_restrict_insert ON wid_template_versions;
CREATE POLICY wid_template_versions_write_restrict_insert ON wid_template_versions AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['wid.manage','wid.design']));
DROP POLICY IF EXISTS wid_template_versions_write_restrict_update ON wid_template_versions;
CREATE POLICY wid_template_versions_write_restrict_update ON wid_template_versions AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['wid.manage','wid.design']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['wid.manage','wid.design']));
DROP POLICY IF EXISTS wid_template_versions_write_restrict_delete ON wid_template_versions;
CREATE POLICY wid_template_versions_write_restrict_delete ON wid_template_versions AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['wid.manage','wid.design']));
-- ----------------------------------------------------------------------------
-- Workforce Identity: wid_verification_logs  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS wid_verification_logs_write_restrict_insert ON wid_verification_logs;
CREATE POLICY wid_verification_logs_write_restrict_insert ON wid_verification_logs AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['wid.manage']));
DROP POLICY IF EXISTS wid_verification_logs_write_restrict_update ON wid_verification_logs;
CREATE POLICY wid_verification_logs_write_restrict_update ON wid_verification_logs AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['wid.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['wid.manage']));
DROP POLICY IF EXISTS wid_verification_logs_write_restrict_delete ON wid_verification_logs;
CREATE POLICY wid_verification_logs_write_restrict_delete ON wid_verification_logs AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['wid.manage']));
-- ----------------------------------------------------------------------------
-- Workforce Identity: wid_workflow_runs  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS wid_workflow_runs_write_restrict_insert ON wid_workflow_runs;
CREATE POLICY wid_workflow_runs_write_restrict_insert ON wid_workflow_runs AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['wid.manage','wid.verify']));
DROP POLICY IF EXISTS wid_workflow_runs_write_restrict_update ON wid_workflow_runs;
CREATE POLICY wid_workflow_runs_write_restrict_update ON wid_workflow_runs AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['wid.manage','wid.verify']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['wid.manage','wid.verify']));
DROP POLICY IF EXISTS wid_workflow_runs_write_restrict_delete ON wid_workflow_runs;
CREATE POLICY wid_workflow_runs_write_restrict_delete ON wid_workflow_runs AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['wid.manage','wid.verify']));
-- ----------------------------------------------------------------------------
-- Workforce Identity: wid_workflows  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS wid_workflows_write_restrict_insert ON wid_workflows;
CREATE POLICY wid_workflows_write_restrict_insert ON wid_workflows AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['wid.manage','wid.verify']));
DROP POLICY IF EXISTS wid_workflows_write_restrict_update ON wid_workflows;
CREATE POLICY wid_workflows_write_restrict_update ON wid_workflows AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['wid.manage','wid.verify']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['wid.manage','wid.verify']));
DROP POLICY IF EXISTS wid_workflows_write_restrict_delete ON wid_workflows;
CREATE POLICY wid_workflows_write_restrict_delete ON wid_workflows AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['wid.manage','wid.verify']));
-- ----------------------------------------------------------------------------
-- Workforce: workforce_insights  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS workforce_insights_write_restrict_insert ON workforce_insights;
CREATE POLICY workforce_insights_write_restrict_insert ON workforce_insights AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['wfm.manage','wfm.view','wfm.approve','wfm.field','wfm.safety']));
DROP POLICY IF EXISTS workforce_insights_write_restrict_update ON workforce_insights;
CREATE POLICY workforce_insights_write_restrict_update ON workforce_insights AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['wfm.manage','wfm.view','wfm.approve','wfm.field','wfm.safety']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['wfm.manage','wfm.view','wfm.approve','wfm.field','wfm.safety']));
DROP POLICY IF EXISTS workforce_insights_write_restrict_delete ON workforce_insights;
CREATE POLICY workforce_insights_write_restrict_delete ON workforce_insights AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['wfm.manage','wfm.view','wfm.approve','wfm.field','wfm.safety']));
