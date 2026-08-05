import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { provisionTenant } from "@/lib/platform/provision";
import { validateAdminPassword } from "@/lib/platform/onboarding";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { timingSafeEqualString } from "@/lib/security/shared";
import { ingressRateLimit } from "@/lib/security/public-ingress";
import { rateLimitStrict } from "@/lib/api";
import { verifyCaptcha } from "@/lib/providers/security/captcha";
import { providersConfig } from "@/lib/providers/config";

const bodySchema = z.object({
  organization_name: z.string().min(2).max(200),
  slug: z.string().min(2).max(60).optional(),
  admin_email: z.string().email().max(255),
  admin_name: z.string().min(1).max(150).optional(),
  admin_password: z.string().min(10).max(100),
  country_code: z.string().min(2).max(5).optional(),
  currency: z.string().min(3).max(10).optional(),
  timezone: z.string().min(2).max(60).optional(),
  industry: z.string().min(1).max(100).optional(),
  plan_code: z
    .enum(["starter", "professional", "enterprise", "government"])
    .optional(),
  /** Optional platform invite secret when PUBLIC_PROVISIONING is restricted */
  invite_code: z.string().max(200).optional(),
  /** Turnstile / CAPTCHA token when captcha is configured */
  captcha_token: z.string().max(4000).optional(),
});

/**
 * Tenant auto-provisioning.
 *
 * Gating (any of):
 * 1. PLATFORM_PROVISIONING_PUBLIC=true (open SaaS signup — rate limited)
 * 2. Valid PLATFORM_PROVISIONING_SECRET as invite_code
 * 3. Authenticated platform admin (staff, no tenant)
 *
 * Government plan never allowed via open public signup.
 */
export async function POST(req: Request) {
  try {
    const rl = await ingressRateLimit("provision", 5, 15 * 60_000, req);
    if (!rl.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: "RATE_LIMIT",
            message: "Too many provisioning attempts",
          },
        },
        { status: 429, headers: rl.response.headers }
      );
    }

    const json = await req.json();
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        {
          ok: false,
          error: { code: "VALIDATION", message: parsed.error.message },
        },
        { status: 400 }
      );
    }

    const pwd = validateAdminPassword(parsed.data.admin_password);
    if (!pwd.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: "VALIDATION",
            message: pwd.errors.join("; "),
          },
        },
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
          .select("is_platform_admin, tenant_id")
          .eq("id", user.id)
          .maybeSingle();
        isPlatformAdmin =
          Boolean(profile?.is_platform_admin) && !profile?.tenant_id;
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

    // CAPTCHA for unauthenticated public/invite signups when configured
    const captchaConfigured = providersConfig.turnstile.configured;
    if (captchaConfigured && !isPlatformAdmin) {
      const captcha = await verifyCaptcha({
        token: parsed.data.captcha_token || "",
        remoteIp:
          req.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() ||
          req.headers.get("x-forwarded-for")?.split(",").pop()?.trim() ||
          undefined,
      });
      if (!captcha.ok) {
        return NextResponse.json(
          {
            ok: false,
            error: {
              code: "CAPTCHA_REQUIRED",
              message: captcha.error || "Complete CAPTCHA to continue",
            },
          },
          { status: 400 }
        );
      }
    }

    // Never allow government plan via open public (no admin / no secret)
    let plan = parsed.data.plan_code || "starter";
    if (plan === "government" && !isPlatformAdmin && !inviteOk) {
      plan = "starter";
    }
    if (
      publicEnabled &&
      !isPlatformAdmin &&
      !inviteOk &&
      plan === "enterprise"
    ) {
      plan = "professional";
    }

    if (
      !process.env.SUPABASE_SERVICE_ROLE_KEY ||
      !process.env.NEXT_PUBLIC_SUPABASE_URL
    ) {
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

    const emailRl = await rateLimitStrict(
      `provision-email:${parsed.data.admin_email.toLowerCase()}`,
      3,
      60 * 60_000
    );
    if (!emailRl.allowed) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: "RATE_LIMIT",
            message: "This email has too many attempts",
          },
        },
        { status: 429 }
      );
    }

    const admin = createAdminClient();
    const result = await provisionTenant(admin, {
      ...parsed.data,
      plan_code: plan,
    });

    const adminStep = result.steps.find((st) => st.key === "admin");
    if (!adminStep || adminStep.status !== "completed") {
      throw new Error(
        "Administrator account could not be created; tenant was not provisioned"
      );
    }

    return NextResponse.json({
      ok: true,
      data: {
        job_code: result.job.job_code,
        tenant_id: result.tenantId,
        company_id: result.companyId,
        status: result.job.status,
        setup_path: "/dashboard/settings/setup",
        steps: result.steps.map((s) => ({
          key: s.key,
          label: s.label,
          status: s.status,
        })),
        message:
          "Tenant provisioned. Sign in with the administrator email, then complete the setup wizard.",
      },
    });
  } catch (e) {
    console.error("provision error", e);
    const message = e instanceof Error ? e.message : "Provisioning failed";
    // Map common preflight errors to 409 conflict
    const conflict =
      /already exists|slug/i.test(message) ||
      message.includes("administrator email already exists");
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: conflict ? "CONFLICT" : "PROVISION_FAILED",
          message,
        },
      },
      { status: conflict ? 409 : 500 }
    );
  }
}

/** Public config for the registration form (no secrets). */
export async function GET() {
  const publicEnabled = process.env.PLATFORM_PROVISIONING_PUBLIC === "true";
  const inviteRequired =
    !publicEnabled && Boolean(process.env.PLATFORM_PROVISIONING_SECRET?.trim());
  const captchaConfigured = providersConfig.turnstile.configured;
  const siteKey =
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ||
    process.env.NEXT_PUBLIC_CAPTCHA_SITE_KEY ||
    null;

  return NextResponse.json({
    ok: true,
    data: {
      public_enabled: publicEnabled,
      invite_required: inviteRequired,
      captcha_required: captchaConfigured && (publicEnabled || inviteRequired),
      captcha_site_key: captchaConfigured ? siteKey : null,
      password_policy: {
        min_length: 10,
        require_uppercase: true,
        require_number: true,
        require_special: true,
      },
      plans: [
        { code: "starter", label: "Starter (30-day trial)" },
        { code: "professional", label: "Professional" },
        { code: "enterprise", label: "Enterprise" },
      ],
    },
  });
}
