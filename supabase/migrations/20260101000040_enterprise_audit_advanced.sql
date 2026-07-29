-- Hope Design Group — Audit Platform Advanced
-- Archival · secure retrieval · logging policies · findings · SIEM · role matrix · reports

-- ============================================================
-- PERMISSIONS (role matrix §22)
-- ============================================================
INSERT INTO permissions (name, slug, module, description)
SELECT v.name, v.slug, v.module, v.description
FROM (VALUES
  ('Audit Executive View', 'eal.executive', 'audit', 'Executive summary dashboards and high-level reports'),
  ('Audit IT Security', 'eal.security', 'audit', 'Security events and incident management'),
  ('Audit Infra Logs', 'eal.infra', 'audit', 'Infrastructure and system change logs only'),
  ('Audit Archive', 'eal.archive', 'audit', 'Archive and securely retrieve historical logs'),
  ('Audit Config CRUD', 'eal.config', 'audit', 'Manage logging policies, alerts, integrations')
) AS v(name, slug, module, description)
WHERE NOT EXISTS (SELECT 1 FROM permissions p WHERE p.slug = v.slug);

-- Ensure auditor / MD get full audit view+export+investigate
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE p.slug IN (
  'eal.view','eal.manage','eal.investigate','eal.export','eal.ai','eal.compliance',
  'eal.executive','eal.security','eal.archive','eal.config','audit.view'
)
  AND r.slug IN ('super_administrator','managing_director','auditor')
  AND NOT EXISTS (
    SELECT 1 FROM role_permissions rp WHERE rp.role_id = r.id AND rp.permission_id = p.id
  );

-- Operations / finance: view + executive + compliance
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE p.slug IN ('eal.view','eal.executive','eal.compliance','eal.export','audit.view')
  AND r.slug IN ('operations_manager','finance_manager','hr_manager')
  AND NOT EXISTS (
    SELECT 1 FROM role_permissions rp WHERE rp.role_id = r.id AND rp.permission_id = p.id
  );

-- ============================================================
-- LOGGING POLICIES (config CRUD — not event mutation)
-- ============================================================
CREATE TABLE IF NOT EXISTS eal_logging_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  policy_code VARCHAR(60) NOT NULL,
  name VARCHAR(200) NOT NULL,
  module_scope VARCHAR(60) DEFAULT '*',
  event_types TEXT[] DEFAULT ARRAY['*'],
  min_severity VARCHAR(20) DEFAULT 'info',
  capture_before_after BOOLEAN DEFAULT true,
  capture_ip BOOLEAN DEFAULT true,
  capture_geo BOOLEAN DEFAULT false,
  enabled BOOLEAN DEFAULT true,
  description TEXT,
  created_by UUID REFERENCES user_profiles(id),
  updated_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, policy_code)
);

-- ============================================================
-- CONFIG CHANGE HISTORY (auditable config — configs can change, events cannot)
-- ============================================================
CREATE TABLE IF NOT EXISTS eal_config_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  config_type VARCHAR(60) NOT NULL,
  -- logging_policy | retention | alert_channel | siem | integration
  config_id UUID,
  action VARCHAR(40) NOT NULL,
  -- create | update | enable | disable | archive | restore | import
  actor_id UUID REFERENCES user_profiles(id),
  actor_email VARCHAR(255),
  before_state JSONB,
  after_state JSONB,
  details TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_eal_config_hist ON eal_config_history(company_id, created_at DESC);

-- ============================================================
-- ARCHIVE STORE (secure retrieval — events leave hot store, never deleted)
-- ============================================================
CREATE TABLE IF NOT EXISTS eal_archive_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  batch_number VARCHAR(40) NOT NULL,
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  event_count INTEGER DEFAULT 0,
  root_hash VARCHAR(128),
  storage_uri TEXT,
  encryption_algo VARCHAR(40) DEFAULT 'AES-256-GCM',
  integrity_seal VARCHAR(128) NOT NULL,
  status VARCHAR(30) DEFAULT 'sealed',
  -- sealing | sealed | retrieving | restored_partial
  sealed_by UUID REFERENCES user_profiles(id),
  sealed_at TIMESTAMPTZ DEFAULT NOW(),
  notes TEXT,
  metadata JSONB DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS eal_archived_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  batch_id UUID NOT NULL REFERENCES eal_archive_batches(id) ON DELETE CASCADE,
  original_event_id UUID,
  audit_id VARCHAR(40) NOT NULL,
  event_payload JSONB NOT NULL,
  integrity_hash VARCHAR(128) NOT NULL,
  chain_index BIGINT,
  archived_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_eal_arch_events_batch ON eal_archived_events(batch_id);
CREATE INDEX IF NOT EXISTS idx_eal_arch_events_audit ON eal_archived_events(company_id, audit_id);

CREATE TABLE IF NOT EXISTS eal_archive_retrievals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  batch_id UUID NOT NULL REFERENCES eal_archive_batches(id) ON DELETE CASCADE,
  requested_by UUID REFERENCES user_profiles(id),
  reason TEXT NOT NULL,
  approval_status VARCHAR(30) DEFAULT 'pending',
  -- pending | approved | denied | fulfilled
  approved_by UUID REFERENCES user_profiles(id),
  fulfilled_at TIMESTAMPTZ,
  access_token_hint VARCHAR(40),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Archived payloads also immutable
CREATE OR REPLACE FUNCTION prevent_eal_archive_mod()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Archived audit events are immutable';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_eal_arch_events_imm ON eal_archived_events;
CREATE TRIGGER tr_eal_arch_events_imm
  BEFORE UPDATE OR DELETE ON eal_archived_events
  FOR EACH ROW EXECUTE FUNCTION prevent_eal_archive_mod();

DROP TRIGGER IF EXISTS tr_eal_arch_batches_imm ON eal_archive_batches;
CREATE TRIGGER tr_eal_arch_batches_imm
  BEFORE DELETE ON eal_archive_batches
  FOR EACH ROW EXECUTE FUNCTION prevent_eal_archive_mod();

-- ============================================================
-- OUTSTANDING FINDINGS
-- ============================================================
CREATE TABLE IF NOT EXISTS eal_findings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  finding_number VARCHAR(40) NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  severity VARCHAR(20) DEFAULT 'medium',
  category VARCHAR(60) DEFAULT 'control_gap',
  -- control_gap | fraud | access | process | data_quality
  framework_code VARCHAR(40),
  control_code VARCHAR(40),
  status VARCHAR(30) DEFAULT 'open',
  -- open | in_remediation | accepted | closed
  owner_name VARCHAR(150),
  due_date DATE,
  evidence_refs JSONB DEFAULT '[]',
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  closed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_eal_findings_status ON eal_findings(company_id, status);

-- ============================================================
-- SIEM / INTEGRATION CONNECTORS
-- ============================================================
CREATE TABLE IF NOT EXISTS eal_siem_connectors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  connector_code VARCHAR(40) NOT NULL,
  name VARCHAR(150) NOT NULL,
  provider VARCHAR(60) NOT NULL,
  -- splunk | sentinel | qradar | elastic | webhook | syslog
  endpoint_url TEXT,
  auth_type VARCHAR(40) DEFAULT 'token',
  enabled BOOLEAN DEFAULT false,
  min_severity VARCHAR(20) DEFAULT 'medium',
  last_push_at TIMESTAMPTZ,
  last_status VARCHAR(40),
  config JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, connector_code)
);

CREATE TABLE IF NOT EXISTS eal_siem_outbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  connector_id UUID REFERENCES eal_siem_connectors(id) ON DELETE SET NULL,
  event_id UUID,
  payload JSONB NOT NULL,
  status VARCHAR(30) DEFAULT 'pending',
  -- pending | sent | failed
  attempts INTEGER DEFAULT 0,
  last_error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  sent_at TIMESTAMPTZ
);

-- ============================================================
-- SAVED REPORT DEFINITIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS eal_report_defs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  report_code VARCHAR(60) NOT NULL,
  name VARCHAR(200) NOT NULL,
  category VARCHAR(40) DEFAULT 'activity',
  -- executive | security | activity | financial | inventory | production | payroll | document | export | print
  module_filter VARCHAR(60),
  event_type_filter VARCHAR(100),
  description TEXT,
  is_system BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, report_code)
);

CREATE TABLE IF NOT EXISTS eal_report_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  report_def_id UUID REFERENCES eal_report_defs(id) ON DELETE SET NULL,
  report_code VARCHAR(60),
  name VARCHAR(200),
  period_start TIMESTAMPTZ,
  period_end TIMESTAMPTZ,
  row_count INTEGER DEFAULT 0,
  run_by UUID REFERENCES user_profiles(id),
  status VARCHAR(30) DEFAULT 'completed',
  result_summary JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- RLS
-- ============================================================
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'eal_logging_policies','eal_config_history','eal_archive_batches',
    'eal_archived_events','eal_archive_retrievals','eal_findings',
    'eal_siem_connectors','eal_siem_outbox','eal_report_defs','eal_report_runs'
  ]
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t || '_all', t);
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR ALL USING (company_id = user_company_id()) WITH CHECK (company_id = user_company_id())',
      t || '_all', t
    );
  END LOOP;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- ============================================================
-- SEED
-- ============================================================
DO $$
DECLARE cid UUID;
BEGIN
  SELECT id INTO cid FROM companies ORDER BY created_at LIMIT 1;
  IF cid IS NULL THEN RETURN; END IF;

  INSERT INTO eal_logging_policies (company_id, policy_code, name, module_scope, capture_before_after, enabled, description)
  VALUES
    (cid, 'ALL-DEFAULT', 'Default full capture', '*', true, true, 'Capture all modules with before/after on updates'),
    (cid, 'FIN-STRICT', 'Finance strict', 'finance', true, true, 'Mandatory field-level diffs for finance'),
    (cid, 'PAY-STRICT', 'Payroll strict', 'payroll', true, true, 'Salary and bank change capture'),
    (cid, 'AUTH-ALL', 'Authentication events', 'authentication', false, true, 'Login, logout, MFA, failures'),
    (cid, 'API-TELEMETRY', 'API telemetry', 'api', false, true, 'API requests and rate limits')
  ON CONFLICT (company_id, policy_code) DO NOTHING;

  INSERT INTO eal_siem_connectors (company_id, connector_code, name, provider, enabled, min_severity, config)
  VALUES
    (cid, 'SPLUNK', 'Splunk HEC', 'splunk', false, 'medium', '{"format":"hec_json"}'::jsonb),
    (cid, 'SENTINEL', 'Microsoft Sentinel', 'sentinel', false, 'medium', '{"format":"cef"}'::jsonb),
    (cid, 'QRADAR', 'IBM QRadar', 'qradar', false, 'high', '{"format":"leef"}'::jsonb),
    (cid, 'ELASTIC', 'Elastic SIEM', 'elastic', false, 'low', '{"format":"ecs"}'::jsonb),
    (cid, 'WEBHOOK', 'Generic Webhook', 'webhook', false, 'info', '{"format":"json"}'::jsonb)
  ON CONFLICT (company_id, connector_code) DO NOTHING;

  INSERT INTO eal_report_defs (company_id, report_code, name, category, module_filter, description, is_system)
  VALUES
    (cid, 'USER-ACTIVITY', 'User Activity Report', 'activity', NULL, 'All actions by user over period', true),
    (cid, 'LOGIN-HISTORY', 'Login History', 'security', 'authentication', 'Successful and failed logins', true),
    (cid, 'PERM-CHANGES', 'Permission Changes', 'security', 'iam', 'Role and permission modifications', true),
    (cid, 'FIN-TRAIL', 'Financial Audit Trail', 'financial', 'finance', 'GL, invoices, payments', true),
    (cid, 'INV-TRAIL', 'Inventory Audit Trail', 'inventory', 'inventory', 'Stock moves and adjustments', true),
    (cid, 'PROD-TRAIL', 'Production Audit Trail', 'production', 'production', 'Batches, QR, shop floor', true),
    (cid, 'PAY-TRAIL', 'Payroll Audit Trail', 'payroll', 'payroll', 'Runs, salary, payslips', true),
    (cid, 'DOC-ACCESS', 'Document Access Report', 'document', 'documents', 'File upload/download/share', true),
    (cid, 'DATA-EXPORT', 'Data Export Report', 'export', NULL, 'CSV/PDF/Excel/API exports', true),
    (cid, 'PRINT-USAGE', 'Printer Usage Report', 'print', 'print', 'Print jobs and watermarks', true),
    (cid, 'EXEC-SUMMARY', 'Executive Security Summary', 'executive', NULL, 'Scores, incidents, high-risk users', true)
  ON CONFLICT (company_id, report_code) DO NOTHING;

  IF NOT EXISTS (SELECT 1 FROM eal_findings WHERE company_id = cid) THEN
    INSERT INTO eal_findings (company_id, finding_number, title, description, severity, category, framework_code, control_code, status, owner_name, due_date)
    VALUES
      (cid, 'FND-0001', 'Dual control gap on salary changes', 'Salary updates above 10% should require finance co-approval.', 'high', 'control_gap', 'ISO27001', 'A.9.2.1', 'open', 'HR + Finance', CURRENT_DATE + 30),
      (cid, 'FND-0002', 'MFA coverage incomplete', 'Some active sessions lack MFA verification.', 'medium', 'access', 'SOC2', 'CC6.1', 'in_remediation', 'IT Security', CURRENT_DATE + 14),
      (cid, 'FND-0003', 'After-hours sensitive export', 'Payroll PDF export outside business hours requires justification.', 'medium', 'fraud', 'UG-DPA', 'UG-DPA-12', 'open', 'Compliance', CURRENT_DATE + 21);
  END IF;
END $$;
