-- Hope Design Group — HopeChat Enterprise Collaboration Platform
-- Messaging · channels · meetings · files · announcements · AI · bots · knowledge

-- ============================================================
-- PERMISSIONS
-- ============================================================
INSERT INTO permissions (name, slug, module, description)
SELECT v.name, v.slug, v.module, v.description
FROM (VALUES
  ('HopeChat View', 'hc.view', 'hopechat', 'Access HopeChat messaging'),
  ('HopeChat Manage', 'hc.manage', 'hopechat', 'Manage channels, workspaces, bots'),
  ('HopeChat Meetings', 'hc.meetings', 'hopechat', 'Create voice/video meetings'),
  ('HopeChat Announce', 'hc.announce', 'hopechat', 'Broadcast company announcements'),
  ('HopeChat AI', 'hc.ai', 'hopechat', 'Use HopeAI assistant in chat'),
  ('HopeChat Admin', 'hc.admin', 'hopechat', 'Retention, DLP, archive policies')
) AS v(name, slug, module, description)
WHERE NOT EXISTS (SELECT 1 FROM permissions p WHERE p.slug = v.slug);

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE p.slug LIKE 'hc.%'
  AND r.slug IN (
    'super_administrator','managing_director','operations_manager',
    'warehouse_manager','hr_manager','finance_manager','production_manager','auditor'
  )
  AND NOT EXISTS (
    SELECT 1 FROM role_permissions rp WHERE rp.role_id = r.id AND rp.permission_id = p.id
  );

-- All authenticated roles get view by default
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE p.slug IN ('hc.view','hc.meetings','hc.ai')
  AND NOT EXISTS (
    SELECT 1 FROM role_permissions rp WHERE rp.role_id = r.id AND rp.permission_id = p.id
  );

-- ============================================================
-- WORKSPACES · CHANNELS · MEMBERS
-- ============================================================
CREATE TABLE IF NOT EXISTS hc_workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  workspace_code VARCHAR(40) NOT NULL,
  name VARCHAR(150) NOT NULL,
  description TEXT,
  is_default BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, workspace_code)
);

CREATE TABLE IF NOT EXISTS hc_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  workspace_id UUID REFERENCES hc_workspaces(id) ON DELETE SET NULL,
  channel_type VARCHAR(30) NOT NULL DEFAULT 'channel',
  -- dm | group | channel | private | announcement | project | department | bot
  name VARCHAR(150) NOT NULL,
  slug VARCHAR(80),
  description TEXT,
  topic TEXT,
  is_private BOOLEAN DEFAULT false,
  is_archived BOOLEAN DEFAULT false,
  department_code VARCHAR(40),
  project_ref VARCHAR(80),
  branch_name VARCHAR(150),
  icon VARCHAR(40) DEFAULT 'hash',
  last_message_at TIMESTAMPTZ,
  message_count INTEGER DEFAULT 0,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_hc_channels_company ON hc_channels(company_id, channel_type) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_hc_channels_last ON hc_channels(company_id, last_message_at DESC NULLS LAST);

CREATE TABLE IF NOT EXISTS hc_channel_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  channel_id UUID NOT NULL REFERENCES hc_channels(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  role VARCHAR(30) DEFAULT 'member',
  -- owner | admin | member | guest
  muted BOOLEAN DEFAULT false,
  pinned BOOLEAN DEFAULT false,
  last_read_at TIMESTAMPTZ,
  notifications VARCHAR(20) DEFAULT 'all',
  -- all | mentions | none
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(channel_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_hc_members_user ON hc_channel_members(user_id);

-- ============================================================
-- MESSAGES · REACTIONS · PINS
-- ============================================================
CREATE TABLE IF NOT EXISTS hc_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  channel_id UUID NOT NULL REFERENCES hc_channels(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  sender_name VARCHAR(150),
  message_type VARCHAR(30) DEFAULT 'text',
  -- text | file | system | voice | poll | task | announcement | bot
  body TEXT,
  body_html TEXT,
  reply_to_id UUID REFERENCES hc_messages(id) ON DELETE SET NULL,
  thread_root_id UUID REFERENCES hc_messages(id) ON DELETE SET NULL,
  thread_count INTEGER DEFAULT 0,
  is_edited BOOLEAN DEFAULT false,
  is_pinned BOOLEAN DEFAULT false,
  is_encrypted BOOLEAN DEFAULT false,
  scheduled_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}',
  -- mentions, links, erp_refs, poll options
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_hc_messages_channel ON hc_messages(channel_id, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_hc_messages_sender ON hc_messages(sender_id, created_at DESC);

CREATE TABLE IF NOT EXISTS hc_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  message_id UUID NOT NULL REFERENCES hc_messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  emoji VARCHAR(32) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(message_id, user_id, emoji)
);

CREATE TABLE IF NOT EXISTS hc_read_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  message_id UUID NOT NULL REFERENCES hc_messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  read_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(message_id, user_id)
);

-- ============================================================
-- FILES · ANNOUNCEMENTS · MEETINGS
-- ============================================================
CREATE TABLE IF NOT EXISTS hc_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  channel_id UUID REFERENCES hc_channels(id) ON DELETE SET NULL,
  message_id UUID REFERENCES hc_messages(id) ON DELETE SET NULL,
  uploader_id UUID REFERENCES user_profiles(id),
  file_name VARCHAR(255) NOT NULL,
  file_type VARCHAR(80),
  file_size_bytes BIGINT DEFAULT 0,
  storage_url TEXT,
  version_no INTEGER DEFAULT 1,
  is_expired BOOLEAN DEFAULT false,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS hc_announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  body TEXT NOT NULL,
  priority VARCHAR(20) DEFAULT 'normal',
  -- low | normal | high | critical | emergency
  audience VARCHAR(40) DEFAULT 'company',
  -- company | department | branch | role
  audience_value VARCHAR(100),
  require_ack BOOLEAN DEFAULT false,
  ack_count INTEGER DEFAULT 0,
  published_at TIMESTAMPTZ,
  scheduled_at TIMESTAMPTZ,
  status VARCHAR(30) DEFAULT 'draft',
  -- draft | scheduled | published | archived
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS hc_announcement_acks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  announcement_id UUID NOT NULL REFERENCES hc_announcements(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  acked_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(announcement_id, user_id)
);

CREATE TABLE IF NOT EXISTS hc_meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  channel_id UUID REFERENCES hc_channels(id) ON DELETE SET NULL,
  meeting_code VARCHAR(40) NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  host_id UUID REFERENCES user_profiles(id),
  host_name VARCHAR(150),
  status VARCHAR(30) DEFAULT 'scheduled',
  -- scheduled | live | ended | cancelled
  scheduled_start TIMESTAMPTZ,
  scheduled_end TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  join_url TEXT,
  recording_url TEXT,
  agenda TEXT,
  minutes_text TEXT,
  ai_summary TEXT,
  waiting_room BOOLEAN DEFAULT true,
  allow_screen_share BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, meeting_code)
);

CREATE TABLE IF NOT EXISTS hc_meeting_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  meeting_id UUID NOT NULL REFERENCES hc_meetings(id) ON DELETE CASCADE,
  user_id UUID REFERENCES user_profiles(id),
  display_name VARCHAR(150),
  role VARCHAR(30) DEFAULT 'attendee',
  joined_at TIMESTAMPTZ,
  left_at TIMESTAMPTZ,
  status VARCHAR(30) DEFAULT 'invited'
);

-- ============================================================
-- TASKS FROM CHAT · KNOWLEDGE · BOTS · FAVORITES
-- ============================================================
CREATE TABLE IF NOT EXISTS hc_chat_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  channel_id UUID REFERENCES hc_channels(id) ON DELETE SET NULL,
  message_id UUID REFERENCES hc_messages(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  assignee_name VARCHAR(150),
  status VARCHAR(30) DEFAULT 'open',
  -- open | in_progress | done | cancelled
  due_date DATE,
  linked_module VARCHAR(40),
  -- project | service_desk | crm | hr
  linked_ref VARCHAR(80),
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS hc_knowledge (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  slug VARCHAR(120),
  body TEXT NOT NULL,
  category VARCHAR(80),
  tags TEXT[],
  status VARCHAR(30) DEFAULT 'published',
  author_id UUID REFERENCES user_profiles(id),
  view_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS hc_bots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  bot_code VARCHAR(40) NOT NULL,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  domain VARCHAR(40) DEFAULT 'general',
  -- hr | finance | production | it | general
  is_active BOOLEAN DEFAULT true,
  channel_id UUID REFERENCES hc_channels(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, bot_code)
);

CREATE TABLE IF NOT EXISTS hc_favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  target_type VARCHAR(30) NOT NULL,
  -- channel | message | meeting | file
  target_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, target_type, target_id)
);

CREATE TABLE IF NOT EXISTS hc_ai_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  insight_type VARCHAR(40) NOT NULL,
  title TEXT NOT NULL,
  detail TEXT,
  severity VARCHAR(20) DEFAULT 'info',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS hc_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES user_profiles(id),
  action VARCHAR(80) NOT NULL,
  entity_type VARCHAR(60),
  entity_id UUID,
  details TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS hc_user_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  theme VARCHAR(20) DEFAULT 'system',
  density VARCHAR(20) DEFAULT 'comfortable',
  dnd_enabled BOOLEAN DEFAULT false,
  dnd_until TIMESTAMPTZ,
  work_hours JSONB DEFAULT '{"start":"08:00","end":"18:00"}'::jsonb,
  notify_desktop BOOLEAN DEFAULT true,
  notify_email BOOLEAN DEFAULT true,
  notify_mobile BOOLEAN DEFAULT true,
  UNIQUE(user_id)
);

-- ============================================================
-- RLS
-- ============================================================
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'hc_workspaces','hc_channels','hc_channel_members','hc_messages','hc_reactions',
    'hc_read_receipts','hc_files','hc_announcements','hc_announcement_acks',
    'hc_meetings','hc_meeting_participants','hc_chat_tasks','hc_knowledge',
    'hc_bots','hc_favorites','hc_ai_insights','hc_audit_log','hc_user_settings'
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
  wid UUID;
  ch_gen UUID;
  ch_prod UUID;
  ch_fin UUID;
  ch_hr UUID;
  ch_it UUID;
  ch_wh UUID;
  uid UUID;
BEGIN
  SELECT id INTO cid FROM companies ORDER BY created_at LIMIT 1;
  IF cid IS NULL THEN RETURN; END IF;

  SELECT id INTO uid FROM user_profiles WHERE company_id = cid ORDER BY created_at LIMIT 1;

  INSERT INTO hc_workspaces (company_id, workspace_code, name, description, is_default, created_by)
  VALUES (cid, 'HDG', 'Hope Design Group', 'Primary collaboration workspace', true, uid)
  ON CONFLICT (company_id, workspace_code) DO NOTHING;

  SELECT id INTO wid FROM hc_workspaces WHERE company_id = cid AND workspace_code = 'HDG';

  IF NOT EXISTS (SELECT 1 FROM hc_channels WHERE company_id = cid AND slug = 'general') THEN
    INSERT INTO hc_channels (company_id, workspace_id, channel_type, name, slug, description, icon, created_by)
    VALUES
      (cid, wid, 'channel', 'General', 'general', 'Company-wide discussion', 'hash', uid),
      (cid, wid, 'channel', 'Production', 'production', 'Factory floor collaboration', 'factory', uid),
      (cid, wid, 'channel', 'Finance', 'finance', 'Finance & accounting', 'landmark', uid),
      (cid, wid, 'channel', 'HR', 'hr', 'People & culture', 'contact', uid),
      (cid, wid, 'channel', 'IT Support', 'it-support', 'IT help & incidents', 'headphones', uid),
      (cid, wid, 'channel', 'Warehouse', 'warehouse', 'Stock & logistics', 'warehouse', uid),
      (cid, wid, 'channel', 'Sales', 'sales', 'CRM & orders', 'shopping-cart', uid),
      (cid, wid, 'channel', 'Quality', 'quality', 'QC & compliance', 'shield-check', uid),
      (cid, wid, 'channel', 'Security', 'security', 'Security & access', 'shield', uid),
      (cid, wid, 'announcement', 'Announcements', 'announcements', 'Official company broadcasts', 'megaphone', uid),
      (cid, wid, 'channel', 'Dispatch', 'dispatch', 'Drivers & delivery updates', 'truck', uid),
      (cid, wid, 'private', 'Management', 'management', 'Leadership private channel', 'lock', uid);
  END IF;

  SELECT id INTO ch_gen FROM hc_channels WHERE company_id = cid AND slug = 'general';
  SELECT id INTO ch_prod FROM hc_channels WHERE company_id = cid AND slug = 'production';
  SELECT id INTO ch_fin FROM hc_channels WHERE company_id = cid AND slug = 'finance';
  SELECT id INTO ch_hr FROM hc_channels WHERE company_id = cid AND slug = 'hr';
  SELECT id INTO ch_it FROM hc_channels WHERE company_id = cid AND slug = 'it-support';
  SELECT id INTO ch_wh FROM hc_channels WHERE company_id = cid AND slug = 'warehouse';

  -- Add all company users to public channels
  INSERT INTO hc_channel_members (company_id, channel_id, user_id, role)
  SELECT cid, c.id, u.id, CASE WHEN u.id = uid THEN 'admin' ELSE 'member' END
  FROM hc_channels c
  CROSS JOIN user_profiles u
  WHERE c.company_id = cid AND u.company_id = cid AND c.is_private = false
    AND c.deleted_at IS NULL
  ON CONFLICT (channel_id, user_id) DO NOTHING;

  IF NOT EXISTS (SELECT 1 FROM hc_messages WHERE company_id = cid LIMIT 1) AND ch_gen IS NOT NULL THEN
    INSERT INTO hc_messages (company_id, channel_id, sender_id, sender_name, body, message_type)
    VALUES
      (cid, ch_gen, uid, 'System Admin', 'Welcome to **HopeChat** — secure enterprise collaboration for Hope Design Group. Use channels for teams, DMs for 1:1, and @HopeAI for assistance.', 'text'),
      (cid, ch_prod, uid, 'System Admin', 'Production channel ready. Supervisors: report machine issues here — type `/ticket` or convert messages to Service Desk tickets.', 'text'),
      (cid, ch_it, uid, 'System Admin', 'IT Support is live. Password resets and printer issues can be escalated to tickets with one click.', 'text'),
      (cid, ch_wh, uid, 'System Admin', 'Warehouse staff can share damage photos and POD updates here. Link dispatch chats for live delivery status.', 'text');

    UPDATE hc_channels SET last_message_at = NOW(), message_count = 1
    WHERE id IN (ch_gen, ch_prod, ch_it, ch_wh);
  END IF;

  INSERT INTO hc_bots (company_id, bot_code, name, description, domain, is_active)
  VALUES
    (cid, 'HR-BOT', 'HR Bot', 'Leave balance, payslips, policies', 'hr', true),
    (cid, 'FIN-BOT', 'Finance Bot', 'Invoice and payment status', 'finance', true),
    (cid, 'PROD-BOT', 'Production Bot', 'Machine status and production orders', 'production', true),
    (cid, 'IT-BOT', 'IT Bot', 'Password reset and ticket creation', 'it', true),
    (cid, 'HOPE-AI', 'HopeAI', 'Enterprise AI assistant across ERP', 'general', true)
  ON CONFLICT (company_id, bot_code) DO NOTHING;

  IF NOT EXISTS (SELECT 1 FROM hc_knowledge WHERE company_id = cid LIMIT 1) THEN
    INSERT INTO hc_knowledge (company_id, title, slug, body, category, tags, status, author_id)
    VALUES
      (cid, 'How to use HopeChat', 'hopechat-intro',
       E'# HopeChat Quick Start\n\n- Use **#general** for company discussion\n- Create DMs from the Chats panel\n- Start meetings from the Meetings tab\n- Type **@HopeAI** for summaries and ERP help\n- Convert any message to a **Task** or **Ticket**',
       'guides', ARRAY['hopechat','onboarding'], 'published', uid),
      (cid, 'Reporting a machine breakdown', 'machine-breakdown',
       E'1. Open **#production**\n2. Describe the machine and fault\n3. Attach a photo\n4. Click **Create ticket** to open Service Desk\n5. Maintenance is auto-notified',
       'production', ARRAY['maintenance','sop'], 'published', uid);
  END IF;

  INSERT INTO hc_announcements (company_id, title, body, priority, audience, require_ack, status, published_at, created_by)
  SELECT cid, 'HopeChat is live',
    'HopeChat is now available company-wide. Join #general and enable notifications. Critical safety alerts will use priority broadcast.',
    'high', 'company', true, 'published', NOW(), uid
  WHERE NOT EXISTS (SELECT 1 FROM hc_announcements WHERE company_id = cid LIMIT 1);

  INSERT INTO hc_meetings (company_id, meeting_code, title, description, host_id, host_name, status, scheduled_start, scheduled_end, join_url, agenda)
  SELECT cid, 'MTG-STANDUP', 'Daily Operations Standup', 'Cross-functional ops sync',
    uid, 'System Admin', 'scheduled',
    date_trunc('day', NOW()) + INTERVAL '9 hours',
    date_trunc('day', NOW()) + INTERVAL '9 hours 30 minutes',
    '/dashboard/chat/meetings?join=MTG-STANDUP',
    '1. Safety\n2. Production\n3. Dispatch\n4. Blockers'
  WHERE NOT EXISTS (SELECT 1 FROM hc_meetings WHERE company_id = cid LIMIT 1);

  INSERT INTO hc_ai_insights (company_id, insight_type, title, detail, severity)
  SELECT cid, 'engagement', 'Channel adoption tip',
    'Pin #announcements and mute low-priority channels during night shifts to reduce noise.',
    'info'
  WHERE NOT EXISTS (SELECT 1 FROM hc_ai_insights WHERE company_id = cid LIMIT 1);
END $$;
