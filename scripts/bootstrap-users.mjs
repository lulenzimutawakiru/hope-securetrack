#!/usr/bin/env node
/**
 * SecureTrack ERP — Bootstrap initial users.
 *
 * Creates users in Supabase Auth and links them via user_profiles, following
 * the deployment guide (docs/DEPLOYMENT.md → "First users").
 *
 *  1. Creates the auth user with the service-role admin API (email confirmed,
 *     temporary password set by the operator — never auto-generated).
 *  2. Upserts the user_profiles row scoped to the tenant/company (tenant_id,
 *     company_id, branch_id, role_id) — idempotent.
 *  3. Records the primary role in idm_user_roles and an idm_audit entry.
 *
 * Tenant admins created this way can then provision further users directly in
 * the app (Identity → User directory → Create account).
 *
 * Usage:
 *   node scripts/bootstrap-users.mjs <email> <first> <last> --password <pw> [options]
 *
 * Options:
 *   --tenant <slug>       tenant slug (default: hope-design)
 *   --company <code>      company code within the tenant (default: primary company)
 *   --branch <code>       branch code within the company (default: first active branch)
 *   --role <slug>         role slug (default: super_administrator)
 *   --staff               create a SecureTrack staff platform admin (no tenant)
 *   --platform-role <r>   staff only: owner|cto|security|devops|compliance
 *   --dry-run             resolve everything and report, but write nothing
 *
 * Credentials: SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY from .env.local
 * (or the environment). Service role is required because user creation is an
 * admin operation and the RLS guard trigger permits service-role writes
 * (auth.uid() IS NULL).
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

function loadEnv() {
  const envFile = path.join(root, ".env.local");
  if (fs.existsSync(envFile)) {
    for (const line of fs.readFileSync(envFile, "utf8").split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq > 0) process.env[trimmed.slice(0, eq).trim()] ??= trimmed.slice(eq + 1).trim();
    }
  }
}

function argValue(args, flag) {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : undefined;
}

const args = process.argv.slice(2);
const email = (args[0] || "").toLowerCase().trim();
const firstName = args[1];
const lastName = args[2];
const password = argValue(args, "--password");
const tenantSlug = argValue(args, "--tenant") || "hope-design";
const companyCode = argValue(args, "--company");
const branchCode = argValue(args, "--branch");
const roleSlug = argValue(args, "--role") || "super_administrator";
const platformRole = argValue(args, "--platform-role");
const staff = args.includes("--staff");
const dryRun = args.includes("--dry-run");

if (!email || !firstName || !lastName || !password) {
  console.error("Usage: node scripts/bootstrap-users.mjs <email> <first> <last> --password <pw> [--tenant <slug>] [--company <code>] [--branch <code>] [--role <slug>] [--staff] [--platform-role <r>] [--dry-run]");
  console.error("--password is required so accounts are never created with a lost random password.");
  process.exit(1);
}
if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
  console.error(`Invalid email: ${email}`);
  process.exit(1);
}
if (password.length < 10) {
  console.error("Password must be at least 10 characters (app policy enforces uppercase/number/special).");
  process.exit(1);
}
if (platformRole && !staff) {
  console.error("--platform-role requires --staff.");
  process.exit(1);
}

loadEnv();

const url = (process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "").replace(/\/$/, "");
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

if (!url || !serviceKey) {
  console.error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (checked .env.local).");
  process.exit(1);
}

const jsonHeaders = {
  "Content-Type": "application/json",
  apikey: serviceKey,
  Authorization: `Bearer ${serviceKey}`,
};

async function resolveRow(table, filter, select = "*") {
  const res = await fetch(`${url}/rest/v1/${table}?${filter}&select=${select}`, { headers: jsonHeaders });
  if (!res.ok) throw new Error(`resolve ${table} [${filter}] -> ${res.status}`);
  const rows = await res.json();
  return rows[0] || null;
}

async function main() {
  const tenant = staff ? null : await resolveRow("tenants", `slug=eq.${encodeURIComponent(tenantSlug)}`);
  if (!staff && !tenant) throw new Error(`Tenant '${tenantSlug}' not found.`);

  let company = null;
  if (staff) {
    company = await resolveRow("companies", "code=eq.SECURETRACK-STAFF");
    if (!company) throw new Error("Staff company SECURETRACK-STAFF not found.");
  } else if (companyCode) {
    // Scope the code lookup to the tenant so a code can never resolve to a
    // company owned by a different tenant.
    company = await resolveRow(
      "companies",
      `tenant_id=eq.${tenant.id}&code=eq.${encodeURIComponent(companyCode)}`,
      "id,name,code,tenant_id,is_primary"
    );
    if (!company) throw new Error(`Company code '${companyCode}' not found in tenant '${tenantSlug}'.`);
  } else {
    // Prefer the tenant's primary company, then fall back to its oldest.
    company = await resolveRow(
      "companies",
      `tenant_id=eq.${tenant.id}&is_primary=eq.true`,
      "id,name,code,tenant_id,is_primary"
    );
    if (!company) {
      company = await resolveRow(
        "companies",
        `tenant_id=eq.${tenant.id}&order=created_at.asc`,
        "id,name,code,tenant_id,is_primary"
      );
    }
    if (!company) {
      throw new Error(`No company found for tenant '${tenantSlug}'. Pass --company <code>.`);
    }
  }

  const role = await resolveRow("roles", `slug=eq.${encodeURIComponent(roleSlug)}&company_id=is.null`);
  if (!role) throw new Error(`Role '${roleSlug}' (global) not found.`);

  let branch = null;
  if (!staff) {
    const filter = branchCode
      ? `company_id=eq.${company.id}&code=eq.${encodeURIComponent(branchCode)}&is_active=eq.true`
      : `company_id=eq.${company.id}&is_active=eq.true&order=created_at.asc`;
    branch = await resolveRow("branches", filter, "id,name,code,is_active");
  }

  console.log(`Context: ${staff ? "staff" : "tenant"} user → ${tenant ? `tenant ${tenant.slug} (${tenant.id})` : "no tenant"}`);
  console.log(`         company ${company.code} (${company.id})${branch ? ` · branch ${branch.code} (${branch.id})` : ""}`);
  console.log(`         role ${role.slug} (${role.id})`);

  // 1. Resolve (or create) the auth user.
  let userId = null;
  const listRes = await fetch(`${url}/auth/v1/admin/users?page=1&per_page=200`, { headers: jsonHeaders });
  if (!listRes.ok) throw new Error(`list users -> ${listRes.status}`);
  const users = await listRes.json();
  userId = users.users?.find((u) => u.email?.toLowerCase() === email)?.id || null;

  if (!userId) {
    if (dryRun) {
      console.log(`[dry-run] Would create auth user ${email}`);
    } else {
      const created = await fetch(`${url}/auth/v1/admin/users`, {
        method: "POST",
        headers: jsonHeaders,
        body: JSON.stringify({
          email,
          password,
          email_confirm: true,
          user_metadata: {
            first_name: firstName,
            last_name: lastName,
            provisioned: true,
            bootstrap: true,
            ...(staff ? { staff: true } : {}),
          },
        }),
      });
      const createdBody = await created.json();
      if (!created.ok) throw new Error(`create auth user -> ${created.status}: ${JSON.stringify(createdBody)}`);
      userId = createdBody.id;
      console.log(`+ Created auth user ${email} (${userId})`);
    }
  } else {
    console.log(`= Auth user ${email} already exists (${userId})`);
  }

  const isAdmin = role.slug === "super_administrator" || role.slug === "administrator" || role.slug === "platform_admin";
  const profile = {
    id: userId,
    company_id: company.id,
    active_company_id: company.id,
    tenant_id: staff ? null : tenant.id,
    branch_id: staff ? null : branch?.id || null,
    role_id: role.id,
    first_name: firstName,
    last_name: lastName,
    email,
    is_active: true,
    account_status: "active",
    lifecycle_status: "active",
    user_type: staff ? "employee" : isAdmin ? "administrator" : "employee",
    user_kind: "internal",
    data_scope: "company",
    provisioned_from: "bootstrap",
    require_mfa: isAdmin,
    mfa_enforced: isAdmin,
    must_change_password: true,
    temp_password_set: true,
    password_changed_at: new Date().toISOString(),
    password_expires_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
    is_platform_admin: staff,
    ...(staff && platformRole ? { platform_role: platformRole } : {}),
    updated_at: new Date().toISOString(),
  };

  if (dryRun || !userId) {
    if (dryRun && userId) {
      console.log(`[dry-run] Would upsert user_profiles: ${JSON.stringify(profile, null, 2)}`);
    }
    console.log("Dry run complete — nothing written.");
    return;
  }

  // 2. Link the profile (idempotent).
  const upsertRes = await fetch(`${url}/rest/v1/user_profiles?on_conflict=id`, {
    method: "POST",
    headers: {
      ...jsonHeaders,
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify(profile),
  });
  if (!upsertRes.ok) {
    const text = await upsertRes.text();
    throw new Error(`upsert user_profiles -> ${upsertRes.status}: ${text}`);
  }
  console.log(`+ Upserted profile for ${email} (company ${company.id}, tenant ${profile.tenant_id || "staff"}, role ${role.slug})`);

  // 3. Primary role assignment (idempotent).
  const roleRes = await fetch(`${url}/rest/v1/idm_user_roles?on_conflict=user_id,role_id`, {
    method: "POST",
    headers: {
      ...jsonHeaders,
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify({
      company_id: company.id,
      user_id: userId,
      role_id: role.id,
      is_primary: true,
    }),
  });
  if (!roleRes.ok) {
    const text = await roleRes.text();
    throw new Error(`upsert idm_user_roles -> ${roleRes.status}: ${text}`);
  }
  console.log(`+ Assigned primary role ${role.slug}`);

  // 4. Audit trail.
  await fetch(`${url}/rest/v1/idm_audit`, {
    method: "POST",
    headers: { ...jsonHeaders, Prefer: "return=minimal" },
    body: JSON.stringify({
      company_id: company.id,
      actor_id: null,
      target_user_id: userId,
      action: "provision",
      details: `Bootstrapped ${staff ? "staff platform" : "tenant"} user ${email} (${role.slug})`,
      metadata: { source: "bootstrap-users" },
    }),
  });

  console.log(`\nDone. ${email} is ready to sign in at /login.`);
  console.log("Next steps:");
  console.log(" - The account enforces a password change on first login.");
  console.log(" - Enable MFA (TOTP) under Identity → Self-service for this account.");
  if (staff) {
    console.log(" - SecureTrack staff land on the Control Plane at /platform.");
  } else {
    console.log(" - Tenant admins can create more users at Identity → Create account (direct activation).");
  }
}

main().catch((err) => {
  console.error(`\nBootstrap failed: ${err.message}`);
  process.exit(1);
});
