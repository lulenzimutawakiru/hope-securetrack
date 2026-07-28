# Workforce Management (WFM) — Hope Design Group Ltd

**Industry:** Security Printing · Manufacturing · Engineering  
**Deployment:** Cloud · On-Premise · Hybrid · Offline-capable foundation  

## Module map

| Area | Route |
|------|--------|
| WFM Command Center | `/dashboard/workforce` |
| Shifts & scheduling | `/dashboard/workforce/shifts` |
| Attendance | `/dashboard/workforce/attendance` |
| Overtime | `/dashboard/workforce/overtime` |
| Skills & training | `/dashboard/workforce/skills` |
| Safety & PPE | `/dashboard/workforce/safety` |
| Field workforce | `/dashboard/workforce/field` |
| Labor costs | `/dashboard/workforce/costs` |
| HR master / leave | `/dashboard/hr` |

## Architecture

```
HR Master Data → Planning Engine → Shift Scheduling
        → Attendance → Productivity / OT → Payroll hooks
        → Labor Costing → Executive Analytics / AI Insights
```

## Data model (Postgres + RLS)

- `employees` (extended master)
- `shift_templates`, `shift_assignments`
- `attendance_records` (web / GPS / device methods)
- `overtime_requests`
- `skill_catalog`, `employee_skills`, `training_records`
- `safety_inductions`, `ppe_issuances`, `safety_incidents`
- `field_jobs`
- `labor_cost_entries`
- `workforce_insights` (AI recommendations store)

## Integrations (current product surface)

| System | Integration |
|--------|-------------|
| HCM / HR | Shared `employees`, leave |
| Manufacturing | Productivity via attendance + production batches |
| Finance | Labor cost entries (UGX), OT cost estimates |
| SecureTrack Auth | RBAC + RLS company tenancy |
| Mobile | GPS clock-in, field on-site check-in |

## Future connectors

- Biometric / RFID / NFC terminals → post to `attendance_records`
- Payroll export CSV / API
- Full offline sync client (service worker + queue)
- GraphQL gateway (optional)

## Compliance notes

Designed for multi-site operations with Uganda OHS/labour practices in mind: leave types, OT approval, safety incidents, PPE tracking, audit-friendly status history.
