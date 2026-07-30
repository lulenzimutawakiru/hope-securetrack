# SecureTrack ERP  
# Independent Enterprise Security, Architecture & Production Readiness Audit

| | |
|--|--|
| **Document classification** | Confidential — Board / CISO / CTO |
| **Subject** | SecureTrack ERP (multi-tenant enterprise platform) |
| **Audit type** | Independent composite assessment (architecture, security, compliance, ops, quality) |
| **Audit date** | 2026-07-30 |
| **Methodology** | Static code & schema review; configuration inspection; dependency audit; prior remediation verification; industry control mapping |
| **Evidence basis** | Repository at assessment time: ~**67** SQL migrations, **26** App Router API routes, **~974** dashboard pages, security helpers, CI workflow, docs |
| **Not performed** | Live authenticated pentest, DAST against production, red-team, physical review of Supabase dashboard settings, formal SOC evidence sampling |
| **Related artefacts** | `SECURITY_AUDIT.md`, `SECURITY_AUDIT_2.md`, `ENTERPRISE_PRODUCTION_READINESS_ASSESSMENT.md`, `PRODUCTION_HARDENING_RUNBOOK.md`, `DISASTER_RECOVERY.md` |

**Legend — evidence quality**

| Tag | Meaning |
|-----|---------|
| **Verified** | Confirmed in current source/config |
| **Partial** | Control exists but incomplete or opt-in |
| **Assumed** | Reasonable inference; requires live validation |
| **Not evidenced** | Claimed capability or enterprise requirement not found in repo |

---

# 1. Executive Summary

## 1.1 Platform characterisation

SecureTrack ERP is a **feature-dense modular monolith** built on **Next.js 15 + Supabase (PostgreSQL Auth Storage Realtime) + Vercel**. It targets manufacturing, finance, payroll, HR/talent, fleet, attendance, CRM/sales, labels/print, audit/EAL, and multi-tenant platform administration.

The product vision (SAP/Oracle-class ERP) **exceeds** the operational maturity of the current implementation. Functional surface area is large; **assurance surface area** (tests, CI depth, enforced MFA, dual-control by default, RLS proof, DR drills) remains comparatively thin.

## 1.2 Overall Security Maturity Score

### **Score: 48 / 100** (Developing → Managed)

| Domain | Weight | Score | Weighted |
|--------|--------|-------|----------|
| Architecture & multi-tenancy | 15% | 52 | 7.8 |
| Identity & access | 15% | 50 | 7.5 |
| Application & API security | 15% | 55 | 8.3 |
| Data & database security | 12% | 55 | 6.6 |
| DevSecOps & supply chain | 10% | 40 | 4.0 |
| Operations, DR, monitoring | 10% | 38 | 3.8 |
| Compliance readiness | 10% | 32 | 3.2 |
| Quality, testing, performance | 8% | 30 | 2.4 |
| AI / integrations / storage | 5% | 45 | 2.3 |
| **Total** | 100% | | **~48** |

**Interpretation (CMMI-like):** Controls and patterns exist; many are **opt-in or partial**. Not yet “Defined/Quantitatively Managed” for regulated multi-tenant production.

## 1.3 Material conclusions

1. **Significant security remediations were implemented** (identity APIs, public provision gating, payment settlement gates, audit RBAC, portal service-role API, middleware fail-closed, dual-control framework, security unit tests, CI skeleton).  
2. **Critical residual risks remain** primarily from: (a) **service-role** public surfaces, (b) **client-side data access** trusting RLS alone, (c) **opt-in** MFA/dual-control, (d) **dependency CVEs**, (e) **insufficient automated assurance**.  
3. **Enterprise claims** (100k tenants, K8s, air-gap, government) are **not evidenced** by infrastructure or load-test artefacts.  
4. **Production recommendation:** see §25.

---

# 2. Architecture Review

## 2.1 Verified architecture

```
[Browser PWA] → [Vercel Next.js middleware + RSC/client]
                      ↓
              [Supabase Auth JWT + Postgres RLS]
                      ↓
        Domain libs (client)  |  Route Handlers (service role for public/devices)
```

**Verified strengths**

- Domain modularity (`src/lib/payroll`, `finance`, `fleet`, `ta`, `mes`, `platform`, `security`, …).  
- Company-centric data model and RLS helper functions (`user_company_id`, memberships, tenants).  
- Platform plane: tenants, subscriptions, feature flags, domain_events, provisioning.  
- Fail-closed middleware on session failure (**Verified** in `src/middleware.ts`).

**Architectural flaws / risks**

| Finding | Evidence | Severity |
|---------|----------|----------|
| Client-centric trust model | Most CRUD via browser Supabase + RLS | High |
| Incomplete event-driven architecture | `domain_events` + emit helpers; durable consumers/DLQ **not evidenced** | High |
| Microservice / K8s claims vs reality | No Dockerfile/K8s manifests; Vercel serverless | Medium (misrepresentation risk) |
| Monolith UI sprawl | ~974 dashboard pages | Medium (maintainability, attack surface) |
| Weak domain boundaries | Shared patterns, not formal aggregates/APIs | Medium |
| No CQRS/read models at scale | Direct table reads for dashboards | Medium |

**Recommendation:** Treat as modular monolith; introduce **server-side application services** for money, identity, inventory postings; complete event consumers; publish accurate deployment architecture to customers.

---

# 3. Production Readiness Assessment

| Criterion | Status |
|-----------|--------|
| Builds on Vercel | Verified historically |
| Migrations versioned (67) | Verified |
| Security hardening code | Verified (partial enforcement) |
| CI workflow present | Verified (`.github/workflows/ci.yml`) |
| Automated product tests | **Not evidenced** in `src/` (0 tests); **2** security test files under `tests/` |
| Load / capacity proof | Not evidenced |
| DR drill evidence | Runbook exists; **drill evidence not evidenced** |
| MFA default enforce | **Opt-in** (`MFA_ENFORCE_PRIVILEGED`) |
| Dual-control default | **Opt-in** (`DUAL_CONTROL_REQUIRED`) |
| Secrets inventory | Documented; vault process not evidenced |
| Air-gap / on-prem kit | Not evidenced |

**Production readiness: Conditional pilot only.**

---

# 4. Multi-Tenant Security Assessment

## 4.1 Verified controls

- `tenants`, `companies.tenant_id`, `user_company_memberships`, `active_company_id`, `switch_active_company()`.  
- Widespread RLS: `company_id = public.user_company_id()`.  
- Platform admin / super_admin bypass intentional.  
- Tenant provisioning gated (public off unless env/invite/admin).

## 4.2 Gaps (verified or partial)

| ID | Issue | Sev |
|----|-------|-----|
| MT-01 | Isolation is **company-first**; `tenant_id` not on all business tables | High |
| MT-02 | Service role bypasses RLS on public APIs (portal, careers, devices, provision, counterfeit) | Critical residual |
| MT-03 | No automated live RLS negative tests in CI (matrix inventory only; integration skipped) | High |
| MT-04 | Portal/device tokens historically/plaintext columns | High |
| MT-05 | Storage path isolation not verified in repo policies | Medium (Assumed risk) |
| MT-06 | AI/search multi-company context leakage not systematically prevented | Medium |
| MT-07 | Tenant deletion/purge/legal hold process not implemented | Medium |
| MT-08 | Caching layer absent today (reduces shared-cache risk; future Redis must namespace) | Info |

**Cross-tenant conclusion:** Design intent is sound; **assurance incomplete**. One vulnerable service-role handler equals full database compromise.

---

# 5. Authentication Review

| Control | Status | Notes |
|---------|--------|-------|
| Password login | Verified | Supabase Auth |
| Session cookies SSR | Verified | Middleware session refresh |
| Registration / provision | Partial | Gated API + invite |
| MFA | Partial | Profile flags; enforce **opt-in** |
| SSO SAML/OIDC | Not evidenced | Enterprise gap |
| Password policy | Partial | IAM defaults; Supabase config not verified |
| Brute-force / CAPTCHA | Partial / Missing | Rate limits on some APIs; login CAPTCHA not evidenced |
| Password reset (forced) | Hardened | requireApiAuth + dual-control hook |
| Cookie flags | Assumed | Supabase SSR defaults — confirm Secure/HttpOnly in prod |
| Session fixation / idle timeout | Partial | Not fully centralized |

**Industry refs:** OWASP ASVS V2/V3; NIST 800-63B.

---

# 6. Authorization Review

| Control | Status |
|---------|--------|
| RBAC roles/permissions | Verified |
| UI nav gating | Verified |
| Super-admin extras | Restricted to super_administrator slug (fixed) |
| API `requireApiAuth` | Partial — identity, email, print, audit, dual-control; not universal |
| ABAC | Concepts only |
| BOLA on client queries | Relies on RLS |
| Maker-checker | Framework exists; **opt-in** |

**Least privilege:** Service role violates least privilege for public paths by design; mitigate with narrow RPC/functions.

---

# 7. Database Security Report

**Strengths (Verified):** PostgreSQL; extensive RLS; FKs/uniques; soft deletes; audit/event tables; dual-control table (`sec_dual_control_requests`); migrations.

**Weaknesses:**

| ID | Title | Sev | Evidence |
|----|-------|-----|----------|
| DB-01 | No CI proof every table has RLS | High | Inventory test only |
| DB-02 | Service role full access | High | Multiple public routes |
| DB-03 | Secrets/tokens plaintext in DB | High | portal tokens, push_token |
| DB-04 | PII column encryption not systematic | Medium | No field-level crypto inventory |
| DB-05 | Partitioning for events/audit growth not defined | Medium | Schema review |
| DB-06 | Backup encryption / restore SLA | Partial | Supabase managed; drill not evidenced |

---

# 8. API Security Report (OWASP API Top 10)

| Risk | Rating | Notes |
|------|--------|-------|
| API1 BOLA | Medium–High residual | Client IDOR depends on RLS correctness |
| API2 Broken Auth | Medium | Session OK; device tokens weaker |
| API3 BOPLA | Medium | Wide `select('*')` patterns |
| API4 Unrestricted resource | Medium | In-memory rate limits |
| API5 BFLA | Medium | Partial requireApiAuth coverage |
| API6 Business flow | Medium | Payment improved; dual-control opt-in |
| API7 SSRF | Low | Limited outbound fetch |
| API8 Misconfig | Medium | CSP unsafe-inline/eval |
| API9 Inventory | Medium | No complete OpenAPI for all routes |
| API10 Unsafe consumption | Medium | Webhooks present for billing |

**Public attack surface (Verified):** `/api/public/*`, `/api/attendance/devices/*`, `/api/health`, `/portal/*`.

---

# 9. Application Security Report (OWASP Top 10)

| OWASP 2021 | Assessment |
|------------|------------|
| A01 Broken Access Control | Residual High — incomplete API/server enforcement |
| A02 Cryptographic failures | Medium — QR key fail-closed; tokens plaintext |
| A03 Injection | Medium — PostgREST filter hardened on audit; other dynamic filters must stay clean |
| A04 Insecure design | High — client trust + service role + opt-in critical controls |
| A05 Security misconfiguration | Medium — CSP, CI continue-on-error for lint/audit |
| A06 Vulnerable components | **High** — npm audit **44** (2 critical, 19 high) **Verified** |
| A07 Identification failures | High if MFA not enforced in prod |
| A08 Software/data integrity | Medium — limited SBOM/signing |
| A09 Logging failures | Medium — EAL exists; SIEM optional; retention SLAs unclear |
| A10 SSRF | Low |

**Positive remediations verified:** open redirect hardening, identity API authZ, provision gating, middleware fail-closed, payment completion trust gate, audit RBAC, HTML sanitize helpers, security tests.

---

# 10. Frontend Assessment

| Topic | Finding | Sev |
|-------|---------|-----|
| Route protection | Middleware auth for dashboard | OK |
| Client data access | Direct Supabase; RLS is last line | High residual |
| LocalStorage / IDB offline | Offline queue unencrypted | Medium |
| XSS | Some dangerouslySetInnerHTML with partial sanitize | Medium |
| CSP | `unsafe-inline` + `unsafe-eval` | Medium |
| Bundle/performance | ~974 pages — performance risk | Medium |
| Accessibility | Not systematically verified | Medium (compliance) |
| Secret leakage | No NEXT_PUBLIC service role observed | OK |

---

# 11. Backend Assessment

- Next.js Route Handlers mix user JWT clients and admin clients.  
- Domain logic often shared with client packages — blur of trust boundary.  
- Background workers / durable schedulers **not evidenced** as first-class (retries, poison queues).  
- Event emit without guaranteed processing = integrity gap for “event-driven” claims.

---

# 12. Infrastructure Assessment

| Component | Status |
|-----------|--------|
| Vercel | Primary deploy target **Verified** (prior prod deploys) |
| Supabase | Backend **Verified** |
| Docker/K8s | **Not evidenced** in repo |
| WAF | Not codified (Vercel optional) |
| Multi-region HA | Not evidenced |
| Secrets | Env-based; rotation procedure documented in DR doc |
| SSL/HSTS | Headers in middleware/vercel.json |

**Misalignment risk:** Marketing claims of Kubernetes/air-gap readiness without artefacts.

---

# 13. DevSecOps Assessment

| Control | Status |
|---------|--------|
| GitHub Actions CI | Present: typecheck, lint (continue-on-error), tests, audit (continue-on-error) |
| SAST | Not evidenced (CodeQL/Semgrep) |
| DAST | Not evidenced |
| Dependency scanning gate | Audit does not fail pipeline |
| Container scan | N/A (no containers) |
| IaC | Not evidenced |
| Signed releases / SBOM | Not evidenced |

**Severity:** High for enterprise change management (SOC 2 CC8).

---

# 14. Performance Assessment

| Issue | Evidence | Sev |
|-------|----------|-----|
| Client limits ~400 rows | Entity page patterns | Medium |
| Dashboard parallel count queries | Hub pages | Medium |
| No load-test suite | Not evidenced | High for scale claims |
| Rate limiter not distributed | `src/lib/api.ts` Map | Medium |
| No Redis cache | Not evidenced | Medium at scale |
| Monolith page count | ~974 pages | Medium |

**Scale claims (100k tenants / 10M users):** **Not demonstrated** — mark as aspirational, not certified.

---

# 15. AI Security Assessment

| Risk | Status |
|------|--------|
| Many “AI” modules are heuristic/rule engines | Lower LLM risk |
| Prompt injection | Residual if LLM calls added without isolation |
| Cross-tenant context | Must bind strictly to companyId |
| Cost abuse | No token budgets evidenced |
| Human-in-the-loop | Stated for payroll AI; not universal |
| Audit of AI decisions | Partial |

---

# 16. File Storage Assessment

- Upload components exist.  
- Malware scanning **not evidenced**.  
- MIME/size validation **partial / not centralized**.  
- Tenant path isolation **requires bucket policy verification** (Assumed risk).  
- Signed URL TTL policies **not evidenced** in code review.

---

# 17. Event & Notification Engine Review

| Topic | Status |
|-------|--------|
| domain_events table | Verified |
| emit helper/RPC | Verified |
| Consumers / DLQ / idempotency keys | Not evidenced as complete |
| Notification multi-channel | Partial |
| AuthZ on send APIs | Improved (requireApiAuth) |
| Retry / poison messages | Not evidenced |

---

# 18. Compliance Gap Analysis

| Framework | Gap (high level) | Readiness |
|-----------|------------------|-----------|
| ISO 27001 | ISMS, SoA, internal audit, risk treatment records | Low |
| SOC 2 | Change mgmt, logging retention, vendor risk, access reviews | Low |
| GDPR / Uganda DPPA | DSAR automation, DPIA, retention, DPO, breach process | Low–Medium |
| OWASP ASVS L2/L3 | MFA mandatory, full server authZ, crypto inventory | Medium |
| PCI DSS | Only if PAN stored; prefer never store card data | Conditional N/A |
| IFRS | Period lock, dual control, audit trail completeness | Medium |
| NIST CSF | Detect/Respond/Recover weak | Medium |
| CIS Controls | Continuous vuln management incomplete | Medium |

---

# 19. Business Logic Review

| Domain | Control concern | Sev |
|--------|-----------------|-----|
| Billing/AR | Settlement trust improved; fraud if webhook secret weak | High residual |
| Payroll | Engine exists; dual-control not default for release | High |
| Finance GL | Posting authority must be server-enforced | High |
| Inventory/MES | Complex states need invariant tests | Medium |
| Procurement | Approval bypass if only UI gated | High residual |
| Identity | Provision dual-control opt-in | Medium |
| Fraud/counterfeit | Company resolution improved; spam still possible | Medium |

---

# 20. Disaster Recovery Assessment

| Item | Status |
|------|--------|
| DR document | Verified (`docs/DISASTER_RECOVERY.md`) — RPO ≤24h / RTO ≤4h **targets** |
| Restore drill evidence | Not evidenced |
| Failover automation | Not evidenced |
| Multi-region | Not evidenced |
| Incident response playbooks | Partial |

---

# 21. Code Quality Assessment

| Metric | Finding |
|--------|---------|
| Size | Very large UI surface |
| Tests | 9 automated security unit tests; 0 domain tests in `src/` |
| Complexity | High; duplicated CRUD entity patterns |
| Docs | Improving (security/DR/runbooks) |
| Error handling | Inconsistent across modules |
| Technical debt | High — breadth over depth of assurance |

---

# 22. Detailed Risk Register (selected findings)

### FINDING F-001

| Field | Content |
|-------|---------|
| **ID** | F-001 |
| **Category** | Multi-tenant / Data security |
| **Title** | Service-role public endpoints expand blast radius to full database |
| **Description** | Routes under `/api/public/*` and device ingest use `createAdminClient()` (service role), bypassing RLS. Correctness depends entirely on application filtering. |
| **Evidence** | Verified: portal, careers apply, provision, billing webhook, counterfeit, attendance integrations import admin client |
| **Modules** | Platform, Billing, Talent, Attendance |
| **Risk type** | Confidentiality, Integrity |
| **Severity** | **Critical** (residual) |
| **CVSS v3.1** | 9.1 (AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:N) if any public handler logic fails |
| **Likelihood** | Medium (depends on future code defects) |
| **Business impact** | Cross-tenant data breach, regulatory fines, customer termination |
| **Technical impact** | Full table access |
| **Exploitation scenario** | Attacker finds logic bug in token/company resolution on a service-role route and reads/writes other tenants’ data |
| **Root cause** | Convenience of service role vs least-privilege RPCs |
| **Reference** | OWASP A01; NIST AC-3/AC-6; CSA CCM |
| **Remediation** | Replace with SECURITY DEFINER RPCs scoped to single company; row-limited; no broad service role from edge |
| **Priority** | Immediate |
| **Effort** | L (weeks) |
| **Verification** | Attempt cross-company access via each public route; expect deny |
| **Residual risk** | Low if RPCs + review gates |

---

### FINDING F-002

| Field | Content |
|-------|---------|
| **ID** | F-002 |
| **Category** | Authorization |
| **Title** | Client-side Supabase mutations rely on RLS as sole enforcement |
| **Description** | Business operations (finance, payroll UI, inventory) largely run from the browser with user JWT. Complex dual-control/ABAC cannot be reliably enforced. |
| **Evidence** | Verified architecture pattern across dashboard modules using `createClient()` |
| **Severity** | **High** |
| **CVSS** | 7.5 (context-dependent) |
| **Likelihood** | Medium |
| **Business impact** | Fraud, unauthorized postings if RLS gaps |
| **Exploitation scenario** | Authenticated low-privilege user crafts API calls to mutate objects if policies incomplete |
| **Root cause** | Speed of development; RLS-only design |
| **Reference** | OWASP API1/API5; ASVS V4 |
| **Remediation** | Server services for money/identity/inventory postings; deny direct table grants where needed |
| **Priority** | Immediate–30 days |
| **Effort** | L |
| **Residual risk** | Medium until complete |

---

### FINDING F-003

| Field | Content |
|-------|---------|
| **ID** | F-003 |
| **Category** | Authentication |
| **Title** | MFA enforcement for privileged roles is opt-in |
| **Description** | `MFA_ENFORCE_PRIVILEGED` must be explicitly true. Privileged role profiles get `require_mfa` flags, but APIs only block when env enabled and MFA not active. |
| **Evidence** | Verified `src/lib/security/api-auth.ts`; migration sets flags |
| **Severity** | **High** (for regulated prod) |
| **CVSS** | 8.1 if accounts without MFA compromised |
| **Likelihood** | Medium |
| **Business impact** | Account takeover of finance/payroll admins |
| **Root cause** | Operational caution to avoid lockout |
| **Reference** | NIST 800-63B; ISO 27001 A.5.17 |
| **Remediation** | Enroll MFA → set env true → monitor MFA_REQUIRED rates |
| **Priority** | Immediate (config) |
| **Effort** | S–M |
| **Residual risk** | Low after enforce |

---

### FINDING F-004

| Field | Content |
|-------|---------|
| **ID** | F-004 |
| **Category** | Business logic / Finance |
| **Title** | Dual-control framework exists but is opt-in |
| **Description** | `DUAL_CONTROL_REQUIRED` defaults off. Identity APIs support `dual_control_id` but only enforce when env set. |
| **Evidence** | Verified `dual-control.ts`, identity routes |
| **Severity** | **High** |
| **CVSS** | N/A (control deficiency) |
| **Business impact** | Single actor can provision users / reset passwords when dual-control off |
| **Reference** | SOC 2 CC6; IFRS segregation of duties |
| **Remediation** | Enable dual-control for identity, payroll release, bank files, GL post |
| **Priority** | Immediate–30 days |
| **Effort** | M |

---

### FINDING F-005

| Field | Content |
|-------|---------|
| **ID** | F-005 |
| **Category** | Supply chain |
| **Title** | npm audit reports 44 vulnerabilities (2 critical, 19 high) |
| **Evidence** | Verified `npm audit` output at assessment time |
| **Severity** | **High** |
| **CVSS** | Component-dependent (critical chain often transitive) |
| **Business impact** | Supply-chain compromise, compliance fail |
| **Remediation** | Upgrade Sentry/Next/sharp carefully; fail CI on high+ |
| **Priority** | Immediate |
| **Effort** | M |

---

### FINDING F-006

| Field | Content |
|-------|---------|
| **ID** | F-006 |
| **Category** | Quality / Assurance |
| **Title** | Insufficient automated test coverage for business domain |
| **Evidence** | Verified: 0 tests under `src/`; 9 security unit tests under `tests/` |
| **Severity** | **High** |
| **Business impact** | Regressions in payroll/finance; inability to prove controls |
| **Remediation** | Critical-path unit + e2e for payroll, payments, RLS negatives |
| **Priority** | Immediate–30 days |
| **Effort** | L |

---

### FINDING F-007

| Field | Content |
|-------|---------|
| **ID** | F-007 |
| **Category** | DevSecOps |
| **Title** | CI does not fail on lint or npm audit |
| **Evidence** | Verified `continue-on-error: true` on lint and audit in CI |
| **Severity** | **Medium** |
| **Remediation** | Fail pipeline on high vulnerabilities and type errors only after green baseline |
| **Priority** | 30 days |
| **Effort** | S |

---

### FINDING F-008

| Field | Content |
|-------|---------|
| **ID** | F-008 |
| **Category** | Cryptography / Tokens |
| **Title** | Long-lived access tokens for portal/devices stored/used as secrets |
| **Evidence** | Portal access_token; att push_token equality lookup |
| **Severity** | **High** |
| **Remediation** | Hash at rest; rotate; header-only device auth; high entropy |
| **Priority** | 30 days |
| **Effort** | M |

---

### FINDING F-009

| Field | Content |
|-------|---------|
| **ID** | F-009 |
| **Category** | Application security |
| **Title** | CSP allows unsafe-inline and unsafe-eval |
| **Evidence** | Verified middleware CSP string |
| **Severity** | **Medium** |
| **CVSS** | 6.1 class with XSS chain |
| **Remediation** | Nonces; remove eval; Trusted Types |
| **Priority** | 30–90 days |
| **Effort** | M |

---

### FINDING F-010

| Field | Content |
|-------|---------|
| **ID** | F-010 |
| **Category** | Event architecture |
| **Title** | Event bus without complete consumer reliability model |
| **Evidence** | domain_events present; DLQ/idempotent consumers not evidenced |
| **Severity** | **Medium** |
| **Business impact** | Missed notifications, inconsistent workflows |
| **Remediation** | Workers, idempotency keys, DLQ, metrics |
| **Priority** | 90 days |
| **Effort** | L |

---

### FINDING F-011

| Field | Content |
|-------|---------|
| **ID** | F-011 |
| **Category** | Performance / Scalability |
| **Title** | Enterprise scale claims not backed by performance evidence |
| **Evidence** | No k6/load reports; client list limits |
| **Severity** | **Medium** (High if marketed as fact) |
| **Remediation** | Load test pack; pagination; indexes; SLOs |
| **Priority** | 90 days |
| **Effort** | L |

---

### FINDING F-012

| Field | Content |
|-------|---------|
| **ID** | F-012 |
| **Category** | Compliance |
| **Title** | Lack of formal privacy program artefacts (DPIA, DSAR, retention) |
| **Evidence** | Product consent fields exist; program artefacts not in repo |
| **Severity** | **High** for EU/Uganda multi-tenant |
| **Remediation** | DPIA, DSAR workflow, retention jobs, DPO |
| **Priority** | 30–90 days |
| **Effort** | L |

---

### FINDING F-013

| Field | Content |
|-------|---------|
| **ID** | F-013 |
| **Category** | Operations / DR |
| **Title** | DR targets documented but restore drills not evidenced |
| **Evidence** | `DISASTER_RECOVERY.md` present; no drill records |
| **Severity** | **High** |
| **Remediation** | Quarterly restore; measure RTO/RPO |
| **Priority** | 30 days |
| **Effort** | M |

---

### FINDING F-014

| Field | Content |
|-------|---------|
| **ID** | F-014 |
| **Category** | Offline / Mobile |
| **Title** | Offline IndexedDB queue stores business mutations unencrypted |
| **Evidence** | `src/lib/offline/db.ts` |
| **Severity** | **Medium** |
| **Remediation** | Encrypt at rest; remote wipe; device posture |
| **Priority** | 90 days |
| **Effort** | M |

---

### FINDING F-015

| Field | Content |
|-------|---------|
| **ID** | F-015 |
| **Category** | Rate limiting |
| **Title** | In-memory rate limits ineffective across serverless instances |
| **Evidence** | `src/lib/api.ts` Map buckets |
| **Severity** | **Medium** |
| **Remediation** | Upstash/Redis shared limiter |
| **Priority** | 30 days |
| **Effort** | M |

---

*Additional lower-severity findings (CSP detail, health info leakage residual, naming debt, accessibility) available on request; top 15 drive the decision.*

---

# 23. Risk Register Summary (Prioritized)

| Rank | ID | Sev | Title | Priority |
|------|-----|-----|-------|----------|
| 1 | F-001 | Critical residual | Service-role public blast radius | Immediate |
| 2 | F-002 | High | Client RLS-only trust | Immediate |
| 3 | F-005 | High | Dependency CVEs | Immediate |
| 4 | F-003 | High | MFA opt-in | Immediate (config) |
| 5 | F-004 | High | Dual-control opt-in | Immediate–30d |
| 6 | F-006 | High | Lack of domain tests | Immediate–30d |
| 7 | F-008 | High | Token secrecy | 30d |
| 8 | F-012 | High | Privacy compliance | 30–90d |
| 9 | F-013 | High | DR drills | 30d |
| 10 | F-007 | Medium | CI soft-fail audit | 30d |
| 11 | F-009 | Medium | Weak CSP | 30–90d |
| 12 | F-010 | Medium | Event consumers | 90d |
| 13 | F-011 | Medium | Scale evidence | 90d |
| 14 | F-014 | Medium | Offline encryption | 90d |
| 15 | F-015 | Medium | Distributed rate limit | 30d |

---

# 24. Remediation Roadmap

## Immediate (0–14 days)

1. Enable `MFA_ENFORCE_PRIVILEGED=true` after enrollment.  
2. Enable `DUAL_CONTROL_REQUIRED=true` for identity/payroll/finance.  
3. Fail CI on `npm audit --audit-level=high` after triaging.  
4. Upgrade critical dependencies.  
5. External pen-test of public routes + RLS.  
6. Production: `PAYMENT_SANDBOX=false`; webhook secrets set.  
7. First formal restore drill.  

## 30 days

1. Server-side services for payments, payroll release, GL post.  
2. Hash portal/device tokens.  
3. Redis rate limiting.  
4. Domain unit tests for tax/payroll/inventory invariants.  
5. Remove CI `continue-on-error` for audit.  
6. DSAR/retention draft procedures.  

## 90 days

1. Event workers + DLQ.  
2. CSP nonces.  
3. Load testing + index tuning.  
4. SSO pilot.  
5. SOC 2 Type I readiness gap close.  

## 6 months

1. ISO 27001 program.  
2. Multi-region DR.  
3. Optional extract of identity/payments services.  
4. Continuous red-team / bug bounty.  

---

# 25. Final Production Recommendation

## Decision: **GO WITH CONDITIONS** for a **controlled single-tenant (or single-group) pilot**

## Decision: **NO-GO** for:

- Open multi-tenant commercial SaaS with untrusted tenants  
- Government / classified / air-gapped production  
- Environments requiring SOC 2 Type II / ISO 27001 certificate **today**  
- Environments processing cardholder data without PCI-scoped architecture  

### Conditions for pilot GO

1. MFA enforced for all privileged roles.  
2. Dual-control enabled for identity + money movement.  
3. Public provision closed; payment sandbox off.  
4. CI green; critical npm issues triaged.  
5. Written risk acceptance by business owner for residual F-001/F-002 until server-side services land.  
6. Monitoring/on-call for Vercel + Supabase.  
7. Pen-test of public surfaces scheduled within 30 days of pilot.  

### Board one-liner

> SecureTrack ERP is a **capable modular ERP foundation** with recent, material security hardening, but it has **not yet achieved the assurance depth** required for untrusted multi-tenant or highly regulated production. A **gated pilot** is appropriate; **unrestricted enterprise SaaS launch is not**.

---

# Appendix A — Positive controls (credit)

- Company-scoped RLS pattern at scale  
- Platform multi-tenant model and switcher  
- Fail-closed middleware  
- Identity/email/print/audit API hardening  
- Payment completion trust gates + billing webhook  
- Dual-control schema and API  
- Security unit tests + CI skeleton  
- DR and production hardening documentation  
- Rate limits on several public endpoints  
- Soft-delete / audit / EAL modules  

---

# Appendix B — Assessment limitations

This audit is **code- and configuration-based**. It does **not** replace:

- Third-party penetration testing  
- Supabase project configuration review (Auth MFA settings, network restrictions)  
- Vercel Firewall / DDoS configuration review  
- Legal review of privacy notices  
- Financial controls walkthrough with process owners  

Findings marked **Assumed** or **Not evidenced** require further validation before risk closure.

---

**Document end.**  
*Independent composite audit — SecureTrack ERP — 2026-07-30*
