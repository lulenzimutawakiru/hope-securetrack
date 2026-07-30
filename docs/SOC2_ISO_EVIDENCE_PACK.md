# SecureTrack ERP — SOC 2 / ISO 27001 Evidence Pack

| Field | Value |
|-------|--------|
| **Product** | SecureTrack ERP |
| **Version** | 1.0.x |
| **Pack date** | 2026-07-30 |
| **Classification** | Confidential — Internal / Auditor |
| **Frameworks** | SOC 2 TSC (CC, A, C, PI, P), ISO 27001:2022 Annex A (selected), OWASP ASVS L2 |
| **Scope** | Multi-tenant SaaS ERP on Vercel + Supabase (PostgreSQL, Auth, Storage) |
| **Related** | `SECURITY_AUDIT.md`, `SECURITY_AUDIT_2.md`, `PRODUCTION_HARDENING_RUNBOOK.md`, `DISASTER_RECOVERY.md`, `MULTI_TENANT.md` |

> This pack maps **controls to system evidence** in the codebase and ops runbooks. It is not a certified audit opinion. Engage an independent CPA/ISO auditor for attestation.

---

## 1. Trust Services Criteria map (SOC 2)

| TSC | Control objective | SecureTrack evidence | Status |
|-----|-------------------|----------------------|--------|
| **CC1** Control environment | Roles, privileged access, dual-control | RBAC/permissions, `PRIVILEGED_ROLE_SLUGS`, dual-control API/UI, MFA flags | Implemented (enforce via env) |
| **CC2** Communication | Policies & user notices | Docs, login MFA banner, portal terms | Partial |
| **CC3** Risk assessment | Risk identification | Security audits R1/R2, production readiness assessment | Documented |
| **CC4** Monitoring | Logging, SIEM, health | `eal_*` audit, SIEM outbox + job worker, `/api/health`, Sentry dep | Implemented |
| **CC5** Control activities | Change management | GitHub Actions CI, migrations versioned, dual-control for money | Implemented |
| **CC6** Logical access | AuthN/Z, session, RLS | Supabase Auth, `requireApiAuth`, RLS company scope, portal token hash | Implemented |
| **CC7** System operations | Incident, backup, DR | `DISASTER_RECOVERY.md`, Supabase backups, job DLQ | Documented + platform-dependent |
| **CC8** Change management | Deploy, rollback | CI, Vercel deployments, k8s/Docker artifacts | Implemented |
| **CC9** Risk mitigation | Vendors, encryption | Encryption helpers, HTTPS, secrets in env | Partial formal vendor review |
| **A1** Availability | Uptime, capacity | Health checks, load certification script, HA via Vercel/Supabase | Platform-backed |
| **C1** Confidentiality | Encryption, isolation | TLS in transit, AES for QR tokens, tenant/company RLS | Implemented |
| **PI1** Processing integrity | Completeness, accuracy | Payroll engine tests, three-way match, GL engine, dual-control | Implemented (core paths) |
| **P1–P8** Privacy | Notice, access, retention | Soft-delete, audit, DPPA references in assessment | Partial (DPA/legal templates) |

---

## 2. ISO 27001:2022 Annex A (selected)

| Control | Title | Evidence path / artifact |
|---------|-------|---------------------------|
| A.5.1 | Policies | `docs/SECURITY_AUDIT*.md`, hardening runbook |
| A.5.15 | Access control | RBAC, RLS, dual-control |
| A.5.17 | Authentication | Supabase Auth, MFA enforcement hooks |
| A.5.18 | Access rights | Roles/permissions migrations |
| A.8.1 | User endpoint devices | Device token hash for attendance |
| A.8.9 | Configuration management | Env flags, migrations `00066–00069` |
| A.8.10 | Information deletion | Soft-delete + recycle bin |
| A.8.12 | Data leakage prevention | RLS matrix + live tests |
| A.8.15 | Logging | Audit module, domain events, pay_audit |
| A.8.16 | Monitoring | SIEM connectors, health |
| A.8.24 | Cryptography | `src/lib/crypto/*`, QR key requirements |
| A.8.25 | Secure development | CI typecheck/tests, security unit tests |
| A.8.32 | Change management | Git + CI + migrations |

---

## 3. Evidence inventory (automated)

| Artifact | How to generate | Location |
|----------|-----------------|----------|
| Unit + security tests | `npm test` | CI logs |
| Live RLS proof | `INTEGRATION_TESTS=true npm run test:security` | CI + `tests/security/rls-live.test.ts` |
| Playwright smoke / auth | `npm run test:e2e` | `e2e/*` |
| Axe WCAG scan | `npx playwright test e2e/a11y.spec.ts` | CI / local HTML report |
| Production readiness | `npm run audit:readiness` | `docs/PRODUCTION_READINESS_AUDIT_REPORT.json` |
| Load certification | `npm run test:load:certify` | `docs/LOAD_CERTIFICATION_REPORT.json` |
| Dependency audit | `npm run audit:deps` | `docs/DEPENDENCY_AUDIT_REPORT.json` |
| Migration set | `ls supabase/migrations` | 69+ SQL files |

---

## 4. Access control evidence

| Control | Implementation |
|---------|----------------|
| Authentication | Supabase email/password; session cookies via middleware |
| MFA | `MFA_ENFORCE_PRIVILEGED=true`; profile `require_mfa` / `mfa_enforced` |
| Authorization | `requireApiAuth` permission OR; UI nav permissions |
| Dual control | `sec_dual_control_requests`; bank file, release, GL post |
| Tenant isolation | `company_id` RLS + memberships + switcher |
| Portal secrets | SHA-256 `access_token_hash` |
| Device secrets | `push_token_hash` / `auth_token_hash` |
| Service role | Limited to public/device/admin routes; rate limited |

---

## 5. Operations evidence

| Process | Procedure |
|---------|-----------|
| Deploy | Vercel / Docker / k8s manifests |
| Secrets | Vercel/GitHub env; no secrets in git |
| Jobs | `POST /api/jobs/worker` with `JOB_WORKER_SECRET` |
| Backups | Supabase PITR / plan-dependent |
| DR | `docs/DISASTER_RECOVERY.md` — schedule restore drill quarterly |
| Incident | Security dual-control + audit SIEM alerts |

---

## 6. Gaps to close before formal certification

1. **Independent pen-test** and remediation letter  
2. **Vendor SOC reports** (Vercel, Supabase, Resend) on file  
3. **Formal access reviews** (quarterly privileged user attestation)  
4. **Customer DPA / subprocessors list** published  
5. **Background check / security training** HR records (org-level)  
6. **Critical npm CVEs** remediated (`docs/DEPENDENCY_AUDIT_REPORT.json`)  
7. **Live RLS CI** always-on with dedicated test tenants  
8. **WCAG** residual serious issues fixed after axe runs  

---

## 7. Auditor interview prompts

- How is multi-tenant isolation enforced? → RLS + company_id + tests  
- Who can release payroll? → Dual-control + MFA + permissions  
- How are portal tokens stored? → Hash-first with migration re-hash  
- How are jobs retried? → job_queue exponential backoff + DLQ  
- How is change promoted? → GitHub Actions + migrations  

---

## 8. Sign-off template

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Engineering lead | | | |
| Security / CISO | | | |
| Ops | | | |

**Statement:** Controls listed as Implemented were verified against the codebase and automated tests on the pack date. Residual gaps in §6 are accepted for pilot scope or tracked in the risk register.
