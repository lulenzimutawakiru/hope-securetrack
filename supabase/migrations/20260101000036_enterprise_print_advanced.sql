-- Hope Design Group — Advanced Print Platform
-- Print server · automation · secure release · quotas · consumables · ID/inventory labels

-- ============================================================
-- EXTEND QUEUE FOR FULL JOB TRACKING
-- ============================================================
ALTER TABLE prt_queue
  ADD COLUMN IF NOT EXISTS department VARCHAR(100),
  ADD COLUMN IF NOT EXISTS pages INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS label_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_retries INTEGER DEFAULT 3,
  ADD COLUMN IF NOT EXISTS parent_job_id UUID REFERENCES prt_queue(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_reprint BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_duplicate_flag BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS secure_release BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS release_pin VARCHAR(20),
  ADD COLUMN IF NOT EXISTS released_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS released_by UUID REFERENCES user_profiles(id),
  ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS failover_printer_id UUID REFERENCES printers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS branch_name VARCHAR(150),
  ADD COLUMN IF NOT EXISTS cost_estimate DECIMAL(12,4) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS processing_ms INTEGER;

ALTER TABLE prt_batches
  ADD COLUMN IF NOT EXISTS serial_prefix VARCHAR(40),
  ADD COLUMN IF NOT EXISTS start_serial INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS end_serial INTEGER,
  ADD COLUMN IF NOT EXISTS paused_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS production_batch_id UUID,
  ADD COLUMN IF NOT EXISTS qr_generated BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS duplicate_count INTEGER DEFAULT 0;

-- ============================================================
-- PRINT SERVER / AGENTS / SCHEDULING
-- ============================================================
CREATE TABLE IF NOT EXISTS prt_servers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  server_code VARCHAR(40) NOT NULL,
  name VARCHAR(150) NOT NULL,
  host_name VARCHAR(255),
  ip_address VARCHAR(60),
  port INTEGER DEFAULT 9100,
  status VARCHAR(30) DEFAULT 'online',
  -- online | offline | degraded | maintenance
  max_concurrent_jobs INTEGER DEFAULT 10,
  load_balance_mode VARCHAR(30) DEFAULT 'least_queue',
  -- least_queue | round_robin | priority | branch
  supports_secure_release BOOLEAN DEFAULT true,
  agent_version VARCHAR(40),
  last_heartbeat_at TIMESTAMPTZ,
  settings JSONB DEFAULT '{}'::jsonb,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, server_code)
);

CREATE TABLE IF NOT EXISTS prt_server_printers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  server_id UUID NOT NULL REFERENCES prt_servers(id) ON DELETE CASCADE,
  printer_id UUID NOT NULL REFERENCES printers(id) ON DELETE CASCADE,
  share_name VARCHAR(100),
  weight INTEGER DEFAULT 1,
  is_failover BOOLEAN DEFAULT false,
  UNIQUE(server_id, printer_id)
);

CREATE TABLE IF NOT EXISTS prt_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  schedule_code VARCHAR(40) NOT NULL,
  name VARCHAR(150) NOT NULL,
  cron_expr VARCHAR(80) DEFAULT '0 8 * * 1-5',
  document_type VARCHAR(50),
  printer_id UUID REFERENCES printers(id) ON DELETE SET NULL,
  template_id UUID REFERENCES prt_templates(id) ON DELETE SET NULL,
  payload_json JSONB DEFAULT '{}'::jsonb,
  is_active BOOLEAN DEFAULT true,
  last_run_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, schedule_code)
);

-- ============================================================
-- AUTOMATION TRIGGERS (ERP EVENTS)
-- ============================================================
CREATE TABLE IF NOT EXISTS prt_automation_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  rule_code VARCHAR(40) NOT NULL,
  name VARCHAR(150) NOT NULL,
  trigger_event VARCHAR(60) NOT NULL,
  -- production_complete | grn_received | invoice_approved | po_issued
  -- employee_hired | id_approved | asset_registered | shipment_dispatched
  document_type VARCHAR(50) DEFAULT 'label',
  printer_id UUID REFERENCES printers(id) ON DELETE SET NULL,
  template_id UUID REFERENCES prt_templates(id) ON DELETE SET NULL,
  copies INTEGER DEFAULT 1,
  secure_release BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  priority INTEGER DEFAULT 5,
  conditions JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, rule_code)
);

CREATE TABLE IF NOT EXISTS prt_automation_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  rule_id UUID REFERENCES prt_automation_rules(id) ON DELETE SET NULL,
  trigger_event VARCHAR(60) NOT NULL,
  source_ref VARCHAR(100),
  queue_id UUID REFERENCES prt_queue(id) ON DELETE SET NULL,
  status VARCHAR(30) DEFAULT 'fired',
  -- fired | skipped | failed
  details TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- CONSUMABLES · QUOTAS · DEPARTMENT ACCESS
-- ============================================================
CREATE TABLE IF NOT EXISTS prt_consumables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  printer_id UUID REFERENCES printers(id) ON DELETE CASCADE,
  consumable_type VARCHAR(40) NOT NULL DEFAULT 'toner',
  -- toner | ink | ribbon | labels | paper | drum | head | other
  name VARCHAR(150) NOT NULL,
  level_pct DECIMAL(5,2) DEFAULT 100,
  capacity_units INTEGER DEFAULT 1000,
  remaining_units INTEGER DEFAULT 1000,
  reorder_level INTEGER DEFAULT 100,
  unit_cost DECIMAL(12,4) DEFAULT 0,
  last_replaced_at DATE,
  status VARCHAR(30) DEFAULT 'ok',
  -- ok | low | empty | unknown
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS prt_quotas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  scope_type VARCHAR(30) NOT NULL DEFAULT 'user',
  -- user | department | company
  scope_key VARCHAR(150) NOT NULL,
  period VARCHAR(20) DEFAULT 'monthly',
  -- daily | weekly | monthly
  max_pages INTEGER DEFAULT 500,
  max_labels INTEGER DEFAULT 5000,
  used_pages INTEGER DEFAULT 0,
  used_labels INTEGER DEFAULT 0,
  period_start DATE DEFAULT date_trunc('month', CURRENT_DATE)::date,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, scope_type, scope_key, period)
);

CREATE TABLE IF NOT EXISTS prt_department_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  department VARCHAR(100) NOT NULL,
  printer_id UUID NOT NULL REFERENCES printers(id) ON DELETE CASCADE,
  can_print BOOLEAN DEFAULT true,
  can_color BOOLEAN DEFAULT false,
  can_secure BOOLEAN DEFAULT true,
  max_priority INTEGER DEFAULT 5,
  UNIQUE(company_id, department, printer_id)
);

-- ============================================================
-- PRODUCT / INVENTORY / ID CARD PRINT PROFILES
-- ============================================================
CREATE TABLE IF NOT EXISTS prt_product_label_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  job_number VARCHAR(50) NOT NULL,
  product_name VARCHAR(255) NOT NULL,
  sku VARCHAR(100),
  batch_number VARCHAR(80),
  serial_start VARCHAR(80),
  serial_end VARCHAR(80),
  quantity INTEGER NOT NULL DEFAULT 1,
  mfg_date DATE,
  expiry_date DATE,
  production_line VARCHAR(80),
  quality_status VARCHAR(40) DEFAULT 'approved',
  template_id UUID REFERENCES prt_templates(id) ON DELETE SET NULL,
  printer_id UUID REFERENCES printers(id) ON DELETE SET NULL,
  batch_id UUID REFERENCES prt_batches(id) ON DELETE SET NULL,
  status VARCHAR(30) DEFAULT 'draft',
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, job_number)
);

CREATE TABLE IF NOT EXISTS prt_inventory_labels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  label_number VARCHAR(50) NOT NULL,
  label_kind VARCHAR(40) NOT NULL DEFAULT 'shelf',
  -- shelf | bin | rack | carton | pallet | location
  location_code VARCHAR(80) NOT NULL,
  sku VARCHAR(100),
  product_name VARCHAR(255),
  barcode_value VARCHAR(120),
  template_id UUID REFERENCES prt_templates(id) ON DELETE SET NULL,
  printer_id UUID REFERENCES printers(id) ON DELETE SET NULL,
  queue_id UUID REFERENCES prt_queue(id) ON DELETE SET NULL,
  status VARCHAR(30) DEFAULT 'pending',
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, label_number)
);

CREATE TABLE IF NOT EXISTS prt_id_card_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  job_number VARCHAR(50) NOT NULL,
  card_type VARCHAR(40) DEFAULT 'staff',
  -- staff | contractor | visitor | temporary
  full_name VARCHAR(200) NOT NULL,
  employee_number VARCHAR(80),
  department VARCHAR(100),
  position_title VARCHAR(150),
  photo_url TEXT,
  rfid_number VARCHAR(80),
  barcode_value VARCHAR(120),
  qr_token TEXT,
  expiry_date DATE,
  front_template_id UUID REFERENCES prt_templates(id) ON DELETE SET NULL,
  back_template_id UUID REFERENCES prt_templates(id) ON DELETE SET NULL,
  printer_id UUID REFERENCES printers(id) ON DELETE SET NULL,
  queue_id UUID REFERENCES prt_queue(id) ON DELETE SET NULL,
  status VARCHAR(30) DEFAULT 'pending',
  -- pending | approved | printing | completed | failed
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, job_number)
);

CREATE TABLE IF NOT EXISTS prt_secure_pdfs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  pdf_code VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  document_type VARCHAR(50) DEFAULT 'security',
  html_body TEXT,
  watermark TEXT,
  anti_copy_bg BOOLEAN DEFAULT true,
  microtext TEXT,
  signature_hash VARCHAR(64),
  verification_code VARCHAR(40),
  pages INTEGER DEFAULT 1,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, pdf_code)
);

CREATE TABLE IF NOT EXISTS prt_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  alert_type VARCHAR(40) NOT NULL,
  -- low_paper | low_labels | low_toner | ribbon | maintenance | offline | quota
  severity VARCHAR(20) DEFAULT 'medium',
  title VARCHAR(255) NOT NULL,
  detail TEXT,
  printer_id UUID REFERENCES printers(id) ON DELETE SET NULL,
  status VARCHAR(30) DEFAULT 'open',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

-- ============================================================
-- RLS
-- ============================================================
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'prt_servers','prt_server_printers','prt_schedules','prt_automation_rules','prt_automation_log',
    'prt_consumables','prt_quotas','prt_department_access','prt_product_label_jobs',
    'prt_inventory_labels','prt_id_card_jobs','prt_secure_pdfs','prt_alerts'
  ]
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
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
  sid UUID;
  pid UUID;
  tid UUID;
BEGIN
  SELECT id INTO cid FROM companies ORDER BY created_at LIMIT 1;
  IF cid IS NULL THEN RETURN; END IF;

  INSERT INTO prt_servers (company_id, server_code, name, host_name, ip_address, status, max_concurrent_jobs, load_balance_mode, supports_secure_release, agent_version, last_heartbeat_at)
  VALUES
    (cid, 'PSRV-HQ', 'HQ Print Server', 'print-hq.local', '10.0.0.50', 'online', 20, 'least_queue', true, '1.0.0', NOW()),
    (cid, 'PSRV-WH', 'Warehouse Print Server', 'print-wh.local', '10.0.1.50', 'online', 30, 'priority', true, '1.0.0', NOW())
  ON CONFLICT (company_id, server_code) DO NOTHING;

  SELECT id INTO sid FROM prt_servers WHERE company_id = cid AND server_code = 'PSRV-HQ';
  SELECT id INTO pid FROM printers WHERE company_id = cid AND is_active = true LIMIT 1;
  SELECT id INTO tid FROM prt_templates WHERE company_id = cid AND template_code = 'TPL-QR-REAM' LIMIT 1;

  IF sid IS NOT NULL AND pid IS NOT NULL THEN
    INSERT INTO prt_server_printers (company_id, server_id, printer_id, share_name, weight)
    SELECT cid, sid, p.id, COALESCE(p.printer_code, p.name), 1
    FROM printers p
    WHERE p.company_id = cid AND p.is_active = true
    ON CONFLICT DO NOTHING;
  END IF;

  INSERT INTO prt_automation_rules (company_id, rule_code, name, trigger_event, document_type, printer_id, template_id, copies, is_active, priority)
  VALUES
    (cid, 'AUTO-PROD', 'Production complete → QR labels', 'production_complete', 'qr_auth', pid, tid, 1, true, 1),
    (cid, 'AUTO-GRN', 'Goods received → carton labels', 'grn_received', 'carton', pid, tid, 1, true, 2),
    (cid, 'AUTO-INV', 'Invoice approved → print invoice', 'invoice_approved', 'invoice', NULL, NULL, 1, true, 3),
    (cid, 'AUTO-PO', 'PO issued → print PO', 'po_issued', 'po', NULL, NULL, 1, true, 3),
    (cid, 'AUTO-HIRE', 'Employee hired → ID card', 'employee_hired', 'id_card', NULL, NULL, 1, true, 2),
    (cid, 'AUTO-SHIP', 'Shipment dispatched → shipping label', 'shipment_dispatched', 'shipping', pid, NULL, 1, true, 1),
    (cid, 'AUTO-ASSET', 'Asset registered → asset label', 'asset_registered', 'barcode', pid, tid, 1, true, 4)
  ON CONFLICT (company_id, rule_code) DO NOTHING;

  INSERT INTO prt_schedules (company_id, schedule_code, name, cron_expr, document_type, printer_id, is_active)
  VALUES
    (cid, 'SCH-DAILY-RPT', 'Daily production report print', '0 7 * * 1-5', 'report', NULL, true)
  ON CONFLICT (company_id, schedule_code) DO NOTHING;

  -- Consumables for each printer
  INSERT INTO prt_consumables (company_id, printer_id, consumable_type, name, level_pct, remaining_units, reorder_level, status)
  SELECT cid, p.id, 'toner', p.name || ' Toner', 72, 720, 100, 'ok'
  FROM printers p WHERE p.company_id = cid AND p.is_active = true
  AND NOT EXISTS (SELECT 1 FROM prt_consumables c WHERE c.printer_id = p.id AND c.consumable_type = 'toner');

  INSERT INTO prt_consumables (company_id, printer_id, consumable_type, name, level_pct, remaining_units, reorder_level, status)
  SELECT cid, p.id, 'labels', p.name || ' Label Stock', 45, 450, 100, 'ok'
  FROM printers p WHERE p.company_id = cid AND COALESCE(p.printer_type, 'label') IN ('label','thermal','industrial')
  AND NOT EXISTS (SELECT 1 FROM prt_consumables c WHERE c.printer_id = p.id AND c.consumable_type = 'labels');

  INSERT INTO prt_quotas (company_id, scope_type, scope_key, period, max_pages, max_labels, used_pages, used_labels)
  VALUES
    (cid, 'department', 'Production', 'monthly', 2000, 50000, 120, 8500),
    (cid, 'department', 'Warehouse', 'monthly', 1000, 20000, 80, 3200),
    (cid, 'department', 'Finance', 'monthly', 3000, 500, 450, 20),
    (cid, 'company', 'ALL', 'monthly', 20000, 100000, 2100, 15000)
  ON CONFLICT DO NOTHING;

  IF pid IS NOT NULL THEN
    INSERT INTO prt_department_access (company_id, department, printer_id, can_print, can_color, can_secure)
    VALUES
      (cid, 'Production', pid, true, false, true),
      (cid, 'Warehouse', pid, true, false, true),
      (cid, 'Finance', pid, true, true, true),
      (cid, 'HR', pid, true, false, true)
    ON CONFLICT DO NOTHING;
  END IF;

  INSERT INTO prt_alerts (company_id, alert_type, severity, title, detail, printer_id, status)
  SELECT cid, 'offline', 'high', p.name || ' offline', 'Printer has not reported status recently', p.id, 'open'
  FROM printers p WHERE p.company_id = cid AND p.status = 'offline'
  AND NOT EXISTS (SELECT 1 FROM prt_alerts a WHERE a.printer_id = p.id AND a.alert_type = 'offline' AND a.status = 'open');

END $$;
