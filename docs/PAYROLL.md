# Enterprise Payroll Management Platform

SecureTrack ERP — full payroll lifecycle: master data, attendance/OT hooks, leave impact, earnings, statutory tax, benefits, loans, multi-level approval, bank files, digital payslips, GL mappings, ESS, and AI.

## Scope

| Domain | Capability |
|--------|------------|
| Profiles | Bank, TIN, NSSF, grade, pay group, country, cost center |
| Structures | Grade packages with component lines |
| Components | Earnings, deductions, tax, employer |
| Tax | UG/KE PAYE brackets, NSSF/NHIF, live calculator |
| Engine | Gross → statutory → loans/advances → net |
| OT / Bonus | Claims with multipliers; production/sales incentives |
| Loans | Principal, interest, installments, auto-deduct |
| Benefits | Medical, life, pension plans & enrollments |
| Runs | Process, lock/unlock, publish payslips, bank CSV |
| Approvals | Officer → HR → Finance → Director → Payment |
| ESS | Payslips, history, advance requests |
| AI | Anomalies, duplicate risk, FAQ, cost forecast |

## Migration

```text
supabase/migrations/20260101000034_enterprise_payroll.sql
```

Extends existing `payroll_runs` / `payroll_lines` and adds `pay_*` tables. Seeds Uganda & Kenya tax rules, HDG components, structures, benefit plans, GL mappings, and syncs profiles from active employees.

Also applies migration `00015` (base HR payroll) if not already applied.

## Routes

| Path | Purpose |
|------|---------|
| `/dashboard/payroll` | Hub |
| `/dashboard/payroll/runs` | Process engine |
| `/dashboard/payroll/profiles` | Employee pay profiles |
| `/dashboard/payroll/structures` | Salary structures |
| `/dashboard/payroll/components` | Pay components |
| `/dashboard/payroll/tax` | Tax & statutory |
| `/dashboard/payroll/overtime` | OT claims |
| `/dashboard/payroll/bonuses` | Incentives |
| `/dashboard/payroll/loans` | Loans & advances |
| `/dashboard/payroll/benefits` | Benefit plans |
| `/dashboard/payroll/approvals` | Multi-stage approve |
| `/dashboard/payroll/payments` | Bank batches |
| `/dashboard/payroll/payslips` | Digital payslips |
| `/dashboard/payroll/self-service` | Employee ESS |
| `/dashboard/payroll/analytics` | Cost analytics |
| `/dashboard/payroll/ai` | AI assistant |

Legacy simple run UI remains at `/dashboard/hr/payroll` (links to enterprise hub from HR).

## Permissions

- `payroll.view` / `payroll.manage` / `payroll.process`
- `payroll.approve` / `payroll.pay` / `payroll.tax`
- `payroll.self` / `payroll.ai`

## Library

`src/lib/payroll/`

- `tax.ts` — PAYE progressive, NSSF, NHIF
- `engine.ts` — net calc, OT, bank CSV, payslip HTML
- `service.ts` — process run, approvals, loans, payslips, lock
- `ai.ts` — insights, FAQ, duplicate detection

## Processing flow

1. Sync employee profiles from HR  
2. Approve OT, bonuses, advances  
3. **Run payroll** → lines calculated with UG/KE rules  
4. Multi-stage **approvals**  
5. **Publish payslips** + **bank CSV**  
6. Confirm payment / lock run  

## Uganda defaults (illustrative)

- PAYE progressive monthly bands  
- NSSF employee 5% / employer 10% of gross  

Configure rates in Tax module / DB as laws change.

## ERP integration

- **HR** employees, leave, performance  
- **Finance** GL mapping keys for journals  
- **Workforce** OT / attendance alignment  
- **Production** production bonuses  
- **Profiles** ESS linkage via `employees.user_id`  

## Operations

1. Apply migration `00034` in Supabase.  
2. Open **Payroll → Profiles → Sync from HR**.  
3. Configure bank accounts on profiles.  
4. Run payroll for the current month.  
5. Complete approvals, publish payslips, download bank file.  
