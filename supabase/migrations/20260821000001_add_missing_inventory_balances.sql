-- =============================================================================
-- inventory_balances
-- -----------------------------------------------------------------------------
-- Missing business table referenced by:
--   * MES MRP (src/lib/mes/service.ts) for on-hand availability
--   * Report catalog seeds (20260101000018) as RPT-INV-STOCK source
--   * Entity registry (crud entity, soft delete)
-- Mirrors stock_balances conventions with tenant_id for strict isolation.
-- Idempotent; safe to re-run.
-- =============================================================================
BEGIN;

CREATE TABLE IF NOT EXISTS public.inventory_balances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  warehouse_id UUID REFERENCES warehouses(id) ON DELETE CASCADE,
  batch_number VARCHAR(100),
  serial_number VARCHAR(100),
  quantity DECIMAL(18,4) NOT NULL DEFAULT 0,
  quantity_reserved DECIMAL(18,4) NOT NULL DEFAULT 0,
  quantity_available DECIMAL(18,4) GENERATED ALWAYS AS (quantity - quantity_reserved) STORED,
  unit_cost DECIMAL(18,4) NOT NULL DEFAULT 0,
  total_value DECIMAL(18,4) NOT NULL DEFAULT 0,
  last_movement_at TIMESTAMPTZ,
  status VARCHAR(30) NOT NULL DEFAULT 'available',
  created_by UUID REFERENCES user_profiles(id),
  updated_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  UNIQUE NULLS NOT DISTINCT (company_id, product_id, warehouse_id, batch_number, serial_number)
);

-- Seed from stock_balances when present (best-effort; never clobbers existing rows)
DO $$
BEGIN
  IF to_regclass('public.stock_balances') IS NOT NULL THEN
    INSERT INTO public.inventory_balances (
      company_id, product_id, warehouse_id, batch_number, serial_number,
      quantity, quantity_reserved, unit_cost, total_value, last_movement_at,
      created_at, updated_at
    )
    SELECT
      sb.company_id, sb.product_id, sb.warehouse_id, sb.batch_number, sb.serial_number,
      sb.quantity_on_hand, sb.quantity_reserved, sb.unit_cost, sb.total_value,
      sb.last_movement_at, NOW(), NOW()
    FROM public.stock_balances sb
    WHERE sb.quantity_on_hand <> 0 OR sb.quantity_reserved <> 0
    ON CONFLICT DO NOTHING;
    RAISE NOTICE 'Seeded inventory_balances from stock_balances';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'inventory_balances seed skipped: %', SQLERRM;
END$$;

-- Backfill tenant_id from the owning company
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='inventory_balances' AND column_name='company_id') THEN
    BEGIN
      UPDATE public.inventory_balances t SET tenant_id = c.tenant_id
      FROM public.companies c
      WHERE t.company_id = c.id AND (t.tenant_id IS NULL OR t.tenant_id IS DISTINCT FROM c.tenant_id);
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Backfill inventory_balances skipped: %', SQLERRM;
    END;
  END IF;
END$$;

-- Tighten tenant_id to NOT NULL when every row has a tenant
DO $$
BEGIN
  IF (SELECT count(1) FROM public.inventory_balances WHERE tenant_id IS NULL) = 0 THEN
    BEGIN
      ALTER TABLE public.inventory_balances ALTER COLUMN tenant_id SET NOT NULL;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Could not set NOT NULL on inventory_balances: %', SQLERRM;
    END;
  END IF;
END$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='tenants') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints tc JOIN information_schema.key_column_usage kcu USING (constraint_name, table_schema) WHERE tc.table_name='inventory_balances' AND tc.constraint_type='FOREIGN KEY' AND kcu.column_name='tenant_id') THEN
      ALTER TABLE public.inventory_balances ADD CONSTRAINT fk_inventory_balances_tenant FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT;
    END IF;
  END IF;
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_inventory_balances_tenant ON public.inventory_balances (tenant_id)';
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_inventory_balances_tenant_company ON public.inventory_balances (tenant_id, company_id)';
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_inventory_balances_product ON public.inventory_balances (product_id)';
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_inventory_balances_warehouse ON public.inventory_balances (warehouse_id)';
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_inventory_balances_status ON public.inventory_balances (status) WHERE deleted_at IS NULL';
  EXECUTE 'ALTER TABLE public.inventory_balances ENABLE ROW LEVEL SECURITY';
  EXECUTE 'DROP POLICY IF EXISTS tenant_isolation_restrict ON public.inventory_balances';
  EXECUTE 'DROP POLICY IF EXISTS tenant_isolation_select ON public.inventory_balances';
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'tenant_company_access') THEN
    EXECUTE $sql$CREATE POLICY tenant_isolation_restrict ON public.inventory_balances AS RESTRICTIVE FOR ALL USING (public.tenant_company_access(tenant_id, company_id)) WITH CHECK (public.tenant_company_access(tenant_id, company_id))$sql$;
  ELSE
    EXECUTE $sql$CREATE POLICY tenant_isolation_select ON public.inventory_balances FOR SELECT USING (
      tenant_id = public.current_user_tenant() AND EXISTS (SELECT 1 FROM public.user_company_memberships m WHERE m.company_id = public.inventory_balances.company_id AND m.user_id = auth.uid() AND m.status = 'active')
    )$sql$;
    EXECUTE $sql$CREATE POLICY tenant_isolation_write ON public.inventory_balances FOR ALL USING (tenant_id = public.current_user_tenant()) WITH CHECK (tenant_id = public.current_user_tenant())$sql$;
  END IF;
END$$;

DROP TRIGGER IF EXISTS tr_inventory_balances_updated ON public.inventory_balances;
CREATE TRIGGER tr_inventory_balances_updated BEFORE UPDATE ON public.inventory_balances
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMIT;
