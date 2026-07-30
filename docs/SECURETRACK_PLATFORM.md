# SecureTrack ERP — Platform Architecture

**Product:** SecureTrack ERP  
**Tagline:** Secure · Intelligent · Connected  
**Vision:** Enterprise Operating System — multi-tenant, AI-powered, event-driven, API-first, cloud-native.

## Hierarchy

```
Platform Administration
  └── Tenant (customer / SaaS org)
       └── Companies
            └── Branches · Departments · Warehouses · Projects
                 └── Users · Roles · Permissions
                      └── Operational modules (Finance, Payroll, MES, …)
```

Request context resolves: **Tenant → Company → Branch → Department → User → Role → Permissions → Subscription → Language → Currency → Timezone → Feature Access**.

## Platform Administration

| Surface | Path |
|---------|------|
| Control plane | `/dashboard/platform` |
| Provisioning | `/dashboard/platform/provisioning` |
| Domain events | `/dashboard/platform/events` |
| Feature flags | `/dashboard/platform/flags` |
| Module catalog | `/dashboard/platform/modules` |
| Health | `/dashboard/platform/health` |
| Subscriptions | `/dashboard/platform/subscriptions` |
| Tenants | `/dashboard/tenants` |
| Public register | `/register` |
| Provision API | `POST /api/public/platform/provision` |

## Auto tenant provisioning

On registration / admin provision:

1. Create **tenant**  
2. Create primary **company**  
3. Create **HQ branch**  
4. Activate **subscription** (plan)  
5. Enable **modules** from catalog  
6. Apply **feature flags**  
7. Generate **setup wizard** steps  
8. Emit `tenant.provisioned` **domain event**  
9. Create **administrator** (service role + Auth admin)  
10. Create **membership** on company  

## Event-driven core

- Table: `domain_events`  
- RPC: `emit_domain_event(...)`  
- Client helper: `emitEvent()` in `src/lib/platform/events.ts`  
- Standard types: payroll.processed, invoice.paid, employee.hired, attendance.recorded, …  

Every module should call `emitEvent` after significant CRUD / workflow transitions.

## Schema migrations

| Migration | Purpose |
|-----------|---------|
| `00064` | Multi-tenant: tenants, memberships, active company, switch RPC |
| `00065` | Platform core: plans, flags, events, provisioning, modules, health |

## Lib

`src/lib/platform/` — types, events, provision, service  
`src/lib/tenant/` — memberships, company switcher  

## Permissions

`platform.view` · `platform.admin` · `platform.provision` · `platform.events` · `platform.flags`  
`tenant.view` · `tenant.manage` · `tenant.admin` · `tenant.switch`

## Deployments supported (architecture-ready)

SaaS · Single-tenant · Private cloud · Public cloud · Hybrid · On-premise · Government · Air-gapped (feature-flag / edge config).

## Module map (existing product surface)

Executive · BI · Finance · Payroll · HR · Talent · Attendance · CRM · Sales · Procurement · Inventory · Manufacturing · Fleet · Assets · Projects · Identity · Audit · Communications · Labels · Print · and more under `/dashboard/*`.
