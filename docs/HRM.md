# Enterprise Human Resource / Human Capital Management — SecureTrack ERP

**Employee lifecycle · payroll · compliance · ESS**  
Integrates with Workforce Management, Finance, and Identity.

## Architecture

```
Workforce Planning → Recruitment → Hire → Onboarding
  → Employment → Performance → Training → Promotion → Exit
```

## Routes

| Area | Path |
|------|------|
| HR hub | `/dashboard/hr` |
| Employee directory | `/dashboard/hr/employees` |
| Recruitment / ATS | `/dashboard/hr/recruitment` |
| Leave | `/dashboard/hr/leave` |
| Payroll & payslips | `/dashboard/hr/payroll` |
| Performance | `/dashboard/hr/performance` |
| Training | `/dashboard/hr/training` |
| Exit management | `/dashboard/hr/exit` |
| Self-service (ESS) | `/dashboard/hr/self-service` |
| Reports | `/dashboard/hr/reports` |
| Workforce ops | `/dashboard/workforce` |

## Core tables

- Extended `employees` (TIN, NSSF, bank, leave balances)
- `job_requisitions`, `job_applicants`
- `leave_balances`, `public_holidays`
- `payroll_runs`, `payroll_lines` (PAYE / NSSF calc)
- `performance_reviews`, `employee_objectives`
- `training_courses`, `training_enrollments`
- `hr_cases`, `employee_assets`, `employee_exits`
- `hr_insights`

## Uganda compliance notes

- PAYE progressive bands (simplified) on payroll run
- NSSF employee 5% / employer 10%
- Public holidays seed for 2026
- Aligns with Employment Act / NSSF / URA payroll practices (configure rates as laws change)

## Permissions

`hr.view`, `hr.manage`, `hr.payroll`, `hr.recruit`, `hr.performance`, `hr.training`, `hr.self`
