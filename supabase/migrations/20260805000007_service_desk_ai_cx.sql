-- ============================================================
-- Service Desk: AI virtual agent + customer experience
-- 1. sd_ai_sessions - tenant-scoped AI conversation log with
--    deflection analytics (resolved by AI vs ticket created)
-- 2. sd_nps_responses - hardening: tenant_id + audit columns
--    so the generic CRUD surface enforces tenant isolation
-- ============================================================
BEGIN;

-- ------------------------------------------------------------
-- sd_ai_sessions
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sd_ai_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  channel VARCHAR(40) DEFAULT 'ai',
  -- web | portal | whatsapp | teams | email | chat | mobile | api
  user_message TEXT NOT NULL,
  intent VARCHAR(40),
  -- report_incident | request_fulfillment | question | complaint | escalation_request | acknowledgement | greeting
  sentiment VARCHAR(20),
  -- positive | neutral | negative | frustrated
  sentiment_score REAL,
  urgency VARCHAR(20),
  suggested_category VARCHAR(80),
  suggested_priority VARCHAR(20),
  matched_article_id UUID REFERENCES public.sd_knowledge_articles(id) ON DELETE SET NULL,
  matched_article_title VARCHAR(255),
  ticket_id UUID REFERENCES public.support_tickets(id) ON DELETE SET NULL,
  ticket_number VARCHAR(40),
  assistant_reply TEXT NOT NULL,
  outcome VARCHAR(30) DEFAULT 'resolved_ai',
  -- resolved_ai | ticket_created
  rating INTEGER,
  created_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- tenant backfill
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='sd_ai_sessions' AND column_name='company_id') THEN
    BEGIN
      UPDATE public.sd_ai_sessions t SET tenant_id = c.tenant_id
      FROM public.companies c
      WHERE t.company_id = c.id AND (t.tenant_id IS NULL OR t.tenant_id IS DISTINCT FROM c.tenant_id);
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Backfill sd_ai_sessions skipped: %', SQLERRM;
    END;
  END IF;
END$$;

-- NOT NULL when safe
DO $$
BEGIN
  IF (SELECT count(1) FROM public.sd_ai_sessions WHERE tenant_id IS NULL) = 0 THEN
    BEGIN
      ALTER TABLE public.sd_ai_sessions ALTER COLUMN tenant_id SET NOT NULL;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'sd_ai_sessions tenant NOT NULL skipped: %', SQLERRM;
    END;
  END IF;
END$$;

-- FK + indexes
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='tenants') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints tc JOIN information_schema.key_column_usage kcu USING (constraint_name, table_schema) WHERE tc.table_name='sd_ai_sessions' AND tc.constraint_type='FOREIGN KEY' AND kcu.column_name='tenant_id') THEN
      ALTER TABLE public.sd_ai_sessions ADD CONSTRAINT fk_sd_ai_sessions_tenant FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT;
    END IF;
  END IF;
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_sd_ai_sessions_tenant ON public.sd_ai_sessions (tenant_id)';
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_sd_ai_sessions_tenant_company ON public.sd_ai_sessions (tenant_id, company_id)';
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_sd_ai_sessions_company_created ON public.sd_ai_sessions (company_id, created_at)';
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_sd_ai_sessions_outcome ON public.sd_ai_sessions (outcome)';
END$$;

-- RLS tenant isolation (restrictive, additive to company policy)
DO $$
BEGIN
  EXECUTE 'ALTER TABLE public.sd_ai_sessions ENABLE ROW LEVEL SECURITY';
  EXECUTE 'DROP POLICY IF EXISTS sd_ai_sessions_all ON public.sd_ai_sessions';
  EXECUTE 'CREATE POLICY sd_ai_sessions_all ON public.sd_ai_sessions FOR ALL USING (company_id = public.user_company_id()) WITH CHECK (company_id = public.user_company_id())';
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'tenant_company_access') THEN
    EXECUTE 'DROP POLICY IF EXISTS tenant_isolation_restrict ON public.sd_ai_sessions';
    EXECUTE $sql$CREATE POLICY tenant_isolation_restrict ON public.sd_ai_sessions AS RESTRICTIVE FOR ALL USING (public.tenant_company_access(tenant_id, company_id)) WITH CHECK (public.tenant_company_access(tenant_id, company_id))$sql$;
  END IF;
END$$;

COMMIT;

-- ------------------------------------------------------------
-- sd_nps_responses hardening (tenant_id + audit columns + RLS)
-- ------------------------------------------------------------
BEGIN;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='sd_nps_responses' AND column_name='company_id') THEN
    BEGIN
      ALTER TABLE public.sd_nps_responses ADD COLUMN IF NOT EXISTS tenant_id UUID;
      ALTER TABLE public.sd_nps_responses ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
      ALTER TABLE public.sd_nps_responses ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL;
      ALTER TABLE public.sd_nps_responses ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL;
      ALTER TABLE public.sd_nps_responses ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Alter sd_nps_responses skipped: %', SQLERRM;
    END;
  END IF;
END$$;

-- tenant backfill
DO $$
BEGIN
  UPDATE public.sd_nps_responses t SET tenant_id = c.tenant_id
  FROM public.companies c
  WHERE t.company_id = c.id AND (t.tenant_id IS NULL OR t.tenant_id IS DISTINCT FROM c.tenant_id);
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Backfill sd_nps_responses skipped: %', SQLERRM;
END$$;

-- NOT NULL when safe
DO $$
BEGIN
  IF (SELECT count(1) FROM public.sd_nps_responses WHERE tenant_id IS NULL) = 0 THEN
    BEGIN
      ALTER TABLE public.sd_nps_responses ALTER COLUMN tenant_id SET NOT NULL;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'sd_nps_responses tenant NOT NULL skipped: %', SQLERRM;
    END;
  END IF;
END$$;

-- FK + indexes
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='tenants') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints tc JOIN information_schema.key_column_usage kcu USING (constraint_name, table_schema) WHERE tc.table_name='sd_nps_responses' AND tc.constraint_type='FOREIGN KEY' AND kcu.column_name='tenant_id') THEN
      ALTER TABLE public.sd_nps_responses ADD CONSTRAINT fk_sd_nps_responses_tenant FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT;
    END IF;
  END IF;
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_sd_nps_responses_tenant ON public.sd_nps_responses (tenant_id)';
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_sd_nps_responses_tenant_company ON public.sd_nps_responses (tenant_id, company_id)';
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_sd_nps_responses_company_created ON public.sd_nps_responses (company_id, created_at)';
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_sd_nps_responses_ticket ON public.sd_nps_responses (ticket_id)';
END$$;

-- RLS tenant isolation (restrictive, additive to existing company policy)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'tenant_company_access') THEN
    EXECUTE 'DROP POLICY IF EXISTS tenant_isolation_restrict ON public.sd_nps_responses';
    EXECUTE $sql$CREATE POLICY tenant_isolation_restrict ON public.sd_nps_responses AS RESTRICTIVE FOR ALL USING (public.tenant_company_access(tenant_id, company_id)) WITH CHECK (public.tenant_company_access(tenant_id, company_id))$sql$;
  END IF;
END$$;

COMMIT;