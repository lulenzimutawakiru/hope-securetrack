-- Tenant offboarding control plane + domain_events consumption columns
-- SecureTrack ERP — multi-tenant lifecycle

-- Offboarding / legal hold
CREATE TABLE IF NOT EXISTS public.tenant_offboarding (
  tenant_id uuid PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
  phase text NOT NULL DEFAULT 'export'
    CHECK (phase IN (
      'legal_hold', 'export', 'anonymize', 'purge_scheduled', 'purged', 'cancelled'
    )),
  legal_hold boolean NOT NULL DEFAULT false,
  export_path text,
  export_manifest jsonb DEFAULT '{}'::jsonb,
  purge_after timestamptz,
  requested_by uuid,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.tenant_offboarding ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_offboarding_platform ON public.tenant_offboarding;
CREATE POLICY tenant_offboarding_platform ON public.tenant_offboarding
  FOR ALL
  USING (
    public.is_platform_admin()
    OR public.is_platform_elevated()
    OR public.is_super_admin()
  )
  WITH CHECK (
    public.is_platform_admin()
    OR public.is_platform_elevated()
    OR public.is_super_admin()
  );

-- Domain events status for durable consumers (idempotent)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'domain_events'
  ) THEN
    ALTER TABLE public.domain_events
      ADD COLUMN IF NOT EXISTS status text DEFAULT 'pending',
      ADD COLUMN IF NOT EXISTS last_error text,
      ADD COLUMN IF NOT EXISTS consumed_at timestamptz,
      ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

    ALTER TABLE public.domain_events ENABLE ROW LEVEL SECURITY;

    -- Index for worker claim
    CREATE INDEX IF NOT EXISTS idx_domain_events_status_created
      ON public.domain_events (status, created_at)
      WHERE status = 'pending' OR status IS NULL;

    -- Backfill null status
    UPDATE public.domain_events SET status = 'pending' WHERE status IS NULL;
  END IF;
END $$;

-- Company-scoped read of domain events (writes typically service-role / emit RPC)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'domain_events'
  ) THEN
    DROP POLICY IF EXISTS domain_events_company_select ON public.domain_events;
    CREATE POLICY domain_events_company_select ON public.domain_events
      FOR SELECT
      USING (
        public.is_super_admin()
        OR public.is_platform_admin()
        OR company_id = public.user_company_id()
      );
  END IF;
END $$;

COMMENT ON TABLE public.tenant_offboarding IS
  'Tenant lifecycle: legal hold, export manifest, purge schedule. Platform-only.';
