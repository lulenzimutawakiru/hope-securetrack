# SecureTrack ERP — Deploy helper (Windows PowerShell)
# Prerequisites: logged-in Supabase CLI + Vercel CLI, linked projects
# Usage: .\scripts\deploy.ps1 [-SkipBuild] [-Prod]

param(
  [switch]$SkipBuild,
  [switch]$Prod
)

$ErrorActionPreference = "Stop"
Set-Location (Split-Path $PSScriptRoot -Parent)

Write-Host "==> SecureTrack ERP deploy" -ForegroundColor Cyan

if (-not $SkipBuild) {
  Write-Host "==> Building Next.js app..." -ForegroundColor Yellow
  npm run build
  if ($LASTEXITCODE -ne 0) { throw "Build failed" }
}

Write-Host "==> Pushing database migrations (requires: supabase link)..." -ForegroundColor Yellow
npx supabase db push
if ($LASTEXITCODE -ne 0) {
  Write-Host "WARNING: db push failed. Run migrations manually via SQL Editor." -ForegroundColor Red
}

Write-Host "==> Deploying Edge Functions..." -ForegroundColor Yellow
npx supabase functions deploy verify --no-verify-jwt
npx supabase functions deploy generate-qr
npx supabase functions deploy cartonize
npx supabase functions deploy print-agent

Write-Host "==> Deploying to Vercel..." -ForegroundColor Yellow
if ($Prod) {
  npx vercel --prod --yes
} else {
  npx vercel --yes
}

Write-Host @"

Done.
Next steps:
  1. Ensure seed.sql was applied (SQL Editor if not auto-seeded)
  2. Create admin auth user + run scripts/bootstrap-admin.sql
  3. Set Supabase secrets: QR_ENCRYPTION_KEY, QR_SIGNING_PRIVATE_KEY, QR_SIGNING_PUBLIC_KEY
  4. Set Vercel env vars (see docs/DEPLOYMENT.md)
  5. Configure Auth Site URL to your Vercel domain

"@ -ForegroundColor Green
