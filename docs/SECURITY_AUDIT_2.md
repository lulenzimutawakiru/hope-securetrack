# SecureTrack ERP — Security Assessment Round 2

**Date:** 2026-07-30  
**Scope:** Residual risk after Round 1 remediations + deeper API, portal, devices, deps  
**Prior audit:** `docs/SECURITY_AUDIT.md` (C1–C4 / H1–H5 largely fixed)

Severity: **Critical** · **High** · **Medium** · **Low** · **Info**

---

## Executive summary

Round 1 closed the worst identity/provisioning holes. Round 2 found **new Critical/High** issues:

1. **Demo payment completion** marks invoices paid without real MoMo/card settlement.  
2. **PostgREST filter injection** via unsanitized search in audit events API.  
3. **Cross-tenant `company_id` override** on SIEM flush / audit write APIs.  
4. **Missing RBAC** on sensitive audit/SIEM REST endpoints.  
5. **Customer portal** not on public middleware allowlist (broken for external customers) and payment path is unsafe if exposed.  
6. **npm audit:** 44 issues (2 critical, 19 high) — mostly transitive (Sentry/OpenTelemetry, postcss/next, sharp, rollup).

---

## Critical

### C2-1. Client-side “pay online” completes payment without gateway proof

**Files:**  
- `src/app/portal/[token]/page.tsx` (`payOnline` → `completePaymentIntent`)  
- `src/lib/billing/gateway.ts`

```ts
// Demo: complete immediately for MoMo-style sandbox
await completePaymentIntent(supabase, String(intent.external_ref));
```

**Impact:** Anyone who can invoke this path can mark invoices **paid** without MTN/Airtel/bank confirmation → revenue fraud, false AR, audit integrity failure.

**Fix:**

- Never call `completePaymentIntent` from the browser for real money.  
- Only complete via **webhook** signed by gateway (or server worker after verify).  
- Gate demo mode behind `PAYMENT_SANDBOX=true` and non-production env.  
- Server-side amount/invoice ownership checks before status change.

---

### C2-2. PostgREST / filter injection in audit event search

**File:** `src/app/api/audit/events/route.ts`

```ts
query = query.or(
  `audit_id.ilike.%${q}%,action.ilike.%${q}%,...`
);
```

User-controlled `q` is interpolated into the PostgREST filter string.

**Impact:** Filter injection — break out of `ilike` clauses, alter query logic, potentially read unintended rows (within RLS) or cause errors/DoS. Classic Supabase `.or()` injection class.

**Fix:**

```ts
// Escape or use parameterized filters only
const safe = q.replace(/[%_,.()]/g, "");
// or .textSearch / separate .ilike per column without raw .or string build
```

Reject characters: `,().` and control wildcards carefully.

---

## High

### H2-1. Cross-tenant `company_id` body override (IDOR-class)

**Files:**

| Route | Issue |
|-------|--------|
| `api/audit/siem` POST | `companyId = body.company_id \|\| profile?.company_id` then `flushSiemOutbox(companyId)` |
| `api/audit/events` POST | `company_id = body.company_id \|\| profile?.company_id` |

**Impact:** If RLS/service paths allow, attacker may flush SIEM or write audit events under **another company_id**. Even with RLS, spoofed company_id pollutes integrity logs / may hit super_admin paths.

**Fix:** Always set `company_id` from session (`ctx.companyId`) only. Ignore body `company_id` unless platform admin with explicit allow-list.

---

### H2-2. Audit / SIEM APIs lack permission checks

**Files:** `api/audit/events`, `api/audit/reports`, `api/audit/siem`

Only `getUser()` — **any** authenticated employee can:

- List enterprise audit events  
- List SIEM connectors & pending outbox counts  
- Trigger SIEM flush  
- Run audit reports  

**Impact:** Sensitive security telemetry and SIEM config exposure; possible outbox spam.

**Fix:** `requireApiAuth({ permissions: ['eal.view','audit.view','eal.export', ...] })`.

---

### H2-3. Customer portal authentication model broken / dangerous

**Files:** `src/middleware.ts`, `src/app/portal/[token]/page.tsx`

1. `/portal/*` is **not** a public route → external customers are redirected to **staff login**.  
2. Portal uses **anon browser Supabase** + `access_token` on `bill_portal_users`.  
3. RLS is company-scoped for authenticated staff only (comment admits public should be service-role API — not implemented).  
4. Combined with C2-1, fixing public access without fixing payment = critical fraud.

**Impact:** Broken external portal **or** (if later made public without service-role design) token-guessable invoice access + free payment complete.

**Fix:** Dedicated `/api/public/portal/*` with service role, hashed tokens, rate limits; never complete payments client-side.

---

### H2-4. Dependency vulnerabilities (npm audit)

```
44 vulnerabilities (23 moderate, 19 high, 2 critical)
```

Notable (full tree includes Sentry → OpenTelemetry, Next → postcss, sharp, rollup, brace-expansion).

**Prod tree** still pulls many moderate issues via `@sentry/nextjs`.

**Fix:**

```bash
npm audit
npm update @sentry/nextjs sharp
# Carefully: avoid --force breaking Next major
```

Track GHSA for next/postcss/sharp in CI.

---

## Medium

### M2-1. Unauthenticated ZKTeco options GET

**File:** `api/attendance/devices/zkteco/iclock` GET  

Returns device protocol options (`Realtime=1`, `Encrypt=0`) **without token**.

**Impact:** Recon for device integration surface; confirms endpoint presence.

**Fix:** Require token/SN validation on GET or return minimal OK only.

---

### M2-2. Device push tokens plaintext + query string

**Files:** device routes, `resolveCompanyByToken` equality on `push_token` column.

**Impact:** Tokens in access logs/CDN logs; DB breach exposes all device auth; not hashed; no rotation UI enforced.

**Fix:** Store HMAC/hash of token; header-only auth; optional IP allowlist.

---

### M2-3. Invite secret comparison not constant-time

**File:** `api/public/platform/provision`  

`invite_code === secret` timing-sensitive for long secrets.

**Fix:** `crypto.timingSafeEqual` on equal-length buffers.

---

### M2-4. Residual password return on IAM APIs

`return_password=true` still allowed for `iam.manage` — useful for break-glass but enables shoulder-surfing / proxy logging of secrets.

**Fix:** Prefer one-time magic link / email; log every password-return; short TTL.

---

### M2-5. CSP still allows `'unsafe-inline'` and `'unsafe-eval'`

**File:** `middleware.ts`  

Weakens XSS mitigation from Round 1 sanitization.

**Fix:** Nonces for scripts; remove `unsafe-eval` if no required libs need it.

---

### M2-6. In-memory rate limits remain multi-instance weak

Still per-serverless-instance; attackers can parallelize across regions.

---

### M2-7. Login history insert spam

After Round 1, insert allows `user_id IS NULL` — unauthenticated… actually needs auth for most APIs; login page uses RPC. Residual: authenticated user may insert fake rows with `user_id = self` only — low.

---

### M2-8. Print security page still uses raw HTML inject

`print/security` builds HTML from overlay + `sampleHash` — lower risk if overlay is admin-controlled only.

---

### M2-9. QR encryption key missing = empty AES key material

**File:** `src/lib/crypto/encryption.ts`  

If `QR_ENCRYPTION_KEY` unset, `getKeyBytes()` may produce empty/weak key.

**Fix:** Fail closed if key missing or wrong length (32 bytes).

---

### M2-10. Offline IndexedDB unencrypted

Local payroll/offline queues may hold business data on shared devices.

---

## Low / Info

| ID | Finding |
|----|---------|
| L2-1 | ZKTeco GET `Encrypt=0` encourages cleartext device protocol |
| L2-2 | Health still exposes `uptimeSec` / version (recon) |
| L2-3 | Platform provisioning UI still posts to public API (gated — OK) |
| L2-4 | `activateProvisionRequest` still sends ignored `actor_id` in body (server uses session — OK) |
| I2-1 | Round 1 fixes verified present in identity/email/middleware |
| I2-2 | `.env*` gitignored |

---

## Attack scenarios (round 2)

1. **AR fraud:** Access portal (if staff or if portal opened) → Pay Online → invoice paid with no money.  
2. **Audit tamper/noise:** Authenticated user POSTs audit events with victim `company_id` / spoofed severity.  
3. **Filter injection:** Craft `q` to manipulate PostgREST filters on `/api/audit/events`.  
4. **Device recon:** Probe `/api/attendance/devices/*` and iclock GET.  
5. **Supply chain:** Exploit unpatched sharp/postcss/sentry chain in CI or runtime.

---

## Priority remediation plan (Round 2)

| Priority | Item | Status |
|----------|------|--------|
| P0 | C2-1 Disable client payment complete; webhook-only | **Fixed** (`completePaymentIntent` trusted only; webhook + sandbox) |
| P0 | C2-2 Sanitize audit search filters | **Fixed** (`sanitizePostgrestFilter`) |
| P1 | H2-1 Strip body company_id overrides | **Fixed** |
| P1 | H2-2 requireApiAuth on audit/SIEM routes | **Fixed** |
| P1 | H2-3 Portal: public API + no client settle | **Fixed** (`/api/public/portal`, middleware public `/portal`) |
| P1 | H2-4 npm audit high/critical deps | **Open** — run `npm audit` / upgrade Sentry carefully |
| P2 | M2-1 iclock GET token | **Fixed** |
| P2 | M2-3 timing-safe invite | **Fixed** |
| P2 | M2-9 QR key fail-closed | **Fixed** |

### New env vars

| Variable | Purpose |
|----------|---------|
| `PAYMENT_SANDBOX=true` | Allow demo settlement only when set |
| `BILLING_WEBHOOK_SECRET` | Shared secret for `POST /api/public/billing/webhook` |
| `QR_ENCRYPTION_KEY` | Required 64-char hex (32 bytes) for AES-GCM |

---

## What Round 1 still covers well

- Identity password reset / provision authZ  
- Public tenant provision gated  
- Middleware fail-closed  
- Email open-relay permission checks  
- Login open-redirect fixed  
- Super-admin permission inflation fixed  

---

## Out of scope

- Live Supabase Auth settings (leaked password, MFA enrollment)  
- Network WAF / Vercel Firewall rules  
- Full DAST / authenticated pentest  
- Edge Function JWT verification configs  
