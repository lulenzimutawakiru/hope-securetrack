# Settings & System Administration Module

**Company:** SecureTrack ERP  
**Version:** 4.0 — Enterprise Configuration Center  
**Stack:** Next.js · Supabase PostgreSQL · RLS · soft-delete

## Overview

Central no-code configuration hub. All administrative changes are logged to `config_change_log`.

## Routes

| Path | Purpose |
|------|---------|
| `/dashboard/settings` | Hub dashboard & KPIs |
| `/dashboard/settings/company` | Legal entity, TIN, fiscal year |
| `/dashboard/settings/branches` | Sites (office/factory/warehouse/DC) |
| `/dashboard/settings/numbering` | Document sequences |
| `/dashboard/settings/modules` | ERP module enable/license |
| `/dashboard/settings/workflows` | Approval workflow definitions |
| `/dashboard/settings/notifications` | Notification templates |
| `/dashboard/settings/integrations` | Third-party connectors |
| `/dashboard/settings/security` | Password/MFA/session policy |
| `/dashboard/settings/branding` | Theme colours & app name |
| `/dashboard/settings/localization` | Locale defaults |
| `/dashboard/settings/ai` | AI feature flags |
| `/dashboard/settings/backup` | Backup policy metadata |
| `/dashboard/settings/audit` | Config change log |
| `/dashboard/settings/profile` | User profile |
| `/dashboard/identity/*` | Users, roles, permissions, sessions |

## Database (migration `20260101000017`)

- `document_sequences` + `next_document_number()` RPC
- `erp_modules`
- `approval_workflows`
- `notification_templates`
- `integration_configs`
- `config_change_log`
- Extended `companies` / `branches` columns
- Seeded `system_settings` (brand, locale, security, AI, backup)
- Permissions: `settings.view`, `settings.manage`, `settings.branding`, `settings.integrations`, `settings.sequences`, `settings.workflows`

## Permissions

- Nav uses `settings.manage`
- Super administrators receive full settings permission set via role seed

## Related modules

- **Identity** — users, roles, RBAC, security alerts
- **Finance** — tax codes, fiscal periods, currencies (operational)
- **Audit** — system-wide activity logs
