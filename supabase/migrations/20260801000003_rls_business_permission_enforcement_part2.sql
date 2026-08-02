-- ============================================================================
-- RLS Business Permission Enforcement - Part 2 (Phase 3)
--
-- Continues closing the data-layer RBAC gap for the remaining core ERP modules:
-- inventory, manufacturing (MES), fleet, projects (PPM), attendance / workforce
-- and recruitment (TA). As in Phase 2, any authenticated company member could
-- previously INSERT / UPDATE / DELETE these records directly through the browser
-- client because the permissive *_all policies were gated only by
-- company_id = user_company_id().
--
-- This migration adds RESTRICTIVE write policies (INSERT / UPDATE / DELETE) to
-- 65 core business tables. Restrictive policies AND with the existing
-- permissive policies and the migration-71 tenant_isolation_restrict policy, so
-- writes now require:
--   1. tenant + company scope (existing policies), AND
--   2. a matching module permission (new policies) OR super_administrator.
--
-- SELECT stays open to any company member (the 900+ page client UI reads
-- directly); only WRITE paths are hardened. Every permission slug below was
-- verified against the live permissions catalog, and each union is a superset of
-- the permission slugs the CRUD engine registry uses for the same table, so no
-- API flow that passes the registry check is denied at the database layer.
--
-- Line-item tables without their own company/tenant columns (warehouse_racks)
-- are gated through their parent header row, matching the Phase 2 pattern for
-- invoice_lines / sales_order_lines.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Inventory: products  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS products_write_restrict_insert ON products;
CREATE POLICY products_write_restrict_insert ON products AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['inventory.manage','products.manage']));
DROP POLICY IF EXISTS products_write_restrict_update ON products;
CREATE POLICY products_write_restrict_update ON products AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['inventory.manage','products.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['inventory.manage','products.manage']));
DROP POLICY IF EXISTS products_write_restrict_delete ON products;
CREATE POLICY products_write_restrict_delete ON products AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['inventory.manage','products.manage']));
-- ----------------------------------------------------------------------------
-- Inventory: product_categories  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS product_categories_write_restrict_insert ON product_categories;
CREATE POLICY product_categories_write_restrict_insert ON product_categories AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['inventory.manage','products.manage']));
DROP POLICY IF EXISTS product_categories_write_restrict_update ON product_categories;
CREATE POLICY product_categories_write_restrict_update ON product_categories AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['inventory.manage','products.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['inventory.manage','products.manage']));
DROP POLICY IF EXISTS product_categories_write_restrict_delete ON product_categories;
CREATE POLICY product_categories_write_restrict_delete ON product_categories AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['inventory.manage','products.manage']));
-- ----------------------------------------------------------------------------
-- Inventory: warehouses  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS warehouses_write_restrict_insert ON warehouses;
CREATE POLICY warehouses_write_restrict_insert ON warehouses AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['inventory.manage']));
DROP POLICY IF EXISTS warehouses_write_restrict_update ON warehouses;
CREATE POLICY warehouses_write_restrict_update ON warehouses AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['inventory.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['inventory.manage']));
DROP POLICY IF EXISTS warehouses_write_restrict_delete ON warehouses;
CREATE POLICY warehouses_write_restrict_delete ON warehouses AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['inventory.manage']));
-- ----------------------------------------------------------------------------
-- Inventory: warehouse_zones  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS warehouse_zones_write_restrict_insert ON warehouse_zones;
CREATE POLICY warehouse_zones_write_restrict_insert ON warehouse_zones AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['inventory.manage']));
DROP POLICY IF EXISTS warehouse_zones_write_restrict_update ON warehouse_zones;
CREATE POLICY warehouse_zones_write_restrict_update ON warehouse_zones AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['inventory.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['inventory.manage']));
DROP POLICY IF EXISTS warehouse_zones_write_restrict_delete ON warehouse_zones;
CREATE POLICY warehouse_zones_write_restrict_delete ON warehouse_zones AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['inventory.manage']));
-- ----------------------------------------------------------------------------
-- Inventory: warehouse_bins  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS warehouse_bins_write_restrict_insert ON warehouse_bins;
CREATE POLICY warehouse_bins_write_restrict_insert ON warehouse_bins AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['inventory.manage']));
DROP POLICY IF EXISTS warehouse_bins_write_restrict_update ON warehouse_bins;
CREATE POLICY warehouse_bins_write_restrict_update ON warehouse_bins AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['inventory.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['inventory.manage']));
DROP POLICY IF EXISTS warehouse_bins_write_restrict_delete ON warehouse_bins;
CREATE POLICY warehouse_bins_write_restrict_delete ON warehouse_bins AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['inventory.manage']));
-- ----------------------------------------------------------------------------
-- Inventory: warehouse_racks  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS warehouse_racks_write_restrict_insert ON warehouse_racks;
CREATE POLICY warehouse_racks_write_restrict_insert ON warehouse_racks AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK ((warehouse_id IN (SELECT id FROM warehouses WHERE company_id = public.user_company_id())) AND (public.is_super_admin() OR public.has_any_permission(ARRAY['inventory.manage'])));
DROP POLICY IF EXISTS warehouse_racks_write_restrict_update ON warehouse_racks;
CREATE POLICY warehouse_racks_write_restrict_update ON warehouse_racks AS RESTRICTIVE FOR UPDATE TO authenticated
  USING ((warehouse_id IN (SELECT id FROM warehouses WHERE company_id = public.user_company_id())) AND (public.is_super_admin() OR public.has_any_permission(ARRAY['inventory.manage'])))
  WITH CHECK ((warehouse_id IN (SELECT id FROM warehouses WHERE company_id = public.user_company_id())) AND (public.is_super_admin() OR public.has_any_permission(ARRAY['inventory.manage'])));
DROP POLICY IF EXISTS warehouse_racks_write_restrict_delete ON warehouse_racks;
CREATE POLICY warehouse_racks_write_restrict_delete ON warehouse_racks AS RESTRICTIVE FOR DELETE TO authenticated
  USING ((warehouse_id IN (SELECT id FROM warehouses WHERE company_id = public.user_company_id())) AND (public.is_super_admin() OR public.has_any_permission(ARRAY['inventory.manage'])));
-- ----------------------------------------------------------------------------
-- Inventory: stock_balances  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS stock_balances_write_restrict_insert ON stock_balances;
CREATE POLICY stock_balances_write_restrict_insert ON stock_balances AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['inventory.manage','inventory.adjust','inventory.move','inventory.transfer','inventory.grn','inventory.qc','inventory.valuation']));
DROP POLICY IF EXISTS stock_balances_write_restrict_update ON stock_balances;
CREATE POLICY stock_balances_write_restrict_update ON stock_balances AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['inventory.manage','inventory.adjust','inventory.move','inventory.transfer','inventory.grn','inventory.qc','inventory.valuation']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['inventory.manage','inventory.adjust','inventory.move','inventory.transfer','inventory.grn','inventory.qc','inventory.valuation']));
DROP POLICY IF EXISTS stock_balances_write_restrict_delete ON stock_balances;
CREATE POLICY stock_balances_write_restrict_delete ON stock_balances AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['inventory.manage','inventory.adjust','inventory.move','inventory.transfer','inventory.grn','inventory.qc','inventory.valuation']));
-- ----------------------------------------------------------------------------
-- Inventory: stock_adjustments  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS stock_adjustments_write_restrict_insert ON stock_adjustments;
CREATE POLICY stock_adjustments_write_restrict_insert ON stock_adjustments AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['inventory.manage','inventory.adjust','inventory.move','inventory.transfer','inventory.grn','inventory.qc','inventory.valuation']));
DROP POLICY IF EXISTS stock_adjustments_write_restrict_update ON stock_adjustments;
CREATE POLICY stock_adjustments_write_restrict_update ON stock_adjustments AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['inventory.manage','inventory.adjust','inventory.move','inventory.transfer','inventory.grn','inventory.qc','inventory.valuation']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['inventory.manage','inventory.adjust','inventory.move','inventory.transfer','inventory.grn','inventory.qc','inventory.valuation']));
DROP POLICY IF EXISTS stock_adjustments_write_restrict_delete ON stock_adjustments;
CREATE POLICY stock_adjustments_write_restrict_delete ON stock_adjustments AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['inventory.manage','inventory.adjust','inventory.move','inventory.transfer','inventory.grn','inventory.qc','inventory.valuation']));
-- ----------------------------------------------------------------------------
-- Inventory: stock_adjustment_lines  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS stock_adjustment_lines_write_restrict_insert ON stock_adjustment_lines;
CREATE POLICY stock_adjustment_lines_write_restrict_insert ON stock_adjustment_lines AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['inventory.manage','inventory.adjust','inventory.move','inventory.transfer','inventory.grn','inventory.qc','inventory.valuation']));
DROP POLICY IF EXISTS stock_adjustment_lines_write_restrict_update ON stock_adjustment_lines;
CREATE POLICY stock_adjustment_lines_write_restrict_update ON stock_adjustment_lines AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['inventory.manage','inventory.adjust','inventory.move','inventory.transfer','inventory.grn','inventory.qc','inventory.valuation']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['inventory.manage','inventory.adjust','inventory.move','inventory.transfer','inventory.grn','inventory.qc','inventory.valuation']));
DROP POLICY IF EXISTS stock_adjustment_lines_write_restrict_delete ON stock_adjustment_lines;
CREATE POLICY stock_adjustment_lines_write_restrict_delete ON stock_adjustment_lines AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['inventory.manage','inventory.adjust','inventory.move','inventory.transfer','inventory.grn','inventory.qc','inventory.valuation']));
-- ----------------------------------------------------------------------------
-- Inventory: stock_transfers  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS stock_transfers_write_restrict_insert ON stock_transfers;
CREATE POLICY stock_transfers_write_restrict_insert ON stock_transfers AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['inventory.manage','inventory.adjust','inventory.move','inventory.transfer','inventory.grn','inventory.qc','inventory.valuation']));
DROP POLICY IF EXISTS stock_transfers_write_restrict_update ON stock_transfers;
CREATE POLICY stock_transfers_write_restrict_update ON stock_transfers AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['inventory.manage','inventory.adjust','inventory.move','inventory.transfer','inventory.grn','inventory.qc','inventory.valuation']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['inventory.manage','inventory.adjust','inventory.move','inventory.transfer','inventory.grn','inventory.qc','inventory.valuation']));
DROP POLICY IF EXISTS stock_transfers_write_restrict_delete ON stock_transfers;
CREATE POLICY stock_transfers_write_restrict_delete ON stock_transfers AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['inventory.manage','inventory.adjust','inventory.move','inventory.transfer','inventory.grn','inventory.qc','inventory.valuation']));
-- ----------------------------------------------------------------------------
-- Inventory: stock_transfer_lines  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS stock_transfer_lines_write_restrict_insert ON stock_transfer_lines;
CREATE POLICY stock_transfer_lines_write_restrict_insert ON stock_transfer_lines AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['inventory.manage','inventory.adjust','inventory.move','inventory.transfer','inventory.grn','inventory.qc','inventory.valuation']));
DROP POLICY IF EXISTS stock_transfer_lines_write_restrict_update ON stock_transfer_lines;
CREATE POLICY stock_transfer_lines_write_restrict_update ON stock_transfer_lines AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['inventory.manage','inventory.adjust','inventory.move','inventory.transfer','inventory.grn','inventory.qc','inventory.valuation']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['inventory.manage','inventory.adjust','inventory.move','inventory.transfer','inventory.grn','inventory.qc','inventory.valuation']));
DROP POLICY IF EXISTS stock_transfer_lines_write_restrict_delete ON stock_transfer_lines;
CREATE POLICY stock_transfer_lines_write_restrict_delete ON stock_transfer_lines AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['inventory.manage','inventory.adjust','inventory.move','inventory.transfer','inventory.grn','inventory.qc','inventory.valuation']));
-- ----------------------------------------------------------------------------
-- Inventory: stock_reservations  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS stock_reservations_write_restrict_insert ON stock_reservations;
CREATE POLICY stock_reservations_write_restrict_insert ON stock_reservations AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['inventory.manage','inventory.adjust','inventory.move','inventory.transfer','inventory.grn','inventory.qc','inventory.valuation']));
DROP POLICY IF EXISTS stock_reservations_write_restrict_update ON stock_reservations;
CREATE POLICY stock_reservations_write_restrict_update ON stock_reservations AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['inventory.manage','inventory.adjust','inventory.move','inventory.transfer','inventory.grn','inventory.qc','inventory.valuation']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['inventory.manage','inventory.adjust','inventory.move','inventory.transfer','inventory.grn','inventory.qc','inventory.valuation']));
DROP POLICY IF EXISTS stock_reservations_write_restrict_delete ON stock_reservations;
CREATE POLICY stock_reservations_write_restrict_delete ON stock_reservations AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['inventory.manage','inventory.adjust','inventory.move','inventory.transfer','inventory.grn','inventory.qc','inventory.valuation']));
-- ----------------------------------------------------------------------------
-- Manufacturing: bom_headers  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS bom_headers_write_restrict_insert ON bom_headers;
CREATE POLICY bom_headers_write_restrict_insert ON bom_headers AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['mes.manage','mes.plan','mes.planning','production.create','production.edit','production.manage']));
DROP POLICY IF EXISTS bom_headers_write_restrict_update ON bom_headers;
CREATE POLICY bom_headers_write_restrict_update ON bom_headers AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['mes.manage','mes.plan','mes.planning','production.create','production.edit','production.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['mes.manage','mes.plan','mes.planning','production.create','production.edit','production.manage']));
DROP POLICY IF EXISTS bom_headers_write_restrict_delete ON bom_headers;
CREATE POLICY bom_headers_write_restrict_delete ON bom_headers AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['mes.manage','mes.plan','mes.planning','production.create','production.edit','production.manage']));
-- ----------------------------------------------------------------------------
-- Manufacturing: bom_lines  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS bom_lines_write_restrict_insert ON bom_lines;
CREATE POLICY bom_lines_write_restrict_insert ON bom_lines AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['mes.manage','mes.plan','mes.planning','production.create','production.edit','production.manage']));
DROP POLICY IF EXISTS bom_lines_write_restrict_update ON bom_lines;
CREATE POLICY bom_lines_write_restrict_update ON bom_lines AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['mes.manage','mes.plan','mes.planning','production.create','production.edit','production.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['mes.manage','mes.plan','mes.planning','production.create','production.edit','production.manage']));
DROP POLICY IF EXISTS bom_lines_write_restrict_delete ON bom_lines;
CREATE POLICY bom_lines_write_restrict_delete ON bom_lines AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['mes.manage','mes.plan','mes.planning','production.create','production.edit','production.manage']));
-- ----------------------------------------------------------------------------
-- Manufacturing: mes_work_orders  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS mes_work_orders_write_restrict_insert ON mes_work_orders;
CREATE POLICY mes_work_orders_write_restrict_insert ON mes_work_orders AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['mes.manage','mes.operate','mes.shopfloor','mes.plan','mes.planning','production.create','production.edit','production.manage']));
DROP POLICY IF EXISTS mes_work_orders_write_restrict_update ON mes_work_orders;
CREATE POLICY mes_work_orders_write_restrict_update ON mes_work_orders AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['mes.manage','mes.operate','mes.shopfloor','mes.plan','mes.planning','production.create','production.edit','production.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['mes.manage','mes.operate','mes.shopfloor','mes.plan','mes.planning','production.create','production.edit','production.manage']));
DROP POLICY IF EXISTS mes_work_orders_write_restrict_delete ON mes_work_orders;
CREATE POLICY mes_work_orders_write_restrict_delete ON mes_work_orders AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['mes.manage','mes.operate','mes.shopfloor','mes.plan','mes.planning','production.create','production.edit','production.manage']));
-- ----------------------------------------------------------------------------
-- Manufacturing: mes_production_orders  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS mes_production_orders_write_restrict_insert ON mes_production_orders;
CREATE POLICY mes_production_orders_write_restrict_insert ON mes_production_orders AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['mes.manage','mes.operate','mes.shopfloor','mes.plan','mes.planning','production.create','production.edit','production.manage']));
DROP POLICY IF EXISTS mes_production_orders_write_restrict_update ON mes_production_orders;
CREATE POLICY mes_production_orders_write_restrict_update ON mes_production_orders AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['mes.manage','mes.operate','mes.shopfloor','mes.plan','mes.planning','production.create','production.edit','production.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['mes.manage','mes.operate','mes.shopfloor','mes.plan','mes.planning','production.create','production.edit','production.manage']));
DROP POLICY IF EXISTS mes_production_orders_write_restrict_delete ON mes_production_orders;
CREATE POLICY mes_production_orders_write_restrict_delete ON mes_production_orders AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['mes.manage','mes.operate','mes.shopfloor','mes.plan','mes.planning','production.create','production.edit','production.manage']));
-- ----------------------------------------------------------------------------
-- Manufacturing: mes_production_plans  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS mes_production_plans_write_restrict_insert ON mes_production_plans;
CREATE POLICY mes_production_plans_write_restrict_insert ON mes_production_plans AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['mes.manage','mes.operate','mes.shopfloor','mes.plan','mes.planning','production.create','production.edit','production.manage']));
DROP POLICY IF EXISTS mes_production_plans_write_restrict_update ON mes_production_plans;
CREATE POLICY mes_production_plans_write_restrict_update ON mes_production_plans AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['mes.manage','mes.operate','mes.shopfloor','mes.plan','mes.planning','production.create','production.edit','production.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['mes.manage','mes.operate','mes.shopfloor','mes.plan','mes.planning','production.create','production.edit','production.manage']));
DROP POLICY IF EXISTS mes_production_plans_write_restrict_delete ON mes_production_plans;
CREATE POLICY mes_production_plans_write_restrict_delete ON mes_production_plans AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['mes.manage','mes.operate','mes.shopfloor','mes.plan','mes.planning','production.create','production.edit','production.manage']));
-- ----------------------------------------------------------------------------
-- Manufacturing: mes_rework_orders  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS mes_rework_orders_write_restrict_insert ON mes_rework_orders;
CREATE POLICY mes_rework_orders_write_restrict_insert ON mes_rework_orders AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['mes.manage','mes.operate','mes.shopfloor','mes.plan','mes.planning','production.create','production.edit','production.manage']));
DROP POLICY IF EXISTS mes_rework_orders_write_restrict_update ON mes_rework_orders;
CREATE POLICY mes_rework_orders_write_restrict_update ON mes_rework_orders AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['mes.manage','mes.operate','mes.shopfloor','mes.plan','mes.planning','production.create','production.edit','production.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['mes.manage','mes.operate','mes.shopfloor','mes.plan','mes.planning','production.create','production.edit','production.manage']));
DROP POLICY IF EXISTS mes_rework_orders_write_restrict_delete ON mes_rework_orders;
CREATE POLICY mes_rework_orders_write_restrict_delete ON mes_rework_orders AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['mes.manage','mes.operate','mes.shopfloor','mes.plan','mes.planning','production.create','production.edit','production.manage']));
-- ----------------------------------------------------------------------------
-- Manufacturing: production_batches  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS production_batches_write_restrict_insert ON production_batches;
CREATE POLICY production_batches_write_restrict_insert ON production_batches AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['mes.manage','mes.operate','mes.shopfloor','mes.plan','mes.planning','production.create','production.edit','production.manage']));
DROP POLICY IF EXISTS production_batches_write_restrict_update ON production_batches;
CREATE POLICY production_batches_write_restrict_update ON production_batches AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['mes.manage','mes.operate','mes.shopfloor','mes.plan','mes.planning','production.create','production.edit','production.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['mes.manage','mes.operate','mes.shopfloor','mes.plan','mes.planning','production.create','production.edit','production.manage']));
DROP POLICY IF EXISTS production_batches_write_restrict_delete ON production_batches;
CREATE POLICY production_batches_write_restrict_delete ON production_batches AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['mes.manage','mes.operate','mes.shopfloor','mes.plan','mes.planning','production.create','production.edit','production.manage']));
-- ----------------------------------------------------------------------------
-- Manufacturing: mes_work_centers  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS mes_work_centers_write_restrict_insert ON mes_work_centers;
CREATE POLICY mes_work_centers_write_restrict_insert ON mes_work_centers AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['mes.manage','mes.operate','mes.shopfloor','mes.plan','mes.planning','production.create','production.edit','production.manage']));
DROP POLICY IF EXISTS mes_work_centers_write_restrict_update ON mes_work_centers;
CREATE POLICY mes_work_centers_write_restrict_update ON mes_work_centers AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['mes.manage','mes.operate','mes.shopfloor','mes.plan','mes.planning','production.create','production.edit','production.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['mes.manage','mes.operate','mes.shopfloor','mes.plan','mes.planning','production.create','production.edit','production.manage']));
DROP POLICY IF EXISTS mes_work_centers_write_restrict_delete ON mes_work_centers;
CREATE POLICY mes_work_centers_write_restrict_delete ON mes_work_centers AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['mes.manage','mes.operate','mes.shopfloor','mes.plan','mes.planning','production.create','production.edit','production.manage']));
-- ----------------------------------------------------------------------------
-- Manufacturing: mes_routings  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS mes_routings_write_restrict_insert ON mes_routings;
CREATE POLICY mes_routings_write_restrict_insert ON mes_routings AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['mes.manage','mes.operate','mes.shopfloor','mes.plan','mes.planning','production.create','production.edit','production.manage']));
DROP POLICY IF EXISTS mes_routings_write_restrict_update ON mes_routings;
CREATE POLICY mes_routings_write_restrict_update ON mes_routings AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['mes.manage','mes.operate','mes.shopfloor','mes.plan','mes.planning','production.create','production.edit','production.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['mes.manage','mes.operate','mes.shopfloor','mes.plan','mes.planning','production.create','production.edit','production.manage']));
DROP POLICY IF EXISTS mes_routings_write_restrict_delete ON mes_routings;
CREATE POLICY mes_routings_write_restrict_delete ON mes_routings AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['mes.manage','mes.operate','mes.shopfloor','mes.plan','mes.planning','production.create','production.edit','production.manage']));
-- ----------------------------------------------------------------------------
-- Manufacturing: mes_routing_operations  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS mes_routing_operations_write_restrict_insert ON mes_routing_operations;
CREATE POLICY mes_routing_operations_write_restrict_insert ON mes_routing_operations AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['mes.manage','mes.operate','mes.shopfloor','mes.plan','mes.planning','production.create','production.edit','production.manage']));
DROP POLICY IF EXISTS mes_routing_operations_write_restrict_update ON mes_routing_operations;
CREATE POLICY mes_routing_operations_write_restrict_update ON mes_routing_operations AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['mes.manage','mes.operate','mes.shopfloor','mes.plan','mes.planning','production.create','production.edit','production.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['mes.manage','mes.operate','mes.shopfloor','mes.plan','mes.planning','production.create','production.edit','production.manage']));
DROP POLICY IF EXISTS mes_routing_operations_write_restrict_delete ON mes_routing_operations;
CREATE POLICY mes_routing_operations_write_restrict_delete ON mes_routing_operations AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['mes.manage','mes.operate','mes.shopfloor','mes.plan','mes.planning','production.create','production.edit','production.manage']));
-- ----------------------------------------------------------------------------
-- Manufacturing: mes_quality_inspections  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS mes_quality_inspections_write_restrict_insert ON mes_quality_inspections;
CREATE POLICY mes_quality_inspections_write_restrict_insert ON mes_quality_inspections AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['mes.manage','mes.quality','quality.approve']));
DROP POLICY IF EXISTS mes_quality_inspections_write_restrict_update ON mes_quality_inspections;
CREATE POLICY mes_quality_inspections_write_restrict_update ON mes_quality_inspections AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['mes.manage','mes.quality','quality.approve']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['mes.manage','mes.quality','quality.approve']));
DROP POLICY IF EXISTS mes_quality_inspections_write_restrict_delete ON mes_quality_inspections;
CREATE POLICY mes_quality_inspections_write_restrict_delete ON mes_quality_inspections AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['mes.manage','mes.quality','quality.approve']));
-- ----------------------------------------------------------------------------
-- Fleet: fleet_vehicles  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS fleet_vehicles_write_restrict_insert ON fleet_vehicles;
CREATE POLICY fleet_vehicles_write_restrict_insert ON fleet_vehicles AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['fleet.manage','fleet.admin','fleet.approve','fleet.dispatch','fleet.drivers','fleet.fuel','fleet.maintenance','fleet.track']));
DROP POLICY IF EXISTS fleet_vehicles_write_restrict_update ON fleet_vehicles;
CREATE POLICY fleet_vehicles_write_restrict_update ON fleet_vehicles AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['fleet.manage','fleet.admin','fleet.approve','fleet.dispatch','fleet.drivers','fleet.fuel','fleet.maintenance','fleet.track']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['fleet.manage','fleet.admin','fleet.approve','fleet.dispatch','fleet.drivers','fleet.fuel','fleet.maintenance','fleet.track']));
DROP POLICY IF EXISTS fleet_vehicles_write_restrict_delete ON fleet_vehicles;
CREATE POLICY fleet_vehicles_write_restrict_delete ON fleet_vehicles AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['fleet.manage','fleet.admin','fleet.approve','fleet.dispatch','fleet.drivers','fleet.fuel','fleet.maintenance','fleet.track']));
-- ----------------------------------------------------------------------------
-- Fleet: fleet_drivers  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS fleet_drivers_write_restrict_insert ON fleet_drivers;
CREATE POLICY fleet_drivers_write_restrict_insert ON fleet_drivers AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['fleet.manage','fleet.admin','fleet.approve','fleet.dispatch','fleet.drivers','fleet.fuel','fleet.maintenance','fleet.track']));
DROP POLICY IF EXISTS fleet_drivers_write_restrict_update ON fleet_drivers;
CREATE POLICY fleet_drivers_write_restrict_update ON fleet_drivers AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['fleet.manage','fleet.admin','fleet.approve','fleet.dispatch','fleet.drivers','fleet.fuel','fleet.maintenance','fleet.track']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['fleet.manage','fleet.admin','fleet.approve','fleet.dispatch','fleet.drivers','fleet.fuel','fleet.maintenance','fleet.track']));
DROP POLICY IF EXISTS fleet_drivers_write_restrict_delete ON fleet_drivers;
CREATE POLICY fleet_drivers_write_restrict_delete ON fleet_drivers AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['fleet.manage','fleet.admin','fleet.approve','fleet.dispatch','fleet.drivers','fleet.fuel','fleet.maintenance','fleet.track']));
-- ----------------------------------------------------------------------------
-- Fleet: fleet_fuel_logs  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS fleet_fuel_logs_write_restrict_insert ON fleet_fuel_logs;
CREATE POLICY fleet_fuel_logs_write_restrict_insert ON fleet_fuel_logs AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['fleet.manage','fleet.admin','fleet.approve','fleet.dispatch','fleet.drivers','fleet.fuel','fleet.maintenance','fleet.track']));
DROP POLICY IF EXISTS fleet_fuel_logs_write_restrict_update ON fleet_fuel_logs;
CREATE POLICY fleet_fuel_logs_write_restrict_update ON fleet_fuel_logs AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['fleet.manage','fleet.admin','fleet.approve','fleet.dispatch','fleet.drivers','fleet.fuel','fleet.maintenance','fleet.track']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['fleet.manage','fleet.admin','fleet.approve','fleet.dispatch','fleet.drivers','fleet.fuel','fleet.maintenance','fleet.track']));
DROP POLICY IF EXISTS fleet_fuel_logs_write_restrict_delete ON fleet_fuel_logs;
CREATE POLICY fleet_fuel_logs_write_restrict_delete ON fleet_fuel_logs AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['fleet.manage','fleet.admin','fleet.approve','fleet.dispatch','fleet.drivers','fleet.fuel','fleet.maintenance','fleet.track']));
-- ----------------------------------------------------------------------------
-- Fleet: fleet_fuel_requests  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS fleet_fuel_requests_write_restrict_insert ON fleet_fuel_requests;
CREATE POLICY fleet_fuel_requests_write_restrict_insert ON fleet_fuel_requests AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['fleet.manage','fleet.admin','fleet.approve','fleet.dispatch','fleet.drivers','fleet.fuel','fleet.maintenance','fleet.track']));
DROP POLICY IF EXISTS fleet_fuel_requests_write_restrict_update ON fleet_fuel_requests;
CREATE POLICY fleet_fuel_requests_write_restrict_update ON fleet_fuel_requests AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['fleet.manage','fleet.admin','fleet.approve','fleet.dispatch','fleet.drivers','fleet.fuel','fleet.maintenance','fleet.track']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['fleet.manage','fleet.admin','fleet.approve','fleet.dispatch','fleet.drivers','fleet.fuel','fleet.maintenance','fleet.track']));
DROP POLICY IF EXISTS fleet_fuel_requests_write_restrict_delete ON fleet_fuel_requests;
CREATE POLICY fleet_fuel_requests_write_restrict_delete ON fleet_fuel_requests AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['fleet.manage','fleet.admin','fleet.approve','fleet.dispatch','fleet.drivers','fleet.fuel','fleet.maintenance','fleet.track']));
-- ----------------------------------------------------------------------------
-- Fleet: fleet_maintenance  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS fleet_maintenance_write_restrict_insert ON fleet_maintenance;
CREATE POLICY fleet_maintenance_write_restrict_insert ON fleet_maintenance AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['fleet.manage','fleet.admin','fleet.approve','fleet.dispatch','fleet.drivers','fleet.fuel','fleet.maintenance','fleet.track']));
DROP POLICY IF EXISTS fleet_maintenance_write_restrict_update ON fleet_maintenance;
CREATE POLICY fleet_maintenance_write_restrict_update ON fleet_maintenance AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['fleet.manage','fleet.admin','fleet.approve','fleet.dispatch','fleet.drivers','fleet.fuel','fleet.maintenance','fleet.track']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['fleet.manage','fleet.admin','fleet.approve','fleet.dispatch','fleet.drivers','fleet.fuel','fleet.maintenance','fleet.track']));
DROP POLICY IF EXISTS fleet_maintenance_write_restrict_delete ON fleet_maintenance;
CREATE POLICY fleet_maintenance_write_restrict_delete ON fleet_maintenance AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['fleet.manage','fleet.admin','fleet.approve','fleet.dispatch','fleet.drivers','fleet.fuel','fleet.maintenance','fleet.track']));
-- ----------------------------------------------------------------------------
-- Fleet: fleet_trips  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS fleet_trips_write_restrict_insert ON fleet_trips;
CREATE POLICY fleet_trips_write_restrict_insert ON fleet_trips AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['fleet.manage','fleet.admin','fleet.approve','fleet.dispatch','fleet.drivers','fleet.fuel','fleet.maintenance','fleet.track']));
DROP POLICY IF EXISTS fleet_trips_write_restrict_update ON fleet_trips;
CREATE POLICY fleet_trips_write_restrict_update ON fleet_trips AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['fleet.manage','fleet.admin','fleet.approve','fleet.dispatch','fleet.drivers','fleet.fuel','fleet.maintenance','fleet.track']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['fleet.manage','fleet.admin','fleet.approve','fleet.dispatch','fleet.drivers','fleet.fuel','fleet.maintenance','fleet.track']));
DROP POLICY IF EXISTS fleet_trips_write_restrict_delete ON fleet_trips;
CREATE POLICY fleet_trips_write_restrict_delete ON fleet_trips AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['fleet.manage','fleet.admin','fleet.approve','fleet.dispatch','fleet.drivers','fleet.fuel','fleet.maintenance','fleet.track']));
-- ----------------------------------------------------------------------------
-- Fleet: fleet_repair_orders  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS fleet_repair_orders_write_restrict_insert ON fleet_repair_orders;
CREATE POLICY fleet_repair_orders_write_restrict_insert ON fleet_repair_orders AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['fleet.manage','fleet.admin','fleet.approve','fleet.dispatch','fleet.drivers','fleet.fuel','fleet.maintenance','fleet.track']));
DROP POLICY IF EXISTS fleet_repair_orders_write_restrict_update ON fleet_repair_orders;
CREATE POLICY fleet_repair_orders_write_restrict_update ON fleet_repair_orders AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['fleet.manage','fleet.admin','fleet.approve','fleet.dispatch','fleet.drivers','fleet.fuel','fleet.maintenance','fleet.track']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['fleet.manage','fleet.admin','fleet.approve','fleet.dispatch','fleet.drivers','fleet.fuel','fleet.maintenance','fleet.track']));
DROP POLICY IF EXISTS fleet_repair_orders_write_restrict_delete ON fleet_repair_orders;
CREATE POLICY fleet_repair_orders_write_restrict_delete ON fleet_repair_orders AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['fleet.manage','fleet.admin','fleet.approve','fleet.dispatch','fleet.drivers','fleet.fuel','fleet.maintenance','fleet.track']));
-- ----------------------------------------------------------------------------
-- Fleet: fleet_work_orders  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS fleet_work_orders_write_restrict_insert ON fleet_work_orders;
CREATE POLICY fleet_work_orders_write_restrict_insert ON fleet_work_orders AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['fleet.manage','fleet.admin','fleet.approve','fleet.dispatch','fleet.drivers','fleet.fuel','fleet.maintenance','fleet.track']));
DROP POLICY IF EXISTS fleet_work_orders_write_restrict_update ON fleet_work_orders;
CREATE POLICY fleet_work_orders_write_restrict_update ON fleet_work_orders AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['fleet.manage','fleet.admin','fleet.approve','fleet.dispatch','fleet.drivers','fleet.fuel','fleet.maintenance','fleet.track']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['fleet.manage','fleet.admin','fleet.approve','fleet.dispatch','fleet.drivers','fleet.fuel','fleet.maintenance','fleet.track']));
DROP POLICY IF EXISTS fleet_work_orders_write_restrict_delete ON fleet_work_orders;
CREATE POLICY fleet_work_orders_write_restrict_delete ON fleet_work_orders AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['fleet.manage','fleet.admin','fleet.approve','fleet.dispatch','fleet.drivers','fleet.fuel','fleet.maintenance','fleet.track']));
-- ----------------------------------------------------------------------------
-- Fleet: fleet_vehicle_assignments  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS fleet_vehicle_assignments_write_restrict_insert ON fleet_vehicle_assignments;
CREATE POLICY fleet_vehicle_assignments_write_restrict_insert ON fleet_vehicle_assignments AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['fleet.manage','fleet.admin','fleet.approve','fleet.dispatch','fleet.drivers','fleet.fuel','fleet.maintenance','fleet.track']));
DROP POLICY IF EXISTS fleet_vehicle_assignments_write_restrict_update ON fleet_vehicle_assignments;
CREATE POLICY fleet_vehicle_assignments_write_restrict_update ON fleet_vehicle_assignments AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['fleet.manage','fleet.admin','fleet.approve','fleet.dispatch','fleet.drivers','fleet.fuel','fleet.maintenance','fleet.track']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['fleet.manage','fleet.admin','fleet.approve','fleet.dispatch','fleet.drivers','fleet.fuel','fleet.maintenance','fleet.track']));
DROP POLICY IF EXISTS fleet_vehicle_assignments_write_restrict_delete ON fleet_vehicle_assignments;
CREATE POLICY fleet_vehicle_assignments_write_restrict_delete ON fleet_vehicle_assignments AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['fleet.manage','fleet.admin','fleet.approve','fleet.dispatch','fleet.drivers','fleet.fuel','fleet.maintenance','fleet.track']));
-- ----------------------------------------------------------------------------
-- Fleet: fleet_inspections  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS fleet_inspections_write_restrict_insert ON fleet_inspections;
CREATE POLICY fleet_inspections_write_restrict_insert ON fleet_inspections AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['fleet.manage','fleet.admin','fleet.approve','fleet.dispatch','fleet.drivers','fleet.fuel','fleet.maintenance','fleet.track']));
DROP POLICY IF EXISTS fleet_inspections_write_restrict_update ON fleet_inspections;
CREATE POLICY fleet_inspections_write_restrict_update ON fleet_inspections AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['fleet.manage','fleet.admin','fleet.approve','fleet.dispatch','fleet.drivers','fleet.fuel','fleet.maintenance','fleet.track']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['fleet.manage','fleet.admin','fleet.approve','fleet.dispatch','fleet.drivers','fleet.fuel','fleet.maintenance','fleet.track']));
DROP POLICY IF EXISTS fleet_inspections_write_restrict_delete ON fleet_inspections;
CREATE POLICY fleet_inspections_write_restrict_delete ON fleet_inspections AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['fleet.manage','fleet.admin','fleet.approve','fleet.dispatch','fleet.drivers','fleet.fuel','fleet.maintenance','fleet.track']));
-- ----------------------------------------------------------------------------
-- Fleet: fleet_insurance_policies  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS fleet_insurance_policies_write_restrict_insert ON fleet_insurance_policies;
CREATE POLICY fleet_insurance_policies_write_restrict_insert ON fleet_insurance_policies AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['fleet.manage','fleet.admin','fleet.approve','fleet.dispatch','fleet.drivers','fleet.fuel','fleet.maintenance','fleet.track']));
DROP POLICY IF EXISTS fleet_insurance_policies_write_restrict_update ON fleet_insurance_policies;
CREATE POLICY fleet_insurance_policies_write_restrict_update ON fleet_insurance_policies AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['fleet.manage','fleet.admin','fleet.approve','fleet.dispatch','fleet.drivers','fleet.fuel','fleet.maintenance','fleet.track']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['fleet.manage','fleet.admin','fleet.approve','fleet.dispatch','fleet.drivers','fleet.fuel','fleet.maintenance','fleet.track']));
DROP POLICY IF EXISTS fleet_insurance_policies_write_restrict_delete ON fleet_insurance_policies;
CREATE POLICY fleet_insurance_policies_write_restrict_delete ON fleet_insurance_policies AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['fleet.manage','fleet.admin','fleet.approve','fleet.dispatch','fleet.drivers','fleet.fuel','fleet.maintenance','fleet.track']));
-- ----------------------------------------------------------------------------
-- Fleet: fleet_settings  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS fleet_settings_write_restrict_insert ON fleet_settings;
CREATE POLICY fleet_settings_write_restrict_insert ON fleet_settings AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['fleet.manage','fleet.admin']));
DROP POLICY IF EXISTS fleet_settings_write_restrict_update ON fleet_settings;
CREATE POLICY fleet_settings_write_restrict_update ON fleet_settings AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['fleet.manage','fleet.admin']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['fleet.manage','fleet.admin']));
DROP POLICY IF EXISTS fleet_settings_write_restrict_delete ON fleet_settings;
CREATE POLICY fleet_settings_write_restrict_delete ON fleet_settings AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['fleet.manage','fleet.admin']));
-- ----------------------------------------------------------------------------
-- Projects: ppm_projects  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS ppm_projects_write_restrict_insert ON ppm_projects;
CREATE POLICY ppm_projects_write_restrict_insert ON ppm_projects AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['ppm.manage','ppm.admin','ppm.approve','ppm.execute','ppm.plan','ppm.finance']));
DROP POLICY IF EXISTS ppm_projects_write_restrict_update ON ppm_projects;
CREATE POLICY ppm_projects_write_restrict_update ON ppm_projects AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['ppm.manage','ppm.admin','ppm.approve','ppm.execute','ppm.plan','ppm.finance']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['ppm.manage','ppm.admin','ppm.approve','ppm.execute','ppm.plan','ppm.finance']));
DROP POLICY IF EXISTS ppm_projects_write_restrict_delete ON ppm_projects;
CREATE POLICY ppm_projects_write_restrict_delete ON ppm_projects AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['ppm.manage','ppm.admin','ppm.approve','ppm.execute','ppm.plan','ppm.finance']));
-- ----------------------------------------------------------------------------
-- Projects: ppm_tasks  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS ppm_tasks_write_restrict_insert ON ppm_tasks;
CREATE POLICY ppm_tasks_write_restrict_insert ON ppm_tasks AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['ppm.manage','ppm.admin','ppm.approve','ppm.execute','ppm.plan','ppm.finance']));
DROP POLICY IF EXISTS ppm_tasks_write_restrict_update ON ppm_tasks;
CREATE POLICY ppm_tasks_write_restrict_update ON ppm_tasks AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['ppm.manage','ppm.admin','ppm.approve','ppm.execute','ppm.plan','ppm.finance']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['ppm.manage','ppm.admin','ppm.approve','ppm.execute','ppm.plan','ppm.finance']));
DROP POLICY IF EXISTS ppm_tasks_write_restrict_delete ON ppm_tasks;
CREATE POLICY ppm_tasks_write_restrict_delete ON ppm_tasks AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['ppm.manage','ppm.admin','ppm.approve','ppm.execute','ppm.plan','ppm.finance']));
-- ----------------------------------------------------------------------------
-- Projects: ppm_milestones  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS ppm_milestones_write_restrict_insert ON ppm_milestones;
CREATE POLICY ppm_milestones_write_restrict_insert ON ppm_milestones AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['ppm.manage','ppm.admin','ppm.approve','ppm.execute','ppm.plan','ppm.finance']));
DROP POLICY IF EXISTS ppm_milestones_write_restrict_update ON ppm_milestones;
CREATE POLICY ppm_milestones_write_restrict_update ON ppm_milestones AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['ppm.manage','ppm.admin','ppm.approve','ppm.execute','ppm.plan','ppm.finance']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['ppm.manage','ppm.admin','ppm.approve','ppm.execute','ppm.plan','ppm.finance']));
DROP POLICY IF EXISTS ppm_milestones_write_restrict_delete ON ppm_milestones;
CREATE POLICY ppm_milestones_write_restrict_delete ON ppm_milestones AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['ppm.manage','ppm.admin','ppm.approve','ppm.execute','ppm.plan','ppm.finance']));
-- ----------------------------------------------------------------------------
-- Projects: ppm_risks  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS ppm_risks_write_restrict_insert ON ppm_risks;
CREATE POLICY ppm_risks_write_restrict_insert ON ppm_risks AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['ppm.manage','ppm.admin','ppm.approve','ppm.execute','ppm.plan','ppm.finance']));
DROP POLICY IF EXISTS ppm_risks_write_restrict_update ON ppm_risks;
CREATE POLICY ppm_risks_write_restrict_update ON ppm_risks AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['ppm.manage','ppm.admin','ppm.approve','ppm.execute','ppm.plan','ppm.finance']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['ppm.manage','ppm.admin','ppm.approve','ppm.execute','ppm.plan','ppm.finance']));
DROP POLICY IF EXISTS ppm_risks_write_restrict_delete ON ppm_risks;
CREATE POLICY ppm_risks_write_restrict_delete ON ppm_risks AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['ppm.manage','ppm.admin','ppm.approve','ppm.execute','ppm.plan','ppm.finance']));
-- ----------------------------------------------------------------------------
-- Projects: ppm_issues  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS ppm_issues_write_restrict_insert ON ppm_issues;
CREATE POLICY ppm_issues_write_restrict_insert ON ppm_issues AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['ppm.manage','ppm.admin','ppm.approve','ppm.execute','ppm.plan','ppm.finance']));
DROP POLICY IF EXISTS ppm_issues_write_restrict_update ON ppm_issues;
CREATE POLICY ppm_issues_write_restrict_update ON ppm_issues AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['ppm.manage','ppm.admin','ppm.approve','ppm.execute','ppm.plan','ppm.finance']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['ppm.manage','ppm.admin','ppm.approve','ppm.execute','ppm.plan','ppm.finance']));
DROP POLICY IF EXISTS ppm_issues_write_restrict_delete ON ppm_issues;
CREATE POLICY ppm_issues_write_restrict_delete ON ppm_issues AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['ppm.manage','ppm.admin','ppm.approve','ppm.execute','ppm.plan','ppm.finance']));
-- ----------------------------------------------------------------------------
-- Projects: ppm_timesheets  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS ppm_timesheets_write_restrict_insert ON ppm_timesheets;
CREATE POLICY ppm_timesheets_write_restrict_insert ON ppm_timesheets AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['ppm.manage','ppm.admin','ppm.approve','ppm.execute','ppm.plan','ppm.finance']));
DROP POLICY IF EXISTS ppm_timesheets_write_restrict_update ON ppm_timesheets;
CREATE POLICY ppm_timesheets_write_restrict_update ON ppm_timesheets AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['ppm.manage','ppm.admin','ppm.approve','ppm.execute','ppm.plan','ppm.finance']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['ppm.manage','ppm.admin','ppm.approve','ppm.execute','ppm.plan','ppm.finance']));
DROP POLICY IF EXISTS ppm_timesheets_write_restrict_delete ON ppm_timesheets;
CREATE POLICY ppm_timesheets_write_restrict_delete ON ppm_timesheets AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['ppm.manage','ppm.admin','ppm.approve','ppm.execute','ppm.plan','ppm.finance']));
-- ----------------------------------------------------------------------------
-- Projects: ppm_time_logs  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS ppm_time_logs_write_restrict_insert ON ppm_time_logs;
CREATE POLICY ppm_time_logs_write_restrict_insert ON ppm_time_logs AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['ppm.manage','ppm.admin','ppm.approve','ppm.execute','ppm.plan','ppm.finance']));
DROP POLICY IF EXISTS ppm_time_logs_write_restrict_update ON ppm_time_logs;
CREATE POLICY ppm_time_logs_write_restrict_update ON ppm_time_logs AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['ppm.manage','ppm.admin','ppm.approve','ppm.execute','ppm.plan','ppm.finance']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['ppm.manage','ppm.admin','ppm.approve','ppm.execute','ppm.plan','ppm.finance']));
DROP POLICY IF EXISTS ppm_time_logs_write_restrict_delete ON ppm_time_logs;
CREATE POLICY ppm_time_logs_write_restrict_delete ON ppm_time_logs AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['ppm.manage','ppm.admin','ppm.approve','ppm.execute','ppm.plan','ppm.finance']));
-- ----------------------------------------------------------------------------
-- Projects: ppm_budgets  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS ppm_budgets_write_restrict_insert ON ppm_budgets;
CREATE POLICY ppm_budgets_write_restrict_insert ON ppm_budgets AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['ppm.manage','ppm.admin','ppm.approve','ppm.execute','ppm.plan','ppm.finance']));
DROP POLICY IF EXISTS ppm_budgets_write_restrict_update ON ppm_budgets;
CREATE POLICY ppm_budgets_write_restrict_update ON ppm_budgets AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['ppm.manage','ppm.admin','ppm.approve','ppm.execute','ppm.plan','ppm.finance']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['ppm.manage','ppm.admin','ppm.approve','ppm.execute','ppm.plan','ppm.finance']));
DROP POLICY IF EXISTS ppm_budgets_write_restrict_delete ON ppm_budgets;
CREATE POLICY ppm_budgets_write_restrict_delete ON ppm_budgets AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['ppm.manage','ppm.admin','ppm.approve','ppm.execute','ppm.plan','ppm.finance']));
-- ----------------------------------------------------------------------------
-- Projects: ppm_expenses  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS ppm_expenses_write_restrict_insert ON ppm_expenses;
CREATE POLICY ppm_expenses_write_restrict_insert ON ppm_expenses AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['ppm.manage','ppm.admin','ppm.approve','ppm.execute','ppm.plan','ppm.finance']));
DROP POLICY IF EXISTS ppm_expenses_write_restrict_update ON ppm_expenses;
CREATE POLICY ppm_expenses_write_restrict_update ON ppm_expenses AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['ppm.manage','ppm.admin','ppm.approve','ppm.execute','ppm.plan','ppm.finance']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['ppm.manage','ppm.admin','ppm.approve','ppm.execute','ppm.plan','ppm.finance']));
DROP POLICY IF EXISTS ppm_expenses_write_restrict_delete ON ppm_expenses;
CREATE POLICY ppm_expenses_write_restrict_delete ON ppm_expenses AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['ppm.manage','ppm.admin','ppm.approve','ppm.execute','ppm.plan','ppm.finance']));
-- ----------------------------------------------------------------------------
-- Projects: ppm_change_requests  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS ppm_change_requests_write_restrict_insert ON ppm_change_requests;
CREATE POLICY ppm_change_requests_write_restrict_insert ON ppm_change_requests AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['ppm.manage','ppm.admin','ppm.approve','ppm.execute','ppm.plan','ppm.finance']));
DROP POLICY IF EXISTS ppm_change_requests_write_restrict_update ON ppm_change_requests;
CREATE POLICY ppm_change_requests_write_restrict_update ON ppm_change_requests AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['ppm.manage','ppm.admin','ppm.approve','ppm.execute','ppm.plan','ppm.finance']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['ppm.manage','ppm.admin','ppm.approve','ppm.execute','ppm.plan','ppm.finance']));
DROP POLICY IF EXISTS ppm_change_requests_write_restrict_delete ON ppm_change_requests;
CREATE POLICY ppm_change_requests_write_restrict_delete ON ppm_change_requests AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['ppm.manage','ppm.admin','ppm.approve','ppm.execute','ppm.plan','ppm.finance']));
-- ----------------------------------------------------------------------------
-- Projects: ppm_deliverables  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS ppm_deliverables_write_restrict_insert ON ppm_deliverables;
CREATE POLICY ppm_deliverables_write_restrict_insert ON ppm_deliverables AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['ppm.manage','ppm.admin','ppm.approve','ppm.execute','ppm.plan','ppm.finance']));
DROP POLICY IF EXISTS ppm_deliverables_write_restrict_update ON ppm_deliverables;
CREATE POLICY ppm_deliverables_write_restrict_update ON ppm_deliverables AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['ppm.manage','ppm.admin','ppm.approve','ppm.execute','ppm.plan','ppm.finance']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['ppm.manage','ppm.admin','ppm.approve','ppm.execute','ppm.plan','ppm.finance']));
DROP POLICY IF EXISTS ppm_deliverables_write_restrict_delete ON ppm_deliverables;
CREATE POLICY ppm_deliverables_write_restrict_delete ON ppm_deliverables AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['ppm.manage','ppm.admin','ppm.approve','ppm.execute','ppm.plan','ppm.finance']));
-- ----------------------------------------------------------------------------
-- Projects: ppm_approvals  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS ppm_approvals_write_restrict_insert ON ppm_approvals;
CREATE POLICY ppm_approvals_write_restrict_insert ON ppm_approvals AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['ppm.manage','ppm.admin','ppm.approve']));
DROP POLICY IF EXISTS ppm_approvals_write_restrict_update ON ppm_approvals;
CREATE POLICY ppm_approvals_write_restrict_update ON ppm_approvals AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['ppm.manage','ppm.admin','ppm.approve']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['ppm.manage','ppm.admin','ppm.approve']));
DROP POLICY IF EXISTS ppm_approvals_write_restrict_delete ON ppm_approvals;
CREATE POLICY ppm_approvals_write_restrict_delete ON ppm_approvals AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['ppm.manage','ppm.admin','ppm.approve']));
-- ----------------------------------------------------------------------------
-- Attendance: attendance_records  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS attendance_records_write_restrict_insert ON attendance_records;
CREATE POLICY attendance_records_write_restrict_insert ON attendance_records AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['att.manage','att.admin','att.approve','att.field','att.clock']));
DROP POLICY IF EXISTS attendance_records_write_restrict_update ON attendance_records;
CREATE POLICY attendance_records_write_restrict_update ON attendance_records AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['att.manage','att.admin','att.approve','att.field','att.clock']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['att.manage','att.admin','att.approve','att.field','att.clock']));
DROP POLICY IF EXISTS attendance_records_write_restrict_delete ON attendance_records;
CREATE POLICY attendance_records_write_restrict_delete ON attendance_records AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['att.manage','att.admin','att.approve','att.field','att.clock']));
-- ----------------------------------------------------------------------------
-- Attendance: att_approvals  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS att_approvals_write_restrict_insert ON att_approvals;
CREATE POLICY att_approvals_write_restrict_insert ON att_approvals AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['att.manage','att.admin','att.approve','att.field','att.clock']));
DROP POLICY IF EXISTS att_approvals_write_restrict_update ON att_approvals;
CREATE POLICY att_approvals_write_restrict_update ON att_approvals AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['att.manage','att.admin','att.approve','att.field','att.clock']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['att.manage','att.admin','att.approve','att.field','att.clock']));
DROP POLICY IF EXISTS att_approvals_write_restrict_delete ON att_approvals;
CREATE POLICY att_approvals_write_restrict_delete ON att_approvals AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['att.manage','att.admin','att.approve','att.field','att.clock']));
-- ----------------------------------------------------------------------------
-- Attendance: att_corrections  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS att_corrections_write_restrict_insert ON att_corrections;
CREATE POLICY att_corrections_write_restrict_insert ON att_corrections AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['att.manage','att.admin','att.approve','att.field','att.clock']));
DROP POLICY IF EXISTS att_corrections_write_restrict_update ON att_corrections;
CREATE POLICY att_corrections_write_restrict_update ON att_corrections AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['att.manage','att.admin','att.approve','att.field','att.clock']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['att.manage','att.admin','att.approve','att.field','att.clock']));
DROP POLICY IF EXISTS att_corrections_write_restrict_delete ON att_corrections;
CREATE POLICY att_corrections_write_restrict_delete ON att_corrections AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['att.manage','att.admin','att.approve','att.field','att.clock']));
-- ----------------------------------------------------------------------------
-- Attendance: att_shift_swaps  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS att_shift_swaps_write_restrict_insert ON att_shift_swaps;
CREATE POLICY att_shift_swaps_write_restrict_insert ON att_shift_swaps AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['att.manage','att.admin','att.approve','att.field','att.clock']));
DROP POLICY IF EXISTS att_shift_swaps_write_restrict_update ON att_shift_swaps;
CREATE POLICY att_shift_swaps_write_restrict_update ON att_shift_swaps AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['att.manage','att.admin','att.approve','att.field','att.clock']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['att.manage','att.admin','att.approve','att.field','att.clock']));
DROP POLICY IF EXISTS att_shift_swaps_write_restrict_delete ON att_shift_swaps;
CREATE POLICY att_shift_swaps_write_restrict_delete ON att_shift_swaps AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['att.manage','att.admin','att.approve','att.field','att.clock']));
-- ----------------------------------------------------------------------------
-- Attendance: att_remote_work  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS att_remote_work_write_restrict_insert ON att_remote_work;
CREATE POLICY att_remote_work_write_restrict_insert ON att_remote_work AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['att.manage','att.admin','att.approve','att.field','att.clock']));
DROP POLICY IF EXISTS att_remote_work_write_restrict_update ON att_remote_work;
CREATE POLICY att_remote_work_write_restrict_update ON att_remote_work AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['att.manage','att.admin','att.approve','att.field','att.clock']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['att.manage','att.admin','att.approve','att.field','att.clock']));
DROP POLICY IF EXISTS att_remote_work_write_restrict_delete ON att_remote_work;
CREATE POLICY att_remote_work_write_restrict_delete ON att_remote_work AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['att.manage','att.admin','att.approve','att.field','att.clock']));
-- ----------------------------------------------------------------------------
-- Attendance: att_holidays  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS att_holidays_write_restrict_insert ON att_holidays;
CREATE POLICY att_holidays_write_restrict_insert ON att_holidays AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['att.manage','att.admin','att.approve','att.field','att.clock']));
DROP POLICY IF EXISTS att_holidays_write_restrict_update ON att_holidays;
CREATE POLICY att_holidays_write_restrict_update ON att_holidays AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['att.manage','att.admin','att.approve','att.field','att.clock']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['att.manage','att.admin','att.approve','att.field','att.clock']));
DROP POLICY IF EXISTS att_holidays_write_restrict_delete ON att_holidays;
CREATE POLICY att_holidays_write_restrict_delete ON att_holidays AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['att.manage','att.admin','att.approve','att.field','att.clock']));
-- ----------------------------------------------------------------------------
-- Attendance: att_settings  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS att_settings_write_restrict_insert ON att_settings;
CREATE POLICY att_settings_write_restrict_insert ON att_settings AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['att.manage','att.admin']));
DROP POLICY IF EXISTS att_settings_write_restrict_update ON att_settings;
CREATE POLICY att_settings_write_restrict_update ON att_settings AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['att.manage','att.admin']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['att.manage','att.admin']));
DROP POLICY IF EXISTS att_settings_write_restrict_delete ON att_settings;
CREATE POLICY att_settings_write_restrict_delete ON att_settings AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['att.manage','att.admin']));
-- ----------------------------------------------------------------------------
-- Workforce: shift_templates  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS shift_templates_write_restrict_insert ON shift_templates;
CREATE POLICY shift_templates_write_restrict_insert ON shift_templates AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['wfm.manage','wfm.approve','att.manage','att.admin']));
DROP POLICY IF EXISTS shift_templates_write_restrict_update ON shift_templates;
CREATE POLICY shift_templates_write_restrict_update ON shift_templates AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['wfm.manage','wfm.approve','att.manage','att.admin']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['wfm.manage','wfm.approve','att.manage','att.admin']));
DROP POLICY IF EXISTS shift_templates_write_restrict_delete ON shift_templates;
CREATE POLICY shift_templates_write_restrict_delete ON shift_templates AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['wfm.manage','wfm.approve','att.manage','att.admin']));
-- ----------------------------------------------------------------------------
-- Workforce: shift_assignments  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS shift_assignments_write_restrict_insert ON shift_assignments;
CREATE POLICY shift_assignments_write_restrict_insert ON shift_assignments AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['wfm.manage','wfm.approve','att.manage','att.admin']));
DROP POLICY IF EXISTS shift_assignments_write_restrict_update ON shift_assignments;
CREATE POLICY shift_assignments_write_restrict_update ON shift_assignments AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['wfm.manage','wfm.approve','att.manage','att.admin']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['wfm.manage','wfm.approve','att.manage','att.admin']));
DROP POLICY IF EXISTS shift_assignments_write_restrict_delete ON shift_assignments;
CREATE POLICY shift_assignments_write_restrict_delete ON shift_assignments AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['wfm.manage','wfm.approve','att.manage','att.admin']));
-- ----------------------------------------------------------------------------
-- Recruitment: ta_vacancies  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS ta_vacancies_write_restrict_insert ON ta_vacancies;
CREATE POLICY ta_vacancies_write_restrict_insert ON ta_vacancies AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['ta.manage','ta.admin','ta.recruit','ta.approve','hr.recruit']));
DROP POLICY IF EXISTS ta_vacancies_write_restrict_update ON ta_vacancies;
CREATE POLICY ta_vacancies_write_restrict_update ON ta_vacancies AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['ta.manage','ta.admin','ta.recruit','ta.approve','hr.recruit']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['ta.manage','ta.admin','ta.recruit','ta.approve','hr.recruit']));
DROP POLICY IF EXISTS ta_vacancies_write_restrict_delete ON ta_vacancies;
CREATE POLICY ta_vacancies_write_restrict_delete ON ta_vacancies AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['ta.manage','ta.admin','ta.recruit','ta.approve','hr.recruit']));
-- ----------------------------------------------------------------------------
-- Recruitment: ta_candidates  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS ta_candidates_write_restrict_insert ON ta_candidates;
CREATE POLICY ta_candidates_write_restrict_insert ON ta_candidates AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['ta.manage','ta.admin','ta.recruit','ta.approve','hr.recruit']));
DROP POLICY IF EXISTS ta_candidates_write_restrict_update ON ta_candidates;
CREATE POLICY ta_candidates_write_restrict_update ON ta_candidates AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['ta.manage','ta.admin','ta.recruit','ta.approve','hr.recruit']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['ta.manage','ta.admin','ta.recruit','ta.approve','hr.recruit']));
DROP POLICY IF EXISTS ta_candidates_write_restrict_delete ON ta_candidates;
CREATE POLICY ta_candidates_write_restrict_delete ON ta_candidates AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['ta.manage','ta.admin','ta.recruit','ta.approve','hr.recruit']));
-- ----------------------------------------------------------------------------
-- Recruitment: ta_applications  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS ta_applications_write_restrict_insert ON ta_applications;
CREATE POLICY ta_applications_write_restrict_insert ON ta_applications AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['ta.manage','ta.admin','ta.recruit','ta.approve','hr.recruit']));
DROP POLICY IF EXISTS ta_applications_write_restrict_update ON ta_applications;
CREATE POLICY ta_applications_write_restrict_update ON ta_applications AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['ta.manage','ta.admin','ta.recruit','ta.approve','hr.recruit']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['ta.manage','ta.admin','ta.recruit','ta.approve','hr.recruit']));
DROP POLICY IF EXISTS ta_applications_write_restrict_delete ON ta_applications;
CREATE POLICY ta_applications_write_restrict_delete ON ta_applications AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['ta.manage','ta.admin','ta.recruit','ta.approve','hr.recruit']));
-- ----------------------------------------------------------------------------
-- Recruitment: ta_requisitions  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS ta_requisitions_write_restrict_insert ON ta_requisitions;
CREATE POLICY ta_requisitions_write_restrict_insert ON ta_requisitions AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['ta.manage','ta.admin','ta.recruit','ta.approve','hr.recruit']));
DROP POLICY IF EXISTS ta_requisitions_write_restrict_update ON ta_requisitions;
CREATE POLICY ta_requisitions_write_restrict_update ON ta_requisitions AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['ta.manage','ta.admin','ta.recruit','ta.approve','hr.recruit']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['ta.manage','ta.admin','ta.recruit','ta.approve','hr.recruit']));
DROP POLICY IF EXISTS ta_requisitions_write_restrict_delete ON ta_requisitions;
CREATE POLICY ta_requisitions_write_restrict_delete ON ta_requisitions AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['ta.manage','ta.admin','ta.recruit','ta.approve','hr.recruit']));
-- ----------------------------------------------------------------------------
-- Recruitment: ta_positions  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS ta_positions_write_restrict_insert ON ta_positions;
CREATE POLICY ta_positions_write_restrict_insert ON ta_positions AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['ta.manage','ta.admin','ta.recruit','ta.approve','hr.recruit']));
DROP POLICY IF EXISTS ta_positions_write_restrict_update ON ta_positions;
CREATE POLICY ta_positions_write_restrict_update ON ta_positions AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['ta.manage','ta.admin','ta.recruit','ta.approve','hr.recruit']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['ta.manage','ta.admin','ta.recruit','ta.approve','hr.recruit']));
DROP POLICY IF EXISTS ta_positions_write_restrict_delete ON ta_positions;
CREATE POLICY ta_positions_write_restrict_delete ON ta_positions AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['ta.manage','ta.admin','ta.recruit','ta.approve','hr.recruit']));
-- ----------------------------------------------------------------------------
-- Recruitment: ta_interviews  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS ta_interviews_write_restrict_insert ON ta_interviews;
CREATE POLICY ta_interviews_write_restrict_insert ON ta_interviews AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['ta.manage','ta.admin','ta.recruit','ta.approve','hr.recruit']));
DROP POLICY IF EXISTS ta_interviews_write_restrict_update ON ta_interviews;
CREATE POLICY ta_interviews_write_restrict_update ON ta_interviews AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['ta.manage','ta.admin','ta.recruit','ta.approve','hr.recruit']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['ta.manage','ta.admin','ta.recruit','ta.approve','hr.recruit']));
DROP POLICY IF EXISTS ta_interviews_write_restrict_delete ON ta_interviews;
CREATE POLICY ta_interviews_write_restrict_delete ON ta_interviews AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['ta.manage','ta.admin','ta.recruit','ta.approve','hr.recruit']));
-- ----------------------------------------------------------------------------
-- Recruitment: ta_offers  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS ta_offers_write_restrict_insert ON ta_offers;
CREATE POLICY ta_offers_write_restrict_insert ON ta_offers AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['ta.manage','ta.admin','ta.recruit','ta.approve','hr.recruit']));
DROP POLICY IF EXISTS ta_offers_write_restrict_update ON ta_offers;
CREATE POLICY ta_offers_write_restrict_update ON ta_offers AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['ta.manage','ta.admin','ta.recruit','ta.approve','hr.recruit']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['ta.manage','ta.admin','ta.recruit','ta.approve','hr.recruit']));
DROP POLICY IF EXISTS ta_offers_write_restrict_delete ON ta_offers;
CREATE POLICY ta_offers_write_restrict_delete ON ta_offers AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['ta.manage','ta.admin','ta.recruit','ta.approve','hr.recruit']));
-- ----------------------------------------------------------------------------
-- Recruitment: ta_assessments  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS ta_assessments_write_restrict_insert ON ta_assessments;
CREATE POLICY ta_assessments_write_restrict_insert ON ta_assessments AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['ta.manage','ta.admin','ta.recruit','ta.approve','hr.recruit']));
DROP POLICY IF EXISTS ta_assessments_write_restrict_update ON ta_assessments;
CREATE POLICY ta_assessments_write_restrict_update ON ta_assessments AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['ta.manage','ta.admin','ta.recruit','ta.approve','hr.recruit']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['ta.manage','ta.admin','ta.recruit','ta.approve','hr.recruit']));
DROP POLICY IF EXISTS ta_assessments_write_restrict_delete ON ta_assessments;
CREATE POLICY ta_assessments_write_restrict_delete ON ta_assessments AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['ta.manage','ta.admin','ta.recruit','ta.approve','hr.recruit']));
-- ----------------------------------------------------------------------------
-- Recruitment: ta_background_checks  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS ta_background_checks_write_restrict_insert ON ta_background_checks;
CREATE POLICY ta_background_checks_write_restrict_insert ON ta_background_checks AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['ta.manage','ta.admin','ta.recruit','ta.approve','hr.recruit']));
DROP POLICY IF EXISTS ta_background_checks_write_restrict_update ON ta_background_checks;
CREATE POLICY ta_background_checks_write_restrict_update ON ta_background_checks AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['ta.manage','ta.admin','ta.recruit','ta.approve','hr.recruit']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['ta.manage','ta.admin','ta.recruit','ta.approve','hr.recruit']));
DROP POLICY IF EXISTS ta_background_checks_write_restrict_delete ON ta_background_checks;
CREATE POLICY ta_background_checks_write_restrict_delete ON ta_background_checks AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['ta.manage','ta.admin','ta.recruit','ta.approve','hr.recruit']));