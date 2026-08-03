#!/usr/bin/env node
/**
 * SecureTrack ERP - Bootstrap a SecureTrack staff platform admin.
 *
 * Platform admin is the SecureTrack control plane and is restricted to
 * SecureTrack staff: a flagged user_profiles row (is_platform_admin = true)
 * with tenant_id IS NULL. Tenant super admins can never be platform admins
 * (enforced in the DB by is_platform_admin() and the
 * guard_profile_privilege_columns trigger, and in the app by requireApiAuth
 * and the /dashboard/platform layout gate).
 *
 * This script is idempotent and creates:
 *   1. the auth user (if the email does not already exist),
 *   2. the user_profiles row scoped to the SecureTrack staff company and the
 *      global platform_admin role.
 *
 * Usage:
 *   node scripts/bootstrap-platform-staff.mjs <email> <first> <last> [--password <pw>]
 *
 * Credentials: SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY from .env.local
 * (or the environment). The service role is required because user creation
 * is an admin operation and the RLS guard trigger permits service-role
 * writes (auth.uid() IS NULL).
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

const args = process.argv.slice(2);
const email = args[0];
const firstName = args[1];
const lastName = args[2];
const passwordFlag = args.indexOf("--password");
const password = passwordFlag >= 0 ? args[passwordFlag + 1] : undefined;

if (!email || !firstName || !lastName) {
  console.error("Usage: node scripts/bootstrap-platform-staff.mjs <email> <first> <last> [--password <pw>]");
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

async function resolveRow(table, filter, select = "id") {
  const res = await fetch(`${url}/rest/v1/${table}?${filter}&select=${select}`, { headers: jsonHeaders });
  if (!res.ok) throw new Error(`resolve ${table} [${filter}] -> ${res.status}`);
  const rows = await res.json();
  return rows[0] || null;
}

async function main() {
  const company = await resolveRow("companies", "code=eq.SECURETRACK-STAFF");
  if (!company) throw new Error("Staff company SECURETRACK-STAFF not found. Run migration 20260805000001 first.");

  const role = await resolveRow("roles", "slug=eq.platform_admin&company_id=is.null");
  if (!role) throw new Error("platform_admin role not found. Run migration 20260805000001 first.");

  // 1. Create the auth user if missing.
  let userId = null;
  const listRes = await fetch(`${url}/auth/v1/admin/users?page=1&per_page=200`, { headers: jsonHeaders });
  if (!listRes.ok) throw new Error(`list users -> ${listRes.status}`);
  const users = await listRes.json();
  userId = users.users?.find((u) => u.email?.toLowerCase() === email.toLowerCase())?.id || null;

  if (!userId) {
    const created = await fetch(`${url}/auth/v1/admin/users`, {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({
        email,
        password: password || `${crypto.randomUUID().slice(0, 12)}!A1`,
        email_confirm: true,
        user_metadata: { full_name: `${firstName} ${lastName}`, staff: true },
      }),
    });
    const createdBody = await created.json();
    if (!created.ok) throw new Error(`create auth user -> ${created.status}: ${JSON.stringify(createdBody)}`);
    userId = createdBody.id;
    console.log(`+ Created auth user ${email} (${userId})`);
  } else {
    console.log(`= Auth user ${email} already exists (${userId})`);
  }

  // 2. Upsert the staff profile (flagged, tenant-less) - idempotent.
  const profile = {
    id: userId,
    company_id: company.id,
    active_company_id: company.id,
    tenant_id: null,
    role_id: role.id,
    first_name: firstName,
    last_name: lastName,
    email,
    is_active: true,
    is_platform_admin: true,
  };
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
  console.log(`+ Upserted staff profile for ${email} (company ${company.id}, role ${role.id})`);

  console.log("\nDone. SecureTrack staff platform admin is ready.");
  console.log("Next steps:");
  console.log(" - Set a strong password and enforce MFA (TOTP) for this account.");
  console.log(" - Sign in at /login; the platform control plane is at /dashboard/platform.");
}

main().catch((err) => {
  console.error(`\nBootstrap failed: ${err.message}`);
  process.exit(1);
});