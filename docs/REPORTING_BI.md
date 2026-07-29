# Enterprise Reporting, BI & Decision Intelligence

**Company:** Hope Design Group Ltd  
**Module version:** 1.0 — Enterprise Platform  
**Entry:** `/dashboard/reports`

## Scope

Beyond PDF/Excel export — full enterprise platform covering:

1. **Reporting Engine** — catalog, designer, run history (tabular, matrix, pivot, financial, drill, AI, regulatory)
2. **Dashboard Center** — 25+ role dashboards (CEO, Board, Finance, Production, HR, Security, …)
3. **KPI Engine** — targets, actuals, variance, trends, snapshots
4. **AI Decision Intelligence** — forecast, risk, what-if, root cause, fraud, attrition
5. **Document Generator** — invoice, PO, GRN, payslip, certificate, tax packs
6. **Schedules** — cron delivery packs
7. **Regulatory** — URA VAT, PAYE, NSSF, audit checklists
8. **Analytics Studio** — live ops charts + KPI comparisons
9. **Executive Center** — CEO / MD / Board / Investor packs
10. **Export Center** — bulk CSV with run audit

## Database (migration `20260101000018`)

| Table | Purpose |
|-------|---------|
| `bi_report_definitions` | Report catalog & designer metadata |
| `bi_report_runs` | Execution audit |
| `bi_dashboards` | Dashboard registry |
| `bi_dashboard_widgets` | Widget layouts |
| `bi_kpis` | KPI definitions |
| `bi_kpi_snapshots` | Historical KPI values |
| `bi_ai_insights` | AI decision signals |
| `bi_document_jobs` | Document generation queue |
| `bi_report_schedules` | Scheduled delivery |
| `bi_regulatory_packages` | Statutory filing packs |

All tables: UUID PKs, company-scoped RLS, soft-delete where applicable.

## Permissions

- `reports.view`, `reports.export`, `reports.manage`
- `reports.dashboards`, `reports.kpis`, `reports.ai`
- `reports.regulatory`, `reports.documents`, `reports.schedule`

## Related module reports

Module-specific deep reports remain available under Finance, HR, Inventory, Procurement, SCM hubs; this module is the enterprise BI spine that federates them.

## Phase 2 — Intelligence Platform (`20260101000019`)

### Document Intelligence
Board papers, meeting minutes, inspection reports, manufacturing batch reports, asset certificates, QR certificates, audit reports — each with:

- QR payload · barcode · document hash (SHA-256) · digital certificate ref  
- Electronic seal · watermark · version · approval chain · tamper status  
- Revision history (`bi_document_revisions`)  
- Classification: public | internal | confidential | restricted  

UI: `/dashboard/reports/intelligence`

### Data Warehouse
Metadata catalog for star/snowflake design:

- Facts, dimensions, SCD type 2, OLAP cubes, lake zones  
- Data marts (finance, production, inventory, HR, security)  
- Analytics models (descriptive → cost/market)  
- Forecast results  

UI: `/dashboard/reports/warehouse`

### Enterprise Search
GIN full-text index over federated entities (`bi_search_index`).  
UI: `/dashboard/reports/search`

### AI Executive Assistant
Playbook-driven Q&A for production, suppliers, customers, demand, board, budget.  
UI: `/dashboard/reports/assistant`

### Visualization
22-chart catalog + live Recharts samples.  
UI: `/dashboard/reports/visualization`

### Architecture & Security
Service registry (report, scheduler, notify, BI, AI, render, export, search, audit, API GW, events, workers, Redis, CDN) + MFA/RBAC/RLS/CLS/watermark/classification checklist.  
UI: `/dashboard/reports/architecture`

### Compliance expansions
IFRS pack, ISO 9001, ISO 27001, Uganda Income Tax working papers (plus URA VAT/PAYE/NSSF from phase 1).

### Multi-channel schedules
`delivery_channels`: email, sms, whatsapp, teams, slack, gdrive, sharepoint, ftp, sftp, portal.

