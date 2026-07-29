-- Hope SecureTrack ERP — Enterprise Fleet & Transport Management Platform
-- FMS · TMS · GPS · Drivers · Fuel · Maintenance · POD · AI · Compliance

-- Extend vehicle_status enum for full lifecycle
DO $$ BEGIN ALTER TYPE vehicle_status ADD VALUE IF NOT EXISTS 'assigned'; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE vehicle_status ADD VALUE IF NOT EXISTS 'disposed'; EXCEPTION WHEN others THEN NULL; END $$;

-- ============================================================
-- EXTEND EXISTING fleet_vehicles
-- ============================================================
ALTER TABLE fleet_vehicles
  ADD COLUMN IF NOT EXISTS asset_tag VARCHAR(80),
  ADD COLUMN IF NOT EXISTS vehicle_code VARCHAR(50),
  ADD COLUMN IF NOT EXISTS qr_payload TEXT,
  ADD COLUMN IF NOT EXISTS barcode_value VARCHAR(100),
  ADD COLUMN IF NOT EXISTS chassis_number VARCHAR(80),
  ADD COLUMN IF NOT EXISTS engine_number VARCHAR(80),
  ADD COLUMN IF NOT EXISTS brand_name VARCHAR(100),
  ADD COLUMN IF NOT EXISTS model_name VARCHAR(100),
  ADD COLUMN IF NOT EXISTS color VARCHAR(50),
  ADD COLUMN IF NOT EXISTS transmission VARCHAR(40),
  ADD COLUMN IF NOT EXISTS engine_size_cc INTEGER,
  ADD COLUMN IF NOT EXISTS seat_capacity INTEGER,
  ADD COLUMN IF NOT EXISTS ownership_type VARCHAR(40) DEFAULT 'owned',
  ADD COLUMN IF NOT EXISTS purchase_date DATE,
  ADD COLUMN IF NOT EXISTS purchase_cost DECIMAL(18,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS current_value DECIMAL(18,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS branch_id UUID,
  ADD COLUMN IF NOT EXISTS branch_name VARCHAR(150),
  ADD COLUMN IF NOT EXISTS depot_name VARCHAR(150),
  ADD COLUMN IF NOT EXISTS department_name VARCHAR(150),
  ADD COLUMN IF NOT EXISTS project_name VARCHAR(150),
  ADD COLUMN IF NOT EXISTS category_name VARCHAR(100),
  ADD COLUMN IF NOT EXISTS photo_url TEXT,
  ADD COLUMN IF NOT EXISTS logo_url TEXT,
  ADD COLUMN IF NOT EXISTS lifecycle_stage VARCHAR(40) DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS currency_code VARCHAR(10) DEFAULT 'UGX',
  ADD COLUMN IF NOT EXISTS version_no INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES user_profiles(id),
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES user_profiles(id),
  ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES user_profiles(id),
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE fleet_fuel_logs
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS fuel_card_number VARCHAR(60),
  ADD COLUMN IF NOT EXISTS request_id UUID,
  ADD COLUMN IF NOT EXISTS driver_name VARCHAR(150),
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE fleet_fuel_logs ALTER COLUMN vehicle_id DROP NOT NULL;

ALTER TABLE fleet_maintenance
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS work_order_number VARCHAR(50),
  ADD COLUMN IF NOT EXISTS status VARCHAR(30) DEFAULT 'completed',
  ADD COLUMN IF NOT EXISTS mechanic_name VARCHAR(150),
  ADD COLUMN IF NOT EXISTS workshop_name VARCHAR(150),
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE fleet_maintenance ALTER COLUMN vehicle_id DROP NOT NULL;

-- ============================================================
-- MASTER DATA
-- ============================================================
CREATE TABLE IF NOT EXISTS fleet_vehicle_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  code VARCHAR(50) NOT NULL,
  name VARCHAR(150) NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES user_profiles(id),
  updated_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, code)
);

CREATE TABLE IF NOT EXISTS fleet_vehicle_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  code VARCHAR(50) NOT NULL,
  name VARCHAR(150) NOT NULL,
  description TEXT,
  default_fuel_type VARCHAR(40) DEFAULT 'diesel',
  is_active BOOLEAN DEFAULT true,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, code)
);

CREATE TABLE IF NOT EXISTS fleet_vehicle_brands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  code VARCHAR(50) NOT NULL,
  name VARCHAR(150) NOT NULL,
  country VARCHAR(80),
  is_active BOOLEAN DEFAULT true,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, code)
);

CREATE TABLE IF NOT EXISTS fleet_vehicle_models (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  brand_id UUID REFERENCES fleet_vehicle_brands(id) ON DELETE SET NULL,
  brand_name VARCHAR(100),
  code VARCHAR(50) NOT NULL,
  name VARCHAR(150) NOT NULL,
  year_from INTEGER,
  year_to INTEGER,
  fuel_type VARCHAR(40) DEFAULT 'diesel',
  is_active BOOLEAN DEFAULT true,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, code)
);

CREATE TABLE IF NOT EXISTS fleet_vehicle_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  vehicle_id UUID REFERENCES fleet_vehicles(id) ON DELETE CASCADE,
  registration VARCHAR(50),
  doc_type VARCHAR(60) NOT NULL,
  -- insurance | road_license | inspection | warranty | contract | manual | other
  doc_number VARCHAR(100),
  title VARCHAR(255) NOT NULL,
  file_url TEXT,
  issued_date DATE,
  expiry_date DATE,
  status VARCHAR(30) DEFAULT 'valid',
  notes TEXT,
  version_no INTEGER DEFAULT 1,
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS fleet_vehicle_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  vehicle_id UUID REFERENCES fleet_vehicles(id) ON DELETE CASCADE,
  registration VARCHAR(50),
  title VARCHAR(200),
  photo_url TEXT NOT NULL,
  photo_type VARCHAR(40) DEFAULT 'exterior',
  is_primary BOOLEAN DEFAULT false,
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS fleet_vehicle_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  assignment_number VARCHAR(50) NOT NULL,
  vehicle_id UUID REFERENCES fleet_vehicles(id) ON DELETE SET NULL,
  registration VARCHAR(50),
  assignment_type VARCHAR(40) DEFAULT 'employee',
  -- employee | department | project | driver | branch | production
  assignee_name VARCHAR(200),
  employee_id UUID,
  department_name VARCHAR(150),
  project_name VARCHAR(150),
  branch_name VARCHAR(150),
  start_date DATE DEFAULT CURRENT_DATE,
  end_date DATE,
  status VARCHAR(30) DEFAULT 'active',
  notes TEXT,
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES user_profiles(id),
  updated_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, assignment_number)
);

-- ============================================================
-- DRIVERS
-- ============================================================
CREATE TABLE IF NOT EXISTS fleet_drivers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  driver_code VARCHAR(50) NOT NULL,
  full_name VARCHAR(200) NOT NULL,
  employee_id UUID,
  user_id UUID REFERENCES user_profiles(id),
  phone VARCHAR(50),
  email VARCHAR(150),
  emergency_contact VARCHAR(200),
  emergency_phone VARCHAR(50),
  license_number VARCHAR(80),
  license_class VARCHAR(40),
  license_expiry DATE,
  medical_status VARCHAR(40) DEFAULT 'fit',
  medical_expiry DATE,
  performance_score DECIMAL(5,2) DEFAULT 80,
  safety_score DECIMAL(5,2) DEFAULT 100,
  violation_count INTEGER DEFAULT 0,
  accident_count INTEGER DEFAULT 0,
  assigned_vehicle_id UUID REFERENCES fleet_vehicles(id) ON DELETE SET NULL,
  assigned_registration VARCHAR(50),
  branch_name VARCHAR(150),
  depot_name VARCHAR(150),
  status VARCHAR(30) DEFAULT 'available',
  -- available | on_trip | off_duty | leave | suspended | terminated
  leave_status VARCHAR(40) DEFAULT 'on_duty',
  photo_url TEXT,
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  version_no INTEGER DEFAULT 1,
  deleted_at TIMESTAMPTZ,
  archived_at TIMESTAMPTZ,
  created_by UUID REFERENCES user_profiles(id),
  updated_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, driver_code)
);

CREATE TABLE IF NOT EXISTS fleet_driver_licenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  driver_id UUID REFERENCES fleet_drivers(id) ON DELETE CASCADE,
  driver_name VARCHAR(200),
  license_number VARCHAR(80) NOT NULL,
  license_class VARCHAR(40),
  issued_date DATE,
  expiry_date DATE,
  issuing_authority VARCHAR(150),
  status VARCHAR(30) DEFAULT 'valid',
  file_url TEXT,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS fleet_driver_certifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  driver_id UUID REFERENCES fleet_drivers(id) ON DELETE CASCADE,
  driver_name VARCHAR(200),
  cert_name VARCHAR(200) NOT NULL,
  cert_number VARCHAR(80),
  issued_date DATE,
  expiry_date DATE,
  status VARCHAR(30) DEFAULT 'valid',
  file_url TEXT,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS fleet_driver_training (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  driver_id UUID REFERENCES fleet_drivers(id) ON DELETE CASCADE,
  driver_name VARCHAR(200),
  training_title VARCHAR(200) NOT NULL,
  training_type VARCHAR(60) DEFAULT 'safety',
  completed_date DATE,
  expiry_date DATE,
  score DECIMAL(5,2),
  status VARCHAR(30) DEFAULT 'completed',
  notes TEXT,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS fleet_driver_medicals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  driver_id UUID REFERENCES fleet_drivers(id) ON DELETE CASCADE,
  driver_name VARCHAR(200),
  exam_date DATE DEFAULT CURRENT_DATE,
  expiry_date DATE,
  result VARCHAR(40) DEFAULT 'fit',
  clinic_name VARCHAR(150),
  file_url TEXT,
  notes TEXT,
  status VARCHAR(30) DEFAULT 'valid',
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS fleet_driver_violations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  driver_id UUID REFERENCES fleet_drivers(id) ON DELETE CASCADE,
  driver_name VARCHAR(200),
  vehicle_registration VARCHAR(50),
  violation_date DATE DEFAULT CURRENT_DATE,
  violation_type VARCHAR(80) NOT NULL,
  severity VARCHAR(20) DEFAULT 'medium',
  fine_amount DECIMAL(14,2) DEFAULT 0,
  description TEXT,
  status VARCHAR(30) DEFAULT 'open',
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS fleet_driver_performance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  driver_id UUID REFERENCES fleet_drivers(id) ON DELETE CASCADE,
  driver_name VARCHAR(200),
  period_label VARCHAR(40) NOT NULL,
  trips_completed INTEGER DEFAULT 0,
  km_driven DECIMAL(14,2) DEFAULT 0,
  on_time_pct DECIMAL(5,2) DEFAULT 100,
  fuel_efficiency DECIMAL(8,2) DEFAULT 0,
  safety_score DECIMAL(5,2) DEFAULT 100,
  customer_rating DECIMAL(3,2) DEFAULT 5,
  overall_score DECIMAL(5,2) DEFAULT 80,
  notes TEXT,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS fleet_driver_attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  driver_id UUID REFERENCES fleet_drivers(id) ON DELETE CASCADE,
  driver_name VARCHAR(200),
  attendance_date DATE DEFAULT CURRENT_DATE,
  check_in TIMESTAMPTZ,
  check_out TIMESTAMPTZ,
  status VARCHAR(30) DEFAULT 'present',
  -- present | absent | late | leave | half_day
  notes TEXT,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- GPS / TELEMATICS / GEOFENCE
-- ============================================================
CREATE TABLE IF NOT EXISTS fleet_gps_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  device_code VARCHAR(80) NOT NULL,
  imei VARCHAR(40),
  provider VARCHAR(60) DEFAULT 'generic',
  -- teltonika | ruptela | queclink | jimi | geotab | generic
  vehicle_id UUID REFERENCES fleet_vehicles(id) ON DELETE SET NULL,
  registration VARCHAR(50),
  protocol VARCHAR(40) DEFAULT 'tcp',
  status VARCHAR(30) DEFAULT 'online',
  last_seen_at TIMESTAMPTZ,
  firmware VARCHAR(40),
  notes TEXT,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, device_code)
);

CREATE TABLE IF NOT EXISTS fleet_gps_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  device_id UUID REFERENCES fleet_gps_devices(id) ON DELETE SET NULL,
  vehicle_id UUID REFERENCES fleet_vehicles(id) ON DELETE SET NULL,
  registration VARCHAR(50),
  driver_name VARCHAR(200),
  lat NUMERIC(10,7) NOT NULL,
  lng NUMERIC(10,7) NOT NULL,
  speed_kmh DECIMAL(8,2) DEFAULT 0,
  heading DECIMAL(6,2),
  altitude_m DECIMAL(10,2),
  ignition BOOLEAN DEFAULT false,
  idle_seconds INTEGER DEFAULT 0,
  odometer_km DECIMAL(14,2),
  recorded_at TIMESTAMPTZ DEFAULT NOW(),
  raw_payload JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fleet_gps_loc_vehicle ON fleet_gps_locations(company_id, vehicle_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_fleet_gps_loc_time ON fleet_gps_locations(company_id, recorded_at DESC);

CREATE TABLE IF NOT EXISTS fleet_geofences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  fence_code VARCHAR(50) NOT NULL,
  name VARCHAR(200) NOT NULL,
  fence_type VARCHAR(40) DEFAULT 'circle',
  -- circle | polygon | route_corridor
  center_lat NUMERIC(10,7),
  center_lng NUMERIC(10,7),
  radius_m INTEGER DEFAULT 500,
  polygon_json JSONB DEFAULT '[]'::jsonb,
  alert_on_enter BOOLEAN DEFAULT true,
  alert_on_exit BOOLEAN DEFAULT true,
  status VARCHAR(30) DEFAULT 'active',
  notes TEXT,
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, fence_code)
);

CREATE TABLE IF NOT EXISTS fleet_iot_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  device_code VARCHAR(80) NOT NULL,
  name VARCHAR(200) NOT NULL,
  device_type VARCHAR(60) DEFAULT 'sensor',
  -- sensor | temp | engine | camera | tachograph
  vehicle_id UUID REFERENCES fleet_vehicles(id) ON DELETE SET NULL,
  registration VARCHAR(50),
  status VARCHAR(30) DEFAULT 'online',
  last_reading JSONB DEFAULT '{}'::jsonb,
  last_seen_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, device_code)
);

CREATE TABLE IF NOT EXISTS fleet_telematics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  vehicle_id UUID REFERENCES fleet_vehicles(id) ON DELETE CASCADE,
  registration VARCHAR(50),
  reading_at TIMESTAMPTZ DEFAULT NOW(),
  engine_rpm INTEGER,
  coolant_temp_c DECIMAL(6,2),
  fuel_level_pct DECIMAL(5,2),
  battery_v DECIMAL(6,2),
  cargo_temp_c DECIMAL(6,2),
  harsh_brake INTEGER DEFAULT 0,
  harsh_accel INTEGER DEFAULT 0,
  overspeed INTEGER DEFAULT 0,
  dtc_codes TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS fleet_odometer_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  vehicle_id UUID REFERENCES fleet_vehicles(id) ON DELETE CASCADE,
  registration VARCHAR(50),
  reading_date DATE DEFAULT CURRENT_DATE,
  odometer_km DECIMAL(14,2) NOT NULL,
  source VARCHAR(40) DEFAULT 'manual',
  -- manual | gps | trip | maintenance
  driver_name VARCHAR(200),
  notes TEXT,
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TRIPS / DISPATCH / DELIVERY / POD
-- ============================================================
CREATE TABLE IF NOT EXISTS fleet_trip_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  request_number VARCHAR(50) NOT NULL,
  purpose VARCHAR(255),
  requestor_name VARCHAR(200),
  department_name VARCHAR(150),
  project_name VARCHAR(150),
  customer_name VARCHAR(200),
  origin TEXT,
  destination TEXT,
  requested_date DATE DEFAULT CURRENT_DATE,
  needed_by TIMESTAMPTZ,
  passengers INTEGER DEFAULT 0,
  cargo_description TEXT,
  priority VARCHAR(20) DEFAULT 'normal',
  status VARCHAR(30) DEFAULT 'pending',
  -- pending | approved | rejected | assigned | cancelled
  notes TEXT,
  approved_by UUID REFERENCES user_profiles(id),
  approved_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES user_profiles(id),
  updated_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, request_number)
);

CREATE TABLE IF NOT EXISTS fleet_trips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  trip_number VARCHAR(50) NOT NULL,
  request_id UUID REFERENCES fleet_trip_requests(id) ON DELETE SET NULL,
  purpose VARCHAR(255),
  customer_name VARCHAR(200),
  project_name VARCHAR(150),
  vehicle_id UUID REFERENCES fleet_vehicles(id) ON DELETE SET NULL,
  registration VARCHAR(50),
  driver_id UUID REFERENCES fleet_drivers(id) ON DELETE SET NULL,
  driver_name VARCHAR(200),
  origin TEXT,
  destination TEXT,
  route_name VARCHAR(200),
  planned_distance_km DECIMAL(12,2) DEFAULT 0,
  actual_distance_km DECIMAL(12,2) DEFAULT 0,
  planned_start TIMESTAMPTZ,
  planned_end TIMESTAMPTZ,
  actual_start TIMESTAMPTZ,
  actual_end TIMESTAMPTZ,
  fuel_used_l DECIMAL(12,3) DEFAULT 0,
  expense_total DECIMAL(18,2) DEFAULT 0,
  cargo_description TEXT,
  status VARCHAR(30) DEFAULT 'planned',
  -- planned | dispatched | in_progress | completed | delayed | cancelled | closed
  qr_payload TEXT,
  notes TEXT,
  version_no INTEGER DEFAULT 1,
  deleted_at TIMESTAMPTZ,
  archived_at TIMESTAMPTZ,
  created_by UUID REFERENCES user_profiles(id),
  updated_by UUID REFERENCES user_profiles(id),
  approved_by UUID REFERENCES user_profiles(id),
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, trip_number)
);

CREATE TABLE IF NOT EXISTS fleet_trip_routes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  route_code VARCHAR(50) NOT NULL,
  name VARCHAR(200) NOT NULL,
  origin TEXT,
  destination TEXT,
  waypoints JSONB DEFAULT '[]'::jsonb,
  distance_km DECIMAL(12,2) DEFAULT 0,
  estimated_hours DECIMAL(8,2) DEFAULT 0,
  optimized BOOLEAN DEFAULT false,
  status VARCHAR(30) DEFAULT 'active',
  notes TEXT,
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, route_code)
);

CREATE TABLE IF NOT EXISTS fleet_dispatch_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  dispatch_number VARCHAR(50) NOT NULL,
  trip_id UUID REFERENCES fleet_trips(id) ON DELETE SET NULL,
  vehicle_id UUID REFERENCES fleet_vehicles(id) ON DELETE SET NULL,
  registration VARCHAR(50),
  driver_id UUID REFERENCES fleet_drivers(id) ON DELETE SET NULL,
  driver_name VARCHAR(200),
  customer_name VARCHAR(200),
  warehouse_name VARCHAR(150),
  delivery_address TEXT,
  scheduled_at TIMESTAMPTZ,
  dispatched_at TIMESTAMPTZ,
  status VARCHAR(30) DEFAULT 'scheduled',
  -- scheduled | loading | dispatched | in_transit | delivered | failed | cancelled
  priority VARCHAR(20) DEFAULT 'normal',
  notes TEXT,
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES user_profiles(id),
  updated_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, dispatch_number)
);

CREATE TABLE IF NOT EXISTS fleet_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  delivery_number VARCHAR(50) NOT NULL,
  dispatch_id UUID REFERENCES fleet_dispatch_orders(id) ON DELETE SET NULL,
  trip_id UUID REFERENCES fleet_trips(id) ON DELETE SET NULL,
  customer_name VARCHAR(200),
  delivery_address TEXT,
  contact_phone VARCHAR(50),
  scheduled_date DATE,
  delivered_at TIMESTAMPTZ,
  status VARCHAR(30) DEFAULT 'pending',
  -- pending | out_for_delivery | delivered | failed | returned | partial
  items_summary TEXT,
  weight_kg DECIMAL(12,3) DEFAULT 0,
  notes TEXT,
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, delivery_number)
);

CREATE TABLE IF NOT EXISTS fleet_proof_of_delivery (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  pod_number VARCHAR(50) NOT NULL,
  delivery_id UUID REFERENCES fleet_deliveries(id) ON DELETE SET NULL,
  trip_id UUID REFERENCES fleet_trips(id) ON DELETE SET NULL,
  customer_name VARCHAR(200),
  recipient_name VARCHAR(200),
  signature_url TEXT,
  photo_url TEXT,
  qr_verified BOOLEAN DEFAULT false,
  barcode_scanned VARCHAR(100),
  lat NUMERIC(10,7),
  lng NUMERIC(10,7),
  delivered_at TIMESTAMPTZ DEFAULT NOW(),
  notes TEXT,
  status VARCHAR(30) DEFAULT 'captured',
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, pod_number)
);

CREATE TABLE IF NOT EXISTS fleet_containers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  container_number VARCHAR(80) NOT NULL,
  container_type VARCHAR(40) DEFAULT '20ft',
  seal_number VARCHAR(80),
  vehicle_id UUID REFERENCES fleet_vehicles(id) ON DELETE SET NULL,
  trip_id UUID REFERENCES fleet_trips(id) ON DELETE SET NULL,
  status VARCHAR(30) DEFAULT 'empty',
  origin VARCHAR(200),
  destination VARCHAR(200),
  notes TEXT,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, container_number)
);

CREATE TABLE IF NOT EXISTS fleet_cargo (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  cargo_number VARCHAR(50) NOT NULL,
  trip_id UUID REFERENCES fleet_trips(id) ON DELETE SET NULL,
  delivery_id UUID REFERENCES fleet_deliveries(id) ON DELETE SET NULL,
  description TEXT NOT NULL,
  quantity DECIMAL(14,3) DEFAULT 1,
  uom VARCHAR(30) DEFAULT 'EA',
  weight_kg DECIMAL(12,3) DEFAULT 0,
  volume_m3 DECIMAL(12,4) DEFAULT 0,
  hazardous BOOLEAN DEFAULT false,
  status VARCHAR(30) DEFAULT 'loaded',
  notes TEXT,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, cargo_number)
);

-- ============================================================
-- FUEL
-- ============================================================
CREATE TABLE IF NOT EXISTS fleet_fuel_stations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  station_code VARCHAR(50) NOT NULL,
  name VARCHAR(200) NOT NULL,
  provider VARCHAR(100),
  address TEXT,
  lat NUMERIC(10,7),
  lng NUMERIC(10,7),
  fuel_types TEXT DEFAULT 'diesel,petrol',
  status VARCHAR(30) DEFAULT 'active',
  contact_phone VARCHAR(50),
  notes TEXT,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, station_code)
);

CREATE TABLE IF NOT EXISTS fleet_fuel_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  card_number VARCHAR(60) NOT NULL,
  provider VARCHAR(100),
  vehicle_id UUID REFERENCES fleet_vehicles(id) ON DELETE SET NULL,
  registration VARCHAR(50),
  driver_id UUID REFERENCES fleet_drivers(id) ON DELETE SET NULL,
  driver_name VARCHAR(200),
  daily_limit DECIMAL(14,2) DEFAULT 0,
  monthly_limit DECIMAL(14,2) DEFAULT 0,
  status VARCHAR(30) DEFAULT 'active',
  expiry_date DATE,
  notes TEXT,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, card_number)
);

CREATE TABLE IF NOT EXISTS fleet_fuel_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  request_number VARCHAR(50) NOT NULL,
  vehicle_id UUID REFERENCES fleet_vehicles(id) ON DELETE SET NULL,
  registration VARCHAR(50),
  driver_id UUID REFERENCES fleet_drivers(id) ON DELETE SET NULL,
  driver_name VARCHAR(200),
  litres_requested DECIMAL(12,3) NOT NULL,
  fuel_type VARCHAR(40) DEFAULT 'diesel',
  station_name VARCHAR(150),
  purpose TEXT,
  status VARCHAR(30) DEFAULT 'pending',
  -- pending | approved | rejected | issued | cancelled
  approved_by UUID REFERENCES user_profiles(id),
  approved_at TIMESTAMPTZ,
  notes TEXT,
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, request_number)
);

CREATE TABLE IF NOT EXISTS fleet_fuel_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  txn_number VARCHAR(50) NOT NULL,
  request_id UUID REFERENCES fleet_fuel_requests(id) ON DELETE SET NULL,
  vehicle_id UUID REFERENCES fleet_vehicles(id) ON DELETE SET NULL,
  registration VARCHAR(50),
  driver_name VARCHAR(200),
  station_name VARCHAR(150),
  card_number VARCHAR(60),
  fuel_type VARCHAR(40) DEFAULT 'diesel',
  litres DECIMAL(12,3) NOT NULL,
  unit_price DECIMAL(14,4) DEFAULT 0,
  total_cost DECIMAL(18,2) DEFAULT 0,
  odometer_km DECIMAL(14,2),
  txn_date DATE DEFAULT CURRENT_DATE,
  currency_code VARCHAR(10) DEFAULT 'UGX',
  cost_center VARCHAR(80),
  project_name VARCHAR(150),
  status VARCHAR(30) DEFAULT 'posted',
  anomaly_flag BOOLEAN DEFAULT false,
  notes TEXT,
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, txn_number)
);

-- ============================================================
-- MAINTENANCE / WORKSHOP / PARTS
-- ============================================================
CREATE TABLE IF NOT EXISTS fleet_workshops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  workshop_code VARCHAR(50) NOT NULL,
  name VARCHAR(200) NOT NULL,
  location VARCHAR(200),
  manager_name VARCHAR(150),
  phone VARCHAR(50),
  status VARCHAR(30) DEFAULT 'active',
  notes TEXT,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, workshop_code)
);

CREATE TABLE IF NOT EXISTS fleet_mechanics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  mechanic_code VARCHAR(50) NOT NULL,
  full_name VARCHAR(200) NOT NULL,
  workshop_name VARCHAR(150),
  specialty VARCHAR(100),
  phone VARCHAR(50),
  employee_id UUID,
  status VARCHAR(30) DEFAULT 'available',
  is_active BOOLEAN DEFAULT true,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, mechanic_code)
);

CREATE TABLE IF NOT EXISTS fleet_maintenance_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  plan_code VARCHAR(50) NOT NULL,
  name VARCHAR(200) NOT NULL,
  vehicle_id UUID REFERENCES fleet_vehicles(id) ON DELETE SET NULL,
  registration VARCHAR(50),
  plan_type VARCHAR(40) DEFAULT 'preventive',
  -- preventive | predictive | manufacturer
  interval_km INTEGER,
  interval_days INTEGER,
  interval_engine_hours INTEGER,
  last_service_date DATE,
  next_due_date DATE,
  next_due_odometer INTEGER,
  status VARCHAR(30) DEFAULT 'active',
  notes TEXT,
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, plan_code)
);

CREATE TABLE IF NOT EXISTS fleet_work_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  work_order_number VARCHAR(50) NOT NULL,
  vehicle_id UUID REFERENCES fleet_vehicles(id) ON DELETE SET NULL,
  registration VARCHAR(50),
  plan_id UUID REFERENCES fleet_maintenance_plans(id) ON DELETE SET NULL,
  work_type VARCHAR(40) DEFAULT 'preventive',
  -- preventive | corrective | emergency | inspection | calibration
  title VARCHAR(255) NOT NULL,
  description TEXT,
  workshop_name VARCHAR(150),
  mechanic_name VARCHAR(150),
  priority VARCHAR(20) DEFAULT 'normal',
  status VARCHAR(30) DEFAULT 'open',
  -- open | assigned | in_progress | waiting_parts | completed | cancelled
  scheduled_date DATE,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  labor_cost DECIMAL(18,2) DEFAULT 0,
  parts_cost DECIMAL(18,2) DEFAULT 0,
  total_cost DECIMAL(18,2) DEFAULT 0,
  odometer_km DECIMAL(14,2),
  notes TEXT,
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES user_profiles(id),
  updated_by UUID REFERENCES user_profiles(id),
  approved_by UUID REFERENCES user_profiles(id),
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, work_order_number)
);

CREATE TABLE IF NOT EXISTS fleet_repair_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  repair_number VARCHAR(50) NOT NULL,
  work_order_id UUID REFERENCES fleet_work_orders(id) ON DELETE SET NULL,
  vehicle_id UUID REFERENCES fleet_vehicles(id) ON DELETE SET NULL,
  registration VARCHAR(50),
  fault_description TEXT NOT NULL,
  repair_action TEXT,
  mechanic_name VARCHAR(150),
  status VARCHAR(30) DEFAULT 'open',
  cost DECIMAL(18,2) DEFAULT 0,
  completed_at TIMESTAMPTZ,
  notes TEXT,
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, repair_number)
);

CREATE TABLE IF NOT EXISTS fleet_spare_parts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  part_code VARCHAR(50) NOT NULL,
  name VARCHAR(200) NOT NULL,
  category VARCHAR(80),
  unit_cost DECIMAL(18,2) DEFAULT 0,
  quantity_on_hand DECIMAL(14,3) DEFAULT 0,
  reorder_level DECIMAL(14,3) DEFAULT 0,
  supplier_name VARCHAR(150),
  location VARCHAR(100),
  status VARCHAR(30) DEFAULT 'active',
  notes TEXT,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, part_code)
);

CREATE TABLE IF NOT EXISTS fleet_tyres (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  tyre_code VARCHAR(50) NOT NULL,
  vehicle_id UUID REFERENCES fleet_vehicles(id) ON DELETE SET NULL,
  registration VARCHAR(50),
  position VARCHAR(40) DEFAULT 'FL',
  -- FL | FR | RL | RR | spare | trailer
  brand VARCHAR(100),
  size_label VARCHAR(40),
  serial_number VARCHAR(80),
  install_date DATE,
  install_odometer DECIMAL(14,2),
  pressure_psi DECIMAL(6,2),
  tread_depth_mm DECIMAL(6,2),
  replacement_date DATE,
  cost DECIMAL(18,2) DEFAULT 0,
  supplier_name VARCHAR(150),
  status VARCHAR(30) DEFAULT 'in_service',
  cost_per_km DECIMAL(12,4) DEFAULT 0,
  notes TEXT,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, tyre_code)
);

CREATE TABLE IF NOT EXISTS fleet_batteries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  battery_code VARCHAR(50) NOT NULL,
  vehicle_id UUID REFERENCES fleet_vehicles(id) ON DELETE SET NULL,
  registration VARCHAR(50),
  brand VARCHAR(100),
  capacity_ah INTEGER,
  install_date DATE,
  warranty_end DATE,
  voltage DECIMAL(6,2),
  cost DECIMAL(18,2) DEFAULT 0,
  status VARCHAR(30) DEFAULT 'in_service',
  notes TEXT,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, battery_code)
);

-- ============================================================
-- COMPLIANCE / INSURANCE / ACCIDENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS fleet_insurance_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  policy_number VARCHAR(80) NOT NULL,
  vehicle_id UUID REFERENCES fleet_vehicles(id) ON DELETE SET NULL,
  registration VARCHAR(50),
  insurer_name VARCHAR(150) NOT NULL,
  policy_type VARCHAR(60) DEFAULT 'comprehensive',
  premium DECIMAL(18,2) DEFAULT 0,
  coverage_amount DECIMAL(18,2) DEFAULT 0,
  start_date DATE,
  expiry_date DATE,
  status VARCHAR(30) DEFAULT 'active',
  file_url TEXT,
  notes TEXT,
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, policy_number)
);

CREATE TABLE IF NOT EXISTS fleet_road_licenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  license_number VARCHAR(80) NOT NULL,
  vehicle_id UUID REFERENCES fleet_vehicles(id) ON DELETE SET NULL,
  registration VARCHAR(50),
  issued_date DATE,
  expiry_date DATE,
  authority VARCHAR(150),
  fee_amount DECIMAL(18,2) DEFAULT 0,
  status VARCHAR(30) DEFAULT 'valid',
  file_url TEXT,
  notes TEXT,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, license_number)
);

CREATE TABLE IF NOT EXISTS fleet_inspections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  inspection_number VARCHAR(50) NOT NULL,
  vehicle_id UUID REFERENCES fleet_vehicles(id) ON DELETE SET NULL,
  registration VARCHAR(50),
  inspection_type VARCHAR(60) DEFAULT 'periodic',
  inspection_date DATE DEFAULT CURRENT_DATE,
  next_due_date DATE,
  result VARCHAR(40) DEFAULT 'pass',
  inspector_name VARCHAR(150),
  findings TEXT,
  status VARCHAR(30) DEFAULT 'completed',
  file_url TEXT,
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, inspection_number)
);

CREATE TABLE IF NOT EXISTS fleet_accidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  accident_number VARCHAR(50) NOT NULL,
  vehicle_id UUID REFERENCES fleet_vehicles(id) ON DELETE SET NULL,
  registration VARCHAR(50),
  driver_id UUID REFERENCES fleet_drivers(id) ON DELETE SET NULL,
  driver_name VARCHAR(200),
  accident_date TIMESTAMPTZ DEFAULT NOW(),
  location TEXT,
  severity VARCHAR(20) DEFAULT 'minor',
  description TEXT,
  injuries BOOLEAN DEFAULT false,
  police_report VARCHAR(100),
  estimated_damage DECIMAL(18,2) DEFAULT 0,
  status VARCHAR(30) DEFAULT 'reported',
  -- reported | investigating | claim_filed | closed
  photo_url TEXT,
  notes TEXT,
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, accident_number)
);

CREATE TABLE IF NOT EXISTS fleet_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  claim_number VARCHAR(50) NOT NULL,
  accident_id UUID REFERENCES fleet_accidents(id) ON DELETE SET NULL,
  policy_id UUID REFERENCES fleet_insurance_policies(id) ON DELETE SET NULL,
  registration VARCHAR(50),
  claim_amount DECIMAL(18,2) DEFAULT 0,
  approved_amount DECIMAL(18,2) DEFAULT 0,
  status VARCHAR(30) DEFAULT 'submitted',
  -- submitted | under_review | approved | rejected | paid | closed
  submitted_date DATE DEFAULT CURRENT_DATE,
  settled_date DATE,
  notes TEXT,
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, claim_number)
);

-- ============================================================
-- COSTS / SETTINGS / AUDIT / AI / APPROVALS
-- ============================================================
CREATE TABLE IF NOT EXISTS fleet_costs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  cost_number VARCHAR(50) NOT NULL,
  vehicle_id UUID REFERENCES fleet_vehicles(id) ON DELETE SET NULL,
  registration VARCHAR(50),
  cost_type VARCHAR(60) NOT NULL,
  -- fuel | repair | insurance | road_tax | salary | depreciation | toll | parking | licensing | leasing | fine | other
  cost_date DATE DEFAULT CURRENT_DATE,
  amount DECIMAL(18,2) NOT NULL DEFAULT 0,
  currency_code VARCHAR(10) DEFAULT 'UGX',
  cost_center VARCHAR(80),
  project_name VARCHAR(150),
  gl_account VARCHAR(40),
  finance_posted BOOLEAN DEFAULT false,
  description TEXT,
  status VARCHAR(30) DEFAULT 'posted',
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, cost_number)
);

CREATE TABLE IF NOT EXISTS fleet_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  approval_number VARCHAR(50) NOT NULL,
  entity_table VARCHAR(80) NOT NULL,
  entity_id UUID,
  entity_code VARCHAR(80),
  title VARCHAR(255) NOT NULL,
  requested_by UUID REFERENCES user_profiles(id),
  approver_id UUID REFERENCES user_profiles(id),
  status VARCHAR(30) DEFAULT 'pending',
  -- pending | approved | rejected
  decision_notes TEXT,
  decided_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, approval_number)
);

CREATE TABLE IF NOT EXISTS fleet_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  body TEXT,
  severity VARCHAR(20) DEFAULT 'info',
  category VARCHAR(60) DEFAULT 'general',
  entity_table VARCHAR(80),
  entity_id UUID,
  is_read BOOLEAN DEFAULT false,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS fleet_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  setting_key VARCHAR(100) NOT NULL,
  setting_value JSONB DEFAULT 'null'::jsonb,
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, setting_key)
);

CREATE TABLE IF NOT EXISTS fleet_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES user_profiles(id),
  action VARCHAR(60) NOT NULL,
  entity_table VARCHAR(80),
  entity_id UUID,
  entity_code VARCHAR(80),
  details TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS fleet_ai_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  insight_type VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  summary TEXT NOT NULL,
  severity VARCHAR(20) DEFAULT 'info',
  score DECIMAL(5,2),
  recommendations JSONB DEFAULT '[]'::jsonb,
  status VARCHAR(30) DEFAULT 'open',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS fleet_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  entity_table VARCHAR(80) NOT NULL,
  entity_id UUID,
  file_name VARCHAR(255),
  file_url TEXT NOT NULL,
  mime_type VARCHAR(100),
  file_size INTEGER,
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS fleet_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  entity_table VARCHAR(80) NOT NULL,
  entity_id UUID,
  body TEXT NOT NULL,
  created_by UUID REFERENCES user_profiles(id),
  author_name VARCHAR(150),
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- PERMISSIONS
-- ============================================================
INSERT INTO permissions (name, slug, module, description)
SELECT v.name, v.slug, v.module, v.description
FROM (VALUES
  ('View Fleet Platform', 'fleet.view', 'fleet', 'View fleet and transport'),
  ('Manage Fleet Platform', 'fleet.manage', 'fleet', 'Create and edit fleet entities'),
  ('Fleet Drivers', 'fleet.drivers', 'fleet', 'Driver management'),
  ('Fleet Fuel', 'fleet.fuel', 'fleet', 'Fuel management'),
  ('Fleet Maintenance', 'fleet.maintenance', 'fleet', 'Maintenance and workshop'),
  ('Fleet Dispatch', 'fleet.dispatch', 'fleet', 'Trips dispatch deliveries POD'),
  ('Fleet GPS Track', 'fleet.track', 'fleet', 'GPS live tracking'),
  ('Fleet Approve', 'fleet.approve', 'fleet', 'Approvals for trips fuel maintenance'),
  ('Fleet AI Assistant', 'fleet.ai', 'fleet', 'AI fleet intelligence'),
  ('Fleet Admin', 'fleet.admin', 'fleet', 'Full fleet administration')
) AS v(name, slug, module, description)
WHERE NOT EXISTS (SELECT 1 FROM permissions p WHERE p.slug = v.slug OR p.name = v.name);

INSERT INTO role_permissions (role_id, permission_id)
SELECT 'e0000000-0000-4000-8000-000000000001', id FROM permissions
WHERE slug LIKE 'fleet.%'
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE p.slug LIKE 'fleet.%'
  AND r.slug IN (
    'super_administrator','managing_director','operations_manager',
    'warehouse_manager','auditor'
  )
  AND NOT EXISTS (
    SELECT 1 FROM role_permissions rp WHERE rp.role_id = r.id AND rp.permission_id = p.id
  );

-- ============================================================
-- RLS
-- ============================================================
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'fleet_vehicle_categories','fleet_vehicle_types','fleet_vehicle_brands','fleet_vehicle_models',
    'fleet_vehicle_documents','fleet_vehicle_photos','fleet_vehicle_assignments',
    'fleet_drivers','fleet_driver_licenses','fleet_driver_certifications','fleet_driver_training',
    'fleet_driver_medicals','fleet_driver_violations','fleet_driver_performance','fleet_driver_attendance',
    'fleet_gps_devices','fleet_gps_locations','fleet_geofences','fleet_iot_devices','fleet_telematics',
    'fleet_odometer_logs','fleet_trip_requests','fleet_trips','fleet_trip_routes','fleet_dispatch_orders',
    'fleet_deliveries','fleet_proof_of_delivery','fleet_containers','fleet_cargo',
    'fleet_fuel_stations','fleet_fuel_cards','fleet_fuel_requests','fleet_fuel_transactions',
    'fleet_workshops','fleet_mechanics','fleet_maintenance_plans','fleet_work_orders','fleet_repair_orders',
    'fleet_spare_parts','fleet_tyres','fleet_batteries','fleet_insurance_policies','fleet_road_licenses',
    'fleet_inspections','fleet_accidents','fleet_claims','fleet_costs','fleet_approvals',
    'fleet_notifications','fleet_settings','fleet_audit_log','fleet_ai_insights',
    'fleet_attachments','fleet_comments'
  ]
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    BEGIN
      EXECUTE format(
        'CREATE POLICY %I ON %I FOR ALL USING (company_id = public.user_company_id() OR company_id IS NULL) WITH CHECK (company_id = public.user_company_id() OR company_id IS NULL)',
        t || '_all', t
      );
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END LOOP;
END $$;

-- Ensure base fleet tables have company RLS (if missing)
DO $$
BEGIN
  ALTER TABLE fleet_vehicles ENABLE ROW LEVEL SECURITY;
  BEGIN
    CREATE POLICY fleet_vehicles_all ON fleet_vehicles FOR ALL
      USING (company_id = public.user_company_id() OR company_id IS NULL)
      WITH CHECK (company_id = public.user_company_id() OR company_id IS NULL);
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  ALTER TABLE fleet_fuel_logs ENABLE ROW LEVEL SECURITY;
  BEGIN
    CREATE POLICY fleet_fuel_logs_all ON fleet_fuel_logs FOR ALL
      USING (company_id = public.user_company_id() OR company_id IS NULL)
      WITH CHECK (company_id = public.user_company_id() OR company_id IS NULL);
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  ALTER TABLE fleet_maintenance ENABLE ROW LEVEL SECURITY;
  BEGIN
    CREATE POLICY fleet_maintenance_all ON fleet_maintenance FOR ALL
      USING (company_id = public.user_company_id() OR company_id IS NULL)
      WITH CHECK (company_id = public.user_company_id() OR company_id IS NULL);
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;

-- ============================================================
-- SEED
-- ============================================================
DO $$
DECLARE
  cid UUID := 'a0000000-0000-4000-8000-000000000001';
  vid UUID;
  did UUID;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM companies WHERE id = cid) THEN
    SELECT id INTO cid FROM companies LIMIT 1;
  END IF;
  IF cid IS NULL THEN RETURN; END IF;

  INSERT INTO fleet_vehicle_categories (company_id, code, name, description) VALUES
    (cid, 'LIGHT', 'Light Vehicles', 'Cars and pickups'),
    (cid, 'HEAVY', 'Heavy Commercial', 'Trucks and trailers'),
    (cid, 'SPECIAL', 'Special Purpose', 'Cranes, tankers, refrigerated')
  ON CONFLICT (company_id, code) DO NOTHING;

  INSERT INTO fleet_vehicle_types (company_id, code, name, default_fuel_type) VALUES
    (cid, 'TRUCK', 'Truck', 'diesel'),
    (cid, 'VAN', 'Van', 'diesel'),
    (cid, 'PICKUP', 'Pickup', 'diesel'),
    (cid, 'MOTORCYCLE', 'Motorcycle', 'petrol'),
    (cid, 'TRAILER', 'Trailer', 'diesel'),
    (cid, 'BUS', 'Bus', 'diesel')
  ON CONFLICT (company_id, code) DO NOTHING;

  INSERT INTO fleet_vehicle_brands (company_id, code, name, country) VALUES
    (cid, 'TOYOTA', 'Toyota', 'Japan'),
    (cid, 'ISUZU', 'Isuzu', 'Japan'),
    (cid, 'MERCEDES', 'Mercedes-Benz', 'Germany'),
    (cid, 'SCANIA', 'Scania', 'Sweden'),
    (cid, 'MITSUBISHI', 'Mitsubishi', 'Japan')
  ON CONFLICT (company_id, code) DO NOTHING;

  INSERT INTO fleet_vehicle_models (company_id, brand_name, code, name, fuel_type) VALUES
    (cid, 'Toyota', 'HILUX', 'Hilux Double Cab', 'diesel'),
    (cid, 'Isuzu', 'NPR', 'NPR Truck', 'diesel'),
    (cid, 'Scania', 'R450', 'R 450 Tractor', 'diesel')
  ON CONFLICT (company_id, code) DO NOTHING;

  INSERT INTO fleet_workshops (company_id, workshop_code, name, location, manager_name, status) VALUES
    (cid, 'WS-MAIN', 'Main Fleet Workshop', 'Kampala Depot', 'James Okello', 'active'),
    (cid, 'WS-EAST', 'Eastern Service Bay', 'Jinja Depot', 'Sarah Nambi', 'active')
  ON CONFLICT (company_id, workshop_code) DO NOTHING;

  INSERT INTO fleet_mechanics (company_id, mechanic_code, full_name, workshop_name, specialty, status) VALUES
    (cid, 'MEC-001', 'Peter Mugisha', 'Main Fleet Workshop', 'Engine & Diesel', 'available'),
    (cid, 'MEC-002', 'Grace Auma', 'Main Fleet Workshop', 'Electrical', 'available')
  ON CONFLICT (company_id, mechanic_code) DO NOTHING;

  INSERT INTO fleet_fuel_stations (company_id, station_code, name, provider, address, status) VALUES
    (cid, 'ST-KLA-01', 'Total Kampala Industrial', 'Total', 'Industrial Area, Kampala', 'active'),
    (cid, 'ST-ENT-01', 'Shell Entebbe Road', 'Shell', 'Entebbe Road', 'active')
  ON CONFLICT (company_id, station_code) DO NOTHING;

  INSERT INTO fleet_geofences (company_id, fence_code, name, fence_type, center_lat, center_lng, radius_m, status) VALUES
    (cid, 'GF-DEPOT', 'Main Depot', 'circle', 0.3136, 32.5811, 800, 'active'),
    (cid, 'GF-PLANT', 'Secure Print Plant', 'circle', 0.3476, 32.5825, 500, 'active')
  ON CONFLICT (company_id, fence_code) DO NOTHING;

  INSERT INTO fleet_settings (company_id, setting_key, setting_value, description) VALUES
    (cid, 'default_currency', '"UGX"', 'Default fleet currency'),
    (cid, 'fuel_anomaly_pct', '25', 'Flag fuel use above plan by %'),
    (cid, 'pm_odometer_warn_km', '500', 'Warn PM within km'),
    (cid, 'license_warn_days', '30', 'Warn license/insurance expiry days'),
    (cid, 'gps_provider', '"generic"', 'Default GPS integration provider'),
    (cid, 'require_pod_photo', 'true', 'Require POD photo capture')
  ON CONFLICT (company_id, setting_key) DO NOTHING;

  INSERT INTO fleet_trip_routes (company_id, route_code, name, origin, destination, distance_km, estimated_hours, status) VALUES
    (cid, 'RT-KLA-ENT', 'Kampala → Entebbe', 'Kampala Depot', 'Entebbe Airport', 42, 1.5, 'active'),
    (cid, 'RT-KLA-JIN', 'Kampala → Jinja', 'Kampala Depot', 'Jinja Warehouse', 80, 2.5, 'active')
  ON CONFLICT (company_id, route_code) DO NOTHING;

  -- Sample vehicle if none
  IF NOT EXISTS (SELECT 1 FROM fleet_vehicles WHERE company_id = cid LIMIT 1) THEN
    INSERT INTO fleet_vehicles (
      company_id, registration, vehicle_code, asset_tag, make, model, brand_name, model_name,
      year, vehicle_type, category_name, fuel_type, status, capacity_kg, current_odometer,
      depot_name, branch_name, ownership_type, lifecycle_stage, qr_payload
    ) VALUES (
      cid, 'UBE 123A', 'VEH-00001', 'AST-FLT-001', 'Toyota', 'Hilux', 'Toyota', 'Hilux Double Cab',
      2022, 'pickup', 'Light Vehicles', 'diesel', 'available', 1000, 45200,
      'Kampala Depot', 'Head Office', 'owned', 'active', 'FLEET:UBE123A'
    ) RETURNING id INTO vid;
  ELSE
    SELECT id INTO vid FROM fleet_vehicles WHERE company_id = cid LIMIT 1;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM fleet_drivers WHERE company_id = cid LIMIT 1) THEN
    INSERT INTO fleet_drivers (
      company_id, driver_code, full_name, phone, license_number, license_class, license_expiry,
      status, performance_score, safety_score, assigned_vehicle_id, assigned_registration, depot_name
    ) VALUES (
      cid, 'DRV-00001', 'Musa Kato', '+256700000001', 'UG-DL-99881', 'B', CURRENT_DATE + 400,
      'available', 88, 95, vid, 'UBE 123A', 'Kampala Depot'
    ) RETURNING id INTO did;
  END IF;

  INSERT INTO fleet_ai_insights (company_id, insight_type, title, summary, severity, score, recommendations)
  SELECT cid, v.t, v.title, v.sum, v.sev, v.sc, v.rec::jsonb
  FROM (VALUES
    ('maintenance', 'PM due on high-mileage pickups',
     'Three light vehicles are within 500 km of scheduled service.',
     'warning', 78.0,
     '["Schedule workshop slots","Pre-order oil filters","Notify drivers"]'),
    ('fuel', 'Fuel efficiency drop on route Kampala–Jinja',
     'Average L/100km up 14% vs last month — possible idling or under-inflation.',
     'warning', 71.0,
     '["Check tyre pressure","Review idle reports","Audit fuel cards"]'),
    ('utilization', 'Two trucks under-utilized this week',
     'Utilization below 40% — reassign to production outbound.',
     'info', 65.0,
     '["Merge delivery windows","Share with warehouse logistics"]'),
    ('safety', 'Speeding events near plant gate',
     'Four overspeed events detected inside geofence GF-PLANT.',
     'critical', 86.0,
     '["Coach drivers","Lower geofence speed limit","Enable alert SMS"]')
  ) AS v(t, title, sum, sev, sc, rec)
  WHERE NOT EXISTS (SELECT 1 FROM fleet_ai_insights WHERE company_id = cid LIMIT 1);

  INSERT INTO fleet_spare_parts (company_id, part_code, name, category, unit_cost, quantity_on_hand, reorder_level, status) VALUES
    (cid, 'SP-OIL-5L', 'Engine Oil 5L Diesel', 'Lubricants', 85000, 40, 10, 'active'),
    (cid, 'SP-FLT-01', 'Oil Filter Standard', 'Filters', 35000, 25, 8, 'active'),
    (cid, 'SP-TYRE-R16', 'Tyre 265/70R16', 'Tyres', 450000, 12, 4, 'active')
  ON CONFLICT (company_id, part_code) DO NOTHING;

END $$;
