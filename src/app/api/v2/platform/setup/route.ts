/**
 * Tenant setup wizard API — session-scoped progress for go-live onboarding.
 *
 * GET  — list setup steps + summary for the active tenant
 * PATCH — mark a step completed / skipped / in_progress
 */

import { z } from "zod";
import { createApiHandler, apiOk, apiError } from "@/lib/api/handler";
import { createClient } from "@/lib/supabase/server";
import {
  TENANT_WIZARD_STEPS,
  setupProgressSummary,
  wizardHrefForKey,
} from "@/lib/platform/onboarding";
import type { SetupStep } from "@/lib/platform/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const patchSchema = z.object({
  step_key: z.string().min(1).max(80).optional(),
  step_id: z.string().uuid().optional(),
  status: z.enum(["completed", "skipped", "in_progress", "pending"]).default("completed"),
});

async function loadSteps(
  tenantId: string
): Promise<SetupStep[]> {
  const sb = await createClient();
  const { data, error } = await sb
    .from("tenant_setup_progress")
    .select("id,step_key,step_label,status,sort_order,completed_at,metadata")
    .eq("tenant_id", tenantId)
    .order("sort_order", { ascending: true });
  if (error) throw new Error(error.message);
  return (data || []) as SetupStep[];
}

function enrichSteps(steps: SetupStep[]) {
  return steps.map((s) => {
    const def = TENANT_WIZARD_STEPS.find((d) => d.key === s.step_key);
    const meta = (s.metadata || {}) as Record<string, unknown>;
    return {
      ...s,
      description:
        (meta.description as string) || def?.description || "",
      href:
        (meta.href as string) ||
        def?.href ||
        wizardHrefForKey(s.step_key),
    };
  });
}

export const GET = createApiHandler(
  {
    auth: true,
    permissions: ["dashboard.view", "settings.view", "settings.manage"],
    allowPlatformAdmin: true,
    module: "platform-setup",
    rateLimit: { limit: 60, windowMs: 60_000 },
  },
  async ({ ctx }) => {
    if (!ctx) return apiError("UNAUTHORIZED", "Sign in required", 401);
    if (!ctx.tenantId) {
      return apiError(
        "FORBIDDEN",
        "No tenant context — platform staff should open a tenant workspace first",
        403
      );
    }

    let steps = await loadSteps(ctx.tenantId);

    // Self-heal: if provision created tenant but wizard rows missing, seed them
    if (steps.length === 0 && ctx.companyId) {
      const sb = await createClient();
      const rows = TENANT_WIZARD_STEPS.map((s) => ({
        tenant_id: ctx.tenantId,
        company_id: ctx.companyId,
        step_key: s.key,
        step_label: s.label,
        sort_order: s.sort_order,
        status: s.autoComplete ? "completed" : "pending",
        completed_at: s.autoComplete ? new Date().toISOString() : null,
        metadata: { description: s.description, href: s.href },
      }));
      await sb.from("tenant_setup_progress").upsert(rows, {
        onConflict: "tenant_id,step_key",
      });
      steps = await loadSteps(ctx.tenantId);
    }

    const enriched = enrichSteps(steps);
    const summary = setupProgressSummary(steps);

    return apiOk({
      steps: enriched,
      summary,
      tenant_id: ctx.tenantId,
      company_id: ctx.companyId,
    });
  }
);

export const PATCH = createApiHandler(
  {
    auth: true,
    permissions: ["settings.manage", "settings.admin", "dashboard.view"],
    allowPlatformAdmin: true,
    module: "platform-setup",
    bodySchema: patchSchema,
    rateLimit: { limit: 40, windowMs: 60_000 },
  },
  async ({ ctx, body }) => {
    if (!ctx) return apiError("UNAUTHORIZED", "Sign in required", 401);
    if (!ctx.tenantId) {
      return apiError("FORBIDDEN", "No tenant context", 403);
    }

    const input = body as z.infer<typeof patchSchema>;
    if (!input.step_id && !input.step_key) {
      return apiError("VALIDATION", "step_id or step_key is required", 400);
    }

    const sb = await createClient();
    let q = sb
      .from("tenant_setup_progress")
      .update({
        status: input.status,
        completed_at:
          input.status === "completed" || input.status === "skipped"
            ? new Date().toISOString()
            : null,
      })
      .eq("tenant_id", ctx.tenantId);

    if (input.step_id) q = q.eq("id", input.step_id);
    else q = q.eq("step_key", input.step_key!);

    const { data, error } = await q
      .select("id,step_key,step_label,status,sort_order,completed_at,metadata")
      .maybeSingle();

    if (error) return apiError("INTERNAL", error.message, 500);
    if (!data) return apiError("NOT_FOUND", "Setup step not found", 404);

    const steps = await loadSteps(ctx.tenantId);
    return apiOk({
      step: enrichSteps([data as SetupStep])[0],
      summary: setupProgressSummary(steps),
    });
  }
);
