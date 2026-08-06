-- ============================================================
-- WELCOME EXPERIENCE — tenant onboarding wizard state
-- One row per tenant: saves/resumes the guided welcome journey,
-- captures configuration answers, and tracks readiness/health.
-- ============================================================

CREATE TABLE IF NOT EXISTS tenant_onboarding (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  -- welcome | organization | subscription | structure | security |
  -- modules | business | import | integrations | ai | training |
  -- readiness | go_live | success
  current_step VARCHAR(80) DEFAULT 'welcome',
  -- not_started | in_progress | ready | go_live | completed
  status VARCHAR(30) DEFAULT 'not_started',
  -- map: step_key -> { status, completed_at, skipped_at }
  steps_progress JSONB DEFAULT '{}'::jsonb,
  -- step_key -> form answers (validated server-side)
  answers JSONB DEFAULT '{}'::jsonb,
  -- per-step selections: modules, security, integrations, structure
  selections JSONB DEFAULT '{}'::jsonb,
  -- computed readiness + health snapshots
  readiness JSONB DEFAULT '{}'::jsonb,
  health JSONB DEFAULT '{}'::jsonb,
  -- AI assistant context (recent exchanges, last topic, recommendations)
  assistant JSONB DEFAULT '{}'::jsonb,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_by UUID,
  updated_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (tenant_id)
);

ALTER TABLE tenant_onboarding ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_onboarding_all ON tenant_onboarding;
CREATE POLICY tenant_onboarding_all ON tenant_onboarding FOR ALL
  USING (tenant_id = public.user_tenant_id() OR public.is_platform_admin())
  WITH CHECK (tenant_id = public.user_tenant_id() OR public.is_platform_admin());

-- Auto-maintain updated_at
DROP TRIGGER IF EXISTS trg_tenant_onboarding_updated_at ON tenant_onboarding;
CREATE TRIGGER trg_tenant_onboarding_updated_at
  BEFORE UPDATE ON tenant_onboarding
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Immutable audit trail for onboarding configuration actions.
CREATE OR REPLACE FUNCTION public.audit_tenant_onboarding()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO audit_log (tenant_id, company_id, event, details, user_id, created_by)
  VALUES (
    NEW.tenant_id,
    NEW.company_id,
    'welcome.onboarding_' || TG_OP,
    jsonb_build_object(
      'current_step', NEW.current_step,
      'status', NEW.status,
      'updated_by', NEW.updated_by
    ),
    auth.uid(),
    NEW.updated_by
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_tenant_onboarding_audit ON tenant_onboarding;
CREATE TRIGGER trg_tenant_onboarding_audit
  AFTER INSERT OR UPDATE ON tenant_onboarding
  FOR EACH ROW EXECUTE FUNCTION public.audit_tenant_onboarding();

