-- Hope Design Group Ltd — Enterprise Sales & Revenue Management
-- Quote-to-cash: Lead → Opportunity → Quotation → Order → Credit → Delivery → Invoice → Payment

-- ============================================================
-- ENUMS
-- ============================================================
DO $$ BEGIN CREATE TYPE lead_status AS ENUM (
  'new','contacted','qualified','unqualified','converted','lost'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE opportunity_stage AS ENUM (
  'prospecting','qualification','proposal','negotiation','won','lost'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE quotation_status AS ENUM (
  'draft','sent','accepted','rejected','expired','converted'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE credit_status AS ENUM (
  'ok','watch','hold','blocked'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE return_status AS ENUM (
  'requested','approved','received','refunded','closed','rejected'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- EXTEND CUSTOMERS
-- ============================================================
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS customer_type VARCHAR(50) DEFAULT 'wholesale',
  ADD COLUMN IF NOT EXISTS industry VARCHAR(100),
  ADD COLUMN IF NOT EXISTS tin_vat VARCHAR(100),
  ADD COLUMN IF NOT EXISTS registration_number VARCHAR(100),
  ADD COLUMN IF NOT EXISTS currency VARCHAR(10) DEFAULT 'UGX',
  ADD COLUMN IF NOT EXISTS payment_terms_days INTEGER DEFAULT 30,
  ADD COLUMN IF NOT EXISTS credit_limit DECIMAL(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS credit_status credit_status DEFAULT 'ok',
  ADD COLUMN IF NOT EXISTS risk_rating VARCHAR(20) DEFAULT 'medium',
  ADD COLUMN IF NOT EXISTS loyalty_level VARCHAR(30) DEFAULT 'standard',
  ADD COLUMN IF NOT EXISTS territory VARCHAR(100),
  ADD COLUMN IF NOT EXISTS sales_rep_id UUID REFERENCES user_profiles(id),
  ADD COLUMN IF NOT EXISTS tax_exempt BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS billing_address TEXT,
  ADD COLUMN IF NOT EXISTS shipping_address TEXT;

-- ============================================================
-- SALES TERRITORIES
-- ============================================================
CREATE TABLE IF NOT EXISTS sales_territories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  code VARCHAR(50) NOT NULL,
  name VARCHAR(150) NOT NULL,
  country VARCHAR(100) DEFAULT 'Uganda',
  region VARCHAR(100),
  district VARCHAR(100),
  zone VARCHAR(100),
  manager_id UUID REFERENCES user_profiles(id),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, code)
);

-- ============================================================
-- LEADS & OPPORTUNITIES
-- ============================================================
CREATE TABLE IF NOT EXISTS sales_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  lead_number VARCHAR(50) NOT NULL,
  company_name VARCHAR(255) NOT NULL,
  contact_name VARCHAR(255),
  email VARCHAR(255),
  phone VARCHAR(50),
  source VARCHAR(100),
  industry VARCHAR(100),
  status lead_status DEFAULT 'new',
  estimated_value DECIMAL(14,2) DEFAULT 0,
  currency VARCHAR(10) DEFAULT 'UGX',
  notes TEXT,
  assigned_to UUID REFERENCES user_profiles(id),
  converted_customer_id UUID REFERENCES customers(id),
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, lead_number)
);

CREATE TABLE IF NOT EXISTS sales_opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  opportunity_number VARCHAR(50) NOT NULL,
  name VARCHAR(255) NOT NULL,
  customer_id UUID REFERENCES customers(id),
  lead_id UUID REFERENCES sales_leads(id),
  stage opportunity_stage DEFAULT 'prospecting',
  probability INTEGER DEFAULT 20 CHECK (probability BETWEEN 0 AND 100),
  expected_value DECIMAL(14,2) DEFAULT 0,
  currency VARCHAR(10) DEFAULT 'UGX',
  expected_close_date DATE,
  owner_id UUID REFERENCES user_profiles(id),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, opportunity_number)
);

-- ============================================================
-- QUOTATIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS quotations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  quote_number VARCHAR(50) NOT NULL,
  version INTEGER DEFAULT 1,
  customer_id UUID REFERENCES customers(id),
  opportunity_id UUID REFERENCES sales_opportunities(id),
  status quotation_status DEFAULT 'draft',
  quote_date DATE NOT NULL DEFAULT CURRENT_DATE,
  valid_until DATE,
  currency VARCHAR(10) DEFAULT 'UGX',
  subtotal DECIMAL(14,2) DEFAULT 0,
  tax_amount DECIMAL(14,2) DEFAULT 0,
  discount_amount DECIMAL(14,2) DEFAULT 0,
  total_amount DECIMAL(14,2) DEFAULT 0,
  payment_terms TEXT,
  delivery_terms TEXT,
  notes TEXT,
  terms_conditions TEXT,
  sales_rep_id UUID REFERENCES user_profiles(id),
  converted_order_id UUID REFERENCES sales_orders(id),
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, quote_number, version)
);

CREATE TABLE IF NOT EXISTS quotation_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quotation_id UUID NOT NULL REFERENCES quotations(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id),
  description TEXT,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit VARCHAR(20) DEFAULT 'carton',
  unit_price DECIMAL(14,2) NOT NULL DEFAULT 0,
  discount_pct DECIMAL(5,2) DEFAULT 0,
  tax_rate DECIMAL(5,2) DEFAULT 18,
  line_total DECIMAL(14,2) GENERATED ALWAYS AS (
    quantity * unit_price * (1 - COALESCE(discount_pct,0)/100)
  ) STORED,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- EXTEND SALES ORDERS
-- ============================================================
ALTER TABLE sales_orders
  ADD COLUMN IF NOT EXISTS order_type VARCHAR(50) DEFAULT 'standard',
  ADD COLUMN IF NOT EXISTS quotation_id UUID REFERENCES quotations(id),
  ADD COLUMN IF NOT EXISTS credit_approved BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS credit_approved_by UUID REFERENCES user_profiles(id),
  ADD COLUMN IF NOT EXISTS credit_approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS delivery_date DATE,
  ADD COLUMN IF NOT EXISTS warehouse_id UUID REFERENCES warehouses(id),
  ADD COLUMN IF NOT EXISTS territory_id UUID REFERENCES sales_territories(id),
  ADD COLUMN IF NOT EXISTS requires_production BOOLEAN DEFAULT false;
-- currency may already exist on sales_orders from prior migrations

-- ============================================================
-- CREDIT NOTES / HOLDS
-- ============================================================
CREATE TABLE IF NOT EXISTS credit_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id),
  sales_order_id UUID REFERENCES sales_orders(id),
  decision VARCHAR(30) NOT NULL DEFAULT 'pending',
  credit_limit DECIMAL(14,2),
  outstanding DECIMAL(14,2),
  notes TEXT,
  reviewed_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- SALES RETURNS
-- ============================================================
CREATE TABLE IF NOT EXISTS sales_returns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  return_number VARCHAR(50) NOT NULL,
  customer_id UUID REFERENCES customers(id),
  sales_order_id UUID REFERENCES sales_orders(id),
  invoice_id UUID REFERENCES invoices(id),
  status return_status DEFAULT 'requested',
  reason VARCHAR(100),
  description TEXT,
  total_amount DECIMAL(14,2) DEFAULT 0,
  currency VARCHAR(10) DEFAULT 'UGX',
  requested_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, return_number)
);

CREATE TABLE IF NOT EXISTS sales_return_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  return_id UUID NOT NULL REFERENCES sales_returns(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id),
  description TEXT,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price DECIMAL(14,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- COMMISSIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS sales_commissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  sales_rep_id UUID REFERENCES user_profiles(id),
  sales_order_id UUID REFERENCES sales_orders(id),
  invoice_id UUID REFERENCES invoices(id),
  basis_amount DECIMAL(14,2) NOT NULL DEFAULT 0,
  commission_pct DECIMAL(5,2) DEFAULT 3,
  commission_amount DECIMAL(14,2) NOT NULL DEFAULT 0,
  currency VARCHAR(10) DEFAULT 'UGX',
  status VARCHAR(30) DEFAULT 'accrued',
  period_month DATE,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- SALES INSIGHTS (AI store)
-- ============================================================
CREATE TABLE IF NOT EXISTS sales_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  insight_type VARCHAR(50) NOT NULL,
  severity VARCHAR(20) DEFAULT 'medium',
  title VARCHAR(255) NOT NULL,
  recommendation TEXT NOT NULL,
  product_code VARCHAR(100),
  metadata JSONB DEFAULT '{}',
  status VARCHAR(30) DEFAULT 'open',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- SUPPORT TICKETS (after-sales)
-- ============================================================
CREATE TABLE IF NOT EXISTS support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  ticket_number VARCHAR(50) NOT NULL,
  customer_id UUID REFERENCES customers(id),
  subject VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(50) DEFAULT 'general',
  priority VARCHAR(20) DEFAULT 'medium',
  status VARCHAR(30) DEFAULT 'open',
  assigned_to UUID REFERENCES user_profiles(id),
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, ticket_number)
);

-- ============================================================
-- PERMISSIONS
-- ============================================================
INSERT INTO permissions (name, slug, module, description) VALUES
  ('View Pipeline', 'sales.pipeline', 'sales', 'View leads and opportunities'),
  ('Manage Quotations', 'sales.quotes', 'sales', 'Create and manage quotations'),
  ('Credit Approval', 'sales.credit', 'sales', 'Approve credit and holds'),
  ('Manage Returns', 'sales.returns', 'sales', 'Sales returns and credit notes'),
  ('View Commissions', 'sales.commissions', 'sales', 'View sales commissions')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT 'e0000000-0000-4000-8000-000000000001', id FROM permissions
WHERE slug IN ('sales.pipeline','sales.quotes','sales.credit','sales.returns','sales.commissions')
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT 'e0000000-0000-4000-8000-000000000010', id FROM permissions
WHERE slug IN ('sales.pipeline','sales.quotes','sales.credit','sales.returns','sales.commissions','sales.view','sales.manage')
ON CONFLICT DO NOTHING;

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE sales_territories ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotation_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_return_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_commissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY sales_territories_all ON sales_territories FOR ALL
  USING (company_id = public.user_company_id()) WITH CHECK (company_id = public.user_company_id());
CREATE POLICY sales_leads_all ON sales_leads FOR ALL
  USING (company_id = public.user_company_id()) WITH CHECK (company_id = public.user_company_id());
CREATE POLICY sales_opportunities_all ON sales_opportunities FOR ALL
  USING (company_id = public.user_company_id()) WITH CHECK (company_id = public.user_company_id());
CREATE POLICY quotations_all ON quotations FOR ALL
  USING (company_id = public.user_company_id()) WITH CHECK (company_id = public.user_company_id());
CREATE POLICY quotation_lines_all ON quotation_lines FOR ALL
  USING (quotation_id IN (SELECT id FROM quotations WHERE company_id = public.user_company_id()))
  WITH CHECK (quotation_id IN (SELECT id FROM quotations WHERE company_id = public.user_company_id()));
CREATE POLICY credit_reviews_all ON credit_reviews FOR ALL
  USING (company_id = public.user_company_id()) WITH CHECK (company_id = public.user_company_id());
CREATE POLICY sales_returns_all ON sales_returns FOR ALL
  USING (company_id = public.user_company_id()) WITH CHECK (company_id = public.user_company_id());
CREATE POLICY sales_return_lines_all ON sales_return_lines FOR ALL
  USING (return_id IN (SELECT id FROM sales_returns WHERE company_id = public.user_company_id()))
  WITH CHECK (return_id IN (SELECT id FROM sales_returns WHERE company_id = public.user_company_id()));
CREATE POLICY sales_commissions_all ON sales_commissions FOR ALL
  USING (company_id = public.user_company_id()) WITH CHECK (company_id = public.user_company_id());
CREATE POLICY sales_insights_all ON sales_insights FOR ALL
  USING (company_id = public.user_company_id()) WITH CHECK (company_id = public.user_company_id());
CREATE POLICY support_tickets_all ON support_tickets FOR ALL
  USING (company_id = public.user_company_id()) WITH CHECK (company_id = public.user_company_id());

-- Seed territories & insights
INSERT INTO sales_territories (company_id, code, name, country, region, zone) VALUES
  ('a0000000-0000-4000-8000-000000000001', 'UG-C', 'Central Uganda', 'Uganda', 'Central', 'Kampala Metro'),
  ('a0000000-0000-4000-8000-000000000001', 'UG-E', 'Eastern Uganda', 'Uganda', 'Eastern', 'Jinja Corridor'),
  ('a0000000-0000-4000-8000-000000000001', 'UG-W', 'Western Uganda', 'Uganda', 'Western', 'Mbarara Zone'),
  ('a0000000-0000-4000-8000-000000000001', 'KE-NBO', 'Kenya Nairobi', 'Kenya', 'Nairobi', 'Export')
ON CONFLICT DO NOTHING;

INSERT INTO sales_insights (company_id, insight_type, severity, title, recommendation, product_code)
VALUES
  (
    'a0000000-0000-4000-8000-000000000001',
    'demand_forecast',
    'high',
    'Premium A4 demand surge projected',
    'Sales of Premium A4 Copy Paper are projected to increase by 18% next month. Current inventory will be insufficient within 12 days. Recommend initiating production of 8,000 additional reams.',
    'HD-BOND-A4-80-W'
  ),
  (
    'a0000000-0000-4000-8000-000000000001',
    'upsell',
    'medium',
    'Cross-sell security paper to institutional accounts',
    'Institutional customers ordering bond paper show 34% conversion to security paper within 90 days. Recommend bundle quotations with security paper SKUs.',
    'HD-SEC-A4-100'
  )
ON CONFLICT DO NOTHING;
