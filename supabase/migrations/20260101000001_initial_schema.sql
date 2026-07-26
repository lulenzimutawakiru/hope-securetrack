-- Hope SecureTrack v1.0 - Core Schema
-- Multi-tenant enterprise manufacturing traceability platform

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ============================================================
-- ENUMS
-- ============================================================

CREATE TYPE production_status AS ENUM (
  'draft', 'in_progress', 'qc_pending', 'approved', 'rejected',
  'packed', 'completed', 'archived'
);

CREATE TYPE qc_status AS ENUM (
  'pending', 'passed', 'failed', 'on_hold'
);

CREATE TYPE qr_code_type AS ENUM (
  'ream', 'carton', 'pallet', 'batch'
);

CREATE TYPE qr_code_status AS ENUM (
  'generated', 'printed', 'verified', 'packed', 'dispatched',
  'sold', 'recalled', 'voided', 'counterfeit'
);

CREATE TYPE print_job_status AS ENUM (
  'pending', 'queued', 'printing', 'paused', 'completed',
  'failed', 'cancelled'
);

CREATE TYPE inventory_status AS ENUM (
  'in_production', 'in_warehouse', 'in_transit', 'at_distributor',
  'at_retailer', 'sold', 'returned', 'recalled', 'destroyed'
);

CREATE TYPE verification_result AS ENUM (
  'genuine', 'invalid', 'counterfeit', 'recalled', 'duplicate', 'suspicious'
);

CREATE TYPE fraud_alert_severity AS ENUM (
  'low', 'medium', 'high', 'critical'
);

CREATE TYPE fraud_alert_status AS ENUM (
  'open', 'investigating', 'confirmed', 'dismissed', 'resolved'
);

CREATE TYPE notification_type AS ENUM (
  'info', 'warning', 'error', 'success', 'fraud_alert'
);

CREATE TYPE shift_type AS ENUM (
  'morning', 'afternoon', 'night'
);

-- ============================================================
-- CORE TENANT TABLES
-- ============================================================

CREATE TABLE companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  code VARCHAR(50) NOT NULL UNIQUE,
  legal_name VARCHAR(255),
  tax_id VARCHAR(100),
  address TEXT,
  city VARCHAR(100),
  country VARCHAR(100) DEFAULT 'Kenya',
  phone VARCHAR(50),
  email VARCHAR(255),
  logo_url TEXT,
  website VARCHAR(255),
  settings JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE factories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  code VARCHAR(50) NOT NULL,
  address TEXT,
  city VARCHAR(100),
  country VARCHAR(100),
  timezone VARCHAR(50) DEFAULT 'Africa/Nairobi',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, code)
);

CREATE TABLE branches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  code VARCHAR(50) NOT NULL,
  address TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, code)
);

CREATE TABLE departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES branches(id),
  name VARCHAR(255) NOT NULL,
  code VARCHAR(50) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, code)
);

CREATE TABLE warehouses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  factory_id UUID REFERENCES factories(id),
  name VARCHAR(255) NOT NULL,
  code VARCHAR(50) NOT NULL,
  address TEXT,
  city VARCHAR(100),
  capacity_units INTEGER,
  manager_id UUID,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, code)
);

CREATE TABLE warehouse_racks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  code VARCHAR(50) NOT NULL,
  aisle VARCHAR(20),
  level INTEGER DEFAULT 1,
  capacity_units INTEGER,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(warehouse_id, code)
);

-- ============================================================
-- RBAC
-- ============================================================

CREATE TABLE roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(100) NOT NULL,
  description TEXT,
  is_system BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, slug)
);

CREATE TABLE permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL UNIQUE,
  slug VARCHAR(100) NOT NULL UNIQUE,
  module VARCHAR(50) NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE role_permissions (
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id),
  factory_id UUID REFERENCES factories(id),
  warehouse_id UUID REFERENCES warehouses(id),
  branch_id UUID REFERENCES branches(id),
  department_id UUID REFERENCES departments(id),
  role_id UUID NOT NULL REFERENCES roles(id),
  employee_id VARCHAR(50),
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(50),
  avatar_url TEXT,
  is_active BOOLEAN DEFAULT true,
  last_login_at TIMESTAMPTZ,
  last_login_ip INET,
  mfa_enabled BOOLEAN DEFAULT false,
  preferences JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- PRODUCTS
-- ============================================================

CREATE TABLE product_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  code VARCHAR(50) NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, code)
);

CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  category_id UUID REFERENCES product_categories(id),
  name VARCHAR(255) NOT NULL,
  product_code VARCHAR(100) NOT NULL,
  description TEXT,
  paper_size VARCHAR(50),
  gsm INTEGER,
  color VARCHAR(100),
  reams_per_carton INTEGER DEFAULT 5,
  unit_weight_kg DECIMAL(10,3),
  barcode VARCHAR(100),
  image_url TEXT,
  specifications JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, product_code)
);

CREATE TABLE production_machines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  factory_id UUID NOT NULL REFERENCES factories(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  code VARCHAR(50) NOT NULL,
  machine_type VARCHAR(100),
  production_line VARCHAR(100),
  max_capacity_per_hour INTEGER,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(factory_id, code)
);

-- ============================================================
-- PRODUCTION
-- ============================================================

CREATE TABLE production_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  factory_id UUID NOT NULL REFERENCES factories(id),
  product_id UUID NOT NULL REFERENCES products(id),
  batch_number VARCHAR(100) NOT NULL,
  product_code VARCHAR(100) NOT NULL,
  product_category VARCHAR(100),
  paper_size VARCHAR(50),
  gsm INTEGER,
  color VARCHAR(100),
  machine_id UUID REFERENCES production_machines(id),
  production_line VARCHAR(100),
  shift shift_type,
  operator_id UUID REFERENCES user_profiles(id),
  supervisor_id UUID REFERENCES user_profiles(id),
  quantity_reams INTEGER NOT NULL DEFAULT 0,
  quantity_cartons INTEGER GENERATED ALWAYS AS (quantity_reams / 5) STORED,
  manufacturing_date DATE NOT NULL DEFAULT CURRENT_DATE,
  qc_status qc_status DEFAULT 'pending',
  production_status production_status DEFAULT 'draft',
  notes TEXT,
  metadata JSONB DEFAULT '{}',
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, batch_number)
);

CREATE INDEX idx_batches_status ON production_batches(production_status);
CREATE INDEX idx_batches_date ON production_batches(manufacturing_date);
CREATE INDEX idx_batches_product ON production_batches(product_id);

-- ============================================================
-- QR CODES & TRACEABILITY
-- ============================================================

CREATE TABLE qr_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  public_uuid UUID NOT NULL UNIQUE,
  code_type qr_code_type NOT NULL,
  status qr_code_status DEFAULT 'generated',
  encrypted_token TEXT NOT NULL,
  signature TEXT NOT NULL,
  checksum VARCHAR(64) NOT NULL,
  human_serial VARCHAR(50) NOT NULL,
  batch_id UUID REFERENCES production_batches(id),
  product_id UUID REFERENCES products(id),
  ream_id UUID,
  carton_id UUID,
  payload_version INTEGER DEFAULT 1,
  payload JSONB NOT NULL,
  print_count INTEGER DEFAULT 0,
  last_printed_at TIMESTAMPTZ,
  last_printed_by UUID REFERENCES user_profiles(id),
  last_printer_id UUID,
  verification_count INTEGER DEFAULT 0,
  first_verified_at TIMESTAMPTZ,
  last_verified_at TIMESTAMPTZ,
  is_recalled BOOLEAN DEFAULT false,
  recall_reason TEXT,
  recalled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_qr_public_uuid ON qr_codes(public_uuid);
CREATE INDEX idx_qr_human_serial ON qr_codes(human_serial);
CREATE INDEX idx_qr_batch ON qr_codes(batch_id);
CREATE INDEX idx_qr_status ON qr_codes(status);
CREATE INDEX idx_qr_type ON qr_codes(code_type);

CREATE TABLE reams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  batch_id UUID NOT NULL REFERENCES production_batches(id),
  product_id UUID NOT NULL REFERENCES products(id),
  qr_code_id UUID UNIQUE REFERENCES qr_codes(id),
  serial_number VARCHAR(50) NOT NULL,
  paper_size VARCHAR(50),
  gsm INTEGER,
  color VARCHAR(100),
  carton_id UUID,
  inventory_status inventory_status DEFAULT 'in_production',
  is_defective BOOLEAN DEFAULT false,
  defect_reason TEXT,
  warehouse_id UUID REFERENCES warehouses(id),
  rack_id UUID REFERENCES warehouse_racks(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, serial_number)
);

ALTER TABLE qr_codes ADD CONSTRAINT fk_qr_ream
  FOREIGN KEY (ream_id) REFERENCES reams(id);

CREATE TABLE cartons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  batch_id UUID NOT NULL REFERENCES production_batches(id),
  product_id UUID NOT NULL REFERENCES products(id),
  qr_code_id UUID UNIQUE REFERENCES qr_codes(id),
  serial_number VARCHAR(50) NOT NULL,
  paper_size VARCHAR(50),
  gsm INTEGER,
  ream_count INTEGER DEFAULT 5,
  packed_by UUID REFERENCES user_profiles(id),
  packed_at TIMESTAMPTZ,
  packing_date DATE,
  inventory_status inventory_status DEFAULT 'in_production',
  warehouse_id UUID REFERENCES warehouses(id),
  rack_id UUID REFERENCES warehouse_racks(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, serial_number)
);

ALTER TABLE qr_codes ADD CONSTRAINT fk_qr_carton
  FOREIGN KEY (carton_id) REFERENCES cartons(id);

ALTER TABLE reams ADD CONSTRAINT fk_ream_carton
  FOREIGN KEY (carton_id) REFERENCES cartons(id);

-- ============================================================
-- PRINTING
-- ============================================================

CREATE TABLE printers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  factory_id UUID REFERENCES factories(id),
  name VARCHAR(255) NOT NULL,
  model VARCHAR(100) NOT NULL,
  serial_number VARCHAR(100),
  agent_id VARCHAR(100),
  connection_type VARCHAR(50) DEFAULT 'bluetooth',
  status VARCHAR(50) DEFAULT 'offline',
  last_seen_at TIMESTAMPTZ,
  settings JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE qr_codes ADD CONSTRAINT fk_qr_printer
  FOREIGN KEY (last_printer_id) REFERENCES printers(id);

CREATE TABLE print_agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  factory_id UUID REFERENCES factories(id),
  name VARCHAR(255) NOT NULL,
  agent_key_hash VARCHAR(255) NOT NULL,
  machine_id VARCHAR(255),
  os_version VARCHAR(100),
  agent_version VARCHAR(50),
  status VARCHAR(50) DEFAULT 'offline',
  last_heartbeat_at TIMESTAMPTZ,
  ip_address INET,
  settings JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE print_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  batch_id UUID REFERENCES production_batches(id),
  agent_id UUID REFERENCES print_agents(id),
  printer_id UUID REFERENCES printers(id),
  job_type VARCHAR(50) NOT NULL DEFAULT 'batch',
  status print_job_status DEFAULT 'pending',
  label_type qr_code_type NOT NULL DEFAULT 'ream',
  total_labels INTEGER NOT NULL DEFAULT 0,
  printed_labels INTEGER DEFAULT 0,
  failed_labels INTEGER DEFAULT 0,
  start_serial VARCHAR(50),
  end_serial VARCHAR(50),
  reprint_authorized_by UUID REFERENCES user_profiles(id),
  is_reprint BOOLEAN DEFAULT false,
  priority INTEGER DEFAULT 5,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  error_message TEXT,
  metadata JSONB DEFAULT '{}',
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_print_jobs_status ON print_jobs(status);
CREATE INDEX idx_print_jobs_batch ON print_jobs(batch_id);

CREATE TABLE print_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  print_job_id UUID REFERENCES print_jobs(id),
  qr_code_id UUID REFERENCES qr_codes(id),
  printer_id UUID REFERENCES printers(id),
  agent_id UUID REFERENCES print_agents(id),
  operator_id UUID REFERENCES user_profiles(id),
  status VARCHAR(50) NOT NULL,
  attempt_number INTEGER DEFAULT 1,
  error_message TEXT,
  printed_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'
);

CREATE INDEX idx_print_logs_job ON print_logs(print_job_id);
CREATE INDEX idx_print_logs_qr ON print_logs(qr_code_id);

-- ============================================================
-- DISTRIBUTION
-- ============================================================

CREATE TABLE distributors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  code VARCHAR(50) NOT NULL,
  contact_person VARCHAR(255),
  email VARCHAR(255),
  phone VARCHAR(50),
  address TEXT,
  city VARCHAR(100),
  country VARCHAR(100),
  region VARCHAR(100),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, code)
);

CREATE TABLE retailers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  distributor_id UUID REFERENCES distributors(id),
  name VARCHAR(255) NOT NULL,
  code VARCHAR(50) NOT NULL,
  contact_person VARCHAR(255),
  email VARCHAR(255),
  phone VARCHAR(50),
  address TEXT,
  city VARCHAR(100),
  country VARCHAR(100),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, code)
);

-- ============================================================
-- INVENTORY
-- ============================================================

CREATE TABLE inventory_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  movement_type VARCHAR(50) NOT NULL,
  item_type VARCHAR(20) NOT NULL,
  ream_id UUID REFERENCES reams(id),
  carton_id UUID REFERENCES cartons(id),
  from_warehouse_id UUID REFERENCES warehouses(id),
  to_warehouse_id UUID REFERENCES warehouses(id),
  from_rack_id UUID REFERENCES warehouse_racks(id),
  to_rack_id UUID REFERENCES warehouse_racks(id),
  distributor_id UUID REFERENCES distributors(id),
  retailer_id UUID REFERENCES retailers(id),
  quantity INTEGER DEFAULT 1,
  reference_number VARCHAR(100),
  notes TEXT,
  performed_by UUID REFERENCES user_profiles(id),
  performed_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'
);

CREATE INDEX idx_inventory_movements_date ON inventory_movements(performed_at);
CREATE INDEX idx_inventory_movements_type ON inventory_movements(movement_type);

-- ============================================================
-- VERIFICATION & FRAUD
-- ============================================================

CREATE TABLE verification_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  qr_code_id UUID REFERENCES qr_codes(id),
  public_uuid UUID,
  result verification_result NOT NULL,
  ip_address INET,
  user_agent TEXT,
  device_fingerprint VARCHAR(255),
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  city VARCHAR(100),
  country VARCHAR(100),
  scan_source VARCHAR(50) DEFAULT 'web',
  is_first_scan BOOLEAN DEFAULT false,
  response_data JSONB DEFAULT '{}',
  verified_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_verification_logs_qr ON verification_logs(qr_code_id);
CREATE INDEX idx_verification_logs_date ON verification_logs(verified_at);
CREATE INDEX idx_verification_logs_result ON verification_logs(result);

CREATE TABLE counterfeit_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  qr_code_id UUID REFERENCES qr_codes(id),
  public_uuid UUID,
  reporter_name VARCHAR(255),
  reporter_email VARCHAR(255),
  reporter_phone VARCHAR(50),
  description TEXT NOT NULL,
  purchase_location TEXT,
  purchase_date DATE,
  evidence_urls TEXT[],
  status VARCHAR(50) DEFAULT 'pending',
  assigned_to UUID REFERENCES user_profiles(id),
  resolution_notes TEXT,
  resolved_at TIMESTAMPTZ,
  ip_address INET,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE fraud_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  qr_code_id UUID REFERENCES qr_codes(id),
  alert_type VARCHAR(100) NOT NULL,
  severity fraud_alert_severity NOT NULL DEFAULT 'medium',
  status fraud_alert_status DEFAULT 'open',
  title VARCHAR(255) NOT NULL,
  description TEXT,
  evidence JSONB DEFAULT '{}',
  assigned_to UUID REFERENCES user_profiles(id),
  resolved_by UUID REFERENCES user_profiles(id),
  resolved_at TIMESTAMPTZ,
  resolution_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_fraud_alerts_status ON fraud_alerts(status);
CREATE INDEX idx_fraud_alerts_severity ON fraud_alerts(severity);

-- ============================================================
-- AUDIT & NOTIFICATIONS
-- ============================================================

CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id UUID REFERENCES user_profiles(id),
  user_email VARCHAR(255),
  user_role VARCHAR(100),
  action VARCHAR(100) NOT NULL,
  module VARCHAR(50) NOT NULL,
  entity_type VARCHAR(50),
  entity_id UUID,
  entity_reference VARCHAR(255),
  before_state JSONB,
  after_state JSONB,
  ip_address INET,
  user_agent TEXT,
  device_info JSONB,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_date ON audit_logs(created_at);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);

CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES user_profiles(id),
  type notification_type DEFAULT 'info',
  title VARCHAR(255) NOT NULL,
  message TEXT,
  link VARCHAR(500),
  is_read BOOLEAN DEFAULT false,
  read_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notifications_user ON notifications(user_id, is_read);

CREATE TABLE system_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  key VARCHAR(100) NOT NULL,
  value JSONB NOT NULL,
  description TEXT,
  updated_by UUID REFERENCES user_profiles(id),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, key)
);

-- ============================================================
-- TRIGGERS
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_companies_updated BEFORE UPDATE ON companies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tr_factories_updated BEFORE UPDATE ON factories
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tr_products_updated BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tr_batches_updated BEFORE UPDATE ON production_batches
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tr_qr_codes_updated BEFORE UPDATE ON qr_codes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tr_reams_updated BEFORE UPDATE ON reams
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tr_cartons_updated BEFORE UPDATE ON cartons
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tr_print_jobs_updated BEFORE UPDATE ON print_jobs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tr_user_profiles_updated BEFORE UPDATE ON user_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Prevent audit log modification
CREATE OR REPLACE FUNCTION prevent_audit_modification()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Audit logs are immutable and cannot be modified or deleted';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_audit_immutable
  BEFORE UPDATE OR DELETE ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION prevent_audit_modification();

-- Auto-increment verification count
CREATE OR REPLACE FUNCTION increment_verification_count()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.qr_code_id IS NOT NULL THEN
    UPDATE qr_codes SET
      verification_count = verification_count + 1,
      first_verified_at = COALESCE(first_verified_at, NEW.verified_at),
      last_verified_at = NEW.verified_at,
      status = CASE WHEN status = 'printed' THEN 'verified'::qr_code_status ELSE status END
    WHERE id = NEW.qr_code_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_verification_count
  AFTER INSERT ON verification_logs
  FOR EACH ROW EXECUTE FUNCTION increment_verification_count();

-- Audit log helper function
CREATE OR REPLACE FUNCTION create_audit_log(
  p_company_id UUID,
  p_user_id UUID,
  p_action VARCHAR,
  p_module VARCHAR,
  p_entity_type VARCHAR DEFAULT NULL,
  p_entity_id UUID DEFAULT NULL,
  p_entity_reference VARCHAR DEFAULT NULL,
  p_before_state JSONB DEFAULT NULL,
  p_after_state JSONB DEFAULT NULL,
  p_ip_address INET DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_user_email VARCHAR;
  v_user_role VARCHAR;
  v_log_id UUID;
BEGIN
  SELECT email, r.name INTO v_user_email, v_user_role
  FROM user_profiles up
  JOIN roles r ON r.id = up.role_id
  WHERE up.id = p_user_id;

  INSERT INTO audit_logs (
    company_id, user_id, user_email, user_role, action, module,
    entity_type, entity_id, entity_reference, before_state, after_state,
    ip_address, user_agent
  ) VALUES (
    p_company_id, p_user_id, v_user_email, v_user_role, p_action, p_module,
    p_entity_type, p_entity_id, p_entity_reference, p_before_state, p_after_state,
    p_ip_address, p_user_agent
  ) RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
