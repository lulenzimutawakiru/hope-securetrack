-- Hope Design Group — Enterprise Integration Hub (iPaaS)
-- API gateway · connectors · webhooks · workflows · sync · IoT · monitoring

-- ============================================================
-- PERMISSIONS
-- ============================================================
INSERT INTO permissions (name, slug, module, description)
SELECT v.name, v.slug, v.module, v.description
FROM (VALUES
  ('View Integration Hub', 'intg.view', 'integration', 'View integration hub'),
  ('Manage Integration Hub', 'intg.manage', 'integration', 'Configure connectors and APIs'),
  ('Manage Integration API Keys', 'intg.api', 'integration', 'API keys and developer portal'),
  ('Manage Integration Webhooks', 'intg.webhooks', 'integration', 'Webhooks and event bus'),
  ('Manage Integration Workflows', 'intg.workflows', 'integration', 'Automation builder'),
  ('Integration Security', 'intg.security', 'integration', 'Secrets and zero-trust controls'),
  ('IoT Integrations', 'intg.iot', 'integration', 'MQTT/OPC/Modbus devices'),
  ('Monitor Integrations', 'intg.monitor', 'integration', 'Health, logs, retries')
) AS v(name, slug, module, description)
WHERE NOT EXISTS (SELECT 1 FROM permissions p WHERE p.slug = v.slug OR p.name = v.name);

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE p.slug LIKE 'intg.%'
  AND r.slug IN ('super_administrator','managing_director','operations_manager','auditor')
  AND NOT EXISTS (
    SELECT 1 FROM role_permissions rp WHERE rp.role_id = r.id AND rp.permission_id = p.id
  );

-- ============================================================
-- CONNECTOR CATALOG & INSTANCES
-- ============================================================
CREATE TABLE IF NOT EXISTS intg_connectors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  connector_code VARCHAR(60) NOT NULL,
  name VARCHAR(150) NOT NULL,
  category VARCHAR(50) NOT NULL DEFAULT 'business',
  -- payment | banking | communication | cloud | identity | logistics | iot | hardware | government | ai | document | erp | general
  provider VARCHAR(100),
  protocol VARCHAR(40) DEFAULT 'rest',
  -- rest | graphql | soap | websocket | mqtt | opcua | modbus | sftp | webhook
  description TEXT,
  icon VARCHAR(50),
  is_system BOOLEAN DEFAULT true,
  is_active BOOLEAN DEFAULT true,
  config_schema JSONB DEFAULT '{}'::jsonb,
  auth_type VARCHAR(40) DEFAULT 'api_key',
  -- api_key | oauth2 | jwt | basic | certificate | none
  docs_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(connector_code)
);

CREATE TABLE IF NOT EXISTS intg_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  connector_id UUID REFERENCES intg_connectors(id) ON DELETE SET NULL,
  connection_code VARCHAR(60) NOT NULL,
  name VARCHAR(150) NOT NULL,
  environment VARCHAR(20) DEFAULT 'production',
  -- production | sandbox | staging
  status VARCHAR(30) DEFAULT 'draft',
  -- draft | connected | error | disabled | testing
  base_url TEXT,
  auth_config JSONB DEFAULT '{}'::jsonb, -- secrets stored encrypted at rest ideally
  config JSONB DEFAULT '{}'::jsonb,
  last_tested_at TIMESTAMPTZ,
  last_success_at TIMESTAMPTZ,
  last_error TEXT,
  health_score INTEGER DEFAULT 100,
  is_enabled BOOLEAN DEFAULT true,
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, connection_code)
);

CREATE INDEX IF NOT EXISTS idx_intg_connections_status ON intg_connections(company_id, status);

-- ============================================================
-- API GATEWAY — keys, apps, routes, logs
-- ============================================================
CREATE TABLE IF NOT EXISTS intg_api_apps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  app_code VARCHAR(60) NOT NULL,
  name VARCHAR(150) NOT NULL,
  description TEXT,
  owner_email VARCHAR(255),
  environment VARCHAR(20) DEFAULT 'sandbox',
  status VARCHAR(30) DEFAULT 'active',
  rate_limit_per_min INTEGER DEFAULT 120,
  allowed_scopes TEXT[] DEFAULT ARRAY['read'],
  ip_allowlist TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, app_code)
);

CREATE TABLE IF NOT EXISTS intg_api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  app_id UUID REFERENCES intg_api_apps(id) ON DELETE CASCADE,
  key_prefix VARCHAR(20) NOT NULL,
  key_hash VARCHAR(128) NOT NULL,
  key_hint VARCHAR(20),
  name VARCHAR(100),
  scopes TEXT[] DEFAULT ARRAY['read'],
  expires_at TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ,
  request_count BIGINT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS intg_api_routes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  route_code VARCHAR(80) NOT NULL,
  method VARCHAR(10) DEFAULT 'GET',
  path_pattern VARCHAR(255) NOT NULL,
  version VARCHAR(20) DEFAULT 'v1',
  protocol VARCHAR(20) DEFAULT 'rest',
  target_module VARCHAR(50),
  description TEXT,
  is_public BOOLEAN DEFAULT false,
  rate_limit_per_min INTEGER DEFAULT 60,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, route_code)
);

CREATE TABLE IF NOT EXISTS intg_api_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  app_id UUID REFERENCES intg_api_apps(id) ON DELETE SET NULL,
  api_key_id UUID REFERENCES intg_api_keys(id) ON DELETE SET NULL,
  method VARCHAR(10),
  path TEXT,
  status_code INTEGER,
  duration_ms INTEGER,
  ip_address VARCHAR(50),
  user_agent TEXT,
  error_message TEXT,
  request_id VARCHAR(64),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_intg_api_logs_time ON intg_api_logs(created_at DESC);

-- ============================================================
-- WEBHOOKS & EVENT BUS
-- ============================================================
CREATE TABLE IF NOT EXISTS intg_webhook_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  subscription_code VARCHAR(60) NOT NULL,
  name VARCHAR(150) NOT NULL,
  target_url TEXT NOT NULL,
  secret VARCHAR(100),
  events TEXT[] NOT NULL DEFAULT '{}',
  -- invoice.created | payment.received | stock.changed | employee.created ...
  headers JSONB DEFAULT '{}'::jsonb,
  is_active BOOLEAN DEFAULT true,
  retry_max INTEGER DEFAULT 5,
  timeout_ms INTEGER DEFAULT 10000,
  last_delivery_at TIMESTAMPTZ,
  failure_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, subscription_code)
);

CREATE TABLE IF NOT EXISTS intg_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  event_type VARCHAR(80) NOT NULL,
  source_module VARCHAR(50),
  entity_type VARCHAR(50),
  entity_id UUID,
  payload JSONB DEFAULT '{}'::jsonb,
  status VARCHAR(30) DEFAULT 'pending',
  -- pending | processing | delivered | failed | dead_letter
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_intg_events_status ON intg_events(company_id, status, created_at);

CREATE TABLE IF NOT EXISTS intg_webhook_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES intg_webhook_subscriptions(id) ON DELETE CASCADE,
  event_id UUID REFERENCES intg_events(id) ON DELETE SET NULL,
  attempt INTEGER DEFAULT 1,
  status_code INTEGER,
  response_body TEXT,
  success BOOLEAN DEFAULT false,
  error_message TEXT,
  duration_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- AUTOMATION WORKFLOWS
-- ============================================================
CREATE TABLE IF NOT EXISTS intg_workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  workflow_code VARCHAR(60) NOT NULL,
  name VARCHAR(150) NOT NULL,
  description TEXT,
  trigger_type VARCHAR(40) NOT NULL DEFAULT 'event',
  -- event | schedule | webhook | manual
  trigger_config JSONB DEFAULT '{}'::jsonb,
  steps JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- [{id,type,config,on_error}] type: condition|map|http|email|create_record|notify
  is_active BOOLEAN DEFAULT true,
  version INTEGER DEFAULT 1,
  run_count INTEGER DEFAULT 0,
  last_run_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, workflow_code)
);

CREATE TABLE IF NOT EXISTS intg_workflow_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  workflow_id UUID REFERENCES intg_workflows(id) ON DELETE SET NULL,
  status VARCHAR(30) DEFAULT 'running',
  -- running | success | failed | cancelled
  trigger_payload JSONB DEFAULT '{}'::jsonb,
  step_log JSONB DEFAULT '[]'::jsonb,
  error_message TEXT,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- ============================================================
-- DATA SYNC
-- ============================================================
CREATE TABLE IF NOT EXISTS intg_sync_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  job_code VARCHAR(60) NOT NULL,
  name VARCHAR(150) NOT NULL,
  connection_id UUID REFERENCES intg_connections(id) ON DELETE SET NULL,
  direction VARCHAR(20) DEFAULT 'inbound',
  -- inbound | outbound | bidirectional
  source_entity VARCHAR(80),
  target_entity VARCHAR(80),
  mapping JSONB DEFAULT '{}'::jsonb,
  schedule_cron VARCHAR(80),
  sync_mode VARCHAR(30) DEFAULT 'batch',
  -- realtime | batch | scheduled
  status VARCHAR(30) DEFAULT 'idle',
  last_run_at TIMESTAMPTZ,
  last_status VARCHAR(30),
  records_synced INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, job_code)
);

CREATE TABLE IF NOT EXISTS intg_sync_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  job_id UUID REFERENCES intg_sync_jobs(id) ON DELETE CASCADE,
  status VARCHAR(30) DEFAULT 'running',
  records_read INTEGER DEFAULT 0,
  records_written INTEGER DEFAULT 0,
  records_failed INTEGER DEFAULT 0,
  error_message TEXT,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS intg_field_maps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  map_code VARCHAR(60) NOT NULL,
  name VARCHAR(150) NOT NULL,
  source_system VARCHAR(80),
  target_system VARCHAR(80) DEFAULT 'hope_securetrack',
  mappings JSONB NOT NULL DEFAULT '[]'::jsonb,
  transform_rules JSONB DEFAULT '[]'::jsonb,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, map_code)
);

-- ============================================================
-- MESSAGE QUEUE (logical)
-- ============================================================
CREATE TABLE IF NOT EXISTS intg_queue_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  queue_name VARCHAR(80) NOT NULL DEFAULT 'default',
  message_type VARCHAR(80),
  payload JSONB DEFAULT '{}'::jsonb,
  status VARCHAR(30) DEFAULT 'queued',
  -- queued | processing | done | failed | dead_letter
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 5,
  available_at TIMESTAMPTZ DEFAULT NOW(),
  locked_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_intg_queue ON intg_queue_messages(company_id, queue_name, status, available_at);

-- ============================================================
-- IoT / INDUSTRY 4.0
-- ============================================================
CREATE TABLE IF NOT EXISTS intg_iot_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  device_code VARCHAR(60) NOT NULL,
  name VARCHAR(150) NOT NULL,
  protocol VARCHAR(40) DEFAULT 'mqtt',
  -- mqtt | opcua | modbus | rest | tcp | ethernet_ip
  endpoint TEXT,
  topic VARCHAR(255),
  device_type VARCHAR(50) DEFAULT 'sensor',
  -- sensor | plc | scada | machine | counter | energy
  location_name VARCHAR(150),
  status VARCHAR(30) DEFAULT 'offline',
  last_seen_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::jsonb,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, device_code)
);

CREATE TABLE IF NOT EXISTS intg_iot_telemetry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  device_id UUID REFERENCES intg_iot_devices(id) ON DELETE CASCADE,
  metric VARCHAR(80) NOT NULL,
  -- temperature | pressure | speed | vibration | energy | counter
  value_num DECIMAL(18,6),
  value_text TEXT,
  unit VARCHAR(30),
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_intg_telemetry_time ON intg_iot_telemetry(device_id, recorded_at DESC);

-- ============================================================
-- HARDWARE / GPS
-- ============================================================
CREATE TABLE IF NOT EXISTS intg_hardware_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  device_code VARCHAR(60) NOT NULL,
  name VARCHAR(150) NOT NULL,
  device_class VARCHAR(40) NOT NULL DEFAULT 'printer',
  -- printer | scanner | rfid | biometric | pos | gps
  brand VARCHAR(80),
  model VARCHAR(80),
  connection_type VARCHAR(40) DEFAULT 'network',
  -- network | bluetooth | usb | cloud
  endpoint TEXT,
  status VARCHAR(30) DEFAULT 'unknown',
  last_job_at TIMESTAMPTZ,
  config JSONB DEFAULT '{}'::jsonb,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, device_code)
);

CREATE TABLE IF NOT EXISTS intg_gps_positions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  vehicle_code VARCHAR(60),
  device_id UUID REFERENCES intg_hardware_devices(id) ON DELETE SET NULL,
  latitude DECIMAL(10,7),
  longitude DECIMAL(10,7),
  speed_kmh DECIMAL(8,2),
  fuel_pct DECIMAL(5,2),
  heading DECIMAL(6,2),
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- DEVELOPER PORTAL
-- ============================================================
CREATE TABLE IF NOT EXISTS intg_developer_apps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  app_id UUID REFERENCES intg_api_apps(id) ON DELETE CASCADE,
  display_name VARCHAR(150),
  sandbox_enabled BOOLEAN DEFAULT true,
  docs_published BOOLEAN DEFAULT true,
  webhook_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS intg_sdk_downloads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  sdk_name VARCHAR(80) NOT NULL,
  language VARCHAR(40),
  version VARCHAR(20),
  download_count INTEGER DEFAULT 0,
  package_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- MONITORING / ALERTS / SECRETS
-- ============================================================
CREATE TABLE IF NOT EXISTS intg_health_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  connection_id UUID REFERENCES intg_connections(id) ON DELETE CASCADE,
  check_type VARCHAR(40) DEFAULT 'ping',
  success BOOLEAN DEFAULT false,
  latency_ms INTEGER,
  message TEXT,
  checked_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS intg_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  severity VARCHAR(20) DEFAULT 'warning',
  alert_type VARCHAR(50),
  title VARCHAR(255) NOT NULL,
  message TEXT,
  entity_type VARCHAR(50),
  entity_id UUID,
  status VARCHAR(30) DEFAULT 'open',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS intg_secrets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  secret_code VARCHAR(60) NOT NULL,
  name VARCHAR(150) NOT NULL,
  secret_type VARCHAR(40) DEFAULT 'api_key',
  -- api_key | oauth_token | certificate | password
  value_encrypted TEXT,
  expires_at TIMESTAMPTZ,
  rotated_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, secret_code)
);

CREATE TABLE IF NOT EXISTS intg_module_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  source_module VARCHAR(50) NOT NULL,
  target_module VARCHAR(50) NOT NULL,
  link_type VARCHAR(40) DEFAULT 'event',
  -- event | sync | shared_data | workflow
  event_key VARCHAR(80),
  is_active BOOLEAN DEFAULT true,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- RLS
-- ============================================================
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'intg_connections','intg_api_apps','intg_api_keys','intg_api_routes','intg_api_logs',
    'intg_webhook_subscriptions','intg_events','intg_webhook_deliveries',
    'intg_workflows','intg_workflow_runs','intg_sync_jobs','intg_sync_runs','intg_field_maps',
    'intg_queue_messages','intg_iot_devices','intg_iot_telemetry','intg_hardware_devices',
    'intg_gps_positions','intg_developer_apps','intg_sdk_downloads','intg_health_checks',
    'intg_alerts','intg_secrets','intg_module_links'
  ]
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t || '_all', t);
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR ALL USING (
         company_id = public.user_company_id() OR public.is_super_admin()
       ) WITH CHECK (
         company_id = public.user_company_id() OR public.is_super_admin()
       )',
      t || '_all', t
    );
  END LOOP;
END $$;

-- Connectors catalog is global (company_id null) — allow read to all authenticated
ALTER TABLE intg_connectors ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS intg_connectors_read ON intg_connectors;
CREATE POLICY intg_connectors_read ON intg_connectors FOR SELECT USING (true);
DROP POLICY IF EXISTS intg_connectors_write ON intg_connectors;
CREATE POLICY intg_connectors_write ON intg_connectors FOR ALL
  USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

-- ============================================================
-- SEED CONNECTORS + ROUTES + WORKFLOWS + MODULE LINKS
-- ============================================================
INSERT INTO intg_connectors (connector_code, name, category, provider, protocol, auth_type, description, icon) VALUES
  ('MTN_MOMO', 'MTN Mobile Money', 'payment', 'MTN', 'rest', 'api_key', 'Uganda MTN MoMo collections & refunds', 'Wallet'),
  ('AIRTEL_MONEY', 'Airtel Money', 'payment', 'Airtel', 'rest', 'api_key', 'Airtel Money payments', 'Wallet'),
  ('PESAPAL', 'Pesapal', 'payment', 'Pesapal', 'rest', 'oauth2', 'Card & mobile payments', 'CreditCard'),
  ('STRIPE', 'Stripe', 'payment', 'Stripe', 'rest', 'api_key', 'Global card payments', 'CreditCard'),
  ('FLUTTERWAVE', 'Flutterwave', 'payment', 'Flutterwave', 'rest', 'api_key', 'Africa payment gateway', 'CreditCard'),
  ('PAYPAL', 'PayPal', 'payment', 'PayPal', 'rest', 'oauth2', 'PayPal checkout', 'CreditCard'),
  ('BANK_API', 'Bank Open Banking', 'banking', 'Bank', 'rest', 'oauth2', 'Open banking statements & payments', 'Landmark'),
  ('RESEND', 'Resend Email', 'communication', 'Resend', 'rest', 'api_key', 'Transactional email', 'Mail'),
  ('SMTP', 'SMTP Email', 'communication', 'SMTP', 'rest', 'basic', 'Generic SMTP', 'Mail'),
  ('SENDGRID', 'SendGrid', 'communication', 'SendGrid', 'rest', 'api_key', 'Email delivery', 'Mail'),
  ('TWILIO', 'Twilio SMS', 'communication', 'Twilio', 'rest', 'basic', 'SMS notifications', 'MessageSquare'),
  ('AFRICAS_TALKING', 'Africa''s Talking', 'communication', 'AfricaTalking', 'rest', 'api_key', 'SMS for Africa', 'MessageSquare'),
  ('WHATSAPP', 'WhatsApp Business', 'communication', 'Meta', 'rest', 'oauth2', 'WhatsApp Business API', 'MessageCircle'),
  ('TEAMS', 'Microsoft Teams', 'communication', 'Microsoft', 'rest', 'oauth2', 'Teams notifications', 'Users'),
  ('SLACK', 'Slack', 'communication', 'Slack', 'rest', 'oauth2', 'Slack webhooks', 'Hash'),
  ('ENTRA_ID', 'Microsoft Entra ID', 'identity', 'Microsoft', 'rest', 'oauth2', 'SSO & user sync', 'Shield'),
  ('GOOGLE_WS', 'Google Workspace', 'identity', 'Google', 'rest', 'oauth2', 'SSO & directory', 'Shield'),
  ('OKTA', 'Okta', 'identity', 'Okta', 'rest', 'oauth2', 'Enterprise SSO', 'Shield'),
  ('KEYCLOAK', 'Keycloak', 'identity', 'Keycloak', 'rest', 'oauth2', 'Open-source IdP', 'Shield'),
  ('AWS', 'Amazon Web Services', 'cloud', 'AWS', 'rest', 'api_key', 'AWS services', 'Cloud'),
  ('AZURE', 'Microsoft Azure', 'cloud', 'Azure', 'rest', 'oauth2', 'Azure cloud', 'Cloud'),
  ('GCP', 'Google Cloud', 'cloud', 'Google', 'rest', 'oauth2', 'GCP services', 'Cloud'),
  ('SALESFORCE', 'Salesforce', 'erp', 'Salesforce', 'rest', 'oauth2', 'CRM sync', 'Handshake'),
  ('SAP', 'SAP', 'erp', 'SAP', 'rest', 'oauth2', 'SAP integration', 'Database'),
  ('ORACLE', 'Oracle', 'erp', 'Oracle', 'rest', 'oauth2', 'Oracle Fusion', 'Database'),
  ('DYNAMICS', 'Microsoft Dynamics', 'erp', 'Microsoft', 'rest', 'oauth2', 'Dynamics 365', 'Database'),
  ('GDRIVE', 'Google Drive', 'document', 'Google', 'rest', 'oauth2', 'Document sync', 'Folder'),
  ('ONEDRIVE', 'OneDrive / SharePoint', 'document', 'Microsoft', 'rest', 'oauth2', 'Document library', 'Folder'),
  ('DROPBOX', 'Dropbox', 'document', 'Dropbox', 'rest', 'oauth2', 'File storage', 'Folder'),
  ('ZEBRA', 'Zebra Printers', 'hardware', 'Zebra', 'rest', 'none', 'Label printing', 'Printer'),
  ('NIIMBOT', 'Niimbot Printers', 'hardware', 'Niimbot', 'bluetooth', 'none', 'Mobile label printers', 'Printer'),
  ('RFID_DOOR', 'RFID Access Control', 'hardware', 'Generic', 'rest', 'api_key', 'Door readers & turnstiles', 'Lock'),
  ('BIOMETRIC', 'Biometric Devices', 'hardware', 'Generic', 'rest', 'api_key', 'Fingerprint / face terminals', 'Fingerprint'),
  ('GPS_TRACKER', 'GPS Fleet Tracker', 'logistics', 'Generic', 'mqtt', 'api_key', 'Vehicle GPS tracking', 'MapPin'),
  ('COURIER', 'Courier Platforms', 'logistics', 'Generic', 'rest', 'api_key', 'Delivery platforms', 'Truck'),
  ('MQTT_BROKER', 'MQTT Broker', 'iot', 'Generic', 'mqtt', 'basic', 'IoT message broker', 'Radio'),
  ('OPC_UA', 'OPC-UA Server', 'iot', 'Generic', 'opcua', 'certificate', 'Industrial OPC-UA', 'Cpu'),
  ('MODBUS', 'Modbus TCP', 'iot', 'Generic', 'modbus', 'none', 'PLC / sensors via Modbus', 'Cpu'),
  ('OPENAI', 'OpenAI', 'ai', 'OpenAI', 'rest', 'api_key', 'LLM completions', 'Sparkles'),
  ('AZURE_AI', 'Azure AI', 'ai', 'Microsoft', 'rest', 'api_key', 'Azure OpenAI / cognitive', 'Sparkles'),
  ('LOCAL_AI', 'Local AI Models', 'ai', 'Local', 'rest', 'none', 'On-prem / private models', 'Sparkles'),
  ('URA_EINVOICE', 'URA e-Invoice', 'government', 'URA', 'rest', 'api_key', 'Uganda tax e-invoicing', 'FileCheck'),
  ('TAX_AUTHORITY', 'Tax Authority API', 'government', 'Generic', 'rest', 'certificate', 'VAT / compliance reporting', 'FileCheck')
ON CONFLICT (connector_code) DO NOTHING;

DO $$
DECLARE
  cid UUID;
  c_mtn UUID;
  c_resend UUID;
  c_mqtt UUID;
BEGIN
  SELECT id INTO cid FROM companies ORDER BY created_at LIMIT 1;
  IF cid IS NULL THEN RETURN; END IF;

  SELECT id INTO c_mtn FROM intg_connectors WHERE connector_code = 'MTN_MOMO';
  SELECT id INTO c_resend FROM intg_connectors WHERE connector_code = 'RESEND';
  SELECT id INTO c_mqtt FROM intg_connectors WHERE connector_code = 'MQTT_BROKER';

  INSERT INTO intg_connections (company_id, connector_id, connection_code, name, environment, status, base_url, is_enabled, health_score)
  VALUES
    (cid, c_mtn, 'MTN-PROD', 'MTN MoMo Production', 'production', 'connected', 'https://proxy.momoapi.mtn.com', true, 98),
    (cid, c_resend, 'RESEND-PROD', 'Resend Email', 'production', 'connected', 'https://api.resend.com', true, 100),
    (cid, c_mqtt, 'MQTT-FACTORY', 'Factory MQTT Broker', 'production', 'connected', 'mqtt://factory.local:1883', true, 95)
  ON CONFLICT (company_id, connection_code) DO NOTHING;

  INSERT INTO intg_api_apps (company_id, app_code, name, description, environment, status, rate_limit_per_min, allowed_scopes)
  VALUES
    (cid, 'PARTNER-SANDBOX', 'Partner Sandbox App', 'External developer sandbox', 'sandbox', 'active', 60, ARRAY['read','write']),
    (cid, 'MOBILE-APP', 'Hope SecureTrack Mobile', 'Internal mobile client', 'production', 'active', 300, ARRAY['read','write','payments'])
  ON CONFLICT (company_id, app_code) DO NOTHING;

  INSERT INTO intg_api_routes (company_id, route_code, method, path_pattern, version, target_module, description, is_public)
  VALUES
    (cid, 'health', 'GET', '/api/v1/health', 'v1', 'system', 'Health check', true),
    (cid, 'invoices_list', 'GET', '/api/v1/invoices', 'v1', 'billing', 'List invoices', false),
    (cid, 'invoices_create', 'POST', '/api/v1/invoices', 'v1', 'billing', 'Create invoice', false),
    (cid, 'payments_create', 'POST', '/api/v1/payments', 'v1', 'billing', 'Record payment', false),
    (cid, 'stock_levels', 'GET', '/api/v1/inventory/stock', 'v1', 'inventory', 'Stock balances', false),
    (cid, 'employees', 'GET', '/api/v1/hr/employees', 'v1', 'hr', 'Employee directory', false),
    (cid, 'webhooks_inbound', 'POST', '/api/v1/webhooks/inbound', 'v1', 'integration', 'Inbound webhook receiver', true),
    (cid, 'iot_telemetry', 'POST', '/api/v1/iot/telemetry', 'v1', 'iot', 'Ingest device metrics', false),
    (cid, 'verify_qr', 'GET', '/api/v1/verify/:uuid', 'v1', 'verification', 'Public QR verify', true)
  ON CONFLICT (company_id, route_code) DO NOTHING;

  INSERT INTO intg_webhook_subscriptions (company_id, subscription_code, name, target_url, events, is_active)
  VALUES
    (cid, 'CRM-INVOICE', 'Notify CRM on invoice', 'https://hooks.example.com/crm/invoice', ARRAY['invoice.created','invoice.paid'], true),
    (cid, 'ACCT-PAYMENT', 'Accounting payment sync', 'https://hooks.example.com/accounting/payment', ARRAY['payment.received'], true)
  ON CONFLICT (company_id, subscription_code) DO NOTHING;

  INSERT INTO intg_workflows (company_id, workflow_code, name, description, trigger_type, trigger_config, steps, is_active)
  VALUES
    (cid, 'OPP-WON', 'Won Opportunity → Order → Invoice',
     'CRM win creates customer, project, sales order, invoice',
     'event', '{"event":"crm.opportunity.won"}'::jsonb,
     '[
       {"id":"1","type":"create_record","config":{"entity":"customers","map":"opportunity_to_customer"}},
       {"id":"2","type":"create_record","config":{"entity":"sales_orders"}},
       {"id":"3","type":"create_record","config":{"entity":"invoices"}},
       {"id":"4","type":"notify","config":{"channel":"email","template":"order_created"}}
     ]'::jsonb, true),
    (cid, 'INV-PAID', 'Invoice Paid cascade',
     'Payment received → receipt, CRM, accounting entry, email',
     'event', '{"event":"payment.received"}'::jsonb,
     '[
       {"id":"1","type":"http","config":{"connection":"ACCT-PAYMENT","method":"POST"}},
       {"id":"2","type":"email","config":{"template":"payment_received"}},
       {"id":"3","type":"notify","config":{"channel":"in_app"}}
     ]'::jsonb, true),
    (cid, 'NEW-EMP', 'Employee onboard integrations',
     'HR employee → IAM user, ID card, access, welcome email',
     'event', '{"event":"hr.employee.created"}'::jsonb,
     '[
       {"id":"1","type":"create_record","config":{"entity":"wid_identities"}},
       {"id":"2","type":"create_record","config":{"entity":"user_profiles"}},
       {"id":"3","type":"email","config":{"template":"welcome_employee"}}
     ]'::jsonb, true),
    (cid, 'STOCK-LOW', 'Low stock reorder',
     'Stock below min → create PO draft → notify procurement',
     'event', '{"event":"inventory.stock.low"}'::jsonb,
     '[
       {"id":"1","type":"condition","config":{"field":"qty","op":"lt","value":"reorder_point"}},
       {"id":"2","type":"create_record","config":{"entity":"purchase_orders"}},
       {"id":"3","type":"notify","config":{"channel":"email","to":"procurement"}}
     ]'::jsonb, true)
  ON CONFLICT (company_id, workflow_code) DO NOTHING;

  INSERT INTO intg_module_links (company_id, source_module, target_module, link_type, event_key, description)
  SELECT cid, v.source_module, v.target_module, v.link_type, v.event_key, v.description
  FROM (VALUES
    ('crm', 'sales', 'event', 'crm.opportunity.won', 'Won deal creates sales order'),
    ('sales', 'billing', 'event', 'sales.order.confirmed', 'Order generates invoice'),
    ('billing', 'finance', 'event', 'payment.received', 'Payment posts to AR/GL'),
    ('hr', 'credentials', 'event', 'hr.employee.created', 'Employee gets workforce identity'),
    ('hr', 'iam', 'event', 'hr.employee.created', 'Provision ERP user'),
    ('inventory', 'procurement', 'event', 'inventory.stock.low', 'Auto replenishment'),
    ('production', 'inventory', 'event', 'production.completed', 'Finished goods receipt'),
    ('dispatch', 'billing', 'event', 'dispatch.delivered', 'Invoice from delivery'),
    ('projects', 'billing', 'event', 'project.milestone.ready', 'Milestone billing'),
    ('helpdesk', 'crm', 'event', 'ticket.created', 'Link ticket to account')
  ) AS v(source_module, target_module, link_type, event_key, description)
  WHERE NOT EXISTS (
    SELECT 1 FROM intg_module_links m
    WHERE m.company_id = cid AND m.event_key = v.event_key AND m.source_module = v.source_module
  );

  INSERT INTO intg_sync_jobs (company_id, job_code, name, direction, source_entity, target_entity, sync_mode, status, is_active)
  VALUES
    (cid, 'HR-IAM', 'Employees → IAM users', 'outbound', 'employees', 'user_profiles', 'scheduled', 'idle', true),
    (cid, 'CRM-CUST', 'CRM accounts ↔ Customers', 'bidirectional', 'crm_accounts', 'customers', 'realtime', 'idle', true),
    (cid, 'STOCK-ERP', 'Warehouse stock sync', 'inbound', 'wms_stock', 'stock_balances', 'batch', 'idle', true),
    (cid, 'BANK-STMT', 'Bank statement import', 'inbound', 'bank_api', 'bank_transactions', 'scheduled', 'idle', true)
  ON CONFLICT (company_id, job_code) DO NOTHING;

  INSERT INTO intg_iot_devices (company_id, device_code, name, protocol, device_type, location_name, status, endpoint)
  VALUES
    (cid, 'PLC-LINE1', 'Production Line 1 PLC', 'opcua', 'plc', 'Factory Floor A', 'online', 'opc.tcp://10.0.0.10:4840'),
    (cid, 'SENS-TEMP1', 'Dryer Temperature Sensor', 'mqtt', 'sensor', 'Production', 'online', 'mqtt://factory.local'),
    (cid, 'CNT-PACK1', 'Packing Counter', 'modbus', 'counter', 'Packing Hall', 'online', 'modbus://10.0.0.22:502'),
    (cid, 'ENRG-MAIN', 'Main Energy Meter', 'modbus', 'energy', 'Utilities', 'online', 'modbus://10.0.0.30:502')
  ON CONFLICT (company_id, device_code) DO NOTHING;

  INSERT INTO intg_hardware_devices (company_id, device_code, name, device_class, brand, model, connection_type, status)
  VALUES
    (cid, 'PRT-ZEBRA1', 'Warehouse Zebra ZT230', 'printer', 'Zebra', 'ZT230', 'network', 'online'),
    (cid, 'PRT-NIIMBOT1', 'Mobile Niimbot B21', 'printer', 'Niimbot', 'B21', 'bluetooth', 'online'),
    (cid, 'SCN-QR1', 'Receiving QR Scanner', 'scanner', 'Generic', 'USB-HID', 'usb', 'online'),
    (cid, 'RFID-GATE1', 'Main Gate RFID', 'rfid', 'Generic', 'UHF-Gate', 'network', 'online'),
    (cid, 'GPS-VAN1', 'Delivery Van GPS', 'gps', 'Generic', 'Tracker-4G', 'cloud', 'online')
  ON CONFLICT (company_id, device_code) DO NOTHING;

  INSERT INTO intg_sdk_downloads (company_id, sdk_name, language, version, package_url)
  SELECT cid, v.sdk_name, v.language, v.version, v.package_url
  FROM (VALUES
    ('hope-securetrack-js', 'javascript', '1.0.0', 'https://npm.example.com/hope-securetrack'),
    ('hope-securetrack-py', 'python', '1.0.0', 'https://pypi.example.com/hope-securetrack'),
    ('hope-securetrack-php', 'php', '1.0.0', 'https://packagist.example.com/hope-securetrack')
  ) AS v(sdk_name, language, version, package_url)
  WHERE NOT EXISTS (
    SELECT 1 FROM intg_sdk_downloads s WHERE s.company_id = cid AND s.sdk_name = v.sdk_name
  );

  INSERT INTO intg_field_maps (company_id, map_code, name, source_system, target_system, mappings)
  VALUES
    (cid, 'CRM-CUSTOMER', 'CRM Account → Customer', 'crm', 'hope_securetrack',
     '[{"source":"AccountName","target":"name"},{"source":"Phone","target":"phone"},{"source":"TaxId","target":"tax_id"}]'::jsonb),
    (cid, 'BANK-TXN', 'Bank feed → Bank transaction', 'bank_api', 'hope_securetrack',
     '[{"source":"TxnDate","target":"txn_date"},{"source":"Amount","target":"amount"},{"source":"Narration","target":"description"}]'::jsonb)
  ON CONFLICT (company_id, map_code) DO NOTHING;

END $$;
