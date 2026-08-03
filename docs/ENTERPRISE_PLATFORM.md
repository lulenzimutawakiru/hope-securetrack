# SecureTrack ERP — Enterprise Platform Architecture

**Company:** SecureTrack ERP  
**Target class:** SAP Fiori UX · Dynamics 365 / Oracle Fusion capability · Odoo-beating usability  

## Design system (shipped foundation)

### Tokens (`src/app/globals.css` + `tailwind.config.ts`)

| Token family | Values |
|--------------|--------|
| Brand | primary (navy), accent (teal), brand (gold) |
| Semantic | success, warning, info, danger/destructive |
| Surfaces | background, card, muted, popover, sidebar |
| Themes | light · dark · system (`next-themes`) |
| Typography | display XXL/XL, H1–H6 fluid, body, caption, overline, mono |
| Elevation | `--shadow-sm/md/lg` |
| Layout | header height, sidebar widths, content max, safe-area |

### Components (`src/components/enterprise/`)

- `CommandPalette` — ⌘K / Ctrl+K global search & quick actions  
- `KpiMetric` — premium KPI cards with trend tones  
- `ModuleTile` — workspace launch cards  
- `PageShell` — responsive page container  

### Shell

- Collapsible desktop sidebar  
- Mobile sheet navigation + bottom tab bar  
- Sticky header with search, theme, notifications, profile  
- Responsive padding 320px → 4K (`max-w-content`)  

## Navigation model

| Surface | Pattern |
|---------|---------|
| Desktop | Collapsible sidebar · command palette · breadcrumbs (per module) |
| Tablet | Adaptive sidebar width · same palette |
| Mobile | Bottom nav · hamburger sheet · FAB-style primary routes |

## Module landscape (live ERP surface)

Production · Inventory · Procurement · SCM · Sales · CRM · Finance · HR · Workforce · Identity · Reports/BI · Notifications · Settings · QR/Auth · Dispatch · Labels/Print  

Each module already implements CRUD patterns appropriate to its domain; the design system is the **shared language** for progressive UI upgrades.

## AI surface (existing + expandable)

| Capability | Location |
|------------|----------|
| AI Executive Assistant | `/dashboard/reports/assistant` |
| AI Decision Insights | `/dashboard/reports/ai` |
| Forecast / DWH models | `/dashboard/reports/warehouse` |
| Fraud signals | `/dashboard/fraud` + notification rules |

## Security posture

- Supabase Auth + RLS (company isolation)  
- RBAC permissions in `role_permissions`  
- Super-admin extras for module rollout  
- Resend server-only secrets  
- Immutable audit tables / config change log / notification deliveries  

## Performance targets

| Metric | Target |
|--------|--------|
| Lighthouse Performance | 95+ (ongoing) |
| Accessibility | WCAG 2.1 AA intent |
| Data grids | Virtualization roadmap (AG Grid class) |
| Concurrent users | Horizontal scale via Vercel + Supabase |

## Progressive delivery roadmap

### Phase A — Foundation (this delivery)

- Design tokens & themes  
- Enterprise shell & command palette  
- Executive dashboard redesign  
- Mobile navigation  

### Phase B — Data experience (**shipped**)

- `EnterpriseDataGrid` — virtual scroll (40+ rows), pin columns, sort, global filter, column chooser, CSV export, saved filter presets (localStorage)  
- `BulkActionBar` — multi-select archive / restore / export  
- Soft-delete helpers (`src/lib/soft-delete.ts`)  
- **Recycle Bin** `/dashboard/recycle-bin` — restore across COA, products, branches, journals, AP, banks, assets, budgets  
- Applied grids: **Chart of Accounts**, **Products**  
- **Role workspaces** `/dashboard/workspaces` + CEO/Finance/Factory/Warehouse/Sales/HR/Security  
- Products `deleted_at` migration `20260101000022`  

### Phase C — Workspaces (**shipped**)

- **Workspace tabs** under header — open/pin/close, persisted (`hope:workspace-tabs:v1`)  
- **SplitPanel** — resizable dockable panes (keyboard + drag, localStorage)  
- **KanbanBoard** — drag columns, optimistic move (production status)  
- **Scheduler** — week calendar for leave + print jobs  
- **Boards hub** `/dashboard/boards` — kanban · schedule · split inspector  
- DataGrid rolled to **Suppliers** + **Stock balances**  
- Role workspaces remain at `/dashboard/workspaces/*`  

### Phase D — Realtime & offline (**shipped**)

- **Supabase Realtime** hooks (`useRealtimeTable`, `useRealtimeTables`)  
- Publication migration for notifications, batches, fraud, stock, print_jobs, etc.  
- **Presence** (`usePresence`) — who's online in header  
- **Live Ops** `/dashboard/live` — event feed, presence list, offline queue  
- **Notification bell** — INSERT realtime + toast  
- **IndexedDB offline queue** — enqueue / auto-sync on reconnect  
- **Service worker** `public/sw.js` — shell cache (production)  
- **Offline banner** + Live/Offline status chip in header  

### Phase E — DevOps maturity

- Expanded E2E · a11y · load tests  
- OpenTelemetry · Grafana dashboards  
- Blue/green + automated security scans  

## Local development

```bash
npm run dev
# Ctrl+K for command palette
# Theme toggle in header
```

## Production

https://hope-securetrack.vercel.app  

Deploy: `npx vercel --prod --yes` after design-system changes.
