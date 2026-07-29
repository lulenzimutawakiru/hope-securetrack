-- Hope SecureTrack ERP — Enterprise Advanced Sales Platform
-- Quote-to-cash · Pipeline · Pricing · Contracts · Forecast · Commissions · AI

-- ============================================================
-- SOFT-DELETE + EXTENSIONS ON LEGACY SALES TABLES
-- ============================================================
ALTER TABLE sales_orders
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES user_profiles(id),
  ADD COLUMN IF NOT EXISTS channel_code VARCHAR(50),
  ADD COLUMN IF NOT EXISTS team_code VARCHAR(50),
  ADD COLUMN IF NOT EXISTS priority VARCHAR(20) DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS discount_pct DECIMAL(5,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS shipping_amount DECIMAL(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS po_number VARCHAR(80),
  ADD COLUMN IF NOT EXISTS promised_date DATE,
  ADD COLUMN IF NOT EXISTS fulfilment_status VARCHAR(40) DEFAULT 'unfulfilled',
  ADD COLUMN IF NOT EXISTS payment_status VARCHAR(40) DEFAULT 'unpaid',
  ADD COLUMN IF NOT EXISTS notes TEXT;

ALTER TABLE sales_order_lines
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS product_code VARCHAR(80),
  ADD COLUMN IF NOT EXISTS product_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS discount_amount DECIMAL(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tax_amount DECIMAL(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS warehouse_code VARCHAR(50);

ALTER TABLE sales_leads
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES user_profiles(id),
  ADD COLUMN IF NOT EXISTS territory_code VARCHAR(50),
  ADD COLUMN IF NOT EXISTS channel_code VARCHAR(50),
  ADD COLUMN IF NOT EXISTS rating VARCHAR(20) DEFAULT 'warm',
  ADD COLUMN IF NOT EXISTS next_action_date DATE,
  ADD COLUMN IF NOT EXISTS owner_name VARCHAR(150);

ALTER TABLE sales_opportunities
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES user_profiles(id),
  ADD COLUMN IF NOT EXISTS territory_code VARCHAR(50),
  ADD COLUMN IF NOT EXISTS channel_code VARCHAR(50),
  ADD COLUMN IF NOT EXISTS competitor VARCHAR(150),
  ADD COLUMN IF NOT EXISTS source VARCHAR(100),
  ADD COLUMN IF NOT EXISTS weighted_value DECIMAL(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS next_step TEXT,
  ADD COLUMN IF NOT EXISTS owner_name VARCHAR(150);

ALTER TABLE quotations
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES user_profiles(id),
  ADD COLUMN IF NOT EXISTS customer_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS price_list_code VARCHAR(50),
  ADD COLUMN IF NOT EXISTS territory_code VARCHAR(50),
  ADD COLUMN IF NOT EXISTS approval_status VARCHAR(40) DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ;

ALTER TABLE quotation_lines
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS product_code VARCHAR(80),
  ADD COLUMN IF NOT EXISTS product_name VARCHAR(255);

ALTER TABLE sales_territories
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS target_amount DECIMAL(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS currency VARCHAR(10) DEFAULT 'UGX',
  ADD COLUMN IF NOT EXISTS notes TEXT;

ALTER TABLE sales_returns
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES user_profiles(id),
  ADD COLUMN IF NOT EXISTS customer_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS rma_number VARCHAR(50),
  ADD COLUMN IF NOT EXISTS restock BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS credit_note_number VARCHAR(50);

ALTER TABLE sales_return_lines
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS product_code VARCHAR(80),
  ADD COLUMN IF NOT EXISTS product_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS reason VARCHAR(100);

ALTER TABLE sales_commissions
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS rep_name VARCHAR(150),
  ADD COLUMN IF NOT EXISTS order_number VARCHAR(50),
  ADD COLUMN IF NOT EXISTS notes TEXT;

ALTER TABLE credit_reviews
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS customer_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS order_number VARCHAR(50),
  ADD COLUMN IF NOT EXISTS status VARCHAR(30) DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS risk_score DECIMAL(5,2) DEFAULT 0;

ALTER TABLE sales_insights
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS summary TEXT,
  ADD COLUMN IF NOT EXISTS score DECIMAL(5,2) DEFAULT 0;

ALTER TABLE support_tickets
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS customer_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS sales_order_id UUID,
  ADD COLUMN IF NOT EXISTS related_module VARCHAR(40) DEFAULT 'sales';

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS channel_code VARCHAR(50),
  ADD COLUMN IF NOT EXISTS team_code VARCHAR(50),
  ADD COLUMN IF NOT EXISTS price_list_code VARCHAR(50),
  ADD COLUMN IF NOT EXISTS last_order_date DATE,
  ADD COLUMN IF NOT EXISTS lifetime_value DECIMAL(14,2) DEFAULT 0;

-- ============================================================
-- TEAMS / CHANNELS / PRICING
-- ============================================================
CREATE TABLE IF NOT EXISTS sales_teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  team_code VARCHAR(50) NOT NULL,
  name VARCHAR(150) NOT NULL,
  manager_name VARCHAR(150),
  territory_code VARCHAR(50),
  branch_name VARCHAR(150),
  region VARCHAR(100),
  target_amount DECIMAL(14,2) DEFAULT 0,
  currency VARCHAR(10) DEFAULT 'UGX',
  member_count INTEGER DEFAULT 0,
  status VARCHAR(30) DEFAULT 'active',
  notes TEXT,
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES user_profiles(id),
  updated_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, team_code)
);

CREATE TABLE IF NOT EXISTS sales_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  channel_code VARCHAR(50) NOT NULL,
  name VARCHAR(150) NOT NULL,
  channel_type VARCHAR(40) DEFAULT 'direct',
  -- direct|dealer|distributor|ecommerce|export|tender|retail
  margin_pct DECIMAL(5,2) DEFAULT 0,
  commission_pct DECIMAL(5,2) DEFAULT 0,
  is_default BOOLEAN DEFAULT false,
  status VARCHAR(30) DEFAULT 'active',
  notes TEXT,
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES user_profiles(id),
  updated_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, channel_code)
);

CREATE TABLE IF NOT EXISTS sales_price_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  price_list_code VARCHAR(50) NOT NULL,
  name VARCHAR(150) NOT NULL,
  currency VARCHAR(10) DEFAULT 'UGX',
  customer_type VARCHAR(50) DEFAULT 'wholesale',
  channel_code VARCHAR(50),
  valid_from DATE DEFAULT CURRENT_DATE,
  valid_to DATE,
  is_default BOOLEAN DEFAULT false,
  tax_inclusive BOOLEAN DEFAULT false,
  status VARCHAR(30) DEFAULT 'active',
  notes TEXT,
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES user_profiles(id),
  updated_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, price_list_code)
);

CREATE TABLE IF NOT EXISTS sales_price_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  item_code VARCHAR(50) NOT NULL,
  price_list_code VARCHAR(50) NOT NULL,
  product_code VARCHAR(80),
  product_name VARCHAR(255),
  unit VARCHAR(30) DEFAULT 'carton',
  unit_price DECIMAL(14,2) NOT NULL DEFAULT 0,
  min_qty INTEGER DEFAULT 1,
  max_qty INTEGER,
  currency VARCHAR(10) DEFAULT 'UGX',
  status VARCHAR(30) DEFAULT 'active',
  notes TEXT,
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES user_profiles(id),
  updated_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, item_code)
);

CREATE TABLE IF NOT EXISTS sales_discount_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  rule_code VARCHAR(50) NOT NULL,
  name VARCHAR(150) NOT NULL,
  rule_type VARCHAR(40) DEFAULT 'volume',
  -- volume|customer|channel|promo|manual|contract
  product_code VARCHAR(80),
  customer_type VARCHAR(50),
  channel_code VARCHAR(50),
  min_qty INTEGER DEFAULT 0,
  min_amount DECIMAL(14,2) DEFAULT 0,
  discount_pct DECIMAL(5,2) DEFAULT 0,
  discount_amount DECIMAL(14,2) DEFAULT 0,
  max_discount_pct DECIMAL(5,2) DEFAULT 50,
  requires_approval BOOLEAN DEFAULT false,
  valid_from DATE DEFAULT CURRENT_DATE,
  valid_to DATE,
  priority INTEGER DEFAULT 100,
  status VARCHAR(30) DEFAULT 'active',
  notes TEXT,
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES user_profiles(id),
  updated_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, rule_code)
);

CREATE TABLE IF NOT EXISTS sales_promotions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  promo_code VARCHAR(50) NOT NULL,
  name VARCHAR(150) NOT NULL,
  promo_type VARCHAR(40) DEFAULT 'percentage',
  -- percentage|fixed|bogo|bundle|free_shipping
  discount_pct DECIMAL(5,2) DEFAULT 0,
  discount_amount DECIMAL(14,2) DEFAULT 0,
  product_codes TEXT,
  channel_code VARCHAR(50),
  budget_amount DECIMAL(14,2) DEFAULT 0,
  spent_amount DECIMAL(14,2) DEFAULT 0,
  currency VARCHAR(10) DEFAULT 'UGX',
  valid_from DATE DEFAULT CURRENT_DATE,
  valid_to DATE,
  status VARCHAR(30) DEFAULT 'draft',
  notes TEXT,
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES user_profiles(id),
  updated_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, promo_code)
);

-- ============================================================
-- CONTRACTS / REBATES
-- ============================================================
CREATE TABLE IF NOT EXISTS sales_contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  contract_number VARCHAR(50) NOT NULL,
  name VARCHAR(255) NOT NULL,
  customer_id UUID REFERENCES customers(id),
  customer_name VARCHAR(255),
  contract_type VARCHAR(40) DEFAULT 'framework',
  -- framework|blanket|service|tender|distributor
  start_date DATE DEFAULT CURRENT_DATE,
  end_date DATE,
  currency VARCHAR(10) DEFAULT 'UGX',
  contract_value DECIMAL(14,2) DEFAULT 0,
  consumed_value DECIMAL(14,2) DEFAULT 0,
  payment_terms_days INTEGER DEFAULT 30,
  price_list_code VARCHAR(50),
  auto_renew BOOLEAN DEFAULT false,
  owner_name VARCHAR(150),
  status VARCHAR(30) DEFAULT 'draft',
  -- draft|active|expired|terminated|renewed
  notes TEXT,
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES user_profiles(id),
  updated_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, contract_number)
);

CREATE TABLE IF NOT EXISTS sales_contract_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  line_code VARCHAR(50) NOT NULL,
  contract_number VARCHAR(50) NOT NULL,
  product_code VARCHAR(80),
  product_name VARCHAR(255),
  quantity DECIMAL(14,2) DEFAULT 0,
  unit VARCHAR(30) DEFAULT 'carton',
  unit_price DECIMAL(14,2) DEFAULT 0,
  committed_value DECIMAL(14,2) DEFAULT 0,
  status VARCHAR(30) DEFAULT 'active',
  notes TEXT,
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES user_profiles(id),
  updated_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, line_code)
);

CREATE TABLE IF NOT EXISTS sales_rebates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  rebate_code VARCHAR(50) NOT NULL,
  name VARCHAR(150) NOT NULL,
  customer_name VARCHAR(255),
  channel_code VARCHAR(50),
  basis VARCHAR(40) DEFAULT 'volume',
  -- volume|revenue|growth
  threshold_amount DECIMAL(14,2) DEFAULT 0,
  rebate_pct DECIMAL(5,2) DEFAULT 0,
  rebate_amount DECIMAL(14,2) DEFAULT 0,
  period_start DATE,
  period_end DATE,
  currency VARCHAR(10) DEFAULT 'UGX',
  status VARCHAR(30) DEFAULT 'accruing',
  -- accruing|approved|paid|cancelled
  notes TEXT,
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES user_profiles(id),
  updated_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, rebate_code)
);

-- ============================================================
-- ACTIVITIES / FIELD / FORECAST
-- ============================================================
CREATE TABLE IF NOT EXISTS sales_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  activity_code VARCHAR(50) NOT NULL,
  activity_type VARCHAR(40) DEFAULT 'call',
  -- call|meeting|email|visit|demo|proposal|follow_up|task
  subject VARCHAR(255) NOT NULL,
  related_type VARCHAR(40) DEFAULT 'lead',
  -- lead|opportunity|customer|order|quote
  related_number VARCHAR(80),
  customer_name VARCHAR(255),
  owner_name VARCHAR(150),
  due_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  priority VARCHAR(20) DEFAULT 'medium',
  outcome TEXT,
  status VARCHAR(30) DEFAULT 'open',
  -- open|done|cancelled|overdue
  notes TEXT,
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES user_profiles(id),
  updated_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, activity_code)
);

CREATE TABLE IF NOT EXISTS sales_visit_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  plan_code VARCHAR(50) NOT NULL,
  rep_name VARCHAR(150),
  customer_name VARCHAR(255),
  territory_code VARCHAR(50),
  planned_date DATE DEFAULT CURRENT_DATE,
  purpose VARCHAR(100),
  location_name VARCHAR(200),
  lat NUMERIC(10,7),
  lng NUMERIC(10,7),
  check_in_at TIMESTAMPTZ,
  check_out_at TIMESTAMPTZ,
  status VARCHAR(30) DEFAULT 'planned',
  -- planned|in_progress|completed|missed|cancelled
  outcome TEXT,
  notes TEXT,
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES user_profiles(id),
  updated_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, plan_code)
);

CREATE TABLE IF NOT EXISTS sales_call_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  call_code VARCHAR(50) NOT NULL,
  direction VARCHAR(20) DEFAULT 'outbound',
  customer_name VARCHAR(255),
  contact_name VARCHAR(150),
  phone VARCHAR(50),
  rep_name VARCHAR(150),
  duration_sec INTEGER DEFAULT 0,
  disposition VARCHAR(40) DEFAULT 'connected',
  -- connected|no_answer|busy|voicemail|wrong_number
  subject VARCHAR(255),
  notes TEXT,
  status VARCHAR(30) DEFAULT 'logged',
  call_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES user_profiles(id),
  updated_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, call_code)
);

CREATE TABLE IF NOT EXISTS sales_competitors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  competitor_code VARCHAR(50) NOT NULL,
  name VARCHAR(150) NOT NULL,
  strength TEXT,
  weakness TEXT,
  products TEXT,
  market_share_pct DECIMAL(5,2) DEFAULT 0,
  threat_level VARCHAR(20) DEFAULT 'medium',
  status VARCHAR(30) DEFAULT 'active',
  notes TEXT,
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES user_profiles(id),
  updated_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, competitor_code)
);

CREATE TABLE IF NOT EXISTS sales_samples (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  sample_code VARCHAR(50) NOT NULL,
  customer_name VARCHAR(255),
  product_code VARCHAR(80),
  product_name VARCHAR(255),
  quantity INTEGER DEFAULT 1,
  unit VARCHAR(30) DEFAULT 'unit',
  issued_to VARCHAR(150),
  issued_date DATE DEFAULT CURRENT_DATE,
  expected_return DATE,
  cost_amount DECIMAL(14,2) DEFAULT 0,
  currency VARCHAR(10) DEFAULT 'UGX',
  status VARCHAR(30) DEFAULT 'issued',
  -- issued|returned|converted|written_off
  notes TEXT,
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES user_profiles(id),
  updated_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, sample_code)
);

CREATE TABLE IF NOT EXISTS sales_forecasts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  forecast_code VARCHAR(50) NOT NULL,
  name VARCHAR(150) NOT NULL,
  period_year INTEGER NOT NULL DEFAULT EXTRACT(YEAR FROM CURRENT_DATE)::int,
  period_month INTEGER,
  period_quarter INTEGER,
  territory_code VARCHAR(50),
  team_code VARCHAR(50),
  channel_code VARCHAR(50),
  product_code VARCHAR(80),
  forecast_amount DECIMAL(14,2) DEFAULT 0,
  committed_amount DECIMAL(14,2) DEFAULT 0,
  best_case DECIMAL(14,2) DEFAULT 0,
  worst_case DECIMAL(14,2) DEFAULT 0,
  actual_amount DECIMAL(14,2) DEFAULT 0,
  currency VARCHAR(10) DEFAULT 'UGX',
  confidence_pct INTEGER DEFAULT 50,
  owner_name VARCHAR(150),
  status VARCHAR(30) DEFAULT 'draft',
  -- draft|submitted|approved|locked
  notes TEXT,
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES user_profiles(id),
  updated_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, forecast_code)
);

CREATE TABLE IF NOT EXISTS sales_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  target_code VARCHAR(50) NOT NULL,
  name VARCHAR(150) NOT NULL,
  scope_type VARCHAR(40) DEFAULT 'rep',
  -- rep|team|territory|channel|company|product
  scope_name VARCHAR(150),
  period_year INTEGER NOT NULL DEFAULT EXTRACT(YEAR FROM CURRENT_DATE)::int,
  period_month INTEGER,
  period_quarter INTEGER,
  target_amount DECIMAL(14,2) DEFAULT 0,
  actual_amount DECIMAL(14,2) DEFAULT 0,
  currency VARCHAR(10) DEFAULT 'UGX',
  achievement_pct DECIMAL(6,2) DEFAULT 0,
  status VARCHAR(30) DEFAULT 'active',
  notes TEXT,
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES user_profiles(id),
  updated_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, target_code)
);

CREATE TABLE IF NOT EXISTS sales_order_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  approval_code VARCHAR(50) NOT NULL,
  order_number VARCHAR(50),
  quote_number VARCHAR(50),
  customer_name VARCHAR(255),
  approval_type VARCHAR(40) DEFAULT 'discount',
  -- discount|credit|price|cancel|return|contract
  requested_by_name VARCHAR(150),
  approver_name VARCHAR(150),
  amount DECIMAL(14,2) DEFAULT 0,
  discount_pct DECIMAL(5,2) DEFAULT 0,
  reason TEXT,
  decision VARCHAR(30) DEFAULT 'pending',
  -- pending|approved|rejected|escalated
  decided_at TIMESTAMPTZ,
  status VARCHAR(30) DEFAULT 'open',
  notes TEXT,
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES user_profiles(id),
  updated_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, approval_code)
);

CREATE TABLE IF NOT EXISTS sales_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  doc_code VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  doc_type VARCHAR(40) DEFAULT 'proposal',
  -- proposal|contract|po|spec|brochure|tender|other
  related_type VARCHAR(40),
  related_number VARCHAR(80),
  customer_name VARCHAR(255),
  file_url TEXT,
  version INTEGER DEFAULT 1,
  status VARCHAR(30) DEFAULT 'active',
  notes TEXT,
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES user_profiles(id),
  updated_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, doc_code)
);

CREATE TABLE IF NOT EXISTS sales_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  notif_code VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  body TEXT,
  severity VARCHAR(20) DEFAULT 'info',
  channel VARCHAR(40) DEFAULT 'in_app',
  recipient_name VARCHAR(150),
  related_type VARCHAR(40),
  related_number VARCHAR(80),
  is_read BOOLEAN DEFAULT false,
  status VARCHAR(30) DEFAULT 'unread',
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, notif_code)
);

CREATE TABLE IF NOT EXISTS sales_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  setting_key VARCHAR(100) NOT NULL,
  setting_value TEXT,
  category VARCHAR(50) DEFAULT 'general',
  description TEXT,
  status VARCHAR(30) DEFAULT 'active',
  deleted_at TIMESTAMPTZ,
  updated_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, setting_key)
);

CREATE TABLE IF NOT EXISTS sales_ai_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  insight_code VARCHAR(50) NOT NULL,
  insight_type VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  summary TEXT,
  severity VARCHAR(20) DEFAULT 'medium',
  score DECIMAL(5,2) DEFAULT 0,
  recommendations TEXT,
  status VARCHAR(30) DEFAULT 'open',
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, insight_code)
);

CREATE TABLE IF NOT EXISTS sales_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES user_profiles(id),
  action VARCHAR(50) NOT NULL,
  entity_table VARCHAR(80),
  entity_id UUID,
  entity_code VARCHAR(80),
  details TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_sales_orders_deleted ON sales_orders(company_id, deleted_at);
CREATE INDEX IF NOT EXISTS idx_sales_leads_status ON sales_leads(company_id, status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_sales_opps_stage ON sales_opportunities(company_id, stage) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_sales_activities_status ON sales_activities(company_id, status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_sales_forecasts_period ON sales_forecasts(company_id, period_year, period_month);
CREATE INDEX IF NOT EXISTS idx_sales_targets_period ON sales_targets(company_id, period_year);
CREATE INDEX IF NOT EXISTS idx_sales_contracts_status ON sales_contracts(company_id, status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_sales_price_items_list ON sales_price_items(company_id, price_list_code) WHERE deleted_at IS NULL;

-- ============================================================
-- RLS
-- ============================================================
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'sales_teams','sales_channels','sales_price_lists','sales_price_items',
    'sales_discount_rules','sales_promotions','sales_contracts','sales_contract_lines',
    'sales_rebates','sales_activities','sales_visit_plans','sales_call_logs',
    'sales_competitors','sales_samples','sales_forecasts','sales_targets',
    'sales_order_approvals','sales_documents','sales_notifications','sales_settings',
    'sales_ai_insights','sales_audit_log'
  ]
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t || '_all', t);
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR ALL USING (company_id = public.user_company_id()) WITH CHECK (company_id = public.user_company_id())',
      t || '_all', t
    );
  END LOOP;
END $$;

-- Audit log may have null company during system ops
DROP POLICY IF EXISTS sales_audit_log_all ON sales_audit_log;
CREATE POLICY sales_audit_log_all ON sales_audit_log FOR ALL
  USING (company_id IS NULL OR company_id = public.user_company_id())
  WITH CHECK (company_id IS NULL OR company_id = public.user_company_id());

-- ============================================================
-- PERMISSIONS
-- ============================================================
INSERT INTO permissions (name, slug, module, description) VALUES
  ('View Sales', 'sales.view', 'sales', 'View sales command center and reports'),
  ('Manage Sales', 'sales.manage', 'sales', 'Create and manage sales records'),
  ('Sales Pipeline', 'sales.pipeline', 'sales', 'Leads and opportunities'),
  ('Sales Quotations', 'sales.quotes', 'sales', 'Quotations and pricing'),
  ('Sales Credit', 'sales.credit', 'sales', 'Credit reviews and holds'),
  ('Sales Returns', 'sales.returns', 'sales', 'Returns and RMAs'),
  ('Sales Commissions', 'sales.commissions', 'sales', 'Commission management'),
  ('Sales Pricing', 'sales.pricing', 'sales', 'Price lists and discounts'),
  ('Sales Contracts', 'sales.contracts', 'sales', 'Contracts and rebates'),
  ('Sales Forecast', 'sales.forecast', 'sales', 'Forecasts and targets'),
  ('Sales AI', 'sales.ai', 'sales', 'AI sales insights'),
  ('Sales Admin', 'sales.admin', 'sales', 'Sales settings and audit')
ON CONFLICT (slug) DO NOTHING;

-- Grant to key roles
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.slug IN (
  'super_administrator','managing_director','operations_manager',
  'sales_manager','sales_executive','finance_manager','auditor'
)
AND p.slug LIKE 'sales.%'
ON CONFLICT DO NOTHING;

-- ============================================================
-- SEED (Hope Design demo company)
-- ============================================================
DO $$
DECLARE cid UUID := 'a0000000-0000-4000-8000-000000000001';
BEGIN
  IF NOT EXISTS (SELECT 1 FROM companies WHERE id = cid) THEN
    RETURN;
  END IF;

  INSERT INTO sales_channels (company_id, channel_code, name, channel_type, commission_pct, is_default, status)
  VALUES
    (cid, 'CH-DIRECT', 'Direct Sales', 'direct', 3, true, 'active'),
    (cid, 'CH-DEALER', 'Dealer Network', 'dealer', 5, false, 'active'),
    (cid, 'CH-EXPORT', 'Export', 'export', 2, false, 'active')
  ON CONFLICT (company_id, channel_code) DO NOTHING;

  INSERT INTO sales_teams (company_id, team_code, name, manager_name, territory_code, region, target_amount, status)
  VALUES
    (cid, 'TM-CENTRAL', 'Central Sales', 'Amina Okello', 'UG-C', 'Central', 500000000, 'active'),
    (cid, 'TM-EAST', 'Eastern Sales', 'James Mugisha', 'UG-E', 'Eastern', 250000000, 'active')
  ON CONFLICT (company_id, team_code) DO NOTHING;

  INSERT INTO sales_price_lists (company_id, price_list_code, name, currency, customer_type, is_default, status)
  VALUES
    (cid, 'PL-STD', 'Standard Wholesale', 'UGX', 'wholesale', true, 'active'),
    (cid, 'PL-DEALER', 'Dealer Price List', 'UGX', 'dealer', false, 'active'),
    (cid, 'PL-EXPORT', 'Export USD', 'USD', 'export', false, 'active')
  ON CONFLICT (company_id, price_list_code) DO NOTHING;

  INSERT INTO sales_price_items (company_id, item_code, price_list_code, product_code, product_name, unit, unit_price, status)
  VALUES
    (cid, 'PI-001', 'PL-STD', 'SKU-DEMO-01', 'Demo Product Carton', 'carton', 85000, 'active'),
    (cid, 'PI-002', 'PL-DEALER', 'SKU-DEMO-01', 'Demo Product Carton', 'carton', 78000, 'active')
  ON CONFLICT (company_id, item_code) DO NOTHING;

  INSERT INTO sales_discount_rules (company_id, rule_code, name, rule_type, min_qty, discount_pct, max_discount_pct, requires_approval, status)
  VALUES
    (cid, 'DR-VOL10', 'Volume 10+ cartons', 'volume', 10, 3, 15, false, 'active'),
    (cid, 'DR-VOL50', 'Volume 50+ cartons', 'volume', 50, 7, 20, true, 'active')
  ON CONFLICT (company_id, rule_code) DO NOTHING;

  INSERT INTO sales_promotions (company_id, promo_code, name, promo_type, discount_pct, budget_amount, valid_from, valid_to, status)
  VALUES
    (cid, 'PR-Q3', 'Q3 Trade Push', 'percentage', 5, 20000000, CURRENT_DATE, CURRENT_DATE + 90, 'active')
  ON CONFLICT (company_id, promo_code) DO NOTHING;

  INSERT INTO sales_targets (company_id, target_code, name, scope_type, scope_name, period_year, period_month, target_amount, status)
  VALUES
    (cid, 'TG-YTD', 'Company Annual Target', 'company', 'Hope Design', EXTRACT(YEAR FROM CURRENT_DATE)::int, NULL, 2000000000, 'active'),
    (cid, 'TG-CENTRAL', 'Central Team Monthly', 'team', 'Central Sales', EXTRACT(YEAR FROM CURRENT_DATE)::int, EXTRACT(MONTH FROM CURRENT_DATE)::int, 80000000, 'active')
  ON CONFLICT (company_id, target_code) DO NOTHING;

  INSERT INTO sales_forecasts (company_id, forecast_code, name, period_year, period_month, team_code, forecast_amount, committed_amount, confidence_pct, status)
  VALUES
    (cid, 'FC-CUR', 'Current Month Forecast', EXTRACT(YEAR FROM CURRENT_DATE)::int, EXTRACT(MONTH FROM CURRENT_DATE)::int, 'TM-CENTRAL', 75000000, 42000000, 65, 'submitted')
  ON CONFLICT (company_id, forecast_code) DO NOTHING;

  INSERT INTO sales_activities (company_id, activity_code, activity_type, subject, related_type, customer_name, owner_name, due_at, priority, status)
  VALUES
    (cid, 'ACT-001', 'call', 'Follow up wholesale enquiry', 'lead', 'Kampala Traders Ltd', 'Amina Okello', NOW() + INTERVAL '1 day', 'high', 'open'),
    (cid, 'ACT-002', 'meeting', 'Contract negotiation', 'opportunity', 'East Africa Distributors', 'James Mugisha', NOW() + INTERVAL '3 days', 'medium', 'open')
  ON CONFLICT (company_id, activity_code) DO NOTHING;

  INSERT INTO sales_settings (company_id, setting_key, setting_value, category, description)
  VALUES
    (cid, 'default_currency', 'UGX', 'general', 'Default sales currency'),
    (cid, 'default_payment_terms', '30', 'credit', 'Default payment terms in days'),
    (cid, 'quote_validity_days', '14', 'quoting', 'Default quotation validity'),
    (cid, 'max_discount_without_approval', '10', 'pricing', 'Max discount % without approval'),
    (cid, 'commission_default_pct', '3', 'commissions', 'Default commission percentage')
  ON CONFLICT (company_id, setting_key) DO NOTHING;

  INSERT INTO sales_ai_insights (company_id, insight_code, insight_type, title, summary, severity, score, recommendations, status)
  VALUES
    (cid, 'AI-001', 'pipeline', 'Pipeline concentration risk', 'Over 40% of open pipeline sits in negotiation stage with close dates this month.', 'high', 82, 'Review top 5 deals daily; assign backup owners', 'open'),
    (cid, 'AI-002', 'pricing', 'Discount leakage', 'Average approved discount rose 1.8 pts vs last quarter on wholesale orders.', 'medium', 64, 'Enforce volume rules; require approval above 10%', 'open')
  ON CONFLICT (company_id, insight_code) DO NOTHING;
END $$;
