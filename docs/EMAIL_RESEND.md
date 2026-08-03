# Resend Email Integration

SecureTrack ERP uses [Resend](https://resend.com) for transactional email and notification delivery.

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `RESEND_API_KEY` | Yes | API key from Resend dashboard |
| `RESEND_FROM_EMAIL` | Recommended | `Name <addr@verified-domain>` |
| `RESEND_FROM_NAME` | Optional | Display name if from is bare address |
| `RESEND_REPLY_TO` | Optional | Reply-to address |

Add these in **Vercel → Project → Settings → Environment Variables** (Production + Preview), then redeploy.

### Domain setup

1. Create a Resend account and API key.  
2. Add and verify your sending domain (DNS: SPF, DKIM).  
3. Set `RESEND_FROM_EMAIL` to an address on that domain, e.g.  
   `SecureTrack ERP <noreply@mail.yourdomain.com>`  
4. Without a domain, Resend allows limited testing with their onboarding sender (see Resend docs).

## API routes

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/email/status` | Configured? from-address (auth) |
| POST | `/api/email/test` | Send test message (auth) |
| POST | `/api/email/send` | Direct or templated send (auth) |
| POST | `/api/notifications/dispatch` | Multi-channel dispatch; email → Resend |

### Example: send with template

```http
POST /api/email/send
Content-Type: application/json

{
  "to": "user@example.com",
  "template_key": "welcome",
  "vars": { "name": "Jane" }
}
```

### Example: dispatch notification

```http
POST /api/notifications/dispatch
Content-Type: application/json

{
  "channel": "email",
  "to": "user@example.com",
  "template_key": "invoice",
  "vars": { "number": "HDG-INV-2026-00001", "amount": "500,000 UGX" }
}
```

## UI

- **Settings → Email (Resend)** — status, test send, compose, outbox  
- **Settings → Notifications** — templates with **Send** via Resend  
- **Settings → Integrations** — `resend` connector metadata  

## Database

- `email_outbox` — sent/failed log  
- `bi_notification_queue` — multi-channel queue (email marked sent when Resend succeeds)  
- `notification_templates` — subject/body with `{{variables}}`  
- `integration_configs.resend` — non-secret metadata only  

## Security

- API key is **server-only** (never in client bundle or Supabase).  
- All send routes require authenticated Supabase session.  
- Outbox RLS is company-scoped.
