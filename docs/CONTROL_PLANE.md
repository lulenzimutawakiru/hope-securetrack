# SecureTrack ERP — Enterprise Control Plane (CPanel)

**Product:** SecureTrack ERP
**Scope:** SaaS operating-system administration layer, fully separated from normal ERP operations.
**Audience:** SecureTrack platform staff (Platform Owner, CTO, Security Admin, DevOps Administrator, Compliance Officer).

The Control Plane is the administrative surface for the entire ERP ecosystem: platform configuration, tenant lifecycle, companies, users, security, infrastructure, modules, subscriptions, workflows, integrations, AI governance, data governance, monitoring, compliance, and system operations. It is deliberately **not** reachable from tenant ERP sessions — tenant admins, company admins, and normal users operate inside their own tenant only.

## 1. Architecture

Three administration layers, mirroring the product hierarchy:

```
SecureTrack Platform CPanel
   │
   ├── Platform Administration   (global: health, security, AI, integrations, ops)
   ├── Tenant Administration     (per SaaS customer: lifecycle, modules, subscriptions, users)
   └── Company Administration    (legal entities under a tenant)
```

| Layer | Capability ids | Purpose |
|-------|----------------|---------|
| Platform | `command-center`, `health`, `monitoring`, `security`, `compliance`, `governance`, `ai`, `integrations`, `api`, `storage`, `database`, `backup`, `deploy`, `notifications`, `support`, `workflows`, `jobs`, `events`, `ops`, `config`, `studio` | Run the platform itself |
| Tenant | `tenants`, `provisioning`, `subscriptions`, `modules`, `flags`, `users` | Manage every ERP customer |
| Company | `companies` | Manage legal entities under tenants |

Single source of truth for the capability registry: `src/lib/platform/control-plane-registry.ts` (`CONTROL_PLANE_CAPABILITIES`, `ACCESS_MATRIX`).

## 2. Staff roles & Access Matrix

Only SecureTrack staff profiles may hold a platform role. A staff profile is `user_profiles.is_platform_admin = true` **and** `tenant_id IS NULL`. The `platform_role` column is enforced in the database by `assert_platform_role_scope()` (see §4).

| Role | Code | Access |
|------|------|--------|
| Platform Owner | `owner` | Full control plane |
| CTO | `cto` | Infrastructure + Security + AI |
| Security Admin | `security` | Audit + Security + MFA/SSO |
| DevOps Administrator | `devops` | Deployment + Monitoring + Jobs |
| Compliance Officer | `compliance` | Audit + Reports + Governance |
| Tenant Owner | — (ERP role) | Own tenant only (ERP, never CPanel) |
| Company Admin | — (ERP role) | Own company only (ERP) |
| Normal User | — | No CPanel access |

### Enforcement model

- **Routing/layout:** `src/app/platform/layout.tsx` resolves the staff role from the authenticated session and redirects non-staff to `/dashboard`.
- **Shell:** `src/components/platform/platform-shell.tsx` renders only capabilities the role can access, plus a staff-role badge and a legacy-role banner.
- **API:** every `/api/platform/*` route calls `staffCanAccess(ctx, "<capability>")` before touching data. Capability guards: `command-center` (command center), `tenants` (tenant directory + detail CRUD), `provisioning` (tenant create), `users` (user administration), `companies` (company directory), `ops` (elevation + offboarding).
- **Database:** `current_platform_role()` RPC returns the role only for staff profiles; the `assert_platform_role_scope` trigger forbids non-staff from holding a role.
- **Fail closed:** unknown/invalid `platform_role` values are denied (no implicit access). Legacy staff (staff flag without a role) keep full `owner` access and are flagged `isLegacy` so the UI prompts for an explicit assignment. Elevated break-glass sessions (`isElevated`) keep full capability access for the duration of the elevation window.

Resolution logic lives in `src/lib/platform/staff.ts`; UI/API share it through `@/lib/platform` exports.

## 3. Assigning staff roles

Platform staff are provisioned by a SecureTrack owner (via SQL console or a future owner tool). Example:

```sql
UPDATE user_profiles
SET platform_role = 'security'          -- owner | cto | security | devops | compliance
WHERE id = '<auth-users-id>'
  AND is_platform_admin = true
  AND tenant_id IS NULL;
```

The trigger rejects any assignment where `is_platform_admin IS NOT TRUE` or `tenant_id IS NOT NULL`, so a tenant admin can never self-assign a CPanel role. To revoke, set `platform_role = NULL` (the profile keeps `is_platform_admin`, becoming legacy `owner` — assign a role or clear the staff flag to fully lock down).

## 4. Database migration

`supabase/migrations/20260816000001_platform_staff_roles.sql`:

- `user_profiles.platform_role TEXT` with `CHECK (platform_role IN ('owner','cto','security','devops','compliance'))` and a partial index.
- Trigger `assert_platform_role_scope()`: role requires staff profile (`is_platform_admin = true`, `tenant_id IS NULL`).
- RPC `current_platform_role()`: SECURITY DEFINER, returns the role only for the calling staff user (fails closed for tenant users).

## 5. Tenant management & provisioning

- **Tenant CRUD:** `/platform/tenants` (directory) and `/platform/tenants/[id]` (detail; lifecycle actions `activate | suspend | cancel | trial | update_plan | update_meta | set_module`, soft delete by default, hard delete only with `?hard=1&force=1`).
- **Provisioning engine:** `/platform/provisioning` — `cpanelCreateTenant` runs the automated workflow:

```
Create Tenant → Create Database Namespace → Create Default Roles
→ Create Admin Account → Enable Modules → Apply Branding
→ Send Welcome Email → Tenant Ready
```

- **Isolation controls (mandatory):** every request carries `tenant_id`, `company_id`, and `branch_id` where applicable, resolved from the authenticated session — never from the URL or request body. Isolation is enforced by database RLS, API middleware, storage/search/AI/reporting scoping. A tenant at `hope-design.securetrack.com` cannot reach `company-b.securetrack.com`.

## 6. Subscriptions & modules

- **Plans** (`SUBSCRIPTION_PLANS`): `starter`, `professional`, `enterprise`, `government` with entitlements for users, companies, storage, daily API calls, monthly AI tokens, reports, automations, and module tiers. Plan logic in `getPlanEntitlements`.
- **Modules** (`ERP_MODULE_CATALOG`): finance, hr, payroll, crm, procurement, inventory, manufacturing, assets, fleet, service_desk, projects, recruitment, ai_assistant, sales, dispatch, attendance — enabled/disabled per tenant with permissions, limits, and workflows.
- **User administration:** `/platform/users` — estate-wide identity: deactivate/activate, require MFA, force logout, and directory search across tenants.

## 7. Command center telemetry

`src/lib/platform/control-plane.ts` — `getCommandCenterSnapshot()` powers `/platform` and `GET /api/platform/command-center`:

- **Health:** database status/latency, Redis, AI, worker, MFA, dual-control, payment sandbox, Resend configuration.
- **Estate:** tenants (total/active/trial/suspended), companies, users, active subscriptions, open provision jobs, events (24h).
- **Jobs:** pending / running / failed / dead.
- **Security:** failed logins (24h), open alerts, MFA-enabled users, privileged users, platform admins.
- **Business:** trial tenants, expiring trials (7d), plan breakdown, module enablement rows.
- **API gateway (24h):** requests, errors (≥400), average latency, error rate.
- **Storage / activity / backup:** object count and usage, active users (7d), audit events (24h), backup status, last backup, retention days.

Every telemetry query is best-effort with a typed fallback — a single failing metric never breaks the command center.

## 8. Security rules (non-negotiable)

| Never allow | Enforcement |
|-------------|-------------|
| Tenant admin access to CPanel | Staff-only layout + API guards + DB role scope trigger |
| Normal ERP user access | `staffCanAccess` fails closed for non-staff sessions |
| Cross-tenant visibility | Session-derived tenant context; RLS; scoped admin client |
| Direct database modification | Database admin surfaces are read-only (migrations, health, indexes) — no raw SQL, no production write access |
| Unlogged actions | Audit logging on every login, API call, record change, export, approval, permission change |

Standard API contract: authentication → authorization → tenant validation → permission check → input validation → audit logging → rate limiting (where required). See `docs/MULTI_TENANT.md` and `docs/RLS_INVENTORY_REPORT.json` for the platform-wide isolation model.

## 9. Related surfaces

| Surface | Location |
|---------|----------|
| Platform pages | `src/app/platform/*` |
| Platform APIs | `src/app/api/platform/*` |
| Staff role engine | `src/lib/platform/staff.ts` |
| Capability registry | `src/lib/platform/control-plane-registry.ts` |
| Command center | `src/lib/platform/control-plane.ts` |
| Tenant CRUD/provisioning | `src/lib/platform/cpanel.ts`, `src/lib/platform/provision.ts` |
| Staff migration | `supabase/migrations/20260816000001_platform_staff_roles.sql` |
| Tests | `tests/security/platform-staff.test.ts`, `tests/security/control-plane-registry.test.ts`, `tests/security/platform-cpanel.test.ts` |