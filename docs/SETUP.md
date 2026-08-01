# Setup & Deployment Guide

## Quick Start (Local)

```bash
npm install
cp .env.example .env.local
# Fill NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, etc.
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## With Local Supabase

```bash
npx supabase start
npx supabase db reset   # migrations + seed
npm run dev
```

## GitHub Actions & Secrets

### Required Repository Secrets

Add these in **Settings → Secrets & variables → Actions** or use `gh secret set`:

| Secret | Purpose | Example |
|--------|---------|---------|
| NEXT_PUBLIC_SUPABASE_URL | Supabase project URL | https://xyz.supabase.co |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | Supabase public key | eyJhbGciOiJIUzI1NiIs… |
| QR_ENCRYPTION_KEY | Symmetric encryption key (base64) | base64-encoded-32-bytes |
| QR_SIGNING_PRIVATE_KEY | RSA private key for QR tokens | -----BEGIN PRIVATE KEY----- … |
| QR_SIGNING_PUBLIC_KEY | RSA public key for verification | -----BEGIN PUBLIC KEY----- … |
| PROD_URL (optional) | Production URL for synthetic monitor | https://hope-securetrack.vercel.app |

### Set Secrets via gh CLI

```bash
gh secret set NEXT_PUBLIC_SUPABASE_URL --body "https://your-project.supabase.co"
gh secret set NEXT_PUBLIC_SUPABASE_ANON_KEY --body "ANON_KEY"
gh secret set QR_ENCRYPTION_KEY --body "BASE64_KEY"
gh secret set QR_SIGNING_PRIVATE_KEY --body "$(cat qr_private.pem)"
gh secret set QR_SIGNING_PUBLIC_KEY --body "$(cat qr_public.pem)"
gh secret set PROD_URL --body "https://hope-securetrack.vercel.app"
```

### Generate QR Signing Keys (if not available)

**Node.js:**
```bash
node scripts/generate-keys.mjs
# Outputs qr_private.pem and qr_public.pem
```

**OpenSSL:**
```bash
openssl genpkey -algorithm RSA -out qr_private.pem -pkeyopt rsa_keygen_bits:2048
openssl rsa -pubout -in qr_private.pem -out qr_public.pem
```

**Encryption key (32 bytes, base64):**
```bash
# Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

# OpenSSL
openssl rand -base64 32
```

### Workflows

#### E2E Tests (.github/workflows/e2e.yml)
- Triggered on: Pull requests, manual dispatch
- Runs: npm run test:e2e (Playwright)
- Requires: All 5 secrets above
- Status: Requires GitHub Actions billing/quota to be active

#### Synthetic Monitor (.github/workflows/synthetic-monitor.yml)
- Triggered: Hourly (0 * * * *)
- Runs: HTTP health check against /api/health
- Requires: PROD_URL secret (optional; defaults to public URL)

#### CI Pipeline (npm run ci)
- Runs on: Main branch pushes (configure in .github/workflows/ as needed)
- Steps: typecheck → check:secrets → test → audit → SBOM
- Ensures no missing secrets before deployment

### Verify Secrets Locally

```bash
npm run check:secrets
# Fails with exit code 1 if any required secrets are missing
```

## Deployment (Vercel + Supabase)

### 1. Create Supabase Project

```bash
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push
# (or paste supabase/seed.sql in SQL Editor for data)
```

### 2. Set Supabase Secrets (Edge Functions)

```bash
npx supabase secrets set QR_ENCRYPTION_KEY=...
npx supabase secrets set QR_SIGNING_PRIVATE_KEY=...
npx supabase secrets set QR_SIGNING_PUBLIC_KEY=...
npx supabase functions deploy verify --no-verify-jwt
npx supabase functions deploy generate-qr
npx supabase functions deploy cartonize
```

### 3. Deploy to Vercel

```bash
npx vercel login
npx vercel
# Set environment variables in dashboard or CLI
npx vercel --prod
```

### 4. Bootstrap Admin User

```sql
-- In Supabase SQL Editor:
-- Use auth.users to create a user, then:
UPDATE user_profiles SET role_id = 'admin' WHERE id = '...';
```

Or run:
```bash
# Scripts available in scripts/bootstrap-admin.sql
```

### One-liner Deploy

```powershell
.\scripts\deploy.ps1 -Prod
```

## Security Notes

- **Rotate signing keys periodically** — generate new RSA pair and update Supabase + GitHub secrets.
- **Store private keys securely** — never commit qr_private.pem to git.
- **Use GitHub Environments** for production secrets with required reviewers.
- **Restrict Actions permissions** in repo settings for least-privilege access.
- **CSP in production** — removed 'unsafe-inline' in src/middleware.ts; if Tailwind/Next.js inline styles break, move them to external CSS.

## Troubleshooting

### E2E Tests Fail with "Missing Secrets"

→ Ensure all 5 repository secrets are set in Settings → Secrets.

### E2E Tests Fail with "Account Billing Issue"

→ GitHub Actions job didn't run due to billing. Check Settings → Billing & plans → Actions quota.

### Local Secrets Check Fails

→ Create `.env.local` and fill values from Supabase dashboard.

### CSP Violations in Production

→ Check browser console for blocked resources. Update CSP in `src/middleware.ts` if needed (avoid 'unsafe-inline' in prod).

## Related Files

- `.github/SECRET_CHECKLIST.md` — quick reference for required secrets
- `.github/ISSUE_TEMPLATE/populate-secrets.md` — issue template for secret setup
- `docs/CI.md` — CI workflow details
- `scripts/check-secrets.mjs` — validates required secrets
- `scripts/generate-keys.mjs` — generates RSA keypair for QR signing
