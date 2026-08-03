-- ============================================================
-- Service Desk: Enterprise Service Management hardening
-- 1. sd_integrations - tenant-scoped integration registry
-- 2. Analytics indexes on support_tickets
-- ============================================================
BEGIN;

-- ------------------------------------------------------------
-- sd_integrations
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sd_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  integration_type VARCHAR(60) NOT NULL,
  category VARCHAR(60) NOT NULL,
  -- identity | communication | monitoring | erp | asset | automation
  name VARCHAR(150) NOT NULL,
  description TEXT,
  endpoint VARCHAR(500),
  config JSONB DEFAULT '{}'::jsonb,
  is_connected BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  UNIQUE(company_id, integration_type)
);

-- tenant backfill
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='sd_integrations' AND column_name='company_id') THEN
    BEGIN
      UPDATE public.sd_integrations t SET tenant_id = c.tenant_id
      FROM public.companies c
      WHERE t.company_id = c.id AND (t.tenant_id IS NULL OR t.tenant_id IS DISTINCT FROM c.tenant_id);
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Backfill sd_integrations skipped: %', SQLERRM;
    END;
  END IF;
END$$;

DO $$
DECLARE c RECORD;
BEGIN
  FOR c IN SELECT id, tenant_id FROM public.companies LOOP
    INSERT INTO public.sd_integrations (tenant_id, company_id, integration_type, category, name, description, endpoint, is_connected, is_active) VALUES
      (c.tenant_id, c.id, 'entra_id',      'identity',      'Microsoft Entra ID',   'SSO, identity lifecycle and directory sync', 'https://login.microsoftonline.com', false, true),
      (c.tenant_id, c.id, 'google_ws',     'identity',      'Google Workspace',     'SSO and directory sync',                    'https://admin.google.com',           false, true),
      (c.tenant_id, c.id, 'ldap',          'identity',      'LDAP / Active Directory', 'Directory authentication',               NULL,                                 false, true),
      (c.tenant_id, c.id, 'sso_saml',      'identity',      'SSO (SAML/OIDC)',      'Federated sign-in for portal and agents',   NULL,                                 false, true),
      (c.tenant_id, c.id, 'smtp',          'communication', 'Email (SMTP)',          'Email-to-ticket ingestion',                 NULL,                                 false, true),
      (c.tenant_id, c.id, 'sms',           'communication', 'SMS Gateway',          'SLA and escalation alerts',                 NULL,                                 false, true),
      (c.tenant_id, c.id, 'teams',         'communication', 'Microsoft Teams',      'Ticket notifications and war room',         NULL,                                 false, true),
      (c.tenant_id, c.id, 'slack',         'communication', 'Slack',                'Ticket notifications and collaboration',    NULL,                                 false, true),
      (c.tenant_id, c.id, 'whatsapp',      'communication', 'WhatsApp Business',    'Customer support channel',                  NULL,                                 false, true),
      (c.tenant_id, c.id, 'zabbix',        'monitoring',    'Zabbix',               'Infrastructure monitoring alerts',          NULL,                                 false, true),
      (c.tenant_id, c.id, 'nagios',        'monitoring',    'Nagios',               'Infrastructure monitoring alerts',          NULL,                                 false, true),
      (c.tenant_id, c.id, 'prometheus',    'monitoring',    'Prometheus',           'Metrics and alerting',                      NULL,                                 false, true),
      (c.tenant_id, c.id, 'grafana',       'monitoring',    'Grafana',              'Dashboards and alert annotations',          NULL,                                 false, true),
      (c.tenant_id, c.id, 'erp_finance',   'erp',           'Finance ERP',          'Financial services and approvals',          NULL,                                 false, true),
      (c.tenant_id, c.id, 'erp_hr',        'erp',           'HR System',            'HR request fulfillment',                    NULL,                                 false, true),
      (c.tenant_id, c.id, 'erp_payroll',   'erp',           'Payroll',              'Payroll services',                          NULL,                                 false, true),
      (c.tenant_id, c.id, 'erp_procurement','erp',          'Procurement',          'Purchase and vendor services',              NULL,                                 false, true),
      (c.tenant_id, c.id, 'erp_assets',    'erp',           'Asset Management',     'Asset registry and CMDB sync',              NULL,                                 false, true),
      (c.tenant_id, c.id, 'ai_copilot',    'automation',    'AI Service Assistant', 'Classification, triage and copilot',        NULL,                                 false, true),
      (c.tenant_id, c.id, 'webhook',       'automation',    'Outbound Webhooks',    'Automation engine actions',                 NULL,                                 false, true)
    ON CONFLICT (company_id, integration_type) DO NOTHING;
  END LOOP;
END$$;
-- NOT NULL when safe
DO $$
BEGIN
  IF (SELECT count(1) FROM public.sd_integrations WHERE tenant_id IS NULL) = 0 THEN
    BEGIN
      ALTER TABLE public.sd_integrations ALTER COLUMN tenant_id SET NOT NULL;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Could not set NOT NULL on sd_integrations: %', SQLERRM;
    END;
  END IF;
END$$;

-- FK + indexes
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='tenants') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints tc JOIN information_schema.key_column_usage kcu USING (constraint_name, table_schema) WHERE tc.table_name='sd_integrations' AND tc.constraint_type='FOREIGN KEY' AND kcu.column_name='tenant_id') THEN
      ALTER TABLE public.sd_integrations ADD CONSTRAINT fk_sd_integrations_tenant FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT;
    END IF;
  END IF;
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_sd_integrations_tenant ON public.sd_integrations (tenant_id)';
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_sd_integrations_tenant_company ON public.sd_integrations (tenant_id, company_id)';
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_sd_integrations_company_type ON public.sd_integrations (company_id, integration_type)';
END$$;

-- RLS
DO $$
BEGIN
  EXECUTE 'ALTER TABLE public.sd_integrations ENABLE ROW LEVEL SECURITY';
  EXECUTE 'DROP POLICY IF EXISTS tenant_isolation_restrict ON public.sd_integrations';
  EXECUTE 'DROP POLICY IF EXISTS sd_integrations_all ON public.sd_integrations';
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'tenant_company_access') THEN
    EXECUTE $sql$CREATE POLICY tenant_isolation_restrict ON public.sd_integrations AS RESTRICTIVE FOR ALL USING (public.tenant_company_access(tenant_id, company_id)) WITH CHECK (public.tenant_company_access(tenant_id, company_id))$sql$;
  END IF;
  EXECUTE $sql$CREATE POLICY sd_integrations_all ON public.sd_integrations FOR ALL USING (company_id = public.user_company_id()) WITH CHECK (company_id = public.user_company_id())$sql$;
END$$;

-- seed default integration catalog per company

-- ------------------------------------------------------------
-- Analytics indexes on support_tickets
-- ------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_sd_tickets_first_response ON public.support_tickets (first_response_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_sd_tickets_resolved_at ON public.support_tickets (resolved_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_sd_tickets_category ON public.support_tickets (company_id, category);
CREATE INDEX IF NOT EXISTS idx_sd_tickets_assigned_sla ON public.support_tickets (assigned_to, sla_resolve_due) WHERE deleted_at IS NULL;

COMMIT;

-- ------------------------------------------------------------
-- sd_calendars / sd_holidays - tenant + audit hardening
-- Legacy tables predate the tenant model; align them with the
-- platform baseline (tenant_id, audit columns, soft delete) so
-- the generic CRUD surface can enforce tenant isolation.
-- ------------------------------------------------------------
BEGIN;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='sd_calendars' AND column_name='company_id') THEN
    BEGIN
      ALTER TABLE public.sd_calendars ADD COLUMN IF NOT EXISTS tenant_id UUID;
      ALTER TABLE public.sd_calendars ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
      ALTER TABLE public.sd_calendars ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL;
      ALTER TABLE public.sd_calendars ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL;
      ALTER TABLE public.sd_calendars ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Alter sd_calendars skipped: %', SQLERRM;
    END;
  END IF;
END$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='sd_holidays' AND column_name='company_id') THEN
    BEGIN
      ALTER TABLE public.sd_holidays ADD COLUMN IF NOT EXISTS tenant_id UUID;
      ALTER TABLE public.sd_holidays ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
      ALTER TABLE public.sd_holidays ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
      ALTER TABLE public.sd_holidays ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL;
      ALTER TABLE public.sd_holidays ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL;
      ALTER TABLE public.sd_holidays ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Alter sd_holidays skipped: %', SQLERRM;
    END;
  END IF;
END$$;

-- tenant backfill
DO $$
BEGIN
  UPDATE public.sd_calendars t SET tenant_id = c.tenant_id
  FROM public.companies c
  WHERE t.company_id = c.id AND (t.tenant_id IS NULL OR t.tenant_id IS DISTINCT FROM c.tenant_id);
  UPDATE public.sd_holidays t SET tenant_id = c.tenant_id
  FROM public.companies c
  WHERE t.company_id = c.id AND (t.tenant_id IS NULL OR t.tenant_id IS DISTINCT FROM c.tenant_id);
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Backfill calendars/holidays skipped: %', SQLERRM;
END$$;

-- NOT NULL when safe
DO $$
BEGIN
  IF (SELECT count(1) FROM public.sd_calendars WHERE tenant_id IS NULL) = 0 THEN
    BEGIN
      ALTER TABLE public.sd_calendars ALTER COLUMN tenant_id SET NOT NULL;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'sd_calendars tenant NOT NULL skipped: %', SQLERRM;
    END;
  END IF;
  IF (SELECT count(1) FROM public.sd_holidays WHERE tenant_id IS NULL) = 0 THEN
    BEGIN
      ALTER TABLE public.sd_holidays ALTER COLUMN tenant_id SET NOT NULL;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'sd_holidays tenant NOT NULL skipped: %', SQLERRM;
    END;
  END IF;
END$$;

-- FK + indexes
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='tenants') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints tc JOIN information_schema.key_column_usage kcu USING (constraint_name, table_schema) WHERE tc.table_name='sd_calendars' AND tc.constraint_type='FOREIGN KEY' AND kcu.column_name='tenant_id') THEN
      ALTER TABLE public.sd_calendars ADD CONSTRAINT fk_sd_calendars_tenant FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints tc JOIN information_schema.key_column_usage kcu USING (constraint_name, table_schema) WHERE tc.table_name='sd_holidays' AND tc.constraint_type='FOREIGN KEY' AND kcu.column_name='tenant_id') THEN
      ALTER TABLE public.sd_holidays ADD CONSTRAINT fk_sd_holidays_tenant FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT;
    END IF;
  END IF;
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_sd_calendars_tenant ON public.sd_calendars (tenant_id)';
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_sd_calendars_tenant_company ON public.sd_calendars (tenant_id, company_id)';
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_sd_holidays_tenant ON public.sd_holidays (tenant_id)';
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_sd_holidays_tenant_company ON public.sd_holidays (tenant_id, company_id)';
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_sd_holidays_calendar ON public.sd_holidays (calendar_id)';
END$$;

-- RLS tenant isolation (restrictive, additive to existing company policies)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'tenant_company_access') THEN
    EXECUTE 'DROP POLICY IF EXISTS tenant_isolation_restrict ON public.sd_calendars';
    EXECUTE $sql$CREATE POLICY tenant_isolation_restrict ON public.sd_calendars AS RESTRICTIVE FOR ALL USING (public.tenant_company_access(tenant_id, company_id)) WITH CHECK (public.tenant_company_access(tenant_id, company_id))$sql$;
    EXECUTE 'DROP POLICY IF EXISTS tenant_isolation_restrict ON public.sd_holidays';
    EXECUTE $sql$CREATE POLICY tenant_isolation_restrict ON public.sd_holidays AS RESTRICTIVE FOR ALL USING (public.tenant_company_access(tenant_id, company_id)) WITH CHECK (public.tenant_company_access(tenant_id, company_id))$sql$;
  END IF;
END$$;

COMMIT;
