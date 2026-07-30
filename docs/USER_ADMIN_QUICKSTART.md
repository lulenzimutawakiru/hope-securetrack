# SecureTrack ERP — User & Admin Quick Start

## Sign in
1. Open the app URL → **Sign in**  
2. Use company-issued credentials  
3. Enable **MFA** under Identity → Self-service if prompted  

## Company context
Use the **company switcher** in the header to change active company (multi-company groups).

## Core modules

| Need | Go to |
|------|--------|
| Finance / GL | Dashboard → Finance |
| Payroll | Dashboard → Payroll |
| Hire people | Dashboard → Talent Acquisition |
| Production | Dashboard → Production |
| Stock | Dashboard → Inventory |
| Buy | Dashboard → Procurement |
| Sell | Dashboard → Sales / CRM |
| Fleet | Dashboard → Fleet |
| Time clocks | Dashboard → Attendance |
| Dual approval | Dashboard → Dual Control |
| Platform ops | Dashboard → Platform Admin |

## Approvals
High-risk actions may require a **dual-control** request:
1. Maker creates request (Dual Control)  
2. Checker approves  
3. Execute API with `dual_control_id` when enforced  

## Customer portal
Share `/portal/{access_token}` links from Billing → Portal. Customers pay via gateway intent (webhook settles).

## Careers
Public careers at `/careers`. Applications land in Talent ATS.

## Admin checklist
- [ ] MFA on for finance/payroll/platform admins  
- [ ] Dual-control enabled in production  
- [ ] Public provision closed  
- [ ] Webhook secret set  
- [ ] Backups / PITR confirmed on Supabase  
