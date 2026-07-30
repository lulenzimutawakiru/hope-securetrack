-- SecureTrack ERP — Workflow instances + device token hash + import audit

-- Durable workflow instance store (engine in app code; state here)
CREATE TABLE IF NOT EXISTS wf_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  definition_id VARCHAR(80) NOT NULL,
  entity_type VARCHAR(80) NOT NULL,
  entity_id UUID,
  entity_code VARCHAR(120),
  status VARCHAR(60) NOT NULL DEFAULT 'draft',
  history JSONB NOT NULL DEFAULT '[]'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES user_profiles(id),
  updated_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_wf_instances_company_def
  ON wf_instances(company_id, definition_id, status);
CREATE INDEX IF NOT EXISTS idx_wf_instances_entity
  ON wf_instances(company_id, entity_type, entity_id);

ALTER TABLE wf_instances ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS wf_instances_company ON wf_instances;
CREATE POLICY wf_instances_company ON wf_instances FOR ALL
  USING (
    company_id = public.user_company_id()
    OR public.is_super_admin()
    OR public.is_platform_admin()
  )
  WITH CHECK (
    company_id = public.user_company_id()
    OR public.is_super_admin()
    OR public.is_platform_admin()
  );

-- Device auth token hash for attendance devices (prefer hash over plaintext)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'att_devices'
  ) THEN
    ALTER TABLE att_devices ADD COLUMN IF NOT EXISTS auth_token_hash TEXT;
    CREATE INDEX IF NOT EXISTS idx_att_devices_token_hash
      ON att_devices(auth_token_hash)
      WHERE auth_token_hash IS NOT NULL;
  END IF;
END $$;

-- Import batch audit
CREATE TABLE IF NOT EXISTS enterprise_import_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  module VARCHAR(40) NOT NULL,
  entity_table VARCHAR(80) NOT NULL,
  file_name VARCHAR(255),
  total_rows INT DEFAULT 0,
  success_rows INT DEFAULT 0,
  error_rows INT DEFAULT 0,
  errors JSONB DEFAULT '[]'::jsonb,
  status VARCHAR(30) DEFAULT 'completed',
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_import_batches_company
  ON enterprise_import_batches(company_id, created_at DESC);

ALTER TABLE enterprise_import_batches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS enterprise_import_batches_company ON enterprise_import_batches;
CREATE POLICY enterprise_import_batches_company ON enterprise_import_batches FOR ALL
  USING (
    company_id = public.user_company_id()
    OR public.is_super_admin()
    OR public.is_platform_admin()
  )
  WITH CHECK (
    company_id = public.user_company_id()
    OR public.is_super_admin()
    OR public.is_platform_admin()
  );

-- Permissions
INSERT INTO permissions (name, slug, module, description)
SELECT v.name, v.slug, v.module, v.description
FROM (VALUES
  ('Workflow Manage', 'workflow.manage', 'platform', 'Start and advance enterprise workflows'),
  ('Data Import', 'data.import', 'platform', 'Bulk CSV import of master data'),
  ('AI Copilot', 'ai.copilot', 'platform', 'Use SecureTrack AI copilot')
) AS v(name, slug, module, description)
WHERE NOT EXISTS (SELECT 1 FROM permissions p WHERE p.slug = v.slug);

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE p.slug IN ('workflow.manage', 'data.import', 'ai.copilot')
  AND r.slug IN (
    'super_administrator', 'managing_director', 'finance_manager',
    'hr_manager', 'payroll_officer', 'it_administrator'
  )
  AND NOT EXISTS (
    SELECT 1 FROM role_permissions rp
    WHERE rp.role_id = r.id AND rp.permission_id = p.id
  );
