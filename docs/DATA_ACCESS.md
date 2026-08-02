# Data Access Layer ? CRUD v2 Standardization

Standardized, tenant-aware read/write access for every business entity in
SecureTrack ERP. This is the **Phase 1** data-access layer: one registry, one
engine, one API route ? with server-side permission checks and immutable audit
trails. Module pages continue to migrate onto it in later phases.

## Architecture

```
Entity registry  ???  CRUD engine  ???  /api/v2/crud/[entity]
(src/lib/metadata/          (src/lib/crud/          (src/app/api/v2/crud/[entity]/route.ts)
 entity-registry.ts)         crud-engine.ts)
        ?                        ?
        ? declares table,        ? enforces:
        ? module, permissions,   ?  ? session-derived tenant/company (never the body)
        ? lifecycle flags,       ?  ? per-action permission (registry slugs)
        ? searchable/sortable    ?  ? company_id + tenant_id filters on every query
        ?                        ?  ? row-level tenant/company assertion
        ?                        ?  ? blacklist stripping of identity/lifecycle fields
        ?                        ?  ? immutable audit row (audit_logs)
        ?                        ?  ? lifecycle workflow job enqueue (non-blocking)
```

### Flow

1. Client calls `GET|POST|PUT|DELETE /api/v2/crud/{entity}`.
2. `createApiHandler` authenticates the session (Supabase SSR), resolves the
   company/tenant from `user_profiles` + membership (`requireApiAuth`), and
   validates the body (zod).
3. The route resolves the entity name from the URL path and builds a
   `CrudScope` **from the session only**.
4. The engine resolves the entity from the registry and checks the permission
   that guards the action (`permissionForAction`).
5. Every query is filtered by `company_id` (and `tenant_id` when known) and
   every returned row is asserted to belong to the session scope.
6. Mutations strip client-supplied identity fields, re-derive them from the
   session, write an immutable `audit_logs` row, and enqueue lifecycle jobs.

## Entity Registry

`src/lib/metadata/entity-registry.ts` is the single source of truth. Registering
an entity there is the only step required to expose it through the API.

### Contract (enforced by `tests/security/v2-crud-permissions.test.ts`)

- `entity`, `table` ? lowercase `snake_case`, non-empty, unique table per entity.
- `module` ? one of the `EntityModule` values (`settings`, `hr`, `attendance`,
  `payroll`, `finance`, `inventory`, `procurement`, `crm`, `sales`, `sd`, `mes`,
  `fleet`, `ppm`, `ta`, `dispatch`, `print`, `notifications`, `wfm`, `assets`).
- `tenantScoped: true` ? every entity is company (and tenant) scoped.
- Non-empty `view/create/update/deletePermission` slugs for every entity.
- `searchable: string[]` and a resolvable default `sortable` column.
- `softDelete` implies `deletedColumn`; `archivedAt` implies an archive
  timestamp column.

### Registered entities (58)

| Entity | Table | Module | Soft delete | Archive | CreatedBy | UpdatedBy |
|---|---|---|---|---|---|---|
| `ast_assets` | `ast_assets` | assets | yes | no | yes | no |
| `attendance_records` | `attendance_records` | attendance | yes | no | no | no |
| `crm_activities` | `crm_activities` | crm | no | no | yes | no |
| `crm_contacts` | `crm_contacts` | crm | yes | no | no | no |
| `customers` | `customers` | crm | yes | yes | no | no |
| `sales_leads` | `sales_leads` | crm | yes | no | yes | yes |
| `sales_opportunities` | `sales_opportunities` | crm | yes | no | yes | yes |
| `dispatches` | `dispatches` | dispatch | yes | no | no | no |
| `ap_invoices` | `ap_invoices` | finance | yes | no | yes | no |
| `ap_payments` | `ap_payments` | finance | yes | no | yes | no |
| `ar_credit_notes` | `ar_credit_notes` | finance | yes | no | yes | no |
| `ar_receipts` | `ar_receipts` | finance | yes | no | yes | no |
| `bank_accounts` | `bank_accounts` | finance | yes | no | no | no |
| `bank_reconciliations` | `bank_reconciliations` | finance | yes | no | no | no |
| `budgets` | `budgets` | finance | yes | no | yes | no |
| `chart_of_accounts` | `chart_of_accounts` | finance | yes | yes | yes | no |
| `fin_approvals` | `fin_approvals` | finance | yes | no | no | no |
| `fin_tax_returns` | `fin_tax_returns` | finance | yes | no | no | no |
| `fixed_assets` | `fixed_assets` | finance | yes | no | yes | no |
| `gl_journals` | `gl_journals` | finance | yes | no | yes | no |
| `fleet_fuel_logs` | `fleet_fuel_logs` | fleet | yes | no | yes | no |
| `fleet_vehicles` | `fleet_vehicles` | fleet | yes | yes | yes | yes |
| `employees` | `employees` | hr | yes | yes | no | no |
| `leave_balances` | `leave_balances` | hr | no | no | no | no |
| `leave_requests` | `leave_requests` | hr | no | no | no | no |
| `performance_reviews` | `performance_reviews` | hr | no | no | no | no |
| `training_courses` | `training_courses` | hr | no | no | no | no |
| `training_enrollments` | `training_enrollments` | hr | no | no | no | no |
| `product_categories` | `product_categories` | inventory | no | no | no | no |
| `products` | `products` | inventory | yes | no | no | no |
| `stock_balances` | `stock_balances` | inventory | no | no | no | no |
| `warehouse_bins` | `warehouse_bins` | inventory | no | no | no | no |
| `warehouse_zones` | `warehouse_zones` | inventory | no | no | no | no |
| `warehouses` | `warehouses` | inventory | yes | no | no | no |
| `bom_headers` | `bom_headers` | mes | yes | no | no | no |
| `mes_production_orders` | `mes_production_orders` | mes | yes | yes | yes | yes |
| `mes_work_orders` | `mes_work_orders` | mes | yes | no | no | no |
| `notifications` | `notifications` | notifications | no | yes | yes | no |
| `pay_components` | `pay_components` | payroll | yes | no | no | no |
| `pay_loans` | `pay_loans` | payroll | yes | no | yes | no |
| `pay_payslips` | `pay_payslips` | payroll | no | no | no | no |
| `payroll_runs` | `payroll_runs` | payroll | yes | no | yes | no |
| `ppm_projects` | `ppm_projects` | ppm | yes | yes | yes | yes |
| `print_jobs` | `print_jobs` | print | yes | no | yes | no |
| `purchase_order_lines` | `purchase_order_lines` | procurement | no | no | no | no |
| `purchase_orders` | `purchase_orders` | procurement | no | no | yes | no |
| `purchase_requisitions` | `purchase_requisitions` | procurement | no | no | yes | no |
| `suppliers` | `suppliers` | procurement | yes | yes | yes | no |
| `invoices` | `invoices` | sales | yes | no | no | no |
| `quotations` | `quotations` | sales | yes | no | yes | yes |
| `sales_orders` | `sales_orders` | sales | yes | no | yes | yes |
| `support_tickets` | `support_tickets` | sd | yes | yes | yes | no |
| `branches` | `branches` | settings | yes | no | no | no |
| `departments` | `departments` | settings | yes | no | no | no |
| `ta_applications` | `ta_applications` | ta | yes | no | yes | yes |
| `ta_candidates` | `ta_candidates` | ta | yes | no | yes | yes |
| `ta_vacancies` | `ta_vacancies` | ta | yes | no | yes | yes |
| `shift_templates` | `shift_templates` | wfm | yes | no | no | no |

## API Reference ? `/api/v2/crud/[entity]`

### Authentication & authorization

- Every handler uses `createApiHandler` with `auth: true`,
  `allowPlatformAdmin: true`, and `requireMfa: "privileged"` (MFA is enforced
  for privileged roles when `MFA_ENFORCE_PRIVILEGED=true`).
- The permission that guards the action is resolved by the engine from the
  entity registry ? never from the client.

| Action | Method + params | Permission |
|---|---|---|
| List | `GET /api/v2/crud/{entity}?page=&pageSize=&sort=&order=&search=&includeDeleted=` | `view` |
| Get one | `GET /api/v2/crud/{entity}?id=<uuid>` | `view` |
| Export CSV | `GET /api/v2/crud/{entity}?export=csv[...]` | `view` |
| Export JSON | `GET /api/v2/crud/{entity}?export=json[...]` | `view` |
| Create | `POST /api/v2/crud/{entity}` | `create` |
| Update | `PUT /api/v2/crud/{entity}?id=<uuid>` | `update` |
| Delete | `DELETE /api/v2/crud/{entity}?id=<uuid>` | `delete` |
| Restore | `DELETE /api/v2/crud/{entity}?restore=1&id=<uuid>` | `delete` |
| Archive | `DELETE /api/v2/crud/{entity}?archive=1&id=<uuid>` | `delete` |
| Bulk | `DELETE /api/v2/crud/{entity}?bulk=1&ids=a,b,c[&restore=1|archive=1]` | `delete` |

### Query parameters (list/export)

- `page` (default 1), `pageSize` (default 25, max 100) ? pagination.
- `sort`, `order=asc|desc` ? column sort (defaults to the registry sortable
  column).
- `search` ? ilike across the registry `searchable` columns (sanitized).
- `includeDeleted=1` ? include soft-deleted rows.
- Any other query parameter becomes an equality filter (reserved keys are
  ignored): `GET /api/v2/crud/customers?status=active`.
- `filters=<json>` ? object filters (array values become `in` filters).

### Responses & errors

- Success: `{ data, total, page, pageSize }` (list) or `{ data }` (single),
  with `x-total-count` on lists/exports. CSV exports return
  `text/csv; charset=utf-8` with a `Content-Disposition` attachment header.
- Errors (`apiError` codes): `401` unauthenticated, `403` missing permission or
  cross-tenant/cross-company row, `404` unknown entity or missing row, `400`
  validation/DB constraint failure, `500` internal.

## Tenant enforcement (never trust the client)

- `tenant_id` / `company_id` in request bodies are **stripped** by the engine
  (`DEFAULT_WRITE_BLACKLIST`) and re-derived from the session scope.
- Every query filters by `company_id` and, when the session tenant is known,
  `tenant_id`.
- Every row returned is passed through `assertTenantAndCompany`; violations map
  to `CROSS_TENANT` / `CROSS_COMPANY` (403).
- Mutation endpoints reject client tenant spoofing via `rejectClientTenantSpoof`
  inside `createApiHandler` (body schema present).
- Platform admins bypass the permission check (like the rest of the platform
  control plane) but still operate on the session-derived company scope.

## Audit semantics

- All engine mutations append an **immutable** row to `audit_logs` (plural):
  `company_id`, `user_id` from the session; `action` (`{entity}.{action}`),
  `module`, `entity_type`, `entity_id` (UUID only) or `entity_reference`;
  `before_state` / `after_state`; `metadata`; `ip_address`; `user_agent`.
- Audit failures are logged and swallowed ? audit must never break the business
  operation. Audits are append-only by RLS policy (no update/delete grants).
- `POST /api/audit/log` is the client audit-ingestion endpoint. It derives
  actor, company and timestamp from the session and **ignores** any
  client-supplied `userId` / `companyId` / `clientTimestamp`.

## Lifecycle

- **Soft delete** (`softDelete: true`): sets `deleted_at` (plus
  `updated_by`/`updated_at` when present). Hard delete is used only for
  entities without soft delete.
- **Restore**: clears `deleted_at` and any archive flags.
- **Archive** (`archivedAt`): sets the archive timestamp and optional boolean
  column (e.g. `is_archived` on `notifications`).
- **Bulk**: per-id loop that reports `{ success: [], failed: [{id, error}] }`.
- **Workflows**: entity `workflows` (e.g. employee onboarding/update/offboarding)
  enqueue a tenant-scoped `generic` job via `enqueueJob` (non-blocking,
  best-effort).

## Import / export

- **Export**: `GET ?export=csv|json` ? reuses the list query builder (scoped,
  filtered, sanitized search), capped at 10 000 rows.
- **Import**: the engine strips identity fields per row, forces the session
  tenant/company, inserts the batch, enqueues an `import.batch` job and writes
  one audit row. Imports are exposed to the API surface through the same
  registry (import permission = `create`).

## Coverage & migration path

- This layer covers 58 business entities across 19 modules through one hardened
  API route with server-side authorization.
- Remaining work (later phases): migrate the ~423 page files that still call the
  browser Supabase client directly (`supabase.from(...)`) onto this engine, and
  add per-entity domain validators/workflows.
