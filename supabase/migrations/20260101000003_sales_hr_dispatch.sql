-- Hope SecureTrack — Sales, Invoicing, Dispatch, HR, Printer discovery

-- ============================================================
-- ENUMS
-- ============================================================
DO $$ BEGIN
  CREATE TYPE sales_order_status AS ENUM (
    'draft', 'confirmed', 'picking', 'dispatched', 'invoiced', 'cancelled', 'completed'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE invoice_status AS ENUM (
    'draft', 'issued', 'partially_paid', 'paid', 'overdue', 'cancelled', 'void'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE dispatch_status AS ENUM (
    'draft', 'ready', 'in_transit', 'delivered', 'failed', 'cancelled'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE employment_status AS ENUM (
    'active', 'on_leave', 'probation', 'suspended', 'terminated'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE leave_status AS ENUM (
    'pending', 'approved', 'rejected', 'cancelled'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- PRINTERS — discovery fields
-- ============================================================
ALTER TABLE printers
  ADD COLUMN IF NOT EXISTS bluetooth_address VARCHAR(64),
  ADD COLUMN IF NOT EXISTS device_id VARCHAR(255),
  ADD COLUMN IF NOT EXISTS transport VARCHAR(50) DEFAULT 'bluetooth',
  ADD COLUMN IF NOT EXISTS firmware_version VARCHAR(50),
  ADD COLUMN IF NOT EXISTS label_width_mm INTEGER DEFAULT 50,
  ADD COLUMN IF NOT EXISTS label_height_mm INTEGER DEFAULT 30,
  ADD COLUMN IF NOT EXISTS is_default BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_discovered_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS discovery_source VARCHAR(50);

CREATE INDEX IF NOT EXISTS idx_printers_company ON printers(company_id);
CREATE INDEX IF NOT EXISTS idx_printers_status ON printers(status);

-- ============================================================
-- CUSTOMERS (sales)
-- ============================================================
CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  code VARCHAR(50) NOT NULL,
  name VARCHAR(255) NOT NULL,
  customer_type VARCHAR(50) DEFAULT 'wholesale',
  contact_person VARCHAR(255),
  email VARCHAR(255),
  phone VARCHAR(50),
  tax_id VARCHAR(100),
  billing_address TEXT,
  shipping_address TEXT,
  city VARCHAR(100),
  country VARCHAR(100) DEFAULT 'Kenya',
  credit_limit DECIMAL(14,2) DEFAULT 0,
  payment_terms_days INTEGER DEFAULT 30,
  is_active BOOLEAN DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, code)
);

-- ============================================================
-- SALES ORDERS
-- ============================================================
CREATE TABLE IF NOT EXISTS sales_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  order_number VARCHAR(50) NOT NULL,
  customer_id UUID REFERENCES customers(id),
  distributor_id UUID REFERENCES distributors(id),
  status sales_order_status DEFAULT 'draft',
  order_date DATE NOT NULL DEFAULT CURRENT_DATE,
  required_date DATE,
  currency VARCHAR(10) DEFAULT 'KES',
  subtotal DECIMAL(14,2) DEFAULT 0,
  tax_amount DECIMAL(14,2) DEFAULT 0,
  discount_amount DECIMAL(14,2) DEFAULT 0,
  total_amount DECIMAL(14,2) DEFAULT 0,
  notes TEXT,
  sales_rep_id UUID REFERENCES user_profiles(id),
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, order_number)
);

CREATE TABLE IF NOT EXISTS sales_order_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES sales_orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id),
  description TEXT,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit VARCHAR(20) DEFAULT 'carton',
  unit_price DECIMAL(14,2) NOT NULL DEFAULT 0,
  tax_rate DECIMAL(5,2) DEFAULT 16,
  line_total DECIMAL(14,2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sales_orders_status ON sales_orders(status);
CREATE INDEX IF NOT EXISTS idx_sales_orders_customer ON sales_orders(customer_id);

-- ============================================================
-- INVOICES
-- ============================================================
CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  invoice_number VARCHAR(50) NOT NULL,
  sales_order_id UUID REFERENCES sales_orders(id),
  customer_id UUID REFERENCES customers(id),
  distributor_id UUID REFERENCES distributors(id),
  status invoice_status DEFAULT 'draft',
  invoice_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE,
  currency VARCHAR(10) DEFAULT 'KES',
  subtotal DECIMAL(14,2) DEFAULT 0,
  tax_amount DECIMAL(14,2) DEFAULT 0,
  discount_amount DECIMAL(14,2) DEFAULT 0,
  total_amount DECIMAL(14,2) DEFAULT 0,
  amount_paid DECIMAL(14,2) DEFAULT 0,
  notes TEXT,
  issued_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, invoice_number)
);

CREATE TABLE IF NOT EXISTS invoice_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id),
  description TEXT,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit VARCHAR(20) DEFAULT 'carton',
  unit_price DECIMAL(14,2) NOT NULL DEFAULT 0,
  tax_rate DECIMAL(5,2) DEFAULT 16,
  line_total DECIMAL(14,2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS invoice_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  amount DECIMAL(14,2) NOT NULL,
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  method VARCHAR(50) DEFAULT 'bank_transfer',
  reference VARCHAR(100),
  notes TEXT,
  recorded_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);

-- ============================================================
-- DISPATCH
-- ============================================================
CREATE TABLE IF NOT EXISTS dispatches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  dispatch_number VARCHAR(50) NOT NULL,
  sales_order_id UUID REFERENCES sales_orders(id),
  invoice_id UUID REFERENCES invoices(id),
  customer_id UUID REFERENCES customers(id),
  distributor_id UUID REFERENCES distributors(id),
  warehouse_id UUID REFERENCES warehouses(id),
  status dispatch_status DEFAULT 'draft',
  dispatch_date DATE NOT NULL DEFAULT CURRENT_DATE,
  expected_delivery_date DATE,
  vehicle_reg VARCHAR(50),
  driver_name VARCHAR(255),
  driver_phone VARCHAR(50),
  waybill_number VARCHAR(100),
  origin_address TEXT,
  destination_address TEXT,
  notes TEXT,
  dispatched_by UUID REFERENCES user_profiles(id),
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, dispatch_number)
);

CREATE TABLE IF NOT EXISTS dispatch_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dispatch_id UUID NOT NULL REFERENCES dispatches(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id),
  item_type VARCHAR(20) DEFAULT 'carton',
  carton_id UUID REFERENCES cartons(id),
  ream_id UUID REFERENCES reams(id),
  qr_code_id UUID REFERENCES qr_codes(id),
  serial_number VARCHAR(50),
  quantity INTEGER DEFAULT 1,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dispatches_status ON dispatches(status);

-- ============================================================
-- HR
-- ============================================================
CREATE TABLE IF NOT EXISTS employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id UUID REFERENCES user_profiles(id),
  employee_number VARCHAR(50) NOT NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(50),
  department VARCHAR(100),
  job_title VARCHAR(150),
  employment_type VARCHAR(50) DEFAULT 'permanent',
  status employment_status DEFAULT 'active',
  hire_date DATE,
  end_date DATE,
  salary DECIMAL(14,2),
  currency VARCHAR(10) DEFAULT 'KES',
  national_id VARCHAR(50),
  emergency_contact VARCHAR(255),
  emergency_phone VARCHAR(50),
  address TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, employee_number)
);

CREATE TABLE IF NOT EXISTS leave_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  leave_type VARCHAR(50) NOT NULL DEFAULT 'annual',
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  days INTEGER NOT NULL DEFAULT 1,
  reason TEXT,
  status leave_status DEFAULT 'pending',
  approved_by UUID REFERENCES user_profiles(id),
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS attendance_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  work_date DATE NOT NULL DEFAULT CURRENT_DATE,
  check_in TIMESTAMPTZ,
  check_out TIMESTAMPTZ,
  status VARCHAR(50) DEFAULT 'present',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(employee_id, work_date)
);

-- ============================================================
-- EXTRA PERMISSIONS
-- ============================================================
INSERT INTO permissions (name, slug, module, description) VALUES
  ('View Sales', 'sales.view', 'sales', 'View sales orders and customers'),
  ('Manage Sales', 'sales.manage', 'sales', 'Create and manage sales orders'),
  ('View Invoices', 'invoices.view', 'invoices', 'View invoices'),
  ('Manage Invoices', 'invoices.manage', 'invoices', 'Create and manage invoices'),
  ('View Dispatch', 'dispatch.view', 'dispatch', 'View dispatches'),
  ('Manage Dispatch', 'dispatch.manage', 'dispatch', 'Create and manage dispatches'),
  ('View HR', 'hr.view', 'hr', 'View employees and leave'),
  ('Manage HR', 'hr.manage', 'hr', 'Manage HR records'),
  ('Manage Printers', 'printers.manage', 'printing', 'Discover and manage printers')
ON CONFLICT (slug) DO NOTHING;

-- Grant new permissions to super admin
INSERT INTO role_permissions (role_id, permission_id)
SELECT 'e0000000-0000-4000-8000-000000000001', id FROM permissions
WHERE slug IN (
  'sales.view','sales.manage','invoices.view','invoices.manage',
  'dispatch.view','dispatch.manage','hr.view','hr.manage','printers.manage'
)
ON CONFLICT DO NOTHING;

-- Sales manager
INSERT INTO role_permissions (role_id, permission_id)
SELECT 'e0000000-0000-4000-8000-000000000010', id FROM permissions
WHERE slug IN (
  'dashboard.view','sales.view','sales.manage','invoices.view','invoices.manage',
  'dispatch.view','distributors.view','products.view','reports.view'
)
ON CONFLICT DO NOTHING;

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_order_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE dispatches ENABLE ROW LEVEL SECURITY;
ALTER TABLE dispatch_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY customers_all ON customers FOR ALL
  USING (company_id = public.user_company_id())
  WITH CHECK (company_id = public.user_company_id());

CREATE POLICY sales_orders_all ON sales_orders FOR ALL
  USING (company_id = public.user_company_id())
  WITH CHECK (company_id = public.user_company_id());

CREATE POLICY sales_order_lines_all ON sales_order_lines FOR ALL
  USING (order_id IN (SELECT id FROM sales_orders WHERE company_id = public.user_company_id()))
  WITH CHECK (order_id IN (SELECT id FROM sales_orders WHERE company_id = public.user_company_id()));

CREATE POLICY invoices_all ON invoices FOR ALL
  USING (company_id = public.user_company_id())
  WITH CHECK (company_id = public.user_company_id());

CREATE POLICY invoice_lines_all ON invoice_lines FOR ALL
  USING (invoice_id IN (SELECT id FROM invoices WHERE company_id = public.user_company_id()))
  WITH CHECK (invoice_id IN (SELECT id FROM invoices WHERE company_id = public.user_company_id()));

CREATE POLICY invoice_payments_all ON invoice_payments FOR ALL
  USING (company_id = public.user_company_id())
  WITH CHECK (company_id = public.user_company_id());

CREATE POLICY dispatches_all ON dispatches FOR ALL
  USING (company_id = public.user_company_id())
  WITH CHECK (company_id = public.user_company_id());

CREATE POLICY dispatch_items_all ON dispatch_items FOR ALL
  USING (dispatch_id IN (SELECT id FROM dispatches WHERE company_id = public.user_company_id()))
  WITH CHECK (dispatch_id IN (SELECT id FROM dispatches WHERE company_id = public.user_company_id()));

CREATE POLICY employees_all ON employees FOR ALL
  USING (company_id = public.user_company_id())
  WITH CHECK (company_id = public.user_company_id());

CREATE POLICY leave_requests_all ON leave_requests FOR ALL
  USING (company_id = public.user_company_id())
  WITH CHECK (company_id = public.user_company_id());

CREATE POLICY attendance_all ON attendance_records FOR ALL
  USING (company_id = public.user_company_id())
  WITH CHECK (company_id = public.user_company_id());

CREATE TRIGGER tr_customers_updated BEFORE UPDATE ON customers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tr_sales_orders_updated BEFORE UPDATE ON sales_orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tr_invoices_updated BEFORE UPDATE ON invoices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tr_dispatches_updated BEFORE UPDATE ON dispatches
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tr_employees_updated BEFORE UPDATE ON employees
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tr_leave_updated BEFORE UPDATE ON leave_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
