# SecureTrack ERP — Security Vulnerability Assessment

**Date:** 2026-07-30  
**Scope:** Application code (`src/`), API routes, middleware, RLS policies, public surfaces  
**Method:** Static code review (no live penetration test)  
**Remediation status:** Critical / High / Medium items fixed in code (migration `00066` + API/middleware patches)

Severity: **Critical** · **High** · **Medium** · **Low** · **Info**

---

## Executive summary

Several **critical** issues allow privilege escalation or unauthenticated tenant/admin creation. Multiple **high** issues enable email abuse and over-privileged client permission grants. Public APIs use the Supabase **service role** without consistent rate limiting or abuse controls.

**Recommended immediate actions:**

1. Lock down `/api/identity/reset-password` and `/api/identity/provision` (auth + RBAC + never return plaintext passwords over JSON without secure channel).
2. Disable or protect public tenant provisioning (`/api/public/platform/provision`) with CAPTCHA, invite tokens, or platform-admin-only.
3. Fix open-redirect on login `next` parameter.
4. Stop granting full `SUPER_ADMIN_EXTRAS` when `permissions.length === 0`.
5. Add permission checks on email/notification dispatch APIs.

---

## Critical

### C1. Unauthenticated privilege design: password reset API returns temp password

**File:** `src/app/api/identity/reset-password/route.ts`

- Uses `createAdminClient()` (service role) with **no** `getUser()` / permission check inside the handler.
- Middleware only requires *any* signed-in user (not IAM admin).
- Accepts arbitrary `user_id` and returns **`temp_password` in the JSON response**.
- `actor_id` / `company_id` are client-supplied (spoofable).

**Impact:** Any authenticated user can reset any account password and take over the account.

**Fix:**

```ts
// Require session + iam.manage / users.manage
// Verify target user is in same company (unless platform admin)
// Do not return password in API; send via secure channel / force reset link
// Bind actor_id = session.user.id only
```

---

### C2. User provisioning API without authorization

**File:** `src/app/api/identity/provision/route.ts`

- Service role creates/updates Auth users and profiles.
- No server-side permission verification.
- Enumerates users via `listUsers({ perPage: 1000 })`.
- Likely returns or stores temporary credentials.

**Impact:** Account takeover / creation of privileged users by low-privilege sessions.

**Fix:** Require `iam.manage` + company scope; use `getUserByEmail` instead of listing 1000 users; enforce approval status server-side.

---

### C3. Public tenant auto-provisioning (unauthenticated)

**File:** `src/app/api/public/platform/provision/route.ts`  
**Surface:** `POST /api/public/platform/provision`, `/register`

- Fully public (middleware allowlist).
- Uses service role to create **tenant, company, subscription, modules, admin Auth user**.
- No rate limit, CAPTCHA, invite token, or billing verification.
- Accepts `plan_code: "enterprise" | "government"`.

**Impact:** Unlimited free tenants, admin accounts, resource exhaustion, possible abuse as Auth user factory.

**Fix:**

- Default **off** in production (`PROVISIONING_PUBLIC=false`).
- Require signed invite / Stripe checkout / platform admin secret.
- Rate limit by IP + email domain allowlist.
- Never create government plan via public form.

---

### C4. Middleware fail-open for page routes

**File:** `src/middleware.ts` (catch block)

```ts
return NextResponse.next({ request }); // pages proceed without auth
```

**Impact:** If Supabase session update throws, unauthenticated users may reach dashboard HTML/routes.

**Fix:** Fail closed — redirect to `/login` or return 503.

---

## High

### H1. Client-side super-admin permission inflation

**File:** `src/hooks/use-user.ts` → `enrichPermissions`

```ts
if (roleSlug === "super_administrator" || permissions.includes("settings.manage") || permissions.length === 0) {
  permissions = [...permissions, ...SUPER_ADMIN_EXTRAS];
}
```

**Impact:** Users with **empty** role permissions (mis-seeded roles) get full nav/API-visible permission set in the client. UI-only in some places, but many pages gate only on this list.

**Fix:** Remove `permissions.length === 0` branch. Never elevate on missing data — fail closed.

---

### H2. Open email relay (authenticated)

**Files:**

- `src/app/api/email/send/route.ts`
- `src/app/api/notifications/dispatch/route.ts`
- `src/app/api/notifications/send/route.ts`

Any logged-in user can send email to arbitrary addresses with custom HTML (if Resend configured). No role check (`communications.manage`, etc.).

**Impact:** Spam, phishing from your domain, cost abuse.

**Fix:** Require permission; restrict `to` domains; strip HTML or use allowlisted templates only; rate limit.

---

### H3. Open redirect after login

**File:** `src/app/login/page.tsx`

```ts
router.push(next && next.startsWith("/") ? next : "/dashboard");
```

`//evil.com` starts with `/` → protocol-relative redirect to attacker site.

**Fix:** Allow only paths matching `^/[a-zA-Z0-9/_-]*$` and reject `//`.

---

### H4. Service role on public endpoints without abuse controls

| Endpoint | Risk |
|----------|------|
| `/api/public/careers/apply` | Spam applications, DB fill (no rate limit) |
| `/api/public/report-counterfeit` | Fraud alert spam; fixed company_id |
| `/api/attendance/devices/*` | Token auth OK; tokens in query string (logs) |

**Fix:** Shared rate limiter (Redis); CAPTCHA on careers; move tokens to headers only.

---

### H5. Provisioning jobs RLS insert open

**File:** migration `00065` — `provision_jobs_insert` **WITH CHECK (true)**

**Impact:** Any authenticated client can insert fake provisioning job rows.

**Fix:** Restrict insert to service role / platform admin only.

---

## Medium

### M1. Stored XSS via `dangerouslySetInnerHTML`

**Files:**

- `src/app/dashboard/communications/messages/[id]/page.tsx`
- `src/app/dashboard/branding/email/page.tsx`
- `src/app/dashboard/print/security/page.tsx`

HTML from DB rendered without sanitization (DOMPurify).

**Impact:** XSS if attacker can write message/template HTML (compromised account or XSS chain).

**Fix:** Sanitize with DOMPurify; CSP `script-src 'self'`.

---

### M2. Missing Content-Security-Policy

Middleware sets nosniff, X-Frame-Options, Referrer-Policy only.

**Fix:** Add CSP, HSTS (production), `Permissions-Policy`.

---

### M3. In-memory rate limiting only

**File:** `src/lib/api.ts` — per-instance Map.

**Impact:** Bypass under multi-instance / serverless concurrency; only used on verify path.

---

### M4. Device tokens in query strings

ZKTeco push: `?token=` appears in access logs, browser history, referrers.

**Fix:** Header-only auth; rotate tokens; IP allowlist.

---

### M5. Password history uses non-cryptographic hash

**File:** `src/lib/idm/password.ts` → `simpleHashHint`

Documented as non-crypto; must never be used for authentication comparison of real passwords.

---

### M6. Health endpoint information disclosure

**File:** `src/app/api/health/route.ts` returns `missing` env var names when misconfigured.

**Impact:** Aids reconnaissance (low).

---

### M7. Hardcoded demo password placeholder

**File:** `src/app/dashboard/print/codes/page.tsx` — `password: "secure"`

UI default; ensure not used as real credential.

---

### M8. Cross-tenant risk if `company_id` client-controlled

Many UI CRUD paths set `company_id` from `auth.profile.company_id` (good). Service-role routes that accept body `company_id` must re-validate membership.

---

## Low / Info

| ID | Finding |
|----|---------|
| L1 | Permissions catalog world-readable (`USING (true)`) — expected for RBAC UI |
| L2 | Platform plans/modules/flags readable by all authenticated — low sensitivity |
| L3 | Package name still `hope-securetrack` — branding only |
| L4 | PWA offline DB name `hope-securetrack-offline` |
| I1 | `.env*` gitignored — good |
| I2 | Service role correctly server-only (not `NEXT_PUBLIC_`) |

---

## Positive controls observed

- Most dashboard APIs call `supabase.auth.getUser()`.
- Operational tables generally use `company_id` RLS via `user_company_id()`.
- Public verify path has IP rate limiting.
- Device push endpoints require integration token.
- Careers apply validates vacancy is `open` + `publish_external`.
- Soft-delete and audit patterns exist in modules.

---

## Priority remediation plan

| Priority | Item | Status |
|----------|------|--------|
| P0 | C1 password reset authZ | **Fixed** |
| P0 | C2 identity provision authZ | **Fixed** |
| P0 | C3 disable public provision / gate it | **Fixed** (env gate + invite + rate limit) |
| P0 | C4 middleware fail-closed | **Fixed** |
| P1 | H1 permission inflation | **Fixed** |
| P1 | H2 email permission + rate limit | **Fixed** |
| P1 | H3 open redirect | **Fixed** |
| P2 | M1 HTML sanitize + CSP | **Fixed** (basic sanitize + CSP headers) |
| P2 | M3 Redis rate limits | Partial (in-memory; Redis still recommended for multi-region) |

### Env flags for operators

| Variable | Purpose |
|----------|---------|
| `PLATFORM_PROVISIONING_PUBLIC=true` | Open SaaS signup (default: **on**; set `false` to close) |
| `PLATFORM_PROVISIONING_SECRET` | Invite code for closed registration |
| `DEFAULT_COMPANY_ID` | Counterfeit report company scope |

---

## Out of scope (not fully audited)

- Live Supabase project configuration (Auth MFA, leaked password protection)
- Edge Functions JWT verification settings
- Vercel / network WAF rules
- Dependency CVEs (`npm audit`)
- Mobile PWA offline store encryption
- Physical device token entropy in production DB

Run: `npm audit` and Supabase Auth security advisor for complementary coverage.
