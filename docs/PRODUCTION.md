# Hope SecureTrack — Enterprise Production Guide

## Architecture

| Layer | Component |
|-------|-----------|
| Edge | Vercel (Next.js 15 App Router) |
| Data / Auth | Supabase Postgres + RLS + Auth |
| Functions | Supabase Edge: `verify`, `generate-qr`, `cartonize`, `print-agent` |
| Labels | Browser Label Studio + Windows Print Agent (Niimbot) |
| Public | `/verify` authenticity portal |

## Production checklist

### 1. Infrastructure

- [x] Supabase project provisioned  
- [x] Migrations applied (`initial`, `rls`, `sales_hr_dispatch`, `production_hardening`)  
- [x] Edge functions deployed  
- [x] Vercel production domain + env vars  
- [ ] Custom domain + TLS (optional)  
- [ ] Supabase PITR / daily backups enabled  
- [ ] Rotate access tokens after sharing  

### 2. Required environment (Vercel)

| Variable | Required |
|----------|----------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes (server only) |
| `NEXT_PUBLIC_APP_URL` | Yes (`https://your-domain`) |
| `NEXT_PUBLIC_APP_NAME` | Recommended |
| `NEXT_PUBLIC_COMPANY_NAME` | Recommended |
| `QR_ENCRYPTION_KEY` | Yes (64 hex) |
| `QR_SIGNING_PRIVATE_KEY` | Yes |
| `QR_SIGNING_PUBLIC_KEY` | Yes |
| `DEFAULT_COMPANY_ID` | Optional |

Same `QR_*` secrets must be set on Supabase Edge Functions.

### 3. Auth

- Site URL = production app URL  
- Redirect allow list includes production + localhost  
- Admin user linked in `user_profiles` with Super Administrator role  
- Disable public signups if only staff accounts are needed  

### 4. Health

```
GET /api/health
```

Returns `healthy` | `degraded` with Supabase latency. Point uptime monitors here.

### 5. End-to-end factory workflow

1. **Production** — create batch  
2. **QR Codes** — generate unit codes  
3. **Printers** — discover Niimbot (Bluetooth)  
4. **Labels** — build labels / queue print job  
5. **Print Agent** (Windows) — pull jobs, outbox → Niimbot  
6. **Packing** — 5 reams → carton  
7. **Inventory** — receive warehouse  
8. **Sales** — order  
9. **Invoices** — issue + payments  
10. **Dispatch** — ship  
11. **Verify portal** — consumer scan  

### 6. Security

- RLS enabled on all tenant tables  
- Public verify rate-limited (60/min/IP per instance)  
- Service role only on server / edge  
- Audit log RPC for sensitive actions  
- Security headers: `X-Frame-Options`, `nosniff`, `Referrer-Policy`  

### 7. Support contacts

- App: Hope SecureTrack  
- Company: Hope Design Group Ltd  
- Public verify: `/verify`  

## Incident response

| Symptom | Action |
|---------|--------|
| 503 health | Check Supabase status + Vercel env |
| Login fails | Auth URL config + `user_profiles` row |
| QR gen 500 | Edge secrets `QR_*` |
| Scan fails | Reprint labels (short URL); test serial paste |
| Print jobs stuck | Agent heartbeat + `print_agents` key hash |

## Backups

Enable Supabase automatic backups / PITR in project settings. Export critical tables weekly if required by policy.
