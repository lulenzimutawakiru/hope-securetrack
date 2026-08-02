-- =============================================================================
-- SecureTrack ERP -- Phase 8: tenant scoping + RLS for sales line tables
--
-- quotation_lines and sales_order_lines were created without company_id /
-- tenant_id (only parent-gated policies). This migration:
--   1. Adds dual-key isolation columns and backfills them from parent headers.
--   2. Adds FK + index + RESTRICTIVE tenant_isolation_restrict policy so line
--      rows are scoped exactly like every other company table.
--   3. Attaches trg_set_company_from_sales_parent (derives company_id from the
--      parent header when not supplied) and trg_set_tenant_from_company, so no
--      insert path can orphan a line outside its company/tenant.
--   4. Adds permission-gated write policies to quotation_lines (sales_order_lines
--      already received them in the Phase 6 enforcement migration).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Add nullable scope columns
-- ---------------------------------------------------------------------------
ALTER TABLE public.quotation_lines ADD COLUMN IF NOT EXISTS tenant_id UUID;
ALTER TABLE public.quotation_lines ADD COLUMN IF NOT EXISTS company_id UUID;
ALTER TABLE public.sales_order_lines ADD COLUMN IF NOT EXISTS tenant_id UUID;
ALTER TABLE public.sales_order_lines ADD COLUMN IF NOT EXISTS company_id UUID;

-- ---------------------------------------------------------------------------
-- 2. Backfill company_id from parent header
-- ---------------------------------------------------------------------------
UPDATE public.quotation_lines l
SET company_id = q.company_id
FROM public.quotations q
WHERE q.id = l.quotation_id AND l.company_id IS NULL;

UPDATE public.sales_order_lines l
SET company_id = s.company_id
FROM public.sales_orders s
WHERE s.id = l.order_id AND l.company_id IS NULL;

-- ---------------------------------------------------------------------------
-- 3. Backfill tenant_id from companies
-- ---------------------------------------------------------------------------
UPDATE public.quotation_lines l
SET tenant_id = c.tenant_id
FROM public.companies c
WHERE c.id = l.company_id AND l.tenant_id IS NULL;

UPDATE public.sales_order_lines l
SET tenant_id = c.tenant_id
FROM public.companies c
WHERE c.id = l.company_id AND l.tenant_id IS NULL;

-- Fail loudly if any orphan line remains (parent FKs are NOT NULL ON DELETE
-- CASCADE, so every line row must resolve to a header with company_id).
DO $$
DECLARE
  v_bad BIGINT;
BEGIN
  SELECT count(*) INTO v_bad FROM public.quotation_lines WHERE company_id IS NULL OR tenant_id IS NULL;
  IF v_bad > 0 THEN
    RAISE EXCEPTION 'quotation_lines has % rows without company/tenant scope', v_bad;
  END IF;
  SELECT count(*) INTO v_bad FROM public.sales_order_lines WHERE company_id IS NULL OR tenant_id IS NULL;
  IF v_bad > 0 THEN
    RAISE EXCEPTION 'sales_order_lines has % rows without company/tenant scope', v_bad;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 4. NOT NULL + foreign keys
-- ---------------------------------------------------------------------------
ALTER TABLE public.quotation_lines ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE public.quotation_lines ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.sales_order_lines ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE public.sales_order_lines ALTER COLUMN tenant_id SET NOT NULL;

DO $$
BEGIN
  BEGIN
    ALTER TABLE public.quotation_lines
      ADD CONSTRAINT fk_quotation_lines_company
      FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER TABLE public.quotation_lines
      ADD CONSTRAINT fk_quotation_lines_tenant
      FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER TABLE public.sales_order_lines
      ADD CONSTRAINT fk_sales_order_lines_company
      FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER TABLE public.sales_order_lines
      ADD CONSTRAINT fk_sales_order_lines_tenant
      FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;

-- ---------------------------------------------------------------------------
-- 5. Indexes
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_quotation_lines_tenant_co
  ON public.quotation_lines (tenant_id, company_id);
CREATE INDEX IF NOT EXISTS idx_sales_order_lines_tenant_co
  ON public.sales_order_lines (tenant_id, company_id);

-- ---------------------------------------------------------------------------
-- 6. RLS: RESTRICTIVE dual-key isolation policy (ANDs with existing policies)
-- ---------------------------------------------------------------------------
ALTER TABLE public.quotation_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_order_lines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_restrict ON public.quotation_lines;
CREATE POLICY tenant_isolation_restrict ON public.quotation_lines AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.tenant_company_access(tenant_id, company_id))
  WITH CHECK (public.tenant_company_access(tenant_id, company_id));

DROP POLICY IF EXISTS tenant_isolation_restrict ON public.sales_order_lines;
CREATE POLICY tenant_isolation_restrict ON public.sales_order_lines AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.tenant_company_access(tenant_id, company_id))
  WITH CHECK (public.tenant_company_access(tenant_id, company_id));

-- ---------------------------------------------------------------------------
-- 7. Triggers: derive company_id from parent header, then tenant from company
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_set_company_from_sales_parent()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.company_id IS NULL THEN
    IF TG_TABLE_NAME = 'quotation_lines' THEN
      SELECT q.company_id INTO NEW.company_id
      FROM public.quotations q WHERE q.id = NEW.quotation_id;
    ELSIF TG_TABLE_NAME = 'sales_order_lines' THEN
      SELECT s.company_id INTO NEW.company_id
      FROM public.sales_orders s WHERE s.id = NEW.order_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

GRANT EXECUTE ON FUNCTION public.trg_set_company_from_sales_parent() TO authenticated;

-- company_id must be resolved before trg_set_tenant_from_company runs; triggers
-- on the same event fire in alphabetical order, so trg_set_company_* runs first.
DROP TRIGGER IF EXISTS trg_set_company_from_sales_parent ON public.quotation_lines;
CREATE TRIGGER trg_set_company_from_sales_parent
  BEFORE INSERT OR UPDATE OF company_id ON public.quotation_lines
  FOR EACH ROW EXECUTE FUNCTION public.trg_set_company_from_sales_parent();

DROP TRIGGER IF EXISTS trg_set_company_from_sales_parent ON public.sales_order_lines;
CREATE TRIGGER trg_set_company_from_sales_parent
  BEFORE INSERT OR UPDATE OF company_id ON public.sales_order_lines
  FOR EACH ROW EXECUTE FUNCTION public.trg_set_company_from_sales_parent();

DROP TRIGGER IF EXISTS trg_set_tenant_from_company ON public.quotation_lines;
CREATE TRIGGER trg_set_tenant_from_company
  BEFORE INSERT OR UPDATE OF company_id, tenant_id ON public.quotation_lines
  FOR EACH ROW EXECUTE FUNCTION public.trg_set_tenant_from_company();

DROP TRIGGER IF EXISTS trg_set_tenant_from_company ON public.sales_order_lines;
CREATE TRIGGER trg_set_tenant_from_company
  BEFORE INSERT OR UPDATE OF company_id, tenant_id ON public.sales_order_lines
  FOR EACH ROW EXECUTE FUNCTION public.trg_set_tenant_from_company();

-- ---------------------------------------------------------------------------
-- 8. quotation_lines permission-gated writes (mirrors sales_order_lines)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS quotation_lines_write_restrict_insert ON public.quotation_lines;
CREATE POLICY quotation_lines_write_restrict_insert ON public.quotation_lines AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK ((quotation_id IN (SELECT id FROM public.quotations WHERE company_id = public.user_company_id()))
    AND (public.is_super_admin() OR public.has_any_permission(ARRAY['sales.manage','sales.quotes','sales.admin'])));

DROP POLICY IF EXISTS quotation_lines_write_restrict_update ON public.quotation_lines;
CREATE POLICY quotation_lines_write_restrict_update ON public.quotation_lines AS RESTRICTIVE FOR UPDATE TO authenticated
  USING ((quotation_id IN (SELECT id FROM public.quotations WHERE company_id = public.user_company_id()))
    AND (public.is_super_admin() OR public.has_any_permission(ARRAY['sales.manage','sales.quotes','sales.admin'])))
  WITH CHECK ((quotation_id IN (SELECT id FROM public.quotations WHERE company_id = public.user_company_id()))
    AND (public.is_super_admin() OR public.has_any_permission(ARRAY['sales.manage','sales.quotes','sales.admin'])));

DROP POLICY IF EXISTS quotation_lines_write_restrict_delete ON public.quotation_lines;
CREATE POLICY quotation_lines_write_restrict_delete ON public.quotation_lines AS RESTRICTIVE FOR DELETE TO authenticated
  USING ((quotation_id IN (SELECT id FROM public.quotations WHERE company_id = public.user_company_id()))
    AND (public.is_super_admin() OR public.has_any_permission(ARRAY['sales.manage','sales.quotes','sales.admin'])));
