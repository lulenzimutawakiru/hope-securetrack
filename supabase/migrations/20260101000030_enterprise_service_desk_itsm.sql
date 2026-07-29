-- Hope Design Group — Enterprise Service Desk / ITSM
-- Tickets · SLA · Catalog · Knowledge · CMDB · Problem · Change · Field · CSAT · AI

-- ============================================================
-- PERMISSIONS
-- ============================================================
INSERT INTO permissions (name, slug, module, description)
SELECT v.name, v.slug, v.module, v.description
FROM (VALUES
  ('View Service Desk', 'sd.view', 'service_desk', 'View tickets and service desk'),
  ('Manage Service Desk', 'sd.manage', 'service_desk', 'Manage tickets and configuration'),
  ('Service Desk Agent', 'sd.agent', 'service_desk', 'Work tickets as agent'),
  ('Service Desk Admin', 'sd.admin', 'service_desk', 'SLA catalog CMDB admin'),
  ('Knowledge Manage', 'sd.knowledge', 'service_desk', 'Manage knowledge base'),
  ('Change Approve', 'sd.change', 'service_desk', 'Approve IT changes'),
  ('Service Desk AI', 'sd.ai', 'service_desk', 'AI assistant'),
  ('Service Portal', 'sd.portal', 'service_desk', 'Self-service portal')
) AS v(name, slug, module, description)
WHERE NOT EXISTS (SELECT 1 FROM permissions p WHERE p.slug = v.slug);

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE p.slug LIKE 'sd.%'
  AND r.slug IN (
    'super_administrator','managing_director','operations_manager',
    'auditor','hr_manager','production_manager'
  )
  AND NOT EXISTS (
    SELECT 1 FROM role_permissions rp WHERE rp.role_id = r.id AND rp.permission_id = p.id
  );

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE p.slug IN ('sd.view','sd.portal','sd.agent')
  AND NOT EXISTS (
    SELECT 1 FROM role_permissions rp WHERE rp.role_id = r.id AND rp.permission_id = p.id
  );

-- ============================================================
-- EXTEND support_tickets → enterprise ticket
-- ============================================================
ALTER TABLE support_tickets
  ADD COLUMN IF NOT EXISTS ticket_type VARCHAR(40) DEFAULT 'incident',
  -- incident | service_request | problem | change | major_incident | question
  ADD COLUMN IF NOT EXISTS subcategory VARCHAR(100),
  ADD COLUMN IF NOT EXISTS service_type VARCHAR(80) DEFAULT 'it',
  -- it | hr | finance | procurement | maintenance | security | facilities | customer
  ADD COLUMN IF NOT EXISTS impact VARCHAR(20) DEFAULT 'medium',
  -- low | medium | high | critical
  ADD COLUMN IF NOT EXISTS urgency VARCHAR(20) DEFAULT 'medium',
  ADD COLUMN IF NOT EXISTS severity VARCHAR(20) DEFAULT 'medium',
  ADD COLUMN IF NOT EXISTS channel VARCHAR(40) DEFAULT 'web',
  -- web | email | portal | mobile | chat | whatsapp | teams | slack | phone
  ADD COLUMN IF NOT EXISTS requester_name VARCHAR(150),
  ADD COLUMN IF NOT EXISTS requester_email VARCHAR(255),
  ADD COLUMN IF NOT EXISTS requester_phone VARCHAR(50),
  ADD COLUMN IF NOT EXISTS employee_id UUID REFERENCES employees(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS department_name VARCHAR(100),
  ADD COLUMN IF NOT EXISTS location_name VARCHAR(150),
  ADD COLUMN IF NOT EXISTS asset_tag VARCHAR(100),
  ADD COLUMN IF NOT EXISTS asset_id UUID,
  ADD COLUMN IF NOT EXISTS cmdb_ci_id UUID,
  ADD COLUMN IF NOT EXISTS project_name VARCHAR(150),
  ADD COLUMN IF NOT EXISTS team_id UUID,
  ADD COLUMN IF NOT EXISTS sla_policy_id UUID,
  ADD COLUMN IF NOT EXISTS sla_response_due TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS sla_resolve_due TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS sla_response_met BOOLEAN,
  ADD COLUMN IF NOT EXISTS sla_resolve_met BOOLEAN,
  ADD COLUMN IF NOT EXISTS first_response_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS acknowledged_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS resolution_notes TEXT,
  ADD COLUMN IF NOT EXISTS root_cause TEXT,
  ADD COLUMN IF NOT EXISTS workaround TEXT,
  ADD COLUMN IF NOT EXISTS tags TEXT[],
  ADD COLUMN IF NOT EXISTS parent_ticket_id UUID REFERENCES support_tickets(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS problem_id UUID,
  ADD COLUMN IF NOT EXISTS change_id UUID,
  ADD COLUMN IF NOT EXISTS catalog_item_id UUID,
  ADD COLUMN IF NOT EXISTS is_major BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS csat_score INTEGER,
  ADD COLUMN IF NOT EXISTS csat_comment TEXT,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS source_email VARCHAR(255),
  ADD COLUMN IF NOT EXISTS call_ref VARCHAR(100),
  ADD COLUMN IF NOT EXISTS knowledge_article_id UUID;

CREATE INDEX IF NOT EXISTS idx_sd_tickets_status ON support_tickets(company_id, status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_sd_tickets_priority ON support_tickets(company_id, priority);
CREATE INDEX IF NOT EXISTS idx_sd_tickets_assigned ON support_tickets(assigned_to);
CREATE INDEX IF NOT EXISTS idx_sd_tickets_sla ON support_tickets(sla_resolve_due) WHERE status NOT IN ('closed','resolved','archived');

-- ============================================================
-- TEAMS & AGENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS sd_teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  team_code VARCHAR(50) NOT NULL,
  name VARCHAR(150) NOT NULL,
  service_types TEXT[] DEFAULT ARRAY['it'],
  categories TEXT[] DEFAULT ARRAY[]::TEXT[],
  email VARCHAR(255),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, team_code)
);

CREATE TABLE IF NOT EXISTS sd_agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  team_id UUID REFERENCES sd_teams(id) ON DELETE SET NULL,
  display_name VARCHAR(150),
  skills TEXT[] DEFAULT ARRAY[]::TEXT[],
  max_open_tickets INTEGER DEFAULT 20,
  is_available BOOLEAN DEFAULT true,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, user_id)
);

DO $$ BEGIN
  ALTER TABLE support_tickets
    ADD CONSTRAINT support_tickets_team_fk
    FOREIGN KEY (team_id) REFERENCES sd_teams(id) ON DELETE SET NULL;
EXCEPTION WHEN others THEN NULL;
END $$;

-- ============================================================
-- TICKET ACTIVITY / COMMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS sd_ticket_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  ticket_id UUID NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  event_type VARCHAR(40) NOT NULL,
  -- created | assigned | status | comment | note | escalate | sla | csat | attachment | system
  is_public BOOLEAN DEFAULT true,
  message TEXT,
  old_value TEXT,
  new_value TEXT,
  actor_id UUID REFERENCES user_profiles(id),
  actor_name VARCHAR(150),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sd_events_ticket ON sd_ticket_events(ticket_id, created_at);

-- ============================================================
-- SLA ENGINE
-- ============================================================
CREATE TABLE IF NOT EXISTS sd_sla_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  policy_code VARCHAR(50) NOT NULL,
  name VARCHAR(150) NOT NULL,
  priority VARCHAR(20) NOT NULL DEFAULT 'medium',
  response_minutes INTEGER NOT NULL DEFAULT 60,
  resolve_minutes INTEGER NOT NULL DEFAULT 480,
  business_hours_only BOOLEAN DEFAULT true,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, policy_code)
);

CREATE TABLE IF NOT EXISTS sd_escalation_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name VARCHAR(150) NOT NULL,
  trigger_type VARCHAR(40) NOT NULL DEFAULT 'sla_breach',
  -- sla_breach | priority | major | complaint | age_hours
  escalate_to_level INTEGER DEFAULT 1,
  -- 1 agent lead | 2 manager | 3 director | 4 executive
  notify_roles TEXT[] DEFAULT ARRAY[]::TEXT[],
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- SERVICE CATALOG
-- ============================================================
CREATE TABLE IF NOT EXISTS sd_catalog_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  code VARCHAR(50) NOT NULL,
  name VARCHAR(150) NOT NULL,
  icon VARCHAR(50),
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  UNIQUE(company_id, code)
);

CREATE TABLE IF NOT EXISTS sd_catalog_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  category_id UUID REFERENCES sd_catalog_categories(id) ON DELETE SET NULL,
  item_code VARCHAR(50) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  service_type VARCHAR(80) DEFAULT 'it',
  form_schema JSONB DEFAULT '[]'::jsonb,
  requires_approval BOOLEAN DEFAULT true,
  approval_levels INTEGER DEFAULT 1,
  estimated_cost DECIMAL(14,2) DEFAULT 0,
  sla_policy_id UUID REFERENCES sd_sla_policies(id),
  fulfillment_team_id UUID REFERENCES sd_teams(id),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, item_code)
);

CREATE TABLE IF NOT EXISTS sd_catalog_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  request_number VARCHAR(50) NOT NULL,
  catalog_item_id UUID REFERENCES sd_catalog_items(id),
  ticket_id UUID REFERENCES support_tickets(id),
  requester_id UUID REFERENCES user_profiles(id),
  employee_id UUID REFERENCES employees(id),
  form_data JSONB DEFAULT '{}'::jsonb,
  status VARCHAR(30) DEFAULT 'submitted',
  -- submitted | pending_approval | approved | rejected | fulfilling | completed | cancelled
  approval_status VARCHAR(30) DEFAULT 'pending',
  approved_by UUID REFERENCES user_profiles(id),
  approved_at TIMESTAMPTZ,
  cost DECIMAL(14,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, request_number)
);

-- ============================================================
-- KNOWLEDGE BASE
-- ============================================================
CREATE TABLE IF NOT EXISTS sd_knowledge_articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  article_number VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  summary TEXT,
  body TEXT NOT NULL,
  category VARCHAR(100),
  tags TEXT[] DEFAULT ARRAY[]::TEXT[],
  status VARCHAR(30) DEFAULT 'draft',
  -- draft | review | published | archived | expired
  version INTEGER DEFAULT 1,
  helpful_yes INTEGER DEFAULT 0,
  helpful_no INTEGER DEFAULT 0,
  view_count INTEGER DEFAULT 0,
  expires_on DATE,
  published_at TIMESTAMPTZ,
  author_id UUID REFERENCES user_profiles(id),
  approved_by UUID REFERENCES user_profiles(id),
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, article_number)
);

-- ============================================================
-- CMDB
-- ============================================================
CREATE TABLE IF NOT EXISTS sd_cmdb_cis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  ci_number VARCHAR(50) NOT NULL,
  name VARCHAR(255) NOT NULL,
  ci_type VARCHAR(50) NOT NULL DEFAULT 'device',
  -- device | server | pc | router | switch | firewall | application | database | cloud | vehicle | machine
  status VARCHAR(30) DEFAULT 'operational',
  -- operational | degraded | down | maintenance | retired
  owner_name VARCHAR(150),
  location_name VARCHAR(150),
  serial_number VARCHAR(100),
  asset_tag VARCHAR(100),
  ip_address VARCHAR(60),
  manufacturer VARCHAR(100),
  model VARCHAR(100),
  assigned_user_id UUID REFERENCES user_profiles(id),
  employee_id UUID REFERENCES employees(id),
  warranty_until DATE,
  metadata JSONB DEFAULT '{}'::jsonb,
  is_active BOOLEAN DEFAULT true,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, ci_number)
);

CREATE TABLE IF NOT EXISTS sd_cmdb_relations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  parent_ci_id UUID NOT NULL REFERENCES sd_cmdb_cis(id) ON DELETE CASCADE,
  child_ci_id UUID NOT NULL REFERENCES sd_cmdb_cis(id) ON DELETE CASCADE,
  relation_type VARCHAR(40) DEFAULT 'depends_on',
  -- depends_on | runs_on | connects_to | hosts | uses
  created_at TIMESTAMPTZ DEFAULT NOW()
);

DO $$ BEGIN
  ALTER TABLE support_tickets
    ADD CONSTRAINT support_tickets_cmdb_fk
    FOREIGN KEY (cmdb_ci_id) REFERENCES sd_cmdb_cis(id) ON DELETE SET NULL;
EXCEPTION WHEN others THEN NULL;
END $$;

-- ============================================================
-- PROBLEM & CHANGE
-- ============================================================
CREATE TABLE IF NOT EXISTS sd_problems (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  problem_number VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  status VARCHAR(30) DEFAULT 'open',
  -- open | investigating | known_error | resolved | closed
  root_cause TEXT,
  workaround TEXT,
  permanent_fix TEXT,
  known_error BOOLEAN DEFAULT false,
  related_ticket_ids UUID[] DEFAULT ARRAY[]::UUID[],
  assigned_to UUID REFERENCES user_profiles(id),
  created_by UUID REFERENCES user_profiles(id),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, problem_number)
);

CREATE TABLE IF NOT EXISTS sd_changes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  change_number VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  change_type VARCHAR(30) DEFAULT 'normal',
  -- standard | normal | emergency
  status VARCHAR(30) DEFAULT 'draft',
  -- draft | submitted | cab_review | approved | implementing | implemented | failed | rolled_back | closed
  risk_level VARCHAR(20) DEFAULT 'medium',
  impact VARCHAR(20) DEFAULT 'medium',
  implementation_plan TEXT,
  rollback_plan TEXT,
  scheduled_start TIMESTAMPTZ,
  scheduled_end TIMESTAMPTZ,
  implemented_at TIMESTAMPTZ,
  requested_by UUID REFERENCES user_profiles(id),
  approved_by UUID REFERENCES user_profiles(id),
  approved_at TIMESTAMPTZ,
  cab_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, change_number)
);

-- ============================================================
-- FIELD SERVICE
-- ============================================================
CREATE TABLE IF NOT EXISTS sd_field_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  job_number VARCHAR(50) NOT NULL,
  ticket_id UUID REFERENCES support_tickets(id),
  technician_id UUID REFERENCES user_profiles(id),
  title VARCHAR(255) NOT NULL,
  location_name VARCHAR(150),
  gps_lat DECIMAL(10,7),
  gps_lng DECIMAL(10,7),
  scheduled_at TIMESTAMPTZ,
  status VARCHAR(30) DEFAULT 'scheduled',
  -- scheduled | en_route | on_site | completed | cancelled
  checklist JSONB DEFAULT '[]'::jsonb,
  customer_signature TEXT,
  photos TEXT[] DEFAULT ARRAY[]::TEXT[],
  notes TEXT,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, job_number)
);

-- ============================================================
-- AUTOMATION + CHANNELS + CSAT
-- ============================================================
CREATE TABLE IF NOT EXISTS sd_automations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name VARCHAR(150) NOT NULL,
  trigger_event VARCHAR(50) NOT NULL,
  -- ticket_created | status_changed | sla_warning | catalog_submitted | employee_hired
  conditions JSONB DEFAULT '{}'::jsonb,
  actions JSONB DEFAULT '[]'::jsonb,
  is_active BOOLEAN DEFAULT true,
  run_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sd_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  channel_type VARCHAR(40) NOT NULL,
  -- email | whatsapp | teams | slack | webchat | phone | portal
  name VARCHAR(150) NOT NULL,
  config JSONB DEFAULT '{}'::jsonb,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sd_csat_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  ticket_id UUID REFERENCES support_tickets(id) ON DELETE CASCADE,
  score INTEGER NOT NULL CHECK (score BETWEEN 1 AND 5),
  comment TEXT,
  agent_id UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- RLS
-- ============================================================
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'sd_teams','sd_agents','sd_ticket_events','sd_sla_policies','sd_escalation_rules',
    'sd_catalog_categories','sd_catalog_items','sd_catalog_requests',
    'sd_knowledge_articles','sd_cmdb_cis','sd_cmdb_relations',
    'sd_problems','sd_changes','sd_field_jobs','sd_automations','sd_channels','sd_csat_responses'
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
  team_it UUID;
  team_hr UUID;
  team_fin UUID;
  sla_p1 UUID;
  sla_p2 UUID;
  sla_p3 UUID;
  cat_it UUID;
  cat_hr UUID;
  cat_fin UUID;
BEGIN
  SELECT id INTO cid FROM companies ORDER BY created_at LIMIT 1;
  IF cid IS NULL THEN RETURN; END IF;

  INSERT INTO sd_teams (company_id, team_code, name, service_types, categories, email)
  VALUES
    (cid, 'IT-L1', 'IT Support L1', ARRAY['it'], ARRAY['hardware','software','network','account'], 'itsupport@hopedesign.ug'),
    (cid, 'IT-NET', 'Network Engineering', ARRAY['it'], ARRAY['network','server'], 'network@hopedesign.ug'),
    (cid, 'HR-SVC', 'HR Service Desk', ARRAY['hr'], ARRAY['leave','documents','id'], 'hr@hopedesign.ug'),
    (cid, 'FIN-SVC', 'Finance Support', ARRAY['finance'], ARRAY['invoice','payment','payroll'], 'finance@hopedesign.ug'),
    (cid, 'FAC', 'Facilities', ARRAY['facilities','maintenance'], ARRAY['building','power'], 'facilities@hopedesign.ug')
  ON CONFLICT (company_id, team_code) DO NOTHING;

  SELECT id INTO team_it FROM sd_teams WHERE company_id = cid AND team_code = 'IT-L1';
  SELECT id INTO team_hr FROM sd_teams WHERE company_id = cid AND team_code = 'HR-SVC';
  SELECT id INTO team_fin FROM sd_teams WHERE company_id = cid AND team_code = 'FIN-SVC';

  INSERT INTO sd_sla_policies (company_id, policy_code, name, priority, response_minutes, resolve_minutes)
  VALUES
    (cid, 'SLA-P1', 'Critical / P1', 'critical', 15, 120),
    (cid, 'SLA-P2', 'High / P2', 'high', 30, 240),
    (cid, 'SLA-P3', 'Medium / P3', 'medium', 60, 480),
    (cid, 'SLA-P4', 'Low / P4', 'low', 240, 1440)
  ON CONFLICT (company_id, policy_code) DO NOTHING;

  SELECT id INTO sla_p1 FROM sd_sla_policies WHERE company_id = cid AND policy_code = 'SLA-P1';
  SELECT id INTO sla_p2 FROM sd_sla_policies WHERE company_id = cid AND policy_code = 'SLA-P2';
  SELECT id INTO sla_p3 FROM sd_sla_policies WHERE company_id = cid AND policy_code = 'SLA-P3';

  INSERT INTO sd_escalation_rules (company_id, name, trigger_type, escalate_to_level, notify_roles)
  VALUES
    (cid, 'P1 SLA Breach', 'sla_breach', 2, ARRAY['operations_manager','managing_director']),
    (cid, 'Major Incident', 'major', 3, ARRAY['managing_director']),
    (cid, 'Customer Complaint', 'complaint', 2, ARRAY['operations_manager'])
  ON CONFLICT DO NOTHING;

  INSERT INTO sd_catalog_categories (company_id, code, name, icon, sort_order)
  VALUES
    (cid, 'IT', 'IT Requests', 'Monitor', 1),
    (cid, 'HR', 'HR Requests', 'Users', 2),
    (cid, 'FIN', 'Finance Requests', 'Wallet', 3),
    (cid, 'PROC', 'Procurement', 'ShoppingCart', 4),
    (cid, 'SEC', 'Security', 'Shield', 5)
  ON CONFLICT (company_id, code) DO NOTHING;

  SELECT id INTO cat_it FROM sd_catalog_categories WHERE company_id = cid AND code = 'IT';
  SELECT id INTO cat_hr FROM sd_catalog_categories WHERE company_id = cid AND code = 'HR';
  SELECT id INTO cat_fin FROM sd_catalog_categories WHERE company_id = cid AND code = 'FIN';

  INSERT INTO sd_catalog_items (company_id, category_id, item_code, name, description, service_type, requires_approval, approval_levels, estimated_cost, sla_policy_id, fulfillment_team_id)
  VALUES
    (cid, cat_it, 'IT-LAPTOP', 'Request New Laptop', 'Standard business laptop with ERP access', 'it', true, 2, 2500000, sla_p2, team_it),
    (cid, cat_it, 'IT-PWD', 'Password Reset', 'Reset domain / ERP password', 'it', false, 0, 0, sla_p1, team_it),
    (cid, cat_it, 'IT-SOFT', 'Software Installation', 'Install approved software package', 'it', true, 1, 0, sla_p3, team_it),
    (cid, cat_it, 'IT-ACCT', 'User Account Creation', 'Create ERP / email / VPN account', 'it', true, 1, 0, sla_p2, team_it),
    (cid, cat_it, 'IT-NET', 'Network Access', 'WiFi / VPN / VLAN access request', 'it', true, 1, 0, sla_p2, team_it),
    (cid, cat_hr, 'HR-LEAVE', 'Leave Inquiry', 'Question about leave balance or policy', 'hr', false, 0, 0, sla_p3, team_hr),
    (cid, cat_hr, 'HR-DOC', 'Employee Document Request', 'Request employment letter or payslip copy', 'hr', true, 1, 0, sla_p3, team_hr),
    (cid, cat_hr, 'HR-ID', 'ID Card Replacement', 'Replace lost or damaged company ID', 'hr', true, 1, 50000, sla_p3, team_hr),
    (cid, cat_fin, 'FIN-INV', 'Invoice Inquiry', 'Customer or supplier invoice status', 'finance', false, 0, 0, sla_p3, team_fin),
    (cid, cat_fin, 'FIN-PAY', 'Payment Status', 'Check payment / transfer status', 'finance', false, 0, 0, sla_p3, team_fin)
  ON CONFLICT (company_id, item_code) DO NOTHING;

  INSERT INTO sd_knowledge_articles (company_id, article_number, title, summary, body, category, tags, status, version, published_at)
  VALUES
    (cid, 'KB-0001', 'WiFi Connection Troubleshooting', 'Fix laptop WiFi connectivity issues',
     E'## WiFi Troubleshooting\n\n1. Toggle airplane mode\n2. Forget network and reconnect\n3. Restart network adapter\n4. Check HDG-Corp SSID password with IT\n5. If unresolved, create IT ticket with location and device tag',
     'network', ARRAY['wifi','laptop','network'], 'published', 1, NOW()),
    (cid, 'KB-0002', 'Password Reset Self-Service', 'How to reset your ERP password',
     E'## Password Reset\n\n1. Go to login page → Forgot password\n2. Or open Service Catalog → Password Reset\n3. MFA verification required\n4. Temporary password emailed within 15 minutes',
     'account', ARRAY['password','security','account'], 'published', 1, NOW()),
    (cid, 'KB-0003', 'Request a New Laptop', 'Process for requesting company laptop',
     E'## New Laptop Request\n\n1. Open Service Catalog → Request New Laptop\n2. Manager approval\n3. IT approval & asset assignment\n4. Delivery and sign-off',
     'hardware', ARRAY['laptop','asset','catalog'], 'published', 1, NOW()),
    (cid, 'KB-0004', 'Printer Jam SOP', 'Clear paper jam on office printers',
     E'## Printer Paper Jam\n\n1. Power off\n2. Open panels and remove paper carefully\n3. Check for torn scraps\n4. Restart and reprint\n5. Escalate if error persists',
     'hardware', ARRAY['printer','sop'], 'published', 1, NOW())
  ON CONFLICT (company_id, article_number) DO NOTHING;

  INSERT INTO sd_cmdb_cis (company_id, ci_number, name, ci_type, status, location_name, asset_tag, manufacturer, model)
  VALUES
    (cid, 'CI-SRV-01', 'ERP Application Server', 'server', 'operational', 'Data Center', 'SRV-ERP-01', 'Dell', 'PowerEdge R750'),
    (cid, 'CI-DB-01', 'PostgreSQL Primary', 'database', 'operational', 'Data Center', 'DB-PG-01', 'Supabase', 'Postgres 15'),
    (cid, 'CI-NET-01', 'Core Switch', 'switch', 'operational', 'Server Room', 'SW-CORE-01', 'Cisco', 'Catalyst 9300'),
    (cid, 'CI-FW-01', 'Perimeter Firewall', 'firewall', 'operational', 'Server Room', 'FW-01', 'Fortinet', 'FortiGate 100F'),
    (cid, 'CI-APP-ERP', 'Hope SecureTrack ERP', 'application', 'operational', 'Cloud', 'APP-ERP', 'Hope Design', 'v1'),
    (cid, 'CI-PC-POOL', 'Laptop Asset Pool', 'pc', 'operational', 'IT Store', 'POOL-LTP', 'Lenovo', 'ThinkPad T14')
  ON CONFLICT (company_id, ci_number) DO NOTHING;

  INSERT INTO sd_cmdb_relations (company_id, parent_ci_id, child_ci_id, relation_type)
  SELECT cid, p.id, c.id, 'depends_on'
  FROM sd_cmdb_cis p, sd_cmdb_cis c
  WHERE p.company_id = cid AND c.company_id = cid
    AND p.ci_number = 'CI-APP-ERP' AND c.ci_number = 'CI-SRV-01'
    AND NOT EXISTS (SELECT 1 FROM sd_cmdb_relations r WHERE r.parent_ci_id = p.id AND r.child_ci_id = c.id);

  INSERT INTO sd_channels (company_id, channel_type, name, config, is_active)
  VALUES
    (cid, 'email', 'support@hopedesign.ug', '{"mailbox":"support@hopedesign.ug","auto_create":true}'::jsonb, true),
    (cid, 'portal', 'Employee Portal', '{"path":"/dashboard/service-desk/portal"}'::jsonb, true),
    (cid, 'webchat', 'Website Chat', '{"widget":true}'::jsonb, true),
    (cid, 'whatsapp', 'WhatsApp Business', '{"enabled":false}'::jsonb, false),
    (cid, 'teams', 'Microsoft Teams', '{"enabled":false}'::jsonb, false),
    (cid, 'slack', 'Slack', '{"enabled":false}'::jsonb, false),
    (cid, 'phone', 'Phone Support', '{"queue":"IT-Main"}'::jsonb, true)
  ON CONFLICT DO NOTHING;

  INSERT INTO sd_automations (company_id, name, trigger_event, conditions, actions, is_active)
  VALUES
    (cid, 'Auto-route Network Tickets', 'ticket_created',
     '{"category":"network"}'::jsonb,
     '[{"type":"assign_team","team_code":"IT-NET"},{"type":"set_priority","if_impact":"high","priority":"high"}]'::jsonb, true),
    (cid, 'Password Reset Fast Track', 'catalog_submitted',
     '{"item_code":"IT-PWD"}'::jsonb,
     '[{"type":"set_priority","priority":"critical"},{"type":"notify","channel":"email"}]'::jsonb, true),
    (cid, 'SLA Warning Notify', 'sla_warning',
     '{}'::jsonb,
     '[{"type":"escalate","level":1},{"type":"notify","channel":"email"}]'::jsonb, true)
  ON CONFLICT DO NOTHING;

  -- Sample open tickets if none
  IF NOT EXISTS (SELECT 1 FROM support_tickets WHERE company_id = cid LIMIT 1) THEN
    INSERT INTO support_tickets (
      company_id, ticket_number, subject, description, category, subcategory,
      ticket_type, service_type, priority, impact, urgency, status, channel,
      requester_name, department_name, team_id, sla_policy_id, sla_response_due, sla_resolve_due
    ) VALUES
    (cid, 'HDG-SD-2026-00001', 'Laptop cannot connect to WiFi',
     'User reports HDG-Corp WiFi disconnects every few minutes on ThinkPad.',
     'network', 'wifi', 'incident', 'it', 'high', 'high', 'high', 'new', 'portal',
     'Production Operator', 'Production', team_it, sla_p2,
     NOW() + INTERVAL '30 minutes', NOW() + INTERVAL '4 hours'),
    (cid, 'HDG-SD-2026-00002', 'Password reset for ERP account',
     'Employee locked out of Hope SecureTrack login.',
     'account', 'password', 'service_request', 'it', 'critical', 'medium', 'high', 'assigned', 'web',
     'HR Officer', 'HR', team_it, sla_p1,
     NOW() + INTERVAL '15 minutes', NOW() + INTERVAL '2 hours');
  END IF;

END $$;
