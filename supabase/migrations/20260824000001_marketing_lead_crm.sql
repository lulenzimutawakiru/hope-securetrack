-- ============================================================
-- MARKETING LEAD CRM
-- Extends contact_messages into a full lead-management surface:
-- qualification pipeline, lead scoring, tracking attribution,
-- follow-ups, attachments, and an activity timeline.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Lead columns on contact_messages
-- ------------------------------------------------------------
ALTER TABLE contact_messages
  ADD COLUMN IF NOT EXISTS phone VARCHAR(40),
  ADD COLUMN IF NOT EXISTS company_size VARCHAR(40),
  ADD COLUMN IF NOT EXISTS preferred_contact_method VARCHAR(20)
    CHECK (preferred_contact_method IN ('email', 'phone_call', 'online_meeting')),
  ADD COLUMN IF NOT EXISTS lead_score SMALLINT NOT NULL DEFAULT 0
    CHECK (lead_score BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS utm_source VARCHAR(120),
  ADD COLUMN IF NOT EXISTS utm_medium VARCHAR(120),
  ADD COLUMN IF NOT EXISTS utm_campaign VARCHAR(120),
  ADD COLUMN IF NOT EXISTS referrer TEXT,
  ADD COLUMN IF NOT EXISTS user_agent VARCHAR(512),
  ADD COLUMN IF NOT EXISTS attachment_path TEXT,
  ADD COLUMN IF NOT EXISTS assigned_to UUID,
  ADD COLUMN IF NOT EXISTS follow_up_at TIMESTAMPTZ;

-- Qualification pipeline is expressed via the existing status column:
--   new -> contacted -> qualified -> converted -> closed
CREATE INDEX IF NOT EXISTS idx_contact_messages_status_created
  ON contact_messages (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_contact_messages_industry
  ON contact_messages (industry);
CREATE INDEX IF NOT EXISTS idx_contact_messages_country
  ON contact_messages (country);
CREATE INDEX IF NOT EXISTS idx_contact_messages_company_size
  ON contact_messages (company_size);
CREATE INDEX IF NOT EXISTS idx_contact_messages_lead_score
  ON contact_messages (lead_score DESC);
CREATE INDEX IF NOT EXISTS idx_contact_messages_assigned
  ON contact_messages (assigned_to) WHERE assigned_to IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_contact_messages_follow_up
  ON contact_messages (follow_up_at) WHERE follow_up_at IS NOT NULL;

-- ------------------------------------------------------------
-- 2. Lead activity timeline
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS lead_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES contact_messages(id) ON DELETE CASCADE,
  action VARCHAR(60) NOT NULL,
  note TEXT,
  actor VARCHAR(150),
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lead_activities_lead
  ON lead_activities (lead_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_lead_activities_action
  ON lead_activities (action);

ALTER TABLE lead_activities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS lead_activities_staff_select ON lead_activities;
CREATE POLICY lead_activities_staff_select ON lead_activities FOR SELECT TO authenticated
  USING (public.is_super_admin());

DROP POLICY IF EXISTS lead_activities_staff_insert ON lead_activities;
CREATE POLICY lead_activities_staff_insert ON lead_activities FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS lead_activities_staff_update ON lead_activities;
CREATE POLICY lead_activities_staff_update ON lead_activities FOR UPDATE TO authenticated
  USING (public.is_super_admin());

-- ------------------------------------------------------------
-- 3. Private storage bucket for lead attachments
--    Writes are performed by the server route with the service
--    role (bypasses RLS); staff can read for review.
-- ------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'marketing-attachments',
  'marketing-attachments',
  false,
  3145728,
  ARRAY[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
    'text/csv',
    'image/jpeg',
    'image/png',
    'image/webp'
  ]::text[]
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS marketing_attachments_staff_read ON storage.objects;
CREATE POLICY marketing_attachments_staff_read ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'marketing-attachments' AND public.is_super_admin());