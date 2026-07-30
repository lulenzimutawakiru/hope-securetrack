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

---

## 2. Residual risks (acceptance required for pilot)

| ID | Risk | Severity | Treatment | Residual acceptance |
|----|------|----------|-----------|---------------------|
| X-01 | God-client CRUD for non-money modules | Medium | Mitigate iteratively (server APIs for high risk first) | **Accept for pilot** — RLS still enforces company scope |
| X-02 | Live multi-tenant RLS CI not always-on | High | Enable `INTEGRATION_TESTS=true` + users A/B | **Accept until secrets wired** |
| X-03 | Remaining high npm advisories (eslint/postcss transitive) | Medium | Track in DEPENDENCY_AUDIT_REPORT | **Accept** — not runtime-critical paths |
| X-04 | No full WebAuthn/SAML/SCIM production path | Medium | UI scaffolds; IdP integration per customer | **Accept** — pilot uses Supabase Auth + MFA |
| X-05 | No independent pen-test letter | High | Schedule using PENTEST_READINESS.md | **Required before government go-live** |
| X-06 | Service-role public handlers | Medium | Rate limit + token hash + least privilege RPCs (roadmap) | **Accept with monitoring** |
| X-07 | Single-region HA | Medium | Vercel+Supabase SLA; multi-region roadmap | **Accept** |
| X-08 | "100k concurrent users" not load-certified | High | Do not claim until benchmark | **Avoid claim** — load certify public paths only |
| X-09 | Full WCAG 2.2 AA residual | Medium | axe CI + static checks; full audit roadmap | **Accept for pilot** |
| X-10 | Column-level encryption not universal | Medium | Crypto helpers + sensitive field plan | **Accept** — use app crypto for QR/secrets |

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
