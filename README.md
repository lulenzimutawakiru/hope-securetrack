# Hope SecureTrack

Enterprise QR Authentication, Manufacturing Traceability & Batch Printing Platform for **Hope Design Group Ltd**.

## Stack

| Layer | Tech |
|-------|------|
| Frontend | Next.js 15, React 19, TypeScript, Tailwind CSS, shadcn/ui |
| Backend | Supabase (PostgreSQL, Auth, RLS, Edge Functions) |
| Hosting | Vercel |
| Print Agent | Windows service for Niimbot printers (optional) |

## Features

- **Public product verification** (`/verify`) — encrypted, signed QR codes
- **Production batches** — create, track, QC status
- **QR generation** — edge function for ream/carton codes
- **Printing jobs** — queue labels for print agents
- **Packing station** — 5 reams → carton with validation
- **Inventory** — reams, cartons, movements
- **Fraud alerts** — automated detection from verification patterns
- **Reports** — production & verification analytics
- **RBAC** — roles, permissions, audit logs

## Quick Start (local)

```bash
npm install
cp .env.example .env.local
# Fill NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, etc.

npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### With local Supabase

```bash
npx supabase start
npx supabase db reset   # migrations + seed
npm run dev
```

## Deploy (Vercel + Supabase)

Full guide: **[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)**

```powershell
# 1. Auth
npx supabase login
npx vercel login

# 2. Create Supabase project in dashboard, then:
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push
# Apply seed: paste supabase/seed.sql in SQL Editor

# 3. Secrets for edge functions
npx supabase secrets set QR_ENCRYPTION_KEY=...
npx supabase secrets set QR_SIGNING_PRIVATE_KEY=...
npx supabase secrets set QR_SIGNING_PUBLIC_KEY=...

npx supabase functions deploy verify --no-verify-jwt
npx supabase functions deploy generate-qr
npx supabase functions deploy cartonize
npx supabase functions deploy print-agent

# 4. Vercel
npx vercel
# Set env vars in dashboard or via `npx vercel env add`
npx vercel --prod

# 5. Bootstrap admin user (Auth → create user, then SQL from scripts/bootstrap-admin.sql)
```

Or run:

```powershell
.\scripts\deploy.ps1 -Prod
```

## App routes

| Route | Description |
|-------|-------------|
| `/` | Landing |
| `/login` | Staff login |
| `/verify` | Public product verification |
| `/dashboard` | Overview stats |
| `/dashboard/production` | Batches |
| `/dashboard/qr-codes` | QR list + generate |
| `/dashboard/printing` | Print jobs |
| `/dashboard/packing` | Carton packing |
| `/dashboard/inventory` | Stock |
| `/dashboard/verification` | Scan logs |
| `/dashboard/fraud` | Fraud alerts |
| `/dashboard/reports` | Analytics |
| `/dashboard/products` | Catalog |
| `/dashboard/distributors` | Partners |
| `/dashboard/users` | Team |
| `/dashboard/audit` | Audit trail |
| `/dashboard/settings` | Profile & system |

## Project structure

```
hope-securetrack/
├── src/app/              # Next.js App Router
├── src/components/       # UI + layout
├── src/hooks/            # Auth/user hooks
├── src/lib/              # Crypto, QR, Supabase clients
├── src/types/            # Domain types
├── supabase/migrations/  # Schema + RLS
├── supabase/functions/   # Edge Functions
├── scripts/              # Deploy + bootstrap SQL
└── docs/                 # Deployment guide
```

## License

Proprietary — Hope Design Group Ltd
