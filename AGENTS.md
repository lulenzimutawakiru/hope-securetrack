\# SecureTrack ERP Development Instructions



\## Project

SecureTrack ERP Enterprise Multi-Tenant ERP Platform



\## Architecture



Frontend:

\- Next.js App Router

\- TypeScript

\- React

\- Tailwind

\- shadcn/ui



Backend:

\- Supabase PostgreSQL

\- Supabase Auth

\- Supabase Storage

\- Realtime



Deployment:

\- Vercel



\---



\# Critical Security Rules



\## Multi-Tenant Isolation (MANDATORY)



SecureTrack ERP is a SaaS platform.



Never allow tenant data leakage.



Every business table must contain:



\- tenant\_id

\- company\_id

\- branch\_id where applicable



Every database query must enforce tenant isolation.



Never trust:



\- URL tenant IDs

\- Client supplied company IDs

\- Request body tenant values



Tenant context must come from authenticated session.



\---



\# Database Rules



Every new table requires:



\- Primary key

\- tenant\_id

\- created\_at

\- updated\_at

\- created\_by

\- updated\_by



Enable:



\- Row Level Security

\- Audit triggers

\- Soft delete where required



Never disable RLS.



\---



\# API Rules



Every API endpoint must implement:



Authentication



Authorization



Tenant validation



Permission checks



Input validation



Audit logging



Rate limiting where required





\---



\# CRUD Standards



Every module must support:



Create

Read

Update

Delete

Restore

Archive

Import

Export

Bulk operations

Attachments

Comments

Audit history





\---



\# ERP Modules



Maintain integration between:



\- Finance

\- Accounting

\- HR

\- Payroll

\- Recruitment

\- Inventory

\- Procurement

\- CRM

\- Sales

\- Manufacturing

\- Fleet

\- Projects

\- Workforce

\- Identity

\- Reporting





\---



\# Code Quality



Always produce:



\- Production-ready code

\- TypeScript types

\- Validation

\- Error handling

\- Tests

\- Documentation



Do not create:



\- Mock implementations

\- Placeholder pages

\- Hardcoded IDs

\- Temporary fixes



\---



\# Security Standards



Follow:



OWASP Top 10



OWASP API Security Top 10



OWASP ASVS



ISO 27001 principles



NIST Cybersecurity Framework





\---



\# AI Rules



AI features must:



\- Be tenant isolated

\- Respect permissions

\- Never expose confidential data

\- Keep audit logs

\- Require approval for sensitive actions





\---



\# Before modifying code



First analyze:



\- Existing architecture

\- Database schema

\- Dependencies

\- Security impact



Explain changes before implementation.

