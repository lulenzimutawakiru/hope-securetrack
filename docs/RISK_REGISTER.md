# SecureTrack ERP — Formal Risk Register & Residual Acceptance

| Field | Value |
|-------|--------|
| **Owner** | CISO / Platform |
| **Date** | 2026-07-30 |
| **Programme** | Phases 1–5 + Enterprise Hardening Layer |
| **Decision framework** | Accept / Mitigate / Transfer / Avoid |

> Residual risks below are **formally tracked**. Production pilot may proceed for **single controlled enterprise tenant** when hardening flags are enabled. Unrestricted multi-tenant SaaS / government requires residual closure or CISO risk acceptance signatures.

---

## 1. Addressed (mitigated in code)

| ID | Risk | Mitigation |
|----|------|------------|
| R-01 | Client auto-settle payments | Webhook + sandbox gates |
| R-02 | Open tenant signup | Provisioning gated |
| R-03 | Identity privilege escalation | API authZ + dual-control |
| R-04 | Portal plaintext tokens | SHA-256 hash + re-hash |
| R-05 | Device push tokens | Hash columns + resolve path |
| R-06 | No dual-control on money | Server APIs + env enforcement |
| R-07 | MFA optional for admins | MFA_ENFORCE_PRIVILEGED + banner |
| R-08 | In-memory rate limits only | Upstash + fail-closed flags |
| R-09 | No job retries | job_queue + DLQ + worker |
| R-10 | AI unrestricted money actions | AI governance deny-by-default |
| R-11 | No login lockout | Login-guard progressive lockout |
| R-12 | No correlation IDs | Middleware + API handler |
| R-13 | Idempotent money retries | Idempotency-Key + table 00070 |
| R-14 | Feature flags unused | Tenant flag resolution layer |
| R-15 | Critical npm CVEs | Upgraded next/vitest/sentry (crit → 0) |
| R-16 | Legacy `matches_tenant()` JWT `app_role` trust + `NULL == NULL` tenant bypass; permissive legacy `FOR ALL` policies | Migration `20260804000001` drops the seven legacy policies, hardens `matches_tenant()` (server-authoritative platform/elevated + strict non-null equality via `user_tenant_id()`), makes dead legacy tables deny-by-default, and locks `industry_templates` / `entity_metadata` to admin read; static contract tests `tests/security/legacy-lockdown.test.ts` |
| R-17 | Client-first data access with per-page duplicate auth fetches and no shared query layer | Phase 12 frontend roadmap: typed TanStack Query layer over `/api/v2/crud` with cache invalidation, single `UserProvider` auth context in the root layout (permissions derived from `role_permissions`), server-paginated `PaginatedDataGrid`, module error/loading boundaries, and bundle budget enforcement; 7 flagship pages migrated (finance/coa, hr/employees, procurement/suppliers, crm/accounts, sales/orders, payroll/runs, production/batches) |
| R-18 | Remaining client-first data access on unmigrated pages (e.g. `inventory/stock`) with per-page fetches and no shared query layer | Phase 13 frontend sweep: `useEntityAll` hook, 8 more pages on `/api/v2/crud` (quotations, leave, distributors, products, purchase orders, production orders, tickets, invoices), `public_holidays` + `sd_ticket_events` entity registrations, and `error.tsx`/`loading.tsx` boundaries for all 53 dashboard modules |
| R-19 | Remaining client-first data access on unmigrated pages (inventory, fleet, finance, manufacturing) with per-page fetches and no shared query layer | Phase 14 frontend roadmap: `inventory/stock` (serialized reams/cartons + QR chain of custody) migrated to `/api/v2/crud` - `useEntityAll` reads with filter-aware cache keys, server-side exact stat totals, `crudUpdate` move/dispatch writes, `crudCreate` movement logging, `qr_codes` entity registration; distributors reference read stays browser-side by design (`distributors.view` vs CRUD `crm.view`). Known limitation: `qr_codes` RLS update restricted to QR/production roles so warehouse-manager QR mirrors are denied (legacy-equivalent, logged) - follow-up RLS alignment tracked |
| R-20 | Remaining client-first inventory reads (adjustments, traceability, reservations, transfers, cycle-count/GRN/replenishment list views) plus join-heavy reference resolution | Phases 15-16 frontend roadmap: `inventory` hub, balances, locations, adjustments, transfers, traceability, reservations, cycle counts, GRN and replenishment all migrated to `/api/v2/crud` - exact server-side KPI totals, `useEntityAll` grid reads with filter-aware cache keys, join-free CRUD reads resolved client-side from reference maps, RPCs (`accept_grn_line`, `reserve_stock`, `release_reservation`) kept tenant-scoped. Known limitations: hub balance aggregate caps at 500 rows (CRUD page-walk cap) - sufficient for KPIs; replenishment PR grid stays browser-side by design (`procurement.view` CRUD gate vs inventory roles, same decision as hub) | 
| R-21 | Remaining client-first inventory reads on `inventory/control`, `inventory/reports` and `inventory/valuation` | Next phase: migrate control/valuation grid reads to `useEntityAll` (inventory.view gate) and route report inputs through the CRUD surface where registrations exist (`inventory_valuations` already registered) |

---

## 2. Residual risks (acceptance required for pilot)

| ID | Risk | Severity | Treatment | Residual acceptance |
|----|------|----------|-----------|---------------------|
| X-01 | God-client CRUD for non-money modules | Medium | Mitigate iteratively (server APIs for high risk first) | **Closed** ? Phase 7 moved payroll/HR/finance/billing/procurement/inventory/sales/workforce writes to server APIs; Phase 8 moved sales/CRM/products onto the CRUD API; Phase 9 added per-entity validation + defense-in-depth gates + branding; Phase 10 registered the remaining 199 entities (288 total) and migrated all 158 remaining business pages (290 mutation sites) onto `/api/v2/crud/[entity]`. Only control-plane tables (`companies`, `user_profiles`, `user_sessions`, `qr_codes`, `config_change_log`) keep direct browser writes by design (identity/config lifecycle, audited separately). |
| X-02 | Live multi-tenant RLS CI not always-on | High | Enable `INTEGRATION_TESTS=true` + users A/B | **Accept ? wiring documented** ? the live RLS job exists in `.github/workflows/ci.yml` and runs when the `INTEGRATION_TESTS` secret is `true`; requires `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` + test users A/B (`RLS_USER_A_EMAIL/PASSWORD`, `RLS_USER_B_EMAIL/PASSWORD`); full secret inventory in `docs/CI_SECRETS.md`. Not always-on until org secrets are set. |
| X-03 | Remaining high npm advisories (eslint/postcss transitive) | Medium | Track in DEPENDENCY_AUDIT_REPORT | **Accept** — not runtime-critical paths |
| X-04 | No full WebAuthn/SAML/SCIM production path | Medium | UI scaffolds; IdP integration per customer | **Accept** — pilot uses Supabase Auth + MFA |
| X-05 | No independent pen-test letter | High | Schedule using PENTEST_READINESS.md | **Required before government go-live** |
| X-06 | Service-role public handlers | Medium | Rate limit + token hash + least privilege RPCs (roadmap) | **Accept with monitoring** |
| X-07 | Single-region HA | Medium | Vercel+Supabase SLA; multi-region roadmap | **Accept** |
| X-08 | "100k concurrent users" not load-certified | High | Do not claim until benchmark | **Avoid claim** — load certify public paths only |
| X-09 | Full WCAG 2.2 AA residual | Medium | axe CI + static checks; full audit roadmap | **Accept for pilot** |
| X-10 | Column-level encryption not universal | Medium | Crypto helpers + sensitive field plan | **Accept** — use app crypto for QR/secrets |
| X-11 | Legacy identity tables (`profiles`, `audit_log`, etc.) still physically present alongside server-authoritative `user_profiles` / `audit_logs` | Low | Deny-by-default (Phase 11); drop tables after pilot confirms zero legacy readers | **Accept for pilot** — client path closed, server path unaffected |

---

## 3. Feature flags (controlled rollout)

| Flag | Default | Purpose |
|------|---------|---------|
| `ai.copilot` | on | Disable AI per tenant |
| `security.dual_control` | on | Money/identity maker-checker |
| `payroll.server_mutations` | on | Prefer server payroll APIs |
| `finance.server_gl_post` | on | Prefer server GL post |
| `jobs.durable_queue` | on | Background job path |

Env kill-switches: `SECURETRACK_AI_DISABLED`, `DUAL_CONTROL_REQUIRED`, `MFA_ENFORCE_PRIVILEGED`.

---

## 4. Pilot go-live conditions (CONDITIONAL GO)

1. Migrations through **00070** applied  
2. `MFA_ENFORCE_PRIVILEGED=true`  
3. `DUAL_CONTROL_REQUIRED=true`  
4. `PAYMENT_SANDBOX=false`  
5. Job worker cron with secret  
6. DR drill evidence filed (`npm run drill:dr` + manual restore)  
7. CISO signs this register for residual X-* items  

**Unrestricted multi-tenant SaaS:** NO-GO until X-02, X-05, X-06 closed or re-accepted.

---

## 5. Sign-off

| Role | Name | Date | Decision |
|------|------|------|----------|
| Chief Enterprise Architect | | | |
| CISO | | | Accept residual for pilot / Reject |
| DevSecOps Lead | | | |
| Product Owner | | | |
