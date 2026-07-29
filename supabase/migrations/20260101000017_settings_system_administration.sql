-- Hope Design Group Ltd — Settings & System Administration
-- Companies · branches · numbering · workflows · modules · branding · localization · integrations

-- ============================================================
-- EXTEND COMPANIES
-- ============================================================
ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS vat_number VARCHAR(100),
  ADD COLUMN IF NOT EXISTS nssf_employer_number VARCHAR(100),
  ADD COLUMN IF NOT EXISTS registration_number VARCHAR(100),
  ADD COLUMN IF NOT EXISTS district VARCHAR(100),
  ADD COLUMN IF NOT EXISTS base_currency VARCHAR(10) DEFAULT 'UGX',
  ADD COLUMN IF NOT EXISTS fiscal_year_start_month INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS timezone VARCHAR(50) DEFAULT 'Africa/Kampala',
  ADD COLUMN IF NOT EXISTS industry VARCHAR(150) DEFAULT 'Security Printing',
  ADD COLUMN IF NOT EXISTS watermark_url TEXT,
  ADD COLUMN IF NOT EXISTS seal_url TEXT,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

ALTER TABLE branches
  ADD COLUMN IF NOT EXISTS city VARCHAR(100),
  ADD COLUMN IF NOT EXISTS country VARCHAR(100) DEFAULT 'Uganda',
  ADD COLUMN IF NOT EXISTS phone VARCHAR(50),
  ADD COLUMN IF NOT EXISTS email VARCHAR(255),
  ADD COLUMN IF NOT EXISTS manager_name VARCHAR(150),
  ADD COLUMN IF NOT EXISTS branch_type VARCHAR(50) DEFAULT 'office', -- office | factory | warehouse | dc | sales
  ADD COLUMN IF NOT EXISTS currency VARCHAR(10) DEFAULT 'UGX',
  ADD COLUMN IF NOT EXISTS tax_region VARCHAR(100),
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- ============================================================
-- DOCUMENT NUMBERING SEQUENCES
-- ============================================================
CREATE TABLE IF NOT EXISTS document_sequences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  document_type VARCHAR(50) NOT NULL, -- po | invoice | grn | quote | so | pr | journal | employee | asset | batch
  prefix VARCHAR(50) DEFAULT '',
  suffix VARCHAR(50) DEFAULT '',
  include_year BOOLEAN DEFAULT true,
  include_branch BOOLEAN DEFAULT false,
  pad_length INTEGER DEFAULT 6,
  next_number INTEGER DEFAULT 1,
  reset_rule VARCHAR(20) DEFAULT 'yearly', -- never | yearly | monthly
  sample_format VARCHAR(100),
  is_active BOOLEAN DEFAULT true,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, document_type)
);

INSERT INTO document_sequences (company_id, document_type, prefix, include_year, pad_length, next_number, sample_format)
VALUES
  ('a0000000-0000-4000-8000-000000000001', 'po', 'HDG-PO-', true, 6, 43, 'HDG-PO-{YYYY}-{000001}'),
  ('a0000000-0000-4000-8000-000000000001', 'invoice', 'HDG-INV-', true, 6, 1, 'HDG-INV-{YYYY}-{000001}'),
  ('a0000000-0000-4000-8000-000000000001', 'grn', 'HDG-GRN-', true, 6, 2, 'HDG-GRN-{YYYY}-{000001}'),
  ('a0000000-0000-4000-8000-000000000001', 'quote', 'HDG-QT-', true, 6, 1, 'HDG-QT-{YYYY}-{000001}'),
  ('a0000000-0000-4000-8000-000000000001', 'so', 'HDG-SO-', true, 6, 1, 'HDG-SO-{YYYY}-{000001}'),
  ('a0000000-0000-4000-8000-000000000001', 'pr', 'HDG-PR-', true, 6, 1, 'HDG-PR-{YYYY}-{000001}'),
  ('a0000000-0000-4000-8000-000000000001', 'journal', 'HDG-JV-', true, 6, 2, 'HDG-JV-{YYYY}-{000001}'),
  ('a0000000-0000-4000-8000-000000000001', 'employee', 'EMP-', false, 3, 6, 'EMP-{000}'),
  ('a0000000-0000-4000-8000-000000000001', 'batch', 'BAT-', true, 5, 1, 'BAT-{YYYY}-{00001}')
ON CONFLICT (company_id, document_type) DO NOTHING;

-- ============================================================
-- MODULE REGISTRY (feature flags)
-- ============================================================
CREATE TABLE IF NOT EXISTS erp_modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  module_key VARCHAR(50) NOT NULL,
  module_name VARCHAR(150) NOT NULL,
  is_enabled BOOLEAN DEFAULT true,
  is_licensed BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 100,
  settings JSONB DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, module_key)
);

INSERT INTO erp_modules (company_id, module_key, module_name, is_enabled, sort_order) VALUES
  ('a0000000-0000-4000-8000-000000000001', 'dashboard', 'Dashboard', true, 10),
  ('a0000000-0000-4000-8000-000000000001', 'production', 'Production', true, 20),
  ('a0000000-0000-4000-8000-000000000001', 'inventory', 'Inventory', true, 30),
  ('a0000000-0000-4000-8000-000000000001', 'procurement', 'Procurement', true, 40),
  ('a0000000-0000-4000-8000-000000000001', 'scm', 'Supply Chain', true, 50),
  ('a0000000-0000-4000-8000-000000000001', 'sales', 'Sales', true, 60),
  ('a0000000-0000-4000-8000-000000000001', 'crm', 'CRM', true, 70),
  ('a0000000-0000-4000-8000-000000000001', 'finance', 'Finance', true, 80),
  ('a0000000-0000-4000-8000-000000000001', 'hr', 'Human Resources', true, 90),
  ('a0000000-0000-4000-8000-000000000001', 'workforce', 'Workforce', true, 100),
  ('a0000000-0000-4000-8000-000000000001', 'identity', 'Identity & Access', true, 110),
  ('a0000000-0000-4000-8000-000000000001', 'reports', 'Reports & BI', true, 120),
  ('a0000000-0000-4000-8000-000000000001', 'api', 'API & Integrations', true, 130)
ON CONFLICT (company_id, module_key) DO NOTHING;

-- ============================================================
-- APPROVAL WORKFLOW DEFINITIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS approval_workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  workflow_code VARCHAR(50) NOT NULL,
  name VARCHAR(255) NOT NULL,
  document_type VARCHAR(50) NOT NULL,
  min_amount DECIMAL(18,2) DEFAULT 0,
  max_amount DECIMAL(18,2),
  department VARCHAR(100),
  steps JSONB DEFAULT '[]', -- [{role, order, sla_hours}]
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, workflow_code)
);

INSERT INTO approval_workflows (company_id, workflow_code, name, document_type, min_amount, max_amount, steps)
VALUES
  (
    'a0000000-0000-4000-8000-000000000001',
    'WF-PO-STD',
    'Purchase Order Standard',
    'purchase_order',
    0,
    5000000,
    '[{"role":"procurement_officer","order":1,"sla_hours":24},{"role":"procurement_manager","order":2,"sla_hours":48}]'::jsonb
  ),
  (
    'a0000000-0000-4000-8000-000000000001',
    'WF-PO-HIGH',
    'Purchase Order High Value',
    'purchase_order',
    5000000,
    NULL,
    '[{"role":"procurement_manager","order":1,"sla_hours":24},{"role":"finance_manager","order":2,"sla_hours":48},{"role":"managing_director","order":3,"sla_hours":72}]'::jsonb
  ),
  (
    'a0000000-0000-4000-8000-000000000001',
    'WF-LEAVE',
    'Leave Approval',
    'leave_request',
    0,
    NULL,
    '[{"role":"supervisor","order":1,"sla_hours":24},{"role":"hr_manager","order":2,"sla_hours":48}]'::jsonb
  )
ON CONFLICT (company_id, workflow_code) DO NOTHING;

-- ============================================================
-- NOTIFICATION TEMPLATES
-- ============================================================
CREATE TABLE IF NOT EXISTS notification_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  template_key VARCHAR(80) NOT NULL,
  name VARCHAR(150) NOT NULL,
  channel VARCHAR(30) DEFAULT 'email', -- email | sms | push | in_app | whatsapp
  subject VARCHAR(255),
  body TEXT,
  is_active BOOLEAN DEFAULT true,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, template_key, channel)
);

INSERT INTO notification_templates (company_id, template_key, name, channel, subject, body) VALUES
  ('a0000000-0000-4000-8000-000000000001', 'welcome', 'Welcome Email', 'email', 'Welcome to Hope SecureTrack', 'Hello {{name}}, your account has been created.'),
  ('a0000000-0000-4000-8000-000000000001', 'invoice', 'Invoice Notification', 'email', 'Invoice {{number}}', 'Please find invoice {{number}} for {{amount}}.'),
  ('a0000000-0000-4000-8000-000000000001', 'po_sent', 'PO Sent', 'email', 'Purchase Order {{number}}', 'PO {{number}} has been issued to {{supplier}}.'),
  ('a0000000-0000-4000-8000-000000000001', 'leave_approved', 'Leave Approved', 'email', 'Leave request approved', 'Your leave from {{start}} to {{end}} was approved.'),
  ('a0000000-0000-4000-8000-000000000001', 'password_reset', 'Password Reset', 'email', 'Reset your password', 'Use this link to reset your password: {{link}}'),
  ('a0000000-0000-4000-8000-000000000001', 'security_alert', 'Security Alert', 'in_app', 'Security alert', '{{message}}')
ON CONFLICT (company_id, template_key, channel) DO NOTHING;

-- ============================================================
-- INTEGRATION / API KEYS (metadata only — no secrets in plain UI ideally)
-- ============================================================
CREATE TABLE IF NOT EXISTS integration_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  integration_key VARCHAR(50) NOT NULL,
  name VARCHAR(150) NOT NULL,
  category VARCHAR(50) DEFAULT 'general', -- banking | payment | identity | printer | messaging | bi
  is_enabled BOOLEAN DEFAULT false,
  config JSONB DEFAULT '{}',
  last_synced_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, integration_key)
);

INSERT INTO integration_configs (company_id, integration_key, name, category, is_enabled, config) VALUES
  ('a0000000-0000-4000-8000-000000000001', 'supabase', 'Supabase Platform', 'identity', true, '{"project":"mvieuhmpgykbycfakymy"}'),
  ('a0000000-0000-4000-8000-000000000001', 'niimbot', 'Niimbot Label Printers', 'printer', true, '{"mode":"web_bluetooth"}'),
  ('a0000000-0000-4000-8000-000000000001', 'mtn_momo', 'MTN Mobile Money', 'payment', false, '{}'),
  ('a0000000-0000-4000-8000-000000000001', 'airtel_money', 'Airtel Money', 'payment', false, '{}'),
  ('a0000000-0000-4000-8000-000000000001', 'microsoft365', 'Microsoft 365 / Entra ID', 'identity', false, '{}'),
  ('a0000000-0000-4000-8000-000000000001', 'smtp', 'SMTP Email', 'messaging', false, '{"port":587,"encryption":"tls"}')
ON CONFLICT (company_id, integration_key) DO NOTHING;

-- ============================================================
-- BRANDING & LOCALIZATION (key-value via system_settings seeds)
-- ============================================================
INSERT INTO system_settings (company_id, key, value, description) VALUES
  ('a0000000-0000-4000-8000-000000000001', 'brand.primary_color', '"#0D7377"', 'Primary brand colour'),
  ('a0000000-0000-4000-8000-000000000001', 'brand.secondary_color', '"#1B263B"', 'Secondary / navy'),
  ('a0000000-0000-4000-8000-000000000001', 'brand.app_name', '"Hope SecureTrack"', 'Application display name'),
  ('a0000000-0000-4000-8000-000000000001', 'locale.language', '"en"', 'Default language'),
  ('a0000000-0000-4000-8000-000000000001', 'locale.timezone', '"Africa/Kampala"', 'Default timezone'),
  ('a0000000-0000-4000-8000-000000000001', 'locale.date_format', '"DD MMM YYYY"', 'Date display format'),
  ('a0000000-0000-4000-8000-000000000001', 'locale.currency', '"UGX"', 'Base currency'),
  ('a0000000-0000-4000-8000-000000000001', 'locale.country', '"Uganda"', 'Primary country'),
  ('a0000000-0000-4000-8000-000000000001', 'security.session_timeout_minutes', '480', 'Session timeout'),
  ('a0000000-0000-4000-8000-000000000001', 'security.mfa_required_admins', 'true', 'Force MFA for admins'),
  ('a0000000-0000-4000-8000-000000000001', 'security.min_password_length', '10', 'Minimum password length'),
  ('a0000000-0000-4000-8000-000000000001', 'ai.enabled', 'true', 'Enable AI insights'),
  ('a0000000-0000-4000-8000-000000000001', 'ai.confidence_threshold', '0.7', 'Minimum AI confidence'),
  ('a0000000-0000-4000-8000-000000000001', 'backup.frequency', '"daily"', 'Backup schedule label'),
  ('a0000000-0000-4000-8000-000000000001', 'backup.retention_days', '30', 'Backup retention')
ON CONFLICT (company_id, key) DO NOTHING;

-- Update company seed fields
UPDATE companies SET
  base_currency = 'UGX',
  timezone = 'Africa/Kampala',
  country = COALESCE(country, 'Uganda'),
  industry = 'Security Printing | Paper Manufacturing | Engineering',
  fiscal_year_start_month = 1
WHERE id = 'a0000000-0000-4000-8000-000000000001';

-- Seed branches if empty
INSERT INTO branches (company_id, name, code, address, city, country, branch_type, currency, is_active)
SELECT
  'a0000000-0000-4000-8000-000000000001',
  v.name, v.code, v.address, v.city, 'Uganda', v.btype, 'UGX', true
FROM (VALUES
  ('Head Office', 'BR-HQ', 'Kampala CBD', 'Kampala', 'office'),
  ('Main Factory', 'BR-FAC', 'Industrial Area', 'Kampala', 'factory'),
  ('Distribution Centre', 'BR-DC', 'Namanve', 'Mukono', 'dc')
) AS v(name, code, address, city, btype)
WHERE NOT EXISTS (
  SELECT 1 FROM branches b
  WHERE b.company_id = 'a0000000-0000-4000-8000-000000000001' AND b.code = v.code
);

-- ============================================================
-- CONFIG CHANGE AUDIT
-- ============================================================
CREATE TABLE IF NOT EXISTS config_change_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id),
  entity_type VARCHAR(50) NOT NULL,
  entity_id UUID,
  action VARCHAR(30) NOT NULL, -- create | update | delete | restore | toggle
  field_name VARCHAR(100),
  old_value TEXT,
  new_value TEXT,
  changed_by UUID REFERENCES user_profiles(id),
  reason TEXT,
  ip_hint VARCHAR(50),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_config_change_log_created ON config_change_log(created_at DESC);

-- ============================================================
-- PERMISSIONS
-- ============================================================
INSERT INTO permissions (name, slug, module, description) VALUES
  ('View Settings', 'settings.view', 'settings', 'View system configuration'),
  ('Manage Settings', 'settings.manage', 'settings', 'Edit system configuration'),
  ('Manage Branding', 'settings.branding', 'settings', 'Branding and themes'),
  ('Manage Integrations', 'settings.integrations', 'settings', 'API and third-party integrations'),
  ('Manage Sequences', 'settings.sequences', 'settings', 'Document numbering'),
  ('Manage Workflows', 'settings.workflows', 'settings', 'Approval workflow definitions')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT 'e0000000-0000-4000-8000-000000000001', id FROM permissions
WHERE slug LIKE 'settings.%' OR slug = 'settings.manage'
ON CONFLICT DO NOTHING;

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE document_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE erp_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE approval_workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE config_change_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY document_sequences_all ON document_sequences FOR ALL
  USING (company_id = public.user_company_id() OR public.is_super_admin())
  WITH CHECK (company_id = public.user_company_id() OR public.is_super_admin());
CREATE POLICY erp_modules_all ON erp_modules FOR ALL
  USING (company_id = public.user_company_id() OR public.is_super_admin())
  WITH CHECK (company_id = public.user_company_id() OR public.is_super_admin());
CREATE POLICY approval_workflows_all ON approval_workflows FOR ALL
  USING (company_id = public.user_company_id() OR public.is_super_admin())
  WITH CHECK (company_id = public.user_company_id() OR public.is_super_admin());
CREATE POLICY notification_templates_all ON notification_templates FOR ALL
  USING (company_id = public.user_company_id() OR public.is_super_admin())
  WITH CHECK (company_id = public.user_company_id() OR public.is_super_admin());
CREATE POLICY integration_configs_all ON integration_configs FOR ALL
  USING (company_id = public.user_company_id() OR public.is_super_admin())
  WITH CHECK (company_id = public.user_company_id() OR public.is_super_admin());
CREATE POLICY config_change_log_select ON config_change_log FOR SELECT
  USING (company_id = public.user_company_id() OR public.is_super_admin());
CREATE POLICY config_change_log_insert ON config_change_log FOR INSERT
  WITH CHECK (company_id = public.user_company_id() OR public.is_super_admin());

-- Next number helper
CREATE OR REPLACE FUNCTION public.next_document_number(
  p_company_id UUID,
  p_document_type TEXT,
  p_branch_code TEXT DEFAULT NULL
) RETURNS TEXT AS $$
DECLARE
  v_seq document_sequences%ROWTYPE;
  v_num INTEGER;
  v_year TEXT := to_char(CURRENT_DATE, 'YYYY');
  v_result TEXT;
BEGIN
  SELECT * INTO v_seq FROM document_sequences
  WHERE company_id = p_company_id AND document_type = p_document_type AND is_active
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN upper(p_document_type) || '-' || v_year || '-' || lpad('1', 6, '0');
  END IF;

  v_num := v_seq.next_number;
  UPDATE document_sequences SET next_number = next_number + 1, updated_at = NOW()
  WHERE id = v_seq.id;

  v_result := COALESCE(v_seq.prefix, '');
  IF v_seq.include_year THEN
    v_result := v_result || v_year || '-';
  END IF;
  IF v_seq.include_branch AND p_branch_code IS NOT NULL THEN
    v_result := v_result || p_branch_code || '-';
  END IF;
  v_result := v_result || lpad(v_num::text, COALESCE(v_seq.pad_length, 6), '0');
  IF v_seq.suffix IS NOT NULL AND v_seq.suffix <> '' THEN
    v_result := v_result || v_seq.suffix;
  END IF;
  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.next_document_number(UUID, TEXT, TEXT) TO authenticated, service_role;
