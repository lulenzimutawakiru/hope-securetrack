-- Hope SecureTrack — Hikvision & ZKTeco attendance machine integration
-- Push webhooks · ADMS/ICLOCK · ISAPI events · punch queue · user mapping

-- ============================================================
-- EXTEND DEVICE REGISTRY
-- ============================================================
ALTER TABLE att_devices
  ADD COLUMN IF NOT EXISTS protocol VARCHAR(40) DEFAULT 'push',
  -- push|pull|adms|iclock|isapi|sdk|generic
  ADD COLUMN IF NOT EXISTS port INTEGER DEFAULT 4370,
  ADD COLUMN IF NOT EXISTS username VARCHAR(100),
  ADD COLUMN IF NOT EXISTS password_hint VARCHAR(100),
  ADD COLUMN IF NOT EXISTS api_key VARCHAR(120),
  ADD COLUMN IF NOT EXISTS shared_secret VARCHAR(120),
  ADD COLUMN IF NOT EXISTS push_enabled BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS pull_enabled BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS timezone VARCHAR(60) DEFAULT 'Africa/Kampala',
  ADD COLUMN IF NOT EXISTS webhook_path VARCHAR(120),
  ADD COLUMN IF NOT EXISTS last_error TEXT,
  ADD COLUMN IF NOT EXISTS total_punches INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS config_json JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES user_profiles(id);

-- ============================================================
-- EMPLOYEE ↔ DEVICE USER MAPPING
-- ============================================================
CREATE TABLE IF NOT EXISTS att_device_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  mapping_code VARCHAR(50) NOT NULL,
  device_id UUID REFERENCES att_devices(id) ON DELETE SET NULL,
  device_code VARCHAR(50),
  vendor VARCHAR(40) DEFAULT 'zkteco',
  -- zkteco|hikvision
  employee_id UUID REFERENCES employees(id) ON DELETE SET NULL,
  employee_number VARCHAR(50),
  employee_name VARCHAR(200),
  device_user_id VARCHAR(80) NOT NULL,
  -- PIN / user ID on the terminal
  card_number VARCHAR(80),
  fingerprint_enrolled BOOLEAN DEFAULT false,
  face_enrolled BOOLEAN DEFAULT false,
  status VARCHAR(30) DEFAULT 'active',
  notes TEXT,
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, mapping_code),
  UNIQUE(company_id, vendor, device_user_id)
);

CREATE INDEX IF NOT EXISTS idx_att_device_users_lookup
  ON att_device_users(company_id, vendor, device_user_id)
  WHERE deleted_at IS NULL;

-- ============================================================
-- RAW PUNCH QUEUE (from machines before / after processing)
-- ============================================================
CREATE TABLE IF NOT EXISTS att_device_punches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  punch_code VARCHAR(50) NOT NULL,
  device_id UUID REFERENCES att_devices(id) ON DELETE SET NULL,
  device_code VARCHAR(50),
  vendor VARCHAR(40) NOT NULL DEFAULT 'zkteco',
  -- zkteco|hikvision|generic
  device_user_id VARCHAR(80),
  employee_id UUID REFERENCES employees(id) ON DELETE SET NULL,
  employee_number VARCHAR(50),
  employee_name VARCHAR(200),
  punch_time TIMESTAMPTZ NOT NULL,
  punch_type VARCHAR(20) DEFAULT 'auto',
  -- auto|clock_in|clock_out|break_start|break_end|check
  verify_mode VARCHAR(40) DEFAULT 'fingerprint',
  -- fingerprint|face|card|password|qr|palm|vein|multi
  raw_payload JSONB DEFAULT '{}'::jsonb,
  external_id VARCHAR(120),
  -- device log id for idempotency
  process_status VARCHAR(30) DEFAULT 'pending',
  -- pending|processed|duplicate|failed|ignored
  process_error TEXT,
  att_event_id UUID,
  processed_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, punch_code)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_att_device_punches_ext
  ON att_device_punches(company_id, vendor, external_id)
  WHERE external_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_att_device_punches_pending
  ON att_device_punches(company_id, process_status, punch_time)
  WHERE deleted_at IS NULL;

-- ============================================================
-- COMPANY INTEGRATION SETTINGS
-- ============================================================
CREATE TABLE IF NOT EXISTS att_device_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  integration_code VARCHAR(50) NOT NULL,
  vendor VARCHAR(40) NOT NULL,
  -- zkteco|hikvision
  name VARCHAR(150) NOT NULL,
  enabled BOOLEAN DEFAULT true,
  push_token VARCHAR(120) NOT NULL,
  -- shared secret for device webhooks
  auto_process BOOLEAN DEFAULT true,
  auto_clock_pair BOOLEAN DEFAULT true,
  -- auto decide in/out from last event
  default_location_id UUID REFERENCES att_locations(id) ON DELETE SET NULL,
  default_location_name VARCHAR(200),
  timezone VARCHAR(60) DEFAULT 'Africa/Kampala',
  callback_base_url TEXT,
  notes TEXT,
  status VARCHAR(30) DEFAULT 'active',
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, integration_code),
  UNIQUE(company_id, vendor)
);

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE att_device_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE att_device_punches ENABLE ROW LEVEL SECURITY;
ALTER TABLE att_device_integrations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS att_device_users_all ON att_device_users;
CREATE POLICY att_device_users_all ON att_device_users FOR ALL
  USING (company_id = public.user_company_id())
  WITH CHECK (company_id = public.user_company_id());

DROP POLICY IF EXISTS att_device_punches_all ON att_device_punches;
CREATE POLICY att_device_punches_all ON att_device_punches FOR ALL
  USING (company_id = public.user_company_id())
  WITH CHECK (company_id = public.user_company_id());

DROP POLICY IF EXISTS att_device_integrations_all ON att_device_integrations;
CREATE POLICY att_device_integrations_all ON att_device_integrations FOR ALL
  USING (company_id = public.user_company_id())
  WITH CHECK (company_id = public.user_company_id());

-- Service-role / anon push endpoints use service key or token validation in API layer.
-- Allow insert for punches via service role only (no broad anon policy).

-- ============================================================
-- SEED integrations for Hope Design demo company
-- ============================================================
DO $$
DECLARE cid UUID := 'a0000000-0000-4000-8000-000000000001';
BEGIN
  IF NOT EXISTS (SELECT 1 FROM companies WHERE id = cid) THEN RETURN; END IF;

  INSERT INTO att_device_integrations (
    company_id, integration_code, vendor, name, enabled, push_token,
    auto_process, auto_clock_pair, timezone, status, notes
  ) VALUES
    (cid, 'INT-ZKTECO', 'zkteco', 'ZKTeco ADMS / Push', true,
     'zk_' || substr(md5(cid::text || 'zkteco'), 1, 24),
     true, true, 'Africa/Kampala', 'active',
     'Configure terminals to push attendance to /api/attendance/devices/zkteco/push'),
    (cid, 'INT-HIK', 'hikvision', 'Hikvision ISAPI Events', true,
     'hk_' || substr(md5(cid::text || 'hikvision'), 1, 24),
     true, true, 'Africa/Kampala', 'active',
     'Configure Access Control event notification to /api/attendance/devices/hikvision/event')
  ON CONFLICT (company_id, vendor) DO NOTHING;

  -- Ensure demo devices exist with protocol metadata
  UPDATE att_devices
  SET protocol = 'adms',
      port = 4370,
      push_enabled = true,
      vendor = COALESCE(NULLIF(vendor, ''), 'zkteco')
  WHERE company_id = cid AND (vendor = 'zkteco' OR device_code ILIKE '%ZK%');

  INSERT INTO att_devices (
    company_id, device_code, name, vendor, model, protocol, port,
    ip_address, branch_name, building, door_gate, status, push_enabled, firmware
  )
  SELECT cid, 'DEV-HIK-01', 'HQ Face Terminal (Hikvision)', 'hikvision', 'DS-K1T671M',
         'isapi', 80, '192.168.1.64', 'Head Office', 'Building A', 'Staff Entrance',
         'offline', true, 'V4.5'
  WHERE NOT EXISTS (
    SELECT 1 FROM att_devices WHERE company_id = cid AND device_code = 'DEV-HIK-01'
  );

  INSERT INTO att_devices (
    company_id, device_code, name, vendor, model, protocol, port,
    ip_address, branch_name, building, door_gate, status, push_enabled, firmware
  )
  SELECT cid, 'DEV-ZK-02', 'Factory ZKTeco SpeedFace', 'zkteco', 'SpeedFace-V5L',
         'adms', 4370, '192.168.1.201', 'Factory', 'Production', 'Gate 2',
         'offline', true, '1.3.1'
  WHERE NOT EXISTS (
    SELECT 1 FROM att_devices WHERE company_id = cid AND device_code = 'DEV-ZK-02'
  );
END $$;
