# Changelog

## 2026-08-02 - Server-side mutation migration (Phase 7)

### New hardened API routes (session tenant/company, permission-gated, rate-limited, audited)
- Payroll: overtime claims + approval, bonuses + approval, benefit plans/enrollments, salary structures (server computes hourly rate, multipliers, amounts; generates OT-/BN-/STR- numbers; rolls back structure lines on failure)
- HR leave approval (api/hr/leave/[id]/approve); finance invoices issue + payments, GL journals; payroll advances, loans (+ approval)
- Procurement orders, requisitions (+ approval); billing credit notes, debit notes; inventory adjustments, transfers; sales orders; workforce attendance
- Pages migrated off direct browser writes: invoices, finance/AP + journals, payroll (loans, self-service, components, overtime, bonuses, benefits, structures), billing (credit/debit notes, gateways), procurement (orders, requisitions, fleet), inventory (adjustments, transfers), CRM accounts, HR employees + leave, sales orders, workforce attendance, dispatch fleet
- Shared browser helpers: src/lib/api-client.ts, src/lib/api/crud-client.ts, src/lib/api/audit.ts, src/lib/api/bill-number.ts; entity registry updated

### Tests
- tests/security/v2-crud-permissions.test.ts - CRUD API permission contract

---

## 2026-08-02 - RLS business permission enforcement (Phase 6)

### Database / RLS
- Migration `20260801000006` - RESTRICTIVE write policies on 385 fleet, projects (PPM), manufacturing (MES), enterprise archive & logging (EAL), enterprise company, dispatch, talent acquisition, branding, HR communications, identity management, integrations, workforce identity, attendance, profiles, reporting (BI), billing, print, labels, payroll support, sales, communications, CRM, finance, service-desk, SCM/SOP, supplier relationship management and notification routing tables
- 15 legacy identity / control-plane / plumbing tables remain deliberately deferred (profiles, audit_log, workflow_instances, roles, user_profiles, qr_codes, print_agents, print_jobs, print_logs, verification_logs, counterfeit_reports, fraud_alerts, system_settings, user_company_memberships, job_dead_letters); documented in the migration header
- Every write policy is gated on module permissions (`public.has_any_permission`) or `super_administrator`, ANDs with the migration-71 `tenant_isolation_restrict` policy; SELECT stays open to company members for the client UI

### Tests
- `tests/security/rls-permission-gates.test.ts` - static contract extended to all five migrations (904 hardened tables, 2,712 write policies total), every permission slug verified against the live catalog

---

## 2026-08-02 - RLS business permission enforcement (Phase 5)

### Database / RLS
- Migration `20260801000005` - RESTRICTIVE write policies on 269 asset tracking, digital identity, underwriting, supplier relationship management, business intelligence / reporting, remaining finance & accounting, print / labels / packaging, communications and shared org / inventory / SCM / HR / dispatch / SD catalog / workflow support tables
- Every write policy is gated on module permissions (`public.has_any_permission`) or `super_administrator`, ANDs with the migration-71 `tenant_isolation_restrict` policy; SELECT stays open to company members for the client UI

### Tests
- `tests/security/rls-permission-gates.test.ts` - static contract extended to all four migrations (519 hardened tables, 1,557 write policies total), every permission slug verified against the live catalog

---

## 2026-08-02 - RLS business permission enforcement (Phases 2-4)

### Database / RLS
- Migration `20260801000002` - RESTRICTIVE write policies on 21 high-risk finance, payroll, sales/CRM, HR and procurement tables; restored read visibility of global role templates on `roles`
- Migration `20260801000003` - RESTRICTIVE write policies on 65 inventory, manufacturing (MES), fleet, projects (PPM), attendance/workforce and recruitment (TA) tables
- Migration `20260801000004` - RESTRICTIVE write policies on 164 finance/accounting master data, payroll master & support, HR, CRM, sales, procurement, billing and service-desk tables
- Every write policy is gated on module permissions (`public.has_any_permission`) or `super_administrator`, ANDs with the migration-71 `tenant_isolation_restrict` policy; SELECT stays open to company members for the client UI

### Tests
- `tests/security/rls-permission-gates.test.ts` - static contract covering all three migrations (250 hardened tables, 750 write policies total), every permission slug verified against the live catalog

---

## 2026-07-30 — Enterprise Hardening Layer (Assessment implementation)

### Architecture / API
- Central `createApiHandler` — authZ, Zod, rate limit, correlation ID, idempotency
- Migration `00070` — `api_idempotency_keys` + feature flag seeds
- Tenant context helpers (`tenantCacheKey`, storage prefix, redaction)
- Feature flag resolver (`src/lib/platform/flags.ts`)
- OpenAPI + SBOM generation in CI

### Security
- Login progressive lockout + CAPTCHA hooks (`/api/auth/login-guard`)
- Middleware correlation IDs + public login-guard path
- AI governance (restricted money/identity actions require human + dual-control)
- Payroll bank-file route migrated to central handler + Idempotency-Key
- SSO/SCIM configuration contracts (`src/lib/identity/sso-scim.ts`)
- Formal `docs/RISK_REGISTER.md` residual acceptance

### UX / A11y
- High-contrast CSS mode + reduced-motion respect

### DevSecOps
- CI: fail on critical CVEs, secret heuristic scan, SBOM, OpenAPI artifacts

---

## 2026-07-30 — Phase 5 (ops readiness + deep e2e + deps)

### Deep dual-control / domain integrity
- `tests/security/dual-control-flow.test.ts` — payroll workflow dual-control walk, fraud match path
- `e2e/payroll-dual-control.spec.ts` — maker/checker dual-control + money APIs
- Optional `E2E_CHECKER_EMAIL` / `E2E_CHECKER_PASSWORD`

### Dependency remediation
- Upgraded `next` → 16.x, `@sentry/nextjs` latest, `vitest` → 4.x
- **Critical CVEs: 0** (was 2); high reduced (remaining mostly transitive eslint/next postcss)
- `npm run audit:deps` evidence refreshed

### Ops / DR / pen-test
- `npm run drill:dr` → `docs/DR_DRILL_EVIDENCE.json`
- `docs/PENTEST_READINESS.md` — scope, attack surface, test cases
- Health endpoint exposes non-secret platform posture flags
- `/dashboard/platform/ops` ops posture UI
- OpenAPI inventory: `npm run openapi:generate` → `docs/openapi.json`

### Platform
- Next 16 config: removed deprecated `eslint` key from `next.config.ts`

---

## 2026-07-30 — Phase 4 (certification gates)

### Live RLS
- `tests/security/rls-live.test.ts` — anon denial, table presence, optional cross-company user isolation
- CI job `integration-rls` when `INTEGRATION_TESTS=true`
- Secrets guide: `docs/CI_SECRETS.md`

### Authenticated e2e
- `e2e/authenticated.spec.ts` — payroll, match, dual-control, workflows, jobs, API session
- `e2e/helpers/auth.ts` login helper
- CI runs auth suite when `E2E_EMAIL` / `E2E_PASSWORD` set

### WCAG / axe
- `@axe-core/playwright` dependency
- `e2e/a11y.spec.ts` — public + authenticated scans (wcag2a/aa/21aa)
- Static checklist extended

### Load & dependencies
- `npm run test:load:certify` → `docs/LOAD_CERTIFICATION_REPORT.json`
- `npm run audit:deps` → `docs/DEPENDENCY_AUDIT_REPORT.json`

### Compliance
- `docs/SOC2_ISO_EVIDENCE_PACK.md` — TSC + ISO 27001 control map + evidence inventory

---

## 2026-07-30 — Phase 3 (UI wiring, queue consumers, e2e, a11y)

### UI → server money APIs
- Payroll Runs: process / bank file / release via `/api/payroll/*` with dual-control prompt
- Finance Accounting Engine: GL post via `/api/finance/post`
- Shared `src/lib/api-client.ts` (`apiPost`, `promptDualControlId`)

### Job queue consumers
- `notifyUsersAsync` enqueues `notification.dispatch` (worker runs full `notifyUsers`)
- SIEM outbox push enqueues `siem.forward`; worker delivers HTTPS connectors
- Email job handler sends via Resend when configured
- Payroll release notification uses structured notify payload

### Quality gates
- Playwright `e2e/smoke.spec.ts` (public + optional authenticated)
- Expanded RLS matrix + optional live integration tests
- Static a11y checklist (`tests/a11y`)
- Load smoke script `scripts/load-smoke.mjs`
- CI runs full unit suite + readiness audit; e2e job scaffolded

### Accessibility
- Skip-to-main link + `#main-content` landmark on dashboard shell
- aria-labels on payroll money actions; keyboard selectable run rows

---

## 2026-07-30 — Phase 2 (money paths, jobs, three-way match)

### Server-side money mutations
- `POST /api/payroll/process` — server payroll run (admin client, company-scoped)
- `POST /api/payroll/bank-file` — bank file with dual-control gate
- `POST /api/payroll/release` — payment release + optional GL post + notify job
- `POST /api/finance/post` — GL auto-post via accounting engine (server client)
- `postAccountingEvent` accepts optional Supabase client for API use

### Durable jobs
- Migration `00069`: `job_queue`, `job_dead_letters`
- `src/lib/jobs/queue.ts` — enqueue, claim, complete, fail, exponential backoff, DLQ
- `POST/GET /api/jobs/worker` — cron worker (`JOB_WORKER_SECRET` / `CRON_SECRET`)
- Platform UI `/dashboard/platform/jobs`

### Procurement
- Pure three-way match engine + `POST /api/procurement/match`
- Matching page: run match / dry-run / save log

### Device security
- Integration `push_token_hash` + device `auth_token_hash` resolution with re-hash
- Helpers `setDeviceAuthToken`, `setIntegrationPushToken`

### Rate limits
- `RATE_LIMIT_FAIL_CLOSED` / `RATE_LIMIT_REQUIRE_REDIS` for production fail-closed

### Tests
- `tests/procurement/three-way-match.test.ts`
- `tests/jobs/queue-logic.test.ts`

---

## 2026-07-30 — Production completeness pass

### Security
- Portal access tokens verified via **SHA-256 hash** (`access_token_hash`) with legacy plaintext migration fallback and opportunistic re-hash.
- Server API `POST /api/billing/portal-users` issues tokens once; admin UI copies secure link.
- `rateLimitStrict` with optional **Upstash Redis** for multi-instance public routes.

### Workflows
- Real state-machine engine: recruitment, procure-to-pay, manufacturing, payroll, paper pipeline (`src/lib/workflows/engine.ts`).
- API `GET/POST /api/workflows` + UI `/dashboard/workflows`.
- Migration `00068`: `wf_instances`, `enterprise_import_batches`, device `auth_token_hash`.

### Data & UX
- Shared CSV parse/validate/import (`src/lib/enterprise/csv.ts`); payroll & finance import helpers.
- Payroll entity pages: Import CSV, restore soft-deleted rows, fixed mojibake UI strings.
- HopeChat Calls page loads live `hc_meetings` history.

### AI
- `src/lib/ai/gateway.ts` — OpenAI-compatible LLM with deterministic rules fallback.
- Authenticated `POST /api/ai/copilot`.

### Tests
- `tests/payroll/engine.test.ts` — pay calc, OT, bank CSV, payslip HTML.
- `tests/enterprise/csv-workflow-tokens.test.ts` — CSV, workflows, token hash, AI rules.

### Docs
- Updated `PRODUCTION_TRANSFORMATION_STATUS.md`, `PRODUCTION_HARDENING_RUNBOOK.md`.
