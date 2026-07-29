-- Hope Design Group Ltd — Enterprise Reporting, BI, Analytics & Decision Intelligence
-- Report engine · dashboards · KPIs · AI insights · document generation · schedules

-- ============================================================
-- REPORT DEFINITIONS (catalog + designer metadata)
-- ============================================================
CREATE TABLE IF NOT EXISTS bi_report_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  report_code VARCHAR(50) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(50) NOT NULL DEFAULT 'operational',
  -- operational | financial | statistical | executive | analytical | exception | comparative | regulatory | adhoc | ai
  module_key VARCHAR(50), -- finance | hr | inventory | sales | production | security | scm | ...
  report_type VARCHAR(50) DEFAULT 'tabular',
  -- tabular | crosstab | matrix | pivot | financial_statement | drill_down | interactive | pixel | chart
  data_source VARCHAR(100), -- table/view key or query alias
  query_config JSONB DEFAULT '{}',
  layout_config JSONB DEFAULT '{}',
  parameters JSONB DEFAULT '[]',
  columns_config JSONB DEFAULT '[]',
  is_system BOOLEAN DEFAULT false,
  is_published BOOLEAN DEFAULT true,
  requires_approval BOOLEAN DEFAULT false,
  owner_id UUID REFERENCES user_profiles(id),
  version INTEGER DEFAULT 1,
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  UNIQUE(company_id, report_code)
);

CREATE INDEX IF NOT EXISTS idx_bi_reports_category ON bi_report_definitions(company_id, category) WHERE deleted_at IS NULL;

-- ============================================================
-- REPORT RUN HISTORY
-- ============================================================
CREATE TABLE IF NOT EXISTS bi_report_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  report_id UUID REFERENCES bi_report_definitions(id) ON DELETE SET NULL,
  report_code VARCHAR(50),
  run_by UUID REFERENCES user_profiles(id),
  parameters JSONB DEFAULT '{}',
  status VARCHAR(30) DEFAULT 'completed', -- queued | running | completed | failed | cancelled
  row_count INTEGER DEFAULT 0,
  format VARCHAR(20) DEFAULT 'interactive', -- interactive | pdf | excel | csv | word
  file_url TEXT,
  duration_ms INTEGER,
  error_message TEXT,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_bi_report_runs_started ON bi_report_runs(company_id, started_at DESC);

-- ============================================================
-- DASHBOARD CENTER
-- ============================================================
CREATE TABLE IF NOT EXISTS bi_dashboards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  dashboard_code VARCHAR(50) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  audience VARCHAR(50) DEFAULT 'general',
  -- executive | finance | production | warehouse | sales | crm | hr | board | ceo | md | investor | compliance | audit | factory
  layout JSONB DEFAULT '{"cols":12,"rowHeight":80}',
  is_system BOOLEAN DEFAULT false,
  is_default BOOLEAN DEFAULT false,
  is_published BOOLEAN DEFAULT true,
  refresh_seconds INTEGER DEFAULT 300,
  owner_id UUID REFERENCES user_profiles(id),
  sort_order INTEGER DEFAULT 100,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  UNIQUE(company_id, dashboard_code)
);

CREATE TABLE IF NOT EXISTS bi_dashboard_widgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dashboard_id UUID NOT NULL REFERENCES bi_dashboards(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  widget_key VARCHAR(80) NOT NULL,
  title VARCHAR(255) NOT NULL,
  widget_type VARCHAR(40) DEFAULT 'kpi',
  -- kpi | chart_bar | chart_line | chart_pie | chart_area | heatmap | map | table | alert | text | gauge
  data_source VARCHAR(100),
  config JSONB DEFAULT '{}',
  position JSONB DEFAULT '{"x":0,"y":0,"w":3,"h":2}',
  sort_order INTEGER DEFAULT 0,
  is_visible BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bi_widgets_dashboard ON bi_dashboard_widgets(dashboard_id);

-- ============================================================
-- KPI ENGINE
-- ============================================================
CREATE TABLE IF NOT EXISTS bi_kpis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  kpi_code VARCHAR(50) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(50) DEFAULT 'financial',
  -- financial | production | inventory | sales | hr | quality | logistics | customer | security
  department VARCHAR(100),
  formula TEXT,
  unit VARCHAR(30) DEFAULT '',
  target_value DECIMAL(18,4),
  actual_value DECIMAL(18,4),
  variance_value DECIMAL(18,4),
  variance_pct DECIMAL(10,4),
  trend VARCHAR(20) DEFAULT 'stable', -- up | down | stable
  owner_name VARCHAR(150),
  frequency VARCHAR(30) DEFAULT 'monthly', -- daily | weekly | monthly | quarterly | yearly
  threshold_warning DECIMAL(18,4),
  threshold_critical DECIMAL(18,4),
  higher_is_better BOOLEAN DEFAULT true,
  color_rules JSONB DEFAULT '{}',
  data_source VARCHAR(100),
  is_active BOOLEAN DEFAULT true,
  last_calculated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  UNIQUE(company_id, kpi_code)
);

CREATE TABLE IF NOT EXISTS bi_kpi_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  kpi_id UUID NOT NULL REFERENCES bi_kpis(id) ON DELETE CASCADE,
  snapshot_date DATE NOT NULL DEFAULT CURRENT_DATE,
  actual_value DECIMAL(18,4),
  target_value DECIMAL(18,4),
  variance_value DECIMAL(18,4),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(kpi_id, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_bi_kpi_snapshots_date ON bi_kpi_snapshots(company_id, snapshot_date DESC);

-- ============================================================
-- AI DECISION INTELLIGENCE
-- ============================================================
CREATE TABLE IF NOT EXISTS bi_ai_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  insight_type VARCHAR(50) NOT NULL,
  -- forecast | predictive | prescriptive | risk | root_cause | scenario | what_if | fraud | attrition | churn | demand | cashflow | failure
  domain VARCHAR(50) DEFAULT 'general',
  title VARCHAR(255) NOT NULL,
  summary TEXT,
  recommendation TEXT,
  confidence DECIMAL(5,4) DEFAULT 0.75,
  severity VARCHAR(20) DEFAULT 'info', -- info | low | medium | high | critical
  impact_score DECIMAL(10,2),
  horizon VARCHAR(50), -- 7d | 30d | 90d | 12m
  inputs JSONB DEFAULT '{}',
  outputs JSONB DEFAULT '{}',
  status VARCHAR(30) DEFAULT 'open', -- open | acknowledged | actioned | dismissed
  assigned_to UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_bi_ai_status ON bi_ai_insights(company_id, status, created_at DESC);

-- ============================================================
-- DOCUMENT GENERATOR (enterprise docs from templates)
-- ============================================================
CREATE TABLE IF NOT EXISTS bi_document_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  document_type VARCHAR(50) NOT NULL,
  -- invoice | receipt | po | dn | grn | payslip | contract | certificate | letter | report | tax_return
  title VARCHAR(255) NOT NULL,
  reference_id UUID,
  reference_number VARCHAR(100),
  template_key VARCHAR(80),
  status VARCHAR(30) DEFAULT 'queued', -- queued | generating | ready | failed | sent
  format VARCHAR(20) DEFAULT 'pdf',
  payload JSONB DEFAULT '{}',
  file_url TEXT,
  generated_by UUID REFERENCES user_profiles(id),
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_bi_doc_jobs_created ON bi_document_jobs(company_id, created_at DESC);

-- ============================================================
-- SCHEDULES & SUBSCRIPTIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS bi_report_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  schedule_code VARCHAR(50) NOT NULL,
  name VARCHAR(255) NOT NULL,
  report_id UUID REFERENCES bi_report_definitions(id) ON DELETE SET NULL,
  dashboard_id UUID REFERENCES bi_dashboards(id) ON DELETE SET NULL,
  cron_expression VARCHAR(80) DEFAULT '0 8 * * 1',
  frequency_label VARCHAR(50) DEFAULT 'weekly',
  format VARCHAR(20) DEFAULT 'pdf',
  recipients JSONB DEFAULT '[]',
  parameters JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  last_run_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, schedule_code)
);

-- ============================================================
-- GOVERNANCE / REGULATORY PACKAGES
-- ============================================================
CREATE TABLE IF NOT EXISTS bi_regulatory_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  package_code VARCHAR(50) NOT NULL,
  name VARCHAR(255) NOT NULL,
  authority VARCHAR(150), -- URA | NSSF | Bank of Uganda | ISO | Internal Audit
  filing_frequency VARCHAR(50) DEFAULT 'monthly',
  due_day INTEGER,
  report_ids UUID[] DEFAULT '{}',
  checklist JSONB DEFAULT '[]',
  is_active BOOLEAN DEFAULT true,
  last_filed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, package_code)
);

-- ============================================================
-- SEEDS — Hope Design Group
-- ============================================================
INSERT INTO bi_report_definitions (company_id, report_code, name, description, category, module_key, report_type, data_source, is_system, tags)
VALUES
  ('a0000000-0000-4000-8000-000000000001', 'RPT-FIN-TB', 'Trial Balance', 'GL trial balance by account', 'financial', 'finance', 'financial_statement', 'chart_of_accounts', true, ARRAY['finance','gl']),
  ('a0000000-0000-4000-8000-000000000001', 'RPT-FIN-PL', 'Profit & Loss', 'Income statement period comparison', 'financial', 'finance', 'financial_statement', 'gl_journals', true, ARRAY['finance','pnl']),
  ('a0000000-0000-4000-8000-000000000001', 'RPT-FIN-BS', 'Balance Sheet', 'Statement of financial position', 'financial', 'finance', 'financial_statement', 'chart_of_accounts', true, ARRAY['finance']),
  ('a0000000-0000-4000-8000-000000000001', 'RPT-AR-AGING', 'AR Aging', 'Customer receivables aging', 'financial', 'finance', 'tabular', 'invoices', true, ARRAY['ar','credit']),
  ('a0000000-0000-4000-8000-000000000001', 'RPT-AP-AGING', 'AP Aging', 'Supplier payables aging', 'financial', 'finance', 'tabular', 'ap_invoices', true, ARRAY['ap']),
  ('a0000000-0000-4000-8000-000000000001', 'RPT-INV-STOCK', 'Stock Position', 'On-hand inventory by warehouse', 'operational', 'inventory', 'tabular', 'inventory_balances', true, ARRAY['inventory']),
  ('a0000000-0000-4000-8000-000000000001', 'RPT-INV-TURN', 'Inventory Turnover', 'Turnover and days on hand', 'analytical', 'inventory', 'analytical', 'inventory_balances', true, ARRAY['inventory','kpi']),
  ('a0000000-0000-4000-8000-000000000001', 'RPT-PRD-BATCH', 'Production Batch Status', 'Batches by status and product', 'operational', 'production', 'drill_down', 'production_batches', true, ARRAY['production']),
  ('a0000000-0000-4000-8000-000000000001', 'RPT-PRD-YIELD', 'Production Yield', 'Yield and scrap analysis', 'analytical', 'production', 'statistical', 'production_batches', true, ARRAY['quality']),
  ('a0000000-0000-4000-8000-000000000001', 'RPT-PO-CYCLE', 'Purchase Cycle Time', 'PR to PO to GRN cycle', 'analytical', 'procurement', 'comparative', 'purchase_orders', true, ARRAY['procurement']),
  ('a0000000-0000-4000-8000-000000000001', 'RPT-SLS-PIPE', 'Sales Pipeline', 'Open opportunities by stage', 'operational', 'sales', 'interactive', 'sales_opportunities', true, ARRAY['sales']),
  ('a0000000-0000-4000-8000-000000000001', 'RPT-HR-HEAD', 'Headcount Report', 'Active employees by dept', 'operational', 'hr', 'crosstab', 'employees', true, ARRAY['hr']),
  ('a0000000-0000-4000-8000-000000000001', 'RPT-HR-PAYE', 'PAYE & NSSF Summary', 'Statutory payroll deductions', 'regulatory', 'hr', 'regulatory', 'payroll_runs', true, ARRAY['payroll','ura']),
  ('a0000000-0000-4000-8000-000000000001', 'RPT-SEC-VERIFY', 'Verification & Fraud', 'QR verification outcomes', 'exception', 'security', 'interactive', 'verification_logs', true, ARRAY['security','fraud']),
  ('a0000000-0000-4000-8000-000000000001', 'RPT-SCM-OTD', 'On-Time Delivery', 'OTD performance by supplier/customer', 'analytical', 'scm', 'matrix', 'scm_kpi_snapshots', true, ARRAY['scm']),
  ('a0000000-0000-4000-8000-000000000001', 'RPT-EXC-STOCKOUT', 'Stockout Exceptions', 'Items below reorder level', 'exception', 'inventory', 'exception', 'inventory_balances', true, ARRAY['exception']),
  ('a0000000-0000-4000-8000-000000000001', 'RPT-EXEC-BOARD', 'Board Pack Summary', 'Executive KPI pack', 'executive', 'dashboard', 'executive', 'bi_kpis', true, ARRAY['board','ceo']),
  ('a0000000-0000-4000-8000-000000000001', 'RPT-REG-VAT', 'VAT Return Working', 'URA VAT working papers', 'regulatory', 'finance', 'regulatory', 'tax_codes', true, ARRAY['ura','vat']),
  ('a0000000-0000-4000-8000-000000000001', 'RPT-AI-DEMAND', 'AI Demand Forecast', 'AI-generated demand outlook', 'ai', 'scm', 'ai', 'bi_ai_insights', true, ARRAY['ai','forecast']),
  ('a0000000-0000-4000-8000-000000000001', 'RPT-ADHOC', 'Ad-hoc Query Report', 'User-defined ad-hoc extract', 'adhoc', 'general', 'tabular', 'custom', true, ARRAY['adhoc'])
ON CONFLICT (company_id, report_code) DO NOTHING;

INSERT INTO bi_dashboards (company_id, dashboard_code, name, description, audience, is_system, is_default, sort_order)
VALUES
  ('a0000000-0000-4000-8000-000000000001', 'DB-EXEC', 'Executive Dashboard', 'Enterprise-wide KPI overview', 'executive', true, true, 10),
  ('a0000000-0000-4000-8000-000000000001', 'DB-CEO', 'CEO Dashboard', 'Strategic performance for CEO', 'ceo', true, false, 15),
  ('a0000000-0000-4000-8000-000000000001', 'DB-MD', 'Managing Director Dashboard', 'Operational & strategic MD view', 'md', true, false, 16),
  ('a0000000-0000-4000-8000-000000000001', 'DB-BOARD', 'Board Dashboard', 'Governance & board pack', 'board', true, false, 17),
  ('a0000000-0000-4000-8000-000000000001', 'DB-FIN', 'Finance Dashboard', 'GL · AR · AP · cash · tax', 'finance', true, false, 20),
  ('a0000000-0000-4000-8000-000000000001', 'DB-PRD', 'Production Dashboard', 'Batches · yield · QC', 'production', true, false, 30),
  ('a0000000-0000-4000-8000-000000000001', 'DB-MFG', 'Manufacturing Dashboard', 'Plants · lines · capacity', 'production', true, false, 31),
  ('a0000000-0000-4000-8000-000000000001', 'DB-WH', 'Warehouse Dashboard', 'Receipts · picks · put-away', 'warehouse', true, false, 40),
  ('a0000000-0000-4000-8000-000000000001', 'DB-INV', 'Inventory Dashboard', 'Stock · turnover · valuation', 'warehouse', true, false, 41),
  ('a0000000-0000-4000-8000-000000000001', 'DB-PROC', 'Procurement Dashboard', 'PR · PO · suppliers · spend', 'finance', true, false, 50),
  ('a0000000-0000-4000-8000-000000000001', 'DB-SUP', 'Supplier Dashboard', 'Supplier performance', 'finance', true, false, 51),
  ('a0000000-0000-4000-8000-000000000001', 'DB-SLS', 'Sales Dashboard', 'Orders · pipeline · revenue', 'sales', true, false, 60),
  ('a0000000-0000-4000-8000-000000000001', 'DB-CRM', 'CRM Dashboard', 'Accounts · pipeline · service', 'sales', true, false, 61),
  ('a0000000-0000-4000-8000-000000000001', 'DB-MKT', 'Marketing Dashboard', 'Campaigns · conversion', 'sales', true, false, 62),
  ('a0000000-0000-4000-8000-000000000001', 'DB-HR', 'HR Dashboard', 'Headcount · leave · attrition', 'hr', true, false, 70),
  ('a0000000-0000-4000-8000-000000000001', 'DB-PAY', 'Payroll Dashboard', 'PAYE · NSSF · net pay', 'hr', true, false, 71),
  ('a0000000-0000-4000-8000-000000000001', 'DB-QA', 'Quality Dashboard', 'Defects · QC · scrap', 'production', true, false, 80),
  ('a0000000-0000-4000-8000-000000000001', 'DB-SEC', 'Security Dashboard', 'Verification · fraud · IAM', 'compliance', true, false, 90),
  ('a0000000-0000-4000-8000-000000000001', 'DB-CMP', 'Compliance Dashboard', 'Regulatory filings & audit', 'compliance', true, false, 91),
  ('a0000000-0000-4000-8000-000000000001', 'DB-AUD', 'Audit Dashboard', 'Control findings & trails', 'audit', true, false, 92),
  ('a0000000-0000-4000-8000-000000000001', 'DB-FLT', 'Fleet Dashboard', 'Vehicles · trips · fuel', 'warehouse', true, false, 100),
  ('a0000000-0000-4000-8000-000000000001', 'DB-MNT', 'Maintenance Dashboard', 'Assets · downtime · PM', 'production', true, false, 101),
  ('a0000000-0000-4000-8000-000000000001', 'DB-CS', 'Customer Service Dashboard', 'Tickets · SLA · CSAT', 'sales', true, false, 110),
  ('a0000000-0000-4000-8000-000000000001', 'DB-FAC', 'Factory Dashboard', 'Live factory floor metrics', 'factory', true, false, 120),
  ('a0000000-0000-4000-8000-000000000001', 'DB-INVST', 'Investor Dashboard', 'Investor-ready metrics', 'investor', true, false, 130)
ON CONFLICT (company_id, dashboard_code) DO NOTHING;

-- Widgets for Executive dashboard
INSERT INTO bi_dashboard_widgets (dashboard_id, company_id, widget_key, title, widget_type, data_source, position, sort_order)
SELECT d.id, d.company_id, v.wkey, v.title, v.wtype, v.dsource, v.pos::jsonb, v.sord
FROM bi_dashboards d
CROSS JOIN (VALUES
  ('w_revenue', 'Revenue', 'kpi', 'bi_kpis', '{"x":0,"y":0,"w":3,"h":2}', 1),
  ('w_margin', 'Gross Margin %', 'kpi', 'bi_kpis', '{"x":3,"y":0,"w":3,"h":2}', 2),
  ('w_cash', 'Cash Position', 'kpi', 'bi_kpis', '{"x":6,"y":0,"w":3,"h":2}', 3),
  ('w_otd', 'On-Time Delivery', 'kpi', 'bi_kpis', '{"x":9,"y":0,"w":3,"h":2}', 4),
  ('w_prod_chart', 'Production Trend', 'chart_bar', 'production_batches', '{"x":0,"y":2,"w":6,"h":3}', 5),
  ('w_sales_chart', 'Sales Pipeline', 'chart_pie', 'sales', '{"x":6,"y":2,"w":6,"h":3}', 6),
  ('w_alerts', 'Critical Alerts', 'alert', 'bi_ai_insights', '{"x":0,"y":5,"w":12,"h":2}', 7)
) AS v(wkey, title, wtype, dsource, pos, sord)
WHERE d.dashboard_code = 'DB-EXEC'
  AND d.company_id = 'a0000000-0000-4000-8000-000000000001'
  AND NOT EXISTS (
    SELECT 1 FROM bi_dashboard_widgets w WHERE w.dashboard_id = d.id AND w.widget_key = v.wkey
  );

INSERT INTO bi_kpis (company_id, kpi_code, name, category, department, formula, unit, target_value, actual_value, variance_value, variance_pct, trend, owner_name, frequency, higher_is_better, threshold_warning, threshold_critical)
VALUES
  ('a0000000-0000-4000-8000-000000000001', 'KPI-REV', 'Revenue', 'financial', 'Finance', 'SUM(invoices.total)', 'UGX', 500000000, 412500000, -87500000, -17.5, 'up', 'Finance Director', 'monthly', true, 450000000, 400000000),
  ('a0000000-0000-4000-8000-000000000001', 'KPI-NP', 'Net Profit', 'financial', 'Finance', 'Revenue - Costs', 'UGX', 80000000, 62500000, -17500000, -21.88, 'stable', 'Finance Director', 'monthly', true, 70000000, 50000000),
  ('a0000000-0000-4000-8000-000000000001', 'KPI-GM', 'Gross Margin', 'financial', 'Finance', '(Rev-COGS)/Rev*100', '%', 35, 32.4, -2.6, -7.43, 'down', 'Finance Director', 'monthly', true, 30, 25),
  ('a0000000-0000-4000-8000-000000000001', 'KPI-EBITDA', 'EBITDA', 'financial', 'Finance', 'OP + D&A', 'UGX', 120000000, 98000000, -22000000, -18.33, 'up', 'CFO', 'quarterly', true, 100000000, 80000000),
  ('a0000000-0000-4000-8000-000000000001', 'KPI-PEFF', 'Production Efficiency', 'production', 'Production', 'Actual/Planned*100', '%', 92, 88.5, -3.5, -3.8, 'up', 'Production Manager', 'weekly', true, 85, 80),
  ('a0000000-0000-4000-8000-000000000001', 'KPI-MUTIL', 'Machine Utilization', 'production', 'Manufacturing', 'Run hours / Available', '%', 85, 79.2, -5.8, -6.82, 'stable', 'Plant Manager', 'daily', true, 75, 70),
  ('a0000000-0000-4000-8000-000000000001', 'KPI-ITURN', 'Inventory Turnover', 'inventory', 'Warehouse', 'COGS / Avg Inventory', 'x', 6, 4.8, -1.2, -20, 'down', 'Inventory Controller', 'monthly', true, 5, 4),
  ('a0000000-0000-4000-8000-000000000001', 'KPI-SLT', 'Supplier Lead Time', 'logistics', 'Procurement', 'AVG(GRN date - PO date)', 'days', 7, 9.5, 2.5, 35.71, 'down', 'Procurement Manager', 'monthly', false, 10, 14),
  ('a0000000-0000-4000-8000-000000000001', 'KPI-CSAT', 'Customer Satisfaction', 'customer', 'CRM', 'AVG(survey score)', 'score', 4.5, 4.2, -0.3, -6.67, 'stable', 'Sales Manager', 'monthly', true, 4.0, 3.5),
  ('a0000000-0000-4000-8000-000000000001', 'KPI-EPROD', 'Employee Productivity', 'hr', 'HR', 'Output / FTE', 'index', 100, 96, -4, -4, 'up', 'HR Manager', 'monthly', true, 90, 85),
  ('a0000000-0000-4000-8000-000000000001', 'KPI-OFUL', 'Order Fulfillment', 'sales', 'Sales', 'Fulfilled/Ordered*100', '%', 98, 95.6, -2.4, -2.45, 'up', 'Sales Manager', 'weekly', true, 95, 90),
  ('a0000000-0000-4000-8000-000000000001', 'KPI-CCC', 'Cash Conversion Cycle', 'financial', 'Finance', 'DIO + DSO - DPO', 'days', 45, 52, 7, 15.56, 'down', 'Finance Director', 'monthly', false, 55, 65),
  ('a0000000-0000-4000-8000-000000000001', 'KPI-WC', 'Working Capital', 'financial', 'Finance', 'CA - CL', 'UGX', 200000000, 178000000, -22000000, -11, 'stable', 'CFO', 'monthly', true, 150000000, 100000000),
  ('a0000000-0000-4000-8000-000000000001', 'KPI-SCVR', 'Sales Conversion Rate', 'sales', 'Sales', 'Won / Opportunities', '%', 25, 21.3, -3.7, -14.8, 'up', 'Sales Manager', 'monthly', true, 20, 15),
  ('a0000000-0000-4000-8000-000000000001', 'KPI-OTD', 'On-Time Delivery', 'logistics', 'SCM', 'On-time shipments / Total', '%', 96, 93.1, -2.9, -3.02, 'up', 'Logistics Manager', 'weekly', true, 90, 85),
  ('a0000000-0000-4000-8000-000000000001', 'KPI-DEF', 'Defect Rate', 'quality', 'Quality', 'Defective / Produced *100', '%', 1.5, 2.1, 0.6, 40, 'down', 'QC Manager', 'weekly', false, 2.5, 3.5)
ON CONFLICT (company_id, kpi_code) DO NOTHING;

INSERT INTO bi_ai_insights (company_id, insight_type, domain, title, summary, recommendation, confidence, severity, impact_score, horizon, status)
VALUES
  ('a0000000-0000-4000-8000-000000000001', 'forecast', 'finance', 'Q3 Revenue Forecast', 'Projected revenue 7% below target based on pipeline velocity.', 'Accelerate high-probability deals and open new security printing RFQs.', 0.82, 'high', 87500000, '90d', 'open'),
  ('a0000000-0000-4000-8000-000000000001', 'demand', 'inventory', 'Inventory Demand Spike — Security Paper', 'Demand for security paper grades expected +18% next 30 days.', 'Increase safety stock and confirm mill purchase orders.', 0.78, 'medium', 42000000, '30d', 'open'),
  ('a0000000-0000-4000-8000-000000000001', 'cashflow', 'finance', 'Cash Flow Stress Window', 'Cash dip projected week 3 due to AP cluster and payroll.', 'Stagger non-critical AP and advance high-confidence AR collections.', 0.74, 'high', 55000000, '30d', 'open'),
  ('a0000000-0000-4000-8000-000000000001', 'predictive', 'production', 'Machine Line-2 Failure Risk', 'Vibration and downtime pattern suggests elevated failure risk.', 'Schedule preventive maintenance within 7 days.', 0.71, 'critical', 25000000, '7d', 'open'),
  ('a0000000-0000-4000-8000-000000000001', 'attrition', 'hr', 'Attrition Risk — Production Operators', 'Three operators show elevated attrition signals.', 'Review shift loads and retention incentives.', 0.68, 'medium', 12000000, '90d', 'open'),
  ('a0000000-0000-4000-8000-000000000001', 'fraud', 'security', 'Verification Anomaly Cluster', 'Unusual verification failures from one region in 48h.', 'Investigate distributor chain and freeze suspect batches if confirmed.', 0.86, 'critical', 0, '7d', 'open'),
  ('a0000000-0000-4000-8000-000000000001', 'supplier_risk', 'procurement', 'Supplier Lead-Time Degradation', 'Primary ink supplier lead time trending +35%.', 'Activate alternate approved supplier and dual-source critical SKUs.', 0.77, 'high', 18000000, '30d', 'open'),
  ('a0000000-0000-4000-8000-000000000001', 'scenario', 'finance', 'What-if: 10% Price Increase', 'Scenario shows +6.2% margin with ~4% volume risk.', 'Pilot 5% on high-margin product lines first.', 0.65, 'info', 30000000, '12m', 'open'),
  ('a0000000-0000-4000-8000-000000000001', 'prescriptive', 'scm', 'Optimal Replenishment Plan', 'Suggested DRP reorder reduces stockouts 22% at same working capital.', 'Adopt recommended reorder points for top 50 SKUs.', 0.73, 'medium', 15000000, '30d', 'open'),
  ('a0000000-0000-4000-8000-000000000001', 'root_cause', 'quality', 'Defect Rate Root Cause', '80% of defects linked to humidity control on Line-1 afternoon shift.', 'Calibrate HVAC and retrain shift QC protocol.', 0.80, 'high', 8000000, '30d', 'open')
ON CONFLICT DO NOTHING;

INSERT INTO bi_regulatory_packages (company_id, package_code, name, authority, filing_frequency, due_day, checklist)
VALUES
  ('a0000000-0000-4000-8000-000000000001', 'REG-VAT', 'URA VAT Return', 'URA', 'monthly', 15, '[{"item":"Sales VAT extract","done":false},{"item":"Purchase VAT extract","done":false},{"item":"Reconcile to GL","done":false}]'::jsonb),
  ('a0000000-0000-4000-8000-000000000001', 'REG-PAYE', 'PAYE Return', 'URA', 'monthly', 15, '[{"item":"Payroll register","done":false},{"item":"PAYE computation","done":false}]'::jsonb),
  ('a0000000-0000-4000-8000-000000000001', 'REG-NSSF', 'NSSF Contribution', 'NSSF', 'monthly', 15, '[{"item":"Employee list","done":false},{"item":"Contribution schedule","done":false}]'::jsonb),
  ('a0000000-0000-4000-8000-000000000001', 'REG-AUDIT', 'Internal Audit Pack', 'Internal Audit', 'quarterly', 30, '[{"item":"Control matrix","done":false},{"item":"Exception logs","done":false}]'::jsonb)
ON CONFLICT (company_id, package_code) DO NOTHING;

INSERT INTO bi_report_schedules (company_id, schedule_code, name, frequency_label, cron_expression, format, recipients, is_active)
VALUES
  ('a0000000-0000-4000-8000-000000000001', 'SCH-BOARD-W', 'Weekly Board KPI Pack', 'weekly', '0 7 * * 1', 'pdf', '["board@hopedesign.ug","md@hopedesign.ug"]'::jsonb, true),
  ('a0000000-0000-4000-8000-000000000001', 'SCH-FIN-M', 'Monthly Finance Pack', 'monthly', '0 6 1 * *', 'excel', '["finance@hopedesign.ug"]'::jsonb, true),
  ('a0000000-0000-4000-8000-000000000001', 'SCH-SEC-D', 'Daily Security Exceptions', 'daily', '0 6 * * *', 'pdf', '["security@hopedesign.ug"]'::jsonb, true)
ON CONFLICT (company_id, schedule_code) DO NOTHING;

INSERT INTO bi_document_jobs (company_id, document_type, title, reference_number, template_key, status, format, payload)
VALUES
  ('a0000000-0000-4000-8000-000000000001', 'report', 'Executive Summary — Sample', 'DOC-EXEC-001', 'exec_summary', 'ready', 'pdf', '{"period":"2026-Q2"}'::jsonb),
  ('a0000000-0000-4000-8000-000000000001', 'tax_return', 'VAT Working Papers', 'DOC-VAT-001', 'vat_working', 'queued', 'pdf', '{}'::jsonb),
  ('a0000000-0000-4000-8000-000000000001', 'certificate', 'Quality Certificate Template', 'DOC-QC-001', 'qc_certificate', 'ready', 'pdf', '{}'::jsonb);

-- Permissions
INSERT INTO permissions (name, slug, module, description) VALUES
  ('View Reports BI', 'reports.view', 'reports', 'View reports and dashboards'),
  ('Export Reports', 'reports.export', 'reports', 'Export PDF/Excel/CSV'),
  ('Manage Reports', 'reports.manage', 'reports', 'Design and publish reports'),
  ('Manage Dashboards', 'reports.dashboards', 'reports', 'Configure dashboards'),
  ('Manage KPIs', 'reports.kpis', 'reports', 'Define and own KPIs'),
  ('AI Insights', 'reports.ai', 'reports', 'View AI decision intelligence'),
  ('Regulatory Reports', 'reports.regulatory', 'reports', 'Regulatory packages and filings'),
  ('Document Generator', 'reports.documents', 'reports', 'Generate enterprise documents'),
  ('Schedule Reports', 'reports.schedule', 'reports', 'Schedule and subscribe to reports')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT 'e0000000-0000-4000-8000-000000000001', id FROM permissions
WHERE slug LIKE 'reports.%'
ON CONFLICT DO NOTHING;

-- RLS
ALTER TABLE bi_report_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE bi_report_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE bi_dashboards ENABLE ROW LEVEL SECURITY;
ALTER TABLE bi_dashboard_widgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE bi_kpis ENABLE ROW LEVEL SECURITY;
ALTER TABLE bi_kpi_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE bi_ai_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE bi_document_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE bi_report_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE bi_regulatory_packages ENABLE ROW LEVEL SECURITY;

CREATE POLICY bi_report_definitions_all ON bi_report_definitions FOR ALL
  USING (company_id = public.user_company_id() OR public.is_super_admin())
  WITH CHECK (company_id = public.user_company_id() OR public.is_super_admin());
CREATE POLICY bi_report_runs_all ON bi_report_runs FOR ALL
  USING (company_id = public.user_company_id() OR public.is_super_admin())
  WITH CHECK (company_id = public.user_company_id() OR public.is_super_admin());
CREATE POLICY bi_dashboards_all ON bi_dashboards FOR ALL
  USING (company_id = public.user_company_id() OR public.is_super_admin())
  WITH CHECK (company_id = public.user_company_id() OR public.is_super_admin());
CREATE POLICY bi_dashboard_widgets_all ON bi_dashboard_widgets FOR ALL
  USING (company_id = public.user_company_id() OR public.is_super_admin())
  WITH CHECK (company_id = public.user_company_id() OR public.is_super_admin());
CREATE POLICY bi_kpis_all ON bi_kpis FOR ALL
  USING (company_id = public.user_company_id() OR public.is_super_admin())
  WITH CHECK (company_id = public.user_company_id() OR public.is_super_admin());
CREATE POLICY bi_kpi_snapshots_all ON bi_kpi_snapshots FOR ALL
  USING (company_id = public.user_company_id() OR public.is_super_admin())
  WITH CHECK (company_id = public.user_company_id() OR public.is_super_admin());
CREATE POLICY bi_ai_insights_all ON bi_ai_insights FOR ALL
  USING (company_id = public.user_company_id() OR public.is_super_admin())
  WITH CHECK (company_id = public.user_company_id() OR public.is_super_admin());
CREATE POLICY bi_document_jobs_all ON bi_document_jobs FOR ALL
  USING (company_id = public.user_company_id() OR public.is_super_admin())
  WITH CHECK (company_id = public.user_company_id() OR public.is_super_admin());
CREATE POLICY bi_report_schedules_all ON bi_report_schedules FOR ALL
  USING (company_id = public.user_company_id() OR public.is_super_admin())
  WITH CHECK (company_id = public.user_company_id() OR public.is_super_admin());
CREATE POLICY bi_regulatory_packages_all ON bi_regulatory_packages FOR ALL
  USING (company_id = public.user_company_id() OR public.is_super_admin())
  WITH CHECK (company_id = public.user_company_id() OR public.is_super_admin());
