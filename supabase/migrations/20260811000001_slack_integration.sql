-- SecureTrack ↔ Slack integration (multi-tenant)
-- Platform OAuth app credentials live in env (SLACK_CLIENT_ID, etc.).
-- Per-company install tokens and channel config live in intg_slack_workspaces.

BEGIN;

CREATE TABLE IF NOT EXISTS public.intg_slack_workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE SET NULL,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  team_id VARCHAR(40) NOT NULL,
  team_name VARCHAR(200),
  team_domain VARCHAR(120),
  bot_user_id VARCHAR(40),
  bot_access_token TEXT,
  default_channel_id VARCHAR(40),
  default_channel_name VARCHAR(120),
  incoming_webhook_url TEXT,
  incoming_webhook_channel VARCHAR(120),
  scopes TEXT[] DEFAULT '{}',
  notify_tickets BOOLEAN NOT NULL DEFAULT true,
  notify_alerts BOOLEAN NOT NULL DEFAULT true,
  notify_approvals BOOLEAN NOT NULL DEFAULT false,
  notify_chat_mentions BOOLEAN NOT NULL DEFAULT false,
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  installed_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  installed_at TIMESTAMPTZ DEFAULT NOW(),
  last_error TEXT,
  last_success_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (company_id, team_id)
);

CREATE INDEX IF NOT EXISTS idx_intg_slack_company
  ON public.intg_slack_workspaces(company_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_intg_slack_team
  ON public.intg_slack_workspaces(team_id)
  WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS public.intg_slack_delivery_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  workspace_id UUID REFERENCES public.intg_slack_workspaces(id) ON DELETE SET NULL,
  channel_id VARCHAR(80),
  event_type VARCHAR(80),
  status VARCHAR(30) NOT NULL DEFAULT 'pending',
  -- pending | sent | failed
  request_summary TEXT,
  response_code INTEGER,
  error_message TEXT,
  entity_type VARCHAR(80),
  entity_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_intg_slack_delivery_company
  ON public.intg_slack_delivery_log(company_id, created_at DESC);

ALTER TABLE public.intg_slack_workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.intg_slack_delivery_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS intg_slack_workspaces_select ON public.intg_slack_workspaces;
CREATE POLICY intg_slack_workspaces_select ON public.intg_slack_workspaces
  FOR SELECT TO authenticated
  USING (
    company_id = public.user_company_id()
    AND (
      public.is_super_admin()
      OR public.has_any_permission(ARRAY['intg.view','intg.manage','settings.integrations'])
    )
  );

DROP POLICY IF EXISTS intg_slack_workspaces_write ON public.intg_slack_workspaces;
CREATE POLICY intg_slack_workspaces_write ON public.intg_slack_workspaces
  FOR ALL TO authenticated
  USING (
    company_id = public.user_company_id()
    AND (
      public.is_super_admin()
      OR public.has_any_permission(ARRAY['intg.manage','settings.integrations'])
    )
  )
  WITH CHECK (
    company_id = public.user_company_id()
    AND (
      public.is_super_admin()
      OR public.has_any_permission(ARRAY['intg.manage','settings.integrations'])
    )
  );

DROP POLICY IF EXISTS intg_slack_delivery_select ON public.intg_slack_delivery_log;
CREATE POLICY intg_slack_delivery_select ON public.intg_slack_delivery_log
  FOR SELECT TO authenticated
  USING (
    company_id = public.user_company_id()
    AND (
      public.is_super_admin()
      OR public.has_any_permission(ARRAY['intg.view','intg.manage','settings.integrations'])
    )
  );

-- Service role / edge workers use admin client (bypasses RLS)

COMMIT;
