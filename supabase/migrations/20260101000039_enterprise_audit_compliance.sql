-- Hope Design Group — Enterprise Audit Logging & Compliance Platform
-- Immutable trail · integrity chain · AI fraud · compliance · forensics · GRC

-- ============================================================
-- PERMISSIONS
-- ============================================================
INSERT INTO permissions (name, slug, module, description)
SELECT v.name, v.slug, v.module, v.description
FROM (VALUES
  ('View Enterprise Audit', 'eal.view', 'audit', 'View enterprise audit trail and compliance'),
  ('Manage Audit Config', 'eal.manage', 'audit', 'Configure retention, alerts, frameworks'),
  ('Investigate Audit', 'eal.investigate', 'audit', 'Forensics, incidents, chain verification'),
  ('Export Audit', 'eal.export', 'audit', 'Export audit packages and regulatory reports'),
  ('Audit AI', 'eal.ai', 'audit', 'AI security analytics and fraud detection'),
  ('Audit Compliance', 'eal.compliance', 'audit', 'Compliance frameworks and evidence')
) AS v(name, slug, module, description)
WHERE NOT EXISTS (SELECT 1 FROM permissions p WHERE p.slug = v.slug);

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE p.slug LIKE 'eal.%'
  AND r.slug IN (
    'super_administrator','managing_director','operations_manager',
    'auditor','finance_manager','hr_manager'
  )
  AND NOT EXISTS (
    SELECT 1 FROM role_permissions rp WHERE rp.role_id = r.id AND rp.permission_id = p.id
  );

-- Grant legacy audit.view to auditors already covered

-- ============================================================
-- EXTEND legacy audit_logs
-- ============================================================
ALTER TABLE audit_logs
  ADD COLUMN IF NOT EXISTS event_id VARCHAR(64),
  ADD COLUMN IF NOT EXISTS correlation_id VARCHAR(64),
  ADD COLUMN IF NOT EXISTS transaction_id VARCHAR(64),
  ADD COLUMN IF NOT EXISTS severity VARCHAR(20) DEFAULT 'info',
  ADD COLUMN IF NOT EXISTS branch_name VARCHAR(150),
  ADD COLUMN IF NOT EXISTS department VARCHAR(100),
  ADD COLUMN IF NOT EXISTS session_id VARCHAR(128),
  ADD COLUMN IF NOT EXISTS integrity_hash VARCHAR(128),
  ADD COLUMN IF NOT EXISTS prev_hash VARCHAR(128),
  ADD COLUMN IF NOT EXISTS changed_fields TEXT[],
  ADD COLUMN IF NOT EXISTS crud_op VARCHAR(20),
  ADD COLUMN IF NOT EXISTS geo_country VARCHAR(80),
  ADD COLUMN IF NOT EXISTS geo_lat NUMERIC(10,7),
  ADD COLUMN IF NOT EXISTS geo_lng NUMERIC(10,7);

CREATE INDEX IF NOT EXISTS idx_audit_logs_event ON audit_logs(event_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_corr ON audit_logs(correlation_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_severity ON audit_logs(company_id, severity);

-- ============================================================
-- ENTERPRISE EVENT STREAM (append-only, hash-chained)
-- ============================================================
CREATE TABLE IF NOT EXISTS eal_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  audit_id VARCHAR(40) NOT NULL,
  event_id VARCHAR(64) NOT NULL,
  correlation_id VARCHAR(64),
  transaction_id VARCHAR(64),
  -- actor
  user_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  username VARCHAR(150),
  full_name VARCHAR(200),
  user_email VARCHAR(255),
  user_role VARCHAR(100),
  department VARCHAR(100),
  branch_name VARCHAR(150),
  -- session / device
  session_id VARCHAR(128),
  device_name VARCHAR(150),
  os_name VARCHAR(80),
  browser VARCHAR(80),
  device_fingerprint VARCHAR(128),
  ip_address INET,
  hostname VARCHAR(150),
  user_agent TEXT,
  mfa_status VARCHAR(40),
  auth_method VARCHAR(60),
  -- action
  module VARCHAR(60) NOT NULL,
  entity_type VARCHAR(80),
  entity_id UUID,
  entity_reference VARCHAR(255),
  event_type VARCHAR(100) NOT NULL,
  crud_op VARCHAR(20),
  -- create | read | update | delete | login | export | print | approve | config
  action VARCHAR(120) NOT NULL,
  severity VARCHAR(20) DEFAULT 'info',
  -- info | low | medium | high | critical
  title TEXT,
  details TEXT,
  before_state JSONB,
  after_state JSONB,
  changed_fields TEXT[],
  -- environment
  timezone VARCHAR(60) DEFAULT 'Africa/Kampala',
  local_time TIMESTAMPTZ,
  geo_country VARCHAR(80),
  geo_lat NUMERIC(10,7),
  geo_lng NUMERIC(10,7),
  api_source VARCHAR(120),
  network_zone VARCHAR(60),
  -- integrity
  prev_hash VARCHAR(128),
  integrity_hash VARCHAR(128) NOT NULL,
  signature VARCHAR(256),
  chain_index BIGINT,
  risk_score INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_eal_events_audit_id ON eal_events(company_id, audit_id);
CREATE INDEX IF NOT EXISTS idx_eal_events_created ON eal_events(company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_eal_events_user ON eal_events(company_id, user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_eal_events_module ON eal_events(company_id, module, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_eal_events_type ON eal_events(company_id, event_type);
CREATE INDEX IF NOT EXISTS idx_eal_events_severity ON eal_events(company_id, severity);
CREATE INDEX IF NOT EXISTS idx_eal_events_entity ON eal_events(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_eal_events_ip ON eal_events(company_id, ip_address);
CREATE INDEX IF NOT EXISTS idx_eal_events_corr ON eal_events(correlation_id);
CREATE INDEX IF NOT EXISTS idx_eal_events_chain ON eal_events(company_id, chain_index);

CREATE OR REPLACE FUNCTION prevent_eal_event_modification()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Enterprise audit events are immutable and cannot be modified or deleted';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_eal_events_immutable ON eal_events;
CREATE TRIGGER tr_eal_events_immutable
  BEFORE UPDATE OR DELETE ON eal_events
  FOR EACH ROW EXECUTE FUNCTION prevent_eal_event_modification();

-- ============================================================
-- INTEGRITY CHECKPOINTS
-- ============================================================
CREATE TABLE IF NOT EXISTS eal_integrity_checkpoints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  checkpoint_number VARCHAR(40) NOT NULL,
  from_chain_index BIGINT,
  to_chain_index BIGINT,
  events_count INTEGER DEFAULT 0,
  root_hash VARCHAR(128) NOT NULL,
  status VARCHAR(30) DEFAULT 'valid',
  -- valid | broken | pending
  verified_at TIMESTAMPTZ DEFAULT NOW(),
  verified_by UUID REFERENCES user_profiles(id),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- SESSIONS (live security)
-- ============================================================
CREATE TABLE IF NOT EXISTS eal_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  session_id VARCHAR(128) NOT NULL,
  user_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  username VARCHAR(150),
  full_name VARCHAR(200),
  role_name VARCHAR(100),
  ip_address INET,
  user_agent TEXT,
  device_fingerprint VARCHAR(128),
  mfa_verified BOOLEAN DEFAULT false,
  auth_method VARCHAR(60),
  status VARCHAR(30) DEFAULT 'active',
  -- active | idle | locked | expired | terminated
  login_at TIMESTAMPTZ DEFAULT NOW(),
  last_activity_at TIMESTAMPTZ DEFAULT NOW(),
  logout_at TIMESTAMPTZ,
  risk_score INTEGER DEFAULT 0,
  geo_country VARCHAR(80),
  metadata JSONB DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_eal_sessions_active ON eal_sessions(company_id, status) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_eal_sessions_user ON eal_sessions(user_id);

-- ============================================================
-- SECURITY ALERTS
-- ============================================================
CREATE TABLE IF NOT EXISTS eal_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  alert_number VARCHAR(40) NOT NULL,
  alert_type VARCHAR(60) NOT NULL,
  -- failed_login | privilege | unusual_export | night_activity | impossible_travel
  -- payroll_change | mass_delete | duplicate_invoice | api_abuse | permission_escalation
  severity VARCHAR(20) DEFAULT 'medium',
  title TEXT NOT NULL,
  detail TEXT,
  user_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  event_id UUID REFERENCES eal_events(id) ON DELETE SET NULL,
  risk_score INTEGER DEFAULT 50,
  status VARCHAR(30) DEFAULT 'open',
  -- open | acknowledged | investigating | resolved | false_positive
  channel VARCHAR(40) DEFAULT 'dashboard',
  acknowledged_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES user_profiles(id),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_eal_alerts_status ON eal_alerts(company_id, status, severity);

-- ============================================================
-- INCIDENTS (Service Desk bridge)
-- ============================================================
CREATE TABLE IF NOT EXISTS eal_incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  incident_number VARCHAR(40) NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  category VARCHAR(60) DEFAULT 'security',
  severity VARCHAR(20) DEFAULT 'high',
  status VARCHAR(30) DEFAULT 'open',
  -- open | investigating | contained | resolved | closed
  source_alert_id UUID REFERENCES eal_alerts(id) ON DELETE SET NULL,
  assigned_to UUID REFERENCES user_profiles(id),
  service_desk_ticket_id UUID,
  evidence JSONB DEFAULT '[]',
  timeline JSONB DEFAULT '[]',
  resolution TEXT,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_eal_incidents_status ON eal_incidents(company_id, status);

-- ============================================================
-- APPROVAL TRACEABILITY
-- ============================================================
CREATE TABLE IF NOT EXISTS eal_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  approval_chain_id VARCHAR(64) NOT NULL,
  sequence_no INTEGER DEFAULT 1,
  module VARCHAR(60) NOT NULL,
  entity_type VARCHAR(80),
  entity_id UUID,
  entity_reference VARCHAR(255),
  requestor_id UUID REFERENCES user_profiles(id),
  requestor_name VARCHAR(200),
  approver_id UUID REFERENCES user_profiles(id),
  approver_name VARCHAR(200),
  decision VARCHAR(30) DEFAULT 'pending',
  -- pending | approved | rejected | delegated | skipped
  comments TEXT,
  digital_signature VARCHAR(256),
  previous_approver VARCHAR(200),
  next_approver VARCHAR(200),
  decided_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_eal_approvals_chain ON eal_approvals(company_id, approval_chain_id);
CREATE INDEX IF NOT EXISTS idx_eal_approvals_entity ON eal_approvals(entity_type, entity_id);

-- ============================================================
-- API / EXPORT / PRINT / FILE AUDITS
-- ============================================================
CREATE TABLE IF NOT EXISTS eal_api_calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  method VARCHAR(10) NOT NULL,
  path TEXT NOT NULL,
  status_code INTEGER,
  duration_ms INTEGER,
  user_id UUID REFERENCES user_profiles(id),
  api_key_hint VARCHAR(40),
  oauth_session VARCHAR(80),
  ip_address INET,
  request_bytes INTEGER,
  response_bytes INTEGER,
  rate_limited BOOLEAN DEFAULT false,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_eal_api_created ON eal_api_calls(company_id, created_at DESC);

CREATE TABLE IF NOT EXISTS eal_exports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id UUID REFERENCES user_profiles(id),
  username VARCHAR(150),
  export_format VARCHAR(20) NOT NULL,
  -- excel | pdf | csv | api | email
  module VARCHAR(60),
  entity_type VARCHAR(80),
  record_count INTEGER DEFAULT 0,
  file_size_bytes BIGINT DEFAULT 0,
  contains_sensitive BOOLEAN DEFAULT false,
  after_hours BOOLEAN DEFAULT false,
  risk_score INTEGER DEFAULT 0,
  destination VARCHAR(255),
  status VARCHAR(30) DEFAULT 'completed',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_eal_exports_created ON eal_exports(company_id, created_at DESC);

CREATE TABLE IF NOT EXISTS eal_print_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id UUID REFERENCES user_profiles(id),
  username VARCHAR(150),
  document_name VARCHAR(255),
  document_type VARCHAR(80),
  printer_name VARCHAR(150),
  copies INTEGER DEFAULT 1,
  outcome VARCHAR(40) DEFAULT 'success',
  watermark_applied BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS eal_file_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id UUID REFERENCES user_profiles(id),
  username VARCHAR(150),
  file_name VARCHAR(255) NOT NULL,
  file_type VARCHAR(80),
  action VARCHAR(40) NOT NULL,
  -- upload | download | print | share | delete | restore | revise
  version_no INTEGER DEFAULT 1,
  module VARCHAR(60),
  entity_id UUID,
  ip_address INET,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- COMPLIANCE FRAMEWORKS & EVIDENCE
-- ============================================================
CREATE TABLE IF NOT EXISTS eal_frameworks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  code VARCHAR(40) NOT NULL,
  name VARCHAR(200) NOT NULL,
  description TEXT,
  region VARCHAR(80),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, code)
);

CREATE TABLE IF NOT EXISTS eal_controls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  framework_id UUID NOT NULL REFERENCES eal_frameworks(id) ON DELETE CASCADE,
  control_code VARCHAR(40) NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  category VARCHAR(80),
  status VARCHAR(30) DEFAULT 'implemented',
  -- planned | implemented | partial | not_applicable
  evidence_count INTEGER DEFAULT 0,
  last_reviewed_at TIMESTAMPTZ,
  owner_name VARCHAR(150),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS eal_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  control_id UUID REFERENCES eal_controls(id) ON DELETE SET NULL,
  framework_id UUID REFERENCES eal_frameworks(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  evidence_type VARCHAR(60) DEFAULT 'log_export',
  -- log_export | screenshot | policy | report | interview
  source_module VARCHAR(60),
  event_ids UUID[],
  file_url TEXT,
  period_start DATE,
  period_end DATE,
  collected_by UUID REFERENCES user_profiles(id),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS eal_audit_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  package_number VARCHAR(40) NOT NULL,
  name VARCHAR(200) NOT NULL,
  framework_code VARCHAR(40),
  period_start DATE,
  period_end DATE,
  status VARCHAR(30) DEFAULT 'draft',
  -- draft | ready | exported | archived
  event_count INTEGER DEFAULT 0,
  control_count INTEGER DEFAULT 0,
  export_url TEXT,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  exported_at TIMESTAMPTZ
);

-- ============================================================
-- RETENTION · SAVED FILTERS · AI INSIGHTS
-- ============================================================
CREATE TABLE IF NOT EXISTS eal_retention_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name VARCHAR(150) NOT NULL,
  module_scope VARCHAR(60) DEFAULT '*',
  retention_days INTEGER NOT NULL,
  -- 30 | 90 | 365 | 1095 | 1825 | 2555 | -1 permanent
  archive_after_days INTEGER,
  legal_hold BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS eal_saved_filters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id UUID REFERENCES user_profiles(id),
  name VARCHAR(150) NOT NULL,
  filter_json JSONB NOT NULL DEFAULT '{}',
  is_shared BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS eal_ai_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  insight_type VARCHAR(60) NOT NULL,
  severity VARCHAR(20) DEFAULT 'info',
  title TEXT NOT NULL,
  detail TEXT,
  risk_score INTEGER DEFAULT 0,
  actions JSONB DEFAULT '[]',
  status VARCHAR(30) DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS eal_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  key VARCHAR(100) NOT NULL,
  value JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, key)
);

-- ============================================================
-- RLS
-- ============================================================
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'eal_events','eal_integrity_checkpoints','eal_sessions','eal_alerts',
    'eal_incidents','eal_approvals','eal_api_calls','eal_exports',
    'eal_print_audit','eal_file_audit','eal_frameworks','eal_controls',
    'eal_evidence','eal_audit_packages','eal_retention_policies',
    'eal_saved_filters','eal_ai_insights','eal_config'
  ]
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t || '_all', t);
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR ALL USING (company_id = user_company_id()) WITH CHECK (company_id = user_company_id())',
      t || '_all', t
    );
  END LOOP;
EXCEPTION WHEN OTHERS THEN
  -- user_company_id may vary; fallback open for service role
  NULL;
END $$;

-- ============================================================
-- SEED
-- ============================================================
DO $$
DECLARE
  cid UUID;
  fid_iso UUID;
  fid_soc UUID;
  fid_gdpr UUID;
  fid_ug UUID;
  fid_iso9 UUID;
  n INTEGER;
BEGIN
  SELECT id INTO cid FROM companies ORDER BY created_at LIMIT 1;
  IF cid IS NULL THEN RETURN; END IF;

  INSERT INTO eal_frameworks (company_id, code, name, description, region)
  VALUES
    (cid, 'ISO27001', 'ISO/IEC 27001', 'Information security management system controls', 'Global'),
    (cid, 'ISO9001', 'ISO 9001', 'Quality management — process and change control evidence', 'Global'),
    (cid, 'SOC2', 'SOC 2 Type II', 'Trust services criteria — security, availability, confidentiality', 'Global'),
    (cid, 'GDPR', 'GDPR', 'EU General Data Protection Regulation processing activities', 'EU'),
    (cid, 'UG-DPA', 'Uganda Data Protection and Privacy Act', 'Uganda data protection compliance evidence', 'Uganda'),
    (cid, 'FIN-AUDIT', 'Financial Audit', 'Internal & external financial audit trail requirements', 'Uganda')
  ON CONFLICT (company_id, code) DO NOTHING;

  SELECT id INTO fid_iso FROM eal_frameworks WHERE company_id = cid AND code = 'ISO27001';
  SELECT id INTO fid_soc FROM eal_frameworks WHERE company_id = cid AND code = 'SOC2';
  SELECT id INTO fid_gdpr FROM eal_frameworks WHERE company_id = cid AND code = 'GDPR';
  SELECT id INTO fid_ug FROM eal_frameworks WHERE company_id = cid AND code = 'UG-DPA';
  SELECT id INTO fid_iso9 FROM eal_frameworks WHERE company_id = cid AND code = 'ISO9001';

  IF fid_iso IS NOT NULL AND NOT EXISTS (SELECT 1 FROM eal_controls WHERE company_id = cid AND control_code = 'A.12.4.1') THEN
    INSERT INTO eal_controls (company_id, framework_id, control_code, title, description, category, status, owner_name) VALUES
      (cid, fid_iso, 'A.12.4.1', 'Event logging', 'Event logs recording user activities, exceptions, faults and information security events shall be produced, kept and regularly reviewed.', 'Operations security', 'implemented', 'CISO'),
      (cid, fid_iso, 'A.12.4.2', 'Protection of log information', 'Logging facilities and log information shall be protected against tampering and unauthorized access.', 'Operations security', 'implemented', 'CISO'),
      (cid, fid_iso, 'A.9.2.1', 'User registration', 'A formal user registration and de-registration process shall be implemented.', 'Access control', 'implemented', 'IAM'),
      (cid, fid_iso, 'A.16.1.1', 'Incident management responsibilities', 'Management responsibilities and procedures shall be established for information security incidents.', 'Incident management', 'implemented', 'Security');
  END IF;

  IF fid_soc IS NOT NULL AND NOT EXISTS (SELECT 1 FROM eal_controls WHERE company_id = cid AND control_code = 'CC6.1') THEN
    INSERT INTO eal_controls (company_id, framework_id, control_code, title, description, category, status, owner_name) VALUES
      (cid, fid_soc, 'CC6.1', 'Logical access security', 'The entity implements logical access security software, infrastructure, and architectures over protected information assets.', 'Security', 'implemented', 'IT Security'),
      (cid, fid_soc, 'CC7.2', 'System monitoring', 'The entity monitors system components and the operation of those components for anomalies.', 'Monitoring', 'implemented', 'SOC'),
      (cid, fid_soc, 'CC8.1', 'Change management', 'The entity authorizes, designs, develops, configures, documents, tests, approves, and implements changes.', 'Change', 'partial', 'DevOps');
  END IF;

  IF fid_gdpr IS NOT NULL AND NOT EXISTS (SELECT 1 FROM eal_controls WHERE company_id = cid AND control_code = 'Art.30') THEN
    INSERT INTO eal_controls (company_id, framework_id, control_code, title, description, category, status, owner_name) VALUES
      (cid, fid_gdpr, 'Art.30', 'Records of processing', 'Maintain records of processing activities including audit of access to personal data.', 'Accountability', 'implemented', 'DPO'),
      (cid, fid_gdpr, 'Art.32', 'Security of processing', 'Implement appropriate technical and organisational measures including logging and integrity.', 'Security', 'implemented', 'DPO');
  END IF;

  IF fid_ug IS NOT NULL AND NOT EXISTS (SELECT 1 FROM eal_controls WHERE company_id = cid AND control_code = 'UG-DPA-12') THEN
    INSERT INTO eal_controls (company_id, framework_id, control_code, title, description, category, status, owner_name) VALUES
      (cid, fid_ug, 'UG-DPA-12', 'Security safeguards', 'Data controllers shall implement security safeguards to protect personal data.', 'Security', 'implemented', 'Compliance'),
      (cid, fid_ug, 'UG-DPA-17', 'Data subject access', 'Log and honour access requests; retain evidence of fulfilment.', 'Rights', 'partial', 'Compliance');
  END IF;

  IF fid_iso9 IS NOT NULL AND NOT EXISTS (SELECT 1 FROM eal_controls WHERE company_id = cid AND control_code = '8.5.6') THEN
    INSERT INTO eal_controls (company_id, framework_id, control_code, title, description, category, status, owner_name) VALUES
      (cid, fid_iso9, '8.5.6', 'Control of changes', 'Changes affecting production and service provision shall be reviewed and controlled.', 'Operations', 'implemented', 'Quality');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM eal_retention_policies WHERE company_id = cid) THEN
    INSERT INTO eal_retention_policies (company_id, name, module_scope, retention_days, archive_after_days, is_active) VALUES
      (cid, 'Security events — 7 years', 'security', 2555, 365, true),
      (cid, 'Financial audit — 7 years', 'finance', 2555, 365, true),
      (cid, 'HR / payroll — 5 years', 'hr', 1825, 365, true),
      (cid, 'Operational logs — 1 year', '*', 365, 90, true),
      (cid, 'API telemetry — 90 days', 'api', 90, 30, true),
      (cid, 'Permanent legal hold template', 'legal', -1, NULL, false);
  END IF;

  INSERT INTO eal_config (company_id, key, value)
  VALUES
    (cid, 'alert_channels', '{"email":true,"push":true,"teams":false,"slack":false,"sms":false,"whatsapp":false}'::jsonb),
    (cid, 'ai_thresholds', '{"failed_logins":5,"export_rows":10000,"night_start":22,"night_end":5,"risk_high":75}'::jsonb),
    (cid, 'integrity', '{"chain_enabled":true,"checkpoint_every":1000}'::jsonb)
  ON CONFLICT (company_id, key) DO NOTHING;

  -- Sample enterprise events (only if empty)
  SELECT COUNT(*) INTO n FROM eal_events WHERE company_id = cid;
  IF n = 0 THEN
    INSERT INTO eal_events (
      company_id, audit_id, event_id, correlation_id, username, full_name, user_email, user_role,
      department, branch_name, module, entity_type, event_type, crud_op, action, severity,
      title, details, before_state, after_state, changed_fields, integrity_hash, prev_hash,
      chain_index, risk_score, ip_address, auth_method, mfa_status, timezone
    ) VALUES
    (cid, 'EAL-000001', 'auth.login.success', 'corr-seed-1', 'admin@hopedesign.ug', 'System Administrator', 'admin@hopedesign.ug', 'Super Administrator',
     'IT', 'Kampala HQ', 'authentication', 'session', 'login', 'login', 'User login successful', 'info',
     'Successful login', 'User authenticated with password + MFA', NULL, '{"mfa":true}'::jsonb, NULL,
     'seedhash000001aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', 'GENESIS', 1, 5,
     '10.0.0.10', 'password+mfa', 'verified', 'Africa/Kampala'),
    (cid, 'EAL-000002', 'finance.invoice.created', 'corr-seed-2', 'finance@hopedesign.ug', 'Finance Manager', 'finance@hopedesign.ug', 'Finance Manager',
     'Finance', 'Kampala HQ', 'finance', 'invoice', 'create', 'create', 'Invoice created', 'info',
     'Invoice INV-1001 created', 'Customer Hope Retail — UGX 4,500,000', NULL,
     '{"invoice_number":"INV-1001","amount":4500000}'::jsonb, ARRAY['invoice_number','amount'],
     'seedhash000002bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb', 'seedhash000001aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', 2, 10,
     '10.0.0.22', 'password', 'verified', 'Africa/Kampala'),
    (cid, 'EAL-000003', 'hr.salary.updated', 'corr-seed-3', 'hr@hopedesign.ug', 'HR Manager', 'hr@hopedesign.ug', 'HR Manager',
     'HR', 'Kampala HQ', 'hr', 'employee', 'update', 'update', 'Employee salary changed', 'high',
     'Salary change — EMP-0042', 'Base salary updated',
     '{"salary":2500000}'::jsonb, '{"salary":2900000}'::jsonb, ARRAY['salary'],
     'seedhash000003cccccccccccccccccccccccccccccccccccccccccc', 'seedhash000002bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb', 3, 72,
     '10.0.0.30', 'password+mfa', 'verified', 'Africa/Kampala'),
    (cid, 'EAL-000004', 'auth.login.failed', 'corr-seed-4', 'unknown', 'Unknown', 'attacker@example.com', NULL,
     NULL, NULL, 'authentication', 'session', 'login_failed', 'login', 'Failed login attempt', 'medium',
     'Failed login', 'Invalid credentials for finance@hopedesign.ug', NULL, NULL, NULL,
     'seedhash000004dddddddddddddddddddddddddddddddddddddddddd', 'seedhash000003cccccccccccccccccccccccccccccccccccccccccc', 4, 55,
     '41.210.10.5', 'password', 'none', 'Africa/Kampala'),
    (cid, 'EAL-000005', 'inventory.stock.adjusted', 'corr-seed-5', 'warehouse@hopedesign.ug', 'Warehouse Manager', 'warehouse@hopedesign.ug', 'Warehouse Manager',
     'Warehouse', 'Kampala HQ', 'inventory', 'stock', 'adjust', 'update', 'Stock adjustment', 'info',
     'Stock adjusted SKU-A4-80', 'Cycle count variance',
     '{"qty":1000}'::jsonb, '{"qty":980}'::jsonb, ARRAY['qty'],
     'seedhash000005eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee', 'seedhash000004dddddddddddddddddddddddddddddddddddddddddd', 5, 15,
     '10.0.0.40', 'password', 'verified', 'Africa/Kampala');

    INSERT INTO eal_alerts (company_id, alert_number, alert_type, severity, title, detail, risk_score, status)
    VALUES
      (cid, 'ALT-00001', 'failed_login', 'medium', 'Failed login from external IP', 'Multiple failed attempts for finance mailbox from 41.210.10.5', 55, 'open'),
      (cid, 'ALT-00002', 'payroll_change', 'high', 'High-risk salary change', 'Salary increase EMP-0042 UGX 2.5M → 2.9M by HR Manager', 72, 'open');

    INSERT INTO eal_sessions (company_id, session_id, username, full_name, role_name, ip_address, mfa_verified, auth_method, status, risk_score, geo_country)
    VALUES
      (cid, 'sess-seed-admin', 'admin@hopedesign.ug', 'System Administrator', 'Super Administrator', '10.0.0.10', true, 'password+mfa', 'active', 5, 'UG'),
      (cid, 'sess-seed-fin', 'finance@hopedesign.ug', 'Finance Manager', 'Finance Manager', '10.0.0.22', true, 'password', 'active', 10, 'UG');

    INSERT INTO eal_approvals (company_id, approval_chain_id, sequence_no, module, entity_type, entity_reference, requestor_name, approver_name, decision, comments, previous_approver, next_approver, decided_at)
    VALUES
      (cid, 'PO-CHAIN-100', 1, 'procurement', 'purchase_order', 'PO-2026-0142', 'Procurement Officer', 'Procurement Officer', 'approved', 'Budget verified', NULL, 'Finance Manager', NOW() - INTERVAL '2 days'),
      (cid, 'PO-CHAIN-100', 2, 'procurement', 'purchase_order', 'PO-2026-0142', 'Procurement Officer', 'Finance Manager', 'approved', 'Within budget', 'Procurement Officer', 'Managing Director', NOW() - INTERVAL '1 day'),
      (cid, 'PO-CHAIN-100', 3, 'procurement', 'purchase_order', 'PO-2026-0142', 'Procurement Officer', 'Managing Director', 'approved', 'Approved for production supplies', 'Finance Manager', NULL, NOW() - INTERVAL '6 hours');

    INSERT INTO eal_exports (company_id, username, export_format, module, entity_type, record_count, file_size_bytes, contains_sensitive, after_hours, risk_score, destination)
    VALUES
      (cid, 'finance@hopedesign.ug', 'excel', 'finance', 'invoices', 420, 2048000, true, false, 35, 'local-download'),
      (cid, 'hr@hopedesign.ug', 'pdf', 'payroll', 'payslips', 85, 5120000, true, true, 80, 'email');

    INSERT INTO eal_api_calls (company_id, method, path, status_code, duration_ms, ip_address, rate_limited)
    SELECT cid, 'GET', '/api/health', 200, 12, '127.0.0.1'::inet, false
    WHERE NOT EXISTS (SELECT 1 FROM eal_api_calls WHERE company_id = cid LIMIT 1);

    INSERT INTO eal_print_audit (company_id, username, document_name, document_type, printer_name, copies, outcome, watermark_applied)
    VALUES (cid, 'warehouse@hopedesign.ug', 'Asset Tag HDG-IT-LAP-000001', 'asset_tag', 'Zebra ZD420', 1, 'success', true);

    INSERT INTO eal_file_audit (company_id, username, file_name, file_type, action, version_no, module)
    VALUES
      (cid, 'hr@hopedesign.ug', 'employment-contract-emp0042.pdf', 'pdf', 'upload', 1, 'hr'),
      (cid, 'finance@hopedesign.ug', 'employment-contract-emp0042.pdf', 'pdf', 'download', 1, 'hr');

    INSERT INTO eal_ai_insights (company_id, insight_type, severity, title, detail, risk_score, actions)
    VALUES
      (cid, 'fraud', 'high', 'Salary change without dual approval', 'HR salary updates should require finance co-approval above 10%.', 72, '["Review policy","Open incident"]'::jsonb),
      (cid, 'access', 'medium', 'External failed logins', 'Monitor IP 41.210.10.5 for brute-force patterns.', 55, '["Block IP","Force MFA"]'::jsonb);
  END IF;
END $$;
