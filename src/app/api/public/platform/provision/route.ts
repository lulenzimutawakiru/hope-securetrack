import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { provisionTenant } from "@/lib/platform/provision";
import { z } from "zod";
import { clientIp, rateLimit } from "@/lib/api";
import { createClient } from "@/lib/supabase/server";
import { timingSafeEqualString } from "@/lib/security/shared";

const bodySchema = z.object({
  organization_name: z.string().min(2).max(200),
  slug: z.string().min(2).max(60).optional(),
  admin_email: z.string().email(),
  admin_name: z.string().min(1).max(150).optional(),
  admin_password: z.string().min(8).max(100).optional(),
  country_code: z.string().min(2).max(5).optional(),
  currency: z.string().min(3).max(10).optional(),
  plan_code: z.enum(["starter", "professional", "enterprise", "government"]).optional(),
  /** Optional platform invite secret when PUBLIC_PROVISIONING is restricted */
  invite_code: z.string().optional(),
});

/**
 * Tenant auto-provisioning.
 *
 * Gating (any of):
 * 1. PLATFORM_PROVISIONING_PUBLIC=true (open SaaS signup — rate limited)
 * 2. Valid PLATFORM_PROVISIONING_SECRET as invite_code
 * 3. Authenticated platform admin / super_administrator
 *
 * Government plan never allowed via open public signup.
 */
export async function POST(req: Request) {
  try {
    const ip = clientIp(req);
    const rl = rateLimit(`provision:${ip}`, 5, 15 * 60_000);
    if (!rl.allowed) {
      return NextResponse.json(
        { ok: false, error: { code: "RATE_LIMIT", message: "Too many provisioning attempts" } },
        { status: 429, headers: { "Retry-After": String(rl.retryAfterSec || 900) } }
      );
    }

    const json = await req.json();
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: { code: "VALIDATION", message: parsed.error.message } },
        { status: 400 }
      );
    }

    const publicEnabled = process.env.PLATFORM_PROVISIONING_PUBLIC === "true";
    const secret = process.env.PLATFORM_PROVISIONING_SECRET?.trim();
    const inviteOk = Boolean(
      secret &&
        parsed.data.invite_code &&
        timingSafeEqualString(parsed.data.invite_code, secret)
    );

    let isPlatformAdmin = false;
    try {
      const supabase = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from("user_profiles")
          .select("is_platform_admin, roles!user_profiles_role_id_fkey(slug)")
          .eq("id", user.id)
          .maybeSingle();
        const slug = (profile?.roles as { slug?: string } | null)?.slug;
        isPlatformAdmin =
          Boolean(profile?.is_platform_admin) || slug === "super_administrator";
      }
    } catch {
      /* no session */
    }

    if (!publicEnabled && !inviteOk && !isPlatformAdmin) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: "FORBIDDEN",
            message:
              "Public provisioning is disabled. Use an invite code or sign in as platform admin.",
          },
        },
        { status: 403 }
      );
    }

    // Never allow government plan via open public (no admin / no secret)
    let plan = parsed.data.plan_code || "starter";
    if (plan === "government" && !isPlatformAdmin && !inviteOk) {
      plan = "starter";
    }
    // Open public defaults to starter/professional only
    if (publicEnabled && !isPlatformAdmin && !inviteOk && plan === "enterprise") {
      plan = "professional";
    }

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.NEXT_PUBLIC_SUPABASE_URL) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: "CONFIG",
            message: "Service role not configured for provisioning",
          },
        },
        { status: 503 }
      );
    }

    // Soft rate by email domain
    const emailRl = rateLimit(`provision-email:${parsed.data.admin_email.toLowerCase()}`, 3, 60 * 60_000);
    if (!emailRl.allowed) {
      return NextResponse.json(
        { ok: false, error: { code: "RATE_LIMIT", message: "This email has too many attempts" } },
        { status: 429 }
      );
    }

    const admin = createAdminClient();
    const result = await provisionTenant(admin, {
      ...parsed.data,
      plan_code: plan,
    });

    return NextResponse.json({
      ok: true,
      data: {
        job_code: result.job.job_code,
        tenant_id: result.tenantId,
        company_id: result.companyId,
        status: result.job.status,
        steps: result.steps.map((s) => ({
          key: s.key,
          label: s.label,
          status: s.status,
        })),
        message:
          "Tenant provisioned. Sign in with the administrator email.",
      },
    });
  } catch (e) {
    console.error("provision error", e);
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "PROVISION_FAILED",
          message: e instanceof Error ? e.message : "Provisioning failed",
        },
      },
      { status: 500 }
    );
  }
}
