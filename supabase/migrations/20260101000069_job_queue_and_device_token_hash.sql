-- SecureTrack ERP Phase 2 — Durable job queue + DLQ + device integration token hash

-- ── Job queue ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS job_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  tenant_id UUID,
  job_type VARCHAR(80) NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  -- pending | running | completed | failed | dead
  attempts INT NOT NULL DEFAULT 0,
  max_attempts INT NOT NULL DEFAULT 5,
  priority INT NOT NULL DEFAULT 100,
  run_after TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  locked_at TIMESTAMPTZ,
  locked_by VARCHAR(120),
  last_error TEXT,
  idempotency_key VARCHAR(200),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_job_queue_idempotency
  ON job_queue(idempotency_key)
  WHERE idempotency_key IS NOT NULL
    AND status IN ('pending', 'running', 'completed');

CREATE INDEX IF NOT EXISTS idx_job_queue_poll
  ON job_queue(status, run_after, priority)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_job_queue_company
  ON job_queue(company_id, created_at DESC);

-- ── Dead letter queue ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS job_dead_letters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID,
  company_id UUID,
  tenant_id UUID,
  job_type VARCHAR(80) NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  attempts INT DEFAULT 0,
  last_error TEXT,
  failed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  requeued_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_job_dlq_failed
  ON job_dead_letters(failed_at DESC);

-- RLS: service role / platform workers typically use admin client.
-- Company users may read their own jobs for ops dashboards.
ALTER TABLE job_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_dead_letters ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS job_queue_company ON job_queue;
CREATE POLICY job_queue_company ON job_queue FOR ALL
  USING (
    company_id IS NULL
    OR company_id = public.user_company_id()
    OR public.is_super_admin()
    OR public.is_platform_admin()
  )
  WITH CHECK (
    company_id IS NULL
    OR company_id = public.user_company_id()
    OR public.is_super_admin()
    OR public.is_platform_admin()
  );

DROP POLICY IF EXISTS job_dlq_company ON job_dead_letters;
CREATE POLICY job_dlq_company ON job_dead_letters FOR SELECT
  USING (
    company_id IS NULL
    OR company_id = public.user_company_id()
    OR public.is_super_admin()
    OR public.is_platform_admin()
  );

-- ── Device integration token hash ──────────────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'att_device_integrations'
  ) THEN
    ALTER TABLE att_device_integrations
      ADD COLUMN IF NOT EXISTS push_token_hash TEXT;
    CREATE INDEX IF NOT EXISTS idx_att_integ_token_hash
      ON att_device_integrations(push_token_hash)
      WHERE push_token_hash IS NOT NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'att_devices'
  ) THEN
    ALTER TABLE att_devices
      ADD COLUMN IF NOT EXISTS auth_token_hash TEXT;
    CREATE INDEX IF NOT EXISTS idx_att_devices_auth_hash
      ON att_devices(auth_token_hash)
      WHERE auth_token_hash IS NOT NULL;
  END IF;
END $$;

-- Permissions
INSERT INTO permissions (name, slug, module, description)
SELECT v.name, v.slug, v.module, v.description
FROM (VALUES
  ('Jobs View', 'jobs.view', 'platform', 'View background job queue status'),
  ('Jobs Manage', 'jobs.manage', 'platform', 'Manage and requeue background jobs')
) AS v(name, slug, module, description)
WHERE NOT EXISTS (SELECT 1 FROM permissions p WHERE p.slug = v.slug);

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE p.slug IN ('jobs.view', 'jobs.manage')
  AND r.slug IN ('super_administrator', 'it_administrator', 'managing_director')
  AND NOT EXISTS (
    SELECT 1 FROM role_permissions rp
    WHERE rp.role_id = r.id AND rp.permission_id = p.id
  );
