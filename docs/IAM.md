# Enterprise User & Identity Management — SecureTrack ERP

**Security foundation of SecureTrack ERP**  
**Deployment:** Cloud · On-Premise · Hybrid  

## Architecture

```
Identity Provider → Authentication → MFA → Role & Permission Engine
  → Session Management → ERP Modules → Audit & Security Monitoring
```

## Routes

| Area | Path |
|------|------|
| Identity hub | `/dashboard/identity` |
| User directory | `/dashboard/identity/users` |
| Roles (RBAC) | `/dashboard/identity/roles` |
| Permissions | `/dashboard/identity/permissions` |
| Sessions | `/dashboard/identity/sessions` |
| Security alerts & logins | `/dashboard/identity/security` |
| Password/session policy | `/dashboard/identity/policies` |
| Approval authority matrix | `/dashboard/identity/approvals` |
| Audit logs | `/dashboard/audit` |

## Capabilities delivered

- Centralized `user_profiles` with lifecycle, external user kinds, lockout
- RBAC via `roles` / `permissions` / `role_permissions`
- Login history + failed attempt lockout + security alerts
- Session registry with remote revoke
- Company security policies
- Approval limits (SoD foundation)
- Role change audit (`user_role_changes`)
- RLS on all IAM tables

## Authentication notes

- Primary: Supabase Auth (email/password)
- MFA: Supabase TOTP / optional SMS (configure in Supabase Auth)
- SSO (Entra ID / Google / SAML): configure Supabase Auth providers
- Login events recorded via `record_login_event` RPC

## Compliance alignment

- Least privilege & segregation of duties
- Immutable audit logs
- Uganda Data Protection and Privacy Act readiness (access control + logging)
- ISO 27001 access control practices
