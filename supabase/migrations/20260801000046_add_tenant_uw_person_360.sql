-- Add tenant_id to uw_person_360 (company-scoped) with safe backfill, FK, indexes, RLS
BEGIN;

-- 1. Add tenant_id column if missing
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname='uw_person_360' AND c.relkind='v') THEN
    RAISE NOTICE 'uw_person_360 is a view; skipping schema changes in this migration';
  ELSE
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='uw_person_360' AND column_name='tenant_id'
    ) THEN
      ALTER TABLE public.uw_person_360 ADD COLUMN tenant_id UUID;
      RAISE NOTICE 'Added tenant_id to uw_person_360';
    ELSE
      RAISE NOTICE 'tenant_id already exists on uw_person_360';
    END IF;
  END IF;
END$$;

-- 2. Backfill tenant_id from companies using company_id (safe guarded)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname='uw_person_360' AND c.relkind='v') THEN
    RAISE NOTICE 'uw_person_360 is a view; skipping backfill in this migration';
  ELSE
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='uw_person_360' AND column_name='company_id') THEN
      BEGIN
        UPDATE public.uw_person_360 t
        SET tenant_id = c.tenant_id
        FROM public.companies c
        WHERE t.company_id = c.id AND (t.tenant_id IS NULL OR t.tenant_id IS DISTINCT FROM c.tenant_id);
        RAISE NOTICE 'Backfilled tenant_id on uw_person_360 from companies';
      EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Backfill skipped for uw_person_360 due to: %', SQLERRM;
      END;
    ELSE
      RAISE NOTICE 'uw_person_360 has no company_id; manual review required';
    END IF;
  END IF;
END$$;

-- 3. Attempt to set NOT NULL if no nulls remain
DO $$
DECLARE cnt int;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname='uw_person_360' AND c.relkind='v') THEN
    RAISE NOTICE 'uw_person_360 is a view; skipping NOT NULL enforcement in this migration';
  ELSE
    SELECT count(1) INTO cnt FROM public.uw_person_360 WHERE tenant_id IS NULL;
    IF cnt = 0 THEN
      BEGIN
        ALTER TABLE public.uw_person_360 ALTER COLUMN tenant_id SET NOT NULL;
        RAISE NOTICE 'Set tenant_id NOT NULL on uw_person_360';
      EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Could not set NOT NULL on uw_person_360: %', SQLERRM;
      END;
    ELSE
      RAISE NOTICE 'tenant_id has % NULL rows on uw_person_360; leaving nullable', cnt;
    END IF;
  END IF;
END$$;

-- 4. Add FK to tenants if tenants table exists and FK not present
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname='uw_person_360' AND c.relkind='v') THEN
    RAISE NOTICE 'uw_person_360 is a view; skipping FK creation in this migration';
  ELSE
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='tenants') THEN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu USING (constraint_name, table_schema)
        WHERE tc.table_name='uw_person_360' AND tc.constraint_type='FOREIGN KEY' AND kcu.column_name='tenant_id'
      ) THEN
        ALTER TABLE public.uw_person_360 ADD CONSTRAINT fk_uw_person_360_tenant FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT;
        RAISE NOTICE 'Added FK tenant->tenants for uw_person_360';
      ELSE
        RAISE NOTICE 'FK on tenant_id already exists for uw_person_360';
      END IF;
    ELSE
      RAISE NOTICE 'tenants table missing; skipping FK for uw_person_360';
    END IF;
  END IF;
END$$;

-- 5. Create indexes
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname='uw_person_360' AND c.relkind='v') THEN
    RAISE NOTICE 'uw_person_360 is a view; skipping index creation in this migration';
  ELSE
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_uw_person_360_tenant ON public.uw_person_360 (tenant_id)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_uw_person_360_tenant_company ON public.uw_person_360 (tenant_id, company_id)';
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='uw_person_360' AND column_name='created_at') THEN
      EXECUTE 'CREATE INDEX IF NOT EXISTS idx_uw_person_360_tenant_created_at ON public.uw_person_360 (tenant_id, created_at)';
    END IF;
    RAISE NOTICE 'Ensured indexes on uw_person_360';
  END IF;
END$$;

-- 6. Enable RLS and add tenant-aware restrictive policy
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname='uw_person_360' AND c.relkind='v') THEN
    RAISE NOTICE 'uw_person_360 is a view; skipping RLS/policy changes in this migration';
  ELSE
    EXECUTE 'ALTER TABLE public.uw_person_360 ENABLE ROW LEVEL SECURITY';
    -- Drop legacy policies
    EXECUTE 'DROP POLICY IF EXISTS tenant_isolation_restrict ON public.uw_person_360';
    EXECUTE 'DROP POLICY IF EXISTS tenant_isolation_select ON public.uw_person_360';
    -- Create restrictive policy using tenant_company_access helper if available
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'tenant_company_access') THEN
      EXECUTE $sql$CREATE POLICY tenant_isolation_restrict ON public.uw_person_360 AS RESTRICTIVE FOR ALL USING (public.tenant_company_access(tenant_id, company_id)) WITH CHECK (public.tenant_company_access(tenant_id, company_id))$sql$;
      RAISE NOTICE 'Created tenant_company_access-based policy on uw_person_360';
    ELSE
      -- Fallback: require tenant match and membership existence
      EXECUTE $sql$CREATE POLICY tenant_isolation_select ON public.uw_person_360 FOR SELECT USING (
        tenant_id = public.current_user_tenant() AND EXISTS (
          SELECT 1 FROM public.user_company_memberships m WHERE m.company_id = public.uw_person_360.company_id AND m.user_id = auth.uid() AND m.status = 'active'
        )
      )$sql$;
      EXECUTE $sql$CREATE POLICY tenant_isolation_write ON public.uw_person_360 FOR ALL USING (tenant_id = public.current_user_tenant()) WITH CHECK (tenant_id = public.current_user_tenant())$sql$;
      RAISE NOTICE 'Created fallback tenant-aware policies on uw_person_360';
    END IF;
  END IF;
END$$;

COMMIT;
