/**
 * SCIM 2.0 Users — basic provision / list for IdP push (Entra / Okta).
 * Auth: Bearer SCIM_BEARER_TOKEN or per-tenant token hash (future).
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { timingSafeEqualString } from "@/lib/security/shared";
import { ingressRateLimit } from "@/lib/security/public-ingress";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function scimError(status: number, detail: string, scimType?: string) {
  return NextResponse.json(
    {
      schemas: ["urn:ietf:params:scim:api:messages:2.0:Error"],
      detail,
      status: String(status),
      scimType,
    },
    { status }
  );
}

function authorize(req: NextRequest): boolean {
  const expected = process.env.SCIM_BEARER_TOKEN?.trim();
  if (!expected) return false;
  const auth = req.headers.get("authorization") || "";
  const token = auth.replace(/^Bearer\s+/i, "").trim();
  return Boolean(token) && timingSafeEqualString(token, expected);
}

function companyId(): string {
  return process.env.SCIM_DEFAULT_COMPANY_ID || process.env.DEFAULT_COMPANY_ID || "";
}

export async function GET(req: NextRequest) {
  const rl = await ingressRateLimit("scim-users", 60, 60_000, req);
  if (!rl.ok) return scimError(429, "Rate limit");
  if (!authorize(req)) return scimError(401, "Unauthorized");

  const admin = createAdminClient();
  const cid = companyId();
  const filter = req.nextUrl.searchParams.get("filter") || "";
  // userName eq "a@b.com"
  const emailMatch = filter.match(/userName\s+eq\s+"([^"]+)"/i);
  let q = admin
    .from("user_profiles")
    .select("id, email, first_name, last_name, is_active, created_at")
    .limit(100);
  if (cid) q = q.eq("company_id", cid);
  if (emailMatch?.[1]) q = q.eq("email", emailMatch[1].toLowerCase());

  const { data, error } = await q;
  if (error) return scimError(500, error.message);

  const Resources = (data || []).map((u) => ({
    schemas: ["urn:ietf:params:scim:schemas:core:2.0:User"],
    id: u.id,
    userName: u.email,
    name: {
      givenName: u.first_name,
      familyName: u.last_name,
    },
    active: u.is_active !== false,
    emails: [{ value: u.email, primary: true }],
    meta: {
      resourceType: "User",
      created: u.created_at,
    },
  }));

  return NextResponse.json({
    schemas: ["urn:ietf:params:scim:api:messages:2.0:ListResponse"],
    totalResults: Resources.length,
    startIndex: 1,
    itemsPerPage: Resources.length,
    Resources,
  });
}

export async function POST(req: NextRequest) {
  const rl = await ingressRateLimit("scim-users-post", 30, 60_000, req);
  if (!rl.ok) return scimError(429, "Rate limit");
  if (!authorize(req)) return scimError(401, "Unauthorized");

  const cid = companyId();
  if (!cid) return scimError(503, "SCIM_DEFAULT_COMPANY_ID not set");

  let body: {
    userName?: string;
    name?: { givenName?: string; familyName?: string };
    emails?: Array<{ value?: string }>;
    active?: boolean;
    externalId?: string;
  };
  try {
    body = await req.json();
  } catch {
    return scimError(400, "Invalid JSON");
  }

  const email = (
    body.userName ||
    body.emails?.[0]?.value ||
    ""
  )
    .toLowerCase()
    .trim();
  if (!email.includes("@")) return scimError(400, "userName/email required");

  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("user_profiles")
    .select("id, email, first_name, last_name, is_active")
    .eq("email", email)
    .maybeSingle();

  if (existing) {
    return NextResponse.json(
      {
        schemas: ["urn:ietf:params:scim:schemas:core:2.0:User"],
        id: existing.id,
        userName: existing.email,
        name: {
          givenName: existing.first_name,
          familyName: existing.last_name,
        },
        active: existing.is_active !== false,
        emails: [{ value: existing.email, primary: true }],
      },
      { status: 200 }
    );
  }

  const first = body.name?.givenName || email.split("@")[0];
  const last = body.name?.familyName || "";

  const { data: created, error } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { scim: true, externalId: body.externalId },
  });
  if (error || !created.user) {
    return scimError(400, error?.message || "Create failed");
  }

  await admin.from("user_profiles").upsert({
    id: created.user.id,
    email,
    company_id: cid,
    first_name: first,
    last_name: last,
    is_active: body.active !== false,
  });

  return NextResponse.json(
    {
      schemas: ["urn:ietf:params:scim:schemas:core:2.0:User"],
      id: created.user.id,
      userName: email,
      name: { givenName: first, familyName: last },
      active: body.active !== false,
      emails: [{ value: email, primary: true }],
      meta: { resourceType: "User" },
    },
    { status: 201 }
  );
}
