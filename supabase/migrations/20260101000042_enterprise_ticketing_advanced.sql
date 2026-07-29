-- Hope Design Group — Enterprise Ticketing & Case Management (Advanced)
-- Work logs · chat · approvals · taxonomy · templates · major incident · calendars

-- ============================================================
-- PERMISSIONS
-- ============================================================
INSERT INTO permissions (name, slug, module, description)
SELECT v.name, v.slug, v.module, v.description
FROM (VALUES
  ('Ticket Approver', 'sd.approve', 'service_desk', 'Approve ticket-driven requests'),
  ('Major Incident', 'sd.major', 'service_desk', 'Major incident war room'),
  ('Field Technician', 'sd.field', 'service_desk', 'Field service mobile ops')
) AS v(name, slug, module, description)
WHERE NOT EXISTS (SELECT 1 FROM permissions p WHERE p.slug = v.slug);

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE p.slug IN ('sd.approve','sd.major','sd.field','sd.agent','sd.view','sd.manage')
  AND r.slug IN (
    'super_administrator','managing_director','operations_manager',
    'auditor','hr_manager','production_manager','warehouse_manager'
  )
  AND NOT EXISTS (
    SELECT 1 FROM role_permissions rp WHERE rp.role_id = r.id AND rp.permission_id = p.id
  );

-- ============================================================
-- EXTEND support_tickets
-- ============================================================
ALTER TABLE support_tickets
  ADD COLUMN IF NOT EXISTS related_invoice VARCHAR(80),
  ADD COLUMN IF NOT EXISTS related_product VARCHAR(120),
  ADD COLUMN IF NOT EXISTS related_qr VARCHAR(120),
  ADD COLUMN IF NOT EXISTS related_dispatch VARCHAR(80),
  ADD COLUMN IF NOT EXISTS related_asset_tag VARCHAR(100),
  ADD COLUMN IF NOT EXISTS preferred_contact VARCHAR(40) DEFAULT 'email',
  ADD COLUMN IF NOT EXISTS gps_lat NUMERIC(10,7),
  ADD COLUMN IF NOT EXISTS gps_lng NUMERIC(10,7),
  ADD COLUMN IF NOT EXISTS time_spent_minutes INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reopen_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS merged_into_id UUID REFERENCES support_tickets(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approval_status VARCHAR(30),
  -- null | pending | approved | rejected
  ADD COLUMN IF NOT EXISTS nps_score INTEGER,
  ADD COLUMN IF NOT EXISTS template_code VARCHAR(60),
  ADD COLUMN IF NOT EXISTS language_code VARCHAR(10) DEFAULT 'en',
  ADD COLUMN IF NOT EXISTS fraud_flag BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS duplicate_of_id UUID REFERENCES support_tickets(id) ON DELETE SET NULL;

-- ============================================================
-- CATEGORY TAXONOMY (unlimited)
-- ============================================================
CREATE TABLE IF NOT EXISTS sd_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  category_code VARCHAR(60) NOT NULL,
  name VARCHAR(150) NOT NULL,
  parent_code VARCHAR(60),
  service_type VARCHAR(40) DEFAULT 'it',
  default_priority VARCHAR(20) DEFAULT 'medium',
  default_team_code VARCHAR(40),
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 100,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, category_code)
);

-- ============================================================
-- TICKET TEMPLATES
-- ============================================================
CREATE TABLE IF NOT EXISTS sd_ticket_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  template_code VARCHAR(60) NOT NULL,
  name VARCHAR(150) NOT NULL,
  subject_template TEXT NOT NULL,
  description_template TEXT,
  category VARCHAR(100),
  subcategory VARCHAR(100),
  service_type VARCHAR(40) DEFAULT 'it',
  ticket_type VARCHAR(40) DEFAULT 'incident',
  priority VARCHAR(20) DEFAULT 'medium',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, template_code)
);

-- ============================================================
-- WORK LOGS · TIME TRACKING
-- ============================================================
CREATE TABLE IF NOT EXISTS sd_work_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  ticket_id UUID NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  agent_id UUID REFERENCES user_profiles(id),
  agent_name VARCHAR(150),
  work_type VARCHAR(40) DEFAULT 'investigation',
  -- investigation | remote | onsite | travel | wait | documentation
  minutes INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  billable BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sd_work_logs_ticket ON sd_work_logs(ticket_id);

-- ============================================================
-- CONVERSATIONS / LIVE CHAT ON TICKET
-- ============================================================
CREATE TABLE IF NOT EXISTS sd_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  ticket_id UUID NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  channel VARCHAR(40) DEFAULT 'internal',
  -- internal | public | chat | email | whatsapp | teams | slack | phone
  direction VARCHAR(20) DEFAULT 'outbound',
  -- inbound | outbound | system
  author_id UUID REFERENCES user_profiles(id),
  author_name VARCHAR(150),
  body TEXT NOT NULL,
  is_public BOOLEAN DEFAULT true,
  attachments JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sd_messages_ticket ON sd_messages(ticket_id, created_at);

-- ============================================================
-- APPROVALS
-- ============================================================
CREATE TABLE IF NOT EXISTS sd_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  ticket_id UUID NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  sequence_no INTEGER DEFAULT 1,
  approver_role VARCHAR(80),
  approver_id UUID REFERENCES user_profiles(id),
  approver_name VARCHAR(150),
  decision VARCHAR(30) DEFAULT 'pending',
  -- pending | approved | rejected | skipped
  comments TEXT,
  decided_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- MAJOR INCIDENT WAR ROOM
-- ============================================================
CREATE TABLE IF NOT EXISTS sd_major_incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  incident_number VARCHAR(40) NOT NULL,
  ticket_id UUID REFERENCES support_tickets(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  severity VARCHAR(20) DEFAULT 'critical',
  status VARCHAR(30) DEFAULT 'declared',
  -- declared | active | mitigating | resolved | closed
  commander_name VARCHAR(150),
  impact_summary TEXT,
  bridge_url TEXT,
  executive_notified BOOLEAN DEFAULT false,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  timeline JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, incident_number)
);

-- ============================================================
-- BUSINESS CALENDARS · HOLIDAYS
-- ============================================================
CREATE TABLE IF NOT EXISTS sd_calendars (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  calendar_code VARCHAR(40) NOT NULL,
  name VARCHAR(150) NOT NULL,
  timezone VARCHAR(60) DEFAULT 'Africa/Kampala',
  business_hours JSONB DEFAULT '{"mon":["08:00","17:00"],"tue":["08:00","17:00"],"wed":["08:00","17:00"],"thu":["08:00","17:00"],"fri":["08:00","17:00"]}'::jsonb,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, calendar_code)
);

CREATE TABLE IF NOT EXISTS sd_holidays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  calendar_id UUID REFERENCES sd_calendars(id) ON DELETE CASCADE,
  holiday_date DATE NOT NULL,
  name VARCHAR(150) NOT NULL,
  is_recurring BOOLEAN DEFAULT false
);

-- ============================================================
-- EMAIL-TO-TICKET · IOT ALERTS INBOX
-- ============================================================
CREATE TABLE IF NOT EXISTS sd_inbound_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  source VARCHAR(40) NOT NULL,
  -- email | whatsapp | iot | api | chat | phone
  external_id VARCHAR(120),
  from_address VARCHAR(255),
  subject TEXT,
  body TEXT,
  status VARCHAR(30) DEFAULT 'new',
  -- new | ticketed | ignored | spam
  ticket_id UUID REFERENCES support_tickets(id) ON DELETE SET NULL,
  metadata JSONB DEFAULT '{}',
  received_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- NPS · SURVEYS (beyond CSAT)
-- ============================================================
CREATE TABLE IF NOT EXISTS sd_nps_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  ticket_id UUID REFERENCES support_tickets(id) ON DELETE SET NULL,
  score INTEGER NOT NULL CHECK (score >= 0 AND score <= 10),
  comment TEXT,
  respondent_name VARCHAR(150),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- RLS
-- ============================================================
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'sd_categories','sd_ticket_templates','sd_work_logs','sd_messages',
    'sd_approvals','sd_major_incidents','sd_calendars','sd_holidays',
    'sd_inbound_items','sd_nps_responses'
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
DECLARE cid UUID;
BEGIN
  SELECT id INTO cid FROM companies ORDER BY created_at LIMIT 1;
  IF cid IS NULL THEN RETURN; END IF;

  INSERT INTO sd_categories (company_id, category_code, name, parent_code, service_type, default_priority, sort_order)
  VALUES
    (cid, 'IT', 'IT Support', NULL, 'it', 'medium', 10),
    (cid, 'IT-HW', 'Hardware Issue', 'IT', 'it', 'medium', 11),
    (cid, 'IT-SW', 'Software Issue', 'IT', 'it', 'medium', 12),
    (cid, 'IT-NET', 'Network Issue', 'IT', 'it', 'high', 13),
    (cid, 'IT-PRN', 'Printer Issue', 'IT', 'it', 'low', 14),
    (cid, 'IT-ACC', 'User Account / Password', 'IT', 'it', 'high', 15),
    (cid, 'HR', 'HR', NULL, 'hr', 'low', 20),
    (cid, 'HR-LEAVE', 'Leave Request', 'HR', 'hr', 'low', 21),
    (cid, 'HR-PAY', 'Payroll Query', 'HR', 'hr', 'medium', 22),
    (cid, 'FIN', 'Finance', NULL, 'finance', 'medium', 30),
    (cid, 'FIN-INV', 'Invoice Query', 'FIN', 'finance', 'medium', 31),
    (cid, 'FIN-PAY', 'Payment Issue', 'FIN', 'finance', 'high', 32),
    (cid, 'PRC', 'Procurement', NULL, 'procurement', 'medium', 40),
    (cid, 'MFG', 'Production', NULL, 'maintenance', 'high', 50),
    (cid, 'MFG-BRK', 'Machine Breakdown', 'MFG', 'maintenance', 'critical', 51),
    (cid, 'MFG-QC', 'Quality Defect', 'MFG', 'maintenance', 'high', 52),
    (cid, 'WHS', 'Warehouse', NULL, 'it', 'medium', 60),
    (cid, 'FLT', 'Fleet', NULL, 'maintenance', 'high', 70),
    (cid, 'FAC', 'Facilities', NULL, 'facilities', 'medium', 80),
    (cid, 'CUS', 'Customer Support', NULL, 'customer', 'medium', 90),
    (cid, 'CUS-AUTH', 'Product Authentication', 'CUS', 'customer', 'high', 91),
    (cid, 'CUS-WRN', 'Warranty Claim', 'CUS', 'customer', 'medium', 92),
    (cid, 'CUS-DEL', 'Delivery Issue', 'CUS', 'customer', 'high', 93)
  ON CONFLICT (company_id, category_code) DO NOTHING;

  INSERT INTO sd_ticket_templates (company_id, template_code, name, subject_template, description_template, category, subcategory, service_type, ticket_type, priority)
  VALUES
    (cid, 'PWD-RESET', 'Password Reset', 'Password reset — {{user}}', 'User requests password reset for account {{user}}.', 'account', 'password', 'it', 'service_request', 'high'),
    (cid, 'PRN-FAIL', 'Printer Failure', 'Printer offline — {{location}}', 'Printer {{asset}} is not printing at {{location}}.', 'hardware', 'printer', 'it', 'incident', 'medium'),
    (cid, 'MCH-DOWN', 'Machine Breakdown', 'Production machine down — {{asset}}', 'Machine {{asset}} stopped. Impact on line {{line}}.', 'production', 'breakdown', 'maintenance', 'incident', 'critical'),
    (cid, 'ASSET-FAULT', 'Asset Fault via QR', 'Asset fault — {{asset_tag}}', 'Fault reported by scanning asset tag {{asset_tag}}.', 'hardware', 'device', 'maintenance', 'incident', 'medium')
  ON CONFLICT (company_id, template_code) DO NOTHING;

  INSERT INTO sd_calendars (company_id, calendar_code, name, is_default)
  VALUES (cid, 'UG-STD', 'Uganda Business Hours', true)
  ON CONFLICT (company_id, calendar_code) DO NOTHING;

  INSERT INTO sd_holidays (company_id, calendar_id, holiday_date, name, is_recurring)
  SELECT cid, c.id, DATE '2026-01-01', 'New Year''s Day', true
  FROM sd_calendars c WHERE c.company_id = cid AND c.calendar_code = 'UG-STD'
  AND NOT EXISTS (SELECT 1 FROM sd_holidays h WHERE h.company_id = cid AND h.name = 'New Year''s Day');

  INSERT INTO sd_holidays (company_id, calendar_id, holiday_date, name, is_recurring)
  SELECT cid, c.id, DATE '2026-10-09', 'Independence Day', true
  FROM sd_calendars c WHERE c.company_id = cid AND c.calendar_code = 'UG-STD'
  AND NOT EXISTS (SELECT 1 FROM sd_holidays h WHERE h.company_id = cid AND h.name = 'Independence Day');

  IF NOT EXISTS (SELECT 1 FROM sd_major_incidents WHERE company_id = cid) THEN
    INSERT INTO sd_major_incidents (
      company_id, incident_number, title, severity, status, commander_name,
      impact_summary, executive_notified, timeline
    ) VALUES (
      cid, 'MI-2026-001', 'Plant network partial outage (demo seed)', 'critical', 'closed',
      'IT Operations Lead',
      'Production floor Wi-Fi degraded for 40 minutes. Resolved by AP reboot.',
      true,
      '[{"at":"seed","event":"Declared"},{"at":"seed","event":"Mitigated"},{"at":"seed","event":"Closed"}]'::jsonb
    );
  END IF;

  INSERT INTO sd_inbound_items (company_id, source, from_address, subject, body, status)
  SELECT cid, 'email', 'user@example.com', 'Cannot print from warehouse PC', 'Printer in Bay A1 offline since morning.', 'new'
  WHERE NOT EXISTS (SELECT 1 FROM sd_inbound_items WHERE company_id = cid LIMIT 1);
END $$;
