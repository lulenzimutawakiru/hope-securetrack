-- =============================================================================
-- pay_run_lines
-- -----------------------------------------------------------------------------
-- Missing business table defined in the entity registry (payroll module) but
-- never created. Mirrors payroll_lines conventions (20260101000015 +
-- 20260101000034) with tenant_id for strict isolation. Idempotent.
-- =============================================================================
BEGIN;

CREATE TABLE IF NOT EXISTS public.pay_run_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  payroll_run_id UUID NOT NULL REFERENCES payroll_runs(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees(id),
  payslip_number VARCHAR(50),
  basic_salary DECIMAL(14,2) NOT NULL DEFAULT 0,
  allowances DECIMAL(14,2) NOT NULL DEFAULT 0,
  housing DECIMAL(14,2) NOT NULL DEFAULT 0,
  transport DECIMAL(14,2) NOT NULL DEFAULT 0,
  medical DECIMAL(14,2) NOT NULL DEFAULT 0,
  communication DECIMAL(14,2) NOT NULL DEFAULT 0,
  overtime DECIMAL(14,2) NOT NULL DEFAULT 0,
  bonuses DECIMAL(14,2) NOT NULL DEFAULT 0,
  commission DECIMAL(14,2) NOT NULL DEFAULT 0,
  incentives DECIMAL(14,2) NOT NULL DEFAULT 0,
  gross_pay DECIMAL(14,2) NOT NULL DEFAULT 0,
  paye DECIMAL(14,2) NOT NULL DEFAULT 0,
  nssf_employee DECIMAL(14,2) NOT NULL DEFAULT 0,
  nssf_employer DECIMAL(14,2) NOT NULL DEFAULT 0,
  lst DECIMAL(14,2) NOT NULL DEFAULT 0,
  other_deductions DECIMAL(14,2) NOT NULL DEFAULT 0,
  loan_deduction DECIMAL(14,2) NOT NULL DEFAULT 0,
  advance_deduction DECIMAL(14,2) NOT NULL DEFAULT 0,
  insurance_deduction DECIMAL(14,2) NOT NULL DEFAULT 0,
  pension_employee DECIMAL(14,2) NOT NULL DEFAULT 0,
  pension_employer DECIMAL(14,2) NOT NULL DEFAULT 0,
  taxable_pay DECIMAL(14,2) NOT NULL DEFAULT 0,
  net_pay DECIMAL(14,2) NOT NULL DEFAULT 0,
  days_worked DECIMAL(6,2) NOT NULL DEFAULT 0,
  unpaid_days DECIMAL(6,2) NOT NULL DEFAULT 0,
  ot_hours DECIMAL(8,2) NOT NULL DEFAULT 0,
  component_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  bank_account VARCHAR(100),
  payment_method VARCHAR(40) NOT NULL DEFAULT 'bank_transfer',
  status VARCHAR(30) NOT NULL DEFAULT 'calculated',
  notes TEXT,
  created_by UUID REFERENCES user_profiles(id),
  updated_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_pay_run_lines_run ON public.pay_run_lines (payroll_run_id);
CREATE INDEX IF NOT EXISTS idx_pay_run_lines_employee ON public.pay_run_lines (employee_id);
CREATE INDEX IF NOT EXISTS idx_pay_run_lines_company ON public.pay_run_lines (company_id);

-- Backfill tenant_id from the owning company
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='pay_run_lines' AND column_name='company_id') THEN
    BEGIN
      UPDATE public.pay_run_lines t SET tenant_id = c.tenant_id
      FROM public.companies c
      WHERE t.company_id = c.id AND (t.tenant_id IS NULL OR t.tenant_id IS DISTINCT FROM c.tenant_id);
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Backfill pay_run_lines skipped: %', SQLERRM;
    END;
  END IF;
END$$;

-- Tighten tenant_id to NOT NULL when every row has a tenant
DO $$
BEGIN
  IF (SELECT count(1) FROM public.pay_run_lines WHERE tenant_id IS NULL) = 0 THEN
    BEGIN
      ALTER TABLE public.pay_run_lines ALTER COLUMN tenant_id SET NOT NULL;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Could not set NOT NULL on pay_run_lines: %', SQLERRM;
    END;
  END IF;
END$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='tenants') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints tc JOIN information_schema.key_column_usage kcu USING (constraint_name, table_schema) WHERE tc.table_name='pay_run_lines' AND tc.constraint_type='FOREIGN KEY' AND kcu.column_name='tenant_id') THEN
      ALTER TABLE public.pay_run_lines ADD CONSTRAINT fk_pay_run_lines_tenant FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT;
    END IF;
  END IF;
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_pay_run_lines_tenant ON public.pay_run_lines (tenant_id)';
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_pay_run_lines_tenant_company ON public.pay_run_lines (tenant_id, company_id)';
  EXECUTE 'ALTER TABLE public.pay_run_lines ENABLE ROW LEVEL SECURITY';
  EXECUTE 'DROP POLICY IF EXISTS tenant_isolation_restrict ON public.pay_run_lines';
  EXECUTE 'DROP POLICY IF EXISTS tenant_isolation_select ON public.pay_run_lines';
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'tenant_company_access') THEN
    EXECUTE $sql$CREATE POLICY tenant_isolation_restrict ON public.pay_run_lines AS RESTRICTIVE FOR ALL USING (public.tenant_company_access(tenant_id, company_id)) WITH CHECK (public.tenant_company_access(tenant_id, company_id))$sql$;
  ELSE
    EXECUTE $sql$CREATE POLICY tenant_isolation_select ON public.pay_run_lines FOR SELECT USING (
      tenant_id = public.current_user_tenant() AND EXISTS (SELECT 1 FROM public.user_company_memberships m WHERE m.company_id = public.pay_run_lines.company_id AND m.user_id = auth.uid() AND m.status = 'active')
    )$sql$;
    EXECUTE $sql$CREATE POLICY tenant_isolation_write ON public.pay_run_lines FOR ALL USING (tenant_id = public.current_user_tenant()) WITH CHECK (tenant_id = public.current_user_tenant())$sql$;
  END IF;
END$$;

DROP TRIGGER IF EXISTS tr_pay_run_lines_updated ON public.pay_run_lines;
CREATE TRIGGER tr_pay_run_lines_updated BEFORE UPDATE ON public.pay_run_lines
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMIT;
