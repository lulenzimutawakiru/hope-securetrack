# Enterprise Integration Hub (iPaaS)

Hope SecureTrack module for **API management, connectors, webhooks, automation, data sync, IoT, hardware, and monitoring**.

## Navigation

**Dashboard → Integrations** (`/dashboard/integrations`)

## Architecture

```
External Systems → API Gateway → Integration Engine → Message Queue
  → Transformation → ERP Core → DB / Analytics / AI
```

## Modules

| Module | Path |
|--------|------|
| Hub | `/dashboard/integrations` |
| Connectors | `.../connectors` |
| Connections | `.../connections` |
| API Gateway | `.../api` |
| Developer Portal | `.../developers` |
| Webhooks | `.../webhooks` |
| Workflows | `.../workflows` |
| Data Sync | `.../sync` |
| Message Queue | `.../queue` |
| IoT | `.../iot` |
| Hardware | `.../hardware` |
| GPS Fleet | `.../gps` |
| Payments | `.../payments` |
| Module Links | `.../modules` |
| Monitoring | `.../monitor` |
| Security | `.../security` |
| Event Bus | `.../events` |

## Database

`supabase/migrations/20260101000027_enterprise_integration_hub.sql`

Permissions: `intg.view`, `intg.manage`, `intg.api`, `intg.webhooks`, `intg.workflows`, `intg.security`, `intg.iot`, `intg.monitor`

## Libraries

`src/lib/integration/` — event pipeline, webhooks, workflows, sync, API key generation

## Apply migration

Run in Supabase SQL Editor:

`supabase/migrations/20260101000027_enterprise_integration_hub.sql`
