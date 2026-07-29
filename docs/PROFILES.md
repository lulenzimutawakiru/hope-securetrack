# Enterprise Digital Employee Profile Platform

Hope SecureTrack — single source of truth for every person at Hope Design Group Ltd.

## Scope

360° employee view integrating:

| Domain | Integration |
|--------|-------------|
| HR | `employees`, leave, performance, training, exit |
| IAM | `user_profiles`, roles, MFA, sessions |
| Company ID | `wid_identities`, `wid_credentials` |
| Payroll | salary grade, bank, `payroll_lines` (RBAC) |
| Attendance | `attendance_records`, leave balances |
| Projects | `profile_projects` (+ billing projects) |
| Help desk | `support_tickets` |
| Assets | `employee_assets` |
| Security | clearance, risk score, `profile_security_events` |
| Skills / certs | `profile_skills`, `profile_certifications` |
| Documents | `profile_documents` with expiry & approval |

## Migration

Apply:

```text
supabase/migrations/20260101000029_enterprise_digital_profiles.sql
```

## Routes

| Path | Purpose |
|------|---------|
| `/dashboard/profiles` | Directory hub + create + export |
| `/dashboard/profiles/[id]` | Full 360° tabs |
| `/dashboard/profiles/me` | Employee self-service |
| `/dashboard/profiles/team` | Manager team view |
| `/dashboard/profiles/documents` | Org-wide documents & approval |
| `/dashboard/profiles/requests` | ESS request workflow |
| `/dashboard/profiles/analytics` | Completion & skills analytics |
| `/dashboard/profiles/ai` | AI gaps, retention, career |

## Permissions

- `profile.view` / `profile.manage`
- `profile.self` — ESS (granted broadly)
- `profile.manager` — team view
- `profile.payroll` — sensitive compensation
- `profile.documents` / `profile.security` / `profile.analytics` / `profile.ai`

Section visibility uses `resolveSectionAccess()` (RBAC + self + finance).

## Profile completion

Weighted score over photo, IDs, contacts, emergency, employment, skills, certs, documents.  
Stored on `employees.profile_completion_pct` and `profile_completion`.

## CRUD+

Create / read / update / soft-delete / restore / export CSV / bulk department update / timeline version history / audit (`profile_audit`) / request approvals.

## Library

`src/lib/profile/`

- `completion.ts` — completion engine  
- `access.ts` — field/section permissions  
- `service.ts` — CRUD, 360 loader, requests  
- `ai.ts` — insights, document type extraction  

## Operations notes

1. Link `employees.user_id` to `user_profiles.id` for self-service.  
2. Link `wid_identities.employee_id` for digital ID tab.  
3. Finance/HR only for payroll tab.  
4. Recalculate completion from profile UI after bulk imports.
