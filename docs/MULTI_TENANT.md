# SecureTrack ERP — Multi-tenant architecture

## Product name

**SecureTrack ERP** — multi-tenant enterprise resource planning platform.

Demo seed tenant remains *Hope Design Group Ltd* (a customer org, not the product brand).

## Hierarchy

```
Platform (SecureTrack ERP)
 └── Tenant (customer organization / SaaS account)
      └── Company (legal / operating entity)
           └── Branches · Factories · Departments · Cost centres
                └── Operational data (sales, payroll, inventory, …)
```

## Isolation model

| Layer | Mechanism |
|-------|-----------|
| Tenant | `tenants` table; `companies.tenant_id` |
| Company | `company_id` on operational tables |
| Session context | `user_profiles.active_company_id` → `user_company_id()` RLS helper |
| Membership | `user_company_memberships` (users may access many companies) |
| Platform admin | `user_profiles.is_platform_admin` / super_administrator |

## Key RPCs

- `user_company_id()` — active (or home) company for RLS  
- `user_tenant_id()` — current tenant  
- `user_has_company_access(uuid)` — membership check  
- `switch_active_company(uuid)` — switch workspace context  
- `is_platform_admin()` — platform-wide admin  

## UI

| Surface | Path |
|---------|------|
| Company switcher | Header (all dashboard pages) |
| Tenant admin | `/dashboard/tenants` |
| Company master | `/dashboard/enterprise/companies` |

## Permissions

`tenant.view` · `tenant.manage` · `tenant.admin` · `tenant.switch`

## Migration

`20260101000064_multi_tenant_platform.sql`

## Onboarding a new customer

1. Create **tenant** (slug, name, plan).  
2. Create primary **company** under tenant.  
3. Invite users → `user_company_memberships`.  
4. Users switch company via header when multi-company.  

All module queries continue to use `auth.profile.company_id` (normalized to active company).
