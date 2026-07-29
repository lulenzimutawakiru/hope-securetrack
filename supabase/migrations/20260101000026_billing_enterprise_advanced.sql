-- Hope Design Group — Billing Advanced
-- Credit control · contracts · projects · manufacturing · delivery · approvals · portal · signatures · comms

-- ============================================================
-- PERMISSIONS
-- ============================================================
INSERT INTO permissions (name, slug, module, description)
SELECT v.name, v.slug, v.module, v.description
FROM (VALUES
  ('Billing Credit Control', 'billing.credit', 'billing', 'Credit limits and sales blocks'),
  ('Billing Approvals', 'billing.approvals', 'billing', 'Multi-level invoice approvals'),
  ('Billing Contracts', 'billing.contracts', 'billing', 'Contract and SLA billing'),
  ('Billing Projects', 'billing.projects', 'billing', 'Project T&M and milestone billing'),
  ('Billing Portal Admin', 'billing.portal', 'billing', 'Customer portal administration'),
  ('Billing Manufacturing', 'billing.mfg', 'billing', 'Invoice from production / dispatch')
) AS v(name, slug, module, description)
WHERE NOT EXISTS (SELECT 1 FROM permissions p WHERE p.slug = v.slug);

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE p.slug IN ('billing.credit','billing.approvals','billing.contracts','billing.projects','billing.portal','billing.mfg')
  AND r.slug IN ('super_administrator','managing_director','operations_manager','sales_manager','auditor')
  AND NOT EXISTS (
    SELECT 1 FROM role_permissions rp WHERE rp.role_id = r.id AND rp.permission_id = p.id
  );

-- ============================================================
-- EXTEND PAYMENTS (cheque / POS / wallet fields)
-- ============================================================
ALTER TABLE invoice_payments
  ADD COLUMN IF NOT EXISTS cheque_number VARCHAR(50),
  ADD COLUMN IF NOT EXISTS cheque_bank VARCHAR(150),
  ADD COLUMN IF NOT EXISTS cheque_date DATE,
  ADD COLUMN IF NOT EXISTS pos_terminal_id VARCHAR(80),
  ADD COLUMN IF NOT EXISTS pos_batch VARCHAR(80),
  ADD COLUMN IF NOT EXISTS wallet_provider VARCHAR(50),
  ADD COLUMN IF NOT EXISTS wallet_txn_id VARCHAR(100),
  ADD COLUMN IF NOT EXISTS bank_name VARCHAR(150),
  ADD COLUMN IF NOT EXISTS bank_account_last4 VARCHAR(10),
  ADD COLUMN IF NOT EXISTS paid_amount DECIMAL(14,2),
  ADD COLUMN IF NOT EXISTS outstanding_after DECIMAL(14,2);

-- Expand invoice for signatures, workflow, locks
ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS approval_status VARCHAR(40) DEFAULT 'none',
  -- none | pending_finance | pending_manager | pending_director | approved | rejected
  ADD COLUMN IF NOT EXISTS approval_level INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS locked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS locked_by UUID REFERENCES user_profiles(id),
  ADD COLUMN IF NOT EXISTS customer_signed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS customer_signature TEXT,
  ADD COLUMN IF NOT EXISTS finance_signature TEXT,
  ADD COLUMN IF NOT EXISTS manager_signature TEXT,
  ADD COLUMN IF NOT EXISTS digital_cert_ref VARCHAR(100),
  ADD COLUMN IF NOT EXISTS contract_id UUID,
  ADD COLUMN IF NOT EXISTS project_id UUID,
  ADD COLUMN IF NOT EXISTS dispatch_id UUID,
  ADD COLUMN IF NOT EXISTS production_order_ref VARCHAR(80),
  ADD COLUMN IF NOT EXISTS batch_numbers TEXT,
  ADD COLUMN IF NOT EXISTS serial_numbers TEXT,
  ADD COLUMN IF NOT EXISTS warranty_note TEXT,
  ADD COLUMN IF NOT EXISTS fraud_score DECIMAL(5,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS late_payment_risk DECIMAL(5,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS version_no INTEGER DEFAULT 1;

-- Credit control fields on customers
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS credit_blocked BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS credit_block_reason TEXT,
  ADD COLUMN IF NOT EXISTS risk_score DECIMAL(5,2) DEFAULT 50,
  ADD COLUMN IF NOT EXISTS require_credit_approval BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS on_hold BOOLEAN DEFAULT false;

-- ============================================================
-- CREDIT CONTROL
-- ============================================================
CREATE TABLE IF NOT EXISTS bill_credit_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  rule_code VARCHAR(40) NOT NULL,
  name VARCHAR(150) NOT NULL,
  -- e.g. block_over_limit | require_approval_pct | risk_threshold
  rule_type VARCHAR(40) NOT NULL DEFAULT 'block_over_limit',
  threshold_value DECIMAL(18,2),
  action VARCHAR(40) DEFAULT 'block_sales',
  -- block_sales | require_finance | warn | hold_invoice
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, rule_code)
);

CREATE TABLE IF NOT EXISTS bill_credit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id),
  event_type VARCHAR(40) NOT NULL,
  -- limit_exceeded | blocked | unblocked | approval_requested | approval_granted | approval_denied
  amount DECIMAL(18,2),
  credit_limit DECIMAL(18,2),
  outstanding DECIMAL(18,2),
  message TEXT,
  actor_id UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bill_credit_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id),
  request_number VARCHAR(50) NOT NULL,
  requested_amount DECIMAL(18,2) NOT NULL,
  reason TEXT,
  status VARCHAR(30) DEFAULT 'pending',
  -- pending | approved | rejected | expired
  requested_by UUID REFERENCES user_profiles(id),
  decided_by UUID REFERENCES user_profiles(id),
  decided_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, request_number)
);

-- ============================================================
-- BILLING CONTRACTS / SLAs
-- ============================================================
CREATE TABLE IF NOT EXISTS bill_contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  contract_number VARCHAR(50) NOT NULL,
  customer_id UUID REFERENCES customers(id),
  title VARCHAR(255) NOT NULL,
  contract_type VARCHAR(40) DEFAULT 'service',
  -- service | sla | maintenance | subscription | project | hosting | support
  status VARCHAR(30) DEFAULT 'active',
  start_date DATE,
  end_date DATE,
  currency VARCHAR(10) DEFAULT 'UGX',
  total_value DECIMAL(18,2) DEFAULT 0,
  billed_to_date DECIMAL(18,2) DEFAULT 0,
  billing_method VARCHAR(40) DEFAULT 'fixed',
  -- fixed | milestone | time_material | usage | retainer
  billing_frequency VARCHAR(20) DEFAULT 'monthly',
  next_bill_date DATE,
  sla_summary TEXT,
  auto_invoice BOOLEAN DEFAULT true,
  lines_json JSONB DEFAULT '[]'::jsonb,
  notes TEXT,
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, contract_number)
);

CREATE TABLE IF NOT EXISTS bill_contract_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  contract_id UUID NOT NULL REFERENCES bill_contracts(id) ON DELETE CASCADE,
  milestone_code VARCHAR(40),
  name VARCHAR(150) NOT NULL,
  due_date DATE,
  amount DECIMAL(18,2) DEFAULT 0,
  percent_complete DECIMAL(5,2) DEFAULT 0,
  status VARCHAR(30) DEFAULT 'pending',
  -- pending | ready | invoiced | paid
  invoice_id UUID REFERENCES invoices(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- PROJECT BILLING
-- ============================================================
CREATE TABLE IF NOT EXISTS bill_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  project_number VARCHAR(50) NOT NULL,
  customer_id UUID REFERENCES customers(id),
  name VARCHAR(255) NOT NULL,
  billing_type VARCHAR(40) DEFAULT 'time_material',
  -- time_material | fixed_price | milestone | retainer
  status VARCHAR(30) DEFAULT 'active',
  currency VARCHAR(10) DEFAULT 'UGX',
  budget_amount DECIMAL(18,2) DEFAULT 0,
  billed_amount DECIMAL(18,2) DEFAULT 0,
  start_date DATE,
  end_date DATE,
  notes TEXT,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, project_number)
);

CREATE TABLE IF NOT EXISTS bill_project_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES bill_projects(id) ON DELETE CASCADE,
  entry_type VARCHAR(40) DEFAULT 'labor',
  -- labor | materials | equipment | travel | expense
  entry_date DATE DEFAULT CURRENT_DATE,
  description TEXT,
  quantity DECIMAL(14,2) DEFAULT 1,
  unit VARCHAR(30) DEFAULT 'hour',
  unit_rate DECIMAL(18,2) DEFAULT 0,
  amount DECIMAL(18,2) DEFAULT 0,
  billable BOOLEAN DEFAULT true,
  invoiced BOOLEAN DEFAULT false,
  invoice_id UUID REFERENCES invoices(id),
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- DELIVERY → INVOICE TRACKING
-- ============================================================
CREATE TABLE IF NOT EXISTS bill_delivery_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  dispatch_id UUID REFERENCES dispatches(id) ON DELETE SET NULL,
  sales_order_id UUID REFERENCES sales_orders(id),
  invoice_id UUID REFERENCES invoices(id),
  customer_id UUID REFERENCES customers(id),
  delivered_qty DECIMAL(14,2) DEFAULT 0,
  invoiced_qty DECIMAL(14,2) DEFAULT 0,
  remaining_qty DECIMAL(14,2) DEFAULT 0,
  status VARCHAR(30) DEFAULT 'open',
  -- open | partial | fully_invoiced
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- APPROVAL WORKFLOW
-- ============================================================
CREATE TABLE IF NOT EXISTS bill_approval_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  step_order INTEGER NOT NULL,
  role_name VARCHAR(80) NOT NULL,
  -- finance_officer | finance_manager | director | ceo
  min_amount DECIMAL(18,2) DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  UNIQUE(company_id, step_order)
);

CREATE TABLE IF NOT EXISTS bill_approval_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  step_order INTEGER NOT NULL,
  role_name VARCHAR(80),
  action VARCHAR(30) NOT NULL,
  -- submit | approve | reject | return
  comments TEXT,
  signature_data TEXT,
  actor_id UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- CUSTOMER PORTAL
-- ============================================================
CREATE TABLE IF NOT EXISTS bill_portal_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  full_name VARCHAR(150),
  access_token VARCHAR(100) NOT NULL,
  pin_hash VARCHAR(100),
  is_active BOOLEAN DEFAULT true,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, access_token),
  UNIQUE(company_id, email)
);

CREATE TABLE IF NOT EXISTS bill_portal_disputes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id),
  invoice_id UUID REFERENCES invoices(id),
  dispute_number VARCHAR(50) NOT NULL,
  subject VARCHAR(255) NOT NULL,
  description TEXT,
  status VARCHAR(30) DEFAULT 'open',
  -- open | under_review | resolved | rejected
  resolution TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  UNIQUE(company_id, dispute_number)
);

CREATE TABLE IF NOT EXISTS bill_statement_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id),
  period_from DATE,
  period_to DATE,
  status VARCHAR(30) DEFAULT 'ready',
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- COMMUNICATION LOG
-- ============================================================
CREATE TABLE IF NOT EXISTS bill_communications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  invoice_id UUID REFERENCES invoices(id),
  customer_id UUID REFERENCES customers(id),
  channel VARCHAR(30) NOT NULL DEFAULT 'email',
  -- email | sms | whatsapp | portal
  event_type VARCHAR(50) NOT NULL,
  -- invoice_created | payment_reminder | overdue | payment_received | receipt | custom
  recipient VARCHAR(255),
  subject VARCHAR(255),
  body TEXT,
  status VARCHAR(30) DEFAULT 'queued',
  -- queued | sent | failed | delivered
  error_message TEXT,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- INVOICE VERSIONS / AUDIT
-- ============================================================
CREATE TABLE IF NOT EXISTS bill_invoice_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  version_no INTEGER NOT NULL,
  snapshot_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  change_note TEXT,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(invoice_id, version_no)
);

CREATE TABLE IF NOT EXISTS bill_fraud_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  invoice_id UUID REFERENCES invoices(id),
  customer_id UUID REFERENCES customers(id),
  alert_type VARCHAR(50) NOT NULL,
  -- duplicate | amount_anomaly | rapid_void | suspicious_payment
  severity VARCHAR(20) DEFAULT 'medium',
  message TEXT,
  status VARCHAR(30) DEFAULT 'open',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Online payment link extras
ALTER TABLE bill_payment_intents
  ADD COLUMN IF NOT EXISTS payment_link VARCHAR(500),
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS notify_customer BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS provider_payload JSONB DEFAULT '{}'::jsonb;

-- Ensure gateway seed includes PayPal / Stripe / POS / Wallet / Cheque
DO $$
DECLARE cid UUID;
BEGIN
  SELECT id INTO cid FROM companies ORDER BY created_at LIMIT 1;
  IF cid IS NULL THEN RETURN; END IF;

  INSERT INTO bill_payment_gateways (company_id, gateway_code, name, provider, is_active, supported_currencies)
  VALUES
    (cid, 'CHEQUE', 'Cheque', 'cheque', true, ARRAY['UGX','USD']),
    (cid, 'POS', 'POS Terminal', 'pos', true, ARRAY['UGX','USD']),
    (cid, 'WALLET', 'Digital Wallet', 'wallet', true, ARRAY['UGX','USD']),
    (cid, 'STRIPE', 'Stripe', 'stripe', false, ARRAY['USD','EUR','GBP']),
    (cid, 'PAYPAL', 'PayPal', 'paypal', false, ARRAY['USD','EUR']),
    (cid, 'BANKAPI', 'Bank API Transfer', 'bank_api', false, ARRAY['UGX','USD','KES'])
  ON CONFLICT (company_id, gateway_code) DO NOTHING;

  INSERT INTO bill_credit_rules (company_id, rule_code, name, rule_type, threshold_value, action)
  VALUES
    (cid, 'OVER-LIMIT', 'Block when over credit limit', 'block_over_limit', 0, 'block_sales'),
    (cid, 'RISK-70', 'Require finance if risk score ≥ 70', 'risk_threshold', 70, 'require_finance'),
    (cid, 'WARN-80', 'Warn at 80% of credit limit', 'warn_pct', 80, 'warn')
  ON CONFLICT (company_id, rule_code) DO NOTHING;

  INSERT INTO bill_approval_steps (company_id, step_order, role_name, min_amount)
  VALUES
    (cid, 1, 'finance_officer', 0),
    (cid, 2, 'finance_manager', 5000000),
    (cid, 3, 'director', 20000000),
    (cid, 4, 'ceo', 100000000)
  ON CONFLICT (company_id, step_order) DO NOTHING;
END $$;

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE bill_credit_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE bill_credit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE bill_credit_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE bill_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE bill_contract_milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE bill_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE bill_project_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE bill_delivery_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE bill_approval_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE bill_approval_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE bill_portal_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE bill_portal_disputes ENABLE ROW LEVEL SECURITY;
ALTER TABLE bill_statement_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE bill_communications ENABLE ROW LEVEL SECURITY;
ALTER TABLE bill_invoice_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE bill_fraud_alerts ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'bill_credit_rules','bill_credit_events','bill_credit_approvals',
    'bill_contracts','bill_contract_milestones','bill_projects','bill_project_entries',
    'bill_delivery_links','bill_approval_steps','bill_approval_actions',
    'bill_portal_users','bill_portal_disputes','bill_statement_requests',
    'bill_communications','bill_invoice_versions','bill_fraud_alerts'
  ]
  LOOP
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

-- Public portal read via token is handled in app API with service role / filtered queries
