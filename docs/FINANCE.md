# SecureTrack ERP — Enterprise Finance & Accounting

CFO-grade financial management platform integrated into SecureTrack ERP.

## Overview

Multi-company GL · AP/AR · Treasury · Manufacturing costing · Tax · Budgeting · AI intelligence · SoD approvals.

Designed for SecureTrack ERP manufacturing and secure printing profitability, exceeding SAP/Oracle/Dynamics class capabilities in a modern AI-native stack.

## Routes

| Path | Purpose |
|------|---------|
| `/dashboard/finance` | Enterprise finance hub |
| `/dashboard/finance/cfo` | CFO KPIs · ratios · product-line cost |
| `/dashboard/finance/coa` | Chart of accounts |
| `/dashboard/finance/journals` | General ledger journals |
| `/dashboard/finance/ar` | Accounts receivable |
| `/dashboard/finance/ap` | Accounts payable |
| `/dashboard/finance/bank` | Bank accounts & recon |
| `/dashboard/finance/cash` | Cash position · MoMo · petty · forecast |
| `/dashboard/finance/treasury` | Loans & facilities |
| `/dashboard/finance/budgets` | Budgeting & FP&A |
| `/dashboard/finance/cost-centres` | Cost / profit centres |
| `/dashboard/finance/costing` | Paper & manufacturing cost rolls + WIP |
| `/dashboard/finance/assets` | Fixed assets & depreciation |
| `/dashboard/finance/tax` | Tax codes & returns |
| `/dashboard/finance/approvals` | Multi-level SoD approvals |
| `/dashboard/finance/periods` | Fiscal open/close/lock |
| `/dashboard/finance/ai` | AI finance assistant |
| `/dashboard/finance/reports` | TB · P&L · BS · aging |
| `/dashboard/finance/mobile` | Field / mobile finance |
| `/dashboard/billing` | Customer billing platform |

## Database

- **Base:** `20260101000010_enterprise_finance_accounting.sql` (+ soft-delete seed `00016`)
- **Billing:** `00025`, `00026`
- **Advanced:** `20260101000047_enterprise_finance_advanced.sql`

Key advanced tables: `fin_cash_positions`, `fin_cash_forecasts`, `fin_petty_cash`, `fin_mobile_money_txns`, `fin_cost_rolls`, `fin_wip`, `fin_kpi_snapshots`, `fin_approvals`, `fin_tax_returns`, `fin_intercompany_txns`, `fin_elimination_entries`, `fin_business_units`, `fin_audit_log`

## Library

```
src/lib/finance/
  types.ts
  ai.ts       — cash shortfall, duplicates, anomalies, paper costs, collections, summaries
  service.ts  — dashboard, journals, costing, cash, approvals, KPIs
  index.ts
```

## Permissions

| Slug | Description |
|------|-------------|
| `finance.view` | View finance |
| `finance.manage` | Manage transactions |
| `finance.post` | Post journals |
| `finance.approve` | Approve workflows |
| `finance.bank` | Banking |
| `finance.tax` | Tax |
| `finance.close` | Period close |
| `finance.ai` | AI intelligence |
| `finance.cfo` | CFO dashboards |
| `finance.costing` | Manufacturing costing |
| `finance.treasury` | Treasury |
| `finance.consolidate` | Consolidation |
| `finance.admin` | Administration |

## Manufacturing / paper costing

Automatic calculation of:

- Cost per sheet · ream · box (5 reams) · pallet · ton · batch · customer order  
- Direct materials, labor, OH, machine, utility, packaging, transport, scrap  
- Standard vs actual variance · WIP · FG values  
- Product lines: security print · bond · packaging · gov · export · education  

## Apply migrations

```bash
supabase db push
# 00010 + 00016 + 00047 (and billing if needed)
```

## SecureTrack ERP

- Security printing job profitability  
- Government / education contract cost rollups  
- MoMo + bank treasury for Uganda operations  
- Dual approval for large supplier payments  
- Real-time CFO pack (EBITDA, margins, ROA/ROE, CCC)  
