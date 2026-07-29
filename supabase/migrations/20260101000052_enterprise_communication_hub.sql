-- Hope SecureTrack ERP — Enterprise Communication & Notification Platform
-- Branded email · multi-channel · event rules · document delivery · audit

-- ============================================================
-- ENUMS
-- ============================================================
DO $$ BEGIN CREATE TYPE comm_channel AS ENUM (
  'email','sms','whatsapp','push','in_app','hopechat','teams','slack'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE comm_message_status AS ENUM (
  'draft','queued','sending','sent','delivered','opened','clicked','failed','cancelled','scheduled'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE comm_doc_type AS ENUM (
  'quotation','proforma','sales_order','invoice','receipt','credit_note','debit_note','statement',
  'pr','rfq','po','grn','delivery_note','contract',
  'payment_voucher','journal','financial_report',
  'production_order','job_card','bom','batch','qc_certificate','packaging',
  'offer_letter','employment_contract','payslip','leave_letter','id_card',
  'ticket_report','service_report','project_report','other'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- MESSAGE TEMPLATES (branded multi-channel)
-- ============================================================
CREATE TABLE IF NOT EXISTS comm_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  template_code VARCHAR(80) NOT NULL,
  name VARCHAR(200) NOT NULL,
  channel VARCHAR(30) NOT NULL DEFAULT 'email',
  category VARCHAR(50) DEFAULT 'system',
  subject_template VARCHAR(500),
  body_html TEXT,
  body_text TEXT,
  language_code VARCHAR(10) DEFAULT 'en',
  include_branding BOOLEAN DEFAULT true,
  include_qr_footer BOOLEAN DEFAULT true,
  include_signature BOOLEAN DEFAULT true,
  default_attachments JSONB DEFAULT '[]'::jsonb,
  -- [{doc_type, required}]
  is_active BOOLEAN DEFAULT true,
  version_no INTEGER DEFAULT 1,
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, template_code, channel)
);

-- ============================================================
-- COMMUNICATION MESSAGES (unified outbox)
-- ============================================================
CREATE TABLE IF NOT EXISTS comm_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  message_number VARCHAR(50) NOT NULL,
  channel VARCHAR(30) NOT NULL DEFAULT 'email',
  status comm_message_status NOT NULL DEFAULT 'draft',
  priority VARCHAR(20) DEFAULT 'normal',
  category VARCHAR(50) DEFAULT 'system',
  -- source event
  source_module VARCHAR(50),
  source_event VARCHAR(80),
  entity_type VARCHAR(80),
  entity_id UUID,
  entity_code VARCHAR(100),
  -- content
  template_id UUID REFERENCES comm_templates(id) ON DELETE SET NULL,
  subject VARCHAR(500),
  body_html TEXT,
  body_text TEXT,
  -- recipients (snapshot)
  to_addresses TEXT[] DEFAULT ARRAY[]::TEXT[],
  cc_addresses TEXT[] DEFAULT ARRAY[]::TEXT[],
  bcc_addresses TEXT[] DEFAULT ARRAY[]::TEXT[],
  recipient_user_ids UUID[] DEFAULT ARRAY[]::UUID[],
  recipient_summary VARCHAR(500),
  -- branding snapshot
  brand_logo_url TEXT,
  brand_colors JSONB DEFAULT '{}'::jsonb,
  -- schedule / delivery
  scheduled_for TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  provider VARCHAR(40),
  provider_message_id VARCHAR(150),
  -- tracking
  open_count INTEGER DEFAULT 0,
  click_count INTEGER DEFAULT 0,
  download_count INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}'::jsonb,
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, message_number)
);

CREATE INDEX IF NOT EXISTS idx_comm_msg_status ON comm_messages(company_id, status);
CREATE INDEX IF NOT EXISTS idx_comm_msg_event ON comm_messages(company_id, source_event);
CREATE INDEX IF NOT EXISTS idx_comm_msg_entity ON comm_messages(entity_type, entity_id);

-- ============================================================
-- ATTACHMENTS (auto-generated docs)
-- ============================================================
CREATE TABLE IF NOT EXISTS comm_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  message_id UUID REFERENCES comm_messages(id) ON DELETE CASCADE,
  doc_type VARCHAR(50) NOT NULL DEFAULT 'other',
  file_name VARCHAR(255) NOT NULL,
  file_url TEXT,
  mime_type VARCHAR(80) DEFAULT 'application/pdf',
  file_size_bytes BIGINT,
  qr_payload TEXT,
  barcode_value VARCHAR(100),
  version_no INTEGER DEFAULT 1,
  watermark TEXT,
  classification VARCHAR(40) DEFAULT 'internal',
  -- public | internal | confidential | restricted
  digital_signature_ref TEXT,
  is_generated BOOLEAN DEFAULT true,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_comm_att_msg ON comm_attachments(message_id);

-- ============================================================
-- DOCUMENT GENERATION REGISTRY
-- ============================================================
CREATE TABLE IF NOT EXISTS comm_document_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  job_number VARCHAR(50) NOT NULL,
  doc_type VARCHAR(50) NOT NULL,
  entity_type VARCHAR(80),
  entity_id UUID,
  entity_code VARCHAR(100),
  status VARCHAR(30) DEFAULT 'pending',
  -- pending | generating | ready | failed | delivered
  file_url TEXT,
  qr_verify_url TEXT,
  error_message TEXT,
  requested_by UUID REFERENCES user_profiles(id),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, job_number)
);

-- ============================================================
-- EVENT → COMMUNICATION RULES
-- ============================================================
CREATE TABLE IF NOT EXISTS comm_event_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  rule_code VARCHAR(80) NOT NULL,
  name VARCHAR(200) NOT NULL,
  description TEXT,
  event_key VARCHAR(100) NOT NULL,
  -- e.g. procurement.po.approved, sales.invoice.generated, hr.leave.submitted
  source_module VARCHAR(50) NOT NULL,
  channels TEXT[] DEFAULT ARRAY['in_app','email']::TEXT[],
  template_code VARCHAR(80),
  subject_template VARCHAR(500),
  body_template TEXT,
  -- dynamic audience
  audience JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- {roles:[], departments:[], resolve:['manager','requestor','supplier','customer'], user_ids:[]}
  attach_docs TEXT[] DEFAULT ARRAY[]::TEXT[],
  -- document types to auto-generate and attach
  escalate_after_hours INTEGER,
  escalate_to JSONB DEFAULT '{}'::jsonb,
  priority VARCHAR(20) DEFAULT 'normal',
  is_active BOOLEAN DEFAULT true,
  conditions JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, rule_code)
);

CREATE INDEX IF NOT EXISTS idx_comm_rules_event ON comm_event_rules(company_id, event_key) WHERE is_active;

-- ============================================================
-- SCHEDULED COMMUNICATIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS comm_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  schedule_code VARCHAR(80) NOT NULL,
  name VARCHAR(200) NOT NULL,
  schedule_type VARCHAR(40) DEFAULT 'recurring',
  -- once | recurring | event_reminder
  cron_expression VARCHAR(80),
  run_at TIMESTAMPTZ,
  channel VARCHAR(30) DEFAULT 'email',
  template_code VARCHAR(80),
  subject VARCHAR(500),
  body_html TEXT,
  audience JSONB DEFAULT '{"all_users":false}'::jsonb,
  attach_docs TEXT[] DEFAULT ARRAY[]::TEXT[],
  status VARCHAR(30) DEFAULT 'active',
  -- active | paused | completed | cancelled
  last_run_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, schedule_code)
);

-- ============================================================
-- REMINDERS & ESCALATIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS comm_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  reminder_code VARCHAR(80),
  title VARCHAR(255) NOT NULL,
  entity_type VARCHAR(80),
  entity_id UUID,
  due_at TIMESTAMPTZ NOT NULL,
  escalate_at TIMESTAMPTZ,
  channels TEXT[] DEFAULT ARRAY['in_app','email']::TEXT[],
  recipient_user_ids UUID[] DEFAULT ARRAY[]::UUID[],
  status VARCHAR(30) DEFAULT 'pending',
  -- pending | sent | escalated | cancelled | completed
  message TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_comm_reminders_due ON comm_reminders(company_id, due_at) WHERE status = 'pending';

-- ============================================================
-- CAMPAIGNS / BROADCASTS (extends notification_broadcasts concept)
-- ============================================================
CREATE TABLE IF NOT EXISTS comm_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  campaign_code VARCHAR(50) NOT NULL,
  name VARCHAR(200) NOT NULL,
  channel VARCHAR(30) DEFAULT 'email',
  subject VARCHAR(500),
  body_html TEXT,
  audience JSONB DEFAULT '{"all_users":true}'::jsonb,
  status VARCHAR(30) DEFAULT 'draft',
  scheduled_for TIMESTAMPTZ,
  sent_count INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0,
  opened_count INTEGER DEFAULT 0,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, campaign_code)
);

-- ============================================================
-- ANNOUNCEMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS comm_announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  body TEXT NOT NULL,
  priority VARCHAR(20) DEFAULT 'normal',
  audience JSONB DEFAULT '{"all_users":true}'::jsonb,
  publish_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  is_pinned BOOLEAN DEFAULT false,
  status VARCHAR(30) DEFAULT 'published',
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- PROVIDER CONFIG (SMTP / SMS / WhatsApp / Push)
-- ============================================================
CREATE TABLE IF NOT EXISTS comm_providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  provider_code VARCHAR(50) NOT NULL,
  provider_type VARCHAR(30) NOT NULL,
  -- smtp | resend | m365 | gmail | sms | whatsapp | fcm | apns
  display_name VARCHAR(150) NOT NULL,
  config JSONB DEFAULT '{}'::jsonb,
  -- non-secret settings; secrets via vault/env
  is_default BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  rate_limit_per_minute INTEGER DEFAULT 60,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, provider_code)
);

-- ============================================================
-- DELIVERY EVENTS (open/click/download tracking)
-- ============================================================
CREATE TABLE IF NOT EXISTS comm_delivery_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  message_id UUID REFERENCES comm_messages(id) ON DELETE CASCADE,
  event_type VARCHAR(40) NOT NULL,
  -- sent | delivered | opened | clicked | downloaded | replied | bounced | failed | retried
  recipient VARCHAR(255),
  meta JSONB DEFAULT '{}'::jsonb,
  occurred_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_comm_del_events ON comm_delivery_events(message_id, occurred_at DESC);

-- ============================================================
-- COMMUNICATION AUDIT
-- ============================================================
CREATE TABLE IF NOT EXISTS comm_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  actor_id UUID REFERENCES user_profiles(id),
  action VARCHAR(50) NOT NULL,
  entity_table VARCHAR(80),
  entity_id UUID,
  details TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_comm_audit ON comm_audit_log(company_id, created_at DESC);

-- ============================================================
-- SEQUENCE
-- ============================================================
CREATE TABLE IF NOT EXISTS comm_sequences (
  company_id UUID PRIMARY KEY REFERENCES companies(id) ON DELETE CASCADE,
  last_message BIGINT DEFAULT 0,
  last_job BIGINT DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION public.next_comm_message_number(p_company_id UUID)
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE n BIGINT; y TEXT := to_char(CURRENT_DATE, 'YYYY');
BEGIN
  INSERT INTO comm_sequences (company_id, last_message) VALUES (p_company_id, 1)
  ON CONFLICT (company_id) DO UPDATE
    SET last_message = comm_sequences.last_message + 1, updated_at = NOW()
  RETURNING last_message INTO n;
  RETURN 'HDG-MSG-' || y || '-' || lpad(n::text, 6, '0');
END; $$;

CREATE OR REPLACE FUNCTION public.next_comm_job_number(p_company_id UUID)
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE n BIGINT; y TEXT := to_char(CURRENT_DATE, 'YYYY');
BEGIN
  INSERT INTO comm_sequences (company_id, last_job) VALUES (p_company_id, 1)
  ON CONFLICT (company_id) DO UPDATE
    SET last_job = comm_sequences.last_job + 1, updated_at = NOW()
  RETURNING last_job INTO n;
  RETURN 'HDG-DOC-' || y || '-' || lpad(n::text, 6, '0');
END; $$;

-- ============================================================
-- PERMISSIONS
-- ============================================================
INSERT INTO permissions (name, slug, module, description)
SELECT v.name, v.slug, v.module, v.description
FROM (VALUES
  ('View Communications', 'comm.view', 'communications', 'View communication center'),
  ('Manage Communications', 'comm.manage', 'communications', 'Compose and manage messages'),
  ('Send Broadcasts', 'comm.broadcast', 'communications', 'Broadcast and campaigns'),
  ('Manage Comm Templates', 'comm.templates', 'communications', 'Message templates'),
  ('Comm Admin', 'comm.admin', 'communications', 'Providers and rules admin'),
  ('Comm AI Assistant', 'comm.ai', 'communications', 'AI communication assistant')
) AS v(name, slug, module, description)
WHERE NOT EXISTS (SELECT 1 FROM permissions p WHERE p.slug = v.slug OR p.name = v.name);

INSERT INTO role_permissions (role_id, permission_id)
SELECT 'e0000000-0000-4000-8000-000000000001', id FROM permissions
WHERE slug LIKE 'comm.%' OR slug LIKE 'notifications.%'
ON CONFLICT DO NOTHING;

-- ============================================================
-- RLS
-- ============================================================
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'comm_templates','comm_messages','comm_attachments','comm_document_jobs',
    'comm_event_rules','comm_schedules','comm_reminders','comm_campaigns',
    'comm_announcements','comm_providers','comm_delivery_events','comm_audit_log','comm_sequences'
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
DECLARE cid UUID := 'a0000000-0000-4000-8000-000000000001';
BEGIN
  IF NOT EXISTS (SELECT 1 FROM companies WHERE id = cid) THEN
    SELECT id INTO cid FROM companies LIMIT 1;
  END IF;
  IF cid IS NULL THEN RETURN; END IF;

  INSERT INTO comm_templates (company_id, template_code, name, channel, category, subject_template, body_html, body_text)
  VALUES
    (cid, 'PO_APPROVED', 'Purchase Order Approved', 'email', 'procurement',
     'PO {{po_number}} approved — {{company_name}}',
     '<p>Dear {{supplier_name}},</p><p>Purchase Order <strong>{{po_number}}</strong> has been approved.</p><p>Please find the attached PO PDF and terms.</p>',
     'PO {{po_number}} approved. Please see attachment.'),
    (cid, 'INVOICE_GENERATED', 'Invoice Generated', 'email', 'sales',
     'Invoice {{invoice_number}} from {{company_name}}',
     '<p>Dear {{customer_name}},</p><p>Please find invoice <strong>{{invoice_number}}</strong> attached.</p><p>Amount due: {{amount}} {{currency}}</p>',
     'Invoice {{invoice_number}} for {{amount}} {{currency}}.'),
    (cid, 'LEAVE_SUBMITTED', 'Leave Request Submitted', 'email', 'hr',
     'Leave request from {{employee_name}}',
     '<p>A leave request requires your approval.</p><p>Employee: {{employee_name}}<br/>Dates: {{start_date}} – {{end_date}}</p>',
     'Leave request from {{employee_name}}.'),
    (cid, 'LEAVE_APPROVED', 'Leave Approved', 'email', 'hr',
     'Your leave request was approved',
     '<p>Hi {{employee_name}},</p><p>Your leave request has been approved.</p>',
     'Leave approved.'),
    (cid, 'PROD_ORDER_CREATED', 'Production Order Created', 'email', 'production',
     'Production order {{order_number}} released',
     '<p>Production order <strong>{{order_number}}</strong> is ready for shop floor.</p><p>Product: {{product_name}} · Qty: {{quantity}}</p>',
     'PO {{order_number}} released.'),
    (cid, 'QC_FAILED', 'QC Failed Alert', 'email', 'production',
     'QC FAILED — {{batch_number}}',
     '<p><strong>Quality control failed</strong> for batch {{batch_number}}.</p><p>Action required immediately.</p>',
     'QC failed for {{batch_number}}.'),
    (cid, 'PAYMENT_APPROVAL', 'Payment Approval Required', 'email', 'finance',
     'Payment approval required — {{voucher_number}}',
     '<p>A payment voucher requires approval.</p><p>Voucher: {{voucher_number}} · Amount: {{amount}}</p>',
     'Approve payment {{voucher_number}}.'),
    (cid, 'INVOICE_OVERDUE', 'Invoice Overdue', 'email', 'finance',
     'Overdue invoice {{invoice_number}}',
     '<p>Invoice <strong>{{invoice_number}}</strong> is overdue. Please arrange payment.</p>',
     'Invoice {{invoice_number}} is overdue.'),
    (cid, 'EMPLOYEE_HIRED', 'New Hire Notification', 'email', 'hr',
     'New employee onboarded: {{employee_name}}',
     '<p>{{employee_name}} has been hired effective {{hire_date}}.</p><p>Please complete IT, payroll, and security provisioning.</p>',
     'New hire: {{employee_name}}.'),
    (cid, 'GENERIC_NOTIFY', 'Generic Notification', 'email', 'system',
     '{{title}}',
     '<p>{{message}}</p>',
     '{{message}}'),
    (cid, 'SMS_OTP', 'SMS Alert', 'sms', 'system',
     NULL, NULL, '{{message}}'),
    (cid, 'PUSH_ALERT', 'Push Alert', 'push', 'system',
     '{{title}}', NULL, '{{message}}')
  ON CONFLICT (company_id, template_code, channel) DO NOTHING;

  INSERT INTO comm_event_rules (company_id, rule_code, name, event_key, source_module, channels, template_code, subject_template, body_template, audience, attach_docs, priority)
  VALUES
    (cid, 'PO-APPROVED', 'PO Approved → Supplier', 'procurement.po.approved', 'procurement',
     ARRAY['email','in_app'], 'PO_APPROVED', 'PO {{po_number}} approved', 'Purchase order approved and attached.',
     '{"roles":["procurement_officer"],"resolve":["supplier"]}'::jsonb, ARRAY['po'], 'high'),
    (cid, 'INV-GEN', 'Invoice Generated → Customer', 'sales.invoice.generated', 'sales',
     ARRAY['email','in_app'], 'INVOICE_GENERATED', 'Invoice {{invoice_number}}', 'Invoice ready for payment.',
     '{"roles":["sales_manager"],"resolve":["customer"]}'::jsonb, ARRAY['invoice'], 'normal'),
    (cid, 'LEAVE-SUB', 'Leave Submitted → Manager', 'hr.leave.submitted', 'hr',
     ARRAY['email','in_app','hopechat'], 'LEAVE_SUBMITTED', 'Leave approval needed', 'Please review leave request.',
     '{"resolve":["manager"]}'::jsonb, ARRAY[]::TEXT[], 'normal'),
    (cid, 'LEAVE-OK', 'Leave Approved → Employee', 'hr.leave.approved', 'hr',
     ARRAY['email','in_app'], 'LEAVE_APPROVED', 'Leave approved', 'Your leave was approved.',
     '{"resolve":["requestor"]}'::jsonb, ARRAY[]::TEXT[], 'normal'),
    (cid, 'PROD-CREATE', 'Production Order Created', 'production.order.created', 'production',
     ARRAY['in_app','email'], 'PROD_ORDER_CREATED', 'Order {{order_number}}', 'Production order released to floor.',
     '{"roles":["production_manager","production_supervisor"]}'::jsonb, ARRAY['production_order','bom'], 'high'),
    (cid, 'QC-FAIL', 'QC Failed Escalation', 'production.qc.failed', 'production',
     ARRAY['email','in_app','push'], 'QC_FAILED', 'QC FAILED {{batch_number}}', 'Immediate attention required.',
     '{"roles":["quality_assurance","production_manager","operations_manager"]}'::jsonb, ARRAY['qc_certificate'], 'urgent'),
    (cid, 'PAY-APPR', 'Payment Approval', 'finance.payment.pending', 'finance',
     ARRAY['email','in_app'], 'PAYMENT_APPROVAL', 'Payment approval {{voucher_number}}', 'Please approve payment.',
     '{"roles":["finance_manager"]}'::jsonb, ARRAY['payment_voucher'], 'high'),
    (cid, 'INV-OVERDUE', 'Invoice Overdue Collections', 'finance.invoice.overdue', 'finance',
     ARRAY['email','sms','in_app'], 'INVOICE_OVERDUE', 'Overdue {{invoice_number}}', 'Invoice is overdue.',
     '{"roles":["finance_manager"],"resolve":["customer"]}'::jsonb, ARRAY['invoice','statement'], 'high'),
    (cid, 'HIRE', 'Employee Hired Provisioning', 'hr.employee.hired', 'hr',
     ARRAY['email','in_app'], 'EMPLOYEE_HIRED', 'New hire {{employee_name}}', 'Complete onboarding checklist.',
     '{"roles":["hr_manager","super_administrator"]}'::jsonb, ARRAY['offer_letter'], 'normal'),
    (cid, 'GRN', 'Goods Received', 'inventory.grn.posted', 'inventory',
     ARRAY['in_app','email'], 'GENERIC_NOTIFY', 'GRN {{grn_number}} posted', 'Goods received and stocked.',
     '{"roles":["warehouse_manager","procurement_officer"]}'::jsonb, ARRAY['grn'], 'normal')
  ON CONFLICT (company_id, rule_code) DO NOTHING;

  INSERT INTO comm_providers (company_id, provider_code, provider_type, display_name, is_default, is_active, config)
  VALUES
    (cid, 'RESEND', 'resend', 'Resend Email API', true, true, '{"from_env":"RESEND_FROM_EMAIL"}'::jsonb),
    (cid, 'SMS-GW', 'sms', 'SMS Gateway (configurable)', false, false, '{"note":"Configure API endpoint"}'::jsonb),
    (cid, 'WA-BIZ', 'whatsapp', 'WhatsApp Business API', false, false, '{"note":"Configure WA Business"}'::jsonb),
    (cid, 'FCM', 'fcm', 'Firebase Cloud Messaging', false, false, '{"note":"Configure FCM"}'::jsonb)
  ON CONFLICT (company_id, provider_code) DO NOTHING;

  INSERT INTO comm_schedules (company_id, schedule_code, name, schedule_type, cron_expression, channel, template_code, subject, status, next_run_at)
  VALUES
    (cid, 'MONTHLY-STMT', 'Monthly Customer Statements', 'recurring', '0 8 1 * *', 'email', 'GENERIC_NOTIFY', 'Your monthly statement', 'active', date_trunc('month', CURRENT_DATE) + INTERVAL '1 month'),
    (cid, 'PAYSLIP', 'Monthly Payslips', 'recurring', '0 9 25 * *', 'email', 'GENERIC_NOTIFY', 'Your payslip is ready', 'active', date_trunc('month', CURRENT_DATE) + INTERVAL '24 days'),
    (cid, 'CONTRACT-RENEW', 'Contract Renewal Reminders', 'recurring', '0 7 * * 1', 'email', 'GENERIC_NOTIFY', 'Contracts expiring soon', 'active', date_trunc('week', CURRENT_DATE) + INTERVAL '7 days')
  ON CONFLICT (company_id, schedule_code) DO NOTHING;

  INSERT INTO comm_announcements (company_id, title, body, priority, is_pinned, status)
  SELECT cid, 'Welcome to Enterprise Communications',
    'All ERP modules now publish events to the Communication Center. Configure templates, rules, and providers under Communications Admin.',
    'normal', true, 'published'
  WHERE NOT EXISTS (SELECT 1 FROM comm_announcements WHERE company_id = cid LIMIT 1);

  -- Sample queued message for UI
  IF NOT EXISTS (SELECT 1 FROM comm_messages WHERE company_id = cid LIMIT 1) THEN
    INSERT INTO comm_messages (
      company_id, message_number, channel, status, category, source_module, source_event,
      subject, body_text, to_addresses, recipient_summary, priority
    ) VALUES (
      cid, 'HDG-MSG-SEED-001', 'email', 'sent', 'system', 'communications', 'platform.seed',
      'Communication platform activated',
      'Enterprise Communication Hub is live. Event rules and branded templates are ready.',
      ARRAY['admin@hopedesign.co.ug'], 'System Admin', 'normal'
    );
  END IF;

END $$;
