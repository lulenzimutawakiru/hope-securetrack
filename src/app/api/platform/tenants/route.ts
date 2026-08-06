/**
 * Platform cPanel — tenant directory + create (SecureTrack staff only).
 *
 * GET  — list tenants / overview
 * POST — create tenant (full provision with admin user)
 */

import { z } from "zod";
import { createApiHandler, apiOk, apiError } from "@/lib/api/handler";
import {
  cpanelListTenants,
  cpanelOverview,
  cpanelCreateTenant,
  cpanelSuggestSlug,
} from "@/lib/platform/cpanel";
import { staffCanAccess } from "@/lib/platform";
import { validateAdminPassword } from "@/lib/platform/onboarding";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";


export const GET = createApiHandler(
  {
    auth: true,
    permissions: ["platform.view", "platform.admin", "platform.tenants"],
    allowPlatformAdmin: true,
    requireMfa: "privileged",
    module: "platform-cpanel",
    rateLimit: { limit: 60, windowMs: 60_000 },
  },
  async ({ ctx, req }) => {
    if (!ctx) return apiError("UNAUTHORIZED", "Sign in required", 401);
    if (!staffCanAccess(ctx, "tenants")) {
      return apiError(
        "FORBIDDEN",
        "Platform staff only — tenant cPanel is not available to tenant users",
        403
      );
    }

    const { searchParams } = new URL(req.url);
    if (searchParams.get("overview") === "1") {
      const overview = await cpanelOverview();
      return apiOk(overview);
    }
    if (searchParams.get("suggest_slug")) {
      const slug = await cpanelSuggestSlug(
        searchParams.get("suggest_slug") || "tenant"
      );
      return apiOk({ slug });
    }

    const tenants = await cpanelListTenants({
      search: searchParams.get("search") || undefined,
      status: searchParams.get("status") || undefined,
      plan: searchParams.get("plan") || undefined,
      limit: Number(searchParams.get("limit") || 200),
    });
    return apiOk({ tenants, count: tenants.length });
  }
);

const createSchema = z.object({
  organization_name: z.string().min(2).max(200),
  slug: z.string().min(2).max(60).optional(),
  admin_email: z.string().email().max(255),
  admin_name: z.string().min(1).max(150).optional(),
  admin_password: z.string().min(10).max(100),
  country_code: z.string().min(2).max(5).optional(),
  currency: z.string().min(3).max(10).optional(),
  timezone: z.string().min(2).max(60).optional(),
  industry: z.string().max(100).optional(),
  language: z.string().min(2).max(10).optional(),
  data_region: z.string().min(2).max(40).optional(),
  domain: z.string().max(120).optional(),
  compliance_requirements: z.array(z.string().max(40)).max(20).optional(),
  seats: z.number().int().min(1).max(100000).optional(),
  modules: z.array(z.string().max(60)).max(100).optional(),
  plan_code: z
    .enum(["starter", "professional", "enterprise", "government"])
    .optional(),
});

/** Create tenant — full provision (org + company + admin). */
export const POST = createApiHandler(
  {
    auth: true,
    permissions: [
      "platform.admin",
      "platform.provision",
      "platform.tenants",
      "tenant.manage",
    ],
    allowPlatformAdmin: true,
    requireMfa: "privileged",
    bodySchema: createSchema,
    module: "platform-cpanel",
    rateLimit: { limit: 20, windowMs: 60_000 },
  },
  async ({ ctx, body }) => {
    if (!ctx) return apiError("UNAUTHORIZED", "Sign in required", 401);
    if (!staffCanAccess(ctx, "provisioning")) {
      return apiError("FORBIDDEN", "Platform staff only", 403);
    }

    const input = body as z.infer<typeof createSchema>;
    const pwd = validateAdminPassword(input.admin_password);
    if (!pwd.ok) {
      return apiError("VALIDATION", pwd.errors.join("; "), 400);
    }

    try {
      const created = await cpanelCreateTenant(input, ctx.user.id);
      return apiOk({
        tenantId: created.tenantId,
        companyId: created.companyId,
        jobCode: created.jobCode,
        slug: created.slug,
        domain: created.domain,
        // Returned once — store in vault; not persisted in DB as plaintext
        encryption_secret_once: created.encryption_secret_once,
        message:
          "Tenant created. Vault the encryption secret now. Admin can sign in with the provided email and password.",
        workflow: [
          "Create Tenant",
          "Create Database Namespace",
          "Create Default Roles",
          "Create Admin Account",
          "Enable Modules",
          "Apply Branding",
          "Send Welcome Email",
          "Tenant Ready",
        ],
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Create failed";
      const conflict =
        /already exists|slug|duplicate/i.test(msg) ||
        msg.includes("administrator email already exists");
      return apiError(conflict ? "VALIDATION" : "INTERNAL", msg, conflict ? 409 : 500);
    }
  }
);


