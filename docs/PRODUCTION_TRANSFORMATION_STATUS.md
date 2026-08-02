# SecureTrack ERP — Production Transformation Status

**Date:** 2026-07-30  
**Goal:** Commercially deployable multi-tenant ERP (not a demo).

## Reality check

SecureTrack ERP has **enterprise breadth** (~977+ dashboard pages, 35+ APIs, 69 migrations, domain modules for finance, payroll, manufacturing, HR, fleet, etc.). Completing every SAP/Oracle-class line-item remains a multi-quarter programme. This document tracks **what is production-grade now**, **what was hardened in the latest pass**, and **what remains**.

## Phase 11 (2026-08-03) - legacy identity & permissive-policy lockdown

| Deliverable | Status |
|------------|--------|
| Migration `20260804000001` drops the seven legacy permissive `FOR ALL` policies built on `matches_tenant()` (`profiles`, `audit_log`, `tenants`, `tenant_modules`, `custom_fields`, `workflow_definitions`, `tenant_settings`) | Live |
| `matches_tenant()` hardened: no JWT `app_role` trust, no `NULL == NULL` bypass; platform access via server-authoritative `is_platform_admin()` / `is_platform_elevated()`, else strict non-null equality against `user_tenant_id()` | Live |
| Dead legacy tables (`profiles`, `audit_log`, `custom_fields`, `workflow_definitions`, `tenant_settings`) deny-by-default (RLS enabled, zero policies) | Live |
| Platform reference tables never under RLS (`industry_templates`, `entity_metadata`) locked to platform/super-admin read | Live |
| Static contract suite `tests/security/legacy-lockdown.test.ts` (8 tests) | Live |
| Typecheck / vitest (171) / security suite (101) / readiness audit (0 issues) / production build | Green |


## RLS business permission enforcement (2026-08-02, Phases 2-4)
## Phase 10 (2026-08-03) - full CRUD migration of remaining business modules

| Deliverable | Status |
|------------|--------|
| 199 additional entities registered in the CRUD registry (288 total) with permission-correct view/create/update/delete mappings | Live |
| 158 dashboard pages migrated off direct browser Supabase writes onto `/api/v2/crud/[entity]` (290 mutation call sites converted) | Live |
| Array / multi-row flows rewritten as per-row CRUD loops (contract milestones, project-entry invoicing, MES AI insights, BI assistant messages, RFQ award rejections, printer defaults) | Live |
| Upsert removed in favor of fetch-or-create/update (`bi_kpi_snapshots`) | Live |
| Only control-plane tables keep direct browser writes (`companies`, `user_profiles`, `user_sessions`, `qr_codes`, `config_change_log`) | By design |
| Typecheck / vitest (163) / security suite (93) / readiness audit (0 issues) / production build | Green |



Closes the data-layer RBAC gap: any authenticated company member could previously
INSERT / UPDATE / DELETE business data directly through the browser client because
permissive `*_all` policies were gated only by `company_id = user_company_id()`.

| Deliverable | Status |
|-------------|--------|
| Phase 2: 21 high-risk finance/payroll/sales/CRM/HR/procurement tables | Live `20260801000002` |
| Phase 3: 65 inventory/MES/fleet/PPM/attendance/TA tables | Live `20260801000003` |
| Phase 4: 164 finance/payroll/HR/CRM/sales/procurement/billing/service-desk tables | Live `20260801000004` |
| RESTRICTIVE write policies (INSERT/UPDATE/DELETE) gated on `has_any_permission` or super admin; ANDs with migration-71 tenant isolation | Live |
| SELECT stays open to company members for the client UI | Live |
| Static RLS contract tests (519 tables, 1,557 policies, verified slugs, all four migrations) | Live `tests/security/rls-permission-gates.test.ts` |

## RLS business permission enforcement (2026-08-02, Phase 5)

| Deliverable | Status |
|-------------|--------|
| Phase 5: 269 asset tracking / digital identity / underwriting / SRM / reporting / print / labels / packaging / communications + shared org/inventory/SCM/HR/dispatch/SD catalog/workflow tables | Live `20260801000005` |
| RESTRICTIVE write policies (INSERT/UPDATE/DELETE) gated on `has_any_permission` or super admin; ANDs with migration-71 tenant isolation | Live |
| SELECT stays open to company members for the client UI | Live |
| Static RLS contract tests extended to all four migrations (519 tables, 1,557 policies) | Live `tests/security/rls-permission-gates.test.ts` |

## Enterprise Hardening Layer (2026-07-30)

| Deliverable | Status |
|-------------|--------|
| Central API handler (authZ, idempotency, correlation) | Live |
| Feature flags + tenant context helpers | Live |
| Login lockout / CAPTCHA guard | Live |
| AI governance (no money/identity execute) | Live |
| Migration 00070 idempotency keys | Live |
| CI security gates (critical CVE fail, SBOM, secret scan) | Live |
| Risk register residual acceptance | Live `docs/RISK_REGISTER.md` |
| SSO/SCIM contracts (config model) | Live |
| High-contrast + reduced-motion | Live |

## Phase 5 (2026-07-30) — ops readiness

| Deliverable | Status |
|-------------|--------|
| Dual-control payroll domain + e2e deep path | Live |
| Dependency upgrades (critical CVE → 0) | Live |
| DR drill automation evidence | Live `npm run drill:dr` |
| Pen-test readiness pack | Live `docs/PENTEST_READINESS.md` |
| Health platform posture flags | Live `/api/health` |
| Ops dashboard | Live `/dashboard/platform/ops` |
| OpenAPI route inventory | Live `docs/openapi.json` |

## Phase 4 (2026-07-30) — certification gates

| Deliverable | Status |
|-------------|--------|
| Live RLS integration suite + cross-user tests | Live `tests/security/rls-live.test.ts` |
| CI integration-rls job (secret-gated) | Live |
| Authenticated Playwright flows | Live `e2e/authenticated.spec.ts` |
| Axe WCAG 2.1 AA e2e scans | Live `e2e/a11y.spec.ts` |
| Load certification report script | Live `npm run test:load:certify` |
| Dependency audit evidence JSON | Live `npm run audit:deps` |
| SOC 2 / ISO 27001 evidence pack | Live `docs/SOC2_ISO_EVIDENCE_PACK.md` |
| CI secrets documentation | Live `docs/CI_SECRETS.md` |

## Phase 3 (2026-07-30) — wire-up, consumers, quality

| Deliverable | Status |
|-------------|--------|
| Payroll Runs UI → server process / bank / release | Live |
| Finance engine UI → server GL post | Live |
| Dual-control prompt on 403 | Live (`api-client`) |
| `notifyUsersAsync` + SIEM → job queue | Live |
| Job handlers: full notify, SIEM HTTPS push, email send | Live |
| Playwright public smoke + optional auth e2e | Live `e2e/smoke.spec.ts` |
| Expanded RLS matrix + optional live tests | Live |
| A11y skip-link + static checklist | Live |
| Load smoke script | Live `npm run test:load` |
| CI full unit suite | Live |

## Phase 2 (2026-07-30) — money paths, jobs, match

| Deliverable | Status |
|-------------|--------|
| Server payroll process / bank-file / release APIs | Live (`/api/payroll/*`) |
| Server GL post API + client-injectable accounting engine | Live (`/api/finance/post`) |
| Dual-control gates on bank file + release + GL post | Live (env `DUAL_CONTROL_REQUIRED`) |
| Durable **job queue + DLQ** + worker | Live migration `00069`, `/api/jobs/worker`, `/dashboard/platform/jobs` |
| Three-way match engine + API + UI run | Live |
| Device / integration **token hash** resolution | Live |
| Rate limit fail-closed options | Live (`RATE_LIMIT_FAIL_CLOSED`) |
| Tests: three-way match, job backoff | Live |

## Phase 1 (2026-07-30) — foundations

| Deliverable | Status |
|-------------|--------|
| Portal token **SHA-256 hash** lookup + migration re-hash | Live (`src/lib/security/tokens.ts`, portal API) |
| Portal user create via server API (token shown once) | Live `POST /api/billing/portal-users` |
| Strict rate limit helper + Upstash Redis optional | Live (`rateLimitStrict`) |
| Enterprise **workflow engine** (recruitment, P2P, MES, payroll, paper) | Live `src/lib/workflows/engine.ts` + `/api/workflows` + `/dashboard/workflows` |
| Durable `wf_instances` + import audit tables | Migration `00068` |
| CSV **import** shared + payroll/finance `*ImportCsv` | Live |
| Payroll entity UI: import, restore, fixed encoding | Live |
| SecureTrack **AI gateway** (LLM + rules fallback) | Live `src/lib/ai/gateway.ts` + `POST /api/ai/copilot` |
| HopeChat Calls: live meeting history (not marketing shell) | Live |
| Domain unit tests: payroll engine, CSV, workflows, tokens | Live `tests/payroll`, `tests/enterprise` |

## Delivered for production deployment

| Area | Status |
|------|--------|
| Multi-tenant model (tenants, companies, memberships, switcher) | Live |
| Platform admin, provisioning (gated), feature flags, events | Live |
| Security: requireApiAuth, dual-control, MFA hooks, CSP, fail-closed middleware | Live (MFA/dual-control **opt-in** via env) |
| Payment: no client auto-settle; webhook + sandbox gates | Live |
| Portal: public API + **hashed** token access | Live |
| CI: typecheck, security + domain tests, readiness audit script | Live |
| DR + hardening runbooks | Live |
| Build OOM mitigation: dashboard `force-dynamic`, heap limit, webpack memory opts | Live |
| MFA enrollment banner for privileged roles | Live |
| Dual-control UI | `/dashboard/security/dual-control` |
| Workflow control plane | `/dashboard/workflows` |

## Critical business modules (existing)

| Module | Path | Notes |
|--------|------|--------|
| Finance | `/dashboard/finance` | Full hub + submodules |
| Payroll | `/dashboard/payroll` | Enterprise extension + processing |
| Talent / HR | `/dashboard/talent`, `/dashboard/hr` | ATS + HR |
| Manufacturing | `/dashboard/production` | MES |
| Inventory / Procurement | `/dashboard/inventory`, `/dashboard/procurement` | Present |
| CRM / Sales | `/dashboard/crm`, `/dashboard/sales` | Present |
| Fleet | `/dashboard/fleet` | Present |
| Attendance | `/dashboard/attendance` | Devices + field |
| Audit / Identity | `/dashboard/audit`, `/dashboard/identity` | Present |
| Platform | `/dashboard/platform` | Multi-tenant control plane |

## Enable before customer production

See `PRODUCTION_HARDENING_RUNBOOK.md`:

```bash
MFA_ENFORCE_PRIVILEGED=true
DUAL_CONTROL_REQUIRED=true
PAYMENT_SANDBOX=false
BILLING_WEBHOOK_SECRET=...
PLATFORM_PROVISIONING_PUBLIC=false
QR_ENCRYPTION_KEY=<64 hex chars>
```

## Server-side mutation migration (2026-08-02, Phase 7)

Moves the highest-risk money and record mutations off the browser Supabase client onto permission-gated, rate-limited, audited API routes. Session-derived tenant/company only; number generation, amount computation and approver identity all happen server-side.

| Deliverable | Status |
|------------|--------|
| Payroll: overtime + approval, bonuses + approval, benefit plans/enrollments, salary structures, advances, loans + approval | Live |
| HR leave approval, finance invoices/journals, billing credit/debit notes, procurement orders/requisitions + approval, inventory adjustments/transfers, sales orders, workforce attendance | Live |
| Browser helper layer (api-client, crud-client) + entity registry | Live |
| Pages rewired to server APIs (invoices, finance/AP+journals, payroll, billing, procurement, inventory, CRM, HR, sales, workforce, dispatch, fleet) | Live |
| CRUD API permission contract test | Live tests/security/v2-crud-permissions.test.ts |

## Server-side mutation migration (2026-08-02, Phase 8) — sales / CRM / products


Moves the sales line-item tables under dual-key tenant isolation and rewires the remaining high-volume sales / CRM / product-master browser mutations onto the permission-gated, audited CRUD API.


| Deliverable | Status |

|------------|--------|

| `quotation_lines` + `sales_order_lines` scoped (tenant_id/company_id NOT NULL, FK, index, backfill, RESTRICTIVE tenant policy, parent-derivation trigger) | Live `20260802000001` |

| 10 entities registered in the CRUD registry (sales lines/returns, CRM notes/campaigns/contracts/documents/loyalty/segments, distributors) | Live |

| 13 pages migrated to crudCreate / crudUpdate / crudDelete / crudRestore | Live |

| Rollback paths for multi-write flows (quote→line, order→lines, loyalty ledger→customer) | Live |

| Typecheck / tests / security suite / readiness audit / production build | Green |

## Phase 9 (2026-08-03) - observability, CRUD validation, defense-in-depth RLS

| Deliverable | Status |
|------------|--------|
| Sentry instrumentation (Node + edge + browser) DSN-guarded, root-layout client init | Live |
| next-intl plugin load fixed (removed shadowing `next.config.mjs`) | Live |
| Per-entity CRUD payload validation (entity-schemas + engine 400s) | Live `tests/security/crud-validation.test.ts` |
| RESTRICTIVE defense-in-depth write gates for `print_jobs` / `fraud_alerts` / `config_change_log` | Live `20260803000001` |
| 7 branding entities registered + 7 branding pages migrated to CRUD API | Live |
| Typecheck / tests / security suite / readiness audit / production build | Green |


1. ~~Engineering phases 1–5 + hardening layer~~ **done**  
2. Migrate remaining high-risk browser mutations to `createApiHandler` routes  
3. Customer IdP: full OIDC/SAML runtime + SCIM endpoints  
4. WebAuthn / passkeys enrollment UX  
5. Live RLS CI always-on + pen-test retest  
6. Independent SOC 2 / ISO attestation  
7. See residual **X-*** items in `docs/RISK_REGISTER.md`  

## Commands

```bash
npm run typecheck
npm test
npm run test:security
npm run test:e2e
npm run test:e2e:payroll
npm run test:load:certify
npm run drill:dr
npm run openapi:generate
npm run sbom
npm run audit:deps
npm run audit:readiness
npm run ci
npm run build
```

## Recommendation

**CONDITIONAL GO — controlled enterprise pilot** when hardening flags + migration 00070 + worker cron are live, and CISO signs `RISK_REGISTER.md`.  
**NO-GO — unrestricted multi-tenant SaaS / government** until residual X-02/X-05/X-06 closed or re-accepted.
