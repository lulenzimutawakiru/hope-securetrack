# Hope SecureTrack — Deployment Guide

Deploy the Next.js app to **Vercel** and the database + edge functions to **Supabase**.

## Prerequisites

- Node.js 20+
- Supabase account ([supabase.com](https://supabase.com))
- Vercel account ([vercel.com](https://vercel.com))
- Supabase CLI: `npm i -g supabase`
- Vercel CLI: `npm i -g vercel`

## 1. Create Supabase Project

1. Create a new project in the Supabase dashboard (region close to your users, e.g. `eu-west-1` or `ap-southeast-1`).
2. Note from **Project Settings → API**:
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon` `public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` (server-only, never expose to the browser)

### Generate QR crypto keys

```bash
# AES-256 key (64 hex chars)
openssl rand -hex 32

# Ed25519 keypair (Node one-liner)
node -e "const {generateKeyPairSync}=require('crypto'); const {publicKey,privateKey}=generateKeyPairSync('ed25519'); console.log('PRIVATE', privateKey.export({type:'pkcs8',format:'der'}).toString('base64')); console.log('PUBLIC', publicKey.export({type:'spki',format:'der'}).toString('base64'));"
```

> Edge functions currently expect raw key material for Ed25519 via Web Crypto. If signing fails in production, store PEM/PKCS8 properly and adjust `supabase/functions/_shared/qr-crypto.ts`.

## 2. Link & migrate database

```bash
# Login
npx supabase login

# Link remote project (from project ref in dashboard URL)
npx supabase link --project-ref YOUR_PROJECT_REF

# Push migrations
npx supabase db push

# Seed reference data (company, roles, products)
# Option A: SQL Editor — paste supabase/seed.sql
# Option B: if seed is configured in config.toml
npx supabase db query --linked -f supabase/seed.sql
```

Or run migrations + seed from the SQL Editor:

1. Paste `supabase/migrations/20260101000001_initial_schema.sql`
2. Paste `supabase/migrations/20260101000002_rls_policies.sql`
3. Paste `supabase/seed.sql`

## 3. Create admin user

1. Supabase Dashboard → **Authentication → Users → Add user**
2. Email / password for the admin
3. Copy the user UUID
4. Run in SQL Editor (replace UUID and email):

```sql
INSERT INTO user_profiles (
  id, company_id, role_id, first_name, last_name, email, employee_id, is_active
) VALUES (
  'YOUR_AUTH_USER_UUID',
  'a0000000-0000-4000-8000-000000000001',
  'e0000000-0000-4000-8000-000000000001',
  'System',
  'Admin',
  'admin@hopedesign.co.ke',
  'EMP-001',
  true
);
```

## 4. Deploy Edge Functions

Set secrets:

```bash
npx supabase secrets set QR_ENCRYPTION_KEY=your-64-hex-chars
npx supabase secrets set QR_SIGNING_PRIVATE_KEY=your-private-key-base64
npx supabase secrets set QR_SIGNING_PUBLIC_KEY=your-public-key-base64
```

Deploy:

```bash
npx supabase functions deploy verify --no-verify-jwt
npx supabase functions deploy generate-qr
npx supabase functions deploy cartonize
npx supabase functions deploy print-agent
```

`verify` is public (product scans) — use `--no-verify-jwt`.  
Other functions require a valid user JWT.

## 5. Deploy to Vercel

```bash
# Login
npx vercel login

# Link project (from repo root)
npx vercel

# Set environment variables (Production + Preview)
npx vercel env add NEXT_PUBLIC_SUPABASE_URL
npx vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
npx vercel env add SUPABASE_SERVICE_ROLE_KEY
npx vercel env add NEXT_PUBLIC_APP_URL
npx vercel env add NEXT_PUBLIC_APP_NAME
npx vercel env add NEXT_PUBLIC_COMPANY_NAME
npx vercel env add QR_ENCRYPTION_KEY
npx vercel env add QR_SIGNING_PRIVATE_KEY
npx vercel env add QR_SIGNING_PUBLIC_KEY
```

Or in Vercel Dashboard → Project → Settings → Environment Variables:

| Variable | Notes |
|----------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role (server only) |
| `NEXT_PUBLIC_APP_URL` | e.g. `https://your-app.vercel.app` |
| `NEXT_PUBLIC_APP_NAME` | Hope SecureTrack |
| `NEXT_PUBLIC_COMPANY_NAME` | Hope Design Group Ltd |
| `QR_ENCRYPTION_KEY` | Same as Supabase secrets |
| `QR_SIGNING_*` | Same as Supabase secrets |

Production deploy:

```bash
npx vercel --prod
```

## 6. Auth URL configuration

In Supabase → **Authentication → URL Configuration**:

- Site URL: `https://your-app.vercel.app`
- Redirect URLs: `https://your-app.vercel.app/**`, `http://localhost:3000/**`

## 7. Local development

```bash
cp .env.example .env.local
# Fill in keys (can use remote Supabase or local stack)

npm install
npm run dev
```

Optional local Supabase:

```bash
npx supabase start
npx supabase db reset   # applies migrations + seed
```

## Smoke checklist

- [ ] Landing page loads
- [ ] `/verify` page loads
- [ ] Login with admin user → `/dashboard`
- [ ] Dashboard stats load (may be zeros)
- [ ] Create a production batch
- [ ] Seed products visible under Products
- [ ] Edge function `verify` responds to POST

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Infinite redirect to login | Check anon key + Site URL; confirm `user_profiles` row exists for the auth user |
| RLS errors / empty tables | Ensure seed ran; user `company_id` matches seed company |
| Edge function 401 | Deploy with correct JWT settings; pass `Authorization: Bearer <access_token>` |
| Build fails on Vercel | Node 20+, no missing env for build-time public vars |
