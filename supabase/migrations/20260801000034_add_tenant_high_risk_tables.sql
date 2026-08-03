-- Safe idempotent migration for high-risk tables: add tenant_id, backfill, FK, indexes, RLS + tenant policies
BEGIN;

-- Helper: raise notice

-- Function to process a single table: pattern repeated per-table for safety

-- 1) audit_logs
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='audit_logs' AND column_name='tenant_id') THEN
    ALTER TABLE public.audit_logs ADD COLUMN tenant_id UUID;
    RAISE NOTICE 'Added tenant_id to audit_logs';
  ELSE
    RAISE NOTICE 'tenant_id already exists on audit_logs';
  END IF;
END$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='audit_logs' AND column_name='company_id') THEN
    BEGIN
      UPDATE public.audit_logs t
      SET tenant_id = c.tenant_id
      FROM public.companies c
      WHERE t.company_id = c.id AND (t.tenant_id IS NULL OR t.tenant_id IS DISTINCT FROM c.tenant_id);
      RAISE NOTICE 'Backfilled tenant_id on audit_logs from companies';
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Backfill skipped for audit_logs due to: %', SQLERRM;
    END;
  ELSE
    RAISE NOTICE 'audit_logs has no company_id; manual review required';
  END IF;
END$$;

DO $$
DECLARE cnt int;
BEGIN
  SELECT count(1) INTO cnt FROM public.audit_logs WHERE tenant_id IS NULL;
  IF cnt = 0 THEN
    BEGIN
      ALTER TABLE public.audit_logs ALTER COLUMN tenant_id SET NOT NULL;
      RAISE NOTICE 'Set tenant_id NOT NULL on audit_logs';
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Could not set NOT NULL on audit_logs: %', SQLERRM;
    END;
  ELSE
    RAISE NOTICE 'tenant_id has % NULL rows on audit_logs; leaving nullable', cnt;
  END IF;
END$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='tenants') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu USING (constraint_name, table_schema)
      WHERE tc.table_name='audit_logs' AND tc.constraint_type='FOREIGN KEY' AND kcu.column_name='tenant_id'
    ) THEN
      ALTER TABLE public.audit_logs ADD CONSTRAINT fk_audit_logs_tenant FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT;
      RAISE NOTICE 'Added FK tenant->tenants for audit_logs';
    ELSE
      RAISE NOTICE 'FK on tenant_id already exists for audit_logs';
    END IF;
  ELSE
    RAISE NOTICE 'tenants table missing; skipping FK for audit_logs';
  END IF;
END$$;

DO $$
BEGIN
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant ON public.audit_logs (tenant_id)';
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_company ON public.audit_logs (tenant_id, company_id)';
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='audit_logs' AND column_name='created_at') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_created_at ON public.audit_logs (tenant_id, created_at)';
  END IF;
  RAISE NOTICE 'Ensured indexes on audit_logs';
END$$;

DO $$
BEGIN
  EXECUTE 'ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY';
  EXECUTE 'DROP POLICY IF EXISTS tenant_isolation_restrict ON public.audit_logs';
  EXECUTE 'DROP POLICY IF EXISTS tenant_isolation_select ON public.audit_logs';
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'tenant_company_access') THEN
    EXECUTE $sql$CREATE POLICY tenant_isolation_restrict ON public.audit_logs AS RESTRICTIVE FOR ALL USING (public.tenant_company_access(tenant_id, company_id)) WITH CHECK (public.tenant_company_access(tenant_id, company_id))$sql$;
    RAISE NOTICE 'Created tenant_company_access-based policy on audit_logs';
  ELSE
    EXECUTE $sql$CREATE POLICY tenant_isolation_select ON public.audit_logs FOR SELECT USING (
      tenant_id = public.current_user_tenant() AND EXISTS (
        SELECT 1 FROM public.user_company_memberships m WHERE m.company_id = public.audit_logs.company_id AND m.user_id = auth.uid() AND m.status = 'active'
      )
    )$sql$;
    EXECUTE $sql$CREATE POLICY tenant_isolation_write ON public.audit_logs FOR ALL USING (tenant_id = public.current_user_tenant()) WITH CHECK (tenant_id = public.current_user_tenant())$sql$;
    RAISE NOTICE 'Created fallback tenant-aware policies on audit_logs';
  END IF;
END$$;

-- 2) eal_events
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='eal_events' AND column_name='tenant_id') THEN
    ALTER TABLE public.eal_events ADD COLUMN tenant_id UUID;
    RAISE NOTICE 'Added tenant_id to eal_events';
  ELSE
    RAISE NOTICE 'tenant_id already exists on eal_events';
  END IF;
END$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='eal_events' AND column_name='company_id') THEN
    BEGIN
      UPDATE public.eal_events t
      SET tenant_id = c.tenant_id
      FROM public.companies c
      WHERE t.company_id = c.id AND (t.tenant_id IS NULL OR t.tenant_id IS DISTINCT FROM c.tenant_id);
      RAISE NOTICE 'Backfilled tenant_id on eal_events from companies';
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Backfill skipped for eal_events due to: %', SQLERRM;
    END;
  ELSE
    RAISE NOTICE 'eal_events has no company_id; manual review required';
  END IF;
END$$;

DO $$
DECLARE cnt int;
BEGIN
  SELECT count(1) INTO cnt FROM public.eal_events WHERE tenant_id IS NULL;
  IF cnt = 0 THEN
    BEGIN
      ALTER TABLE public.eal_events ALTER COLUMN tenant_id SET NOT NULL;
      RAISE NOTICE 'Set tenant_id NOT NULL on eal_events';
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Could not set NOT NULL on eal_events: %', SQLERRM;
    END;
  ELSE
    RAISE NOTICE 'tenant_id has % NULL rows on eal_events; leaving nullable', cnt;
  END IF;
END$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='tenants') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu USING (constraint_name, table_schema)
      WHERE tc.table_name='eal_events' AND tc.constraint_type='FOREIGN KEY' AND kcu.column_name='tenant_id'
    ) THEN
      ALTER TABLE public.eal_events ADD CONSTRAINT fk_eal_events_tenant FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT;
      RAISE NOTICE 'Added FK tenant->tenants for eal_events';
    ELSE
      RAISE NOTICE 'FK on tenant_id already exists for eal_events';
    END IF;
  ELSE
    RAISE NOTICE 'tenants table missing; skipping FK for eal_events';
  END IF;
END$$;

DO $$
BEGIN
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_eal_events_tenant ON public.eal_events (tenant_id)';
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_eal_events_tenant_company ON public.eal_events (tenant_id, company_id)';
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='eal_events' AND column_name='created_at') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_eal_events_tenant_created_at ON public.eal_events (tenant_id, created_at)';
  END IF;
  RAISE NOTICE 'Ensured indexes on eal_events';
END$$;

DO $$
BEGIN
  EXECUTE 'ALTER TABLE public.eal_events ENABLE ROW LEVEL SECURITY';
  EXECUTE 'DROP POLICY IF EXISTS tenant_isolation_restrict ON public.eal_events';
  EXECUTE 'DROP POLICY IF EXISTS tenant_isolation_select ON public.eal_events';
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'tenant_company_access') THEN
    EXECUTE $sql$CREATE POLICY tenant_isolation_restrict ON public.eal_events AS RESTRICTIVE FOR ALL USING (public.tenant_company_access(tenant_id, company_id)) WITH CHECK (public.tenant_company_access(tenant_id, company_id))$sql$;
    RAISE NOTICE 'Created tenant_company_access-based policy on eal_events';
  ELSE
    EXECUTE $sql$CREATE POLICY tenant_isolation_select ON public.eal_events FOR SELECT USING (
      tenant_id = public.current_user_tenant() AND EXISTS (
        SELECT 1 FROM public.user_company_memberships m WHERE m.company_id = public.eal_events.company_id AND m.user_id = auth.uid() AND m.status = 'active'
      )
    )$sql$;
    EXECUTE $sql$CREATE POLICY tenant_isolation_write ON public.eal_events FOR ALL USING (tenant_id = public.current_user_tenant()) WITH CHECK (tenant_id = public.current_user_tenant())$sql$;
    RAISE NOTICE 'Created fallback tenant-aware policies on eal_events';
  END IF;
END$$;

-- 3) eal_archived_events
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='eal_archived_events' AND column_name='tenant_id') THEN
    ALTER TABLE public.eal_archived_events ADD COLUMN tenant_id UUID;
    RAISE NOTICE 'Added tenant_id to eal_archived_events';
  ELSE
    RAISE NOTICE 'tenant_id already exists on eal_archived_events';
  END IF;
END$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='eal_archived_events' AND column_name='company_id') THEN
    BEGIN
      UPDATE public.eal_archived_events t
      SET tenant_id = c.tenant_id
      FROM public.companies c
      WHERE t.company_id = c.id AND (t.tenant_id IS NULL OR t.tenant_id IS DISTINCT FROM c.tenant_id);
      RAISE NOTICE 'Backfilled tenant_id on eal_archived_events from companies';
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Backfill skipped for eal_archived_events due to: %', SQLERRM;
    END;
  ELSE
    RAISE NOTICE 'eal_archived_events has no company_id; manual review required';
  END IF;
END$$;

DO $$
DECLARE cnt int;
BEGIN
  SELECT count(1) INTO cnt FROM public.eal_archived_events WHERE tenant_id IS NULL;
  IF cnt = 0 THEN
    BEGIN
      ALTER TABLE public.eal_archived_events ALTER COLUMN tenant_id SET NOT NULL;
      RAISE NOTICE 'Set tenant_id NOT NULL on eal_archived_events';
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Could not set NOT NULL on eal_archived_events: %', SQLERRM;
    END;
  ELSE
    RAISE NOTICE 'tenant_id has % NULL rows on eal_archived_events; leaving nullable', cnt;
  END IF;
END$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='tenants') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu USING (constraint_name, table_schema)
      WHERE tc.table_name='eal_archived_events' AND tc.constraint_type='FOREIGN KEY' AND kcu.column_name='tenant_id'
    ) THEN
      ALTER TABLE public.eal_archived_events ADD CONSTRAINT fk_eal_archived_events_tenant FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT;
      RAISE NOTICE 'Added FK tenant->tenants for eal_archived_events';
    ELSE
      RAISE NOTICE 'FK on tenant_id already exists for eal_archived_events';
    END IF;
  ELSE
    RAISE NOTICE 'tenants table missing; skipping FK for eal_archived_events';
  END IF;
END$$;

DO $$
BEGIN
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_eal_archived_events_tenant ON public.eal_archived_events (tenant_id)';
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_eal_archived_events_tenant_company ON public.eal_archived_events (tenant_id, company_id)';
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='eal_archived_events' AND column_name='created_at') THEN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='eal_archived_events' AND column_name='created_at') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_eal_archived_events_tenant_created_at ON public.eal_archived_events (tenant_id, created_at)';
  END IF;
  END IF;
  RAISE NOTICE 'Ensured indexes on eal_archived_events';
END$$;

DO $$
BEGIN
  EXECUTE 'ALTER TABLE public.eal_archived_events ENABLE ROW LEVEL SECURITY';
  EXECUTE 'DROP POLICY IF EXISTS tenant_isolation_restrict ON public.eal_archived_events';
  EXECUTE 'DROP POLICY IF EXISTS tenant_isolation_select ON public.eal_archived_events';
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'tenant_company_access') THEN
    EXECUTE $sql$CREATE POLICY tenant_isolation_restrict ON public.eal_archived_events AS RESTRICTIVE FOR ALL USING (public.tenant_company_access(tenant_id, company_id)) WITH CHECK (public.tenant_company_access(tenant_id, company_id))$sql$;
    RAISE NOTICE 'Created tenant_company_access-based policy on eal_archived_events';
  ELSE
    EXECUTE $sql$CREATE POLICY tenant_isolation_select ON public.eal_archived_events FOR SELECT USING (
      tenant_id = public.current_user_tenant() AND EXISTS (
        SELECT 1 FROM public.user_company_memberships m WHERE m.company_id = public.eal_archived_events.company_id AND m.user_id = auth.uid() AND m.status = 'active'
      )
    )$sql$;
    EXECUTE $sql$CREATE POLICY tenant_isolation_write ON public.eal_archived_events FOR ALL USING (tenant_id = public.current_user_tenant()) WITH CHECK (tenant_id = public.current_user_tenant())$sql$;
    RAISE NOTICE 'Created fallback tenant-aware policies on eal_archived_events';
  END IF;
END$$;

-- 4) bi_report_runs
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='bi_report_runs' AND column_name='tenant_id') THEN
    ALTER TABLE public.bi_report_runs ADD COLUMN tenant_id UUID;
    RAISE NOTICE 'Added tenant_id to bi_report_runs';
  ELSE
    RAISE NOTICE 'tenant_id already exists on bi_report_runs';
  END IF;
END$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='bi_report_runs' AND column_name='company_id') THEN
    BEGIN
      UPDATE public.bi_report_runs t
      SET tenant_id = c.tenant_id
      FROM public.companies c
      WHERE t.company_id = c.id AND (t.tenant_id IS NULL OR t.tenant_id IS DISTINCT FROM c.tenant_id);
      RAISE NOTICE 'Backfilled tenant_id on bi_report_runs from companies';
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Backfill skipped for bi_report_runs due to: %', SQLERRM;
    END;
  ELSE
    RAISE NOTICE 'bi_report_runs has no company_id; manual review required';
  END IF;
END$$;

DO $$
DECLARE cnt int;
BEGIN
  SELECT count(1) INTO cnt FROM public.bi_report_runs WHERE tenant_id IS NULL;
  IF cnt = 0 THEN
    BEGIN
      ALTER TABLE public.bi_report_runs ALTER COLUMN tenant_id SET NOT NULL;
      RAISE NOTICE 'Set tenant_id NOT NULL on bi_report_runs';
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Could not set NOT NULL on bi_report_runs: %', SQLERRM;
    END;
  ELSE
    RAISE NOTICE 'tenant_id has % NULL rows on bi_report_runs; leaving nullable', cnt;
  END IF;
END$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='tenants') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu USING (constraint_name, table_schema)
      WHERE tc.table_name='bi_report_runs' AND tc.constraint_type='FOREIGN KEY' AND kcu.column_name='tenant_id'
    ) THEN
      ALTER TABLE public.bi_report_runs ADD CONSTRAINT fk_bi_report_runs_tenant FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT;
      RAISE NOTICE 'Added FK tenant->tenants for bi_report_runs';
    ELSE
      RAISE NOTICE 'FK on tenant_id already exists for bi_report_runs';
    END IF;
  ELSE
    RAISE NOTICE 'tenants table missing; skipping FK for bi_report_runs';
  END IF;
END$$;

DO $$
BEGIN
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_bi_report_runs_tenant ON public.bi_report_runs (tenant_id)';
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_bi_report_runs_tenant_company ON public.bi_report_runs (tenant_id, company_id)';
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='bi_report_runs' AND column_name='created_at') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_bi_report_runs_tenant_created_at ON public.bi_report_runs (tenant_id, created_at)';
  END IF;
  RAISE NOTICE 'Ensured indexes on bi_report_runs';
END$$;

DO $$
BEGIN
  EXECUTE 'ALTER TABLE public.bi_report_runs ENABLE ROW LEVEL SECURITY';
  EXECUTE 'DROP POLICY IF EXISTS tenant_isolation_restrict ON public.bi_report_runs';
  EXECUTE 'DROP POLICY IF EXISTS tenant_isolation_select ON public.bi_report_runs';
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'tenant_company_access') THEN
    EXECUTE $sql$CREATE POLICY tenant_isolation_restrict ON public.bi_report_runs AS RESTRICTIVE FOR ALL USING (public.tenant_company_access(tenant_id, company_id)) WITH CHECK (public.tenant_company_access(tenant_id, company_id))$sql$;
    RAISE NOTICE 'Created tenant_company_access-based policy on bi_report_runs';
  ELSE
    EXECUTE $sql$CREATE POLICY tenant_isolation_select ON public.bi_report_runs FOR SELECT USING (
      tenant_id = public.current_user_tenant() AND EXISTS (
        SELECT 1 FROM public.user_company_memberships m WHERE m.company_id = public.bi_report_runs.company_id AND m.user_id = auth.uid() AND m.status = 'active'
      )
    )$sql$;
    EXECUTE $sql$CREATE POLICY tenant_isolation_write ON public.bi_report_runs FOR ALL USING (tenant_id = public.current_user_tenant()) WITH CHECK (tenant_id = public.current_user_tenant())$sql$;
    RAISE NOTICE 'Created fallback tenant-aware policies on bi_report_runs';
  END IF;
END$$;

-- 5) bi_assistant_sessions
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='bi_assistant_sessions' AND column_name='tenant_id') THEN
    ALTER TABLE public.bi_assistant_sessions ADD COLUMN tenant_id UUID;
    RAISE NOTICE 'Added tenant_id to bi_assistant_sessions';
  ELSE
    RAISE NOTICE 'tenant_id already exists on bi_assistant_sessions';
  END IF;
END$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='bi_assistant_sessions' AND column_name='company_id') THEN
    BEGIN
      UPDATE public.bi_assistant_sessions t
      SET tenant_id = c.tenant_id
      FROM public.companies c
      WHERE t.company_id = c.id AND (t.tenant_id IS NULL OR t.tenant_id IS DISTINCT FROM c.tenant_id);
      RAISE NOTICE 'Backfilled tenant_id on bi_assistant_sessions from companies';
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Backfill skipped for bi_assistant_sessions due to: %', SQLERRM;
    END;
  ELSE
    RAISE NOTICE 'bi_assistant_sessions has no company_id; manual review required';
  END IF;
END$$;

DO $$
DECLARE cnt int;
BEGIN
  SELECT count(1) INTO cnt FROM public.bi_assistant_sessions WHERE tenant_id IS NULL;
  IF cnt = 0 THEN
    BEGIN
      ALTER TABLE public.bi_assistant_sessions ALTER COLUMN tenant_id SET NOT NULL;
      RAISE NOTICE 'Set tenant_id NOT NULL on bi_assistant_sessions';
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Could not set NOT NULL on bi_assistant_sessions: %', SQLERRM;
    END;
  ELSE
    RAISE NOTICE 'tenant_id has % NULL rows on bi_assistant_sessions; leaving nullable', cnt;
  END IF;
END$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='tenants') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu USING (constraint_name, table_schema)
      WHERE tc.table_name='bi_assistant_sessions' AND tc.constraint_type='FOREIGN KEY' AND kcu.column_name='tenant_id'
    ) THEN
      ALTER TABLE public.bi_assistant_sessions ADD CONSTRAINT fk_bi_assistant_sessions_tenant FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT;
      RAISE NOTICE 'Added FK tenant->tenants for bi_assistant_sessions';
    ELSE
      RAISE NOTICE 'FK on tenant_id already exists for bi_assistant_sessions';
    END IF;
  ELSE
    RAISE NOTICE 'tenants table missing; skipping FK for bi_assistant_sessions';
  END IF;
END$$;

DO $$
BEGIN
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_bi_assistant_sessions_tenant ON public.bi_assistant_sessions (tenant_id)';
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_bi_assistant_sessions_tenant_company ON public.bi_assistant_sessions (tenant_id, company_id)';
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='bi_assistant_sessions' AND column_name='created_at') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_bi_assistant_sessions_tenant_created_at ON public.bi_assistant_sessions (tenant_id, created_at)';
  END IF;
  RAISE NOTICE 'Ensured indexes on bi_assistant_sessions';
END$$;

DO $$
BEGIN
  EXECUTE 'ALTER TABLE public.bi_assistant_sessions ENABLE ROW LEVEL SECURITY';
  EXECUTE 'DROP POLICY IF EXISTS tenant_isolation_restrict ON public.bi_assistant_sessions';
  EXECUTE 'DROP POLICY IF EXISTS tenant_isolation_select ON public.bi_assistant_sessions';
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'tenant_company_access') THEN
    EXECUTE $sql$CREATE POLICY tenant_isolation_restrict ON public.bi_assistant_sessions AS RESTRICTIVE FOR ALL USING (public.tenant_company_access(tenant_id, company_id)) WITH CHECK (public.tenant_company_access(tenant_id, company_id))$sql$;
    RAISE NOTICE 'Created tenant_company_access-based policy on bi_assistant_sessions';
  ELSE
    EXECUTE $sql$CREATE POLICY tenant_isolation_select ON public.bi_assistant_sessions FOR SELECT USING (
      tenant_id = public.current_user_tenant() AND EXISTS (
        SELECT 1 FROM public.user_company_memberships m WHERE m.company_id = public.bi_assistant_sessions.company_id AND m.user_id = auth.uid() AND m.status = 'active'
      )
    )$sql$;
    EXECUTE $sql$CREATE POLICY tenant_isolation_write ON public.bi_assistant_sessions FOR ALL USING (tenant_id = public.current_user_tenant()) WITH CHECK (tenant_id = public.current_user_tenant())$sql$;
    RAISE NOTICE 'Created fallback tenant-aware policies on bi_assistant_sessions';
  END IF;
END$$;

-- 6) bi_document_jobs
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='bi_document_jobs' AND column_name='tenant_id') THEN
    ALTER TABLE public.bi_document_jobs ADD COLUMN tenant_id UUID;
    RAISE NOTICE 'Added tenant_id to bi_document_jobs';
  ELSE
    RAISE NOTICE 'tenant_id already exists on bi_document_jobs';
  END IF;
END$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='bi_document_jobs' AND column_name='company_id') THEN
    BEGIN
      UPDATE public.bi_document_jobs t
      SET tenant_id = c.tenant_id
      FROM public.companies c
      WHERE t.company_id = c.id AND (t.tenant_id IS NULL OR t.tenant_id IS DISTINCT FROM c.tenant_id);
      RAISE NOTICE 'Backfilled tenant_id on bi_document_jobs from companies';
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Backfill skipped for bi_document_jobs due to: %', SQLERRM;
    END;
  ELSE
    RAISE NOTICE 'bi_document_jobs has no company_id; manual review required';
  END IF;
END$$;

DO $$
DECLARE cnt int;
BEGIN
  SELECT count(1) INTO cnt FROM public.bi_document_jobs WHERE tenant_id IS NULL;
  IF cnt = 0 THEN
    BEGIN
      ALTER TABLE public.bi_document_jobs ALTER COLUMN tenant_id SET NOT NULL;
      RAISE NOTICE 'Set tenant_id NOT NULL on bi_document_jobs';
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Could not set NOT NULL on bi_document_jobs: %', SQLERRM;
    END;
  ELSE
    RAISE NOTICE 'tenant_id has % NULL rows on bi_document_jobs; leaving nullable', cnt;
  END IF;
END$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='tenants') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu USING (constraint_name, table_schema)
      WHERE tc.table_name='bi_document_jobs' AND tc.constraint_type='FOREIGN KEY' AND kcu.column_name='tenant_id'
    ) THEN
      ALTER TABLE public.bi_document_jobs ADD CONSTRAINT fk_bi_document_jobs_tenant FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT;
      RAISE NOTICE 'Added FK tenant->tenants for bi_document_jobs';
    ELSE
      RAISE NOTICE 'FK on tenant_id already exists for bi_document_jobs';
    END IF;
  ELSE
    RAISE NOTICE 'tenants table missing; skipping FK for bi_document_jobs';
  END IF;
END$$;

DO $$
BEGIN
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_bi_document_jobs_tenant ON public.bi_document_jobs (tenant_id)';
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_bi_document_jobs_tenant_company ON public.bi_document_jobs (tenant_id, company_id)';
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='bi_document_jobs' AND column_name='created_at') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_bi_document_jobs_tenant_created_at ON public.bi_document_jobs (tenant_id, created_at)';
  END IF;
  RAISE NOTICE 'Ensured indexes on bi_document_jobs';
END$$;

DO $$
BEGIN
  EXECUTE 'ALTER TABLE public.bi_document_jobs ENABLE ROW LEVEL SECURITY';
  EXECUTE 'DROP POLICY IF EXISTS tenant_isolation_restrict ON public.bi_document_jobs';
  EXECUTE 'DROP POLICY IF EXISTS tenant_isolation_select ON public.bi_document_jobs';
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'tenant_company_access') THEN
    EXECUTE $sql$CREATE POLICY tenant_isolation_restrict ON public.bi_document_jobs AS RESTRICTIVE FOR ALL USING (public.tenant_company_access(tenant_id, company_id)) WITH CHECK (public.tenant_company_access(tenant_id, company_id))$sql$;
    RAISE NOTICE 'Created tenant_company_access-based policy on bi_document_jobs';
  ELSE
    EXECUTE $sql$CREATE POLICY tenant_isolation_select ON public.bi_document_jobs FOR SELECT USING (
      tenant_id = public.current_user_tenant() AND EXISTS (
        SELECT 1 FROM public.user_company_memberships m WHERE m.company_id = public.bi_document_jobs.company_id AND m.user_id = auth.uid() AND m.status = 'active'
      )
    )$sql$;
    EXECUTE $sql$CREATE POLICY tenant_isolation_write ON public.bi_document_jobs FOR ALL USING (tenant_id = public.current_user_tenant()) WITH CHECK (tenant_id = public.current_user_tenant())$sql$;
    RAISE NOTICE 'Created fallback tenant-aware policies on bi_document_jobs';
  END IF;
END$$;

-- 7) bi_notification_queue
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='bi_notification_queue' AND column_name='tenant_id') THEN
    ALTER TABLE public.bi_notification_queue ADD COLUMN tenant_id UUID;
    RAISE NOTICE 'Added tenant_id to bi_notification_queue';
  ELSE
    RAISE NOTICE 'tenant_id already exists on bi_notification_queue';
  END IF;
END$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='bi_notification_queue' AND column_name='company_id') THEN
    BEGIN
      UPDATE public.bi_notification_queue t
      SET tenant_id = c.tenant_id
      FROM public.companies c
      WHERE t.company_id = c.id AND (t.tenant_id IS NULL OR t.tenant_id IS DISTINCT FROM c.tenant_id);
      RAISE NOTICE 'Backfilled tenant_id on bi_notification_queue from companies';
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Backfill skipped for bi_notification_queue due to: %', SQLERRM;
    END;
  ELSE
    RAISE NOTICE 'bi_notification_queue has no company_id; manual review required';
  END IF;
END$$;

DO $$
DECLARE cnt int;
BEGIN
  SELECT count(1) INTO cnt FROM public.bi_notification_queue WHERE tenant_id IS NULL;
  IF cnt = 0 THEN
    BEGIN
      ALTER TABLE public.bi_notification_queue ALTER COLUMN tenant_id SET NOT NULL;
      RAISE NOTICE 'Set tenant_id NOT NULL on bi_notification_queue';
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Could not set NOT NULL on bi_notification_queue: %', SQLERRM;
    END;
  ELSE
    RAISE NOTICE 'tenant_id has % NULL rows on bi_notification_queue; leaving nullable', cnt;
  END IF;
END$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='tenants') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu USING (constraint_name, table_schema)
      WHERE tc.table_name='bi_notification_queue' AND tc.constraint_type='FOREIGN KEY' AND kcu.column_name='tenant_id'
    ) THEN
      ALTER TABLE public.bi_notification_queue ADD CONSTRAINT fk_bi_notification_queue_tenant FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT;
      RAISE NOTICE 'Added FK tenant->tenants for bi_notification_queue';
    ELSE
      RAISE NOTICE 'FK on tenant_id already exists for bi_notification_queue';
    END IF;
  ELSE
    RAISE NOTICE 'tenants table missing; skipping FK for bi_notification_queue';
  END IF;
END$$;

DO $$
BEGIN
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_bi_notification_queue_tenant ON public.bi_notification_queue (tenant_id)';
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_bi_notification_queue_tenant_company ON public.bi_notification_queue (tenant_id, company_id)';
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='bi_notification_queue' AND column_name='created_at') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_bi_notification_queue_tenant_created_at ON public.bi_notification_queue (tenant_id, created_at)';
  END IF;
  RAISE NOTICE 'Ensured indexes on bi_notification_queue';
END$$;

DO $$
BEGIN
  EXECUTE 'ALTER TABLE public.bi_notification_queue ENABLE ROW LEVEL SECURITY';
  EXECUTE 'DROP POLICY IF EXISTS tenant_isolation_restrict ON public.bi_notification_queue';
  EXECUTE 'DROP POLICY IF EXISTS tenant_isolation_select ON public.bi_notification_queue';
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'tenant_company_access') THEN
    EXECUTE $sql$CREATE POLICY tenant_isolation_restrict ON public.bi_notification_queue AS RESTRICTIVE FOR ALL USING (public.tenant_company_access(tenant_id, company_id)) WITH CHECK (public.tenant_company_access(tenant_id, company_id))$sql$;
    RAISE NOTICE 'Created tenant_company_access-based policy on bi_notification_queue';
  ELSE
    EXECUTE $sql$CREATE POLICY tenant_isolation_select ON public.bi_notification_queue FOR SELECT USING (
      tenant_id = public.current_user_tenant() AND EXISTS (
        SELECT 1 FROM public.user_company_memberships m WHERE m.company_id = public.bi_notification_queue.company_id AND m.user_id = auth.uid() AND m.status = 'active'
      )
    )$sql$;
    EXECUTE $sql$CREATE POLICY tenant_isolation_write ON public.bi_notification_queue FOR ALL USING (tenant_id = public.current_user_tenant()) WITH CHECK (tenant_id = public.current_user_tenant())$sql$;
    RAISE NOTICE 'Created fallback tenant-aware policies on bi_notification_queue';
  END IF;
END$$;

-- 8) ast_documents
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='ast_documents' AND column_name='tenant_id') THEN
    ALTER TABLE public.ast_documents ADD COLUMN tenant_id UUID;
    RAISE NOTICE 'Added tenant_id to ast_documents';
  ELSE
    RAISE NOTICE 'tenant_id already exists on ast_documents';
  END IF;
END$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='ast_documents' AND column_name='company_id') THEN
    BEGIN
      UPDATE public.ast_documents t
      SET tenant_id = c.tenant_id
      FROM public.companies c
      WHERE t.company_id = c.id AND (t.tenant_id IS NULL OR t.tenant_id IS DISTINCT FROM c.tenant_id);
      RAISE NOTICE 'Backfilled tenant_id on ast_documents from companies';
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Backfill skipped for ast_documents due to: %', SQLERRM;
    END;
  ELSE
    RAISE NOTICE 'ast_documents has no company_id; manual review required';
  END IF;
END$$;

DO $$
DECLARE cnt int;
BEGIN
  SELECT count(1) INTO cnt FROM public.ast_documents WHERE tenant_id IS NULL;
  IF cnt = 0 THEN
    BEGIN
      ALTER TABLE public.ast_documents ALTER COLUMN tenant_id SET NOT NULL;
      RAISE NOTICE 'Set tenant_id NOT NULL on ast_documents';
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Could not set NOT NULL on ast_documents: %', SQLERRM;
    END;
  ELSE
    RAISE NOTICE 'tenant_id has % NULL rows on ast_documents; leaving nullable', cnt;
  END IF;
END$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='tenants') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu USING (constraint_name, table_schema)
      WHERE tc.table_name='ast_documents' AND tc.constraint_type='FOREIGN KEY' AND kcu.column_name='tenant_id'
    ) THEN
      ALTER TABLE public.ast_documents ADD CONSTRAINT fk_ast_documents_tenant FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT;
      RAISE NOTICE 'Added FK tenant->tenants for ast_documents';
    ELSE
      RAISE NOTICE 'FK on tenant_id already exists for ast_documents';
    END IF;
  ELSE
    RAISE NOTICE 'tenants table missing; skipping FK for ast_documents';
  END IF;
END$$;

DO $$
BEGIN
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_ast_documents_tenant ON public.ast_documents (tenant_id)';
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_ast_documents_tenant_company ON public.ast_documents (tenant_id, company_id)';
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='ast_documents' AND column_name='created_at') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_ast_documents_tenant_created_at ON public.ast_documents (tenant_id, created_at)';
  END IF;
  RAISE NOTICE 'Ensured indexes on ast_documents';
END$$;

DO $$
BEGIN
  EXECUTE 'ALTER TABLE public.ast_documents ENABLE ROW LEVEL SECURITY';
  EXECUTE 'DROP POLICY IF EXISTS tenant_isolation_restrict ON public.ast_documents';
  EXECUTE 'DROP POLICY IF EXISTS tenant_isolation_select ON public.ast_documents';
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'tenant_company_access') THEN
    EXECUTE $sql$CREATE POLICY tenant_isolation_restrict ON public.ast_documents AS RESTRICTIVE FOR ALL USING (public.tenant_company_access(tenant_id, company_id)) WITH CHECK (public.tenant_company_access(tenant_id, company_id))$sql$;
    RAISE NOTICE 'Created tenant_company_access-based policy on ast_documents';
  ELSE
    EXECUTE $sql$CREATE POLICY tenant_isolation_select ON public.ast_documents FOR SELECT USING (
      tenant_id = public.current_user_tenant() AND EXISTS (
        SELECT 1 FROM public.user_company_memberships m WHERE m.company_id = public.ast_documents.company_id AND m.user_id = auth.uid() AND m.status = 'active'
      )
    )$sql$;
    EXECUTE $sql$CREATE POLICY tenant_isolation_write ON public.ast_documents FOR ALL USING (tenant_id = public.current_user_tenant()) WITH CHECK (tenant_id = public.current_user_tenant())$sql$;
    RAISE NOTICE 'Created fallback tenant-aware policies on ast_documents';
  END IF;
END$$;

-- 9) comm_attachments
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='comm_attachments' AND column_name='tenant_id') THEN
    ALTER TABLE public.comm_attachments ADD COLUMN tenant_id UUID;
    RAISE NOTICE 'Added tenant_id to comm_attachments';
  ELSE
    RAISE NOTICE 'tenant_id already exists on comm_attachments';
  END IF;
END$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='comm_attachments' AND column_name='company_id') THEN
    BEGIN
      UPDATE public.comm_attachments t
      SET tenant_id = c.tenant_id
      FROM public.companies c
      WHERE t.company_id = c.id AND (t.tenant_id IS NULL OR t.tenant_id IS DISTINCT FROM c.tenant_id);
      RAISE NOTICE 'Backfilled tenant_id on comm_attachments from companies';
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Backfill skipped for comm_attachments due to: %', SQLERRM;
    END;
  ELSE
    RAISE NOTICE 'comm_attachments has no company_id; manual review required';
  END IF;
END$$;

DO $$
DECLARE cnt int;
BEGIN
  SELECT count(1) INTO cnt FROM public.comm_attachments WHERE tenant_id IS NULL;
  IF cnt = 0 THEN
    BEGIN
      ALTER TABLE public.comm_attachments ALTER COLUMN tenant_id SET NOT NULL;
      RAISE NOTICE 'Set tenant_id NOT NULL on comm_attachments';
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Could not set NOT NULL on comm_attachments: %', SQLERRM;
    END;
  ELSE
    RAISE NOTICE 'tenant_id has % NULL rows on comm_attachments; leaving nullable', cnt;
  END IF;
END$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='tenants') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu USING (constraint_name, table_schema)
      WHERE tc.table_name='comm_attachments' AND tc.constraint_type='FOREIGN KEY' AND kcu.column_name='tenant_id'
    ) THEN
      ALTER TABLE public.comm_attachments ADD CONSTRAINT fk_comm_attachments_tenant FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT;
      RAISE NOTICE 'Added FK tenant->tenants for comm_attachments';
    ELSE
      RAISE NOTICE 'FK on tenant_id already exists for comm_attachments';
    END IF;
  ELSE
    RAISE NOTICE 'tenants table missing; skipping FK for comm_attachments';
  END IF;
END$$;

DO $$
BEGIN
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_comm_attachments_tenant ON public.comm_attachments (tenant_id)';
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_comm_attachments_tenant_company ON public.comm_attachments (tenant_id, company_id)';
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='comm_attachments' AND column_name='created_at') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_comm_attachments_tenant_created_at ON public.comm_attachments (tenant_id, created_at)';
  END IF;
  RAISE NOTICE 'Ensured indexes on comm_attachments';
END$$;

DO $$
BEGIN
  EXECUTE 'ALTER TABLE public.comm_attachments ENABLE ROW LEVEL SECURITY';
  EXECUTE 'DROP POLICY IF EXISTS tenant_isolation_restrict ON public.comm_attachments';
  EXECUTE 'DROP POLICY IF EXISTS tenant_isolation_select ON public.comm_attachments';
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'tenant_company_access') THEN
    EXECUTE $sql$CREATE POLICY tenant_isolation_restrict ON public.comm_attachments AS RESTRICTIVE FOR ALL USING (public.tenant_company_access(tenant_id, company_id)) WITH CHECK (public.tenant_company_access(tenant_id, company_id))$sql$;
    RAISE NOTICE 'Created tenant_company_access-based policy on comm_attachments';
  ELSE
    EXECUTE $sql$CREATE POLICY tenant_isolation_select ON public.comm_attachments FOR SELECT USING (
      tenant_id = public.current_user_tenant() AND EXISTS (
        SELECT 1 FROM public.user_company_memberships m WHERE m.company_id = public.comm_attachments.company_id AND m.user_id = auth.uid() AND m.status = 'active'
      )
    )$sql$;
    EXECUTE $sql$CREATE POLICY tenant_isolation_write ON public.comm_attachments FOR ALL USING (tenant_id = public.current_user_tenant()) WITH CHECK (tenant_id = public.current_user_tenant())$sql$;
    RAISE NOTICE 'Created fallback tenant-aware policies on comm_attachments';
  END IF;
END$$;

COMMIT;