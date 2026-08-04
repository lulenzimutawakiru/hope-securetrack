# SSO (OIDC / Entra / Google) & SCIM

## OIDC company SSO

### Routes

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/auth/sso/providers` | Public list (no secrets) |
| GET | `/api/auth/sso/start` | Redirect to IdP |
| GET | `/api/auth/sso/callback` | Code exchange → provision → session |

### UI

- **Identity → SSO** — configure `idm_sso_providers`
- **Login** — “Continue with …” buttons for active providers

### Entra (Microsoft) checklist

1. App registration → Web redirect URI:  
   `https://<domain>/api/auth/sso/callback`
2. Create client secret → store in env as `SSO_ENTRA_CLIENT_SECRET`
3. In SecureTrack SSO page, set:
   - `provider_code`: `entra`
   - `protocol`: `oidc`
   - `issuer_url`: `https://login.microsoftonline.com/<tenant-id>/v2.0`
   - `client_id`: application (client) ID
   - `client_secret_ref`: `ENV:SSO_ENTRA_CLIENT_SECRET`
   - Enable **is_active**
4. Optional: `config.email_domains: ["yourco.com"]` for domain routing on login

### Env

```bash
SSO_STATE_SECRET=          # HMAC for OAuth state (defaults to QR key)
SSO_ENTRA_CLIENT_ID=
SSO_ENTRA_CLIENT_SECRET=
SSO_ENTRA_ISSUER=https://login.microsoftonline.com/<tenant>/v2.0
# Platform Supabase OAuth (optional)
NEXT_PUBLIC_SSO_AZURE=true
NEXT_PUBLIC_SSO_GOOGLE=true
AZURE_AD_CLIENT_ID=        # if using Supabase Azure provider
GOOGLE_OAUTH_CLIENT_ID=
```

### Session model

After IdP success, SecureTrack:

1. Finds or creates Auth user + `user_profiles` (JIT when `auto_provision`)
2. Upserts `idm_sso_links` (subject ↔ user)
3. Issues Supabase **magic link** and redirects to establish cookies

## SCIM 2.0 (basic)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/v2/scim/v2/Users` | List / filter by userName |
| POST | `/api/v2/scim/v2/Users` | Create user |

```bash
SCIM_BEARER_TOKEN=long-random-secret
SCIM_DEFAULT_COMPANY_ID=<uuid>
```

```http
Authorization: Bearer <SCIM_BEARER_TOKEN>
Content-Type: application/scim+json
```

Map Entra provisioning to this base URL:  
`https://<domain>/api/v2/scim/v2`
