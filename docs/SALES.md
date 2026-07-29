# Advanced Sales Platform

Enterprise **quote-to-cash** sales for Hope SecureTrack ERP.

## Lifecycle

Lead → Opportunity → Quotation → Order → Credit → Inventory/Production → Delivery → Invoice → Payment → Support

## Capabilities

| Area | Features |
|------|----------|
| **Pipeline** | Leads, opportunities, activities, call logs, competitors, live board |
| **Quoting** | Quotations, quote lines, price lists, price items, discount rules, promotions |
| **Orders** | Sales orders, order lines, approvals, blanket/contract orders |
| **Credit** | Credit reviews, holds, payment terms |
| **Contracts** | Framework contracts, contract lines, rebates |
| **Territory** | Territories, sales teams, channels |
| **Field** | Visit plans, samples, GPS visit data |
| **Revenue** | Forecasts, targets, commissions, accruals |
| **After-sales** | Returns/RMA, return lines, support tickets |
| **Analytics** | Reports, AI insights, insight store |
| **System** | Documents, notifications, audit log, settings |

## Permissions

- `sales.view` / `sales.manage`
- `sales.pipeline` · `sales.quotes` · `sales.credit` · `sales.returns`
- `sales.commissions` · `sales.pricing` · `sales.contracts`
- `sales.forecast` · `sales.ai` · `sales.admin`

## Data model (selected)

Legacy (00003 / 00006): `sales_orders`, `sales_order_lines`, `sales_leads`, `sales_opportunities`, `quotations`, `quotation_lines`, `sales_territories`, `credit_reviews`, `sales_returns`, `sales_commissions`, `sales_insights`, `support_tickets`

Advanced (00059): `sales_teams`, `sales_channels`, `sales_price_lists`, `sales_price_items`, `sales_discount_rules`, `sales_promotions`, `sales_contracts`, `sales_contract_lines`, `sales_rebates`, `sales_activities`, `sales_visit_plans`, `sales_call_logs`, `sales_competitors`, `sales_samples`, `sales_forecasts`, `sales_targets`, `sales_order_approvals`, `sales_documents`, `sales_notifications`, `sales_settings`, `sales_ai_insights`, `sales_audit_log`

## UI

- Hub: `/dashboard/sales`
- Specialized: `/dashboard/sales/orders`, `quotations`, `pipeline`, `credit`, `returns`, `commissions`
- Entity CRUD: remaining routes under `/dashboard/sales/*` via `SalesEntityPage`
- AI: `/dashboard/sales/ai`

## Lib

`src/lib/sales/` — `menu`, `entities`, `crud`, `service`, `ai`, `types`

## Soft delete

Major sales tables support `deleted_at` and appear in the Recycle Bin where registered.
