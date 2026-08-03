# Enterprise Payroll & Compensation

SecureTrack ERP flagship module for the complete employee compensation lifecycle: processing, statutory compliance (Uganda-first), benefits, loans, incentives, manufacturing labour costing, bank/mobile money, payroll accounting, analytics, and AI assistance.

## Entry points

| Surface | Path |
|---------|------|
| Executive dashboard | `/dashboard/payroll` |
| Payroll workspace | `/dashboard/payroll/workspace` |
| Payroll runs | `/dashboard/payroll/runs` |
| Simulations | `/dashboard/payroll/simulations` |
| Formula engine | `/dashboard/payroll/formulas` |
| AI assistant | `/dashboard/payroll/ai` |
| ESS | `/dashboard/payroll/self-service` |

## Module map

- **Overview** — Dashboard, workspace, AI  
- **Calendar & periods** — Multi-calendar, open/close/lock periods  
- **Processing** — Runs, simulations, corrections/retro, final settlements, approvals  
- **Compensation** — Profiles, structures, grades, bands, scales, groups, components  
- **Rules** — Formulas, tax/PAYE/NSSF, pension, gratuity, shift premiums  
- **Earnings & deductions** — OT, bonuses, commissions, incentives, loans, advances, benefits  
- **Costing & accounting** — Cost allocations, GL mappings  
- **Payments** — Bank files, payment batches, mobile money, payslips  
- **Compliance & system** — Documents, settings, audit  

## Lifecycle

Contract → Profile → Structure → Benefits/tax → Attendance/leave sync → OT/incentives/commissions → Loan recovery → Tax → Simulation → Validation → Approval → Bank/MM file → Payment → Finance posting → Payslips → Archive & audit

## Permissions

`payroll.view` · `payroll.manage` · `payroll.process` · `payroll.approve` · `payroll.pay` · `payroll.self` · `payroll.ai` · `payroll.tax` · `payroll.admin` · `payroll.costing` · `payroll.bank`

## Schema

- **00034** — Core `pay_*` tables (profiles, components, structures, runs, OT, loans, benefits, payslips, tax, GL, audit)  
- **00063** — Enterprise extension: calendars, periods, grades/bands/scales, commissions, incentives, shift premiums, formulas, simulations, corrections, final settlements, cost allocations, mobile money, bank files, pension, gratuity, settings, documents  

## Lib

`src/lib/payroll/` — types, tax, engine, service (process run + dashboard stats), crud, menu, entities, ai  

## UI

- Hub + workspace control centre  
- Specialized pages: runs, profiles, structures, components, tax, OT, bonuses, loans, benefits, approvals, payments, payslips, ESS, analytics, AI  
- Entity pages via `PayEntityPage` + `PAY_ENTITIES` for master data  

## Integrations

HR · Talent Acquisition · Attendance · Leave · Finance (GL) · Manufacturing (labour costing) · Projects · Sales (commissions) · Banking / Mobile Money  

## Uganda statutory (baseline)

- PAYE progressive brackets (configurable tax tables)  
- NSSF employee/employer contributions  
- Local Service Tax (LST) hooks via components  
- Multi-currency (UGX default) and multi-company RLS  
