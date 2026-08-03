-- SecureTrack ERP v1.0 - Seed Data
-- SecureTrack ERP initial configuration

-- Company
INSERT INTO companies (id, name, code, legal_name, address, city, country, phone, email, website)
VALUES (
  'a0000000-0000-4000-8000-000000000001',
  'SecureTrack ERP',
  'HDG',
  'SecureTrack ERP Limited',
  'Industrial Area, Nairobi',
  'Nairobi',
  'Kenya',
  '+254-700-000000',
  'info@hopedesign.co.ke',
  'https://hopedesign.co.ke'
);

-- Factory
INSERT INTO factories (id, company_id, name, code, address, city, country)
VALUES (
  'b0000000-0000-4000-8000-000000000001',
  'a0000000-0000-4000-8000-000000000001',
  'SecureTrack ERP Main Factory',
  'FACT-001',
  'Industrial Area, Nairobi',
  'Nairobi',
  'Kenya'
);

-- Branch
INSERT INTO branches (id, company_id, name, code)
VALUES (
  'c0000000-0000-4000-8000-000000000001',
  'a0000000-0000-4000-8000-000000000001',
  'Head Office',
  'HQ'
);

-- Warehouse
INSERT INTO warehouses (id, company_id, factory_id, name, code, address, city, capacity_units)
VALUES (
  'd0000000-0000-4000-8000-000000000001',
  'a0000000-0000-4000-8000-000000000001',
  'b0000000-0000-4000-8000-000000000001',
  'Main Warehouse',
  'WH-001',
  'Industrial Area, Nairobi',
  'Nairobi',
  50000
);

INSERT INTO warehouse_racks (warehouse_id, name, code, aisle, level, capacity_units)
VALUES
  ('d0000000-0000-4000-8000-000000000001', 'Rack A1', 'A1', 'A', 1, 500),
  ('d0000000-0000-4000-8000-000000000001', 'Rack A2', 'A2', 'A', 2, 500),
  ('d0000000-0000-4000-8000-000000000001', 'Rack B1', 'B1', 'B', 1, 500);

-- Permissions
INSERT INTO permissions (name, slug, module, description) VALUES
  ('View Dashboard', 'dashboard.view', 'dashboard', 'View main dashboard'),
  ('Manage Settings', 'settings.manage', 'settings', 'Manage system settings'),
  ('View Users', 'users.view', 'users', 'View user list'),
  ('Manage Users', 'users.manage', 'users', 'Create, edit, delete users'),
  ('View Production', 'production.view', 'production', 'View production batches'),
  ('Create Production', 'production.create', 'production', 'Create production batches'),
  ('Edit Production', 'production.edit', 'production', 'Edit production batches'),
  ('Manage Production', 'production.manage', 'production', 'Full production management'),
  ('Approve Quality', 'quality.approve', 'quality', 'Approve/reject QC'),
  ('Generate QR', 'qr.generate', 'qr', 'Generate QR codes'),
  ('View QR', 'qr.view', 'qr', 'View QR codes'),
  ('Create Print Jobs', 'printing.create', 'printing', 'Create print jobs'),
  ('Manage Printing', 'printing.manage', 'printing', 'Manage print jobs and printers'),
  ('Reprint Labels', 'printing.reprint', 'printing', 'Authorize reprints'),
  ('Pack Cartons', 'packing.create', 'packing', 'Pack reams into cartons'),
  ('View Inventory', 'inventory.view', 'inventory', 'View inventory'),
  ('Move Inventory', 'inventory.move', 'inventory', 'Move inventory items'),
  ('Manage Inventory', 'inventory.manage', 'inventory', 'Full inventory management'),
  ('View Verification', 'verification.view', 'verification', 'View verification logs'),
  ('Manage Fraud', 'fraud.manage', 'fraud', 'Manage fraud alerts'),
  ('Investigate Fraud', 'fraud.investigate', 'fraud', 'Investigate fraud cases'),
  ('View Reports', 'reports.view', 'reports', 'View reports'),
  ('Export Reports', 'reports.export', 'reports', 'Export reports'),
  ('View Audit Logs', 'audit.view', 'audit', 'View audit logs'),
  ('Manage Audit', 'audit.manage', 'audit', 'Full audit access'),
  ('View Distributors', 'distributors.view', 'distributors', 'View distributors'),
  ('Manage Distributors', 'distributors.manage', 'distributors', 'Manage distributors'),
  ('View Products', 'products.view', 'products', 'View products'),
  ('Manage Products', 'products.manage', 'products', 'Manage products');

-- System Roles
INSERT INTO roles (id, company_id, name, slug, description, is_system) VALUES
  ('e0000000-0000-4000-8000-000000000001', NULL, 'Super Administrator', 'super_administrator', 'Full system access', true),
  ('e0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000001', 'Managing Director', 'managing_director', 'Executive oversight', true),
  ('e0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000001', 'Operations Manager', 'operations_manager', 'Operations management', true),
  ('e0000000-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-000000000001', 'Production Manager', 'production_manager', 'Production management', true),
  ('e0000000-0000-4000-8000-000000000005', 'a0000000-0000-4000-8000-000000000001', 'Production Supervisor', 'production_supervisor', 'Production supervision', true),
  ('e0000000-0000-4000-8000-000000000006', 'a0000000-0000-4000-8000-000000000001', 'Production Operator', 'production_operator', 'Production operations', true),
  ('e0000000-0000-4000-8000-000000000007', 'a0000000-0000-4000-8000-000000000001', 'Quality Assurance', 'quality_assurance', 'Quality control', true),
  ('e0000000-0000-4000-8000-000000000008', 'a0000000-0000-4000-8000-000000000001', 'Warehouse Manager', 'warehouse_manager', 'Warehouse management', true),
  ('e0000000-0000-4000-8000-000000000009', 'a0000000-0000-4000-8000-000000000001', 'Warehouse Clerk', 'warehouse_clerk', 'Warehouse operations', true),
  ('e0000000-0000-4000-8000-000000000010', 'a0000000-0000-4000-8000-000000000001', 'Sales Manager', 'sales_manager', 'Sales management', true),
  ('e0000000-0000-4000-8000-000000000011', 'a0000000-0000-4000-8000-000000000001', 'Sales Executive', 'sales_executive', 'Sales operations', true),
  ('e0000000-0000-4000-8000-000000000012', 'a0000000-0000-4000-8000-000000000001', 'Distributor', 'distributor', 'Distributor access', true),
  ('e0000000-0000-4000-8000-000000000013', 'a0000000-0000-4000-8000-000000000001', 'Retailer', 'retailer', 'Retailer access', true),
  ('e0000000-0000-4000-8000-000000000014', 'a0000000-0000-4000-8000-000000000001', 'Customer Service', 'customer_service', 'Customer support', true),
  ('e0000000-0000-4000-8000-000000000015', 'a0000000-0000-4000-8000-000000000001', 'Auditor', 'auditor', 'Audit access', true),
  ('e0000000-0000-4000-8000-000000000016', 'a0000000-0000-4000-8000-000000000001', 'Read-only User', 'read_only', 'Read-only access', true);

-- Assign permissions to Super Administrator (all)
INSERT INTO role_permissions (role_id, permission_id)
SELECT 'e0000000-0000-4000-8000-000000000001', id FROM permissions;

-- Production Manager permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT 'e0000000-0000-4000-8000-000000000004', id FROM permissions
WHERE slug IN (
  'dashboard.view', 'production.view', 'production.create', 'production.edit',
  'production.manage', 'quality.approve', 'qr.generate', 'qr.view',
  'printing.create', 'printing.manage', 'printing.reprint', 'packing.create',
  'inventory.view', 'reports.view', 'reports.export', 'products.view'
);

-- Production Operator permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT 'e0000000-0000-4000-8000-000000000006', id FROM permissions
WHERE slug IN (
  'dashboard.view', 'production.view', 'qr.view', 'printing.create',
  'packing.create', 'products.view'
);

-- Warehouse Manager permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT 'e0000000-0000-4000-8000-000000000008', id FROM permissions
WHERE slug IN (
  'dashboard.view', 'inventory.view', 'inventory.move', 'inventory.manage',
  'reports.view', 'reports.export', 'distributors.view'
);

-- Auditor permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT 'e0000000-0000-4000-8000-000000000015', id FROM permissions
WHERE slug IN (
  'dashboard.view', 'production.view', 'inventory.view', 'verification.view',
  'audit.view', 'audit.manage', 'reports.view', 'reports.export', 'fraud.manage'
);

-- Read-only permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT 'e0000000-0000-4000-8000-000000000016', id FROM permissions
WHERE slug IN (
  'dashboard.view', 'production.view', 'inventory.view', 'verification.view',
  'reports.view', 'products.view', 'distributors.view'
);

-- Product Categories
INSERT INTO product_categories (company_id, name, code, description) VALUES
  ('a0000000-0000-4000-8000-000000000001', 'Bond Paper', 'BOND', 'Standard bond/copy paper'),
  ('a0000000-0000-4000-8000-000000000001', 'Security Paper', 'SEC', 'Security printing paper'),
  ('a0000000-0000-4000-8000-000000000001', 'Packaging Paper', 'PKG', 'Packaging materials'),
  ('a0000000-0000-4000-8000-000000000001', 'Specialty Paper', 'SPEC', 'Specialty paper products');

-- Sample Products
INSERT INTO products (company_id, category_id, name, product_code, paper_size, gsm, color, reams_per_carton) VALUES
  ('a0000000-0000-4000-8000-000000000001',
   (SELECT id FROM product_categories WHERE code = 'BOND'),
   'SecureTrack Bond A4 80gsm White', 'HD-BOND-A4-80-W', 'A4', 80, 'White', 5),
  ('a0000000-0000-4000-8000-000000000001',
   (SELECT id FROM product_categories WHERE code = 'BOND'),
   'SecureTrack Bond A4 75gsm White', 'HD-BOND-A4-75-W', 'A4', 75, 'White', 5),
  ('a0000000-0000-4000-8000-000000000001',
   (SELECT id FROM product_categories WHERE code = 'BOND'),
   'SecureTrack Bond A3 80gsm White', 'HD-BOND-A3-80-W', 'A3', 80, 'White', 5),
  ('a0000000-0000-4000-8000-000000000001',
   (SELECT id FROM product_categories WHERE code = 'SEC'),
   'SecureTrack Security A4 100gsm', 'HD-SEC-A4-100', 'A4', 100, 'Cream', 5);

-- Production Machines
INSERT INTO production_machines (factory_id, name, code, machine_type, production_line, max_capacity_per_hour) VALUES
  ('b0000000-0000-4000-8000-000000000001', 'Slitter Line 1', 'SL-001', 'Slitter', 'Line A', 500),
  ('b0000000-0000-4000-8000-000000000001', 'Slitter Line 2', 'SL-002', 'Slitter', 'Line B', 500),
  ('b0000000-0000-4000-8000-000000000001', 'Rewinder 1', 'RW-001', 'Rewinder', 'Line A', 300);

-- System Settings (value is JSONB)
INSERT INTO system_settings (company_id, key, value, description) VALUES
  ('a0000000-0000-4000-8000-000000000001', 'qr.version', '"1"', 'QR payload version'),
  ('a0000000-0000-4000-8000-000000000001', 'carton.reams_per_carton', '5', 'Reams per carton'),
  ('a0000000-0000-4000-8000-000000000001', 'verification.rate_limit', '60', 'Max verifications per hour per IP'),
  ('a0000000-0000-4000-8000-000000000001', 'fraud.duplicate_scan_threshold', '10', 'Duplicate scan alert threshold'),
  ('a0000000-0000-4000-8000-000000000001', 'fraud.geo_movement_km', '500', 'Impossible geo movement threshold in km'),
  ('a0000000-0000-4000-8000-000000000001', 'printing.max_retries', '3', 'Max print retry attempts'),
  ('a0000000-0000-4000-8000-000000000001', 'serial.ream_prefix', '"RM"', 'Ream serial prefix'),
  ('a0000000-0000-4000-8000-000000000001', 'serial.carton_prefix', '"CT"', 'Carton serial prefix');
