-- Hope SecureTrack ERP — Enterprise SRM Advanced
-- Traceability · Compliance · Strategic collaboration · Merge · Registry
-- Extends 00045

-- ============================================================
-- SUPPLIER MERGE LOG
-- ============================================================
CREATE TABLE IF NOT EXISTS srm_merge_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  source_supplier_id UUID NOT NULL,
  target_supplier_id UUID NOT NULL,
  merged_fields JSONB DEFAULT '{}',
  actor_id UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE suppliers
  ADD COLUMN IF NOT EXISTS merged_into_id UUID REFERENCES suppliers(id),
  ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS suspended_reason TEXT,
  ADD COLUMN IF NOT EXISTS is_strategic_collaborator BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS demand_forecast_enabled BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS production_visibility BOOLEAN DEFAULT false;

-- ============================================================
-- APPROVED SUPPLIER REGISTRY (category-item matrix)
-- ============================================================
CREATE TABLE IF NOT EXISTS srm_registry_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  code VARCHAR(50) NOT NULL,
  name VARCHAR(255) NOT NULL,
  category_code VARCHAR(50) NOT NULL,
  description TEXT,
  criticality VARCHAR(20) DEFAULT 'standard', -- standard|critical|strategic
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, code)
);

CREATE TABLE IF NOT EXISTS srm_registry_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  registry_item_id UUID NOT NULL REFERENCES srm_registry_items(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  status VARCHAR(30) DEFAULT 'approved', -- approved|conditional|suspended|expired
  approved_from DATE DEFAULT CURRENT_DATE,
  approved_until DATE,
  notes TEXT,
  approved_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(registry_item_id, supplier_id)
);

CREATE INDEX IF NOT EXISTS idx_srm_registry_supplier ON srm_registry_approvals(supplier_id);

-- ============================================================
-- MANUFACTURING MATERIAL TRACEABILITY
-- ============================================================
CREATE TABLE IF NOT EXISTS srm_material_lots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  lot_number VARCHAR(80) NOT NULL,
  supplier_id UUID REFERENCES suppliers(id),
  product_id UUID,
  material_name VARCHAR(255) NOT NULL,
  category_code VARCHAR(50),
  received_at DATE DEFAULT CURRENT_DATE,
  quantity DECIMAL(18,4) DEFAULT 0,
  uom VARCHAR(30) DEFAULT 'KG',
  grn_id UUID,
  purchase_order_id UUID REFERENCES purchase_orders(id),
  quality_status VARCHAR(30) DEFAULT 'accepted', -- accepted|quarantine|rejected
  inspection_id UUID,
  expiry_date DATE,
  warehouse_location VARCHAR(100),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, lot_number)
);

CREATE TABLE IF NOT EXISTS srm_trace_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  material_lot_id UUID NOT NULL REFERENCES srm_material_lots(id) ON DELETE CASCADE,
  link_type VARCHAR(40) NOT NULL, -- production_batch|finished_product|qc|complaint|recall
  ref_type VARCHAR(50),
  ref_id UUID,
  ref_code VARCHAR(100),
  quantity_used DECIMAL(18,4),
  notes TEXT,
  linked_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES user_profiles(id)
);

CREATE INDEX IF NOT EXISTS idx_srm_lots_supplier ON srm_material_lots(supplier_id);
CREATE INDEX IF NOT EXISTS idx_srm_trace_lot ON srm_trace_links(material_lot_id);

-- ============================================================
-- COMPLIANCE SNAPSHOTS
-- ============================================================
CREATE TABLE IF NOT EXISTS srm_compliance_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  supplier_id UUID REFERENCES suppliers(id) ON DELETE CASCADE,
  item_type VARCHAR(50) NOT NULL, -- certification|capa|contract|delivery|quality|financial|esg
  title VARCHAR(255) NOT NULL,
  severity VARCHAR(20) DEFAULT 'medium',
  status VARCHAR(30) DEFAULT 'open', -- open|overdue|resolved|monitoring
  due_date DATE,
  reference_id UUID,
  reference_type VARCHAR(50),
  details TEXT,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_srm_compliance_supplier ON srm_compliance_items(supplier_id, status);

-- ============================================================
-- STRATEGIC SUPPLIER COLLABORATION
-- ============================================================
CREATE TABLE IF NOT EXISTS srm_demand_forecasts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  period_year INTEGER NOT NULL,
  period_month INTEGER NOT NULL,
  material_code VARCHAR(80),
  material_name VARCHAR(255),
  forecast_qty DECIMAL(18,4) DEFAULT 0,
  confirmed_qty DECIMAL(18,4),
  uom VARCHAR(30) DEFAULT 'KG',
  status VARCHAR(30) DEFAULT 'draft', -- draft|shared|confirmed|revised
  notes TEXT,
  shared_at TIMESTAMPTZ,
  confirmed_at TIMESTAMPTZ,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS srm_capacity_confirmations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  capacity_units DECIMAL(18,4) DEFAULT 0,
  committed_units DECIMAL(18,4) DEFAULT 0,
  uom VARCHAR(30) DEFAULT 'EA',
  status VARCHAR(30) DEFAULT 'proposed',
  notes TEXT,
  confirmed_by_name VARCHAR(150),
  confirmed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS srm_delivery_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  slot_date DATE NOT NULL,
  slot_window VARCHAR(50) DEFAULT '08:00-12:00',
  warehouse_name VARCHAR(150),
  status VARCHAR(30) DEFAULT 'open', -- open|reserved|confirmed|completed|cancelled
  reserved_for VARCHAR(255),
  purchase_order_id UUID REFERENCES purchase_orders(id),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS srm_collab_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  doc_type VARCHAR(50) DEFAULT 'engineering',
  file_url TEXT,
  file_name VARCHAR(255),
  visibility VARCHAR(30) DEFAULT 'shared', -- internal|shared|restricted
  version INTEGER DEFAULT 1,
  uploaded_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS srm_procurement_savings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  supplier_id UUID REFERENCES suppliers(id),
  period_year INTEGER NOT NULL,
  period_month INTEGER,
  category VARCHAR(100),
  baseline_amount DECIMAL(18,2) DEFAULT 0,
  actual_amount DECIMAL(18,2) DEFAULT 0,
  savings_amount DECIMAL(18,2) GENERATED ALWAYS AS (baseline_amount - actual_amount) STORED,
  currency VARCHAR(10) DEFAULT 'UGX',
  initiative VARCHAR(255),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE srm_merge_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE srm_registry_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE srm_registry_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE srm_material_lots ENABLE ROW LEVEL SECURITY;
ALTER TABLE srm_trace_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE srm_compliance_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE srm_demand_forecasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE srm_capacity_confirmations ENABLE ROW LEVEL SECURITY;
ALTER TABLE srm_delivery_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE srm_collab_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE srm_procurement_savings ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY srm_merge_log_all ON srm_merge_log FOR ALL
    USING (company_id = public.user_company_id()) WITH CHECK (company_id = public.user_company_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY srm_registry_items_all ON srm_registry_items FOR ALL
    USING (company_id = public.user_company_id()) WITH CHECK (company_id = public.user_company_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY srm_registry_approvals_all ON srm_registry_approvals FOR ALL
    USING (company_id = public.user_company_id()) WITH CHECK (company_id = public.user_company_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY srm_material_lots_all ON srm_material_lots FOR ALL
    USING (company_id = public.user_company_id()) WITH CHECK (company_id = public.user_company_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY srm_trace_links_all ON srm_trace_links FOR ALL
    USING (company_id = public.user_company_id()) WITH CHECK (company_id = public.user_company_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY srm_compliance_items_all ON srm_compliance_items FOR ALL
    USING (company_id = public.user_company_id()) WITH CHECK (company_id = public.user_company_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY srm_demand_forecasts_all ON srm_demand_forecasts FOR ALL
    USING (company_id = public.user_company_id()) WITH CHECK (company_id = public.user_company_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY srm_capacity_all ON srm_capacity_confirmations FOR ALL
    USING (company_id = public.user_company_id()) WITH CHECK (company_id = public.user_company_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY srm_delivery_slots_all ON srm_delivery_slots FOR ALL
    USING (company_id = public.user_company_id()) WITH CHECK (company_id = public.user_company_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY srm_collab_docs_all ON srm_collab_documents FOR ALL
    USING (company_id = public.user_company_id()) WITH CHECK (company_id = public.user_company_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY srm_savings_all ON srm_procurement_savings FOR ALL
    USING (company_id = public.user_company_id()) WITH CHECK (company_id = public.user_company_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- SEED
-- ============================================================
DO $$
DECLARE
  cid UUID := 'a0000000-0000-4000-8000-000000000001';
  sup1 UUID;
  sup2 UUID;
  sup3 UUID;
  item1 UUID;
  item2 UUID;
  item3 UUID;
  lot1 UUID;
  lot2 UUID;
BEGIN
  SELECT id INTO sup1 FROM suppliers WHERE company_id = cid AND code = 'SUP-PULP-01' LIMIT 1;
  SELECT id INTO sup2 FROM suppliers WHERE company_id = cid AND code = 'SUP-INK-01' LIMIT 1;
  SELECT id INTO sup3 FROM suppliers WHERE company_id = cid AND code = 'SUP-LOG-01' LIMIT 1;

  IF sup1 IS NOT NULL THEN
    UPDATE suppliers SET
      is_strategic_collaborator = true,
      demand_forecast_enabled = true,
      production_visibility = true
    WHERE id = sup1;
  END IF;
  IF sup2 IS NOT NULL THEN
    UPDATE suppliers SET is_strategic_collaborator = true, demand_forecast_enabled = true WHERE id = sup2;
  END IF;

  -- Registry items
  INSERT INTO srm_registry_items (company_id, code, name, category_code, criticality, description) VALUES
    (cid, 'REG-PULP', 'Paper pulp (bleached hardwood)', 'RAW', 'critical', 'Primary pulp for security paper base'),
    (cid, 'REG-INK-SEC', 'Security inks (UV / IR)', 'RAW', 'strategic', 'Covert and overt security inks'),
    (cid, 'REG-PKG-CTN', 'Corrugated cartons', 'PKG', 'standard', 'Outbound packaging cartons'),
    (cid, 'REG-PLATE', 'Printing plates (offset)', 'PRT', 'critical', 'CTP plates for security print lines'),
    (cid, 'REG-CHEM', 'Process chemicals', 'RAW', 'critical', 'Fountain solutions and coatings'),
    (cid, 'REG-MACH', 'Industrial machinery spares', 'MCH', 'critical', 'OEM and compatible spare parts'),
    (cid, 'REG-ICT', 'ICT equipment', 'ICT', 'standard', 'Laptops, printers, network gear'),
    (cid, 'REG-OFF', 'Office supplies', 'OFF', 'standard', 'General office consumables')
  ON CONFLICT (company_id, code) DO NOTHING;

  SELECT id INTO item1 FROM srm_registry_items WHERE company_id = cid AND code = 'REG-PULP';
  SELECT id INTO item2 FROM srm_registry_items WHERE company_id = cid AND code = 'REG-INK-SEC';
  SELECT id INTO item3 FROM srm_registry_items WHERE company_id = cid AND code = 'REG-PKG-CTN';

  IF sup1 IS NOT NULL AND item1 IS NOT NULL THEN
    INSERT INTO srm_registry_approvals (company_id, registry_item_id, supplier_id, status, approved_until, notes)
    VALUES (cid, item1, sup1, 'approved', CURRENT_DATE + 365, 'Strategic pulp supplier')
    ON CONFLICT (registry_item_id, supplier_id) DO NOTHING;
  END IF;
  IF sup2 IS NOT NULL AND item2 IS NOT NULL THEN
    INSERT INTO srm_registry_approvals (company_id, registry_item_id, supplier_id, status, approved_until, notes)
    VALUES (cid, item2, sup2, 'approved', CURRENT_DATE + 365, 'Primary security ink source')
    ON CONFLICT (registry_item_id, supplier_id) DO NOTHING;
  END IF;

  -- Material lots + traceability
  IF sup1 IS NOT NULL AND NOT EXISTS (SELECT 1 FROM srm_material_lots WHERE company_id = cid AND lot_number = 'LOT-PULP-2026-041' LIMIT 1) THEN
    INSERT INTO srm_material_lots (
      company_id, lot_number, supplier_id, material_name, category_code,
      quantity, uom, quality_status, warehouse_location, notes
    ) VALUES (
      cid, 'LOT-PULP-2026-041', sup1, 'Bleached hardwood pulp', 'RAW',
      25000, 'KG', 'accepted', 'WH-RAW-A1', 'Inbound GRN matched PO pulp batch'
    ) RETURNING id INTO lot1;

    INSERT INTO srm_trace_links (company_id, material_lot_id, link_type, ref_type, ref_code, quantity_used, notes) VALUES
      (cid, lot1, 'production_batch', 'production_order', 'PO-MFG-2026-118', 12000, 'Security paper base production'),
      (cid, lot1, 'finished_product', 'product', 'SEC-PAPER-A4', 8000, 'Converted to finished security A4'),
      (cid, lot1, 'qc', 'inspection', 'QI-SRM-PULP-041', 25000, 'Moisture and gsm within spec');
  END IF;

  IF sup2 IS NOT NULL AND NOT EXISTS (SELECT 1 FROM srm_material_lots WHERE company_id = cid AND lot_number = 'LOT-INK-2026-012' LIMIT 1) THEN
    INSERT INTO srm_material_lots (
      company_id, lot_number, supplier_id, material_name, category_code,
      quantity, uom, quality_status, warehouse_location
    ) VALUES (
      cid, 'LOT-INK-2026-012', sup2, 'UV fluorescent security ink', 'RAW',
      120, 'L', 'accepted', 'WH-CHEM-B2'
    ) RETURNING id INTO lot2;

    INSERT INTO srm_trace_links (company_id, material_lot_id, link_type, ref_type, ref_code, quantity_used, notes) VALUES
      (cid, lot2, 'production_batch', 'production_order', 'PO-MFG-2026-122', 40, 'Certificate printing run'),
      (cid, lot2, 'finished_product', 'product', 'CERT-HOLO-2026', 40, 'Linked to certificate product family');
  END IF;

  -- Compliance items
  IF sup1 IS NOT NULL AND NOT EXISTS (SELECT 1 FROM srm_compliance_items WHERE company_id = cid AND title LIKE 'Tax clearance%' LIMIT 1) THEN
    INSERT INTO srm_compliance_items (company_id, supplier_id, item_type, title, severity, status, due_date, details) VALUES
      (cid, sup1, 'certification', 'Tax clearance renewal due', 'high', 'open', CURRENT_DATE + 45,
       'EAPP tax clearance expires soon — renew before new POs.'),
      (cid, sup1, 'contract', 'Framework agreement mid-term review', 'medium', 'monitoring', CURRENT_DATE + 90,
       'Strategic pulp framework mid-year commercial review.'),
      (cid, COALESCE(sup3, sup1), 'capa', 'CAPA overdue risk — packaging damage', 'medium', 'open', CURRENT_DATE + 10,
       'Transit packaging CAPA pending confirmation.'),
      (cid, COALESCE(sup2, sup1), 'esg', 'ESG questionnaire outstanding', 'low', 'open', CURRENT_DATE + 60,
       'Request updated ESG self-assessment for ink supplier.');
  END IF;

  -- Demand forecasts (strategic collab)
  IF sup1 IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM srm_demand_forecasts WHERE company_id = cid AND supplier_id = sup1
      AND period_year = EXTRACT(YEAR FROM CURRENT_DATE)::int
      AND period_month = EXTRACT(MONTH FROM CURRENT_DATE)::int
    LIMIT 1
  ) THEN
    INSERT INTO srm_demand_forecasts (
      company_id, supplier_id, period_year, period_month, material_code, material_name,
      forecast_qty, confirmed_qty, uom, status, shared_at
    ) VALUES
      (cid, sup1, EXTRACT(YEAR FROM CURRENT_DATE)::int, EXTRACT(MONTH FROM CURRENT_DATE)::int,
       'PULP-BHW', 'Bleached hardwood pulp', 30000, 28000, 'KG', 'confirmed', NOW() - INTERVAL '5 days'),
      (cid, sup1, EXTRACT(YEAR FROM CURRENT_DATE)::int,
       CASE WHEN EXTRACT(MONTH FROM CURRENT_DATE)::int = 12 THEN 1 ELSE EXTRACT(MONTH FROM CURRENT_DATE)::int + 1 END,
       'PULP-BHW', 'Bleached hardwood pulp', 32000, NULL, 'KG', 'shared', NOW());
  END IF;

  IF sup2 IS NOT NULL THEN
    INSERT INTO srm_capacity_confirmations (
      company_id, supplier_id, period_start, period_end, capacity_units, committed_units, uom, status, confirmed_by_name, confirmed_at
    )
    SELECT cid, sup2, DATE_TRUNC('month', CURRENT_DATE)::date,
      (DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month - 1 day')::date,
      500, 180, 'L', 'confirmed', 'Hans Mueller', NOW() - INTERVAL '3 days'
    WHERE NOT EXISTS (
      SELECT 1 FROM srm_capacity_confirmations WHERE company_id = cid AND supplier_id = sup2 LIMIT 1
    );
  END IF;

  IF sup1 IS NOT NULL AND NOT EXISTS (SELECT 1 FROM srm_delivery_slots WHERE company_id = cid AND supplier_id = sup1 LIMIT 1) THEN
    INSERT INTO srm_delivery_slots (company_id, supplier_id, slot_date, slot_window, warehouse_name, status, reserved_for) VALUES
      (cid, sup1, CURRENT_DATE + 3, '08:00-12:00', 'Main Warehouse Kampala', 'reserved', 'Pulp container #1'),
      (cid, sup1, CURRENT_DATE + 10, '13:00-17:00', 'Main Warehouse Kampala', 'open', NULL);
  END IF;

  IF sup1 IS NOT NULL AND NOT EXISTS (SELECT 1 FROM srm_collab_documents WHERE company_id = cid AND title LIKE 'Pulp moisture%' LIMIT 1) THEN
    INSERT INTO srm_collab_documents (company_id, supplier_id, title, doc_type, file_name, visibility) VALUES
      (cid, sup1, 'Pulp moisture specification v3', 'engineering', 'pulp-moisture-spec-v3.pdf', 'shared'),
      (cid, COALESCE(sup2, sup1), 'UV ink application guide', 'engineering', 'uv-ink-guide.pdf', 'shared');
  END IF;

  -- Procurement savings
  IF NOT EXISTS (SELECT 1 FROM srm_procurement_savings WHERE company_id = cid LIMIT 1) THEN
    INSERT INTO srm_procurement_savings (
      company_id, supplier_id, period_year, period_month, category,
      baseline_amount, actual_amount, initiative
    ) VALUES
      (cid, sup1, EXTRACT(YEAR FROM CURRENT_DATE)::int, EXTRACT(MONTH FROM CURRENT_DATE)::int,
       'raw_materials', 480000000, 455000000, 'Volume rebate negotiation — pulp'),
      (cid, sup2, EXTRACT(YEAR FROM CURRENT_DATE)::int, EXTRACT(MONTH FROM CURRENT_DATE)::int,
       'raw_materials', 200000000, 188000000, 'Multi-year ink price lock'),
      (cid, sup3, EXTRACT(YEAR FROM CURRENT_DATE)::int, EXTRACT(MONTH FROM CURRENT_DATE)::int,
       'logistics', 75000000, 68000000, 'Dual-carrier bid savings');
  END IF;

END $$;
