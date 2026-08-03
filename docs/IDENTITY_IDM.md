# Enterprise Identity Management (IDM)

SecureTrack ERP — User account provisioning, RBAC, ABAC, MFA governance, lifecycle.

## Migration

```text
supabase/migrations/20260101000031_enterprise_identity_provisioning.sql
```

Requires `SUPABASE_SERVICE_ROLE_KEY` for activate / password reset API routes.

## Modules

| Path | Feature |
|------|---------|
| `/dashboard/identity` | IDM hub |
| `/dashboard/identity/create` | Create account form |
| `/dashboard/identity/provision` | Approval queue · activate |
| `/dashboard/identity/import` | Bulk CSV import |
| `/dashboard/identity/users` | Directory |
| `/dashboard/identity/users/[id]` | User identity profile |
| `/dashboard/identity/roles` | RBAC + custom role builder |
| `/dashboard/identity/permissions` | Permission matrix |
| `/dashboard/identity/abac` | ABAC rules + simulator |
| `/dashboard/identity/policies` | Password / MFA policy |
| `/dashboard/identity/security` | Alerts · login history |
| `/dashboard/identity/sessions` | Session control |
| `/dashboard/identity/audit` | IDM audit trail |

## Provisioning workflow

```
Create request → Manager → Security → Admin → Activate (auth user + profile + roles)
```

Immediate activate available for authorized admins (`activate_now`).

## APIs

- `POST /api/identity/provision` — create auth user + profile from approved request  
- `POST /api/identity/reset-password` — force temp password  

## Library

`src/lib/idm/` — username rules, password policy, ABAC, provision service, bulk CSV.

## Username patterns

- `firstname.lastname` → john.doe  
- `employee.number` → HDG000254  
- `department.employee` → production254  
- `email.prefix`  

## HR onboarding

Link employee on create form, or call `onboardEmployeeToUser()` to open a provision request from HR master data.

## Permissions

`iam.provision` · `iam.import` · `iam.roles` · `iam.abac` · `iam.password` · `iam.mfa` · `iam.governance` (+ existing iam.*)

## Governance extension (00032)

```text
supabase/migrations/20260101000032_enterprise_idm_governance.sql
```

| Path | Feature |
|------|---------|
| `/dashboard/identity/sessions` | Logout user · terminate all · IP/location |
| `/dashboard/identity/devices` | Register · block · security status |
| `/dashboard/identity/sso` | Entra · Google · AD · LDAP · OAuth · SAML |
| `/dashboard/identity/api-accounts` | System accounts · API keys |
| `/dashboard/identity/temporary` | Contractors · auditors · auto-expiry |
| `/dashboard/identity/monitor` | Security KPI dashboard |
| `/dashboard/identity/self-service` | Password · MFA · access requests |
| `/dashboard/identity/ai` | Risk · roles · inactive · MFA gaps |

User profile (`/users/[id]`): MFA status · sessions · devices · activity stream · offboarding.

Library: `src/lib/idm/governance.ts` · `src/lib/idm/ai.ts`
