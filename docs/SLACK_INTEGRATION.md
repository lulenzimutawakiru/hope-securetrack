# SecureTrack ERP ↔ Slack (SecureChat app)

## Platform app

| Field | Value |
|-------|--------|
| App ID | `A0BMWDC45LZ` |
| App name | SecureChat |
| Credentials | **Server env only** (never commit) |

### Required environment variables

```bash
SLACK_APP_ID=A0BMWDC45LZ
SLACK_CLIENT_ID=...
SLACK_CLIENT_SECRET=...
SLACK_SIGNING_SECRET=...
# optional
SLACK_APP_TOKEN=xapp-...   # Socket Mode / connections:write
SLACK_VERIFICATION_TOKEN=  # deprecated; prefer signing secret
```

Store these in `.env.local` / Vercel project env — **not** in git.

## Slack app configuration (api.slack.com)

1. **OAuth Redirect URLs**
   - `https://<your-domain>/api/v2/integrations/slack/oauth/callback`
   - `http://localhost:3000/api/v2/integrations/slack/oauth/callback` (local)
2. **Event Subscriptions** → Request URL  
   - `https://<your-domain>/api/v2/integrations/slack/events`
3. **Bot scopes** (install): `chat:write`, `channels:read`, `groups:read`, `im:write`, `commands`, `incoming-webhook`, `app_mentions:read`
4. Install to workspace via SecureTrack UI: **Integrations → Slack · SecureChat**

## Database

Apply migration:

```bash
supabase db push
# or apply supabase/migrations/20260811000001_slack_integration.sql
```

Tables:

- `intg_slack_workspaces` — per-company install (bot token, webhook, channels, notify flags)
- `intg_slack_delivery_log` — delivery audit

## API (RBAC: `intg.view` / `intg.manage`)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/v2/integrations/slack` | Status + workspaces |
| PATCH | `/api/v2/integrations/slack` | Channel / notify flags |
| DELETE | `/api/v2/integrations/slack` | Disconnect |
| GET | `/api/v2/integrations/slack/oauth/start` | Start OAuth |
| GET | `/api/v2/integrations/slack/oauth/callback` | OAuth redirect |
| POST | `/api/v2/integrations/slack/test` | Test message |
| POST | `/api/v2/integrations/slack/events` | Slack Events (signature verified) |

## ERP usage

- **Notifications**: include channel `"slack"` in `notifyUsers({ channels: ["in_app","slack"], ... })`
- **Communications rules**: channel `slack` posts to the company workspace
- UI: `/dashboard/integrations/slack`

## Security notes

- Platform secrets only in server env.
- Bot tokens stored server-side; API list responses never return raw tokens (webhook shown as `[configured]`).
- Slack Events route is public but **HMAC-signed** with `SLACK_SIGNING_SECRET`.
- If credentials were pasted in chat, **rotate Client Secret + Signing Secret** in Slack and update env.

## Rotate secrets (recommended)

1. Slack App → Basic Information → regenerate **Signing Secret** / **Client Secret**
2. Update `.env.local` / Vercel
3. Redeploy / restart dev server

## Go-live checklist

1. **DB** — apply `20260811000001_slack_integration.sql` (`supabase db push` when Docker is up, or run SQL on hosted Supabase).
2. **Env** — `SLACK_*` vars on the ERP host (Vercel / `.env.local`). Never commit secrets.
3. **Slack app URLs** (https://api.slack.com/apps/A0BMWDC45LZ):
   - OAuth Redirect: `https://<domain>/api/v2/integrations/slack/oauth/callback`
   - Events Request URL: `https://<domain>/api/v2/integrations/slack/events`
4. **ERP UI** — Dashboard → Integrations → **Slack · SecureChat** → Connect Slack → set channel → Send test.
5. **Ticket fan-out** — new service-desk tickets include channel `slack` (posts once to the company workspace when `notify_tickets` is on).
6. **Optional Bolt Socket Mode** — separate project `C:\Users\user\Projects\SecureChat` uses the same app credentials; set `SLACK_BOT_TOKEN` + `SLACK_APP_TOKEN` there if running `npm start` for Socket Mode listeners.

## Domain events

| Event | Slack |
|-------|--------|
| `ticket.created` | Company channel (domain handler + SD notify) |
| `invoice.paid` | Via notification.dispatch with `channels: ["in_app","slack"]` |
