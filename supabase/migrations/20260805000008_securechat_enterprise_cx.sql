-- ============================================================
-- SecureChat: enterprise collaboration + AI copilot layer
-- 1. hc_approvals - in-chat approval cards (PO, payment, leave,
--    expense, asset transfer, contract, service request)
-- 2. hc_copilot_sessions - tenant-scoped AI copilot log with
--    permission audit for ERP-aware answers
-- 3. hc_external_participants - controlled external communication
--    (customers, suppliers, partners, candidates)
-- All tables: tenant_id + audit columns + restrictive RLS so the
-- generic CRUD surface enforces multi-tenant isolation.
-- ============================================================
BEGIN;

-- ------------------------------------------------------------
-- hc_approvals
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.hc_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  channel_id UUID REFERENCES public.hc_channels(id) ON DELETE SET NULL,
  message_id UUID REFERENCES public.hc_messages(id) ON DELETE SET NULL,
  entity_type VARCHAR(60) NOT NULL,
  -- purchase_order | payment | leave | recruitment | payroll | expense | asset_transfer | contract | service_request | other
  entity_id VARCHAR(120),
  entity_label VARCHAR(255),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  amount NUMERIC(18,2),
  currency VARCHAR(10) DEFAULT 'UGX',
  requester_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  requester_name VARCHAR(150),
  approver_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  approver_name VARCHAR(150),
  status VARCHAR(30) DEFAULT 'pending',
  -- pending | approved | rejected | changes_requested | cancelled
  priority VARCHAR(20) DEFAULT 'normal',
  decision_comment TEXT,
  decided_at TIMESTAMPTZ,
  decided_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  metadata JSONB DEFAULT '{}',
  created_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- tenant backfill
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='hc_approvals' AND column_name='company_id') THEN
    BEGIN
      UPDATE public.hc_approvals t SET tenant_id = c.tenant_id
      FROM public.companies c
      WHERE t.company_id = c.id AND (t.tenant_id IS NULL OR t.tenant_id IS DISTINCT FROM c.tenant_id);
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Backfill hc_approvals skipped: %', SQLERRM;
    END;
  END IF;
END$$;

-- NOT NULL when safe
DO $$
BEGIN
  IF (SELECT count(1) FROM public.hc_approvals WHERE tenant_id IS NULL) = 0 THEN
    BEGIN
      ALTER TABLE public.hc_approvals ALTER COLUMN tenant_id SET NOT NULL;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'hc_approvals tenant NOT NULL skipped: %', SQLERRM;
    END;
  END IF;
END$$;

-- FK + indexes
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='tenants') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints tc JOIN information_schema.key_column_usage kcu USING (constraint_name, table_schema) WHERE tc.table_name='hc_approvals' AND tc.constraint_type='FOREIGN KEY' AND kcu.column_name='tenant_id') THEN
      ALTER TABLE public.hc_approvals ADD CONSTRAINT fk_hc_approvals_tenant FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT;
    END IF;
  END IF;
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_hc_approvals_tenant_company ON public.hc_approvals (tenant_id, company_id)';
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_hc_approvals_company_status ON public.hc_approvals (company_id, status)';
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_hc_approvals_approver ON public.hc_approvals (approver_id, status)';
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_hc_approvals_created ON public.hc_approvals (company_id, created_at DESC)';
END$$;

-- RLS tenant isolation (restrictive, additive to company policy)
DO $$
BEGIN
  EXECUTE 'ALTER TABLE public.hc_approvals ENABLE ROW LEVEL SECURITY';
  EXECUTE 'DROP POLICY IF EXISTS hc_approvals_all ON public.hc_approvals';
  EXECUTE 'CREATE POLICY hc_approvals_all ON public.hc_approvals FOR ALL USING (company_id = public.user_company_id()) WITH CHECK (company_id = public.user_company_id())';
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'tenant_company_access') THEN
    EXECUTE 'DROP POLICY IF EXISTS tenant_isolation_restrict ON public.hc_approvals';
    EXECUTE $sql$CREATE POLICY tenant_isolation_restrict ON public.hc_approvals AS RESTRICTIVE FOR ALL USING (public.tenant_company_access(tenant_id, company_id)) WITH CHECK (public.tenant_company_access(tenant_id, company_id))$sql$;
  END IF;
END$$;

-- ------------------------------------------------------------
-- hc_copilot_sessions
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.hc_copilot_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  agent_domain VARCHAR(40) DEFAULT 'general',
  -- hr | finance | it | assets | management | approval | general
  user_message TEXT NOT NULL,
  intent VARCHAR(60),
  permission_granted BOOLEAN DEFAULT true,
  permission_reason VARCHAR(255),
  answer TEXT NOT NULL,
  actions JSONB DEFAULT '[]',
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
  UPDATE public.hc_copilot_sessions t SET tenant_id = c.tenant_id
  FROM public.companies c
  WHERE t.company_id = c.id AND (t.tenant_id IS NULL OR t.tenant_id IS DISTINCT FROM c.tenant_id);
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Backfill hc_copilot_sessions skipped: %', SQLERRM;
END$$;

-- NOT NULL when safe
DO $$
BEGIN
  IF (SELECT count(1) FROM public.hc_copilot_sessions WHERE tenant_id IS NULL) = 0 THEN
    BEGIN
      ALTER TABLE public.hc_copilot_sessions ALTER COLUMN tenant_id SET NOT NULL;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'hc_copilot_sessions tenant NOT NULL skipped: %', SQLERRM;
    END;
  END IF;
END$$;

-- FK + indexes
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='tenants') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints tc JOIN information_schema.key_column_usage kcu USING (constraint_name, table_schema) WHERE tc.table_name='hc_copilot_sessions' AND tc.constraint_type='FOREIGN KEY' AND kcu.column_name='tenant_id') THEN
      ALTER TABLE public.hc_copilot_sessions ADD CONSTRAINT fk_hc_copilot_sessions_tenant FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT;
    END IF;
  END IF;
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_hc_copilot_tenant_company ON public.hc_copilot_sessions (tenant_id, company_id)';
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_hc_copilot_company_created ON public.hc_copilot_sessions (company_id, created_at DESC)';
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_hc_copilot_domain ON public.hc_copilot_sessions (agent_domain)';
END$$;

-- RLS tenant isolation (restrictive, additive to company policy)
DO $$
BEGIN
  EXECUTE 'ALTER TABLE public.hc_copilot_sessions ENABLE ROW LEVEL SECURITY';
  EXECUTE 'DROP POLICY IF EXISTS hc_copilot_sessions_all ON public.hc_copilot_sessions';
  EXECUTE 'CREATE POLICY hc_copilot_sessions_all ON public.hc_copilot_sessions FOR ALL USING (company_id = public.user_company_id()) WITH CHECK (company_id = public.user_company_id())';
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'tenant_company_access') THEN
    EXECUTE 'DROP POLICY IF EXISTS tenant_isolation_restrict ON public.hc_copilot_sessions';
    EXECUTE $sql$CREATE POLICY tenant_isolation_restrict ON public.hc_copilot_sessions AS RESTRICTIVE FOR ALL USING (public.tenant_company_access(tenant_id, company_id)) WITH CHECK (public.tenant_company_access(tenant_id, company_id))$sql$;
  END IF;
END$$;

-- ------------------------------------------------------------
-- hc_external_participants
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.hc_external_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  external_type VARCHAR(30) NOT NULL,
  -- customer | supplier | vendor | partner | candidate
  display_name VARCHAR(150) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(50),
  token_hash VARCHAR(64),
  channel_id UUID REFERENCES public.hc_channels(id) ON DELETE SET NULL,
  access_scope VARCHAR(30) DEFAULT 'conversation',
  -- conversation | self_service | approvals
  is_active BOOLEAN DEFAULT true,
  last_seen_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- tenant backfill
DO $$
BEGIN
  UPDATE public.hc_external_participants t SET tenant_id = c.tenant_id
  FROM public.companies c
  WHERE t.company_id = c.id AND (t.tenant_id IS NULL OR t.tenant_id IS DISTINCT FROM c.tenant_id);
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Backfill hc_external_participants skipped: %', SQLERRM;
END$$;

-- NOT NULL when safe
DO $$
BEGIN
  IF (SELECT count(1) FROM public.hc_external_participants WHERE tenant_id IS NULL) = 0 THEN
    BEGIN
      ALTER TABLE public.hc_external_participants ALTER COLUMN tenant_id SET NOT NULL;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'hc_external_participants tenant NOT NULL skipped: %', SQLERRM;
    END;
  END IF;
END$$;

-- FK + indexes
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='tenants') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints tc JOIN information_schema.key_column_usage kcu USING (constraint_name, table_schema) WHERE tc.table_name='hc_external_participants' AND tc.constraint_type='FOREIGN KEY' AND kcu.column_name='tenant_id') THEN
      ALTER TABLE public.hc_external_participants ADD CONSTRAINT fk_hc_external_participants_tenant FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT;
    END IF;
  END IF;
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_hc_external_tenant_company ON public.hc_external_participants (tenant_id, company_id)';
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_hc_external_type ON public.hc_external_participants (company_id, external_type)';
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_hc_external_active ON public.hc_external_participants (company_id, is_active)';
END$$;

-- RLS tenant isolation (restrictive, additive to company policy)
DO $$
BEGIN
  EXECUTE 'ALTER TABLE public.hc_external_participants ENABLE ROW LEVEL SECURITY';
  EXECUTE 'DROP POLICY IF EXISTS hc_external_participants_all ON public.hc_external_participants';
  EXECUTE 'CREATE POLICY hc_external_participants_all ON public.hc_external_participants FOR ALL USING (company_id = public.user_company_id()) WITH CHECK (company_id = public.user_company_id())';
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'tenant_company_access') THEN
    EXECUTE 'DROP POLICY IF EXISTS tenant_isolation_restrict ON public.hc_external_participants';
    EXECUTE $sql$CREATE POLICY tenant_isolation_restrict ON public.hc_external_participants AS RESTRICTIVE FOR ALL USING (public.tenant_company_access(tenant_id, company_id)) WITH CHECK (public.tenant_company_access(tenant_id, company_id))$sql$;
  END IF;
END$$;

-- ------------------------------------------------------------
-- Realtime publication (live approval cards + copilot sessions)
-- ------------------------------------------------------------
DO $$
DECLARE t text;
  tables text[] := ARRAY['hc_approvals','hc_copilot_sessions','hc_external_participants'];
BEGIN
  FOREACH t IN ARRAY tables
  LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=t)
       AND NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename=t) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE %I', t);
    END IF;
  END LOOP;
END$$;

COMMIT;