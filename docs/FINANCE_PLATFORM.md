# Enterprise Finance & Accounting Platform

Complete multi-company finance platform for Hope SecureTrack ERP.

## Scope

- **General Ledger** — COA, journals, templates, recurring, posting batches, trial balance
- **Structure** — account groups, dimensions, cost/profit centers, business units
- **Periods** — fiscal years, accounting periods, locks, closing
- **AR** — invoices, receipts, credit/debit notes, collections, payment plans, statements, aging
- **AP** — supplier invoices, payments, credit/debit notes, payment runs, recon
- **Treasury** — banks, statements, recon, SWIFT/RTGS/EFT, MoMo, petty cash, liquidity, investments, loans, LCs, guarantees
- **FP&A** — budgets, templates, revisions, variance, multi-type forecasts
- **Manufacturing costing** — standard, actual, batch, job, ABC, process, WIP, variance
- **Tax** — codes, returns, WHT, jurisdictions
- **Consolidation** — intercompany, eliminations
- **AI · Reports · Approvals · Audit · Settings**

## Routes

Base: `/dashboard/finance`  
Menu: `src/lib/finance/menu.ts`

## Permissions

Existing `finance.*` plus `finance.fpa`, `finance.tax.manage`, `finance.multibook`.

## Database

- Core: `00010_enterprise_finance_accounting.sql`
- Advanced: `00047_enterprise_finance_advanced.sql`
- Complete platform: `00056_enterprise_finance_complete.sql`
- Lifecycle: `00057_enterprise_finance_lifecycle.sql` (inventory valuation, assets lifecycle, leases, payroll GL, revenue, project accounting, expenses, close, posting engine, compliance)

## Accounting engine

`src/lib/finance/engine.ts` — event-driven postings:

Sales invoice, customer payment, purchase invoice, GRN, production complete, material issue, payroll, asset purchase/depreciation, dispatch COGS, expense claim.

UI: `/dashboard/finance/engine`

## Lib

- `src/lib/finance/crud.ts` — generic CRUD
- `src/lib/finance/entities.ts` — field configs
- `src/lib/finance/menu.ts` — full sidebar
- `src/components/finance/fin-entity-page.tsx` — CRUD UI
- Specialized pages: COA, journals, AR, AP, bank, cash, CFO, costing, tax, AI, reports
