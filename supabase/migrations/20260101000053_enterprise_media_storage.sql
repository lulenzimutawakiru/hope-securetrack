-- Hope SecureTrack ERP — Enterprise Media & File Storage
-- Supabase Storage buckets + media registry for logos, avatars, attachments

-- ============================================================
-- STORAGE BUCKETS
-- ============================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  (
    'avatars',
    'avatars',
    true,
    5242880,
    ARRAY['image/jpeg','image/png','image/webp','image/gif']::text[]
  ),
  (
    'logos',
    'logos',
    true,
    10485760,
    ARRAY['image/jpeg','image/png','image/webp','image/svg+xml','image/gif']::text[]
  ),
  (
    'attachments',
    'attachments',
    false,
    52428800,
    ARRAY[
      'image/jpeg','image/png','image/webp','image/gif','application/pdf',
      'application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain','text/csv','application/zip'
    ]::text[]
  ),
  (
    'documents',
    'documents',
    false,
    52428800,
    ARRAY[
      'application/pdf','image/jpeg','image/png',
      'application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ]::text[]
  ),
  (
    'media',
    'media',
    true,
    104857600,
    ARRAY[
      'image/jpeg','image/png','image/webp','image/gif',
      'video/mp4','video/webm','audio/mpeg','audio/wav'
    ]::text[]
  ),
  (
    'branding',
    'branding',
    true,
    20971520,
    ARRAY['image/jpeg','image/png','image/webp','image/svg+xml','image/gif','application/pdf']::text[]
  )
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ============================================================
-- STORAGE RLS POLICIES
-- Path convention: {company_id}/{folder}/{filename}
-- Public buckets: anyone can read; authenticated users in company can write
-- Private buckets: company members only
-- ============================================================

-- Drop existing policies if re-running
DO $$
DECLARE p TEXT;
BEGIN
  FOREACH p IN ARRAY ARRAY[
    'media_public_read','media_auth_insert','media_auth_update','media_auth_delete',
    'avatars_public_read','avatars_auth_write','avatars_auth_update','avatars_auth_delete',
    'logos_public_read','logos_auth_write','logos_auth_update','logos_auth_delete',
    'branding_public_read','branding_auth_write','branding_auth_update','branding_auth_delete',
    'attachments_auth_read','attachments_auth_write','attachments_auth_update','attachments_auth_delete',
    'documents_auth_read','documents_auth_write','documents_auth_update','documents_auth_delete'
  ]
  LOOP
    BEGIN
      EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', p);
    EXCEPTION WHEN others THEN NULL;
    END;
  END LOOP;
END $$;

-- Public read for public buckets
CREATE POLICY avatars_public_read ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');
CREATE POLICY logos_public_read ON storage.objects FOR SELECT
  USING (bucket_id = 'logos');
CREATE POLICY branding_public_read ON storage.objects FOR SELECT
  USING (bucket_id = 'branding');
CREATE POLICY media_public_read ON storage.objects FOR SELECT
  USING (bucket_id = 'media');

-- Authenticated write: first folder segment = company_id
CREATE POLICY avatars_auth_write ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = public.user_company_id()::text
  );
CREATE POLICY avatars_auth_update ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = public.user_company_id()::text
  );
CREATE POLICY avatars_auth_delete ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = public.user_company_id()::text
  );

CREATE POLICY logos_auth_write ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'logos'
    AND (storage.foldername(name))[1] = public.user_company_id()::text
  );
CREATE POLICY logos_auth_update ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'logos'
    AND (storage.foldername(name))[1] = public.user_company_id()::text
  );
CREATE POLICY logos_auth_delete ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'logos'
    AND (storage.foldername(name))[1] = public.user_company_id()::text
  );

CREATE POLICY branding_auth_write ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'branding'
    AND (storage.foldername(name))[1] = public.user_company_id()::text
  );
CREATE POLICY branding_auth_update ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'branding'
    AND (storage.foldername(name))[1] = public.user_company_id()::text
  );
CREATE POLICY branding_auth_delete ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'branding'
    AND (storage.foldername(name))[1] = public.user_company_id()::text
  );

CREATE POLICY media_auth_insert ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'media'
    AND (storage.foldername(name))[1] = public.user_company_id()::text
  );
CREATE POLICY media_auth_update ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'media'
    AND (storage.foldername(name))[1] = public.user_company_id()::text
  );
CREATE POLICY media_auth_delete ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'media'
    AND (storage.foldername(name))[1] = public.user_company_id()::text
  );

-- Private buckets
CREATE POLICY attachments_auth_read ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'attachments'
    AND (storage.foldername(name))[1] = public.user_company_id()::text
  );
CREATE POLICY attachments_auth_write ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'attachments'
    AND (storage.foldername(name))[1] = public.user_company_id()::text
  );
CREATE POLICY attachments_auth_update ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'attachments'
    AND (storage.foldername(name))[1] = public.user_company_id()::text
  );
CREATE POLICY attachments_auth_delete ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'attachments'
    AND (storage.foldername(name))[1] = public.user_company_id()::text
  );

CREATE POLICY documents_auth_read ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'documents'
    AND (storage.foldername(name))[1] = public.user_company_id()::text
  );
CREATE POLICY documents_auth_write ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'documents'
    AND (storage.foldername(name))[1] = public.user_company_id()::text
  );
CREATE POLICY documents_auth_update ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'documents'
    AND (storage.foldername(name))[1] = public.user_company_id()::text
  );
CREATE POLICY documents_auth_delete ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'documents'
    AND (storage.foldername(name))[1] = public.user_company_id()::text
  );

-- ============================================================
-- MEDIA REGISTRY (ERP-wide file index)
-- ============================================================
CREATE TABLE IF NOT EXISTS media_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  bucket_id VARCHAR(50) NOT NULL,
  storage_path TEXT NOT NULL,
  public_url TEXT,
  file_name VARCHAR(255) NOT NULL,
  original_name VARCHAR(255),
  mime_type VARCHAR(120),
  file_size_bytes BIGINT DEFAULT 0,
  category VARCHAR(50) DEFAULT 'attachment',
  -- avatar | logo | seal | watermark | document | attachment | media | branding | other
  entity_table VARCHAR(80),
  entity_id UUID,
  entity_field VARCHAR(80),
  -- e.g. logo_url, avatar_url, photo_url, file_url
  uploaded_by UUID REFERENCES user_profiles(id),
  is_public BOOLEAN DEFAULT false,
  checksum VARCHAR(128),
  metadata JSONB DEFAULT '{}'::jsonb,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_media_company ON media_files(company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_media_entity ON media_files(entity_table, entity_id);
CREATE INDEX IF NOT EXISTS idx_media_category ON media_files(company_id, category) WHERE deleted_at IS NULL;

ALTER TABLE media_files ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY media_files_all ON media_files FOR ALL
    USING (company_id = public.user_company_id())
    WITH CHECK (company_id = public.user_company_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- Ensure profile photo column on employees if missing
-- ============================================================
ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS photo_url TEXT;

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- ============================================================
-- PERMISSIONS
-- ============================================================
INSERT INTO permissions (name, slug, module, description)
SELECT v.name, v.slug, v.module, v.description
FROM (VALUES
  ('Upload Media', 'media.upload', 'media', 'Upload logos, avatars, and attachments'),
  ('Manage Media Library', 'media.manage', 'media', 'Browse and delete company media files'),
  ('View Media Library', 'media.view', 'media', 'View media library')
) AS v(name, slug, module, description)
WHERE NOT EXISTS (SELECT 1 FROM permissions p WHERE p.slug = v.slug OR p.name = v.name);

INSERT INTO role_permissions (role_id, permission_id)
SELECT 'e0000000-0000-4000-8000-000000000001', id FROM permissions
WHERE slug LIKE 'media.%'
ON CONFLICT DO NOTHING;
