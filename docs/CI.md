CI & E2E

This project now includes:

- .github/workflows/e2e.yml — runs Playwright E2E on pull requests (requires Supabase + QR secrets in repository secrets).
- .github/workflows/synthetic-monitor.yml — hourly health check that pings /api/health on the production URL (set PROD_URL in repo secrets).

Required secrets for E2E:
- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY
- QR_ENCRYPTION_KEY
- QR_SIGNING_PRIVATE_KEY
- QR_SIGNING_PUBLIC_KEY

The project also includes scripts/check-secrets.mjs which the CI uses to fail early if secrets are missing.

Notes:
- Full local Supabase setup in CI requires Docker and additional setup; this workflow expects an accessible test Supabase instance (set in secrets) or to be run against a preview deployment.
- The CI `ci` script runs typecheck, secrets check, tests, SBOM and dependency audit to improve supply chain safety.
