-- Hope Design Group Ltd — Reporting Intelligence Phase 2
-- Document Intelligence · DWH · Search · AI Assistant · Classification · Compliance · Visualization catalog

-- ============================================================
-- DOCUMENT INTELLIGENCE (enterprise secure documents)
-- ============================================================
CREATE TABLE IF NOT EXISTS bi_intelligent_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  document_code VARCHAR(50) NOT NULL,
  document_type VARCHAR(50) NOT NULL,
  -- board_paper | meeting_minutes | inspection | batch_report | asset_certificate | qr_certificate | audit_report
  -- invoice | po | payslip | contract | letter | tax_return | quality_cert
  title VARCHAR(255) NOT NULL,
  classification VARCHAR(30) DEFAULT 'internal',
  -- public | internal | confidential | restricted
  version_number VARCHAR(20) DEFAULT '1.0',
  status VARCHAR(30) DEFAULT 'draft',
  -- draft | in_review | approved | published | superseded | archived
  qr_payload TEXT,
  barcode_value VARCHAR(100),
  document_hash VARCHAR(128),
  hash_algorithm VARCHAR(20) DEFAULT 'SHA-256',
  digital_signature TEXT,
  electronic_seal_url TEXT,
  watermark_text VARCHAR(150) DEFAULT 'Hope Design Group Ltd — Confidential',
  digital_certificate_ref VARCHAR(150),
  tamper_status VARCHAR(30) DEFAULT 'verified',
  -- verified | suspicious | tampered | unknown
  approval_chain JSONB DEFAULT '[]',
  -- [{role, name, status, at}]
  content JSONB DEFAULT '{}',
  related_entity_type VARCHAR(50),
  related_entity_id UUID,
  owner_id UUID REFERENCES user_profiles(id),
  approved_by UUID REFERENCES user_profiles(id),
  approved_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  UNIQUE(company_id, document_code)
);

CREATE TABLE IF NOT EXISTS bi_document_revisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  document_id UUID NOT NULL REFERENCES bi_intelligent_documents(id) ON DELETE CASCADE,
  version_number VARCHAR(20) NOT NULL,
  change_summary TEXT,
  document_hash VARCHAR(128),
  snapshot JSONB DEFAULT '{}',
  changed_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bi_intel_docs_type ON bi_intelligent_documents(company_id, document_type) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_bi_intel_docs_class ON bi_intelligent_documents(company_id, classification);

-- ============================================================
-- DATA WAREHOUSE METADATA (star/snowflake catalog)
-- ============================================================
CREATE TABLE IF NOT EXISTS bi_dwh_objects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  object_key VARCHAR(80) NOT NULL,
  object_name VARCHAR(150) NOT NULL,
  object_type VARCHAR(40) NOT NULL,
  -- fact | dimension | bridge | aggregate | mart | lake_zone | cube | scd
  schema_name VARCHAR(50) DEFAULT 'dwh',
  grain TEXT,
  description TEXT,
  columns_meta JSONB DEFAULT '[]',
  relationships JSONB DEFAULT '[]',
  scd_type VARCHAR(10), -- 1 | 2 | 3 | null
  refresh_mode VARCHAR(30) DEFAULT 'batch', -- batch | streaming | hybrid
  row_estimate BIGINT DEFAULT 0,
  last_refreshed_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, object_key)
);

CREATE TABLE IF NOT EXISTS bi_data_marts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  mart_code VARCHAR(50) NOT NULL,
  name VARCHAR(150) NOT NULL,
  domain VARCHAR(50) NOT NULL,
  -- finance | sales | inventory | production | hr | procurement | security | quality
  description TEXT,
  fact_objects TEXT[] DEFAULT '{}',
  dimension_objects TEXT[] DEFAULT '{}',
  owner_name VARCHAR(150),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, mart_code)
);

-- ============================================================
-- VISUALIZATION CATALOG
-- ============================================================
CREATE TABLE IF NOT EXISTS bi_chart_catalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  chart_key VARCHAR(50) NOT NULL,
  name VARCHAR(100) NOT NULL,
  category VARCHAR(40) DEFAULT 'standard',
  -- comparison | composition | distribution | relationship | temporal | geo | hierarchical | process
  description TEXT,
  is_enabled BOOLEAN DEFAULT true,
  sample_config JSONB DEFAULT '{}',
  UNIQUE(company_id, chart_key)
);

-- ============================================================
-- ENTERPRISE SEARCH INDEX (lightweight federated search)
-- ============================================================
CREATE TABLE IF NOT EXISTS bi_search_index (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  entity_type VARCHAR(50) NOT NULL,
  entity_id UUID,
  title VARCHAR(255) NOT NULL,
  subtitle VARCHAR(255),
  body_text TEXT,
  module_key VARCHAR(50),
  href VARCHAR(255),
  classification VARCHAR(30) DEFAULT 'internal',
  tags TEXT[] DEFAULT '{}',
  search_vector tsvector,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bi_search_vector ON bi_search_index USING GIN(search_vector);
CREATE INDEX IF NOT EXISTS idx_bi_search_type ON bi_search_index(company_id, entity_type);

CREATE OR REPLACE FUNCTION bi_search_index_tsv() RETURNS trigger AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', coalesce(NEW.title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW.subtitle, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(NEW.body_text, '')), 'C');
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_bi_search_tsv ON bi_search_index;
CREATE TRIGGER tr_bi_search_tsv
  BEFORE INSERT OR UPDATE ON bi_search_index
  FOR EACH ROW EXECUTE FUNCTION bi_search_index_tsv();

-- ============================================================
-- AI EXECUTIVE ASSISTANT Q&A
-- ============================================================
CREATE TABLE IF NOT EXISTS bi_assistant_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id UUID REFERENCES user_profiles(id),
  title VARCHAR(255) DEFAULT 'Executive session',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bi_assistant_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  session_id UUID REFERENCES bi_assistant_sessions(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL, -- user | assistant | system
  content TEXT NOT NULL,
  intent VARCHAR(50),
  -- production | supplier | customer | forecast | board | budget | general
  sources JSONB DEFAULT '[]',
  confidence DECIMAL(5,4),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bi_assistant_playbooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  trigger_pattern TEXT NOT NULL,
  intent VARCHAR(50) NOT NULL,
  answer_template TEXT NOT NULL,
  data_hooks JSONB DEFAULT '[]',
  is_active BOOLEAN DEFAULT true
);

-- ============================================================
-- ANALYTICS MODELS & FORECAST RESULTS
-- ============================================================
CREATE TABLE IF NOT EXISTS bi_analytics_models (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  model_code VARCHAR(50) NOT NULL,
  name VARCHAR(150) NOT NULL,
  analytics_type VARCHAR(40) NOT NULL,
  -- descriptive | diagnostic | predictive | prescriptive | behavior | customer | supplier | manufacturing | financial | operational | workforce | market | profitability | cost
  domain VARCHAR(50),
  algorithm VARCHAR(80),
  status VARCHAR(30) DEFAULT 'active',
  last_run_at TIMESTAMPTZ,
  metrics JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, model_code)
);

CREATE TABLE IF NOT EXISTS bi_forecast_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  model_id UUID REFERENCES bi_analytics_models(id) ON DELETE SET NULL,
  metric_key VARCHAR(80) NOT NULL,
  period_start DATE,
  period_end DATE,
  forecast_value DECIMAL(18,4),
  lower_bound DECIMAL(18,4),
  upper_bound DECIMAL(18,4),
  actual_value DECIMAL(18,4),
  unit VARCHAR(30),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- REPORT CLASSIFICATION & SHARE / APPROVAL
-- ============================================================
ALTER TABLE bi_report_definitions
  ADD COLUMN IF NOT EXISTS classification VARCHAR(30) DEFAULT 'internal',
  ADD COLUMN IF NOT EXISTS requires_mfa BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS watermark_exports BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS mask_sensitive BOOLEAN DEFAULT false;

ALTER TABLE bi_report_schedules
  ADD COLUMN IF NOT EXISTS delivery_channels JSONB DEFAULT '["email"]',
  -- email | sms | whatsapp | teams | slack | gdrive | sharepoint | ftp | sftp | portal
  ADD COLUMN IF NOT EXISTS classification VARCHAR(30) DEFAULT 'internal';

CREATE TABLE IF NOT EXISTS bi_report_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  report_id UUID REFERENCES bi_report_definitions(id) ON DELETE CASCADE,
  dashboard_id UUID REFERENCES bi_dashboards(id) ON DELETE CASCADE,
  shared_with_email VARCHAR(255),
  shared_with_role VARCHAR(100),
  permission_level VARCHAR(30) DEFAULT 'view', -- view | export | edit
  expires_at TIMESTAMPTZ,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bi_report_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  entity_type VARCHAR(40) NOT NULL, -- report | document | export | board_pack
  entity_id UUID NOT NULL,
  step_order INTEGER DEFAULT 1,
  approver_role VARCHAR(100),
  status VARCHAR(30) DEFAULT 'pending', -- pending | approved | rejected
  comments TEXT,
  acted_by UUID REFERENCES user_profiles(id),
  acted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- NOTIFICATION DELIVERY QUEUE (multi-channel)
-- ============================================================
CREATE TABLE IF NOT EXISTS bi_notification_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  channel VARCHAR(30) NOT NULL,
  recipient VARCHAR(255) NOT NULL,
  subject VARCHAR(255),
  body TEXT,
  payload JSONB DEFAULT '{}',
  status VARCHAR(30) DEFAULT 'queued',
  related_type VARCHAR(50),
  related_id UUID,
  scheduled_for TIMESTAMPTZ DEFAULT NOW(),
  sent_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ARCHITECTURE SERVICE REGISTRY (ops visibility)
-- ============================================================
CREATE TABLE IF NOT EXISTS bi_service_registry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  service_key VARCHAR(50) NOT NULL,
  service_name VARCHAR(150) NOT NULL,
  tier VARCHAR(30) DEFAULT 'core',
  -- core | worker | ai | edge
  status VARCHAR(30) DEFAULT 'healthy',
  endpoint_hint VARCHAR(255),
  description TEXT,
  last_heartbeat TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, service_key)
);

-- ============================================================
-- SEEDS
-- ============================================================
INSERT INTO bi_intelligent_documents (
  company_id, document_code, document_type, title, classification, version_number, status,
  qr_payload, barcode_value, document_hash, watermark_text, digital_certificate_ref,
  tamper_status, approval_chain, content
) VALUES
  (
    'a0000000-0000-4000-8000-000000000001', 'DOC-BOARD-2026-Q2', 'board_paper',
    'Board Paper — Q2 Strategic Performance', 'restricted', '1.2', 'approved',
    'HDG:BOARD:Q2:2026', 'BOARD-Q2-2026',
    'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    'Hope Design Group Ltd — BOARD RESTRICTED', 'CERT-HDG-BOARD-01',
    'verified',
    '[{"role":"CFO","name":"Finance Director","status":"approved"},{"role":"MD","name":"Managing Director","status":"approved"}]'::jsonb,
    '{"agenda":"Strategic KPIs and capital plan","period":"2026-Q2"}'::jsonb
  ),
  (
    'a0000000-0000-4000-8000-000000000001', 'DOC-MIN-2026-07', 'meeting_minutes',
    'Management Meeting Minutes — July 2026', 'confidential', '1.0', 'published',
    'HDG:MIN:2026-07', 'MIN-2026-07',
    'a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3',
    'Hope Design Group Ltd — Confidential', 'CERT-HDG-CORP-01',
    'verified',
    '[{"role":"Company Secretary","status":"approved"}]'::jsonb,
    '{"attendees":["MD","FD","PM","HR"],"decisions":3}'::jsonb
  ),
  (
    'a0000000-0000-4000-8000-000000000001', 'DOC-INSP-FAC-001', 'inspection',
    'Factory Floor Inspection Report — Line 1', 'internal', '1.0', 'approved',
    'HDG:INSP:FAC1', 'INSP-FAC-001',
    '2c26b46b68ffc68ff99b453c1d30413413422d706483bfa0f98a5e886266e7ae',
    'Hope Design Group Ltd — Internal', 'CERT-HDG-QA-01',
    'verified',
    '[{"role":"QC Manager","status":"approved"}]'::jsonb,
    '{"findings":2,"severity":"medium"}'::jsonb
  ),
  (
    'a0000000-0000-4000-8000-000000000001', 'DOC-BATCH-BAT-00042', 'batch_report',
    'Manufacturing Batch Report BAT-2026-00042', 'internal', '1.0', 'published',
    'HDG:BATCH:00042', 'BAT-2026-00042',
    'fcde2b2edba56bf408601fb721fe9b5c338d10ee429ea04fae5511b68fbf8fb9',
    'Hope Design Group Ltd — Batch Controlled', 'CERT-HDG-PRD-01',
    'verified',
    '[{"role":"Production Manager","status":"approved"},{"role":"QC","status":"approved"}]'::jsonb,
    '{"yield_pct":97.2,"scrap_pct":1.1}'::jsonb
  ),
  (
    'a0000000-0000-4000-8000-000000000001', 'DOC-ASSET-CERT-PRN01', 'asset_certificate',
    'Asset Certificate — Press Line PRN-01', 'internal', '1.0', 'approved',
    'HDG:ASSET:PRN01', 'ASSET-PRN-01',
    '4b227777d4dd1fc61c6f884f48641d02b4d121d3fd328cb08b5531fcacdabf8a',
    'Hope Design Group Ltd — Asset Register', 'CERT-HDG-FA-01',
    'verified',
    '[{"role":"Asset Controller","status":"approved"}]'::jsonb,
    '{"asset_code":"PRN-01","status":"active"}'::jsonb
  ),
  (
    'a0000000-0000-4000-8000-000000000001', 'DOC-QR-CERT-SAMPLE', 'qr_certificate',
    'QR Authenticity Certificate — Sample Lot', 'public', '1.0', 'published',
    'HDG:QR:SAMPLE', 'QR-CERT-SAMPLE',
    'ef2d127de37b942baad06145e54b0c619a1f22327b2ebbcfbec78f5564afe39d',
    'Hope Design Group Ltd — SecureTrack', 'CERT-HDG-QR-01',
    'verified',
    '[{"role":"Security Officer","status":"approved"}]'::jsonb,
    '{"verification_url":"/verify"}'::jsonb
  ),
  (
    'a0000000-0000-4000-8000-000000000001', 'DOC-AUDIT-2026-H1', 'audit_report',
    'Internal Audit Report — H1 2026', 'restricted', '1.1', 'in_review',
    'HDG:AUDIT:2026H1', 'AUDIT-2026-H1',
    'e7f6c011776e8db7cd330b54174fd76f7d0216b612387a5ffcfb81e6f0919683',
    'Hope Design Group Ltd — AUDIT RESTRICTED', 'CERT-HDG-AUD-01',
    'verified',
    '[{"role":"Internal Auditor","status":"approved"},{"role":"Board Audit Committee","status":"pending"}]'::jsonb,
    '{"findings":5,"high":1}'::jsonb
  )
ON CONFLICT (company_id, document_code) DO NOTHING;

INSERT INTO bi_document_revisions (company_id, document_id, version_number, change_summary, document_hash)
SELECT d.company_id, d.id, '1.0', 'Initial published version', d.document_hash
FROM bi_intelligent_documents d
WHERE d.company_id = 'a0000000-0000-4000-8000-000000000001'
  AND NOT EXISTS (
    SELECT 1 FROM bi_document_revisions r WHERE r.document_id = d.id AND r.version_number = '1.0'
  );

INSERT INTO bi_dwh_objects (company_id, object_key, object_name, object_type, grain, description, scd_type, row_estimate, columns_meta)
VALUES
  ('a0000000-0000-4000-8000-000000000001', 'fact_sales', 'Fact Sales', 'fact', 'invoice line / day', 'Sales amounts by customer product branch', NULL, 1250000, '[{"name":"amount","type":"decimal"},{"name":"qty","type":"decimal"}]'::jsonb),
  ('a0000000-0000-4000-8000-000000000001', 'fact_production', 'Fact Production', 'fact', 'batch / day', 'Production output yield scrap', NULL, 480000, '[{"name":"good_qty","type":"decimal"},{"name":"scrap_qty","type":"decimal"}]'::jsonb),
  ('a0000000-0000-4000-8000-000000000001', 'fact_inventory', 'Fact Inventory Movement', 'fact', 'movement line', 'Stock movements GRN issue transfer', NULL, 2100000, '[]'::jsonb),
  ('a0000000-0000-4000-8000-000000000001', 'fact_gl', 'Fact GL Balance', 'fact', 'account / period', 'GL balances for IFRS packs', NULL, 96000, '[]'::jsonb),
  ('a0000000-0000-4000-8000-000000000001', 'dim_date', 'Dim Date', 'dimension', 'day', 'Calendar fiscal attributes', NULL, 3650, '[]'::jsonb),
  ('a0000000-0000-4000-8000-000000000001', 'dim_customer', 'Dim Customer', 'dimension', 'customer', 'Customer SCD2', '2', 8500, '[]'::jsonb),
  ('a0000000-0000-4000-8000-000000000001', 'dim_product', 'Dim Product', 'dimension', 'sku', 'Product hierarchy', '2', 4200, '[]'::jsonb),
  ('a0000000-0000-4000-8000-000000000001', 'dim_supplier', 'Dim Supplier', 'dimension', 'supplier', 'Supplier master SCD2', '2', 1200, '[]'::jsonb),
  ('a0000000-0000-4000-8000-000000000001', 'dim_employee', 'Dim Employee', 'dimension', 'employee', 'Workforce dimension', '2', 350, '[]'::jsonb),
  ('a0000000-0000-4000-8000-000000000001', 'dim_branch', 'Dim Branch', 'dimension', 'branch', 'Company sites', '1', 25, '[]'::jsonb),
  ('a0000000-0000-4000-8000-000000000001', 'cube_finance', 'OLAP Finance Cube', 'cube', 'period x account x branch', 'Finance multidimensional cube', NULL, 0, '[]'::jsonb),
  ('a0000000-0000-4000-8000-000000000001', 'lake_raw_events', 'Data Lake — Raw Events', 'lake_zone', 'event', 'Raw ERP event stream zone', NULL, 15000000, '[]'::jsonb)
ON CONFLICT (company_id, object_key) DO NOTHING;

INSERT INTO bi_data_marts (company_id, mart_code, name, domain, description, fact_objects, dimension_objects, owner_name)
VALUES
  ('a0000000-0000-4000-8000-000000000001', 'MART-FIN', 'Finance Data Mart', 'finance', 'IFRS & management accounting', ARRAY['fact_sales','fact_gl'], ARRAY['dim_date','dim_branch','dim_customer'], 'Finance Director'),
  ('a0000000-0000-4000-8000-000000000001', 'MART-PRD', 'Production Data Mart', 'production', 'Yield QC capacity', ARRAY['fact_production'], ARRAY['dim_date','dim_product','dim_branch'], 'Production Manager'),
  ('a0000000-0000-4000-8000-000000000001', 'MART-INV', 'Inventory Data Mart', 'inventory', 'Stock turns valuation', ARRAY['fact_inventory'], ARRAY['dim_date','dim_product','dim_branch'], 'Inventory Controller'),
  ('a0000000-0000-4000-8000-000000000001', 'MART-HR', 'HR Data Mart', 'hr', 'Headcount payroll productivity', ARRAY[]::text[], ARRAY['dim_employee','dim_date','dim_branch'], 'HR Manager'),
  ('a0000000-0000-4000-8000-000000000001', 'MART-SEC', 'Security Data Mart', 'security', 'Verification fraud compliance', ARRAY[]::text[], ARRAY['dim_date','dim_branch'], 'Security Officer')
ON CONFLICT (company_id, mart_code) DO NOTHING;

INSERT INTO bi_chart_catalog (company_id, chart_key, name, category, description)
VALUES
  ('a0000000-0000-4000-8000-000000000001', 'bar', 'Bar', 'comparison', 'Category comparison'),
  ('a0000000-0000-4000-8000-000000000001', 'column', 'Column', 'comparison', 'Vertical comparison'),
  ('a0000000-0000-4000-8000-000000000001', 'pie', 'Pie', 'composition', 'Part-to-whole'),
  ('a0000000-0000-4000-8000-000000000001', 'donut', 'Donut', 'composition', 'Part-to-whole with center KPI'),
  ('a0000000-0000-4000-8000-000000000001', 'area', 'Area', 'temporal', 'Cumulative trends'),
  ('a0000000-0000-4000-8000-000000000001', 'spline', 'Spline', 'temporal', 'Smoothed trends'),
  ('a0000000-0000-4000-8000-000000000001', 'radar', 'Radar', 'comparison', 'Multi-axis scorecards'),
  ('a0000000-0000-4000-8000-000000000001', 'bubble', 'Bubble', 'relationship', '3-variable scatter'),
  ('a0000000-0000-4000-8000-000000000001', 'treemap', 'Treemap', 'hierarchical', 'Hierarchical composition'),
  ('a0000000-0000-4000-8000-000000000001', 'heatmap', 'Heat Map', 'distribution', 'Intensity matrix'),
  ('a0000000-0000-4000-8000-000000000001', 'geomap', 'Geo Map', 'geo', 'Geographic performance'),
  ('a0000000-0000-4000-8000-000000000001', 'gauge', 'Gauge', 'comparison', 'KPI target meter'),
  ('a0000000-0000-4000-8000-000000000001', 'waterfall', 'Waterfall', 'composition', 'Bridge analysis'),
  ('a0000000-0000-4000-8000-000000000001', 'funnel', 'Funnel', 'process', 'Conversion stages'),
  ('a0000000-0000-4000-8000-000000000001', 'scatter', 'Scatter', 'relationship', 'Correlation'),
  ('a0000000-0000-4000-8000-000000000001', 'boxplot', 'Box Plot', 'distribution', 'Statistical spread'),
  ('a0000000-0000-4000-8000-000000000001', 'candlestick', 'Candlestick', 'temporal', 'OHLC financial'),
  ('a0000000-0000-4000-8000-000000000001', 'gantt', 'Gantt', 'temporal', 'Project schedules'),
  ('a0000000-0000-4000-8000-000000000001', 'sankey', 'Sankey', 'process', 'Flow volumes'),
  ('a0000000-0000-4000-8000-000000000001', 'sunburst', 'Sunburst', 'hierarchical', 'Radial hierarchy'),
  ('a0000000-0000-4000-8000-000000000001', 'timeline', 'Timeline', 'temporal', 'Event chronology'),
  ('a0000000-0000-4000-8000-000000000001', 'network', 'Network Graph', 'relationship', 'Entity relationships')
ON CONFLICT (company_id, chart_key) DO NOTHING;

INSERT INTO bi_analytics_models (company_id, model_code, name, analytics_type, domain, algorithm, status, metrics)
VALUES
  ('a0000000-0000-4000-8000-000000000001', 'MDL-DESC-OPS', 'Operational Descriptive', 'descriptive', 'operations', 'aggregation', 'active', '{"freshness":"hourly"}'::jsonb),
  ('a0000000-0000-4000-8000-000000000001', 'MDL-DIAG-YIELD', 'Yield Root Cause', 'diagnostic', 'production', 'decision_tree', 'active', '{}'::jsonb),
  ('a0000000-0000-4000-8000-000000000001', 'MDL-PRED-DEMAND', 'Paper Demand Forecast', 'predictive', 'scm', 'prophet', 'active', '{"mape":0.08}'::jsonb),
  ('a0000000-0000-4000-8000-000000000001', 'MDL-PRES-REORD', 'Replenishment Prescription', 'prescriptive', 'inventory', 'optimizer', 'active', '{}'::jsonb),
  ('a0000000-0000-4000-8000-000000000001', 'MDL-CUST-PROFIT', 'Customer Profitability', 'profitability', 'sales', 'contribution_margin', 'active', '{}'::jsonb),
  ('a0000000-0000-4000-8000-000000000001', 'MDL-SUP-RISK', 'Supplier Delay Model', 'supplier', 'procurement', 'survival', 'active', '{}'::jsonb),
  ('a0000000-0000-4000-8000-000000000001', 'MDL-FIN-CASH', 'Cash Flow Forecast', 'financial', 'finance', 'arima', 'active', '{}'::jsonb),
  ('a0000000-0000-4000-8000-000000000001', 'MDL-HR-ATTR', 'Attrition Risk', 'workforce', 'hr', 'logistic_regression', 'active', '{}'::jsonb),
  ('a0000000-0000-4000-8000-000000000001', 'MDL-COST-ABC', 'Activity Cost Analytics', 'cost', 'finance', 'abc', 'active', '{}'::jsonb),
  ('a0000000-0000-4000-8000-000000000001', 'MDL-MKT-SEG', 'Market Segment Analytics', 'market', 'sales', 'clustering', 'active', '{}'::jsonb)
ON CONFLICT (company_id, model_code) DO NOTHING;

INSERT INTO bi_forecast_results (company_id, metric_key, period_start, period_end, forecast_value, lower_bound, upper_bound, unit)
VALUES
  ('a0000000-0000-4000-8000-000000000001', 'paper_demand_tonnes', '2026-08-01', '2026-09-30', 420, 380, 460, 'tonnes'),
  ('a0000000-0000-4000-8000-000000000001', 'revenue_ugx', '2026-08-01', '2026-09-30', 485000000, 450000000, 520000000, 'UGX'),
  ('a0000000-0000-4000-8000-000000000001', 'cash_closing', '2026-08-01', '2026-08-31', 162000000, 140000000, 185000000, 'UGX');

INSERT INTO bi_assistant_playbooks (company_id, trigger_pattern, intent, answer_template, data_hooks)
VALUES
  ('a0000000-0000-4000-8000-000000000001', 'production efficiency|yield decline|efficiency decline', 'production',
   'Production efficiency recently tracked at {{peff}}% vs target {{target}}%. Root-cause AI links humidity control on Line-1 afternoon shift and elevated scrap. Recommend HVAC calibration and QC refresh training.',
   '["KPI-PEFF","bi_ai_insights"]'::jsonb),
  ('a0000000-0000-4000-8000-000000000001', 'supplier.*delay|highest delivery', 'supplier',
   'Supplier lead-time KPI is {{slt}} days vs target 7. AI flags primary ink supplier degradation (+35%). Activate dual-source and expedite alternate PO.',
   '["KPI-SLT"]'::jsonb),
  ('a0000000-0000-4000-8000-000000000001', 'top.*customer|customers by profit', 'customer',
   'Top customers by contribution margin are currently ranked from AR/sales extracts. Open Sales Dashboard and CRM profitability model MDL-CUST-PROFIT for the live top-five list.',
   '["MDL-CUST-PROFIT"]'::jsonb),
  ('a0000000-0000-4000-8000-000000000001', 'paper demand|predict.*quarter|next quarter', 'forecast',
   'Paper demand forecast for the next horizon is {{demand}} tonnes (range {{low}}–{{high}}). Increase safety stock and confirm mill POs for security grades.',
   '["paper_demand_tonnes"]'::jsonb),
  ('a0000000-0000-4000-8000-000000000001', 'board report|board pack|generate board', 'board',
   'Board pack DOC-BOARD-2026-Q2 is available under Document Intelligence (restricted). I can open Executive Center and the Board dashboard for KPI trees and critical AI signals.',
   '["board_paper"]'::jsonb),
  ('a0000000-0000-4000-8000-000000000001', 'budget|exceeded|department.*budget', 'budget',
   'Budget variance is monitored via Finance marts and KPI Working Capital / Net Profit. Review Finance Dashboard cost centres and open budgets with status approved for overspend flags.',
   '["budgets"]'::jsonb)
ON CONFLICT DO NOTHING;

-- Federated search seed samples
INSERT INTO bi_search_index (company_id, entity_type, title, subtitle, body_text, module_key, href, classification, tags)
VALUES
  ('a0000000-0000-4000-8000-000000000001', 'report', 'Trial Balance', 'Financial report', 'GL trial balance IFRS working', 'finance', '/dashboard/reports/library', 'internal', ARRAY['finance','ifrs']),
  ('a0000000-0000-4000-8000-000000000001', 'document', 'Board Paper Q2', 'Board restricted pack', 'Strategic performance capital plan board', 'reports', '/dashboard/reports/intelligence', 'restricted', ARRAY['board']),
  ('a0000000-0000-4000-8000-000000000001', 'document', 'QR Authenticity Certificate', 'Public certificate', 'SecureTrack verification certificate', 'security', '/dashboard/reports/intelligence', 'public', ARRAY['qr']),
  ('a0000000-0000-4000-8000-000000000001', 'kpi', 'On-Time Delivery', 'Logistics KPI', 'OTD shipments delivery performance', 'scm', '/dashboard/reports/kpis', 'internal', ARRAY['kpi']),
  ('a0000000-0000-4000-8000-000000000001', 'dashboard', 'CEO Dashboard', 'Executive', 'Strategic CEO performance dashboard', 'reports', '/dashboard/reports/dashboards', 'confidential', ARRAY['ceo']),
  ('a0000000-0000-4000-8000-000000000001', 'invoice', 'Sales invoices', 'AR documents', 'Customer tax invoices receivables', 'finance', '/dashboard/invoices', 'internal', ARRAY['ar']),
  ('a0000000-0000-4000-8000-000000000001', 'employee', 'Employees', 'HR master', 'Headcount payroll leave', 'hr', '/dashboard/hr/employees', 'confidential', ARRAY['hr']),
  ('a0000000-0000-4000-8000-000000000001', 'supplier', 'Suppliers', 'Procurement', 'Supplier master performance lead times', 'procurement', '/dashboard/procurement/suppliers', 'internal', ARRAY['procurement']),
  ('a0000000-0000-4000-8000-000000000001', 'batch', 'Production batches', 'Manufacturing', 'Batch yield scrap QC status', 'production', '/dashboard/production', 'internal', ARRAY['production']),
  ('a0000000-0000-4000-8000-000000000001', 'contract', 'Contracts', 'Legal commercial', 'Customer supplier contracts', 'crm', '/dashboard/crm/contracts', 'confidential', ARRAY['legal']),
  ('a0000000-0000-4000-8000-000000000001', 'po', 'Purchase orders', 'Procurement documents', 'PO cycle GRN three-way match', 'procurement', '/dashboard/procurement/orders', 'internal', ARRAY['po']),
  ('a0000000-0000-4000-8000-000000000001', 'asset', 'Fixed assets', 'Asset register', 'Asset certificates depreciation', 'finance', '/dashboard/finance/assets', 'internal', ARRAY['assets']);

INSERT INTO bi_service_registry (company_id, service_key, service_name, tier, status, endpoint_hint, description)
VALUES
  ('a0000000-0000-4000-8000-000000000001', 'report-svc', 'Reporting Service', 'core', 'healthy', '/api/reports', 'Report definition & execution'),
  ('a0000000-0000-4000-8000-000000000001', 'scheduler-svc', 'Report Scheduler', 'worker', 'healthy', 'cron-worker', 'Hourly–annual + cron delivery'),
  ('a0000000-0000-4000-8000-000000000001', 'notify-svc', 'Notification Service', 'worker', 'healthy', 'queue', 'Email SMS WhatsApp Teams Slack'),
  ('a0000000-0000-4000-8000-000000000001', 'dashboard-svc', 'Dashboard Service', 'core', 'healthy', '/dashboard/reports/dashboards', 'Widget layouts live refresh'),
  ('a0000000-0000-4000-8000-000000000001', 'bi-svc', 'BI Service', 'core', 'healthy', '/dashboard/reports', 'OLAP KPI cube analytics'),
  ('a0000000-0000-4000-8000-000000000001', 'ai-engine', 'AI Analytics Engine', 'ai', 'healthy', '/dashboard/reports/assistant', 'Forecasts assistant insights'),
  ('a0000000-0000-4000-8000-000000000001', 'doc-render', 'Document Rendering', 'core', 'healthy', '/dashboard/reports/intelligence', 'PDF seals QR barcodes hashes'),
  ('a0000000-0000-4000-8000-000000000001', 'export-svc', 'Export Service', 'worker', 'healthy', '/dashboard/reports/export', 'CSV Excel PDF watermarked'),
  ('a0000000-0000-4000-8000-000000000001', 'search-svc', 'Search Service', 'core', 'healthy', '/dashboard/reports/search', 'Global enterprise search'),
  ('a0000000-0000-4000-8000-000000000001', 'audit-svc', 'Audit Service', 'core', 'healthy', '/dashboard/audit', 'Immutable trails'),
  ('a0000000-0000-4000-8000-000000000001', 'api-gw', 'API Gateway', 'edge', 'healthy', '/api', 'Rate limits auth'),
  ('a0000000-0000-4000-8000-000000000001', 'event-stream', 'Event Streaming', 'worker', 'healthy', 'events', 'ERP change capture'),
  ('a0000000-0000-4000-8000-000000000001', 'queue-workers', 'Queue Workers', 'worker', 'healthy', 'jobs', 'Background jobs'),
  ('a0000000-0000-4000-8000-000000000001', 'cache-redis', 'Redis Cache', 'edge', 'healthy', 'cache', 'Report & dashboard cache'),
  ('a0000000-0000-4000-8000-000000000001', 'cdn', 'CDN Edge', 'edge', 'healthy', 'cdn', 'Static asset delivery')
ON CONFLICT (company_id, service_key) DO NOTHING;

-- Expand regulatory packages for ISO / IFRS
INSERT INTO bi_regulatory_packages (company_id, package_code, name, authority, filing_frequency, due_day, checklist)
VALUES
  ('a0000000-0000-4000-8000-000000000001', 'REG-IFRS', 'IFRS Financial Statements Pack', 'IFRS / Board', 'quarterly', 45,
   '[{"item":"Trial balance","done":false},{"item":"P&L","done":false},{"item":"Balance sheet","done":false},{"item":"Cash flow","done":false},{"item":"Notes","done":false}]'::jsonb),
  ('a0000000-0000-4000-8000-000000000001', 'REG-ISO9001', 'ISO 9001 Quality Reporting', 'ISO 9001', 'quarterly', 30,
   '[{"item":"NC log","done":false},{"item":"CAPA status","done":false},{"item":"Process metrics","done":false}]'::jsonb),
  ('a0000000-0000-4000-8000-000000000001', 'REG-ISO27001', 'ISO 27001 Security Reporting', 'ISO 27001', 'quarterly', 30,
   '[{"item":"Access review","done":false},{"item":"Incident log","done":false},{"item":"Control testing","done":false}]'::jsonb),
  ('a0000000-0000-4000-8000-000000000001', 'REG-ITX', 'Uganda Income Tax Working', 'URA', 'annually', 180,
   '[{"item":"Taxable income","done":false},{"item":"Capital allowances","done":false},{"item":"Withholding tax","done":false}]'::jsonb)
ON CONFLICT (company_id, package_code) DO NOTHING;

UPDATE bi_report_schedules
SET delivery_channels = '["email","portal"]'::jsonb
WHERE company_id = 'a0000000-0000-4000-8000-000000000001';

UPDATE bi_report_definitions
SET classification = CASE
  WHEN category IN ('executive', 'regulatory') THEN 'confidential'
  WHEN category = 'financial' THEN 'internal'
  ELSE COALESCE(classification, 'internal')
END
WHERE company_id = 'a0000000-0000-4000-8000-000000000001';

-- Permissions
INSERT INTO permissions (name, slug, module, description) VALUES
  ('Document Intelligence', 'reports.intelligence', 'reports', 'Secure intelligent documents'),
  ('Enterprise Search', 'reports.search', 'reports', 'Global BI search'),
  ('AI Assistant', 'reports.assistant', 'reports', 'Executive AI assistant'),
  ('Data Warehouse Admin', 'reports.dwh', 'reports', 'DWH metadata and marts'),
  ('Report Classification', 'reports.classify', 'reports', 'Classification and CLS controls')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT 'e0000000-0000-4000-8000-000000000001', id FROM permissions
WHERE slug IN ('reports.intelligence','reports.search','reports.assistant','reports.dwh','reports.classify')
ON CONFLICT DO NOTHING;

-- RLS
ALTER TABLE bi_intelligent_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE bi_document_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE bi_dwh_objects ENABLE ROW LEVEL SECURITY;
ALTER TABLE bi_data_marts ENABLE ROW LEVEL SECURITY;
ALTER TABLE bi_chart_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE bi_search_index ENABLE ROW LEVEL SECURITY;
ALTER TABLE bi_assistant_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE bi_assistant_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE bi_assistant_playbooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE bi_analytics_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE bi_forecast_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE bi_report_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE bi_report_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE bi_notification_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE bi_service_registry ENABLE ROW LEVEL SECURITY;

CREATE POLICY bi_intelligent_documents_all ON bi_intelligent_documents FOR ALL
  USING (company_id = public.user_company_id() OR public.is_super_admin())
  WITH CHECK (company_id = public.user_company_id() OR public.is_super_admin());
CREATE POLICY bi_document_revisions_all ON bi_document_revisions FOR ALL
  USING (company_id = public.user_company_id() OR public.is_super_admin())
  WITH CHECK (company_id = public.user_company_id() OR public.is_super_admin());
CREATE POLICY bi_dwh_objects_all ON bi_dwh_objects FOR ALL
  USING (company_id = public.user_company_id() OR public.is_super_admin())
  WITH CHECK (company_id = public.user_company_id() OR public.is_super_admin());
CREATE POLICY bi_data_marts_all ON bi_data_marts FOR ALL
  USING (company_id = public.user_company_id() OR public.is_super_admin())
  WITH CHECK (company_id = public.user_company_id() OR public.is_super_admin());
CREATE POLICY bi_chart_catalog_all ON bi_chart_catalog FOR ALL
  USING (company_id = public.user_company_id() OR public.is_super_admin())
  WITH CHECK (company_id = public.user_company_id() OR public.is_super_admin());
CREATE POLICY bi_search_index_all ON bi_search_index FOR ALL
  USING (company_id = public.user_company_id() OR public.is_super_admin())
  WITH CHECK (company_id = public.user_company_id() OR public.is_super_admin());
CREATE POLICY bi_assistant_sessions_all ON bi_assistant_sessions FOR ALL
  USING (company_id = public.user_company_id() OR public.is_super_admin())
  WITH CHECK (company_id = public.user_company_id() OR public.is_super_admin());
CREATE POLICY bi_assistant_messages_all ON bi_assistant_messages FOR ALL
  USING (company_id = public.user_company_id() OR public.is_super_admin())
  WITH CHECK (company_id = public.user_company_id() OR public.is_super_admin());
CREATE POLICY bi_assistant_playbooks_all ON bi_assistant_playbooks FOR ALL
  USING (company_id = public.user_company_id() OR public.is_super_admin())
  WITH CHECK (company_id = public.user_company_id() OR public.is_super_admin());
CREATE POLICY bi_analytics_models_all ON bi_analytics_models FOR ALL
  USING (company_id = public.user_company_id() OR public.is_super_admin())
  WITH CHECK (company_id = public.user_company_id() OR public.is_super_admin());
CREATE POLICY bi_forecast_results_all ON bi_forecast_results FOR ALL
  USING (company_id = public.user_company_id() OR public.is_super_admin())
  WITH CHECK (company_id = public.user_company_id() OR public.is_super_admin());
CREATE POLICY bi_report_shares_all ON bi_report_shares FOR ALL
  USING (company_id = public.user_company_id() OR public.is_super_admin())
  WITH CHECK (company_id = public.user_company_id() OR public.is_super_admin());
CREATE POLICY bi_report_approvals_all ON bi_report_approvals FOR ALL
  USING (company_id = public.user_company_id() OR public.is_super_admin())
  WITH CHECK (company_id = public.user_company_id() OR public.is_super_admin());
CREATE POLICY bi_notification_queue_all ON bi_notification_queue FOR ALL
  USING (company_id = public.user_company_id() OR public.is_super_admin())
  WITH CHECK (company_id = public.user_company_id() OR public.is_super_admin());
CREATE POLICY bi_service_registry_all ON bi_service_registry FOR ALL
  USING (company_id = public.user_company_id() OR public.is_super_admin())
  WITH CHECK (company_id = public.user_company_id() OR public.is_super_admin());
