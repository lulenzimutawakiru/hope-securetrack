# SecureChat — Enterprise Collaboration Platform

Secure messaging, team channels, meetings, announcements, AI assistant, knowledge hub, and deep ERP integrations for SecureTrack ERP.

## Migration

```text
supabase/migrations/20260101000043_enterprise_hopechat.sql
```

### Core tables

| Table | Purpose |
|-------|---------|
| `hc_workspaces` | Multi-workspace tenancy |
| `hc_channels` | DM · group · public/private · project · announcement |
| `hc_channel_members` | Membership · mute · pin · read |
| `hc_messages` | Chat messages · threads · bots |
| `hc_reactions` | Emoji reactions |
| `hc_files` | Shared file registry |
| `hc_announcements` | Broadcasts + acks |
| `hc_meetings` | Schedule · live · AI minutes |
| `hc_chat_tasks` | Message → task |
| `hc_knowledge` | SOPs / FAQs |
| `hc_bots` | HR · Finance · Production · IT · SecureTrackAI |
| `hc_user_settings` | Theme · DND · density |
| `hc_audit_log` | Admin audit trail |

## Routes

| Path | Purpose |
|------|---------|
| `/dashboard/chat` | Main chat shell (Teams/Slack layout) |
| `/dashboard/chat/teams` | Channel directory |
| `/dashboard/chat/meetings` | Voice/video conference rooms |
| `/dashboard/chat/calls` | Call capabilities guide |
| `/dashboard/chat/announcements` | Broadcasts |
| `/dashboard/chat/files` | Shared files |
| `/dashboard/chat/ai` | SecureTrackAI assistant |
| `/dashboard/chat/knowledge` | Knowledge hub |
| `/dashboard/chat/analytics` | Engagement KPIs |
| `/dashboard/chat/settings` | Preferences · bots · security notes |

## Permissions

`hc.view` · `hc.manage` · `hc.meetings` · `hc.announce` · `hc.ai` · `hc.admin`

## Library

`src/lib/hopechat/`

- `service.ts` — channels, messages, DMs, meetings, tasks, announcements, ticket conversion  
- `ai.ts` — SecureTrackAI, bot commands (`/hr` `/finance` `/prod` `/it`), summaries  
- Realtime via existing `useRealtimeTable` + `usePresence`

## Bot commands

| Command | Bot |
|---------|-----|
| `/hr` | Leave, payslips, policies |
| `/finance` | Invoice / payment status |
| `/prod` | Machine / production status |
| `/it` | Password / tickets |
| `@SecureTrackAI` | General assistant |

## ERP integrations

- **Service Desk** — convert any message to a ticket  
- **Tasks** — create chat tasks with module links  
- **Dispatch / Production / Warehouse** — dedicated seeded channels  
- **Presence** — Supabase Realtime presence per channel  
- **Identity** — MFA and user profiles for members  

## Operations

1. Apply migration `00043`.  
2. Confirm seed channels (`#general`, `#production`, …) and welcome messages.  
3. Open **SecureChat** from the sidebar.  
4. Try `@SecureTrackAI help` and message → Ticket conversion.  
