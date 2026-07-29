-- Hope SecureTrack ERP — Enterprise Workforce Attendance Platform
-- Geofence · GPS · Wi-Fi · BLE · QR · NFC · RFID · Biometric terminals · Policies

-- Extend legacy attendance_records
ALTER TABLE attendance_records
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS location_id UUID,
  ADD COLUMN IF NOT EXISTS location_name VARCHAR(200),
  ADD COLUMN IF NOT EXISTS verification_method VARCHAR(40) DEFAULT 'web',
  ADD COLUMN IF NOT EXISTS gps_accuracy_m DECIMAL(8,2),
  ADD COLUMN IF NOT EXISTS wifi_ssid VARCHAR(120),
  ADD COLUMN IF NOT EXISTS wifi_bssid VARCHAR(40),
  ADD COLUMN IF NOT EXISTS beacon_id VARCHAR(80),
  ADD COLUMN IF NOT EXISTS device_id UUID,
  ADD COLUMN IF NOT EXISTS qr_token VARCHAR(120),
  ADD COLUMN IF NOT EXISTS nfc_tag VARCHAR(80),
  ADD COLUMN IF NOT EXISTS verification_score DECIMAL(5,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS fraud_flags JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS is_field_work BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS project_code VARCHAR(50),
  ADD COLUMN IF NOT EXISTS work_order_ref VARCHAR(80),
  ADD COLUMN IF NOT EXISTS photo_url TEXT,
  ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES user_profiles(id),
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS hours_worked DECIMAL(8,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES user_profiles(id);

ALTER TABLE shift_templates
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS grace_minutes INTEGER DEFAULT 10,
  ADD COLUMN IF NOT EXISTS core_start TIME,
  ADD COLUMN IF NOT EXISTS core_end TIME;

ALTER TABLE shift_assignments
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- ============================================================
-- LOCATIONS & GEOFENCES
-- ============================================================
CREATE TABLE IF NOT EXISTS att_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  location_code VARCHAR(50) NOT NULL,
  name VARCHAR(200) NOT NULL,
  location_type VARCHAR(40) DEFAULT 'branch',
  -- hq|branch|factory|warehouse|project_site|customer_site|temporary
  branch_name VARCHAR(150),
  building VARCHAR(150),
  department_name VARCHAR(150),
  address TEXT,
  lat NUMERIC(10,7) NOT NULL,
  lng NUMERIC(10,7) NOT NULL,
  radius_m INTEGER DEFAULT 100,
  wifi_ssids TEXT DEFAULT '',
  wifi_bssids TEXT DEFAULT '',
  beacon_ids TEXT DEFAULT '',
  nfc_checkpoints TEXT DEFAULT '',
  qr_checkpoint_ids TEXT DEFAULT '',
  active_from TIME DEFAULT '00:00',
  active_to TIME DEFAULT '23:59',
  owner_name VARCHAR(150),
  require_gps BOOLEAN DEFAULT true,
  require_wifi BOOLEAN DEFAULT false,
  require_beacon BOOLEAN DEFAULT false,
  require_qr BOOLEAN DEFAULT false,
  require_nfc BOOLEAN DEFAULT false,
  require_biometric BOOLEAN DEFAULT false,
  max_gps_accuracy_m DECIMAL(8,2) DEFAULT 25,
  allow_field_exception BOOLEAN DEFAULT false,
  status VARCHAR(30) DEFAULT 'active',
  notes TEXT,
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, location_code)
);

CREATE TABLE IF NOT EXISTS att_geofences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  fence_code VARCHAR(50) NOT NULL,
  name VARCHAR(200) NOT NULL,
  location_id UUID REFERENCES att_locations(id) ON DELETE SET NULL,
  location_code VARCHAR(50),
  center_lat NUMERIC(10,7) NOT NULL,
  center_lng NUMERIC(10,7) NOT NULL,
  radius_m INTEGER DEFAULT 100,
  status VARCHAR(30) DEFAULT 'active',
  notes TEXT,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, fence_code)
);

-- ============================================================
-- DEVICES / TERMINALS
-- ============================================================
CREATE TABLE IF NOT EXISTS att_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  device_code VARCHAR(50) NOT NULL,
  name VARCHAR(200) NOT NULL,
  vendor VARCHAR(60) DEFAULT 'generic',
  -- zkteco|suprema|hikvision|dahua|anviz|fingertec|essl|idemia|hid|biotime|generic
  model VARCHAR(100),
  firmware VARCHAR(60),
  serial_number VARCHAR(100),
  ip_address VARCHAR(60),
  mac_address VARCHAR(40),
  branch_name VARCHAR(150),
  building VARCHAR(150),
  department_name VARCHAR(150),
  door_gate VARCHAR(100),
  location_id UUID REFERENCES att_locations(id) ON DELETE SET NULL,
  status VARCHAR(30) DEFAULT 'offline',
  -- online|offline|error|maintenance
  last_sync_at TIMESTAMPTZ,
  last_heartbeat_at TIMESTAMPTZ,
  last_attendance_at TIMESTAMPTZ,
  battery_pct INTEGER,
  power_status VARCHAR(40) DEFAULT 'ac',
  sync_errors INTEGER DEFAULT 0,
  notes TEXT,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, device_code)
);

CREATE TABLE IF NOT EXISTS att_device_sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  device_id UUID REFERENCES att_devices(id) ON DELETE SET NULL,
  device_code VARCHAR(50),
  sync_type VARCHAR(40) DEFAULT 'attendance',
  -- attendance|users|templates|config|heartbeat
  direction VARCHAR(20) DEFAULT 'pull',
  records_count INTEGER DEFAULT 0,
  status VARCHAR(30) DEFAULT 'success',
  message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- EVENTS (raw clock punches)
-- ============================================================
CREATE TABLE IF NOT EXISTS att_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  event_code VARCHAR(50) NOT NULL,
  employee_id UUID REFERENCES employees(id) ON DELETE SET NULL,
  employee_name VARCHAR(200),
  employee_number VARCHAR(50),
  event_type VARCHAR(20) NOT NULL DEFAULT 'clock_in',
  -- clock_in|clock_out|break_start|break_end
  event_at TIMESTAMPTZ DEFAULT NOW(),
  work_date DATE DEFAULT CURRENT_DATE,
  location_id UUID REFERENCES att_locations(id) ON DELETE SET NULL,
  location_name VARCHAR(200),
  method VARCHAR(40) DEFAULT 'app',
  -- app|web|gps|wifi|beacon|qr|nfc|rfid|biometric|terminal|manual
  lat NUMERIC(10,7),
  lng NUMERIC(10,7),
  gps_accuracy_m DECIMAL(8,2),
  distance_m DECIMAL(10,2),
  wifi_ssid VARCHAR(120),
  wifi_bssid VARCHAR(40),
  beacon_id VARCHAR(80),
  qr_token VARCHAR(120),
  nfc_tag VARCHAR(80),
  rfid_badge VARCHAR(80),
  device_code VARCHAR(50),
  verification_status VARCHAR(30) DEFAULT 'pending',
  -- pending|approved|rejected|flagged
  reject_reason TEXT,
  fraud_flags JSONB DEFAULT '[]'::jsonb,
  shift_code VARCHAR(50),
  project_code VARCHAR(50),
  work_order_ref VARCHAR(80),
  is_field_work BOOLEAN DEFAULT false,
  photo_url TEXT,
  attendance_record_id UUID,
  status VARCHAR(30) DEFAULT 'recorded',
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, event_code)
);

CREATE INDEX IF NOT EXISTS idx_att_events_emp ON att_events(company_id, employee_id, event_at DESC);
CREATE INDEX IF NOT EXISTS idx_att_events_date ON att_events(company_id, work_date DESC);

-- ============================================================
-- POLICIES / SHIFTS / BREAKS / HOLIDAYS
-- ============================================================
CREATE TABLE IF NOT EXISTS att_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  policy_code VARCHAR(50) NOT NULL,
  name VARCHAR(200) NOT NULL,
  grace_minutes INTEGER DEFAULT 10,
  flexible_hours BOOLEAN DEFAULT false,
  core_start TIME,
  core_end TIME,
  max_late_minutes INTEGER DEFAULT 60,
  overtime_threshold_hours DECIMAL(5,2) DEFAULT 8,
  require_geofence BOOLEAN DEFAULT true,
  max_gps_accuracy_m DECIMAL(8,2) DEFAULT 25,
  allow_remote BOOLEAN DEFAULT false,
  allow_field BOOLEAN DEFAULT false,
  require_photo_field BOOLEAN DEFAULT false,
  block_mock_gps BOOLEAN DEFAULT true,
  block_rooted BOOLEAN DEFAULT false,
  assignment_scope VARCHAR(40) DEFAULT 'company',
  -- company|branch|department|position|shift|employee
  scope_value VARCHAR(150),
  status VARCHAR(30) DEFAULT 'active',
  rules_json JSONB DEFAULT '{}'::jsonb,
  notes TEXT,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, policy_code)
);

CREATE TABLE IF NOT EXISTS att_shift_rotations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  rotation_code VARCHAR(50) NOT NULL,
  name VARCHAR(200) NOT NULL,
  cycle_days INTEGER DEFAULT 7,
  pattern_json JSONB DEFAULT '[]'::jsonb,
  status VARCHAR(30) DEFAULT 'active',
  notes TEXT,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, rotation_code)
);

CREATE TABLE IF NOT EXISTS att_shift_swaps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  swap_number VARCHAR(50) NOT NULL,
  requester_name VARCHAR(200),
  partner_name VARCHAR(200),
  work_date DATE,
  shift_code VARCHAR(50),
  status VARCHAR(30) DEFAULT 'pending',
  -- pending|approved|rejected|cancelled
  reason TEXT,
  approved_by UUID REFERENCES user_profiles(id),
  approved_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, swap_number)
);

CREATE TABLE IF NOT EXISTS att_breaks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  break_code VARCHAR(50) NOT NULL,
  name VARCHAR(150) NOT NULL,
  duration_minutes INTEGER DEFAULT 30,
  is_paid BOOLEAN DEFAULT false,
  status VARCHAR(30) DEFAULT 'active',
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, break_code)
);

CREATE TABLE IF NOT EXISTS att_holidays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  holiday_code VARCHAR(50) NOT NULL,
  name VARCHAR(200) NOT NULL,
  holiday_date DATE NOT NULL,
  is_paid BOOLEAN DEFAULT true,
  status VARCHAR(30) DEFAULT 'active',
  notes TEXT,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, holiday_code)
);

CREATE TABLE IF NOT EXISTS att_corrections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  correction_number VARCHAR(50) NOT NULL,
  employee_name VARCHAR(200),
  employee_id UUID REFERENCES employees(id) ON DELETE SET NULL,
  work_date DATE NOT NULL,
  original_check_in TIMESTAMPTZ,
  original_check_out TIMESTAMPTZ,
  requested_check_in TIMESTAMPTZ,
  requested_check_out TIMESTAMPTZ,
  reason TEXT,
  status VARCHAR(30) DEFAULT 'pending',
  -- pending|approved|rejected
  approved_by UUID REFERENCES user_profiles(id),
  approved_at TIMESTAMPTZ,
  digital_signature TEXT,
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, correction_number)
);

CREATE TABLE IF NOT EXISTS att_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  approval_number VARCHAR(50) NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_id UUID,
  entity_code VARCHAR(80),
  title VARCHAR(255) NOT NULL,
  status VARCHAR(30) DEFAULT 'pending',
  requested_by UUID REFERENCES user_profiles(id),
  approver_id UUID REFERENCES user_profiles(id),
  decision_notes TEXT,
  decided_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, approval_number)
);

CREATE TABLE IF NOT EXISTS att_qr_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  token_code VARCHAR(80) NOT NULL,
  location_id UUID REFERENCES att_locations(id) ON DELETE CASCADE,
  location_code VARCHAR(50),
  valid_from TIMESTAMPTZ DEFAULT NOW(),
  valid_until TIMESTAMPTZ NOT NULL,
  max_uses INTEGER DEFAULT 0,
  use_count INTEGER DEFAULT 0,
  status VARCHAR(30) DEFAULT 'active',
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, token_code)
);

CREATE TABLE IF NOT EXISTS att_beacons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  beacon_code VARCHAR(50) NOT NULL,
  uuid_value VARCHAR(80),
  major_id INTEGER,
  minor_id INTEGER,
  location_id UUID REFERENCES att_locations(id) ON DELETE SET NULL,
  location_name VARCHAR(200),
  status VARCHAR(30) DEFAULT 'active',
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, beacon_code)
);

CREATE TABLE IF NOT EXISTS att_nfc_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  tag_code VARCHAR(50) NOT NULL,
  tag_uid VARCHAR(80) NOT NULL,
  location_id UUID REFERENCES att_locations(id) ON DELETE SET NULL,
  location_name VARCHAR(200),
  status VARCHAR(30) DEFAULT 'active',
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, tag_code)
);

CREATE TABLE IF NOT EXISTS att_rfid_badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  badge_code VARCHAR(50) NOT NULL,
  rfid_uid VARCHAR(80) NOT NULL,
  employee_id UUID REFERENCES employees(id) ON DELETE SET NULL,
  employee_name VARCHAR(200),
  status VARCHAR(30) DEFAULT 'active',
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, badge_code)
);

CREATE TABLE IF NOT EXISTS att_remote_work (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  request_number VARCHAR(50) NOT NULL,
  employee_name VARCHAR(200),
  employee_id UUID REFERENCES employees(id) ON DELETE SET NULL,
  work_date DATE,
  reason TEXT,
  status VARCHAR(30) DEFAULT 'pending',
  approved_by UUID REFERENCES user_profiles(id),
  approved_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, request_number)
);

CREATE TABLE IF NOT EXISTS att_field_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  assignment_code VARCHAR(50) NOT NULL,
  employee_name VARCHAR(200),
  employee_id UUID REFERENCES employees(id) ON DELETE SET NULL,
  project_code VARCHAR(50),
  work_order_ref VARCHAR(80),
  customer_name VARCHAR(200),
  site_lat NUMERIC(10,7),
  site_lng NUMERIC(10,7),
  radius_m INTEGER DEFAULT 200,
  start_date DATE,
  end_date DATE,
  status VARCHAR(30) DEFAULT 'active',
  notes TEXT,
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, assignment_code)
);

CREATE TABLE IF NOT EXISTS att_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  body TEXT,
  severity VARCHAR(20) DEFAULT 'info',
  category VARCHAR(60) DEFAULT 'general',
  employee_name VARCHAR(200),
  is_read BOOLEAN DEFAULT false,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS att_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  setting_key VARCHAR(100) NOT NULL,
  setting_value JSONB DEFAULT 'null'::jsonb,
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, setting_key)
);

CREATE TABLE IF NOT EXISTS att_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES user_profiles(id),
  action VARCHAR(80) NOT NULL,
  entity_type VARCHAR(80),
  entity_id UUID,
  details TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS att_ai_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  insight_type VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  summary TEXT NOT NULL,
  severity VARCHAR(20) DEFAULT 'info',
  score DECIMAL(5,2),
  recommendations JSONB DEFAULT '[]'::jsonb,
  status VARCHAR(30) DEFAULT 'open',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS att_violations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  violation_code VARCHAR(50) NOT NULL,
  employee_name VARCHAR(200),
  violation_type VARCHAR(60) NOT NULL,
  -- outside_geofence|mock_gps|duplicate|buddy_punch|time_tamper|impossible_travel
  event_at TIMESTAMPTZ DEFAULT NOW(),
  details TEXT,
  severity VARCHAR(20) DEFAULT 'medium',
  status VARCHAR(30) DEFAULT 'open',
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, violation_code)
);

-- ============================================================
-- PERMISSIONS
-- ============================================================
INSERT INTO permissions (name, slug, module, description)
SELECT v.name, v.slug, v.module, v.description
FROM (VALUES
  ('View Attendance Platform', 'att.view', 'attendance', 'View workforce attendance'),
  ('Manage Attendance Platform', 'att.manage', 'attendance', 'Manage attendance config'),
  ('Attendance Clock', 'att.clock', 'attendance', 'Clock in/out'),
  ('Attendance Approve', 'att.approve', 'attendance', 'Approve corrections'),
  ('Attendance Devices', 'att.devices', 'attendance', 'Biometric terminals'),
  ('Attendance Field', 'att.field', 'attendance', 'Field workforce clock'),
  ('Attendance AI', 'att.ai', 'attendance', 'AI attendance insights'),
  ('Attendance Admin', 'att.admin', 'attendance', 'Full attendance admin')
) AS v(name, slug, module, description)
WHERE NOT EXISTS (SELECT 1 FROM permissions p WHERE p.slug = v.slug OR p.name = v.name);

INSERT INTO role_permissions (role_id, permission_id)
SELECT 'e0000000-0000-4000-8000-000000000001', id FROM permissions
WHERE slug LIKE 'att.%'
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE p.slug LIKE 'att.%'
  AND r.slug IN (
    'super_administrator','managing_director','operations_manager',
    'hr_manager','auditor'
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
    'att_locations','att_geofences','att_devices','att_device_sync_logs','att_events',
    'att_policies','att_shift_rotations','att_shift_swaps','att_breaks','att_holidays',
    'att_corrections','att_approvals','att_qr_tokens','att_beacons','att_nfc_tags',
    'att_rfid_badges','att_remote_work','att_field_assignments','att_notifications',
    'att_settings','att_audit_log','att_ai_insights','att_violations'
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

-- ============================================================
-- SEED
-- ============================================================
DO $$
DECLARE
  cid UUID := 'a0000000-0000-4000-8000-000000000001';
  loc UUID;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM companies WHERE id = cid) THEN
    SELECT id INTO cid FROM companies LIMIT 1;
  END IF;
  IF cid IS NULL THEN RETURN; END IF;

  INSERT INTO att_locations (
    company_id, location_code, name, location_type, branch_name, building,
    lat, lng, radius_m, wifi_ssids, require_gps, require_wifi, max_gps_accuracy_m, status, owner_name
  ) VALUES
    (cid, 'LOC-HQ', 'Headquarters Main Gate', 'hq', 'Head Office', 'Building A',
     0.3476, 32.5825, 80, 'HOPE-CORP,HOPE-GUEST', true, false, 25, 'active', 'Facilities'),
    (cid, 'LOC-FACTORY', 'Secure Print Plant', 'factory', 'Production', 'Plant 1',
     0.3136, 32.5811, 120, 'HOPE-PLANT', true, true, 20, 'active', 'Plant Manager'),
    (cid, 'LOC-WH', 'Main Warehouse', 'warehouse', 'Logistics', 'WH-01',
     0.3200, 32.5900, 100, 'HOPE-WH', true, false, 25, 'active', 'Warehouse Lead')
  ON CONFLICT (company_id, location_code) DO NOTHING;

  SELECT id INTO loc FROM att_locations WHERE company_id = cid AND location_code = 'LOC-HQ' LIMIT 1;

  INSERT INTO att_geofences (company_id, fence_code, name, location_id, location_code, center_lat, center_lng, radius_m, status)
  SELECT cid, 'GF-' || location_code, name || ' Fence', id, location_code, lat, lng, radius_m, 'active'
  FROM att_locations WHERE company_id = cid
  ON CONFLICT (company_id, fence_code) DO NOTHING;

  INSERT INTO att_devices (company_id, device_code, name, vendor, model, branch_name, building, door_gate, location_id, status, firmware)
  VALUES
    (cid, 'DEV-ZK-01', 'HQ Entrance Terminal', 'zkteco', 'SpeedFace-V5L', 'Head Office', 'Building A', 'Main Gate', loc, 'online', '1.2.0'),
    (cid, 'DEV-SP-01', 'Plant Biometric Reader', 'suprema', 'BioStation 3', 'Production', 'Plant 1', 'Staff Entry', NULL, 'online', '2.1.4')
  ON CONFLICT (company_id, device_code) DO NOTHING;

  INSERT INTO att_policies (company_id, policy_code, name, grace_minutes, require_geofence, max_gps_accuracy_m, overtime_threshold_hours, status)
  VALUES
    (cid, 'POL-STD', 'Standard Office Policy', 10, true, 25, 8, 'active'),
    (cid, 'POL-FIELD', 'Field Workforce Policy', 15, false, 50, 9, 'active'),
    (cid, 'POL-SHIFT', 'Shift Plant Policy', 5, true, 20, 8, 'active')
  ON CONFLICT (company_id, policy_code) DO NOTHING;

  INSERT INTO att_breaks (company_id, break_code, name, duration_minutes, is_paid, status) VALUES
    (cid, 'BRK-LUNCH', 'Lunch Break', 60, false, 'active'),
    (cid, 'BRK-TEA', 'Tea Break', 15, true, 'active')
  ON CONFLICT (company_id, break_code) DO NOTHING;

  INSERT INTO att_settings (company_id, setting_key, setting_value, description) VALUES
    (cid, 'require_geofence_default', 'true', 'Default geofence enforcement'),
    (cid, 'max_gps_accuracy_m', '25', 'Max acceptable GPS accuracy meters'),
    (cid, 'block_mock_gps', 'true', 'Reject mock location providers'),
    (cid, 'qr_token_ttl_seconds', '60', 'Rotating QR validity window'),
    (cid, 'duplicate_window_minutes', '2', 'Ignore duplicate punches within window'),
    (cid, 'payroll_auto_sync', 'true', 'Push hours to payroll automatically')
  ON CONFLICT (company_id, setting_key) DO NOTHING;

  INSERT INTO att_ai_insights (company_id, insight_type, title, summary, severity, score, recommendations)
  SELECT cid, v.t, v.title, v.sum, v.sev, v.sc, v.rec::jsonb
  FROM (VALUES
    ('fraud', 'Possible buddy-punch pattern near Plant Gate',
     'Two employees share identical terminal timestamps within 3 seconds across 5 days.',
     'warning', 78.0,
     '["Review biometric logs","Enforce face anti-spoof","Interview supervisors"]'),
    ('late', 'Late arrivals rising on morning shift',
     'Average late minutes up 22% week-over-week on MORNING shift.',
     'info', 64.0,
     '["Review transport routes","Adjust grace policy temporarily"]'),
    ('device', 'Warehouse terminal offline > 4 hours',
     'DEV device heartbeat missing - attendance may backlog offline.',
     'critical', 88.0,
     '["Dispatch facilities","Enable mobile geofence fallback"]')
  ) AS v(t, title, sum, sev, sc, rec)
  WHERE NOT EXISTS (SELECT 1 FROM att_ai_insights WHERE company_id = cid LIMIT 1);

END $$;
