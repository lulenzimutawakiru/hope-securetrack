-- Hope SecureTrack v1.0 - Row Level Security Policies

-- Enable RLS on all tables
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE factories ENABLE ROW LEVEL SECURITY;
ALTER TABLE branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE warehouses ENABLE ROW LEVEL SECURITY;
ALTER TABLE warehouse_racks ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_machines ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE qr_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE reams ENABLE ROW LEVEL SECURITY;
ALTER TABLE cartons ENABLE ROW LEVEL SECURITY;
ALTER TABLE printers ENABLE ROW LEVEL SECURITY;
ALTER TABLE print_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE print_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE print_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE distributors ENABLE ROW LEVEL SECURITY;
ALTER TABLE retailers ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE verification_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE counterfeit_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE fraud_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

-- Helper function: get current user's company_id
CREATE OR REPLACE FUNCTION public.user_company_id()
RETURNS UUID AS $$
  SELECT company_id FROM user_profiles WHERE id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Helper function: check permission
CREATE OR REPLACE FUNCTION public.has_permission(p_permission VARCHAR)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1
    FROM user_profiles up
    JOIN role_permissions rp ON rp.role_id = up.role_id
    JOIN permissions p ON p.id = rp.permission_id
    WHERE up.id = auth.uid()
      AND p.slug = p_permission
  )
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Helper function: check any of permissions
CREATE OR REPLACE FUNCTION public.has_any_permission(p_permissions VARCHAR[])
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1
    FROM user_profiles up
    JOIN role_permissions rp ON rp.role_id = up.role_id
    JOIN permissions p ON p.id = rp.permission_id
    WHERE up.id = auth.uid()
      AND p.slug = ANY(p_permissions)
  )
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Helper function: is super admin
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_profiles up
    JOIN roles r ON r.id = up.role_id
    WHERE up.id = auth.uid() AND r.slug = 'super_administrator'
  )
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================================
-- COMPANIES
-- ============================================================
CREATE POLICY companies_select ON companies FOR SELECT
  USING (id = public.user_company_id() OR public.is_super_admin());

CREATE POLICY companies_update ON companies FOR UPDATE
  USING (id = public.user_company_id() AND public.has_permission('settings.manage'));

-- ============================================================
-- USER PROFILES
-- ============================================================
CREATE POLICY user_profiles_select ON user_profiles FOR SELECT
  USING (company_id = public.user_company_id());

CREATE POLICY user_profiles_update ON user_profiles FOR UPDATE
  USING (
    id = auth.uid()
    OR (company_id = public.user_company_id() AND public.has_permission('users.manage'))
  );

CREATE POLICY user_profiles_insert ON user_profiles FOR INSERT
  WITH CHECK (
    company_id = public.user_company_id() AND public.has_permission('users.manage')
  );

-- ============================================================
-- TENANT SCOPED TABLES (company_id filter)
-- ============================================================
CREATE POLICY factories_all ON factories FOR ALL
  USING (company_id = public.user_company_id())
  WITH CHECK (company_id = public.user_company_id());

CREATE POLICY branches_all ON branches FOR ALL
  USING (company_id = public.user_company_id())
  WITH CHECK (company_id = public.user_company_id());

CREATE POLICY departments_all ON departments FOR ALL
  USING (company_id = public.user_company_id())
  WITH CHECK (company_id = public.user_company_id());

CREATE POLICY warehouses_all ON warehouses FOR ALL
  USING (company_id = public.user_company_id())
  WITH CHECK (company_id = public.user_company_id());

CREATE POLICY warehouse_racks_all ON warehouse_racks FOR ALL
  USING (
    warehouse_id IN (SELECT id FROM warehouses WHERE company_id = public.user_company_id())
  );

CREATE POLICY product_categories_all ON product_categories FOR ALL
  USING (company_id = public.user_company_id())
  WITH CHECK (company_id = public.user_company_id());

CREATE POLICY products_all ON products FOR ALL
  USING (company_id = public.user_company_id())
  WITH CHECK (company_id = public.user_company_id());

CREATE POLICY production_machines_all ON production_machines FOR ALL
  USING (
    factory_id IN (SELECT id FROM factories WHERE company_id = public.user_company_id())
  );

-- ============================================================
-- PRODUCTION BATCHES
-- ============================================================
CREATE POLICY batches_select ON production_batches FOR SELECT
  USING (company_id = public.user_company_id());

CREATE POLICY batches_insert ON production_batches FOR INSERT
  WITH CHECK (
    company_id = public.user_company_id()
    AND public.has_any_permission(ARRAY['production.create', 'production.manage'])
  );

CREATE POLICY batches_update ON production_batches FOR UPDATE
  USING (
    company_id = public.user_company_id()
    AND public.has_any_permission(ARRAY['production.edit', 'production.manage', 'quality.approve'])
  );

-- ============================================================
-- QR CODES
-- ============================================================
CREATE POLICY qr_codes_select ON qr_codes FOR SELECT
  USING (company_id = public.user_company_id());

CREATE POLICY qr_codes_insert ON qr_codes FOR INSERT
  WITH CHECK (
    company_id = public.user_company_id()
    AND public.has_any_permission(ARRAY['qr.generate', 'production.manage'])
  );

CREATE POLICY qr_codes_update ON qr_codes FOR UPDATE
  USING (
    company_id = public.user_company_id()
    AND public.has_any_permission(ARRAY['qr.generate', 'printing.reprint', 'production.manage'])
  );

-- ============================================================
-- REAMS & CARTONS
-- ============================================================
CREATE POLICY reams_all ON reams FOR ALL
  USING (company_id = public.user_company_id())
  WITH CHECK (company_id = public.user_company_id());

CREATE POLICY cartons_all ON cartons FOR ALL
  USING (company_id = public.user_company_id())
  WITH CHECK (company_id = public.user_company_id());

-- ============================================================
-- PRINTING
-- ============================================================
CREATE POLICY printers_all ON printers FOR ALL
  USING (company_id = public.user_company_id())
  WITH CHECK (company_id = public.user_company_id());

CREATE POLICY print_agents_all ON print_agents FOR ALL
  USING (company_id = public.user_company_id())
  WITH CHECK (company_id = public.user_company_id());

CREATE POLICY print_jobs_select ON print_jobs FOR SELECT
  USING (company_id = public.user_company_id());

CREATE POLICY print_jobs_insert ON print_jobs FOR INSERT
  WITH CHECK (
    company_id = public.user_company_id()
    AND public.has_any_permission(ARRAY['printing.create', 'printing.manage'])
  );

CREATE POLICY print_jobs_update ON print_jobs FOR UPDATE
  USING (
    company_id = public.user_company_id()
    AND public.has_any_permission(ARRAY['printing.manage', 'printing.reprint'])
  );

CREATE POLICY print_logs_select ON print_logs FOR SELECT
  USING (company_id = public.user_company_id());

CREATE POLICY print_logs_insert ON print_logs FOR INSERT
  WITH CHECK (company_id = public.user_company_id());

-- ============================================================
-- DISTRIBUTION
-- ============================================================
CREATE POLICY distributors_all ON distributors FOR ALL
  USING (company_id = public.user_company_id())
  WITH CHECK (company_id = public.user_company_id());

CREATE POLICY retailers_all ON retailers FOR ALL
  USING (company_id = public.user_company_id())
  WITH CHECK (company_id = public.user_company_id());

-- ============================================================
-- INVENTORY
-- ============================================================
CREATE POLICY inventory_movements_select ON inventory_movements FOR SELECT
  USING (company_id = public.user_company_id());

CREATE POLICY inventory_movements_insert ON inventory_movements FOR INSERT
  WITH CHECK (
    company_id = public.user_company_id()
    AND public.has_any_permission(ARRAY['inventory.move', 'inventory.manage'])
  );

-- ============================================================
-- VERIFICATION (public insert via service role, authenticated read)
-- ============================================================
CREATE POLICY verification_logs_select ON verification_logs FOR SELECT
  USING (company_id = public.user_company_id());

CREATE POLICY counterfeit_reports_select ON counterfeit_reports FOR SELECT
  USING (company_id = public.user_company_id());

CREATE POLICY counterfeit_reports_update ON counterfeit_reports FOR UPDATE
  USING (
    company_id = public.user_company_id()
    AND public.has_any_permission(ARRAY['fraud.manage', 'fraud.investigate'])
  );

CREATE POLICY fraud_alerts_select ON fraud_alerts FOR SELECT
  USING (company_id = public.user_company_id());

CREATE POLICY fraud_alerts_update ON fraud_alerts FOR UPDATE
  USING (
    company_id = public.user_company_id()
    AND public.has_any_permission(ARRAY['fraud.manage', 'fraud.investigate'])
  );

-- ============================================================
-- AUDIT LOGS (read-only for authorized users)
-- ============================================================
CREATE POLICY audit_logs_select ON audit_logs FOR SELECT
  USING (
    company_id = public.user_company_id()
    AND public.has_any_permission(ARRAY['audit.view', 'audit.manage'])
  );

CREATE POLICY audit_logs_insert ON audit_logs FOR INSERT
  WITH CHECK (company_id = public.user_company_id());

-- ============================================================
-- NOTIFICATIONS
-- ============================================================
CREATE POLICY notifications_all ON notifications FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ============================================================
-- ROLES & PERMISSIONS
-- ============================================================
CREATE POLICY roles_select ON roles FOR SELECT
  USING (company_id = public.user_company_id() OR company_id IS NULL);

CREATE POLICY permissions_select ON permissions FOR SELECT
  USING (true);

CREATE POLICY role_permissions_select ON role_permissions FOR SELECT
  USING (
    role_id IN (SELECT id FROM roles WHERE company_id = public.user_company_id() OR company_id IS NULL)
  );

CREATE POLICY system_settings_select ON system_settings FOR SELECT
  USING (company_id = public.user_company_id());

CREATE POLICY system_settings_update ON system_settings FOR UPDATE
  USING (
    company_id = public.user_company_id() AND public.has_permission('settings.manage')
  );

-- Service role bypass for edge functions
CREATE POLICY service_role_bypass ON qr_codes FOR ALL
  TO service_role USING (true) WITH CHECK (true);
CREATE POLICY service_role_verification ON verification_logs FOR ALL
  TO service_role USING (true) WITH CHECK (true);
CREATE POLICY service_role_print ON print_jobs FOR ALL
  TO service_role USING (true) WITH CHECK (true);
CREATE POLICY service_role_print_logs ON print_logs FOR ALL
  TO service_role USING (true) WITH CHECK (true);
CREATE POLICY service_role_fraud ON fraud_alerts FOR ALL
  TO service_role USING (true) WITH CHECK (true);
CREATE POLICY service_role_counterfeit ON counterfeit_reports FOR ALL
  TO service_role USING (true) WITH CHECK (true);
CREATE POLICY service_role_audit ON audit_logs FOR ALL
  TO service_role USING (true) WITH CHECK (true);
