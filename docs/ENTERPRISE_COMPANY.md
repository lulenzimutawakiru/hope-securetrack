# Enterprise Company Management Platform

**Master organizational foundation for Hope SecureTrack ERP** — multi-company, multi-branch, multi-factory, governance, risk, branding, and AI.

Designed to rival SAP S/4HANA Enterprise Management, Oracle Fusion Enterprise Structures, Dynamics 365 F&O, Workday EM, NetSuite OneWorld, and Infor CloudSuite.

## Architecture

```
Enterprise Group
 └── Holding / Operating Company
      ├── Subsidiary / JV / Franchise
      ├── Branch · Factory · Warehouse · Office · DC
      ├── Business Unit · Department · Cost / Profit Center
      └── Board · Committees · Calendar · Documents · Risk
```

Every ERP module (HR, Finance, Production, Inventory, CRM, etc.) references company / branch / department IDs from this layer.

## Migration

`supabase/migrations/20260101000050_enterprise_company_management.sql`

### Core tables

| Table | Purpose |
|-------|---------|
| `companies` *(extended)* | Full legal / trading / branding profile |
| `ec_enterprise_groups` | Group holding structure |
| `ec_business_units` | Manufacturing, print, ICT, retail… |
| `ec_cost_centers` / `ec_profit_centers` | Financial mapping |
| `ec_org_nodes` | Interactive org chart hierarchy |
| `ec_company_settings` | Domain policies (financial, HR, mfg…) |
| `ec_company_branding` | White-label colors / templates |
| `ec_company_documents` | Vault + expiry |
| `ec_calendar_events` | Holidays, payroll, close dates |
| `ec_board_members` / `ec_committees` / `ec_meetings` | Governance |
| `ec_authorized_signatories` / `ec_shareholders` | Legal entity |
| `ec_insurance_policies` / `ec_risk_register` | Risk & insurance |
| `ec_intercompany_links` / `ec_shared_services` | Multi-company |
| `ec_ai_insights` | Corporate AI |
| `ec_audit_log` | Structure change audit |

Also extends: `branches`, `factories`, `departments`, `warehouses`.

## Routes

| Path | Purpose |
|------|---------|
| `/dashboard/enterprise` | Hub & stats |
| `/dashboard/enterprise/companies` | Company master CRUD |
| `/dashboard/enterprise/structure` | Branches / factories / warehouses |
| `/dashboard/enterprise/org-chart` | Interactive hierarchy |
| `/dashboard/enterprise/business-units` | BUs |
| `/dashboard/enterprise/departments` | Departments |
| `/dashboard/enterprise/cost-centers` | Cost centers |
| `/dashboard/enterprise/settings` | Policy settings + branding |
| `/dashboard/enterprise/documents` | Document vault |
| `/dashboard/enterprise/calendar` | Corporate calendar |
| `/dashboard/enterprise/governance` | Board, meetings, signatories |
| `/dashboard/enterprise/risk` | Risk + insurance |
| `/dashboard/enterprise/directory` | People & site directory |
| `/dashboard/enterprise/ai` | AI corporate assistant |

## Library

```
src/lib/enterprise-company/
  types.ts
  service.ts
  index.ts
```

## Permissions

`ec.view` · `ec.manage` · `ec.structure` · `ec.governance` · `ec.documents` · `ec.risk` · `ec.admin` · `ec.ai`

## Security

- RLS via `user_company_id()`
- Soft delete on key masters
- Audit log on company updates
- Super-admin enterprise group admin

## Related

- Settings company form: `/dashboard/settings/company`
- Digital Identity: `docs/HOPE_DIGITAL_IDENTITY.md`
- Branding DAM: `/dashboard/branding`
