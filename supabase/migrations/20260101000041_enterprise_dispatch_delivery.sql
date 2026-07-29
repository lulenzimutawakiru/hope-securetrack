-- Hope Design Group — Enterprise Dispatch & Delivery Management
-- Planning · fleet · drivers · routes · loading · GPS · POD · returns · AI

-- ============================================================
-- PERMISSIONS
-- ============================================================
INSERT INTO permissions (name, slug, module, description)
SELECT v.name, v.slug, v.module, v.description
FROM (VALUES
  ('View Dispatch Ops', 'dsp.view', 'dispatch', 'View enterprise dispatch and delivery'),
  ('Manage Dispatch Ops', 'dsp.manage', 'dispatch', 'Plan, assign, and manage dispatches'),
  ('Dispatch Operate', 'dsp.operate', 'dispatch', 'Loading, POD, driver mobile ops'),
  ('Dispatch Approve', 'dsp.approve', 'dispatch', 'Approve dispatches and exceptions'),
  ('Dispatch AI', 'dsp.ai', 'dispatch', 'AI route and fleet assistant'),
  ('Dispatch Track', 'dsp.track', 'dispatch', 'GPS live tracking')
) AS v(name, slug, module, description)
WHERE NOT EXISTS (SELECT 1 FROM permissions p WHERE p.slug = v.slug OR p.name = v.name);

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE p.slug LIKE 'dsp.%'
  AND r.slug IN (
    'super_administrator','managing_director','operations_manager',
    'warehouse_manager','sales_manager','auditor'
  )
  AND NOT EXISTS (
    SELECT 1 FROM role_permissions rp WHERE rp.role_id = r.id AND rp.permission_id = p.id
  );

-- Also grant legacy dispatch.* to ops
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE p.slug IN ('dispatch.view','dispatch.manage')
  AND r.slug IN ('super_administrator','managing_director','operations_manager','warehouse_manager')
  AND NOT EXISTS (
    SELECT 1 FROM role_permissions rp WHERE rp.role_id = r.id AND rp.permission_id = p.id
  );

-- ============================================================
-- EXTEND legacy dispatches + fleet
-- ============================================================
ALTER TABLE dispatches
  ADD COLUMN IF NOT EXISTS priority VARCHAR(20) DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS weight_kg DECIMAL(12,3) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS volume_m3 DECIMAL(12,4) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS delivery_type VARCHAR(40) DEFAULT 'scheduled',
  -- same_day | scheduled | express | priority | multi_stop
  ADD COLUMN IF NOT EXISTS shipment_qr VARCHAR(80),
  ADD COLUMN IF NOT EXISTS vehicle_id UUID,
  ADD COLUMN IF NOT EXISTS driver_id UUID,
  ADD COLUMN IF NOT EXISTS route_id UUID,
  ADD COLUMN IF NOT EXISTS eta_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS lat NUMERIC(10,7),
  ADD COLUMN IF NOT EXISTS lng NUMERIC(10,7),
  ADD COLUMN IF NOT EXISTS pod_signed BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

ALTER TABLE fleet_vehicles
  ADD COLUMN IF NOT EXISTS vin VARCHAR(40),
  ADD COLUMN IF NOT EXISTS capacity_m3 DECIMAL(12,4),
  ADD COLUMN IF NOT EXISTS gps_tracker_id VARCHAR(80),
  ADD COLUMN IF NOT EXISTS third_party BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS fuel_efficiency_km_l DECIMAL(8,2),
  ADD COLUMN IF NOT EXISTS current_lat NUMERIC(10,7),
  ADD COLUMN IF NOT EXISTS current_lng NUMERIC(10,7),
  ADD COLUMN IF NOT EXISTS last_gps_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- ============================================================
-- DRIVERS
-- ============================================================
CREATE TABLE IF NOT EXISTS dsp_drivers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  driver_code VARCHAR(40) NOT NULL,
  full_name VARCHAR(200) NOT NULL,
  phone VARCHAR(40),
  emergency_contact VARCHAR(200),
  license_number VARCHAR(60),
  license_expiry DATE,
  certifications TEXT[],
  medical_status VARCHAR(40) DEFAULT 'fit',
  safety_score INTEGER DEFAULT 100,
  performance_score INTEGER DEFAULT 80,
  working_hours_json JSONB DEFAULT '{"start":"07:00","end":"18:00"}'::jsonb,
  assigned_vehicle_id UUID REFERENCES fleet_vehicles(id) ON DELETE SET NULL,
  employee_id UUID,
  status VARCHAR(30) DEFAULT 'available',
  -- available | on_trip | off_duty | suspended
  is_active BOOLEAN DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, driver_code)
);

-- ============================================================
-- DISPATCH REQUESTS (planning pipeline)
-- ============================================================
CREATE TABLE IF NOT EXISTS dsp_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  request_number VARCHAR(40) NOT NULL,
  source_type VARCHAR(40) DEFAULT 'sales_order',
  -- sales_order | production | transfer | return | service | collection | inter_branch
  source_ref VARCHAR(80),
  sales_order_id UUID REFERENCES sales_orders(id) ON DELETE SET NULL,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  customer_name VARCHAR(200),
  warehouse_name VARCHAR(150) DEFAULT 'Kampala Main',
  delivery_address TEXT,
  priority VARCHAR(20) DEFAULT 'normal',
  delivery_type VARCHAR(40) DEFAULT 'scheduled',
  requested_date DATE DEFAULT CURRENT_DATE,
  delivery_date DATE,
  weight_kg DECIMAL(12,3) DEFAULT 0,
  volume_m3 DECIMAL(12,4) DEFAULT 0,
  required_vehicle_type VARCHAR(40) DEFAULT 'truck',
  status VARCHAR(30) DEFAULT 'pending',
  -- pending | planned | assigned | loading | ready | dispatched | in_transit | delivered | failed | cancelled
  notes TEXT,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  UNIQUE(company_id, request_number)
);

CREATE INDEX IF NOT EXISTS idx_dsp_req_status ON dsp_requests(company_id, status) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS dsp_request_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  request_id UUID NOT NULL REFERENCES dsp_requests(id) ON DELETE CASCADE,
  product_name VARCHAR(200) NOT NULL,
  sku VARCHAR(80),
  quantity DECIMAL(14,3) DEFAULT 1,
  uom VARCHAR(20) DEFAULT 'ea',
  weight_kg DECIMAL(12,3) DEFAULT 0,
  carton_count INTEGER DEFAULT 0,
  qr_codes TEXT[],
  notes TEXT
);

-- ============================================================
-- ROUTES
-- ============================================================
CREATE TABLE IF NOT EXISTS dsp_routes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  route_number VARCHAR(40) NOT NULL,
  name VARCHAR(200) NOT NULL,
  vehicle_id UUID REFERENCES fleet_vehicles(id) ON DELETE SET NULL,
  driver_id UUID REFERENCES dsp_drivers(id) ON DELETE SET NULL,
  planned_date DATE DEFAULT CURRENT_DATE,
  status VARCHAR(30) DEFAULT 'draft',
  -- draft | optimized | assigned | in_progress | completed | cancelled
  total_stops INTEGER DEFAULT 0,
  total_distance_km DECIMAL(12,2) DEFAULT 0,
  estimated_duration_min INTEGER DEFAULT 0,
  estimated_fuel_l DECIMAL(12,2) DEFAULT 0,
  optimization_score INTEGER DEFAULT 0,
  route_polyline JSONB DEFAULT '[]'::jsonb,
  notes TEXT,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  UNIQUE(company_id, route_number)
);

CREATE TABLE IF NOT EXISTS dsp_route_stops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  route_id UUID NOT NULL REFERENCES dsp_routes(id) ON DELETE CASCADE,
  request_id UUID REFERENCES dsp_requests(id) ON DELETE SET NULL,
  dispatch_id UUID REFERENCES dispatches(id) ON DELETE SET NULL,
  sequence_no INTEGER DEFAULT 1,
  customer_name VARCHAR(200),
  address TEXT,
  lat NUMERIC(10,7),
  lng NUMERIC(10,7),
  planned_eta TIMESTAMPTZ,
  actual_arrival TIMESTAMPTZ,
  status VARCHAR(30) DEFAULT 'pending',
  -- pending | en_route | arrived | delivered | failed | skipped
  distance_from_prev_km DECIMAL(10,2) DEFAULT 0,
  notes TEXT
);

-- ============================================================
-- LOADING
-- ============================================================
CREATE TABLE IF NOT EXISTS dsp_loading_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  session_number VARCHAR(40) NOT NULL,
  request_id UUID REFERENCES dsp_requests(id) ON DELETE SET NULL,
  dispatch_id UUID REFERENCES dispatches(id) ON DELETE SET NULL,
  vehicle_id UUID REFERENCES fleet_vehicles(id) ON DELETE SET NULL,
  loading_bay VARCHAR(40),
  status VARCHAR(30) DEFAULT 'open',
  -- open | in_progress | verified | failed | completed
  expected_items INTEGER DEFAULT 0,
  scanned_items INTEGER DEFAULT 0,
  mismatch_count INTEGER DEFAULT 0,
  sealed BOOLEAN DEFAULT false,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  operator_id UUID REFERENCES user_profiles(id),
  notes TEXT
);

CREATE TABLE IF NOT EXISTS dsp_loading_scans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES dsp_loading_sessions(id) ON DELETE CASCADE,
  scan_value VARCHAR(200) NOT NULL,
  scan_type VARCHAR(30) DEFAULT 'qr',
  product_name VARCHAR(200),
  matched BOOLEAN DEFAULT true,
  scanned_by UUID REFERENCES user_profiles(id),
  scanned_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- GPS TRACKING POINTS
-- ============================================================
CREATE TABLE IF NOT EXISTS dsp_gps_points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  vehicle_id UUID REFERENCES fleet_vehicles(id) ON DELETE SET NULL,
  driver_id UUID REFERENCES dsp_drivers(id) ON DELETE SET NULL,
  route_id UUID REFERENCES dsp_routes(id) ON DELETE SET NULL,
  dispatch_id UUID REFERENCES dispatches(id) ON DELETE SET NULL,
  lat NUMERIC(10,7) NOT NULL,
  lng NUMERIC(10,7) NOT NULL,
  speed_kmh DECIMAL(8,2) DEFAULT 0,
  heading DECIMAL(6,2),
  accuracy_m DECIMAL(8,2),
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dsp_gps_vehicle ON dsp_gps_points(vehicle_id, recorded_at DESC);

-- ============================================================
-- PROOF OF DELIVERY
-- ============================================================
CREATE TABLE IF NOT EXISTS dsp_pods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  pod_number VARCHAR(40) NOT NULL,
  dispatch_id UUID REFERENCES dispatches(id) ON DELETE SET NULL,
  request_id UUID REFERENCES dsp_requests(id) ON DELETE SET NULL,
  route_stop_id UUID REFERENCES dsp_route_stops(id) ON DELETE SET NULL,
  customer_name VARCHAR(200),
  receiver_name VARCHAR(200),
  signature_data TEXT,
  photo_urls TEXT[],
  qr_scanned VARCHAR(120),
  barcode_scanned VARCHAR(120),
  lat NUMERIC(10,7),
  lng NUMERIC(10,7),
  delivered_qty DECIMAL(14,3) DEFAULT 0,
  damaged_qty DECIMAL(14,3) DEFAULT 0,
  notes TEXT,
  delivered_at TIMESTAMPTZ DEFAULT NOW(),
  driver_id UUID REFERENCES dsp_drivers(id),
  document_html TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, pod_number)
);

-- ============================================================
-- EXCEPTIONS · RETURNS
-- ============================================================
CREATE TABLE IF NOT EXISTS dsp_exceptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  exception_number VARCHAR(40) NOT NULL,
  exception_type VARCHAR(40) NOT NULL,
  -- partial | refused | damaged | lost | wrong_address | unavailable | breakdown | delayed
  dispatch_id UUID REFERENCES dispatches(id) ON DELETE SET NULL,
  request_id UUID REFERENCES dsp_requests(id) ON DELETE SET NULL,
  severity VARCHAR(20) DEFAULT 'medium',
  title TEXT NOT NULL,
  detail TEXT,
  status VARCHAR(30) DEFAULT 'open',
  -- open | investigating | resolved | closed
  service_desk_ticket_id UUID,
  created_by UUID REFERENCES user_profiles(id),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS dsp_returns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  return_number VARCHAR(40) NOT NULL,
  return_type VARCHAR(40) DEFAULT 'customer',
  -- customer | rejected | damaged | warranty | recall
  dispatch_id UUID REFERENCES dispatches(id) ON DELETE SET NULL,
  customer_name VARCHAR(200),
  reason TEXT,
  status VARCHAR(30) DEFAULT 'authorized',
  -- authorized | collected | inspecting | restocked | credited | closed
  inspection_notes TEXT,
  credit_note_ref VARCHAR(80),
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, return_number)
);

-- ============================================================
-- DOCUMENTS · NOTIFICATIONS · AI
-- ============================================================
CREATE TABLE IF NOT EXISTS dsp_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  doc_type VARCHAR(40) NOT NULL,
  -- dispatch_note | delivery_note | packing_list | manifest | bol | waybill | trip_sheet | customs
  doc_number VARCHAR(60) NOT NULL,
  dispatch_id UUID REFERENCES dispatches(id) ON DELETE SET NULL,
  request_id UUID REFERENCES dsp_requests(id) ON DELETE SET NULL,
  route_id UUID REFERENCES dsp_routes(id) ON DELETE SET NULL,
  title VARCHAR(200),
  html_body TEXT,
  qr_payload TEXT,
  watermark VARCHAR(80) DEFAULT 'AUTHENTIC',
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS dsp_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  channel VARCHAR(30) DEFAULT 'email',
  -- email | sms | whatsapp | push | teams | slack
  event_type VARCHAR(60) NOT NULL,
  recipient VARCHAR(200),
  subject TEXT,
  body TEXT,
  status VARCHAR(30) DEFAULT 'queued',
  related_type VARCHAR(40),
  related_id UUID,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS dsp_ai_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  insight_type VARCHAR(60) NOT NULL,
  severity VARCHAR(20) DEFAULT 'info',
  title TEXT NOT NULL,
  detail TEXT,
  actions JSONB DEFAULT '[]',
  status VARCHAR(30) DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS dsp_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES user_profiles(id),
  action VARCHAR(80) NOT NULL,
  entity_type VARCHAR(60),
  entity_id UUID,
  details TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS dsp_loading_bays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  bay_code VARCHAR(40) NOT NULL,
  name VARCHAR(100) NOT NULL,
  warehouse_name VARCHAR(150) DEFAULT 'Kampala Main',
  status VARCHAR(30) DEFAULT 'available',
  -- available | occupied | reserved | maintenance
  current_vehicle_id UUID REFERENCES fleet_vehicles(id) ON DELETE SET NULL,
  is_active BOOLEAN DEFAULT true,
  UNIQUE(company_id, bay_code)
);

-- ============================================================
-- RLS
-- ============================================================
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'dsp_drivers','dsp_requests','dsp_request_lines','dsp_routes','dsp_route_stops',
    'dsp_loading_sessions','dsp_loading_scans','dsp_gps_points','dsp_pods',
    'dsp_exceptions','dsp_returns','dsp_documents','dsp_notifications',
    'dsp_ai_insights','dsp_audit_log','dsp_loading_bays'
  ]
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t || '_all', t);
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR ALL USING (company_id = user_company_id()) WITH CHECK (company_id = user_company_id())',
      t || '_all', t
    );
  END LOOP;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- ============================================================
-- SEED
-- ============================================================
DO $$
DECLARE
  cid UUID;
  vid UUID;
  did UUID;
  rid UUID;
  reqid UUID;
BEGIN
  SELECT id INTO cid FROM companies ORDER BY created_at LIMIT 1;
  IF cid IS NULL THEN RETURN; END IF;

  -- Drivers
  INSERT INTO dsp_drivers (company_id, driver_code, full_name, phone, license_number, license_expiry, safety_score, status)
  VALUES
    (cid, 'DRV-001', 'James Okello', '+256700111001', 'UG-DL-88901', CURRENT_DATE + 400, 96, 'available'),
    (cid, 'DRV-002', 'Sarah Nambi', '+256700111002', 'UG-DL-77220', CURRENT_DATE + 200, 92, 'available'),
    (cid, 'DRV-003', 'Peter Mukasa', '+256700111003', 'UG-DL-66110', CURRENT_DATE + 90, 88, 'on_trip')
  ON CONFLICT (company_id, driver_code) DO NOTHING;

  SELECT id INTO did FROM dsp_drivers WHERE company_id = cid AND driver_code = 'DRV-001';
  SELECT id INTO vid FROM fleet_vehicles WHERE company_id = cid ORDER BY created_at LIMIT 1;

  IF vid IS NOT NULL AND did IS NOT NULL THEN
    UPDATE dsp_drivers SET assigned_vehicle_id = vid WHERE id = did;
    UPDATE fleet_vehicles SET
      assigned_driver_name = 'James Okello',
      gps_tracker_id = COALESCE(gps_tracker_id, 'GPS-HDG-001'),
      current_lat = COALESCE(current_lat, 0.3476),
      current_lng = COALESCE(current_lng, 32.5825),
      last_gps_at = NOW()
    WHERE id = vid;
  END IF;

  -- Ensure a few fleet vehicles if empty
  IF NOT EXISTS (SELECT 1 FROM fleet_vehicles WHERE company_id = cid) THEN
    INSERT INTO fleet_vehicles (company_id, registration, make, model, vehicle_type, capacity_kg, fuel_type, status, assigned_driver_name, gps_tracker_id, current_lat, current_lng)
    VALUES
      (cid, 'UBA 450B', 'Isuzu', 'FVR', 'truck', 8000, 'diesel', 'available', 'James Okello', 'GPS-HDG-001', 0.3476, 32.5825),
      (cid, 'UBE 221C', 'Toyota', 'Hiace', 'van', 1500, 'diesel', 'available', 'Sarah Nambi', 'GPS-HDG-002', 0.3510, 32.5900),
      (cid, 'UAX 90D', 'Bajaj', 'Boxer', 'motorcycle', 80, 'petrol', 'available', NULL, 'GPS-HDG-003', 0.3400, 32.5700);
    SELECT id INTO vid FROM fleet_vehicles WHERE company_id = cid AND registration = 'UBA 450B';
  END IF;

  INSERT INTO dsp_loading_bays (company_id, bay_code, name, status)
  VALUES
    (cid, 'BAY-A1', 'Bay A1 — Main Dock', 'available'),
    (cid, 'BAY-A2', 'Bay A2 — Express', 'available'),
    (cid, 'BAY-B1', 'Bay B1 — Pallets', 'available')
  ON CONFLICT (company_id, bay_code) DO NOTHING;

  IF NOT EXISTS (SELECT 1 FROM dsp_requests WHERE company_id = cid) THEN
    INSERT INTO dsp_requests (
      company_id, request_number, source_type, source_ref, customer_name, warehouse_name,
      delivery_address, priority, delivery_type, delivery_date, weight_kg, volume_m3,
      required_vehicle_type, status, notes
    ) VALUES
      (cid, 'DRQ-00001', 'sales_order', 'SO-2026-0142', 'Hope Retail Kampala', 'Kampala Main',
       'Plot 12 Kampala Road, Kampala', 'high', 'same_day', CURRENT_DATE, 420, 2.1, 'truck', 'pending', 'A4 reams — 20 cartons'),
      (cid, 'DRQ-00002', 'sales_order', 'SO-2026-0155', 'Entebbe Stationery', 'Kampala Main',
       'Airport Road, Entebbe', 'normal', 'scheduled', CURRENT_DATE + 1, 180, 0.9, 'van', 'planned', NULL),
      (cid, 'DRQ-00003', 'transfer', 'TRF-88', 'Jinja Branch WH', 'Kampala Main',
       'Main Street, Jinja', 'normal', 'scheduled', CURRENT_DATE + 2, 900, 4.5, 'truck', 'assigned', 'Inter-branch stock');

    SELECT id INTO reqid FROM dsp_requests WHERE company_id = cid AND request_number = 'DRQ-00001';
    INSERT INTO dsp_request_lines (company_id, request_id, product_name, sku, quantity, uom, weight_kg, carton_count)
    VALUES
      (cid, reqid, 'Hope A4 80gsm Ream', 'A4-80', 100, 'ream', 250, 20),
      (cid, reqid, 'Hope A4 70gsm Ream', 'A4-70', 50, 'ream', 120, 10);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM dsp_routes WHERE company_id = cid) THEN
    INSERT INTO dsp_routes (
      company_id, route_number, name, vehicle_id, driver_id, planned_date, status,
      total_stops, total_distance_km, estimated_duration_min, estimated_fuel_l, optimization_score
    ) VALUES (
      cid, 'RTE-00001', 'Kampala Metro AM', vid, did, CURRENT_DATE, 'optimized',
      3, 48.5, 120, 12.5, 87
    ) RETURNING id INTO rid;

    INSERT INTO dsp_route_stops (company_id, route_id, sequence_no, customer_name, address, lat, lng, status, distance_from_prev_km)
    VALUES
      (cid, rid, 1, 'Hope Retail Kampala', 'Plot 12 Kampala Road', 0.3136, 32.5811, 'pending', 5.2),
      (cid, rid, 2, 'Nakawa Distributors', 'Industrial Area', 0.3270, 32.6150, 'pending', 8.1),
      (cid, rid, 3, 'Makerere Bookshop', 'Makerere Hill', 0.3330, 32.5670, 'pending', 6.4);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM dsp_gps_points WHERE company_id = cid) AND vid IS NOT NULL THEN
    INSERT INTO dsp_gps_points (company_id, vehicle_id, driver_id, lat, lng, speed_kmh, recorded_at)
    VALUES
      (cid, vid, did, 0.3476, 32.5825, 0, NOW() - INTERVAL '30 minutes'),
      (cid, vid, did, 0.3400, 32.5800, 35, NOW() - INTERVAL '15 minutes'),
      (cid, vid, did, 0.3350, 32.5780, 28, NOW() - INTERVAL '5 minutes');
  END IF;

  INSERT INTO dsp_ai_insights (company_id, insight_type, severity, title, detail, actions)
  SELECT cid, 'delay', 'medium', 'Afternoon congestion on Kampala Road',
    'ETA risk +25 min for same-day metro stops. Prefer Northern bypass for stop 2.',
    '["Reroute","Notify customer"]'::jsonb
  WHERE NOT EXISTS (SELECT 1 FROM dsp_ai_insights WHERE company_id = cid LIMIT 1);

  INSERT INTO dsp_ai_insights (company_id, insight_type, severity, title, detail, actions)
  VALUES
    (cid, 'fleet', 'info', 'Van utilization low', 'Hiace UBE 221C idle — assign Entebbe SO-2026-0155.', '["Assign vehicle","Open request"]'::jsonb),
    (cid, 'maintenance', 'low', 'Service due soon', 'Truck approaching next service odometer — schedule PM.', '["Fleet maintenance"]'::jsonb);
END $$;
