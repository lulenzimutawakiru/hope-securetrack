-- Hope Design Group Ltd — Advanced Notification System
-- In-app inbox · multi-channel delivery · preferences · rules · subscriptions

-- Extend core notifications table
ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS category VARCHAR(50) DEFAULT 'system',
  -- system | security | finance | hr | production | inventory | procurement | sales | workflow | report
  ADD COLUMN IF NOT EXISTS priority VARCHAR(20) DEFAULT 'normal',
  -- low | normal | high | urgent
  ADD COLUMN IF NOT EXISTS channels TEXT[] DEFAULT ARRAY['in_app']::TEXT[],
  ADD COLUMN IF NOT EXISTS source_module VARCHAR(50),
  ADD COLUMN IF NOT EXISTS source_event VARCHAR(80),
  ADD COLUMN IF NOT EXISTS entity_type VARCHAR(50),
  ADD COLUMN IF NOT EXISTS entity_id UUID,
  ADD COLUMN IF NOT EXISTS action_label VARCHAR(80),
  ADD COLUMN IF NOT EXISTS action_url VARCHAR(500),
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS group_key VARCHAR(100),
  ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES user_profiles(id);

CREATE INDEX IF NOT EXISTS idx_notifications_user_created
  ON notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_company_unread
  ON notifications(company_id, user_id) WHERE is_read = false AND COALESCE(is_archived, false) = false;
CREATE INDEX IF NOT EXISTS idx_notifications_category
  ON notifications(company_id, category);

-- ============================================================
-- USER PREFERENCES
-- ============================================================
CREATE TABLE IF NOT EXISTS notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  -- global switches
  email_enabled BOOLEAN DEFAULT true,
  in_app_enabled BOOLEAN DEFAULT true,
  sms_enabled BOOLEAN DEFAULT false,
  push_enabled BOOLEAN DEFAULT false,
  whatsapp_enabled BOOLEAN DEFAULT false,
  -- quiet hours (UTC HH:MM)
  quiet_hours_start VARCHAR(5),
  quiet_hours_end VARCHAR(5),
  digest_mode VARCHAR(20) DEFAULT 'instant', -- instant | hourly | daily | weekly
  digest_hour INTEGER DEFAULT 8,
  -- per-category channel map e.g. {"security":{"email":true,"in_app":true}}
  category_settings JSONB DEFAULT '{}',
  -- mute specific event keys
  muted_events TEXT[] DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, user_id)
);

-- ============================================================
-- EVENT RULES (automation)
-- ============================================================
CREATE TABLE IF NOT EXISTS notification_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  rule_code VARCHAR(50) NOT NULL,
  name VARCHAR(150) NOT NULL,
  description TEXT,
  event_key VARCHAR(80) NOT NULL,
  -- e.g. fraud.alert, leave.approved, po.pending, stock.low, invoice.overdue
  category VARCHAR(50) DEFAULT 'system',
  priority VARCHAR(20) DEFAULT 'normal',
  channels TEXT[] DEFAULT ARRAY['in_app','email']::TEXT[],
  template_key VARCHAR(80),
  title_template VARCHAR(255) NOT NULL,
  body_template TEXT,
  link_template VARCHAR(500),
  -- who receives: role slugs, or 'actor', 'manager', 'all_admins'
  audience JSONB DEFAULT '{"roles":["super_administrator"]}',
  conditions JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, rule_code)
);

-- ============================================================
-- TOPIC SUBSCRIPTIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS notification_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  topic VARCHAR(80) NOT NULL,
  -- e.g. report.board_pack, warehouse.alerts, production.line1
  channels TEXT[] DEFAULT ARRAY['in_app']::TEXT[],
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, user_id, topic)
);

-- ============================================================
-- MULTI-CHANNEL DELIVERY LOG
-- ============================================================
CREATE TABLE IF NOT EXISTS notification_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  notification_id UUID REFERENCES notifications(id) ON DELETE SET NULL,
  user_id UUID REFERENCES user_profiles(id),
  channel VARCHAR(30) NOT NULL,
  -- in_app | email | sms | push | whatsapp | teams | slack
  recipient VARCHAR(255),
  status VARCHAR(30) DEFAULT 'pending',
  -- pending | sent | failed | skipped | bounced
  provider VARCHAR(40),
  provider_message_id VARCHAR(150),
  error_message TEXT,
  attempt INTEGER DEFAULT 1,
  payload JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  sent_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_notification_deliveries_status
  ON notification_deliveries(status, created_at DESC);

-- ============================================================
-- BROADCASTS / CAMPAIGNS
-- ============================================================
CREATE TABLE IF NOT EXISTS notification_broadcasts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  category VARCHAR(50) DEFAULT 'system',
  priority VARCHAR(20) DEFAULT 'normal',
  channels TEXT[] DEFAULT ARRAY['in_app']::TEXT[],
  audience JSONB DEFAULT '{"all_users":true}',
  status VARCHAR(30) DEFAULT 'draft',
  -- draft | scheduled | sending | sent | cancelled
  scheduled_for TIMESTAMPTZ,
  sent_count INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  sent_at TIMESTAMPTZ
);

-- ============================================================
-- SEEDS
-- ============================================================
INSERT INTO notification_rules (company_id, rule_code, name, event_key, category, priority, channels, template_key, title_template, body_template, link_template, audience)
VALUES
  ('a0000000-0000-4000-8000-000000000001', 'RULE-FRAUD', 'Fraud Alert Broadcast', 'fraud.alert', 'security', 'urgent',
   ARRAY['in_app','email'], 'security_alert',
   'Fraud alert: {{title}}', '{{message}}', '/dashboard/fraud',
   '{"roles":["super_administrator","auditor"]}'::jsonb),
  ('a0000000-0000-4000-8000-000000000001', 'RULE-LEAVE', 'Leave Decision', 'leave.decision', 'hr', 'normal',
   ARRAY['in_app','email'], 'leave_approved',
   'Leave request {{status}}', 'Your leave from {{start}} to {{end}} was {{status}}.', '/dashboard/hr/leave',
   '{"roles":[],"actor":true}'::jsonb),
  ('a0000000-0000-4000-8000-000000000001', 'RULE-PO', 'PO Approval Needed', 'po.pending_approval', 'procurement', 'high',
   ARRAY['in_app','email'], 'po_sent',
   'PO {{number}} awaiting approval', 'Purchase order {{number}} for {{supplier}} needs your approval.', '/dashboard/procurement/orders',
   '{"roles":["super_administrator"]}'::jsonb),
  ('a0000000-0000-4000-8000-000000000001', 'RULE-STOCK', 'Low Stock Alert', 'inventory.low_stock', 'inventory', 'high',
   ARRAY['in_app','email'], NULL,
   'Low stock: {{product}}', '{{product}} is below reorder level ({{qty}} remaining).', '/dashboard/inventory',
   '{"roles":["super_administrator"]}'::jsonb),
  ('a0000000-0000-4000-8000-000000000001', 'RULE-INV-OVERDUE', 'Invoice Overdue', 'invoice.overdue', 'finance', 'high',
   ARRAY['in_app','email'], 'invoice',
   'Overdue invoice {{number}}', 'Invoice {{number}} for {{amount}} is overdue.', '/dashboard/invoices',
   '{"roles":["super_administrator"]}'::jsonb),
  ('a0000000-0000-4000-8000-000000000001', 'RULE-WELCOME', 'Welcome New User', 'user.created', 'system', 'normal',
   ARRAY['in_app','email'], 'welcome',
   'Welcome to Hope SecureTrack', 'Hello {{name}}, your account has been created.', '/dashboard',
   '{"actor":true}'::jsonb),
  ('a0000000-0000-4000-8000-000000000001', 'RULE-BACKUP', 'Backup Status', 'system.backup', 'system', 'low',
   ARRAY['in_app'], NULL,
   'Backup {{status}}', 'System backup completed with status {{status}}.', '/dashboard/settings/backup',
   '{"roles":["super_administrator"]}'::jsonb),
  ('a0000000-0000-4000-8000-000000000001', 'RULE-AI', 'AI Critical Insight', 'ai.critical', 'report', 'urgent',
   ARRAY['in_app','email'], NULL,
   'AI insight: {{title}}', '{{recommendation}}', '/dashboard/reports/ai',
   '{"roles":["super_administrator"]}'::jsonb)
ON CONFLICT (company_id, rule_code) DO NOTHING;

-- Seed demo in-app notifications for super admin if profile exists
INSERT INTO notifications (company_id, user_id, type, title, message, link, category, priority, channels, source_module, source_event, action_label, action_url, is_read)
SELECT
  'a0000000-0000-4000-8000-000000000001',
  up.id,
  v.ntype::notification_type,
  v.title,
  v.message,
  v.link,
  v.category,
  v.priority,
  ARRAY['in_app']::TEXT[],
  v.module,
  v.event,
  v.action_label,
  v.link,
  false
FROM user_profiles up
CROSS JOIN (VALUES
  ('warning', 'Low stock on security paper SKU-SP-A4', 'Reorder level breached for SKU-SP-A4 at Main Factory warehouse.', '/dashboard/inventory', 'inventory', 'high', 'inventory', 'inventory.low_stock', 'View stock'),
  ('fraud_alert', 'Verification anomaly cluster detected', 'Unusual failure rate from Eastern region in the last 48 hours.', '/dashboard/fraud', 'security', 'urgent', 'security', 'fraud.alert', 'Investigate'),
  ('info', 'Board pack Q2 is ready for review', 'Restricted board paper DOC-BOARD-2026-Q2 is available in Document Intelligence.', '/dashboard/reports/intelligence', 'report', 'normal', 'reports', 'report.ready', 'Open pack'),
  ('success', 'Payroll run approved', 'July payroll run has been approved and is ready for disbursement.', '/dashboard/hr/payroll', 'hr', 'normal', 'hr', 'payroll.approved', 'View payroll'),
  ('warning', 'PO HDG-PO-2026-000042 pending approval', 'High-value purchase order awaits finance / MD approval.', '/dashboard/procurement/orders', 'procurement', 'high', 'procurement', 'po.pending_approval', 'Review PO')
) AS v(ntype, title, message, link, category, priority, module, event, action_label)
WHERE up.company_id = 'a0000000-0000-4000-8000-000000000001'
  AND NOT EXISTS (
    SELECT 1 FROM notifications n
    WHERE n.user_id = up.id AND n.title = v.title
  )
LIMIT 50;

-- Permissions
INSERT INTO permissions (name, slug, module, description) VALUES
  ('View Notifications', 'notifications.view', 'notifications', 'View notification inbox'),
  ('Manage Notifications', 'notifications.manage', 'notifications', 'Broadcast and manage notification rules'),
  ('Send Notifications', 'notifications.send', 'notifications', 'Send notifications to users')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT 'e0000000-0000-4000-8000-000000000001', id FROM permissions
WHERE slug LIKE 'notifications.%'
ON CONFLICT DO NOTHING;

-- RLS
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_broadcasts ENABLE ROW LEVEL SECURITY;

CREATE POLICY notification_preferences_own ON notification_preferences FOR ALL
  USING (user_id = auth.uid() OR public.is_super_admin())
  WITH CHECK (user_id = auth.uid() OR public.is_super_admin());

CREATE POLICY notification_rules_all ON notification_rules FOR ALL
  USING (company_id = public.user_company_id() OR public.is_super_admin())
  WITH CHECK (company_id = public.user_company_id() OR public.is_super_admin());

CREATE POLICY notification_subscriptions_own ON notification_subscriptions FOR ALL
  USING (user_id = auth.uid() OR public.is_super_admin())
  WITH CHECK (user_id = auth.uid() OR public.is_super_admin());

CREATE POLICY notification_deliveries_select ON notification_deliveries FOR SELECT
  USING (user_id = auth.uid() OR public.is_super_admin() OR company_id = public.user_company_id());
CREATE POLICY notification_deliveries_insert ON notification_deliveries FOR INSERT
  WITH CHECK (company_id = public.user_company_id() OR public.is_super_admin());

CREATE POLICY notification_broadcasts_all ON notification_broadcasts FOR ALL
  USING (company_id = public.user_company_id() OR public.is_super_admin())
  WITH CHECK (company_id = public.user_company_id() OR public.is_super_admin());

-- Allow super admins to insert notifications for any user in company
DROP POLICY IF EXISTS notifications_all ON notifications;
CREATE POLICY notifications_select ON notifications FOR SELECT
  USING (user_id = auth.uid() OR public.is_super_admin());
CREATE POLICY notifications_update ON notifications FOR UPDATE
  USING (user_id = auth.uid() OR public.is_super_admin());
CREATE POLICY notifications_insert ON notifications FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    OR public.is_super_admin()
    OR company_id = public.user_company_id()
  );
CREATE POLICY notifications_delete ON notifications FOR DELETE
  USING (user_id = auth.uid() OR public.is_super_admin());
