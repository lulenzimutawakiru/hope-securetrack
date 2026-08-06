/**
 * Provisioning template catalog - tenant templates + industry packs.
 */

import { createApiHandler, apiOk, apiError } from "@/lib/api/handler";
import { staffCanAccess } from "@/lib/platform";
import {
  getTemplate,
  listTemplates,
} from "@/lib/platform/provisioning/service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const GET = createApiHandler(
  {
    auth: true,
    permissions: ["platform.admin", "platform.provision", "platform.tenants"],
    allowPlatformAdmin: true,
    requireMfa: "privileged",
    module: "platform-provisioning",
    rateLimit: { limit: 60, windowMs: 60_000 },
  },
  async ({ ctx, req }) => {
    if (!ctx) return apiError("UNAUTHORIZED", "Sign in required", 401);
    if (!staffCanAccess(ctx, "provisioning")) {
      return apiError("FORBIDDEN", "Platform staff only", 403);
    }
    const { searchParams } = new URL(req.url);
    const code = searchParams.get("code");
    if (code) {
      const template = await getTemplate(code);
      if (!template) {
        return apiError("NOT_FOUND", "Template not found", 404);
      }
      return apiOk({ template });
    }
    const kind = searchParams.get("kind");
    const templates = await listTemplates({
      kind: kind === "industry" || kind === "tenant" ? kind : undefined,
    });
    return apiOk({ templates, count: templates.length });
  }
);
