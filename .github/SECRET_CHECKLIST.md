GitHub Actions Secret Checklist

Purpose
- Provide the minimal repository secrets required to run CI and E2E workflows for SecureTrack.

Required secrets (add these in Settings → Secrets → Actions):
- NEXT_PUBLIC_SUPABASE_URL  — Supabase project URL used by frontend/tests
- NEXT_PUBLIC_SUPABASE_ANON_KEY  — Supabase anon/public key for client access
- QR_ENCRYPTION_KEY  — Symmetric key used to encrypt QR payloads (Edge functions)
- QR_SIGNING_PRIVATE_KEY  — Private key for signing QR tokens (keep secret)
- QR_SIGNING_PUBLIC_KEY  — Public key to verify signatures (may be public but keep here for convenience)
- PROD_URL (optional) — Production URL used by the synthetic monitor (default: https://hope-securetrack.vercel.app)

Recommended: store long keys via the GitHub UI or gh CLI; avoid committing any secrets in repo files.

Add secrets using gh (example):
  gh secret set NEXT_PUBLIC_SUPABASE_URL --body "https://xyz.supabase.co"
  gh secret set NEXT_PUBLIC_SUPABASE_ANON_KEY --body "ANON_KEY_HERE"
  gh secret set QR_ENCRYPTION_KEY --body "base64-or-hex-key"
  gh secret set QR_SIGNING_PRIVATE_KEY --body "-----BEGIN PRIVATE KEY-----..."
  gh secret set QR_SIGNING_PUBLIC_KEY --body "-----BEGIN PUBLIC KEY-----..."
  gh secret set PROD_URL --body "https://hope-securetrack.vercel.app"

Security notes
- Rotate QR signing private keys regularly and update Supabase secrets used by Edge Functions.
- Prefer repository-level Actions secrets to environment or organization scope unless broader access is needed.
- Consider using GitHub Environments with required reviewers for production deployments.

If you want, I can also add a checklist issue template or a GitHub Actions workflow that fails with a clear message when any of these secrets are missing.