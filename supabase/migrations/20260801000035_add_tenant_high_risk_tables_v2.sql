-- Version 2: same high-risk tables but avoid created_at composite indexes (some tables lack created_at)
BEGIN;

-- For brevity, this migration creates tenant_id, backfills from companies, sets NOT NULL when safe, adds FK and two indexes (tenant, tenant+company), enables RLS and tenant-aware policies.

-- Table list: audit_logs, eal_events, eal_archived_events, bi_report_runs, bi_assistant_sessions, bi_document_jobs, bi_notification_queue, ast_documents, comm_attachments

-- pattern repeated per table

-- audit_logs
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='audit_logs' AND column_name='tenant_id') THEN
    ALTER TABLE public.audit_logs ADD COLUMN tenant_id UUID;
    RAISE NOTICE 'Added tenant_id to audit_logs';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='audit_logs' AND column_name='company_id') THEN
    BEGIN
      UPDATE public.audit_logs t SET tenant_id = c.tenant_id FROM public.companies c WHERE t.company_id = c.id AND (t.tenant_id IS NULL OR t.tenant_id IS DISTINCT FROM c.tenant_id);
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Backfill audit_logs skipped: %', SQLERRM;
    END;
  END IF;
  IF (SELECT count(1) FROM public.audit_logs WHERE tenant_id IS NULL) = 0 THEN
    BEGIN
      ALTER TABLE public.audit_logs ALTER COLUMN tenant_id SET NOT NULL;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Could not set NOT NULL on audit_logs: %', SQLERRM;
    END;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='tenants') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints tc JOIN information_schema.key_column_usage kcu USING (constraint_name, table_schema) WHERE tc.table_name='audit_logs' AND tc.constraint_type='FOREIGN KEY' AND kcu.column_name='tenant_id') THEN
      ALTER TABLE public.audit_logs ADD CONSTRAINT fk_audit_logs_tenant FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT;
    END IF;
  END IF;
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant ON public.audit_logs (tenant_id)';
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_company ON public.audit_logs (tenant_id, company_id)';
  EXECUTE 'ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY';
  EXECUTE 'DROP POLICY IF EXISTS tenant_isolation_restrict ON public.audit_logs';
  EXECUTE 'DROP POLICY IF EXISTS tenant_isolation_select ON public.audit_logs';
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'tenant_company_access') THEN
    EXECUTE $sql$CREATE POLICY tenant_isolation_restrict ON public.audit_logs AS RESTRICTIVE FOR ALL USING (public.tenant_company_access(tenant_id, company_id)) WITH CHECK (public.tenant_company_access(tenant_id, company_id))$sql$;
  ELSE
    EXECUTE $sql$CREATE POLICY tenant_isolation_select ON public.audit_logs FOR SELECT USING (
      tenant_id = public.current_user_tenant() AND EXISTS (SELECT 1 FROM public.user_company_memberships m WHERE m.company_id = public.audit_logs.company_id AND m.user_id = auth.uid() AND m.status = 'active')
    )$sql$;
    EXECUTE $sql$CREATE POLICY tenant_isolation_write ON public.audit_logs FOR ALL USING (tenant_id = public.current_user_tenant()) WITH CHECK (tenant_id = public.current_user_tenant())$sql$;
  END IF;
END$$;

-- eal_events
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='eal_events' AND column_name='tenant_id') THEN
    ALTER TABLE public.eal_events ADD COLUMN tenant_id UUID;
    RAISE NOTICE 'Added tenant_id to eal_events';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='eal_events' AND column_name='company_id') THEN
    BEGIN
      UPDATE public.eal_events t SET tenant_id = c.tenant_id FROM public.companies c WHERE t.company_id = c.id AND (t.tenant_id IS NULL OR t.tenant_id IS DISTINCT FROM c.tenant_id);
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Backfill eal_events skipped: %', SQLERRM;
    END;
  END IF;
  IF (SELECT count(1) FROM public.eal_events WHERE tenant_id IS NULL) = 0 THEN
    BEGIN
      ALTER TABLE public.eal_events ALTER COLUMN tenant_id SET NOT NULL;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Could not set NOT NULL on eal_events: %', SQLERRM;
    END;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='tenants') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints tc JOIN information_schema.key_column_usage kcu USING (constraint_name, table_schema) WHERE tc.table_name='eal_events' AND tc.constraint_type='FOREIGN KEY' AND kcu.column_name='tenant_id') THEN
      ALTER TABLE public.eal_events ADD CONSTRAINT fk_eal_events_tenant FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT;
    END IF;
  END IF;
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_eal_events_tenant ON public.eal_events (tenant_id)';
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_eal_events_tenant_company ON public.eal_events (tenant_id, company_id)';
  EXECUTE 'ALTER TABLE public.eal_events ENABLE ROW LEVEL SECURITY';
  EXECUTE 'DROP POLICY IF EXISTS tenant_isolation_restrict ON public.eal_events';
  EXECUTE 'DROP POLICY IF EXISTS tenant_isolation_select ON public.eal_events';
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'tenant_company_access') THEN
    EXECUTE $sql$CREATE POLICY tenant_isolation_restrict ON public.eal_events AS RESTRICTIVE FOR ALL USING (public.tenant_company_access(tenant_id, company_id)) WITH CHECK (public.tenant_company_access(tenant_id, company_id))$sql$;
  ELSE
    EXECUTE $sql$CREATE POLICY tenant_isolation_select ON public.eal_events FOR SELECT USING (
      tenant_id = public.current_user_tenant() AND EXISTS (SELECT 1 FROM public.user_company_memberships m WHERE m.company_id = public.eal_events.company_id AND m.user_id = auth.uid() AND m.status = 'active')
    )$sql$;
    EXECUTE $sql$CREATE POLICY tenant_isolation_write ON public.eal_events FOR ALL USING (tenant_id = public.current_user_tenant()) WITH CHECK (tenant_id = public.current_user_tenant())$sql$;
  END IF;
END$$;

-- eal_archived_events
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='eal_archived_events' AND column_name='tenant_id') THEN
    ALTER TABLE public.eal_archived_events ADD COLUMN tenant_id UUID;
    RAISE NOTICE 'Added tenant_id to eal_archived_events';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='eal_archived_events' AND column_name='company_id') THEN
    BEGIN
      UPDATE public.eal_archived_events t SET tenant_id = c.tenant_id FROM public.companies c WHERE t.company_id = c.id AND (t.tenant_id IS NULL OR t.tenant_id IS DISTINCT FROM c.tenant_id);
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Backfill eal_archived_events skipped: %', SQLERRM;
    END;
  END IF;
  IF (SELECT count(1) FROM public.eal_archived_events WHERE tenant_id IS NULL) = 0 THEN
    BEGIN
      ALTER TABLE public.eal_archived_events ALTER COLUMN tenant_id SET NOT NULL;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Could not set NOT NULL on eal_archived_events: %', SQLERRM;
    END;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='tenants') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints tc JOIN information_schema.key_column_usage kcu USING (constraint_name, table_schema) WHERE tc.table_name='eal_archived_events' AND tc.constraint_type='FOREIGN KEY' AND kcu.column_name='tenant_id') THEN
      ALTER TABLE public.eal_archived_events ADD CONSTRAINT fk_eal_archived_events_tenant FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT;
    END IF;
  END IF;
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_eal_archived_events_tenant ON public.eal_archived_events (tenant_id)';
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_eal_archived_events_tenant_company ON public.eal_archived_events (tenant_id, company_id)';
  EXECUTE 'ALTER TABLE public.eal_archived_events ENABLE ROW LEVEL SECURITY';
  EXECUTE 'DROP POLICY IF EXISTS tenant_isolation_restrict ON public.eal_archived_events';
  EXECUTE 'DROP POLICY IF EXISTS tenant_isolation_select ON public.eal_archived_events';
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'tenant_company_access') THEN
    EXECUTE $sql$CREATE POLICY tenant_isolation_restrict ON public.eal_archived_events AS RESTRICTIVE FOR ALL USING (public.tenant_company_access(tenant_id, company_id)) WITH CHECK (public.tenant_company_access(tenant_id, company_id))$sql$;
  ELSE
    EXECUTE $sql$CREATE POLICY tenant_isolation_select ON public.eal_archived_events FOR SELECT USING (
      tenant_id = public.current_user_tenant() AND EXISTS (SELECT 1 FROM public.user_company_memberships m WHERE m.company_id = public.eal_archived_events.company_id AND m.user_id = auth.uid() AND m.status = 'active')
    )$sql$;
    EXECUTE $sql$CREATE POLICY tenant_isolation_write ON public.eal_archived_events FOR ALL USING (tenant_id = public.current_user_tenant()) WITH CHECK (tenant_id = public.current_user_tenant())$sql$;
  END IF;
END$$;

-- bi_report_runs
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='bi_report_runs' AND column_name='tenant_id') THEN
    ALTER TABLE public.bi_report_runs ADD COLUMN tenant_id UUID;
    RAISE NOTICE 'Added tenant_id to bi_report_runs';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='bi_report_runs' AND column_name='company_id') THEN
    BEGIN
      UPDATE public.bi_report_runs t SET tenant_id = c.tenant_id FROM public.companies c WHERE t.company_id = c.id AND (t.tenant_id IS NULL OR t.tenant_id IS DISTINCT FROM c.tenant_id);
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Backfill bi_report_runs skipped: %', SQLERRM;
    END;
  END IF;
  IF (SELECT count(1) FROM public.bi_report_runs WHERE tenant_id IS NULL) = 0 THEN
    BEGIN
      ALTER TABLE public.bi_report_runs ALTER COLUMN tenant_id SET NOT NULL;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Could not set NOT NULL on bi_report_runs: %', SQLERRM;
    END;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='tenants') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints tc JOIN information_schema.key_column_usage kcu USING (constraint_name, table_schema) WHERE tc.table_name='bi_report_runs' AND tc.constraint_type='FOREIGN KEY' AND kcu.column_name='tenant_id') THEN
      ALTER TABLE public.bi_report_runs ADD CONSTRAINT fk_bi_report_runs_tenant FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT;
    END IF;
  END IF;
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_bi_report_runs_tenant ON public.bi_report_runs (tenant_id)';
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_bi_report_runs_tenant_company ON public.bi_report_runs (tenant_id, company_id)';
  EXECUTE 'ALTER TABLE public.bi_report_runs ENABLE ROW LEVEL SECURITY';
  EXECUTE 'DROP POLICY IF EXISTS tenant_isolation_restrict ON public.bi_report_runs';
  EXECUTE 'DROP POLICY IF EXISTS tenant_isolation_select ON public.bi_report_runs';
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'tenant_company_access') THEN
    EXECUTE $sql$CREATE POLICY tenant_isolation_restrict ON public.bi_report_runs AS RESTRICTIVE FOR ALL USING (public.tenant_company_access(tenant_id, company_id)) WITH CHECK (public.tenant_company_access(tenant_id, company_id))$sql$;
  ELSE
    EXECUTE $sql$CREATE POLICY tenant_isolation_select ON public.bi_report_runs FOR SELECT USING (
      tenant_id = public.current_user_tenant() AND EXISTS (SELECT 1 FROM public.user_company_memberships m WHERE m.company_id = public.bi_report_runs.company_id AND m.user_id = auth.uid() AND m.status = 'active')
    )$sql$;
    EXECUTE $sql$CREATE POLICY tenant_isolation_write ON public.bi_report_runs FOR ALL USING (tenant_id = public.current_user_tenant()) WITH CHECK (tenant_id = public.current_user_tenant())$sql$;
  END IF;
END$$;

-- bi_assistant_sessions
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='bi_assistant_sessions' AND column_name='tenant_id') THEN
    ALTER TABLE public.bi_assistant_sessions ADD COLUMN tenant_id UUID;
    RAISE NOTICE 'Added tenant_id to bi_assistant_sessions';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='bi_assistant_sessions' AND column_name='company_id') THEN
    BEGIN
      UPDATE public.bi_assistant_sessions t SET tenant_id = c.tenant_id FROM public.companies c WHERE t.company_id = c.id AND (t.tenant_id IS NULL OR t.tenant_id IS DISTINCT FROM c.tenant_id);
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Backfill bi_assistant_sessions skipped: %', SQLERRM;
    END;
  END IF;
  IF (SELECT count(1) FROM public.bi_assistant_sessions WHERE tenant_id IS NULL) = 0 THEN
    BEGIN
      ALTER TABLE public.bi_assistant_sessions ALTER COLUMN tenant_id SET NOT NULL;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Could not set NOT NULL on bi_assistant_sessions: %', SQLERRM;
    END;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='tenants') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints tc JOIN information_schema.key_column_usage kcu USING (constraint_name, table_schema) WHERE tc.table_name='bi_assistant_sessions' AND tc.constraint_type='FOREIGN KEY' AND kcu.column_name='tenant_id') THEN
      ALTER TABLE public.bi_assistant_sessions ADD CONSTRAINT fk_bi_assistant_sessions_tenant FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT;
    END IF;
  END IF;
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_bi_assistant_sessions_tenant ON public.bi_assistant_sessions (tenant_id)';
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_bi_assistant_sessions_tenant_company ON public.bi_assistant_sessions (tenant_id, company_id)';
  EXECUTE 'ALTER TABLE public.bi_assistant_sessions ENABLE ROW LEVEL SECURITY';
  EXECUTE 'DROP POLICY IF EXISTS tenant_isolation_restrict ON public.bi_assistant_sessions';
  EXECUTE 'DROP POLICY IF EXISTS tenant_isolation_select ON public.bi_assistant_sessions';
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'tenant_company_access') THEN
    EXECUTE $sql$CREATE POLICY tenant_isolation_restrict ON public.bi_assistant_sessions AS RESTRICTIVE FOR ALL USING (public.tenant_company_access(tenant_id, company_id)) WITH CHECK (public.tenant_company_access(tenant_id, company_id))$sql$;
  ELSE
    EXECUTE $sql$CREATE POLICY tenant_isolation_select ON public.bi_assistant_sessions FOR SELECT USING (
      tenant_id = public.current_user_tenant() AND EXISTS (SELECT 1 FROM public.user_company_memberships m WHERE m.company_id = public.bi_assistant_sessions.company_id AND m.user_id = auth.uid() AND m.status = 'active')
    )$sql$;
    EXECUTE $sql$CREATE POLICY tenant_isolation_write ON public.bi_assistant_sessions FOR ALL USING (tenant_id = public.current_user_tenant()) WITH CHECK (tenant_id = public.current_user_tenant())$sql$;
  END IF;
END$$;

-- bi_document_jobs
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='bi_document_jobs' AND column_name='tenant_id') THEN
    ALTER TABLE public.bi_document_jobs ADD COLUMN tenant_id UUID;
    RAISE NOTICE 'Added tenant_id to bi_document_jobs';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='bi_document_jobs' AND column_name='company_id') THEN
    BEGIN
      UPDATE public.bi_document_jobs t SET tenant_id = c.tenant_id FROM public.companies c WHERE t.company_id = c.id AND (t.tenant_id IS NULL OR t.tenant_id IS DISTINCT FROM c.tenant_id);
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Backfill bi_document_jobs skipped: %', SQLERRM;
    END;
  END IF;
  IF (SELECT count(1) FROM public.bi_document_jobs WHERE tenant_id IS NULL) = 0 THEN
    BEGIN
      ALTER TABLE public.bi_document_jobs ALTER COLUMN tenant_id SET NOT NULL;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Could not set NOT NULL on bi_document_jobs: %', SQLERRM;
    END;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='tenants') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints tc JOIN information_schema.key_column_usage kcu USING (constraint_name, table_schema) WHERE tc.table_name='bi_document_jobs' AND tc.constraint_type='FOREIGN KEY' AND kcu.column_name='tenant_id') THEN
      ALTER TABLE public.bi_document_jobs ADD CONSTRAINT fk_bi_document_jobs_tenant FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT;
    END IF;
  END IF;
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_bi_document_jobs_tenant ON public.bi_document_jobs (tenant_id)';
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_bi_document_jobs_tenant_company ON public.bi_document_jobs (tenant_id, company_id)';
  EXECUTE 'ALTER TABLE public.bi_document_jobs ENABLE ROW LEVEL SECURITY';
  EXECUTE 'DROP POLICY IF EXISTS tenant_isolation_restrict ON public.bi_document_jobs';
  EXECUTE 'DROP POLICY IF EXISTS tenant_isolation_select ON public.bi_document_jobs';
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'tenant_company_access') THEN
    EXECUTE $sql$CREATE POLICY tenant_isolation_restrict ON public.bi_document_jobs AS RESTRICTIVE FOR ALL USING (public.tenant_company_access(tenant_id, company_id)) WITH CHECK (public.tenant_company_access(tenant_id, company_id))$sql$;
  ELSE
    EXECUTE $sql$CREATE POLICY tenant_isolation_select ON public.bi_document_jobs FOR SELECT USING (
      tenant_id = public.current_user_tenant() AND EXISTS (SELECT 1 FROM public.user_company_memberships m WHERE m.company_id = public.bi_document_jobs.company_id AND m.user_id = auth.uid() AND m.status = 'active')
    )$sql$;
    EXECUTE $sql$CREATE POLICY tenant_isolation_write ON public.bi_document_jobs FOR ALL USING (tenant_id = public.current_user_tenant()) WITH CHECK (tenant_id = public.current_user_tenant())$sql$;
  END IF;
END$$;

-- bi_notification_queue
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='bi_notification_queue' AND column_name='tenant_id') THEN
    ALTER TABLE public.bi_notification_queue ADD COLUMN tenant_id UUID;
    RAISE NOTICE 'Added tenant_id to bi_notification_queue';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='bi_notification_queue' AND column_name='company_id') THEN
    BEGIN
      UPDATE public.bi_notification_queue t SET tenant_id = c.tenant_id FROM public.companies c WHERE t.company_id = c.id AND (t.tenant_id IS NULL OR t.tenant_id IS DISTINCT FROM c.tenant_id);
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Backfill bi_notification_queue skipped: %', SQLERRM;
    END;
  END IF;
  IF (SELECT count(1) FROM public.bi_notification_queue WHERE tenant_id IS NULL) = 0 THEN
    BEGIN
      ALTER TABLE public.bi_notification_queue ALTER COLUMN tenant_id SET NOT NULL;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Could not set NOT NULL on bi_notification_queue: %', SQLERRM;
    END;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='tenants') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints tc JOIN information_schema.key_column_usage kcu USING (constraint_name, table_schema) WHERE tc.table_name='bi_notification_queue' AND tc.constraint_type='FOREIGN KEY' AND kcu.column_name='tenant_id') THEN
      ALTER TABLE public.bi_notification_queue ADD CONSTRAINT fk_bi_notification_queue_tenant FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT;
    END IF;
  END IF;
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_bi_notification_queue_tenant ON public.bi_notification_queue (tenant_id)';
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_bi_notification_queue_tenant_company ON public.bi_notification_queue (tenant_id, company_id)';
  EXECUTE 'ALTER TABLE public.bi_notification_queue ENABLE ROW LEVEL SECURITY';
  EXECUTE 'DROP POLICY IF EXISTS tenant_isolation_restrict ON public.bi_notification_queue';
  EXECUTE 'DROP POLICY IF EXISTS tenant_isolation_select ON public.bi_notification_queue';
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'tenant_company_access') THEN
    EXECUTE $sql$CREATE POLICY tenant_isolation_restrict ON public.bi_notification_queue AS RESTRICTIVE FOR ALL USING (public.tenant_company_access(tenant_id, company_id)) WITH CHECK (public.tenant_company_access(tenant_id, company_id))$sql$;
  ELSE
    EXECUTE $sql$CREATE POLICY tenant_isolation_select ON public.bi_notification_queue FOR SELECT USING (
      tenant_id = public.current_user_tenant() AND EXISTS (SELECT 1 FROM public.user_company_memberships m WHERE m.company_id = public.bi_notification_queue.company_id AND m.user_id = auth.uid() AND m.status = 'active')
    )$sql$;
    EXECUTE $sql$CREATE POLICY tenant_isolation_write ON public.bi_notification_queue FOR ALL USING (tenant_id = public.current_user_tenant()) WITH CHECK (tenant_id = public.current_user_tenant())$sql$;
  END IF;
END$$;

-- ast_documents
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='ast_documents' AND column_name='tenant_id') THEN
    ALTER TABLE public.ast_documents ADD COLUMN tenant_id UUID;
    RAISE NOTICE 'Added tenant_id to ast_documents';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='ast_documents' AND column_name='company_id') THEN
    BEGIN
      UPDATE public.ast_documents t SET tenant_id = c.tenant_id FROM public.companies c WHERE t.company_id = c.id AND (t.tenant_id IS NULL OR t.tenant_id IS DISTINCT FROM c.tenant_id);
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Backfill ast_documents skipped: %', SQLERRM;
    END;
  END IF;
  IF (SELECT count(1) FROM public.ast_documents WHERE tenant_id IS NULL) = 0 THEN
    BEGIN
      ALTER TABLE public.ast_documents ALTER COLUMN tenant_id SET NOT NULL;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Could not set NOT NULL on ast_documents: %', SQLERRM;
    END;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='tenants') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints tc JOIN information_schema.key_column_usage kcu USING (constraint_name, table_schema) WHERE tc.table_name='ast_documents' AND tc.constraint_type='FOREIGN KEY' AND kcu.column_name='tenant_id') THEN
      ALTER TABLE public.ast_documents ADD CONSTRAINT fk_ast_documents_tenant FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT;
    END IF;
  END IF;
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_ast_documents_tenant ON public.ast_documents (tenant_id)';
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_ast_documents_tenant_company ON public.ast_documents (tenant_id, company_id)';
  EXECUTE 'ALTER TABLE public.ast_documents ENABLE ROW LEVEL SECURITY';
  EXECUTE 'DROP POLICY IF EXISTS tenant_isolation_restrict ON public.ast_documents';
  EXECUTE 'DROP POLICY IF EXISTS tenant_isolation_select ON public.ast_documents';
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'tenant_company_access') THEN
    EXECUTE $sql$CREATE POLICY tenant_isolation_restrict ON public.ast_documents AS RESTRICTIVE FOR ALL USING (public.tenant_company_access(tenant_id, company_id)) WITH CHECK (public.tenant_company_access(tenant_id, company_id))$sql$;
  ELSE
    EXECUTE $sql$CREATE POLICY tenant_isolation_select ON public.ast_documents FOR SELECT USING (
      tenant_id = public.current_user_tenant() AND EXISTS (SELECT 1 FROM public.user_company_memberships m WHERE m.company_id = public.ast_documents.company_id AND m.user_id = auth.uid() AND m.status = 'active')
    )$sql$;
    EXECUTE $sql$CREATE POLICY tenant_isolation_write ON public.ast_documents FOR ALL USING (tenant_id = public.current_user_tenant()) WITH CHECK (tenant_id = public.current_user_tenant())$sql$;
  END IF;
END$$;

-- comm_attachments
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='comm_attachments' AND column_name='tenant_id') THEN
    ALTER TABLE public.comm_attachments ADD COLUMN tenant_id UUID;
    RAISE NOTICE 'Added tenant_id to comm_attachments';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='comm_attachments' AND column_name='company_id') THEN
    BEGIN
      UPDATE public.comm_attachments t SET tenant_id = c.tenant_id FROM public.companies c WHERE t.company_id = c.id AND (t.tenant_id IS NULL OR t.tenant_id IS DISTINCT FROM c.tenant_id);
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Backfill comm_attachments skipped: %', SQLERRM;
    END;
  END IF;
  IF (SELECT count(1) FROM public.comm_attachments WHERE tenant_id IS NULL) = 0 THEN
    BEGIN
      ALTER TABLE public.comm_attachments ALTER COLUMN tenant_id SET NOT NULL;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Could not set NOT NULL on comm_attachments: %', SQLERRM;
    END;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='tenants') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints tc JOIN information_schema.key_column_usage kcu USING (constraint_name, table_schema) WHERE tc.table_name='comm_attachments' AND tc.constraint_type='FOREIGN KEY' AND kcu.column_name='tenant_id') THEN
      ALTER TABLE public.comm_attachments ADD CONSTRAINT fk_comm_attachments_tenant FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT;
    END IF;
  END IF;
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_comm_attachments_tenant ON public.comm_attachments (tenant_id)';
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_comm_attachments_tenant_company ON public.comm_attachments (tenant_id, company_id)';
  EXECUTE 'ALTER TABLE public.comm_attachments ENABLE ROW LEVEL SECURITY';
  EXECUTE 'DROP POLICY IF EXISTS tenant_isolation_restrict ON public.comm_attachments';
  EXECUTE 'DROP POLICY IF EXISTS tenant_isolation_select ON public.comm_attachments';
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'tenant_company_access') THEN
    EXECUTE $sql$CREATE POLICY tenant_isolation_restrict ON public.comm_attachments AS RESTRICTIVE FOR ALL USING (public.tenant_company_access(tenant_id, company_id)) WITH CHECK (public.tenant_company_access(tenant_id, company_id))$sql$;
  ELSE
    EXECUTE $sql$CREATE POLICY tenant_isolation_select ON public.comm_attachments FOR SELECT USING (
      tenant_id = public.current_user_tenant() AND EXISTS (SELECT 1 FROM public.user_company_memberships m WHERE m.company_id = public.comm_attachments.company_id AND m.user_id = auth.uid() AND m.status = 'active')
    )$sql$;
    EXECUTE $sql$CREATE POLICY tenant_isolation_write ON public.comm_attachments FOR ALL USING (tenant_id = public.current_user_tenant()) WITH CHECK (tenant_id = public.current_user_tenant())$sql$;
  END IF;
END$$;

COMMIT;