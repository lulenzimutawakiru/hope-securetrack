-- Finance: soft-delete columns + extra seed for UI demos

ALTER TABLE chart_of_accounts
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES user_profiles(id);

ALTER TABLE gl_journals
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS notes TEXT;

ALTER TABLE ap_invoices
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

ALTER TABLE bank_accounts
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

ALTER TABLE fixed_assets
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS qr_code VARCHAR(100),
  ADD COLUMN IF NOT EXISTS serial_number VARCHAR(100);

ALTER TABLE budgets
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

ALTER TABLE suppliers
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Sample budget if missing
INSERT INTO budgets (
  company_id, budget_code, name, budget_type, currency, total_amount, status, version, notes
)
SELECT
  'a0000000-0000-4000-8000-000000000001',
  'BUD-2026-OPS',
  'FY2026 Operational Budget',
  'operational',
  'UGX',
  2500000000,
  'approved',
  1,
  'Board-approved operating budget'
WHERE NOT EXISTS (
  SELECT 1 FROM budgets WHERE budget_code = 'BUD-2026-OPS'
);

-- Sample fixed asset
INSERT INTO fixed_assets (
  company_id, asset_code, asset_name, category, location, purchase_date,
  acquisition_cost, residual_value, useful_life_months, depreciation_method,
  book_value, status, serial_number
)
SELECT
  'a0000000-0000-4000-8000-000000000001',
  'FA-PRESS-01',
  'Security Printing Press Line A',
  'Plant & Machinery',
  'Main Factory',
  '2023-06-15',
  450000000,
  45000000,
  120,
  'straight_line',
  360000000,
  'active',
  'SP-2023-AX91'
WHERE NOT EXISTS (
  SELECT 1 FROM fixed_assets WHERE asset_code = 'FA-PRESS-01'
);

-- Sample AP invoice
INSERT INTO ap_invoices (
  company_id, invoice_number, supplier_id, supplier_invoice_ref, invoice_date, due_date,
  currency, subtotal, tax_amount, total_amount, amount_paid, status, description
)
SELECT
  'a0000000-0000-4000-8000-000000000001',
  'AP-INV-2026-001',
  s.id,
  'SUP-INV-8891',
  CURRENT_DATE - 10,
  CURRENT_DATE + 20,
  'UGX',
  22500000,
  4050000,
  26550000,
  0,
  'approved',
  'Pulp rolls call-off — linked to PO-2026-0042'
FROM suppliers s
WHERE s.code = 'SUP-PULP01'
  AND NOT EXISTS (SELECT 1 FROM ap_invoices WHERE invoice_number = 'AP-INV-2026-001');

-- Sample bank transaction
INSERT INTO bank_transactions (
  company_id, bank_account_id, txn_date, txn_type, amount, currency, description, reference, is_reconciled
)
SELECT
  'a0000000-0000-4000-8000-000000000001',
  ba.id,
  CURRENT_DATE - 2,
  'deposit',
  5800000,
  'UGX',
  'Customer receipt batch',
  'RCP-BATCH-442',
  false
FROM bank_accounts ba
WHERE ba.account_code = 'BNK-MAIN'
  AND NOT EXISTS (
    SELECT 1 FROM bank_transactions WHERE reference = 'RCP-BATCH-442'
  );

INSERT INTO finance_insights (company_id, insight_type, severity, title, recommendation, metric_value)
SELECT
  'a0000000-0000-4000-8000-000000000001',
  'ar_aging',
  'high',
  'AR over 45 days rising',
  'Outstanding customer balances past 45 days increased. Prioritise collection calls on wholesale accounts and hold new credit releases until cleared.',
  45
WHERE NOT EXISTS (
  SELECT 1 FROM finance_insights WHERE title = 'AR over 45 days rising'
);
