-- Hope Design Group Ltd — Enterprise Invoicing & Billing Platform
-- AR · Tax · Recurring · Payments · Designer · Revenue · Multi-company

-- ============================================================
-- PERMISSIONS
-- ============================================================
INSERT INTO permissions (name, slug, module, description)
SELECT v.name, v.slug, v.module, v.description
FROM (VALUES
  ('View Billing', 'billing.view', 'billing', 'View invoices and AR'),
  ('Manage Billing', 'billing.manage', 'billing', 'Create and manage invoices'),
  ('Approve Invoices', 'billing.approve', 'billing', 'Approve and issue invoices'),
  ('Collect Payments', 'billing.collect', 'billing', 'Record and allocate payments'),
  ('Billing Tax', 'billing.tax', 'billing', 'Tax configuration and reports'),
  ('Billing Design', 'billing.design', 'billing', 'Invoice templates and designer'),
  ('Billing Recurring', 'billing.recurring', 'billing', 'Subscriptions and recurring invoices'),
  ('Billing AI', 'billing.ai', 'billing', 'AI invoice assistance')
) AS v(name, slug, module, description)
WHERE NOT EXISTS (SELECT 1 FROM permissions p WHERE p.slug = v.slug);

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE p.slug LIKE 'billing.%'
  AND r.slug IN (
    'super_administrator', 'managing_director', 'operations_manager',
    'sales_manager', 'auditor'
  )
  AND NOT EXISTS (
    SELECT 1 FROM role_permissions rp
    WHERE rp.role_id = r.id AND rp.permission_id = p.id
  );

-- ============================================================
-- EXTEND CUSTOMERS (billing profile)
-- ============================================================
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS vat_number VARCHAR(100),
  ADD COLUMN IF NOT EXISTS currency VARCHAR(10) DEFAULT 'UGX',
  ADD COLUMN IF NOT EXISTS credit_rating VARCHAR(20) DEFAULT 'B',
  ADD COLUMN IF NOT EXISTS price_list_code VARCHAR(50),
  ADD COLUMN IF NOT EXISTS discount_pct DECIMAL(5,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS account_manager VARCHAR(150),
  ADD COLUMN IF NOT EXISTS contract_ref VARCHAR(100),
  ADD COLUMN IF NOT EXISTS billing_email VARCHAR(255),
  ADD COLUMN IF NOT EXISTS branch_name VARCHAR(100),
  ADD COLUMN IF NOT EXISTS entity_type VARCHAR(40) DEFAULT 'company',
  -- company | government | institution | retail | distributor | dealer | department
  ADD COLUMN IF NOT EXISTS default_tax_code VARCHAR(30),
  ADD COLUMN IF NOT EXISTS bank_name VARCHAR(150),
  ADD COLUMN IF NOT EXISTS bank_account VARCHAR(100),
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- ============================================================
-- EXTEND INVOICES
-- ============================================================
ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS invoice_type VARCHAR(40) DEFAULT 'standard',
  -- standard | tax | proforma | recurring | credit_note | debit_note | export | commercial
  ADD COLUMN IF NOT EXISTS branch_code VARCHAR(30),
  ADD COLUMN IF NOT EXISTS division_name VARCHAR(100),
  ADD COLUMN IF NOT EXISTS billing_address TEXT,
  ADD COLUMN IF NOT EXISTS delivery_address TEXT,
  ADD COLUMN IF NOT EXISTS customer_tax_id VARCHAR(100),
  ADD COLUMN IF NOT EXISTS customer_vat_number VARCHAR(100),
  ADD COLUMN IF NOT EXISTS payment_terms_days INTEGER DEFAULT 30,
  ADD COLUMN IF NOT EXISTS payment_terms_label VARCHAR(100),
  ADD COLUMN IF NOT EXISTS withholding_tax DECIMAL(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS shipping_amount DECIMAL(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS balance_due DECIMAL(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS exchange_rate DECIMAL(18,8) DEFAULT 1,
  ADD COLUMN IF NOT EXISTS base_currency VARCHAR(10) DEFAULT 'UGX',
  ADD COLUMN IF NOT EXISTS base_total DECIMAL(18,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tax_breakdown JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS template_id UUID,
  ADD COLUMN IF NOT EXISTS recurring_schedule_id UUID,
  ADD COLUMN IF NOT EXISTS source_type VARCHAR(40),
  -- manual | sales_order | delivery | contract | subscription | timesheet | project | service | ai
  ADD COLUMN IF NOT EXISTS source_ref VARCHAR(100),
  ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES user_profiles(id),
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS sent_via VARCHAR(40),
  ADD COLUMN IF NOT EXISTS voided_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS void_reason TEXT,
  ADD COLUMN IF NOT EXISTS po_number VARCHAR(100),
  ADD COLUMN IF NOT EXISTS reference VARCHAR(100),
  ADD COLUMN IF NOT EXISTS bank_details TEXT,
  ADD COLUMN IF NOT EXISTS terms_conditions TEXT,
  ADD COLUMN IF NOT EXISTS digital_signature TEXT,
  ADD COLUMN IF NOT EXISTS qr_public_id VARCHAR(80),
  ADD COLUMN IF NOT EXISTS related_invoice_id UUID REFERENCES invoices(id),
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

ALTER TABLE invoice_lines
  ADD COLUMN IF NOT EXISTS discount_pct DECIMAL(5,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_amount DECIMAL(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tax_code VARCHAR(30),
  ADD COLUMN IF NOT EXISTS tax_amount DECIMAL(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS line_type VARCHAR(30) DEFAULT 'product',
  -- product | service | shipping | adjustment
  ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;

ALTER TABLE invoice_payments
  ADD COLUMN IF NOT EXISTS currency VARCHAR(10) DEFAULT 'UGX',
  ADD COLUMN IF NOT EXISTS gateway VARCHAR(50),
  ADD COLUMN IF NOT EXISTS gateway_ref VARCHAR(150),
  ADD COLUMN IF NOT EXISTS status VARCHAR(30) DEFAULT 'completed',
  ADD COLUMN IF NOT EXISTS receipt_number VARCHAR(50),
  ADD COLUMN IF NOT EXISTS allocated_amount DECIMAL(14,2),
  ADD COLUMN IF NOT EXISTS unallocated_amount DECIMAL(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bank_account_id UUID,
  ADD COLUMN IF NOT EXISTS mobile_money_msisdn VARCHAR(30);

CREATE INDEX IF NOT EXISTS idx_invoices_type ON invoices(company_id, invoice_type);
CREATE INDEX IF NOT EXISTS idx_invoices_due ON invoices(company_id, due_date) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_invoices_customer ON invoices(customer_id);

-- ============================================================
-- NUMBERING SEQUENCES
-- ============================================================
CREATE TABLE IF NOT EXISTS bill_sequences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  sequence_code VARCHAR(50) NOT NULL,
  name VARCHAR(150) NOT NULL,
  doc_type VARCHAR(40) NOT NULL DEFAULT 'invoice',
  -- invoice | proforma | credit_note | debit_note | receipt | commercial
  prefix VARCHAR(30) NOT NULL DEFAULT 'HDG',
  branch_code VARCHAR(20),
  include_year BOOLEAN DEFAULT true,
  include_month BOOLEAN DEFAULT false,
  pad_length INTEGER DEFAULT 6,
  next_value BIGINT DEFAULT 1,
  check_digit BOOLEAN DEFAULT false,
  separator VARCHAR(5) DEFAULT '-',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, sequence_code)
);

-- ============================================================
-- TAX
-- ============================================================
CREATE TABLE IF NOT EXISTS bill_tax_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  tax_code VARCHAR(30) NOT NULL,
  name VARCHAR(150) NOT NULL,
  tax_type VARCHAR(40) NOT NULL DEFAULT 'vat',
  -- vat | sales_tax | withholding | excise | local | international | zero | exempt
  rate DECIMAL(8,4) NOT NULL DEFAULT 18,
  is_inclusive BOOLEAN DEFAULT false,
  is_recoverable BOOLEAN DEFAULT true,
  is_active BOOLEAN DEFAULT true,
  gl_account_code VARCHAR(50),
  country VARCHAR(100) DEFAULT 'Uganda',
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, tax_code)
);

CREATE TABLE IF NOT EXISTS bill_tax_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  group_code VARCHAR(30) NOT NULL,
  name VARCHAR(150) NOT NULL,
  tax_codes TEXT[] DEFAULT '{}',
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, group_code)
);

-- ============================================================
-- PRICE LISTS & PAYMENT TERMS
-- ============================================================
CREATE TABLE IF NOT EXISTS bill_price_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  list_code VARCHAR(50) NOT NULL,
  name VARCHAR(150) NOT NULL,
  currency VARCHAR(10) DEFAULT 'UGX',
  is_default BOOLEAN DEFAULT false,
  valid_from DATE,
  valid_to DATE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, list_code)
);

CREATE TABLE IF NOT EXISTS bill_price_list_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  price_list_id UUID NOT NULL REFERENCES bill_price_lists(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id),
  sku VARCHAR(80),
  description VARCHAR(255),
  unit_price DECIMAL(18,2) NOT NULL DEFAULT 0,
  min_qty DECIMAL(14,2) DEFAULT 1,
  discount_pct DECIMAL(5,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bill_payment_terms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  term_code VARCHAR(30) NOT NULL,
  name VARCHAR(150) NOT NULL,
  days INTEGER NOT NULL DEFAULT 30,
  discount_pct DECIMAL(5,2) DEFAULT 0,
  discount_days INTEGER DEFAULT 0,
  description TEXT,
  is_default BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  UNIQUE(company_id, term_code)
);

-- ============================================================
-- INVOICE TEMPLATES (designer)
-- ============================================================
CREATE TABLE IF NOT EXISTS bill_invoice_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  template_code VARCHAR(50) NOT NULL,
  name VARCHAR(150) NOT NULL,
  description TEXT,
  invoice_types TEXT[] DEFAULT ARRAY['standard','tax'],
  design_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- header/body/footer blocks, colors, bank details, terms
  logo_url TEXT,
  primary_color VARCHAR(20) DEFAULT '#0f766e',
  show_qr BOOLEAN DEFAULT true,
  show_tax_breakdown BOOLEAN DEFAULT true,
  show_bank_details BOOLEAN DEFAULT true,
  default_terms TEXT,
  default_bank_details TEXT,
  language VARCHAR(10) DEFAULT 'en',
  is_default BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  version INTEGER DEFAULT 1,
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, template_code)
);

-- ============================================================
-- RECURRING / SUBSCRIPTIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS bill_recurring_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  schedule_number VARCHAR(50) NOT NULL,
  customer_id UUID REFERENCES customers(id),
  name VARCHAR(150) NOT NULL,
  description TEXT,
  frequency VARCHAR(20) NOT NULL DEFAULT 'monthly',
  -- daily | weekly | monthly | quarterly | yearly
  interval_count INTEGER DEFAULT 1,
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date DATE,
  next_run_date DATE,
  last_run_date DATE,
  day_of_month INTEGER DEFAULT 1,
  currency VARCHAR(10) DEFAULT 'UGX',
  payment_terms_days INTEGER DEFAULT 14,
  tax_code VARCHAR(30) DEFAULT 'VAT18',
  status VARCHAR(30) DEFAULT 'active',
  -- active | paused | completed | cancelled
  auto_send BOOLEAN DEFAULT true,
  auto_approve BOOLEAN DEFAULT false,
  lines_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  invoices_generated INTEGER DEFAULT 0,
  template_id UUID REFERENCES bill_invoice_templates(id),
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, schedule_number)
);

-- ============================================================
-- CREDIT / DEBIT NOTES (billing module; complements ar_credit_notes)
-- ============================================================
CREATE TABLE IF NOT EXISTS bill_credit_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  credit_note_number VARCHAR(50) NOT NULL,
  customer_id UUID REFERENCES customers(id),
  invoice_id UUID REFERENCES invoices(id),
  credit_date DATE NOT NULL DEFAULT CURRENT_DATE,
  reason_code VARCHAR(40) DEFAULT 'adjustment',
  -- return | overpayment | adjustment | discount | error
  reason TEXT,
  currency VARCHAR(10) DEFAULT 'UGX',
  subtotal DECIMAL(18,2) DEFAULT 0,
  tax_amount DECIMAL(18,2) DEFAULT 0,
  total_amount DECIMAL(18,2) DEFAULT 0,
  amount_applied DECIMAL(18,2) DEFAULT 0,
  status VARCHAR(30) DEFAULT 'draft',
  -- draft | issued | applied | void
  lines_json JSONB DEFAULT '[]'::jsonb,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, credit_note_number)
);

CREATE TABLE IF NOT EXISTS bill_debit_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  debit_note_number VARCHAR(50) NOT NULL,
  customer_id UUID REFERENCES customers(id),
  invoice_id UUID REFERENCES invoices(id),
  debit_date DATE NOT NULL DEFAULT CURRENT_DATE,
  reason TEXT,
  currency VARCHAR(10) DEFAULT 'UGX',
  subtotal DECIMAL(18,2) DEFAULT 0,
  tax_amount DECIMAL(18,2) DEFAULT 0,
  total_amount DECIMAL(18,2) DEFAULT 0,
  status VARCHAR(30) DEFAULT 'draft',
  lines_json JSONB DEFAULT '[]'::jsonb,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, debit_note_number)
);

-- ============================================================
-- PAYMENT GATEWAYS & INTENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS bill_payment_gateways (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  gateway_code VARCHAR(40) NOT NULL,
  name VARCHAR(150) NOT NULL,
  provider VARCHAR(50) NOT NULL,
  -- cash | bank_transfer | card | mtn_momo | airtel_money | stripe | flutterwave | pesapal | manual
  is_active BOOLEAN DEFAULT true,
  config JSONB DEFAULT '{}'::jsonb,
  supported_currencies TEXT[] DEFAULT ARRAY['UGX','USD','KES'],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, gateway_code)
);

CREATE TABLE IF NOT EXISTS bill_payment_intents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  intent_number VARCHAR(50) NOT NULL,
  invoice_id UUID REFERENCES invoices(id),
  customer_id UUID REFERENCES customers(id),
  gateway_code VARCHAR(40),
  amount DECIMAL(18,2) NOT NULL,
  currency VARCHAR(10) DEFAULT 'UGX',
  status VARCHAR(30) DEFAULT 'pending',
  -- pending | processing | succeeded | failed | cancelled | refunded
  external_ref VARCHAR(150),
  checkout_url TEXT,
  phone_msisdn VARCHAR(30),
  error_message TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, intent_number)
);

-- ============================================================
-- DUNNING / REMINDERS
-- ============================================================
CREATE TABLE IF NOT EXISTS bill_dunning_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  rule_code VARCHAR(40) NOT NULL,
  name VARCHAR(150) NOT NULL,
  days_overdue INTEGER NOT NULL DEFAULT 7,
  channel VARCHAR(30) DEFAULT 'email',
  -- email | sms | in_app | call
  subject_template VARCHAR(255),
  body_template TEXT,
  escalate_to_role VARCHAR(80),
  is_active BOOLEAN DEFAULT true,
  UNIQUE(company_id, rule_code)
);

CREATE TABLE IF NOT EXISTS bill_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  invoice_id UUID REFERENCES invoices(id),
  customer_id UUID REFERENCES customers(id),
  reminder_type VARCHAR(40) DEFAULT 'payment_due',
  channel VARCHAR(30) DEFAULT 'email',
  status VARCHAR(30) DEFAULT 'pending',
  scheduled_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- REVENUE RECOGNITION (simple schedules)
-- ============================================================
CREATE TABLE IF NOT EXISTS bill_revenue_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  invoice_id UUID REFERENCES invoices(id),
  customer_id UUID REFERENCES customers(id),
  description TEXT,
  total_amount DECIMAL(18,2) NOT NULL,
  recognized_amount DECIMAL(18,2) DEFAULT 0,
  currency VARCHAR(10) DEFAULT 'UGX',
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  recognition_method VARCHAR(40) DEFAULT 'straight_line',
  status VARCHAR(30) DEFAULT 'open',
  -- open | complete | cancelled
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bill_revenue_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  schedule_id UUID NOT NULL REFERENCES bill_revenue_schedules(id) ON DELETE CASCADE,
  period_label VARCHAR(40),
  entry_date DATE NOT NULL,
  amount DECIMAL(18,2) NOT NULL,
  status VARCHAR(30) DEFAULT 'posted',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- DELIVERY / AUDIT / AI
-- ============================================================
CREATE TABLE IF NOT EXISTS bill_delivery_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  invoice_id UUID REFERENCES invoices(id),
  channel VARCHAR(30) NOT NULL DEFAULT 'email',
  recipient VARCHAR(255),
  status VARCHAR(30) DEFAULT 'sent',
  provider_ref VARCHAR(150),
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bill_ai_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  action VARCHAR(50) NOT NULL,
  prompt TEXT,
  result_summary TEXT,
  invoice_id UUID REFERENCES invoices(id),
  payload JSONB,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bill_reconciliation_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  batch_number VARCHAR(50) NOT NULL,
  bank_account_label VARCHAR(150),
  period_start DATE,
  period_end DATE,
  status VARCHAR(30) DEFAULT 'open',
  matched_count INTEGER DEFAULT 0,
  unmatched_count INTEGER DEFAULT 0,
  notes TEXT,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, batch_number)
);

CREATE TABLE IF NOT EXISTS bill_reconciliation_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL REFERENCES bill_reconciliation_batches(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  txn_date DATE,
  description TEXT,
  amount DECIMAL(18,2),
  reference VARCHAR(100),
  matched_payment_id UUID,
  matched_invoice_id UUID REFERENCES invoices(id),
  status VARCHAR(30) DEFAULT 'unmatched',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE bill_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE bill_tax_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE bill_tax_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE bill_price_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE bill_price_list_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE bill_payment_terms ENABLE ROW LEVEL SECURITY;
ALTER TABLE bill_invoice_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE bill_recurring_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE bill_credit_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE bill_debit_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE bill_payment_gateways ENABLE ROW LEVEL SECURITY;
ALTER TABLE bill_payment_intents ENABLE ROW LEVEL SECURITY;
ALTER TABLE bill_dunning_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE bill_reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE bill_revenue_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE bill_revenue_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE bill_delivery_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE bill_ai_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE bill_reconciliation_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE bill_reconciliation_lines ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'bill_sequences','bill_tax_codes','bill_tax_groups','bill_price_lists',
    'bill_price_list_items','bill_payment_terms','bill_invoice_templates',
    'bill_recurring_schedules','bill_credit_notes','bill_debit_notes',
    'bill_payment_gateways','bill_payment_intents','bill_dunning_rules',
    'bill_reminders','bill_revenue_schedules','bill_revenue_entries',
    'bill_delivery_logs','bill_ai_logs','bill_reconciliation_batches',
    'bill_reconciliation_lines'
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

-- ============================================================
-- SEED
-- ============================================================
DO $$
DECLARE
  cid UUID;
BEGIN
  SELECT id INTO cid FROM companies ORDER BY created_at LIMIT 1;
  IF cid IS NULL THEN RETURN; END IF;

  INSERT INTO bill_sequences (company_id, sequence_code, name, doc_type, prefix, pad_length)
  VALUES
    (cid, 'INV', 'Standard Invoices', 'invoice', 'HDG-INV', 6),
    (cid, 'PRO', 'Proforma Invoices', 'proforma', 'HDG-PRO', 6),
    (cid, 'CRN', 'Credit Notes', 'credit_note', 'HDG-CRN', 6),
    (cid, 'DBN', 'Debit Notes', 'debit_note', 'HDG-DBN', 6),
    (cid, 'RCP', 'Receipts', 'receipt', 'HDG-RCP', 6),
    (cid, 'COM', 'Commercial Invoices', 'commercial', 'HDG-COM', 6)
  ON CONFLICT (company_id, sequence_code) DO NOTHING;

  INSERT INTO bill_tax_codes (company_id, tax_code, name, tax_type, rate, country)
  VALUES
    (cid, 'VAT18', 'Uganda VAT 18%', 'vat', 18, 'Uganda'),
    (cid, 'VAT0', 'Zero-rated VAT', 'zero', 0, 'Uganda'),
    (cid, 'EXEMPT', 'VAT Exempt', 'exempt', 0, 'Uganda'),
    (cid, 'WHT6', 'Withholding Tax 6%', 'withholding', 6, 'Uganda'),
    (cid, 'EXCISE', 'Excise duty', 'excise', 10, 'Uganda')
  ON CONFLICT (company_id, tax_code) DO NOTHING;

  INSERT INTO bill_tax_groups (company_id, group_code, name, tax_codes, is_default)
  VALUES
    (cid, 'UG-STD', 'Uganda Standard', ARRAY['VAT18'], true),
    (cid, 'UG-EXPORT', 'Export Zero', ARRAY['VAT0'], false)
  ON CONFLICT (company_id, group_code) DO NOTHING;

  INSERT INTO bill_payment_terms (company_id, term_code, name, days, is_default)
  VALUES
    (cid, 'NET0', 'Due on receipt', 0, false),
    (cid, 'NET7', 'Net 7', 7, false),
    (cid, 'NET15', 'Net 15', 15, false),
    (cid, 'NET30', 'Net 30', 30, true),
    (cid, 'NET45', 'Net 45', 45, false),
    (cid, 'NET60', 'Net 60', 60, false)
  ON CONFLICT (company_id, term_code) DO NOTHING;

  INSERT INTO bill_price_lists (company_id, list_code, name, currency, is_default)
  VALUES
    (cid, 'STD', 'Standard Price List', 'UGX', true),
    (cid, 'DIST', 'Distributor Price List', 'UGX', false),
    (cid, 'EXPORT', 'Export USD List', 'USD', false)
  ON CONFLICT (company_id, list_code) DO NOTHING;

  INSERT INTO bill_invoice_templates (
    company_id, template_code, name, description, is_default,
    default_terms, default_bank_details, design_json, show_qr, show_tax_breakdown
  )
  VALUES (
    cid, 'TPL-STD', 'Hope Design Standard Invoice',
    'Professional tax invoice with VAT breakdown and bank details',
    true,
    'Payment is due within the stated payment terms. Goods remain property of Hope Design Group Ltd until paid in full. Disputes must be raised within 7 days of invoice date.',
    E'Bank: Stanbic Bank Uganda\nAccount Name: Hope Design Group Ltd\nAccount No: 90300XXXXXX\nCurrency: UGX\nMobile Money: MTN 0772 XXX XXX (Hope Design)',
    '{
      "header": {"showLogo": true, "showTaxIds": true, "title": "TAX INVOICE"},
      "body": {"showLineTax": true, "showDiscount": true},
      "footer": {"showBank": true, "showTerms": true, "showSignature": true, "showQr": true},
      "colors": {"primary": "#0f766e", "secondary": "#0f172a"}
    }'::jsonb,
    true, true
  )
  ON CONFLICT (company_id, template_code) DO NOTHING;

  INSERT INTO bill_invoice_templates (
    company_id, template_code, name, description, invoice_types,
    default_terms, design_json, is_default
  )
  VALUES (
    cid, 'TPL-PRO', 'Proforma Invoice',
    'Proforma for quotations and pre-billing',
    ARRAY['proforma'],
    'This is a proforma invoice and is not a request for payment unless agreed. Final tax invoice will be issued upon delivery/acceptance.',
    '{"header":{"title":"PROFORMA INVOICE"},"footer":{"showBank":true,"showTerms":true}}'::jsonb,
    false
  )
  ON CONFLICT (company_id, template_code) DO NOTHING;

  INSERT INTO bill_payment_gateways (company_id, gateway_code, name, provider, is_active)
  VALUES
    (cid, 'CASH', 'Cash', 'cash', true),
    (cid, 'BANK', 'Bank Transfer', 'bank_transfer', true),
    (cid, 'MTN', 'MTN Mobile Money', 'mtn_momo', true),
    (cid, 'AIRTEL', 'Airtel Money', 'airtel_money', true),
    (cid, 'CARD', 'Card Payment', 'card', true),
    (cid, 'FLW', 'Flutterwave', 'flutterwave', false),
    (cid, 'PESAPAL', 'Pesapal', 'pesapal', false)
  ON CONFLICT (company_id, gateway_code) DO NOTHING;

  INSERT INTO bill_dunning_rules (company_id, rule_code, name, days_overdue, channel, subject_template, body_template)
  VALUES
    (cid, 'DUE-3', 'Friendly reminder (3 days before)', -3, 'email',
     'Upcoming payment: {{invoice_number}}',
     'Dear {{customer_name}}, invoice {{invoice_number}} for {{total}} is due on {{due_date}}.'),
    (cid, 'OD-7', 'Overdue 7 days', 7, 'email',
     'Overdue invoice {{invoice_number}}',
     'Dear {{customer_name}}, invoice {{invoice_number}} is 7 days overdue. Please arrange payment.'),
    (cid, 'OD-30', 'Overdue 30 days — escalate', 30, 'email',
     'Final notice: {{invoice_number}}',
     'Final notice for overdue invoice {{invoice_number}}. Account may be placed on credit hold.')
  ON CONFLICT (company_id, rule_code) DO NOTHING;

END $$;
