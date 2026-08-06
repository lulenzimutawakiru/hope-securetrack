/**
 * Cross-tenant company directory (platform staff).
 */

import { createApiHandler, apiOk, apiError } from "@/lib/api/handler";
import { staffCanAccess } from "@/lib/platform";
import { listAllCompanies } from "@/lib/platform/control-plane";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const GET = createApiHandler(
  {
    auth: true,
    permissions: ["platform.view", "platform.admin", "platform.tenants"],
    allowPlatformAdmin: true,
    requireMfa: "privileged",
    module: "platform-control-plane",
    rateLimit: { limit: 40, windowMs: 60_000 },
  },
  async ({ ctx, req }) => {
    if (!ctx) return apiError("UNAUTHORIZED", "Sign in required", 401);
    if (!staffCanAccess(ctx, "companies")) {
      return apiError(
        "FORBIDDEN",
        "Access denied by control-plane Access Matrix (capability: companies)",
        403
      );
    }
    const { searchParams } = new URL(req.url);
    try {
      const companies = await listAllCompanies({
        search: searchParams.get("search") || undefined,
        tenantId: searchParams.get("tenant_id") || undefined,
        limit: Number(searchParams.get("limit") || 200),
      });
      return apiOk({ companies, count: companies.length });
    } catch (e) {
      return apiError(
        "INTERNAL",
        e instanceof Error ? e.message : "Failed to list companies",
        500
      );
    }
  }
);

