# Advanced Notification System

SecureTrack ERP multi-channel notifications: in-app inbox, Resend email, rules engine, preferences, and delivery audit.

## Features

- **In-app notification center** with unread badges and mark-read
- **Header bell** with live poll (30s) and quick actions
- **Multi-channel**: `in_app`, `email` (Resend), `sms` / `whatsapp` / `push` (queued)
- **User preferences**: channel toggles, quiet hours, digest mode, muted events
- **Rules engine**: event keys → templates → audience (roles / actor / all users)
- **Broadcast compose**: company-wide or targeted sends
- **Delivery log** (`notification_deliveries`) + email outbox

## Routes

| Path | Purpose |
|------|---------|
| `/dashboard/notifications` | Inbox center |
| `/dashboard/notifications/preferences` | User channel prefs |
| `/dashboard/notifications/rules` | Automation rules + fire test |
| `/dashboard/notifications/compose` | Admin broadcast |
| `/dashboard/settings/email` | Resend config / test |
| `/dashboard/settings/notifications` | Email templates |

## API

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/notifications` | Inbox + unread count |
| POST | `/api/notifications/mark-read` | Mark one/all read |
| POST | `/api/notifications/send` | Direct or `event_key` fan-out |
| GET/PUT | `/api/notifications/preferences` | User prefs |
| POST | `/api/notifications/dispatch` | Legacy template dispatch |

### Send broadcast

```json
POST /api/notifications/send
{
  "title": "System maintenance",
  "message": "ERP downtime 02:00–03:00 UTC",
  "channels": ["in_app", "email"],
  "category": "system",
  "priority": "high",
  "all_users": true
}
```

### Fire rule by event

```json
POST /api/notifications/send
{
  "event_key": "fraud.alert",
  "vars": { "title": "Anomaly", "message": "Cluster in East region" }
}
```

## Database (migration `20260101000021`)

- Extends `notifications` (category, priority, channels, actions, archive)
- `notification_preferences`
- `notification_rules`
- `notification_subscriptions`
- `notification_deliveries`
- `notification_broadcasts`

## Service

`src/lib/notifications/service.ts`

- `notifyUsers()` — fan-out with prefs + Resend
- `notifyFromEvent()` — rule matching + audience resolution

## Permissions

- `notifications.view` · `notifications.manage` · `notifications.send`
