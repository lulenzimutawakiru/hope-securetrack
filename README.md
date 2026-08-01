# Hope SecureTrack

Enterprise QR Authentication, Manufacturing Traceability & Batch Printing Platform for **Hope Design Group Ltd**.

## Production

| | |
|--|--|
| **App** | https://hope-securetrack.vercel.app |
| **Health** | https://hope-securetrack.vercel.app/api/health |
| **Verify** | https://hope-securetrack.vercel.app/verify |
| **Ops guide** | [docs/PRODUCTION.md](docs/PRODUCTION.md) |
| **Niimbot agent** | [print-agent/README.md](print-agent/README.md) |

## Stack

| Layer | Tech |
|-------|------|
| Frontend | Next.js 15, React 19, TypeScript, Tailwind CSS, shadcn/ui |
| Backend | Supabase (PostgreSQL, Auth, RLS, Edge Functions) |
| Hosting | Vercel |
| Labels | Label Studio + Windows Print Agent (Niimbot) |
| Commerce | Sales · Invoicing · Dispatch |
| People | HR (employees, leave) |

## Features

- Public verification portal (camera + serial + deep links)
- Production → QR → print → pack → warehouse pipeline
- Niimbot discovery (Web Bluetooth) + print job queue
- Sales orders, invoices, payments, dispatch notes
- HR employees & leave approvals
- Fraud alerts, audit logs, RBAC
- `/api/health` for uptime monitors

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

**Full setup guide**: [docs/SETUP.md](docs/SETUP.md)

## Deploy (Vercel + Supabase)

Full guide: **[docs/SETUP.md](docs/SETUP.md)**

Quick steps:
```powershell
# 1. Auth & link Supabase
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push

# 2. Set Supabase edge function secrets
npx supabase secrets set QR_ENCRYPTION_KEY=...
npx supabase secrets set QR_SIGNING_PRIVATE_KEY=...
npx supabase secrets set QR_SIGNING_PUBLIC_KEY=...
npx supabase functions deploy verify --no-verify-jwt

# 3. Deploy to Vercel
npx vercel --prod

# 4. Set GitHub Actions secrets (for CI/E2E)
gh secret set NEXT_PUBLIC_SUPABASE_URL --body "..."
gh secret set NEXT_PUBLIC_SUPABASE_ANON_KEY --body "..."
# ... (see docs/SETUP.md for all secrets)
```

Or run: `.\scripts\deploy.ps1 -Prod`

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
