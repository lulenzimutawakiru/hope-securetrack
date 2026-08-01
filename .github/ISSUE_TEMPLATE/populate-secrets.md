---
name: "Populate CI & E2E secrets"
about: "Checklist to add the repository secrets required for CI, Playwright E2E and synthetic monitoring"
title: "Populate CI & E2E secrets"
labels: ["chore","devops"]
assignees: []
---

Please add the repository secrets below so CI and E2E workflows can run successfully.

Checklist
- [ ] NEXT_PUBLIC_SUPABASE_URL — Supabase project URL used by the frontend/tests
- [ ] NEXT_PUBLIC_SUPABASE_ANON_KEY — Supabase anon/public key for client access
- [ ] QR_ENCRYPTION_KEY — Symmetric key used to encrypt QR payloads (edge functions)
- [ ] QR_SIGNING_PRIVATE_KEY — Private key for signing QR tokens (keep secret)
- [ ] QR_SIGNING_PUBLIC_KEY — Public key to verify QR signatures (store here for convenience)
- [ ] PROD_URL (optional) — Production URL used by the synthetic monitor (defaults to the public site)

Recommended commands (using gh):

```
gh secret set NEXT_PUBLIC_SUPABASE_URL --body "https://xyz.supabase.co"
gh secret set NEXT_PUBLIC_SUPABASE_ANON_KEY --body "ANON_KEY_HERE"
gh secret set QR_ENCRYPTION_KEY --body "base64-or-hex-key"
gh secret set QR_SIGNING_PRIVATE_KEY --body "-----BEGIN PRIVATE KEY-----..."
gh secret set QR_SIGNING_PUBLIC_KEY --body "-----BEGIN PUBLIC KEY-----..."
gh secret set PROD_URL --body "https://hope-securetrack.vercel.app"
```

Security notes
- Rotate signing keys periodically and restrict access to repository secrets.
- Consider using Environments for production secrets and required reviewers for changes.

When done, comment here with the environment used for E2E (preview/preview-db/prod-like) so the E2E workflow can be validated.