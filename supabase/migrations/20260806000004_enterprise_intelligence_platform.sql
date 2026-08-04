-- ============================================================
-- SecureTrack Enterprise Intelligence Platform
-- Centralized reporting catalog Ã‚Â· DWH metadata Ã‚Â· KPI engine
-- Per-company seeds: every report/dashboard/KPI is materialized
-- for each company so tenants get their own full intelligence suite.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Report schedules: explicit delivery channels + last error
-- ------------------------------------------------------------
ALTER TABLE public.bi_report_schedules
  ADD COLUMN IF NOT EXISTS delivery_channels TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS last_error TEXT;

-- ------------------------------------------------------------
-- 2. Tenant pass on BI tables (parity with business tables).
--    RLS remains company-scoped; tenant_id is for job queue
--    isolation, enforcement and cross-tenant audits.
-- ------------------------------------------------------------
DO $$
DECLARE
  t text;
  v_has_tenants boolean;
  v_has_fk boolean;
  tables text[] := ARRAY[
    'bi_report_definitions','bi_report_runs','bi_dashboards','bi_dashboard_widgets',
    'bi_kpis','bi_kpi_snapshots','bi_ai_insights','bi_document_jobs','bi_report_schedules',
    'bi_regulatory_packages','bi_intelligent_documents','bi_document_revisions','bi_dwh_objects',
    'bi_data_marts','bi_chart_catalog','bi_search_index','bi_assistant_sessions',
    'bi_assistant_messages','bi_assistant_playbooks','bi_analytics_models','bi_forecast_results',
    'bi_report_shares','bi_report_approvals','bi_notification_queue','bi_service_registry'
  ];
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema='public' AND table_name='tenants'
  ) INTO v_has_tenants;

  FOREACH t IN ARRAY tables
  LOOP
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS tenant_id UUID', t);
    EXECUTE format($q$
      UPDATE public.%I x SET tenant_id = c.tenant_id
      FROM public.companies c WHERE x.company_id = c.id AND x.tenant_id IS NULL
    $q$, t);
    IF v_has_tenants THEN
      SELECT EXISTS (
        SELECT 1 FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu USING (constraint_name, table_schema)
        WHERE tc.table_schema='public' AND tc.table_name=t
          AND tc.constraint_type='FOREIGN KEY' AND kcu.column_name='tenant_id'
      ) INTO v_has_fk;
      IF NOT v_has_fk THEN
        EXECUTE format($q$
          ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (tenant_id)
          REFERENCES public.tenants(id) ON DELETE SET NULL
        $q$, t, 'fk_' || t || '_tenant');
      END IF;
    END IF;
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_tenant ON public.%I(tenant_id)', t, t);
  END LOOP;
END $$;

-- ------------------------------------------------------------
-- 3. Enterprise report catalog Ã¢â‚¬â€ Finance & Accounting
-- ------------------------------------------------------------
INSERT INTO public.bi_report_definitions
  (company_id, report_code, name, description, category, module_key, report_type, data_source, parameters, columns_config, query_config, is_system, tags)
SELECT c.id, v.report_code, v.name, v.description, v.category, v.module_key, v.report_type, v.data_source,
       '[]'::jsonb, '[]'::jsonb, '{}'::jsonb, true, v.tags
FROM public.companies c
CROSS JOIN (VALUES
  ('RPT-FIN-TB','Trial Balance','GL trial balance by account','financial','finance','financial_statement','chart_of_accounts',ARRAY['finance','gl']),
  ('RPT-FIN-PL','Profit & Loss','Income statement period comparison','financial','finance','financial_statement','gl_journals',ARRAY['finance','pnl']),
  ('RPT-FIN-BS','Balance Sheet','Statement of financial position','financial','finance','financial_statement','chart_of_accounts',ARRAY['finance']),
  ('RPT-FIN-CF','Cash Flow Statement','Statement of cash flows by operating, investing and financing','financial','finance','financial_statement','bank_transactions',ARRAY['finance','cash']),
  ('RPT-FIN-SOE','Statement of Equity','Equity movements and retained earnings','financial','finance','financial_statement','chart_of_accounts',ARRAY['finance','equity']),
  ('RPT-FIN-GL','General Ledger','Full GL register by period','financial','finance','tabular','gl_journals',ARRAY['finance','gl']),
  ('RPT-FIN-COA','Chart of Accounts','Active account master with types','financial','finance','tabular','chart_of_accounts',ARRAY['finance','gl']),
  ('RPT-FIN-JRNL','Journal Register','Journal batches and postings','financial','finance','tabular','gl_journals',ARRAY['finance','gl']),
  ('RPT-FIN-JRNLLN','Journal Line Detail','Individual journal line items','financial','finance','tabular','gl_journal_lines',ARRAY['finance','gl']),
  ('RPT-FIN-TRACE','Account Activity','Drill-down of activity per account','financial','finance','drill_down','gl_journal_lines',ARRAY['finance','gl']),
  ('RPT-FIN-AR-AGING','AR Aging','Customer receivables aging','financial','finance','tabular','invoices',ARRAY['ar','credit']),
  ('RPT-FIN-AP-AGING','AP Aging','Supplier payables aging','financial','finance','tabular','ap_invoices',ARRAY['ap']),
  ('RPT-FIN-AR-RECEIPTS','Receipts Register','Customer receipt register','financial','finance','tabular','ar_receipts',ARRAY['ar']),
  ('RPT-FIN-AP-PAYMENTS','Payments Register','Supplier payment register','financial','finance','tabular','ap_payments',ARRAY['ap']),
  ('RPT-FIN-AR-CREDITNOTES','Credit Notes','Customer credit notes register','financial','finance','tabular','ar_credit_notes',ARRAY['ar']),
  ('RPT-FIN-BUDGET','Budget vs Actual','Budget comparison against actuals','financial','finance','comparative','budget_lines',ARRAY['finance','budget']),
  ('RPT-FIN-BUDGETSUM','Budget Summary','Budget by cost center and period','financial','finance','crosstab','budgets',ARRAY['finance','budget']),
  ('RPT-FIN-COSTCENTER','Cost Center Report','Cost center performance','financial','finance','crosstab','cost_centers',ARRAY['finance']),
  ('RPT-FIN-CASH','Cash Position','Cash and bank balances','financial','finance','analytical','bank_transactions',ARRAY['finance','cash']),
  ('RPT-FIN-BANKREC','Bank Reconciliation','Reconciliation statement per bank account','financial','finance','matrix','bank_reconciliations',ARRAY['finance','bank']),
  ('RPT-FIN-BANKTX','Bank Transactions','Bank statement transactions','financial','finance','tabular','bank_transactions',ARRAY['finance','bank']),
  ('RPT-FIN-VAT','VAT Return Working','URA VAT working papers','regulatory','finance','regulatory','tax_codes',ARRAY['ura','vat']),
  ('RPT-FIN-PAYE','PAYE & NSSF Summary','Statutory payroll deductions','regulatory','finance','regulatory','payroll_runs',ARRAY['payroll','ura']),
  ('RPT-FIN-WHT','Withholding Tax','WHT on supplier payments','regulatory','finance','regulatory','ap_invoices',ARRAY['ura','wht']),
  ('RPT-FIN-TAXPOS','Tax Position','Overall tax liability position','regulatory','finance','regulatory','tax_codes',ARRAY['ura','tax']),
  ('RPT-FIN-PROFIT','Profitability Analysis','Profitability by business dimension','financial','finance','analytical','fin_production_profitability',ARRAY['finance','profit']),
  ('RPT-FIN-MARGIN','Margin Analysis','Gross and net margin trends','financial','finance','analytical','invoices',ARRAY['finance','margin']),
  ('RPT-FIN-EXPENSE','Expense Analysis','Expense category analysis','financial','finance','analytical','fin_expense_claims',ARRAY['finance','expense']),
  ('RPT-FIN-EXPCLAIM','Expense Claims','Employee expense claim register','financial','finance','tabular','fin_expense_claims',ARRAY['finance','expense']),
  ('RPT-FIN-DSO','DSO & Receivables Health','Days sales outstanding','financial','finance','analytical','invoices',ARRAY['ar','kpi']),
  ('RPT-FIN-DPO','DPO & Payables Health','Days payable outstanding','financial','finance','analytical','ap_invoices',ARRAY['ap','kpi']),
  ('RPT-FIN-CCC','Cash Conversion Cycle','DIO + DSO - DPO working capital','financial','finance','analytical','invoices',ARRAY['finance','kpi']),
  ('RPT-FIN-FISCAL','Fiscal Period Summary','Fiscal period open and close status','financial','finance','statistical','fiscal_periods',ARRAY['finance']),
  ('RPT-FIN-INTERCO','Intercompany Balances','Intercompany receivable and payable netting','financial','finance','matrix','gl_journals',ARRAY['finance','interco']),
  ('RPT-FIN-DEPRECIATION','Depreciation Schedule','Fixed asset depreciation run','financial','finance','tabular','depreciation_entries',ARRAY['finance','asset']),
  ('RPT-FIN-FIXEDASSET','Fixed Asset Register','Fixed asset master register','financial','finance','tabular','fixed_assets',ARRAY['finance','asset']),
  ('RPT-FIN-REVENUE','Revenue Analysis','Revenue by period and product','financial','finance','analytical','invoices',ARRAY['finance','revenue']),
  ('RPT-FIN-CAPEX','Capex Report','Capital expenditure analysis','financial','finance','analytical','fixed_assets',ARRAY['finance']),
  ('RPT-FIN-CASHFORECAST','Cash Forecast','Projected cash position','ai','finance','ai','bank_transactions',ARRAY['ai','cash']),
  ('RPT-FIN-APOPEN','Open Payables','Payables due and overdue','financial','finance','exception','ap_invoices',ARRAY['ap','exception']),
  ('RPT-FIN-AROVERDUE','Overdue Receivables','Receivables past due','financial','finance','exception','invoices',ARRAY['ar','exception']),
  ('RPT-FIN-JE-EXCEPT','Unbalanced Journal Exceptions','Suspense and out-of-balance entries','financial','finance','exception','gl_journals',ARRAY['gl','exception']),
  ('RPT-FIN-BANKFEES','Bank Fees Analysis','Bank charges and fees','financial','finance','analytical','bank_transactions',ARRAY['finance','bank']),
  ('RPT-FIN-CURRENCY','FX Revaluation','Foreign currency revaluation','financial','finance','analytical','currencies',ARRAY['finance','fx']),
  ('RPT-FIN-GL-SUMMARY','GL Summary by Period','Account balances summarized by period','financial','finance','crosstab','gl_journals',ARRAY['finance','gl']),
  ('RPT-ACC-JOURNAL','Journal Report','Period journal listings','accounting','accounting','tabular','gl_journals',ARRAY['gl']),
  ('RPT-ACC-TB','Trial Balance Working','Working trial balance for close','accounting','accounting','financial_statement','chart_of_accounts',ARRAY['gl','close']),
  ('RPT-ACC-GLACCOUNT','Account Activity','Activity and balance per account','accounting','accounting','drill_down','gl_journal_lines',ARRAY['gl']),
  ('RPT-ACC-POSTING','Posting Batch Report','Posting batches by status','accounting','accounting','tabular','fin_posting_batches',ARRAY['gl']),
  ('RPT-ACC-RECON','Reconciliation Statement','Bank and GL reconciliation','accounting','accounting','matrix','bank_reconciliations',ARRAY['gl','bank']),
  ('RPT-ACC-APLEDGER','Supplier Ledger','Supplier account ledger','accounting','accounting','tabular','ap_invoices',ARRAY['ap']),
  ('RPT-ACC-ARLEDGER','Customer Ledger','Customer account ledger','accounting','accounting','tabular','invoices',ARRAY['ar']),
  ('RPT-ACC-DEPR','Depreciation Run','Monthly depreciation posting run','accounting','accounting','tabular','depreciation_entries',ARRAY['asset','gl'])
) AS v(report_code, name, description, category, module_key, report_type, data_source, tags)
WHERE NOT EXISTS (
  SELECT 1 FROM public.bi_report_definitions d
  WHERE d.company_id = c.id AND d.report_code = v.report_code
)
ON CONFLICT (company_id, report_code) DO NOTHING;-- ------------------------------------------------------------
-- 4. Enterprise report catalog - Sales & CRM
-- ------------------------------------------------------------
INSERT INTO public.bi_report_definitions
  (company_id, report_code, name, description, category, module_key, report_type, data_source, parameters, columns_config, query_config, is_system, tags)
SELECT c.id, v.report_code, v.name, v.description, v.category, v.module_key, v.report_type, v.data_source,
       '[]'::jsonb, '[]'::jsonb, '{}'::jsonb, true, v.tags
FROM public.companies c
CROSS JOIN (VALUES
  ('RPT-SAL-REV','Revenue Analysis','Revenue by period, product and customer','sales','sales','analytical','invoices',ARRAY['sales','revenue']),
  ('RPT-SAL-BYPROD','Sales by Product','Sales volume and value by product','sales','sales','analytical','invoices',ARRAY['sales','product']),
  ('RPT-SAL-BYCUST','Sales by Customer','Sales value and trend by customer','sales','sales','analytical','invoices',ARRAY['sales','customer']),
  ('RPT-SAL-BYREGION','Sales by Region','Sales performance by region','sales','sales','analytical','invoices',ARRAY['sales','region']),
  ('RPT-SAL-PERF','Salesperson Performance','Sales targets and attainment by salesperson','sales','sales','analytical','invoices',ARRAY['sales','performance']),
  ('RPT-SAL-ORDER','Sales Order Register','Sales order register by status','operational','sales','tabular','sales_orders',ARRAY['sales','orders']),
  ('RPT-SAL-ORDERFULFILL','Order Fulfillment','Fulfillment rate and delivery performance','sales','sales','analytical','sales_orders',ARRAY['sales','logistics']),
  ('RPT-SAL-INVOICE','Invoice Register','Customer invoice register','operational','sales','tabular','invoices',ARRAY['sales','ar']),
  ('RPT-SAL-CREDITNOTE','Credit Notes','Customer credit notes and adjustments','operational','sales','tabular','ar_credit_notes',ARRAY['sales','ar']),
  ('RPT-SAL-RECEIPTS','Receipts Register','Customer receipts register','operational','sales','tabular','ar_receipts',ARRAY['sales','ar']),
  ('RPT-SAL-FORECAST','Revenue Forecast','Forecast revenue based on pipeline and history','ai','sales','ai','invoices',ARRAY['ai','revenue','forecast']),
  ('RPT-SAL-TARGET','Sales Target vs Actual','Period target attainment analysis','analytical','sales','comparative','sales_orders',ARRAY['sales','target']),
  ('RPT-CRM-LEADFN','Lead Conversion Funnel','Lead to customer conversion funnel','analytical','crm','analytical','sales_leads',ARRAY['crm','leads']),
  ('RPT-CRM-LEADS','Lead Pipeline','Open leads by stage and owner','operational','crm','interactive','sales_leads',ARRAY['crm','leads']),
  ('RPT-CRM-OPP','Opportunity Pipeline','Open opportunities by stage and value','operational','crm','interactive','sales_opportunities',ARRAY['crm','opportunity']),
  ('RPT-CRM-WINLOSS','Win / Loss Analysis','Opportunity outcomes and reasons','analytical','crm','analytical','sales_opportunities',ARRAY['crm','opportunity']),
  ('RPT-CRM-C360','Customer 360','Single customer view across all modules','analytical','crm','drill_down','customers',ARRAY['crm','customer']),
  ('RPT-CRM-CLV','Customer Lifetime Value','Lifetime value by customer segment','analytical','crm','analytical','invoices',ARRAY['crm','clv']),
  ('RPT-CRM-PROFIT','Customer Profitability','Profitability by customer','analytical','crm','analytical','invoices',ARRAY['crm','profitability']),
  ('RPT-CRM-CHURN','Customer Churn Risk','Churn risk signals and at-risk accounts','ai','crm','predictive','customers',ARRAY['ai','churn']),
  ('RPT-CRM-TOP','Top Customers','Top customers by revenue','comparative','crm','comparative','invoices',ARRAY['crm','customer']),
  ('RPT-CRM-ACTIVITY','Customer Activity','Activity and engagement by customer','statistical','crm','statistical','invoices',ARRAY['crm','activity']),
  ('RPT-CRM-CONTRACTS','Contract Register','CRM contract register','operational','crm','tabular','contracts',ARRAY['crm','contracts'])
) AS v(report_code, name, description, category, module_key, report_type, data_source, tags)
WHERE NOT EXISTS (
  SELECT 1 FROM public.bi_report_definitions d
  WHERE d.company_id = c.id AND d.report_code = v.report_code
)
ON CONFLICT (company_id, report_code) DO NOTHING;

-- ------------------------------------------------------------
-- 5. Enterprise report catalog - Procurement, Spend & Contracts
-- ------------------------------------------------------------
INSERT INTO public.bi_report_definitions
  (company_id, report_code, name, description, category, module_key, report_type, data_source, parameters, columns_config, query_config, is_system, tags)
SELECT c.id, v.report_code, v.name, v.description, v.category, v.module_key, v.report_type, v.data_source,
       '[]'::jsonb, '[]'::jsonb, '{}'::jsonb, true, v.tags
FROM public.companies c
CROSS JOIN (VALUES
  ('RPT-PUR-PO','Purchase Orders Register','Purchase order register by status and supplier','operational','procurement','tabular','purchase_orders',ARRAY['procurement','po']),
  ('RPT-PUR-CYCLE','Procurement Cycle Time','Requisition to PO to goods receipt cycle','analytical','procurement','analytical','purchase_orders',ARRAY['procurement','cycle']),
  ('RPT-PUR-APPR','Approval Delays','Purchase approvals past SLA','exception','procurement','exception','purchase_orders',ARRAY['procurement','approval']),
  ('RPT-PUR-GRN','Goods Receipt Register','Goods receipt register','operational','procurement','tabular','goods_receipts',ARRAY['procurement','grn']),
  ('RPT-PUR-REQ','Purchase Requisitions','Requisition register and status','operational','procurement','tabular','purchase_requisitions',ARRAY['procurement','requisition']),
  ('RPT-PUR-ANALYSIS','Purchase Analysis','Purchase value and volume analysis','analytical','procurement','analytical','purchase_orders',ARRAY['procurement','spend']),
  ('RPT-PUR-SUPPLIER','Supplier Performance','Delivery, quality and price performance','analytical','procurement','analytical','supplier_scorecards',ARRAY['procurement','supplier']),
  ('RPT-PUR-SCORE','Supplier Scorecard','Weighted supplier scorecard','analytical','procurement','matrix','supplier_scorecards',ARRAY['procurement','supplier']),
  ('RPT-PUR-RISK','Supplier Risk Register','Supplier risk ratings and flags','exception','procurement','exception','supplier_scorecards',ARRAY['procurement','risk']),
  ('RPT-PUR-VENDOR','Vendor Master','Supplier master register','operational','procurement','tabular','suppliers',ARRAY['procurement','supplier']),
  ('RPT-SPD-SUPPLIER','Spend by Supplier','Total spend by supplier','analytical','procurement','analytical','ap_invoices',ARRAY['spend','supplier']),
  ('RPT-SPD-CATEGORY','Spend by Category','Spend by purchase category','analytical','procurement','analytical','ap_invoices',ARRAY['spend','category']),
  ('RPT-SPD-DEPT','Department Spending','Spend by requesting department','analytical','procurement','analytical','ap_invoices',ARRAY['spend','department']),
  ('RPT-SPD-TREND','Spend Trend','Monthly spend trend and forecast','analytical','procurement','analytical','ap_invoices',ARRAY['spend','trend']),
  ('RPT-SPD-SAVINGS','Cost Saving Opportunities','AI identified cost reduction opportunities','ai','procurement','ai','ap_invoices',ARRAY['ai','spend','savings']),
  ('RPT-SPD-FRAUD','Procurement Fraud Signals','Anomalous spend and fraud patterns','ai','procurement','predictive','ap_invoices',ARRAY['ai','fraud']),
  ('RPT-CON-REGISTER','Contract Register','Procurement contract register','operational','procurement','tabular','procurement_contracts',ARRAY['procurement','contracts']),
  ('RPT-CON-UTIL','Contract Utilization','Spend against contract value','analytical','procurement','analytical','procurement_contracts',ARRAY['procurement','contracts']),
  ('RPT-CON-RENEWAL','Contract Renewals','Upcoming renewals and expiries','exception','procurement','exception','procurement_contracts',ARRAY['procurement','contracts']),
  ('RPT-CON-VALUE','Contract Value Analysis','Contract value and commitment analysis','analytical','procurement','analytical','procurement_contracts',ARRAY['procurement','contracts'])
) AS v(report_code, name, description, category, module_key, report_type, data_source, tags)
WHERE NOT EXISTS (
  SELECT 1 FROM public.bi_report_definitions d
  WHERE d.company_id = c.id AND d.report_code = v.report_code
)
ON CONFLICT (company_id, report_code) DO NOTHING;

-- ------------------------------------------------------------
-- 6. Enterprise report catalog - Inventory & Warehouse
-- ------------------------------------------------------------
INSERT INTO public.bi_report_definitions
  (company_id, report_code, name, description, category, module_key, report_type, data_source, parameters, columns_config, query_config, is_system, tags)
SELECT c.id, v.report_code, v.name, v.description, v.category, v.module_key, v.report_type, v.data_source,
       '[]'::jsonb, '[]'::jsonb, '{}'::jsonb, true, v.tags
FROM public.companies c
CROSS JOIN (VALUES
  ('RPT-INV-BAL','Stock Balance','On-hand stock balance by product and warehouse','operational','inventory','tabular','stock_balances',ARRAY['inventory','stock']),
  ('RPT-INV-VALUE','Inventory Valuation','Stock value at cost and current valuation','analytical','inventory','analytical','stock_balances',ARRAY['inventory','valuation']),
  ('RPT-INV-AGING','Inventory Aging','Stock age by receipt period','analytical','inventory','analytical','stock_balances',ARRAY['inventory','aging']),
  ('RPT-INV-DEAD','Dead Stock','Stock with no movement beyond threshold','exception','inventory','exception','stock_balances',ARRAY['inventory','deadstock']),
  ('RPT-INV-SLOW','Slow-Moving Stock','Slow-moving items by consumption rate','analytical','inventory','analytical','stock_balances',ARRAY['inventory','slow']),
  ('RPT-INV-TURN','Stock Turnover','Inventory turnover and days on hand','analytical','inventory','analytical','stock_balances',ARRAY['inventory','turnover']),
  ('RPT-INV-ADJ','Stock Adjustment Register','Stock adjustment and variance register','operational','inventory','tabular','stock_adjustments',ARRAY['inventory','adjustment']),
  ('RPT-INV-TRANSFER','Stock Transfer Register','Inter-warehouse transfer register','operational','inventory','tabular','stock_transfers',ARRAY['inventory','transfer']),
  ('RPT-INV-CYCLE','Cycle Count Register','Cycle count plans and results','operational','inventory','tabular','cycle_counts',ARRAY['inventory','cycle']),
  ('RPT-INV-MOVE','Stock Movement','Movement ledger by product and period','analytical','inventory','drill_down','stock_adjustments',ARRAY['inventory','movement']),
  ('RPT-INV-SHORT','Stock Shortage','Items below safety stock','exception','inventory','exception','stock_balances',ARRAY['inventory','shortage']),
  ('RPT-INV-REORDER','Reorder Recommendations','AI reorder point and quantity recommendations','ai','inventory','ai','stock_balances',ARRAY['ai','reorder']),
  ('RPT-INV-FORECAST','Demand Forecast','AI demand forecast by product','ai','inventory','ai','stock_balances',ARRAY['ai','demand','forecast']),
  ('RPT-INV-SHRINK','Shrinkage Analysis','Variance between book and physical stock','analytical','inventory','analytical','cycle_counts',ARRAY['inventory','shrinkage']),
  ('RPT-WHS-PROD','Warehouse Productivity','Throughput and productivity by warehouse','analytical','inventory','analytical','stock_balances',ARRAY['warehouse','productivity']),
  ('RPT-WHS-RECV','Receiving Performance','Receiving cycle time and accuracy','analytical','inventory','analytical','goods_receipts',ARRAY['warehouse','receiving']),
  ('RPT-WHS-DISP','Dispatch Performance','Dispatch and outbound performance','analytical','inventory','analytical','sales_orders',ARRAY['warehouse','dispatch']),
  ('RPT-WHS-CAPACITY','Warehouse Capacity Utilization','Capacity utilization by warehouse','analytical','inventory','analytical','stock_balances',ARRAY['warehouse','capacity']),
  ('RPT-WHS-LOC','Location Utilization','Bin and location utilization','analytical','inventory','analytical','stock_balances',ARRAY['warehouse','location'])
) AS v(report_code, name, description, category, module_key, report_type, data_source, tags)
WHERE NOT EXISTS (
  SELECT 1 FROM public.bi_report_definitions d
  WHERE d.company_id = c.id AND d.report_code = v.report_code
)
ON CONFLICT (company_id, report_code) DO NOTHING;-- ------------------------------------------------------------
-- 7. Enterprise report catalog - Manufacturing & Quality
-- ------------------------------------------------------------
INSERT INTO public.bi_report_definitions
  (company_id, report_code, name, description, category, module_key, report_type, data_source, parameters, columns_config, query_config, is_system, tags)
SELECT c.id, v.report_code, v.name, v.description, v.category, v.module_key, v.report_type, v.data_source,
       '[]'::jsonb, '[]'::jsonb, '{}'::jsonb, true, v.tags
FROM public.companies c
CROSS JOIN (VALUES
  ('RPT-MFG-OUTPUT','Production Output','Production output by product and period','analytical','manufacturing','analytical','mes_production_orders',ARRAY['production','output']),
  ('RPT-MFG-EFF','Production Efficiency','Actual vs planned efficiency','analytical','manufacturing','analytical','mes_production_orders',ARRAY['production','efficiency']),
  ('RPT-MFG-COST','Production Cost','Production cost by order and product','analytical','manufacturing','analytical','mes_production_lines',ARRAY['production','cost']),
  ('RPT-MFG-MATERIAL','Material Consumption','Material issue and consumption analysis','analytical','manufacturing','analytical','mes_material_issues',ARRAY['production','material']),
  ('RPT-MFG-WASTE','Waste Analysis','Waste and scrap by product and process','analytical','manufacturing','analytical','mes_waste_records',ARRAY['production','waste']),
  ('RPT-MFG-PO','Production Order Register','Production orders by status','operational','manufacturing','tabular','mes_production_orders',ARRAY['production','orders']),
  ('RPT-MFG-PLANVSACT','Plan vs Actual Production','Plan versus actual output comparison','comparative','manufacturing','comparative','mes_production_orders',ARRAY['production','planning']),
  ('RPT-MFG-SCHEDULE','Production Schedule','Production schedule and load view','operational','manufacturing','interactive','mes_production_orders',ARRAY['production','schedule']),
  ('RPT-MAC-OEE','OEE Analysis','Overall equipment effectiveness by machine','analytical','manufacturing','analytical','mes_oee_snapshots',ARRAY['production','oee']),
  ('RPT-MAC-DOWN','Downtime Analysis','Downtime by reason, machine and shift','analytical','manufacturing','analytical','mes_downtime',ARRAY['production','downtime']),
  ('RPT-MAC-FAIL','Machine Failure History','Breakdown and failure history','operational','manufacturing','tabular','mes_maintenance_orders',ARRAY['production','maintenance']),
  ('RPT-MAC-MAINTCOST','Maintenance Cost','Maintenance cost by machine and order','analytical','manufacturing','analytical','mes_maintenance_orders',ARRAY['production','maintenance']),
  ('RPT-MAC-UTIL','Machine Utilization','Utilization by work center and machine','analytical','manufacturing','analytical','mes_oee_snapshots',ARRAY['production','utilization']),
  ('RPT-MAC-FAILPRED','Machine Failure Prediction','AI failure risk prediction','ai','manufacturing','predictive','mes_maintenance_orders',ARRAY['ai','failure']),
  ('RPT-QC-DEFECT','Defects and Rejections','Defect and rejection analysis','analytical','quality','analytical','mes_quality_inspections',ARRAY['quality','defects']),
  ('RPT-QC-INSPECT','Inspection Results','Inspection results register','operational','quality','tabular','mes_quality_inspections',ARRAY['quality','inspection']),
  ('RPT-QC-NCR','NCR Register','Non-conformance register','operational','quality','tabular','mes_ncr',ARRAY['quality','ncr']),
  ('RPT-QC-CAPA','CAPA Report','Corrective and preventive actions','analytical','quality','analytical','mes_ncr',ARRAY['quality','capa']),
  ('RPT-QC-FPY','First Pass Yield','First pass yield by product and line','analytical','quality','analytical','mes_quality_inspections',ARRAY['quality','yield']),
  ('RPT-QC-VENDOR','Vendor Quality','Incoming quality by supplier','analytical','quality','analytical','mes_quality_inspections',ARRAY['quality','supplier']),
  ('RPT-QC-COST','Cost of Poor Quality','Internal and external failure cost','analytical','quality','analytical','mes_ncr',ARRAY['quality','cost'])
) AS v(report_code, name, description, category, module_key, report_type, data_source, tags)
WHERE NOT EXISTS (
  SELECT 1 FROM public.bi_report_definitions d
  WHERE d.company_id = c.id AND d.report_code = v.report_code
)
ON CONFLICT (company_id, report_code) DO NOTHING;

-- ------------------------------------------------------------
-- 8. Enterprise report catalog - Assets & Fleet
-- ------------------------------------------------------------
INSERT INTO public.bi_report_definitions
  (company_id, report_code, name, description, category, module_key, report_type, data_source, parameters, columns_config, query_config, is_system, tags)
SELECT c.id, v.report_code, v.name, v.description, v.category, v.module_key, v.report_type, v.data_source,
       '[]'::jsonb, '[]'::jsonb, '{}'::jsonb, true, v.tags
FROM public.companies c
CROSS JOIN (VALUES
  ('RPT-AST-REG','Asset Register','Fixed asset register','operational','assets','tabular','ast_assets',ARRAY['asset','register']),
  ('RPT-AST-VALUE','Asset Valuation','Asset valuation and net book value','analytical','assets','analytical','ast_assets',ARRAY['asset','valuation']),
  ('RPT-AST-DEPR','Depreciation Schedule','Depreciation by asset and period','analytical','assets','tabular','depreciation_entries',ARRAY['asset','depreciation']),
  ('RPT-AST-UTIL','Asset Utilization','Utilization by asset and department','analytical','assets','analytical','ast_assets',ARRAY['asset','utilization']),
  ('RPT-AST-AUDIT','Asset Audit Trail','Asset lifecycle audit trail','audit','assets','drill_down','ast_assets',ARRAY['asset','audit']),
  ('RPT-AST-MAINTCOST','Asset Maintenance Cost','Maintenance cost by asset','analytical','assets','analytical','ast_assets',ARRAY['asset','maintenance']),
  ('RPT-AST-LIFECYCLE','Asset Lifecycle Cost','Total lifecycle cost by asset','analytical','assets','analytical','ast_assets',ARRAY['asset','lifecycle']),
  ('RPT-AST-FAIL','Asset Failure Prediction','AI asset failure prediction','ai','assets','predictive','ast_assets',ARRAY['ai','failure']),
  ('RPT-AST-REPLACE','Replacement Recommendations','AI replacement and disposal recommendations','ai','assets','prescriptive','ast_assets',ARRAY['ai','asset']),
  ('RPT-FLT-VEH','Fleet Vehicle Register','Fleet vehicle master register','operational','fleet','tabular','fleet_vehicles',ARRAY['fleet','vehicle']),
  ('RPT-FLT-MAINT','Fleet Maintenance','Fleet maintenance orders and cost','operational','fleet','tabular','fleet_maintenance',ARRAY['fleet','maintenance']),
  ('RPT-FLT-TRIPS','Trip Register','Trip register by vehicle and driver','operational','fleet','tabular','fleet_trips',ARRAY['fleet','trips']),
  ('RPT-FLT-FUEL','Fuel Consumption','Fuel consumption and cost by vehicle','analytical','fleet','analytical','fleet_fuel_logs',ARRAY['fleet','fuel']),
  ('RPT-FLT-COST','Fleet Cost Analysis','Total cost of ownership by vehicle','analytical','fleet','analytical','fleet_costs',ARRAY['fleet','cost']),
  ('RPT-FLT-DELIV','Deliveries','Delivery register and performance','operational','fleet','tabular','fleet_deliveries',ARRAY['fleet','delivery']),
  ('RPT-FLT-DRIVER','Driver Performance','Driver safety and performance scorecards','analytical','fleet','analytical','fleet_driver_performance',ARRAY['fleet','driver']),
  ('RPT-FLT-UTIL','Vehicle Utilization','Utilization by vehicle and period','analytical','fleet','analytical','fleet_vehicles',ARRAY['fleet','utilization']),
  ('RPT-FLT-COMPLIANCE','Fleet Compliance','Licenses, insurance and compliance exceptions','exception','fleet','exception','fleet_vehicle_documents',ARRAY['fleet','compliance']),
  ('RPT-FLT-ACCDENT','Accident Analysis','Accidents and claims analysis','analytical','fleet','analytical','fleet_accidents',ARRAY['fleet','safety'])
) AS v(report_code, name, description, category, module_key, report_type, data_source, tags)
WHERE NOT EXISTS (
  SELECT 1 FROM public.bi_report_definitions d
  WHERE d.company_id = c.id AND d.report_code = v.report_code
)
ON CONFLICT (company_id, report_code) DO NOTHING;-- ------------------------------------------------------------
-- 9. Enterprise report catalog - HR, Payroll & Recruitment
-- ------------------------------------------------------------
INSERT INTO public.bi_report_definitions
  (company_id, report_code, name, description, category, module_key, report_type, data_source, parameters, columns_config, query_config, is_system, tags)
SELECT c.id, v.report_code, v.name, v.description, v.category, v.module_key, v.report_type, v.data_source,
       '[]'::jsonb, '[]'::jsonb, '{}'::jsonb, true, v.tags
FROM public.companies c
CROSS JOIN (VALUES
  ('RPT-HR-MASTER','Employee Master','Employee master register','operational','hr','tabular','employees',ARRAY['hr','employee']),
  ('RPT-HR-HEAD','Headcount Analysis','Headcount by department and location','analytical','hr','crosstab','employees',ARRAY['hr','headcount']),
  ('RPT-HR-DEPT','Department Analysis','People metrics by department','analytical','hr','analytical','employees',ARRAY['hr','department']),
  ('RPT-HR-TURN','Turnover Analysis','Voluntary and involuntary turnover','analytical','hr','analytical','employee_exits',ARRAY['hr','turnover']),
  ('RPT-HR-ATTEND','Attendance Report','Attendance by employee and period','operational','hr','tabular','attendance_records',ARRAY['hr','attendance']),
  ('RPT-HR-LEAVE','Leave Analysis','Leave balances and usage','analytical','hr','analytical','leave_requests',ARRAY['hr','leave']),
  ('RPT-HR-EXIT','Exit Analysis','Exit reasons and interview summaries','analytical','hr','analytical','employee_exits',ARRAY['hr','exit']),
  ('RPT-HR-COST','Cost per Employee','Employment cost per employee and department','analytical','hr','analytical','employees',ARRAY['hr','cost']),
  ('RPT-REC-VAC','Vacancies Register','Open vacancies by department','operational','recruitment','tabular','ta_vacancies',ARRAY['hr','recruitment']),
  ('RPT-REC-FUNNEL','Candidate Funnel','Application to offer conversion funnel','analytical','recruitment','analytical','ta_applications',ARRAY['hr','recruitment']),
  ('RPT-REC-TTH','Time to Hire','Time to hire by role and recruiter','analytical','recruitment','analytical','ta_applications',ARRAY['hr','recruitment']),
  ('RPT-REC-COST','Cost per Hire','Cost per hire by role and source','analytical','recruitment','analytical','ta_applications',ARRAY['hr','recruitment']),
  ('RPT-REC-PERF','Recruiter Performance','Pipeline and hires by recruiter','analytical','recruitment','analytical','ta_applications',ARRAY['hr','recruitment']),
  ('RPT-REC-PIPELINE','Talent Pipeline','Talent pipeline by stage','operational','recruitment','interactive','ta_applications',ARRAY['hr','recruitment']),
  ('RPT-PAY-COST','Payroll Cost Analysis','Payroll cost by component and department','analytical','payroll','analytical','payroll_runs',ARRAY['payroll','cost']),
  ('RPT-PAY-SALARY','Salary Analysis','Salary distribution and structure','analytical','payroll','analytical','pay_payslips',ARRAY['payroll','salary']),
  ('RPT-PAY-RUN','Payroll Run Register','Payroll runs by period and status','operational','payroll','tabular','payroll_runs',ARRAY['payroll','run']),
  ('RPT-PAY-SLIP','Payslip Register','Payslip register by period','operational','payroll','tabular','pay_payslips',ARRAY['payroll','payslip']),
  ('RPT-PAY-BENEFIT','Benefits Report','Benefits and allowances analysis','analytical','payroll','analytical','pay_payslips',ARRAY['payroll','benefits']),
  ('RPT-PAY-DEDUCT','Deductions Report','Deductions by type and employee','analytical','payroll','analytical','pay_payslips',ARRAY['payroll','deduction']),
  ('RPT-HR-ATTRISK','Attrition Prediction','AI attrition risk by employee','ai','hr','predictive','employees',ARRAY['ai','attrition']),
  ('RPT-HR-SKILLGAP','Skills Gap Analysis','AI skills gap by department','ai','hr','prescriptive','employees',ARRAY['ai','skills']),
  ('RPT-HR-FORECAST','Workforce Forecast','AI workforce demand forecast','ai','hr','forecast','employees',ARRAY['ai','workforce']),
  ('RPT-HR-DIVERSITY','Workforce Diversity','Diversity metrics by demographic','statistical','hr','statistical','employees',ARRAY['hr','diversity'])
) AS v(report_code, name, description, category, module_key, report_type, data_source, tags)
WHERE NOT EXISTS (
  SELECT 1 FROM public.bi_report_definitions d
  WHERE d.company_id = c.id AND d.report_code = v.report_code
)
ON CONFLICT (company_id, report_code) DO NOTHING;

-- ------------------------------------------------------------
-- 10. Enterprise report catalog - Projects & Service Desk
-- ------------------------------------------------------------
INSERT INTO public.bi_report_definitions
  (company_id, report_code, name, description, category, module_key, report_type, data_source, parameters, columns_config, query_config, is_system, tags)
SELECT c.id, v.report_code, v.name, v.description, v.category, v.module_key, v.report_type, v.data_source,
       '[]'::jsonb, '[]'::jsonb, '{}'::jsonb, true, v.tags
FROM public.companies c
CROSS JOIN (VALUES
  ('RPT-PRJ-DASH','Project Dashboard','Project portfolio dashboard','executive','projects','interactive','ppm_projects',ARRAY['project','dashboard']),
  ('RPT-PRJ-COST','Project Cost','Actual project cost analysis','analytical','projects','analytical','ppm_expenses',ARRAY['project','cost']),
  ('RPT-PRJ-PROFIT','Project Profitability','Revenue and margin by project','analytical','projects','analytical','ppm_revenue',ARRAY['project','profitability']),
  ('RPT-PRJ-BUDGET','Budget Variance','Budget versus actual by project','analytical','projects','comparative','ppm_budgets',ARRAY['project','budget']),
  ('RPT-PRJ-TIMELINE','Timeline Analysis','Schedule variance and milestones','analytical','projects','analytical','ppm_tasks',ARRAY['project','timeline']),
  ('RPT-PRJ-RES','Resource Utilization','Utilization by resource and project','analytical','projects','analytical','ppm_resource_allocations',ARRAY['project','resource']),
  ('RPT-PRJ-RISK','Project Risk Register','Open risks by project','exception','projects','exception','ppm_risks',ARRAY['project','risk']),
  ('RPT-PRJ-ISSUE','Issues Register','Open issues by project','operational','projects','tabular','ppm_issues',ARRAY['project','issue']),
  ('RPT-PRJ-TIMESHEET','Timesheet Summary','Timesheet submission and hours','operational','projects','tabular','ppm_timesheets',ARRAY['project','timesheet']),
  ('RPT-PRJ-PORTFOLIO','Portfolio Analysis','Portfolio performance and mix','analytical','projects','analytical','ppm_portfolios',ARRAY['project','portfolio']),
  ('RPT-SD-DASH','Ticket Dashboard','Service desk ticket dashboard','executive','servicedesk','interactive','support_tickets',ARRAY['servicedesk','dashboard']),
  ('RPT-SD-SLA','SLA Report','SLA compliance by policy','analytical','servicedesk','analytical','support_tickets',ARRAY['servicedesk','sla']),
  ('RPT-SD-RES','Resolution Time','Resolution and response time analysis','analytical','servicedesk','analytical','support_tickets',ARRAY['servicedesk','resolution']),
  ('RPT-SD-TECH','Technician Performance','Workload and performance by technician','analytical','servicedesk','analytical','support_tickets',ARRAY['servicedesk','technician']),
  ('RPT-SD-TREND','Incident Trends','Incident volume trends by category','analytical','servicedesk','analytical','support_tickets',ARRAY['servicedesk','trend']),
  ('RPT-SD-CSAT','CSAT Analysis','Customer satisfaction by ticket','analytical','servicedesk','analytical','sd_csat_responses',ARRAY['servicedesk','csat']),
  ('RPT-SD-PROB','Problem Management','Problem records and known errors','operational','servicedesk','tabular','sd_problems',ARRAY['servicedesk','problem']),
  ('RPT-SD-BACKLOG','Ticket Backlog','Open tickets by age and priority','exception','servicedesk','exception','support_tickets',ARRAY['servicedesk','backlog'])
) AS v(report_code, name, description, category, module_key, report_type, data_source, tags)
WHERE NOT EXISTS (
  SELECT 1 FROM public.bi_report_definitions d
  WHERE d.company_id = c.id AND d.report_code = v.report_code
)
ON CONFLICT (company_id, report_code) DO NOTHING;

-- ------------------------------------------------------------
-- 11. Enterprise report catalog - Security, Audit & Compliance
-- ------------------------------------------------------------
INSERT INTO public.bi_report_definitions
  (company_id, report_code, name, description, category, module_key, report_type, data_source, parameters, columns_config, query_config, is_system, tags)
SELECT c.id, v.report_code, v.name, v.description, v.category, v.module_key, v.report_type, v.data_source,
       '[]'::jsonb, '[]'::jsonb, '{}'::jsonb, true, v.tags
FROM public.companies c
CROSS JOIN (VALUES
  ('RPT-SEC-LOGIN','Login Activity','Successful login activity','security','security','tabular','login_history',ARRAY['security','login']),
  ('RPT-SEC-FAIL','Failed Logins','Failed login attempts and lockouts','exception','security','exception','login_history',ARRAY['security','login']),
  ('RPT-SEC-USERACT','User Activity','User activity by module and action','security','security','analytical','audit_log',ARRAY['security','activity']),
  ('RPT-SEC-PERM','Permission Changes','Role and permission change history','audit','security','audit','audit_log',ARRAY['security','permission']),
  ('RPT-SEC-INCIDENT','Security Incidents','Security incident register','security','security','tabular','security_alerts',ARRAY['security','incident']),
  ('RPT-SEC-ALERT','Alert Summary','Security alert summary by severity','security','security','analytical','security_alerts',ARRAY['security','alert']),
  ('RPT-SEC-ANOMALY','Anomaly Detection','AI detected access anomalies','ai','security','predictive','login_history',ARRAY['ai','security']),
  ('RPT-AUD-TRAIL','Complete Audit Trail','Immutable audit trail of system events','audit','audit','drill_down','audit_log',ARRAY['audit','trail']),
  ('RPT-AUD-DATA','Data Changes','Record level data changes','audit','audit','audit','audit_log',ARRAY['audit','data']),
  ('RPT-AUD-APPROVALS','Approval History','Approval workflow history','audit','audit','audit','eal_approvals',ARRAY['audit','approval']),
  ('RPT-AUD-EVENTS','System Events','Enterprise activity log events','audit','audit','tabular','eal_events',ARRAY['audit','events']),
  ('RPT-AUD-CONTROLS','Internal Controls','Control register and effectiveness','compliance','compliance','compliance','eal_controls',ARRAY['compliance','controls']),
  ('RPT-AUD-FINDINGS','Audit Findings','Findings and remediation status','compliance','compliance','compliance','eal_findings',ARRAY['compliance','findings']),
  ('RPT-COMP-ISO','ISO 27001 Pack','ISO 27001 control evidence pack','compliance','compliance','compliance','eal_controls',ARRAY['iso27001','compliance']),
  ('RPT-COMP-SOC2','SOC 2 Readiness','SOC 2 trust criteria readiness','compliance','compliance','compliance','eal_controls',ARRAY['soc2','compliance']),
  ('RPT-COMP-GDPR','GDPR Pack','GDPR data protection reports','compliance','compliance','compliance','eal_controls',ARRAY['gdpr','compliance']),
  ('RPT-COMP-UDP','Uganda Data Protection','NDP / PDPO compliance reports','compliance','compliance','compliance','eal_controls',ARRAY['udp','compliance']),
  ('RPT-COMP-POLICY','Policy Compliance','Policy adoption and exceptions','compliance','compliance','compliance','eal_controls',ARRAY['compliance','policy'])
) AS v(report_code, name, description, category, module_key, report_type, data_source, tags)
WHERE NOT EXISTS (
  SELECT 1 FROM public.bi_report_definitions d
  WHERE d.company_id = c.id AND d.report_code = v.report_code
)
ON CONFLICT (company_id, report_code) DO NOTHING;-- ------------------------------------------------------------
-- 12. Enterprise report catalog - Executive, AI & Industry
-- ------------------------------------------------------------
INSERT INTO public.bi_report_definitions
  (company_id, report_code, name, description, category, module_key, report_type, data_source, parameters, columns_config, query_config, is_system, tags)
SELECT c.id, v.report_code, v.name, v.description, v.category, v.module_key, v.report_type, v.data_source,
       '[]'::jsonb, '[]'::jsonb, '{}'::jsonb, true, v.tags
FROM public.companies c
CROSS JOIN (VALUES
  ('RPT-EXEC-CEO','CEO Dashboard Pack','Strategic performance for the CEO','executive','executive','executive','bi_kpis',ARRAY['executive','ceo']),
  ('RPT-EXEC-CFO','CFO Dashboard Pack','Financial performance for the CFO','executive','executive','executive','bi_kpis',ARRAY['executive','cfo']),
  ('RPT-EXEC-COO','COO Dashboard Pack','Operations performance for the COO','executive','executive','executive','bi_kpis',ARRAY['executive','coo']),
  ('RPT-EXEC-CHRO','CHRO Dashboard Pack','Workforce performance for the CHRO','executive','executive','executive','bi_kpis',ARRAY['executive','chro']),
  ('RPT-EXEC-BOARD','Board Pack','Board reporting pack with governance KPIs','executive','executive','executive','bi_kpis',ARRAY['executive','board']),
  ('RPT-EXEC-MD','Managing Director Pack','MD operational and strategic pack','executive','executive','executive','bi_kpis',ARRAY['executive','md']),
  ('RPT-EXEC-INVESTOR','Investor Briefing','Investor reporting pack','executive','executive','executive','bi_kpis',ARRAY['executive','investor']),
  ('RPT-EXEC-KPI','KPI Scorecard','Full KPI scorecard by category','analytical','executive','analytical','bi_kpis',ARRAY['executive','kpi']),
  ('RPT-EXEC-BUDGET','Budget vs Actual','Group budget versus actual','comparative','executive','comparative','budgets',ARRAY['executive','budget']),
  ('RPT-EXEC-CASH','Cash Position','Group cash position and liquidity','financial','executive','financial_statement','bank_transactions',ARRAY['executive','cash']),
  ('RPT-EXEC-GROWTH','Growth Analysis','Revenue and customer growth trends','analytical','executive','analytical','invoices',ARRAY['executive','growth']),
  ('RPT-EXEC-RISK','Enterprise Risk Register','Consolidated risk register','executive','executive','exception','bi_ai_insights',ARRAY['executive','risk']),
  ('RPT-AI-DAILY','Daily Business Briefing','AI generated daily briefing','ai','ai','ai','bi_ai_insights',ARRAY['ai','briefing']),
  ('RPT-AI-PREDICT','Predictive Insights','AI predictive insight feed','ai','ai','predictive','bi_ai_insights',ARRAY['ai','predictive']),
  ('RPT-AI-REC','Recommendations','AI recommendations and actions','ai','ai','prescriptive','bi_ai_insights',ARRAY['ai','recommendation']),
  ('RPT-AI-CASHFLOW','Cash Flow Forecast','AI cash flow forecast','ai','finance','ai','bank_transactions',ARRAY['ai','cashflow']),
  ('RPT-AI-DEMAND','Demand Forecast','AI demand forecast by product','ai','scm','ai','stock_balances',ARRAY['ai','demand']),
  ('RPT-IND-HEALTH','Healthcare Analytics','Healthcare institution reporting pack','industry','industry','analytical','bi_kpis',ARRAY['industry','healthcare']),
  ('RPT-IND-EDU','Education Analytics','Education institution reporting pack','industry','industry','analytical','bi_kpis',ARRAY['industry','education']),
  ('RPT-IND-BANK','Banking Analytics','Banking and financial services pack','industry','industry','analytical','bi_kpis',ARRAY['industry','banking']),
  ('RPT-IND-TELCO','Telecom Analytics','Telecom operator reporting pack','industry','industry','analytical','bi_kpis',ARRAY['industry','telecom']),
  ('RPT-IND-LOG','Logistics Analytics','Logistics and freight reporting pack','industry','industry','analytical','bi_kpis',ARRAY['industry','logistics']),
  ('RPT-IND-RETAIL','Retail Analytics','Retail reporting pack','industry','industry','analytical','bi_kpis',ARRAY['industry','retail']),
  ('RPT-IND-GOV','Government Reporting','Public sector reporting pack','industry','industry','analytical','bi_kpis',ARRAY['industry','government']),
  ('RPT-IND-MFG','Manufacturing Pack','Discrete and process manufacturing pack','industry','industry','analytical','bi_kpis',ARRAY['industry','manufacturing']),
  ('RPT-IND-MULTI','Multinational Pack','Multinational consolidation and reporting','industry','industry','analytical','bi_kpis',ARRAY['industry','multinational'])
) AS v(report_code, name, description, category, module_key, report_type, data_source, tags)
WHERE NOT EXISTS (
  SELECT 1 FROM public.bi_report_definitions d
  WHERE d.company_id = c.id AND d.report_code = v.report_code
)
ON CONFLICT (company_id, report_code) DO NOTHING;

-- ------------------------------------------------------------
-- 13. Executive & departmental dashboards (per company)
-- ------------------------------------------------------------
INSERT INTO public.bi_dashboards
  (company_id, dashboard_code, name, description, audience, is_system, is_default, sort_order)
SELECT c.id, v.dashboard_code, v.name, v.description, v.audience, true, v.is_default, v.sort_order
FROM public.companies c
CROSS JOIN (VALUES
  ('DB-EXEC','Executive Dashboard','Enterprise-wide KPI overview','executive',true,10),
  ('DB-CEO','CEO Dashboard','Strategic performance: revenue, profit, cash, growth, risk','ceo',false,15),
  ('DB-CFO','CFO Dashboard','Financial performance: margins, budget, cash forecast, AR/AP','cfo',false,20),
  ('DB-COO','COO Dashboard','Operations: production, inventory, supply chain','coo',false,25),
  ('DB-CHRO','CHRO Dashboard','Workforce: headcount, payroll, attrition, talent','chro',false,30),
  ('DB-MD','Managing Director Dashboard','Operational and strategic MD view','md',false,35),
  ('DB-BOARD','Board Dashboard','Governance and board pack','board',false,40),
  ('DB-INVESTOR','Investor Dashboard','Investor and shareholder view','investor',false,45),
  ('DB-FIN','Finance Dashboard','GL, AR, AP, cash and tax','finance',false,50),
  ('DB-SALES','Sales Dashboard','Revenue, pipeline and sales performance','sales',false,55),
  ('DB-CRM','CRM Dashboard','Leads, opportunities and customer health','crm',false,60),
  ('DB-PUR','Procurement Dashboard','Spend, suppliers and contracts','procurement',false,65),
  ('DB-WHS','Warehouse Dashboard','Stock, valuation and warehouse operations','warehouse',false,70),
  ('DB-PRD','Production Dashboard','Output, OEE and quality','production',false,75),
  ('DB-HR','HR Dashboard','Workforce and attendance','hr',false,80),
  ('DB-PAY','Payroll Dashboard','Payroll cost and runs','payroll',false,85),
  ('DB-PRJ','Project Dashboard','Portfolio, cost and timeline','projects',false,90),
  ('DB-SD','Service Desk Dashboard','Tickets, SLA and CSAT','servicedesk',false,95),
  ('DB-SEC','Security Dashboard','Logins, incidents and alerts','security',false,100),
  ('DB-AUDIT','Audit Dashboard','Audit trail and findings','audit',false,105),
  ('DB-COMP','Compliance Dashboard','Controls and compliance posture','compliance',false,110)
) AS v(dashboard_code, name, description, audience, is_default, sort_order)
WHERE NOT EXISTS (
  SELECT 1 FROM public.bi_dashboards d
  WHERE d.company_id = c.id AND d.dashboard_code = v.dashboard_code
)
ON CONFLICT (company_id, dashboard_code) DO NOTHING;

-- ------------------------------------------------------------
-- 14. Dashboard widgets (per company, keyed to dashboard code)
-- ------------------------------------------------------------
INSERT INTO public.bi_dashboard_widgets
  (company_id, tenant_id, dashboard_id, widget_key, title, widget_type, data_source, config, position, sort_order, is_visible)
SELECT c.id, c.tenant_id, d.id, v.widget_key, v.title, v.widget_type, v.data_source, v.config::jsonb, v.position::jsonb, v.sort_order, true
FROM public.companies c
CROSS JOIN (VALUES
  ('DB-EXEC', 'w-rev', 'Revenue', 'chart_line', 'invoices', '{"measure":"total","aggregate":"sum"}'::text, '{"x":0,"y":0,"w":6,"h":3}'::text, 10),
  ('DB-EXEC', 'w-profit', 'Net Profit', 'kpi', 'bi_kpis', '{"kpi_code":"KPI-NP"}'::text, '{"x":6,"y":0,"w":3,"h":3}'::text, 20),
  ('DB-EXEC', 'w-cash', 'Cash Position', 'gauge', 'bank_transactions', '{"measure":"amount","aggregate":"sum"}'::text, '{"x":9,"y":0,"w":3,"h":3}'::text, 30),
  ('DB-EXEC', 'w-risk', 'Risk Alerts', 'alert', 'bi_ai_insights', '{"severity":"high"}'::text, '{"x":0,"y":3,"w":6,"h":2}'::text, 40),
  ('DB-EXEC', 'w-kpi-table', 'KPI Scorecard', 'table', 'bi_kpis', '{}'::text, '{"x":6,"y":3,"w":6,"h":2}'::text, 50),
  ('DB-CEO', 'w-rev', 'Revenue', 'chart_line', 'invoices', '{"measure":"total","aggregate":"sum"}'::text, '{"x":0,"y":0,"w":6,"h":3}'::text, 10),
  ('DB-CEO', 'w-growth', 'Sales Growth', 'kpi', 'invoices', '{"measure":"total","aggregate":"sum"}'::text, '{"x":6,"y":0,"w":2,"h":3}'::text, 20),
  ('DB-CEO', 'w-cust', 'Customer Growth', 'kpi', 'customers', '{}'::text, '{"x":8,"y":0,"w":2,"h":3}'::text, 30),
  ('DB-CEO', 'w-employees', 'Employee Growth', 'kpi', 'employees', '{}'::text, '{"x":10,"y":0,"w":2,"h":3}'::text, 40),
  ('DB-CEO', 'w-ai', 'AI Briefing', 'alert', 'bi_ai_insights', '{"type":"briefing"}'::text, '{"x":0,"y":3,"w":12,"h":2}'::text, 50),
  ('DB-CFO', 'w-rev', 'Revenue', 'chart_line', 'invoices', '{"measure":"total","aggregate":"sum"}'::text, '{"x":0,"y":0,"w":4,"h":3}'::text, 10),
  ('DB-CFO', 'w-margin', 'Gross Margin', 'kpi', 'bi_kpis', '{"kpi_code":"KPI-GM"}'::text, '{"x":4,"y":0,"w":2,"h":3}'::text, 20),
  ('DB-CFO', 'w-ar', 'AR Aging', 'chart_pie', 'invoices', '{"measure":"total","group":"status"}'::text, '{"x":6,"y":0,"w":3,"h":3}'::text, 30),
  ('DB-CFO', 'w-ap', 'AP Aging', 'chart_pie', 'ap_invoices', '{"measure":"total","group":"status"}'::text, '{"x":9,"y":0,"w":3,"h":3}'::text, 40),
  ('DB-CFO', 'w-cash', 'Cash Forecast', 'chart_area', 'bank_transactions', '{"measure":"amount","aggregate":"sum"}'::text, '{"x":0,"y":3,"w":8,"h":2}'::text, 50),
  ('DB-CFO', 'w-budget', 'Budget vs Actual', 'chart_bar', 'budgets', '{}'::text, '{"x":8,"y":3,"w":4,"h":2}'::text, 60),
  ('DB-COO', 'w-output', 'Production Output', 'chart_bar', 'mes_production_orders', '{"measure":"planned_qty","aggregate":"sum"}'::text, '{"x":0,"y":0,"w":5,"h":3}'::text, 10),
  ('DB-COO', 'w-oee', 'OEE', 'gauge', 'mes_oee_snapshots', '{"measure":"oee","aggregate":"avg"}'::text, '{"x":5,"y":0,"w":2,"h":3}'::text, 20),
  ('DB-COO', 'w-inv', 'Inventory Value', 'kpi', 'stock_balances', '{"measure":"quantity","aggregate":"sum"}'::text, '{"x":7,"y":0,"w":2,"h":3}'::text, 30),
  ('DB-COO', 'w-otd', 'On-Time Delivery', 'chart_line', 'supplier_scorecards', '{}'::text, '{"x":9,"y":0,"w":3,"h":3}'::text, 40),
  ('DB-COO', 'w-stockout', 'Stockout Alerts', 'alert', 'stock_balances', '{}'::text, '{"x":0,"y":3,"w":12,"h":2}'::text, 50),
  ('DB-CHRO', 'w-head', 'Headcount', 'chart_pie', 'employees', '{}'::text, '{"x":0,"y":0,"w":5,"h":3}'::text, 10),
  ('DB-CHRO', 'w-attrition', 'Turnover Rate', 'kpi', 'employee_exits', '{}'::text, '{"x":5,"y":0,"w":2,"h":3}'::text, 20),
  ('DB-CHRO', 'w-payroll', 'Payroll Cost', 'chart_line', 'payroll_runs', '{"measure":"gross_amount","aggregate":"sum"}'::text, '{"x":7,"y":0,"w":5,"h":3}'::text, 30),
  ('DB-CHRO', 'w-attrisk', 'Attrition Risk', 'alert', 'bi_ai_insights', '{"type":"attrition"}'::text, '{"x":0,"y":3,"w":12,"h":2}'::text, 40),
  ('DB-MD', 'w-rev', 'Revenue', 'chart_line', 'invoices', '{"measure":"total","aggregate":"sum"}'::text, '{"x":0,"y":0,"w":5,"h":3}'::text, 10),
  ('DB-MD', 'w-kpi', 'Key KPIs', 'table', 'bi_kpis', '{}'::text, '{"x":5,"y":0,"w":7,"h":3}'::text, 20),
  ('DB-MD', 'w-ai', 'AI Insights', 'alert', 'bi_ai_insights', '{}'::text, '{"x":0,"y":3,"w":12,"h":2}'::text, 30),
  ('DB-BOARD', 'w-kpi', 'Board KPIs', 'table', 'bi_kpis', '{}'::text, '{"x":0,"y":0,"w":6,"h":3}'::text, 10),
  ('DB-BOARD', 'w-risk', 'Risk Register', 'alert', 'bi_ai_insights', '{"severity":"high"}'::text, '{"x":6,"y":0,"w":6,"h":3}'::text, 20),
  ('DB-BOARD', 'w-compliance', 'Compliance', 'gauge', 'eal_controls', '{}'::text, '{"x":0,"y":3,"w":6,"h":2}'::text, 30),
  ('DB-BOARD', 'w-audit', 'Audit Findings', 'alert', 'eal_findings', '{}'::text, '{"x":6,"y":3,"w":6,"h":2}'::text, 40),
  ('DB-INVESTOR', 'w-rev', 'Revenue', 'chart_line', 'invoices', '{"measure":"total","aggregate":"sum"}'::text, '{"x":0,"y":0,"w":6,"h":3}'::text, 10),
  ('DB-INVESTOR', 'w-margin', 'Margin', 'chart_area', 'invoices', '{"measure":"total","aggregate":"sum"}'::text, '{"x":6,"y":0,"w":6,"h":3}'::text, 20),
  ('DB-INVESTOR', 'w-kpi', 'Investor KPIs', 'table', 'bi_kpis', '{}'::text, '{"x":0,"y":3,"w":12,"h":2}'::text, 30),
  ('DB-FIN', 'w-cash', 'Cash Position', 'chart_area', 'bank_transactions', '{"measure":"amount","aggregate":"sum"}'::text, '{"x":0,"y":0,"w":5,"h":3}'::text, 10),
  ('DB-FIN', 'w-ar', 'AR Balance', 'kpi', 'invoices', '{"measure":"total","aggregate":"sum"}'::text, '{"x":5,"y":0,"w":2,"h":3}'::text, 20),
  ('DB-FIN', 'w-ap', 'AP Balance', 'kpi', 'ap_invoices', '{"measure":"total","aggregate":"sum"}'::text, '{"x":7,"y":0,"w":2,"h":3}'::text, 30),
  ('DB-FIN', 'w-tax', 'Tax Position', 'gauge', 'tax_codes', '{}'::text, '{"x":9,"y":0,"w":3,"h":3}'::text, 40),
  ('DB-FIN', 'w-gl', 'GL Summary', 'table', 'gl_journals', '{}'::text, '{"x":0,"y":3,"w":12,"h":2}'::text, 50),
  ('DB-SALES', 'w-rev', 'Revenue', 'chart_line', 'invoices', '{"measure":"total","aggregate":"sum"}'::text, '{"x":0,"y":0,"w":6,"h":3}'::text, 10),
  ('DB-SALES', 'w-pipe', 'Pipeline', 'chart_bar', 'sales_opportunities', '{"measure":"value","aggregate":"sum","group":"stage"}'::text, '{"x":6,"y":0,"w":6,"h":3}'::text, 20),
  ('DB-SALES', 'w-perf', 'Salesperson', 'table', 'invoices', '{}'::text, '{"x":0,"y":3,"w":12,"h":2}'::text, 30),
  ('DB-CRM', 'w-leads', 'Leads', 'chart_bar', 'sales_leads', '{"group":"status"}'::text, '{"x":0,"y":0,"w":6,"h":3}'::text, 10),
  ('DB-CRM', 'w-opp', 'Opportunities', 'chart_pie', 'sales_opportunities', '{"group":"stage"}'::text, '{"x":6,"y":0,"w":6,"h":3}'::text, 20),
  ('DB-CRM', 'w-churn', 'Churn Risk', 'alert', 'bi_ai_insights', '{"type":"churn"}'::text, '{"x":0,"y":3,"w":12,"h":2}'::text, 30),
  ('DB-PUR', 'w-spend', 'Spend', 'chart_bar', 'ap_invoices', '{"measure":"total","aggregate":"sum","group":"supplier_id"}'::text, '{"x":0,"y":0,"w":6,"h":3}'::text, 10),
  ('DB-PUR', 'w-score', 'Supplier Scores', 'table', 'supplier_scorecards', '{}'::text, '{"x":6,"y":0,"w":6,"h":3}'::text, 20),
  ('DB-PUR', 'w-savings', 'Savings', 'alert', 'bi_ai_insights', '{"type":"supplier_risk"}'::text, '{"x":0,"y":3,"w":12,"h":2}'::text, 30),
  ('DB-WHS', 'w-stock', 'Stock Value', 'chart_bar', 'stock_balances', '{"measure":"quantity","aggregate":"sum","group":"warehouse_id"}'::text, '{"x":0,"y":0,"w":6,"h":3}'::text, 10),
  ('DB-WHS', 'w-aging', 'Aging', 'chart_pie', 'stock_balances', '{"group":"age"}'::text, '{"x":6,"y":0,"w":6,"h":3}'::text, 20),
  ('DB-WHS', 'w-short', 'Shortage', 'alert', 'stock_balances', '{}'::text, '{"x":0,"y":3,"w":12,"h":2}'::text, 30),
  ('DB-PRD', 'w-output', 'Output', 'chart_line', 'mes_production_orders', '{"measure":"planned_qty","aggregate":"sum"}'::text, '{"x":0,"y":0,"w":5,"h":3}'::text, 10),
  ('DB-PRD', 'w-oee', 'OEE', 'chart_line', 'mes_oee_snapshots', '{"measure":"oee","aggregate":"avg"}'::text, '{"x":5,"y":0,"w":4,"h":3}'::text, 20),
  ('DB-PRD', 'w-defects', 'Defects', 'kpi', 'mes_quality_inspections', '{}'::text, '{"x":9,"y":0,"w":3,"h":3}'::text, 30),
  ('DB-PRD', 'w-downtime', 'Downtime', 'chart_pie', 'mes_downtime', '{"group":"reason"}'::text, '{"x":0,"y":3,"w":12,"h":2}'::text, 40),
  ('DB-HR', 'w-head', 'Headcount', 'chart_line', 'employees', '{}'::text, '{"x":0,"y":0,"w":6,"h":3}'::text, 10),
  ('DB-HR', 'w-attend', 'Attendance', 'kpi', 'attendance_records', '{}'::text, '{"x":6,"y":0,"w":3,"h":3}'::text, 20),
  ('DB-HR', 'w-leave', 'Leave', 'table', 'leave_requests', '{}'::text, '{"x":9,"y":0,"w":3,"h":3}'::text, 30),
  ('DB-PAY', 'w-cost', 'Payroll Cost', 'chart_line', 'payroll_runs', '{"measure":"gross_amount","aggregate":"sum"}'::text, '{"x":0,"y":0,"w":6,"h":3}'::text, 10),
  ('DB-PAY', 'w-runs', 'Runs', 'chart_pie', 'payroll_runs', '{"group":"status"}'::text, '{"x":6,"y":0,"w":6,"h":3}'::text, 20),
  ('DB-PAY', 'w-deductions', 'Deductions', 'table', 'pay_payslips', '{}'::text, '{"x":0,"y":3,"w":12,"h":2}'::text, 30),
  ('DB-PRJ', 'w-portfolio', 'Portfolio', 'chart_pie', 'ppm_projects', '{"group":"status"}'::text, '{"x":0,"y":0,"w":6,"h":3}'::text, 10),
  ('DB-PRJ', 'w-cost', 'Cost', 'chart_bar', 'ppm_budgets', '{}'::text, '{"x":6,"y":0,"w":6,"h":3}'::text, 20),
  ('DB-PRJ', 'w-risk', 'Risks', 'alert', 'ppm_risks', '{}'::text, '{"x":0,"y":3,"w":12,"h":2}'::text, 30),
  ('DB-SD', 'w-tickets', 'Tickets', 'chart_pie', 'support_tickets', '{"group":"status"}'::text, '{"x":0,"y":0,"w":6,"h":3}'::text, 10),
  ('DB-SD', 'w-sla', 'SLA', 'gauge', 'support_tickets', '{}'::text, '{"x":6,"y":0,"w":3,"h":3}'::text, 20),
  ('DB-SD', 'w-csat', 'CSAT', 'kpi', 'sd_csat_responses', '{}'::text, '{"x":9,"y":0,"w":3,"h":3}'::text, 30),
  ('DB-SEC', 'w-logins', 'Logins', 'chart_line', 'login_history', '{}'::text, '{"x":0,"y":0,"w":6,"h":3}'::text, 10),
  ('DB-SEC', 'w-failed', 'Failed Logins', 'alert', 'login_history', '{"status":"failed"}'::text, '{"x":6,"y":0,"w":6,"h":3}'::text, 20),
  ('DB-SEC', 'w-incidents', 'Incidents', 'chart_pie', 'security_alerts', '{"group":"severity"}'::text, '{"x":0,"y":3,"w":12,"h":2}'::text, 30),
  ('DB-AUDIT', 'w-trail', 'Audit Trail', 'table', 'audit_log', '{}'::text, '{"x":0,"y":0,"w":12,"h":3}'::text, 10),
  ('DB-AUDIT', 'w-findings', 'Findings', 'alert', 'eal_findings', '{}'::text, '{"x":0,"y":3,"w":12,"h":2}'::text, 20),
  ('DB-COMP', 'w-controls', 'Controls', 'gauge', 'eal_controls', '{}'::text, '{"x":0,"y":0,"w":6,"h":3}'::text, 10),
  ('DB-COMP', 'w-frameworks', 'Frameworks', 'table', 'eal_controls', '{}'::text, '{"x":6,"y":0,"w":6,"h":3}'::text, 20),
  ('DB-COMP', 'w-exceptions', 'Exceptions', 'alert', 'eal_findings', '{}'::text, '{"x":0,"y":3,"w":12,"h":2}'::text, 30)
) AS v(dashboard_code, widget_key, title, widget_type, data_source, config, position, sort_order)
JOIN public.bi_dashboards d ON d.company_id = c.id AND d.dashboard_code = v.dashboard_code
WHERE NOT EXISTS (SELECT 1 FROM public.bi_dashboard_widgets w
  WHERE w.dashboard_id = d.id AND w.widget_key = v.widget_key);-- ------------------------------------------------------------
-- 15. KPI catalog (per company) - engine computes actual values
-- ------------------------------------------------------------
INSERT INTO public.bi_kpis
  (company_id, kpi_code, name, category, department, formula, unit, target_value, frequency, higher_is_better, threshold_warning, threshold_critical, data_source, is_active)
SELECT c.id, v.kpi_code, v.name, v.category, v.department, v.formula, v.unit, v.target_value, v.frequency, v.higher_is_better, v.threshold_warning, v.threshold_critical, v.data_source, true
FROM public.companies c
CROSS JOIN (VALUES
  ('KPI-REV','Revenue','financial','Finance','SUM(invoices.total)','UGX',500000000,'monthly',true,450000000,400000000,'invoices'),
  ('KPI-NP','Net Profit','financial','Finance','Revenue - Costs','UGX',80000000,'monthly',true,70000000,50000000,'gl_journals'),
  ('KPI-GM','Gross Margin','financial','Finance','(Rev-COGS)/Rev*100','%',35,'monthly',true,30,25,'invoices'),
  ('KPI-EBITDA','EBITDA','financial','Finance','OP + D&A','UGX',120000000,'quarterly',true,100000000,80000000,'gl_journals'),
  ('KPI-OPM','Operating Margin','financial','Finance','Operating Profit/Revenue*100','%',20,'monthly',true,15,10,'gl_journals'),
  ('KPI-CCC','Cash Conversion Cycle','financial','Finance','DIO + DSO - DPO','days',45,'monthly',false,55,65,'invoices'),
  ('KPI-WC','Working Capital','financial','Finance','CA - CL','UGX',200000000,'monthly',true,150000000,100000000,'gl_journals'),
  ('KPI-DSO','Days Sales Outstanding','financial','Finance','AR/Revenue*PeriodDays','days',30,'monthly',false,45,60,'invoices'),
  ('KPI-DPO','Days Payable Outstanding','financial','Finance','AP/COGS*PeriodDays','days',45,'monthly',false,60,75,'ap_invoices'),
  ('KPI-CURRATIO','Current Ratio','financial','Finance','CA / CL','ratio',2.0,'monthly',true,1.5,1.0,'gl_journals'),
  ('KPI-ROA','Return on Assets','financial','Finance','Net Profit / Assets*100','%',8,'quarterly',true,5,3,'gl_journals'),
  ('KPI-REVGROWTH','Revenue Growth','financial','Finance','(Rev-Cur - Rev-Prev)/Rev-Prev*100','%',10,'monthly',true,5,0,'invoices'),
  ('KPI-CASH','Cash on Hand','financial','Finance','SUM(bank_transactions.amount)','UGX',150000000,'daily',true,80000000,40000000,'bank_transactions'),
  ('KPI-BUDGETVAR','Budget Variance','financial','Finance','(Actual-Budget)/Budget*100','%',0,'monthly',false,5,10,'budgets'),
  ('KPI-SCVR','Sales Conversion Rate','sales','Sales','Won / Opportunities','%',25,'monthly',true,20,15,'sales_opportunities'),
  ('KPI-OFUL','Order Fulfillment','sales','Sales','Fulfilled/Ordered*100','%',98,'weekly',true,95,90,'sales_orders'),
  ('KPI-CLV','Customer Lifetime Value','sales','Sales','SUM(revenue)/customers','UGX',1000000,'quarterly',true,800000,500000,'invoices'),
  ('KPI-CAC','Customer Acquisition Cost','sales','Sales','Marketing Spend / New Customers','UGX',50000,'quarterly',false,75000,100000,'sales_leads'),
  ('KPI-CHURN','Customer Churn','customer','CRM','Churned / Total Customers','%',2,'monthly',false,3,5,'customers'),
  ('KPI-PIPEVAL','Pipeline Value','sales','Sales','SUM(opportunity value)','UGX',300000000,'weekly',true,200000000,150000000,'sales_opportunities'),
  ('KPI-LEADCVR','Lead to Customer Rate','sales','Sales','Customers / Leads*100','%',5,'monthly',true,3,2,'sales_leads'),
  ('KPI-PEFF','Production Efficiency','production','Production','Actual/Planned*100','%',92,'weekly',true,85,80,'mes_production_orders'),
  ('KPI-MUTIL','Machine Utilization','production','Manufacturing','Run hours / Available','%',85,'daily',true,75,70,'mes_oee_snapshots'),
  ('KPI-OEE','Overall Equipment Effectiveness','production','Manufacturing','Availability*Performance*Quality','%',80,'daily',true,70,60,'mes_oee_snapshots'),
  ('KPI-YIELD','Production Yield','quality','Quality','Good Output / Total Output*100','%',97,'weekly',true,94,90,'mes_production_orders'),
  ('KPI-FPY','First Pass Yield','quality','Quality','Passed First Time / Total*100','%',95,'weekly',true,90,85,'mes_quality_inspections'),
  ('KPI-WASTE','Waste Rate','quality','Production','Waste / Input*100','%',2,'weekly',false,3.5,5,'mes_waste_records'),
  ('KPI-CAPACITY','Capacity Utilization','production','Manufacturing','Used / Available Capacity*100','%',85,'monthly',true,75,65,'mes_production_orders'),
  ('KPI-DEF','Defect Rate','quality','Quality','Defective / Produced*100','%',1.5,'weekly',false,2.5,3.5,'mes_quality_inspections'),
  ('KPI-NCR','Open NCRs','quality','Quality','COUNT(open NCRs)','count',5,'weekly',false,10,20,'mes_ncr'),
  ('KPI-CAPA','CAPA Closure Rate','quality','Quality','Closed / Raised*100','%',90,'monthly',true,80,70,'mes_ncr'),
  ('KPI-ONSHIP','On-Time Shipment','logistics','Logistics','On-time / Total Shipments*100','%',96,'weekly',true,90,85,'sales_orders'),
  ('KPI-ITURN','Inventory Turnover','inventory','Warehouse','COGS / Avg Inventory','x',6,'monthly',true,5,4,'stock_balances'),
  ('KPI-DIO','Days Inventory Outstanding','inventory','Warehouse','Avg Inventory / COGS*PeriodDays','days',45,'monthly',false,60,75,'stock_balances'),
  ('KPI-STOCKOUT','Stockout Rate','inventory','Warehouse','Stockout Lines / Total Lines*100','%',1,'weekly',false,3,5,'stock_balances'),
  ('KPI-FILL','Order Fill Rate','inventory','Warehouse','Filled / Ordered*100','%',97,'weekly',true,94,90,'stock_balances'),
  ('KPI-DEADSTOCK','Dead Stock Value','inventory','Warehouse','SUM(no-movement stock value)','UGX',0,'monthly',false,5000000,10000000,'stock_balances'),
  ('KPI-AGING30','Stock over 30 Days','inventory','Warehouse','Aged Stock / Total Stock*100','%',15,'monthly',false,25,40,'stock_balances'),
  ('KPI-OTD','On-Time Delivery','logistics','SCM','On-time shipments / Total','%',96,'weekly',true,90,85,'supplier_scorecards'),
  ('KPI-SLT','Supplier Lead Time','logistics','Procurement','AVG(GRN date - PO date)','days',7,'monthly',false,10,14,'purchase_orders'),
  ('KPI-PURCYCLE','Procurement Cycle Time','logistics','Procurement','AVG(receipt - requisition)','days',10,'monthly',false,15,25,'purchase_orders'),
  ('KPI-EPROD','Employee Productivity','hr','HR','Output / FTE','index',100,'monthly',true,90,85,'employees'),
  ('KPI-ATTRITION','Attrition Rate','hr','HR','Exits / Headcount*100','%',8,'monthly',false,12,18,'employee_exits'),
  ('KPI-TTH','Time to Hire','hr','Recruitment','AVG(offer - application)','days',30,'monthly',false,45,60,'ta_applications'),
  ('KPI-CPH','Cost per Hire','hr','Recruitment','Total Hire Cost / Hires','UGX',3000000,'quarterly',false,4500000,6000000,'ta_applications'),
  ('KPI-ABSENCE','Absence Rate','hr','HR','Absent Days / Scheduled Days*100','%',3,'monthly',false,5,8,'attendance_records'),
  ('KPI-CSAT','Customer Satisfaction','customer','CRM','AVG(survey score)','score',4.5,'monthly',true,4.0,3.5,'sd_csat_responses'),
  ('KPI-NPS','Net Promoter Score','customer','CRM','Promoters - Detractors','score',50,'quarterly',true,30,20,'sd_csat_responses'),
  ('KPI-CR','Complaint Rate','customer','CRM','Complaints / Customers*100','%',2,'monthly',false,4,6,'support_tickets'),
  ('KPI-FAILEDLOGIN','Failed Login Rate','security','Security','Failed / Total Logins*100','%',1,'daily',false,3,5,'login_history'),
  ('KPI-INCIDENT','Security Incidents','security','Security','COUNT(incidents)','count',0,'monthly',false,2,5,'security_alerts'),
  ('KPI-PATCH','Patch Compliance','security','Security','Patched / Total Systems*100','%',95,'monthly',true,90,85,'eal_controls')
) AS v(kpi_code, name, category, department, formula, unit, target_value, frequency, higher_is_better, threshold_warning, threshold_critical, data_source)
WHERE NOT EXISTS (
  SELECT 1 FROM public.bi_kpis k
  WHERE k.company_id = c.id AND k.kpi_code = v.kpi_code
)
ON CONFLICT (company_id, kpi_code) DO NOTHING;

-- ------------------------------------------------------------
-- 16. DWH layer metadata (per company)
-- ------------------------------------------------------------
INSERT INTO public.bi_dwh_objects
  (company_id, object_key, object_name, object_type, grain, description, columns_meta, relationships, refresh_mode, row_estimate, is_active)
SELECT c.id, v.object_key, v.object_name, v.object_type, v.grain, v.description, '[]'::jsonb, '[]'::jsonb, 'batch', 0, true
FROM public.companies c
CROSS JOIN (VALUES
  ('dim_company','Company Dimension','dimension','one row per company',ARRAY['dimension','core']),
  ('dim_branch','Branch Dimension','dimension','one row per branch',ARRAY['dimension','core']),
  ('dim_employee','Employee Dimension','dimension','one row per employee (SCD2)',ARRAY['dimension','hr']),
  ('dim_customer','Customer Dimension','dimension','one row per customer',ARRAY['dimension','sales']),
  ('dim_supplier','Supplier Dimension','dimension','one row per supplier',ARRAY['dimension','procurement']),
  ('dim_product','Product Dimension','dimension','one row per product / SKU',ARRAY['dimension','inventory']),
  ('dim_warehouse','Warehouse Dimension','dimension','one row per warehouse',ARRAY['dimension','inventory']),
  ('dim_account','GL Account Dimension','dimension','one row per chart of accounts node',ARRAY['dimension','finance']),
  ('dim_period','Fiscal Period Dimension','dimension','one row per fiscal period',ARRAY['dimension','finance']),
  ('dim_cost_center','Cost Center Dimension','dimension','one row per cost center',ARRAY['dimension','finance']),
  ('fact_gl_journal','GL Journal Fact','fact','one row per journal line',ARRAY['fact','finance']),
  ('fact_invoice','Invoice Fact','fact','one row per invoice',ARRAY['fact','sales']),
  ('fact_ap_invoice','AP Invoice Fact','fact','one row per supplier invoice',ARRAY['fact','procurement']),
  ('fact_purchase_order','Purchase Order Fact','fact','one row per PO line',ARRAY['fact','procurement']),
  ('fact_stock_balance','Stock Balance Fact','fact','one row per product-warehouse',ARRAY['fact','inventory']),
  ('fact_production_order','Production Order Fact','fact','one row per production order',ARRAY['fact','production']),
  ('fact_payslip','Payslip Fact','fact','one row per payslip',ARRAY['fact','hr']),
  ('fact_attendance','Attendance Fact','fact','one row per attendance record',ARRAY['fact','hr']),
  ('fact_ticket','Service Desk Ticket Fact','fact','one row per ticket',ARRAY['fact','servicedesk']),
  ('fact_lead','Lead Fact','fact','one row per lead',ARRAY['fact','crm']),
  ('fact_opportunity','Opportunity Fact','fact','one row per opportunity',ARRAY['fact','crm']),
  ('fact_fleet_trip','Fleet Trip Fact','fact','one row per trip',ARRAY['fact','fleet']),
  ('fact_project','Project Fact','fact','one row per project',ARRAY['fact','projects']),
  ('fact_audit_event','Audit Event Fact','fact','one row per audit event',ARRAY['fact','audit'])
) AS v(object_key, object_name, object_type, grain, description)
WHERE NOT EXISTS (
  SELECT 1 FROM public.bi_dwh_objects o
  WHERE o.company_id = c.id AND o.object_key = v.object_key
)
ON CONFLICT (company_id, object_key) DO NOTHING;

INSERT INTO public.bi_data_marts
  (company_id, mart_code, name, domain, description, fact_objects, dimension_objects, owner_name, is_active)
SELECT c.id, v.mart_code, v.name, v.domain, v.description, v.fact_objects, v.dimension_objects, v.owner_name, true
FROM public.companies c
CROSS JOIN (VALUES
  ('DM-FIN','Finance Mart','finance','GL, AR, AP, cash and tax analytics',ARRAY['fact_gl_journal','fact_invoice','fact_ap_invoice'],ARRAY['dim_account','dim_period','dim_cost_center'],'Finance Director'),
  ('DM-SALES','Sales Mart','sales','Revenue, orders and customer analytics',ARRAY['fact_invoice','fact_opportunity','fact_lead'],ARRAY['dim_customer','dim_product'],'Sales Manager'),
  ('DM-INV','Inventory Mart','inventory','Stock, valuation and movement analytics',ARRAY['fact_stock_balance'],ARRAY['dim_product','dim_warehouse'],'Inventory Controller'),
  ('DM-PROD','Production Mart','production','Output, OEE and quality analytics',ARRAY['fact_production_order'],ARRAY['dim_product'],'Plant Manager'),
  ('DM-HR','HR Mart','hr','Workforce, payroll and recruitment analytics',ARRAY['fact_payslip','fact_attendance'],ARRAY['dim_employee'],'HR Manager'),
  ('DM-PUR','Procurement Mart','procurement','Spend and supplier analytics',ARRAY['fact_purchase_order','fact_ap_invoice'],ARRAY['dim_supplier'],'Procurement Manager'),
  ('DM-SEC','Security Mart','security','Access and incident analytics',ARRAY['fact_audit_event'],ARRAY['dim_employee'],'Security Officer'),
  ('DM-SD','Service Desk Mart','servicedesk','Tickets, SLA and CSAT analytics',ARRAY['fact_ticket'],ARRAY['dim_employee'],'Service Desk Manager'),
  ('DM-FLEET','Fleet Mart','fleet','Trips, fuel and maintenance analytics',ARRAY['fact_fleet_trip'],ARRAY['dim_employee'],'Fleet Manager'),
  ('DM-PRJ','Project Mart','projects','Cost, profitability and timeline analytics',ARRAY['fact_project'],ARRAY['dim_employee'],'PMO Lead')
) AS v(mart_code, name, domain, description, fact_objects, dimension_objects, owner_name)
WHERE NOT EXISTS (
  SELECT 1 FROM public.bi_data_marts m
  WHERE m.company_id = c.id AND m.mart_code = v.mart_code
)
ON CONFLICT (company_id, mart_code) DO NOTHING;

INSERT INTO public.bi_chart_catalog
  (company_id, chart_key, name, category, description, is_enabled, sample_config)
SELECT c.id, v.chart_key, v.name, v.category, v.description, true, '{}'::jsonb
FROM public.companies c
CROSS JOIN (VALUES
  ('CHART-BAR','Bar Chart','comparison','Compare values across categories'),
  ('CHART-LINE','Line Chart','temporal','Trend over time'),
  ('CHART-PIE','Pie Chart','composition','Share of a whole'),
  ('CHART-AREA','Area Chart','temporal','Cumulative trend'),
  ('CHART-DONUT','Donut Chart','composition','Share with center label'),
  ('CHART-HEATMAP','Heatmap','distribution','Density across two dimensions'),
  ('CHART-GAUGE','Gauge','process','Progress toward a target'),
  ('CHART-MAP','Map','geo','Geographic distribution'),
  ('CHART-TABLE','Table','process','Tabular detail and drill-down'),
  ('CHART-KPI','KPI Card','process','Single metric with variance'),
  ('CHART-SCATTER','Scatter Plot','relationship','Correlation between metrics'),
  ('CHART-FUNNEL','Funnel Chart','process','Conversion through stages'),
  ('CHART-HISTOGRAM','Histogram','distribution','Value distribution'),
  ('CHART-BUBBLE','Bubble Chart','relationship','Three dimension comparison')
) AS v(chart_key, name, category, description)
WHERE NOT EXISTS (
  SELECT 1 FROM public.bi_chart_catalog ch
  WHERE ch.company_id = c.id AND ch.chart_key = v.chart_key
)
ON CONFLICT (company_id, chart_key) DO NOTHING;

-- ------------------------------------------------------------
-- 17. Default report schedules (per company)
-- ------------------------------------------------------------
INSERT INTO public.bi_report_schedules
  (company_id, schedule_code, name, frequency_label, cron_expression, format, recipients, delivery_channels, parameters, is_active)
SELECT c.id, v.schedule_code, v.name, v.frequency_label, v.cron_expression, v.format, v.recipients::jsonb, v.delivery_channels::text[], '{}'::jsonb, true
FROM public.companies c
CROSS JOIN (VALUES
  ('SCH-EXEC-D','Daily Executive Briefing','daily','0 6 * * *','pdf','["exec@company.com"]','{email}'),
  ('SCH-BOARD-W','Weekly Board KPI Pack','weekly','0 7 * * 1','pdf','["board@company.com","md@company.com"]','{email}'),
  ('SCH-FIN-M','Monthly Finance Pack','monthly','0 6 1 * *','excel','["finance@company.com"]','{email,excel}'),
  ('SCH-PAY-M','Monthly Payroll Summary','monthly','0 7 1 * *','pdf','["hr@company.com","payroll@company.com"]','{email}'),
  ('SCH-SEC-D','Daily Security Exceptions','daily','0 6 * * *','pdf','["security@company.com"]','{email}'),
  ('SCH-INV-W','Weekly Inventory Position','weekly','0 6 * * 1','csv','["warehouse@company.com"]','{email,csv}')
) AS v(schedule_code, name, frequency_label, cron_expression, format, recipients, delivery_channels)
WHERE NOT EXISTS (
  SELECT 1 FROM public.bi_report_schedules s
  WHERE s.company_id = c.id AND s.schedule_code = v.schedule_code
)
ON CONFLICT (company_id, schedule_code) DO NOTHING;

-- ------------------------------------------------------------
-- 18. Regulatory packages (per company)
-- ------------------------------------------------------------
INSERT INTO public.bi_regulatory_packages
  (company_id, package_code, name, authority, filing_frequency, due_day, checklist, is_active)
SELECT c.id, v.package_code, v.name, v.authority, v.filing_frequency, v.due_day, v.checklist::jsonb, true
FROM public.companies c
CROSS JOIN (VALUES
  ('REG-VAT','URA VAT Return','URA','monthly',15,'[{"item":"Sales VAT extract","done":false},{"item":"Purchase VAT extract","done":false},{"item":"Reconcile to GL","done":false}]'),
  ('REG-PAYE','PAYE Return','URA','monthly',15,'[{"item":"Payroll register","done":false},{"item":"PAYE computation","done":false}]'),
  ('REG-NSSF','NSSF Contribution','NSSF','monthly',15,'[{"item":"Employee list","done":false},{"item":"Contribution schedule","done":false}]'),
  ('REG-WHT','Withholding Tax','URA','monthly',15,'[{"item":"WHT on payments","done":false},{"item":"WHT certificates","done":false}]'),
  ('REG-CORPTAX','Corporate Tax','URA','quarterly',30,'[{"item":"P&L extract","done":false},{"item":"Tax adjustments","done":false}]'),
  ('REG-AUDIT','Internal Audit Pack','Internal Audit','quarterly',30,'[{"item":"Control matrix","done":false},{"item":"Exception logs","done":false}]'),
  ('REG-ISO','ISO 27001 Pack','ISO','yearly',90,'[{"item":"ISMS evidence","done":false},{"item":"Risk treatment","done":false}]'),
  ('REG-GDPR','GDPR Readiness','DPO','yearly',90,'[{"item":"Data inventory","done":false},{"item":"DPIA register","done":false}]'),
  ('REG-NDPC','Uganda Data Protection','NDPC','yearly',90,'[{"item":"Registration","done":false},{"item":"Breach register","done":false}]')
) AS v(package_code, name, authority, filing_frequency, due_day, checklist)
WHERE NOT EXISTS (
  SELECT 1 FROM public.bi_regulatory_packages rp
  WHERE rp.company_id = c.id AND rp.package_code = v.package_code
)
ON CONFLICT (company_id, package_code) DO NOTHING;

-- ------------------------------------------------------------
-- 19. Seed decision intelligence (per company, on first load)
-- ------------------------------------------------------------
INSERT INTO public.bi_ai_insights
  (company_id, insight_type, domain, title, summary, recommendation, confidence, severity, impact_score, horizon, status)
SELECT c.id, v.insight_type, v.domain, v.title, v.summary, v.recommendation, v.confidence, v.severity, v.impact_score, v.horizon, 'open'
FROM public.companies c
CROSS JOIN (VALUES
  ('forecast', 'finance', 'Revenue Outlook', 'Revenue projection based on historical trend and open pipeline.', 'Review the sales pipeline and adjust forecasts monthly.', 0.80, 'info', 0, '30d'),
  ('cashflow', 'finance', 'Cash Flow Watch', 'Projected liquidity position for the coming period.', 'Stagger large payables and accelerate collections on overdue receivables.', 0.75, 'low', 0, '30d'),
  ('attrition', 'hr', 'Attrition Risk Review', 'Attrition indicators across the workforce.', 'Review engagement and retention for high-risk departments.', 0.70, 'low', 0, '90d'),
  ('supplier_risk', 'procurement', 'Supplier Risk Review', 'Supplier performance and risk signals.', 'Review flagged suppliers and dual-source critical items.', 0.72, 'low', 0, '30d'),
  ('demand', 'inventory', 'Demand Outlook', 'Demand projection by product group.', 'Align reorder points with the projected demand.', 0.74, 'low', 0, '30d')
) AS v(insight_type, domain, title, summary, recommendation, confidence, severity, impact_score, horizon)
WHERE NOT EXISTS (SELECT 1 FROM public.bi_ai_insights i
  WHERE i.company_id = c.id AND i.title = v.title);
-- ------------------------------------------------------------
-- 20. Executive & operational dashboards (per company)
--     CEO / CFO / COO / CHRO / Executive / Sales / Ops
-- ------------------------------------------------------------
WITH dash AS (
  INSERT INTO public.bi_dashboards
    (company_id, tenant_id, dashboard_code, name, description, audience, layout, is_system, is_default, is_published, refresh_seconds, sort_order)
  SELECT c.id, c.tenant_id, v.dashboard_code, v.name, v.description, v.audience, v.layout::jsonb, true, v.is_default, true, v.refresh_seconds, v.sort_order
  FROM public.companies c
  CROSS JOIN (VALUES
    ('DASH-CEO','CEO Dashboard','Company-wide performance, revenue, profit, cash, growth and risks.','ceo','{"cols":12,"rowHeight":80}',true,300,10),
    ('DASH-CFO','CFO Dashboard','Revenue analysis, margins, budget, cash forecast, receivables and payables.','finance','{"cols":12,"rowHeight":80}',false,300,20),
    ('DASH-COO','COO Dashboard','Production, inventory, supply chain and operations efficiency.','operations','{"cols":12,"rowHeight":80}',false,300,30),
    ('DASH-CHRO','CHRO Dashboard','Workforce, recruitment, payroll, talent risks and employee analytics.','hr','{"cols":12,"rowHeight":80}',false,300,40),
    ('DASH-EXEC','Executive Overview','Cross-module executive intelligence and decision support.','executive','{"cols":12,"rowHeight":80}',false,300,50),
    ('DASH-SALES','Sales & CRM','Sales performance, pipeline, targets and customer analytics.','sales','{"cols":12,"rowHeight":80}',false,300,60),
    ('DASH-OPS','Operations Command Center','Service desk, procurement, warehouse and dispatch operations.','general','{"cols":12,"rowHeight":80}',false,300,70)
  ) AS v(dashboard_code, name, description, audience, layout, is_default, refresh_seconds, sort_order)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.bi_dashboards d
    WHERE d.company_id = c.id AND d.dashboard_code = v.dashboard_code
  )
  ON CONFLICT (company_id, dashboard_code) DO NOTHING
  RETURNING id, company_id, dashboard_code
)
INSERT INTO public.bi_dashboard_widgets
  (dashboard_id, company_id, tenant_id, widget_key, title, widget_type, data_source, config, position, sort_order, is_visible)
SELECT d.id, d.company_id, c.tenant_id, v.widget_key, v.title, v.widget_type, v.data_source, v.config::jsonb, v.position::jsonb, v.sort_order, true
FROM dash d
JOIN public.companies c ON c.id = d.company_id
JOIN (VALUES
  ('DASH-CEO','w-ceo-revenue','Revenue Trend','chart_line','invoices','{"metric":"total_amount","period":"monthly"}','{"x":0,"y":0,"w":6,"h":3}',1),
  ('DASH-CEO','w-ceo-profit','Profit Margin','kpi','gl_journals','{"metric":"amount"}','{"x":6,"y":0,"w":2,"h":2}',2),
  ('DASH-CEO','w-ceo-cash','Cash Position','gauge','bank_transactions','{"metric":"amount"}','{"x":8,"y":0,"w":2,"h":2}',3),
  ('DASH-CEO','w-ceo-sales','Sales Growth','chart_bar','sales_orders','{"metric":"total_amount"}','{"x":0,"y":3,"w":4,"h":3}',4),
  ('DASH-CEO','w-ceo-customers','Customer Growth','chart_line','customers','{}','{"x":4,"y":3,"w":4,"h":3}',5),
  ('DASH-CEO','w-ceo-headcount','Headcount','kpi','employees','{}','{"x":8,"y":2,"w":2,"h":2}',6),
  ('DASH-CEO','w-ceo-assets','Asset Value','kpi','fixed_assets','{"metric":"cost"}','{"x":10,"y":2,"w":2,"h":2}',7),
  ('DASH-CEO','w-ceo-production','Production Efficiency','gauge','mes_oee_snapshots','{"metric":"oee"}','{"x":8,"y":4,"w":2,"h":2}',8),
  ('DASH-CEO','w-ceo-risks','Risk Register','alert','ppm_risks','{}','{"x":10,"y":4,"w":2,"h":2}',9),
  ('DASH-CFO','w-cfo-revenue','Revenue Analysis','chart_area','invoices','{"metric":"total_amount"}','{"x":0,"y":0,"w":6,"h":3}',1),
  ('DASH-CFO','w-cfo-margin','Profit Margins','chart_line','fin_production_profitability','{"metric":"profit"}','{"x":6,"y":0,"w":6,"h":3}',2),
  ('DASH-CFO','w-cfo-budget','Budget vs Actual','chart_bar','budget_lines','{"metric":"amount"}','{"x":0,"y":3,"w":6,"h":3}',3),
  ('DASH-CFO','w-cfo-cashforecast','Cash Forecast','chart_line','bank_transactions','{"metric":"amount"}','{"x":6,"y":3,"w":6,"h":3}',4),
  ('DASH-CFO','w-cfo-receivables','Receivables','kpi','invoices','{"metric":"total_amount"}','{"x":0,"y":6,"w":2,"h":2}',5),
  ('DASH-CFO','w-cfo-payables','Payables','kpi','ap_invoices','{"metric":"total_amount"}','{"x":2,"y":6,"w":2,"h":2}',6),
  ('DASH-CFO','w-cfo-cost','Cost Analysis','chart_pie','fin_expense_claims','{"metric":"amount"}','{"x":4,"y":6,"w":4,"h":2}',7),
  ('DASH-CFO','w-cfo-vat','VAT Position','table','tax_codes','{}','{"x":8,"y":6,"w":4,"h":2}',8),
  ('DASH-COO','w-coo-production','Production Output','chart_bar','mes_production_orders','{"metric":"planned_quantity"}','{"x":0,"y":0,"w":4,"h":3}',1),
  ('DASH-COO','w-coo-inventory','Inventory Position','kpi','stock_balances','{"metric":"quantity"}','{"x":4,"y":0,"w":2,"h":2}',2),
  ('DASH-COO','w-coo-stockmovement','Stock Movement','chart_line','stock_transfers','{"metric":"quantity"}','{"x":6,"y":0,"w":6,"h":3}',3),
  ('DASH-COO','w-coo-supply','Supply Chain','table','purchase_orders','{"metric":"total_amount"}','{"x":0,"y":3,"w":6,"h":3}',4),
  ('DASH-COO','w-coo-oee','OEE','gauge','mes_oee_snapshots','{"metric":"oee"}','{"x":4,"y":2,"w":2,"h":2}',5),
  ('DASH-COO','w-coo-downtime','Downtime','chart_pie','mes_downtime','{"metric":"duration_minutes"}','{"x":6,"y":3,"w":6,"h":3}',6),
  ('DASH-COO','w-coo-quality','Quality Defects','alert','mes_ncr','{}','{"x":8,"y":2,"w":2,"h":2}',7),
  ('DASH-COO','w-coo-fleet','Fleet Utilisation','heatmap','fleet_trips','{"metric":"distance_km"}','{"x":10,"y":2,"w":2,"h":2}',8),
  ('DASH-CHRO','w-chro-headcount','Headcount Analysis','chart_bar','employees','{}','{"x":0,"y":0,"w":4,"h":3}',1),
  ('DASH-CHRO','w-chro-attrition','Turnover','chart_line','employee_exits','{}','{"x":4,"y":0,"w":4,"h":3}',2),
  ('DASH-CHRO','w-chro-payroll','Payroll Cost','kpi','pay_payslips','{"metric":"net_pay"}','{"x":8,"y":0,"w":2,"h":2}',3),
  ('DASH-CHRO','w-chro-recruitment','Candidate Funnel','chart_bar','ta_applications','{}','{"x":10,"y":0,"w":2,"h":2}',4),
  ('DASH-CHRO','w-chro-attendance','Attendance','chart_area','attendance_records','{}','{"x":0,"y":3,"w":6,"h":3}',5),
  ('DASH-CHRO','w-chro-leave','Leave Balance','table','leave_requests','{}','{"x":6,"y":3,"w":4,"h":3}',6),
  ('DASH-CHRO','w-chro-talentrisk','Talent Risk','alert','bi_ai_insights','{"metric":"impact_score"}','{"x":10,"y":2,"w":2,"h":2}',7),
  ('DASH-EXEC','w-exec-revenue','Revenue','kpi','invoices','{"metric":"total_amount"}','{"x":0,"y":0,"w":2,"h":2}',1),
  ('DASH-EXEC','w-exec-sales','Sales Pipeline','chart_bar','sales_opportunities','{"metric":"expected_value"}','{"x":2,"y":0,"w":4,"h":3}',2),
  ('DASH-EXEC','w-exec-spend','Spend by Category','chart_pie','purchase_orders','{"metric":"total_amount"}','{"x":6,"y":0,"w":4,"h":3}',3),
  ('DASH-EXEC','w-exec-stock','Stock Health','table','stock_balances','{"metric":"quantity"}','{"x":10,"y":0,"w":2,"h":3}',4),
  ('DASH-EXEC','w-exec-tickets','Open Tickets','kpi','support_tickets','{}','{"x":0,"y":2,"w":2,"h":2}',5),
  ('DASH-EXEC','w-exec-projects','Project Health','gauge','ppm_projects','{"metric":"budget"}','{"x":2,"y":3,"w":2,"h":2}',6),
  ('DASH-EXEC','w-exec-security','Security Alerts','alert','security_alerts','{}','{"x":4,"y":3,"w":2,"h":2}',7),
  ('DASH-EXEC','w-exec-audit','Audit Events','table','audit_log','{}','{"x":6,"y":3,"w":6,"h":2}',8),
  ('DASH-SALES','w-sales-revenue','Sales Revenue','chart_area','sales_orders','{"metric":"total_amount"}','{"x":0,"y":0,"w":6,"h":3}',1),
  ('DASH-SALES','w-sales-byproduct','Sales by Product','chart_bar','sales_orders','{"metric":"total_amount"}','{"x":6,"y":0,"w":6,"h":3}',2),
  ('DASH-SALES','w-sales-bysalesperson','Salesperson Performance','table','sales_orders','{"metric":"total_amount"}','{"x":0,"y":3,"w":6,"h":3}',3),
  ('DASH-SALES','w-sales-leads','Lead Conversion','kpi','sales_leads','{}','{"x":6,"y":3,"w":2,"h":2}',4),
  ('DASH-SALES','w-sales-pipeline','Pipeline','chart_bar','sales_opportunities','{"metric":"expected_value"}','{"x":8,"y":3,"w":2,"h":2}',5),
  ('DASH-SALES','w-sales-targets','Targets vs Actual','gauge','sales_orders','{"metric":"total_amount"}','{"x":10,"y":3,"w":2,"h":2}',6),
  ('DASH-OPS','w-ops-tickets','Ticket Volume','chart_line','support_tickets','{}','{"x":0,"y":0,"w":6,"h":3}',1),
  ('DASH-OPS','w-ops-sla','SLA Compliance','gauge','support_tickets','{}','{"x":6,"y":0,"w":2,"h":2}',2),
  ('DASH-OPS','w-ops-procure','Procurement Cycle','kpi','purchase_orders','{"metric":"total_amount"}','{"x":8,"y":0,"w":2,"h":2}',3),
  ('DASH-OPS','w-ops-approvals','Approval Delays','alert','purchase_requisitions','{"metric":"estimated_cost"}','{"x":10,"y":0,"w":2,"h":2}',4),
  ('DASH-OPS','w-ops-warehouse','Warehouse Productivity','heatmap','stock_balances','{"metric":"quantity"}','{"x":0,"y":3,"w":6,"h":3}',5),
  ('DASH-OPS','w-ops-deliveries','Dispatch Performance','chart_bar','fleet_deliveries','{"metric":"quantity"}','{"x":6,"y":3,"w":6,"h":3}',6)
) AS v(dashboard_code, widget_key, title, widget_type, data_source, config, position, sort_order)
  ON v.dashboard_code = d.dashboard_code
WHERE NOT EXISTS (
  SELECT 1 FROM public.bi_dashboard_widgets w
  WHERE w.dashboard_id = d.id AND w.widget_key = v.widget_key
);