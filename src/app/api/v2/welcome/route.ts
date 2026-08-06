/**
 * Welcome Experience API
 *
 * GET  — onboarding state + tenant summary + industry pack + module recs
 * PATCH — save/resume wizard state, mark steps, apply module selection, go live
 *
 * Tenant context always comes from the authenticated session (never the body).
 */

import { z } from "zod";
import { createApiHandler, apiOk, apiError } from "@/lib/api/handler";
import type { AuthedContext } from "@/lib/security/api-auth";
import { createClient } from "@/lib/supabase/server";
import {
  WELCOME_STEP_KEYS,
  WELCOME_STEPS,
  WELCOME_STEP_MAP,
  getIndustryPack,
  recommendModules,
  WELCOME_MODULES,
  WELCOME_INTEGRATIONS,
  planDisplayName,
  type TenantSummary,
  type WelcomeState,
  type WelcomeStatus,
  type WelcomeStepKey,
} from "@/lib/platform/welcome";
import {
  getOrCreateWelcomeState,
  loadTenantSummary,
  persistWelcomeState,
  syncSetupProgress,
} from "@/lib/platform/welcome/service";
import { computeReadiness, computeHealth, welcomeProgressPercent } from "@/lib/platform/welcome/readiness";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const STEP_ENUM = WELCOME_STEP_KEYS as unknown as [WelcomeStepKey, ...WelcomeStepKey[]];

const patchSchema = z.object({
  current_step: z.enum(STEP_ENUM).optional(),
  status: z.enum(["not_started", "in_progress", "ready", "go_live", "completed"]).optional(),
  /** Shallow merge: step_key -> answers */
  answers: z.record(z.unknown()).optional(),
  /** Shallow merge: step_key -> selections */
  selections: z.record(z.unknown()).optional(),
  step_status: z
    .object({
      key: z.string().min(1).max(80),
      status: z.enum(["pending", "in_progress", "completed", "skipped"]),
    })
    .optional(),
  action: z.enum(["start", "complete", "apply_modules", "schedule_later", "reset_step"]).optional(),
});

async function loadStateForCtx(ctx: AuthedContext) {
  const tenantId = ctx.tenantId;
  if (!tenantId) throw new Error("No tenant context");
  const sb = await createClient();
  const state = await getOrCreateWelcomeState(sb, {
    tenantId,
    companyId: ctx.companyId,
    actorId: ctx.profile?.id ?? null,
  });
  const summary = await loadTenantSummary(sb, tenantId, ctx.companyId);
  return { sb, state, summary };
}

function serialize(state: WelcomeState, summary: TenantSummary) {
  const pack = getIndustryPack(summary.industry);
  return {
    state,
    summary,
    industry_pack: pack,
    module_recommendations: recommendModules({
      industry: summary.industry,
      planCode: summary.plan_code,
    }),
    modules: WELCOME_MODULES,
    integrations: WELCOME_INTEGRATIONS,
    plan: {
      code: summary.plan_code,
      name: planDisplayName(summary.plan_code),
    },
    progress: welcomeProgressPercent(state),
    steps: WELCOME_STEPS,
  };
}

export const GET = createApiHandler(
  {
    auth: true,
    permissions: ["dashboard.view", "settings.view", "settings.manage", "settings.admin"],
    allowPlatformAdmin: true,
    module: "welcome",
    rateLimit: { limit: 60, windowMs: 60_000 },
  },
  async ({ ctx }) => {
    if (!ctx?.tenantId) {
      return apiError("FORBIDDEN", "No tenant context — open a tenant workspace first", 403);
    }
    try {
      const { state, summary } = await loadStateForCtx(ctx);
      return apiOk(serialize(state, summary));
    } catch (e) {
      return apiError("INTERNAL", e instanceof Error ? e.message : "Failed to load welcome state", 500);
    }
  }
);

export const PATCH = createApiHandler(
  {
    auth: true,
    permissions: ["settings.manage", "settings.admin", "dashboard.view"],
    allowPlatformAdmin: true,
    module: "welcome",
    bodySchema: patchSchema,
    rateLimit: { limit: 120, windowMs: 60_000 },
  },
  async ({ ctx, body }) => {
    if (!ctx?.tenantId) {
      return apiError("FORBIDDEN", "No tenant context", 403);
    }

    const input = body as z.infer<typeof patchSchema>;
    const sb = await createClient();
    let { state, summary } = await loadStateForCtx(ctx);

    try {
      if (input.action === "reset_step" && input.current_step) {
        state = {
          ...state,
          steps_progress: {
            ...state.steps_progress,
            [input.current_step]: { status: "in_progress" },
          },
          status: state.status === "completed" ? "go_live" : state.status,
        };
      }

      if (input.current_step) {
        state = { ...state, current_step: input.current_step };
        const prev = state.steps_progress[input.current_step];
        if (!prev || prev.status === "pending") {
          state = {
            ...state,
            steps_progress: {
              ...state.steps_progress,
              [input.current_step]: { status: "in_progress" },
            },
          };
        }
      }

      if (input.status) {
        state = { ...state, status: input.status as WelcomeStatus };
      }

      if (input.answers) {
        state = { ...state, answers: { ...(state.answers ?? {}), ...input.answers } };
      }

      if (input.selections) {
        state = {
          ...state,
          selections: { ...(state.selections ?? {}), ...input.selections },
        };
      }

      if (input.step_status) {
        const { key, status } = input.step_status;
        const at = new Date().toISOString();
        state = {
          ...state,
          steps_progress: {
            ...state.steps_progress,
            [key]: {
              status,
              completed_at: status === "completed" || status === "skipped" ? at : undefined,
              skipped_at: status === "skipped" ? at : undefined,
            },
          },
        };
      }

      if (input.action === "start" && !state.started_at) {
        state = { ...state, status: state.status === "not_started" ? "in_progress" : state.status };
      }

      if (input.action === "apply_modules") {
        const selected = (state.selections.modules ?? {}) as Record<string, unknown>;
        const rows = Object.entries(selected)
          .filter(([, v]) => v === true || (v as { enabled?: boolean } | null)?.enabled === true)
          .map(([code]) => {
            const def = WELCOME_MODULES.find((m) => m.code === code);
            return {
              tenant_id: state.tenant_id,
              module_code: def?.syncCode ?? code,
              enabled: true,
              config: { source: "welcome", module: code },
            };
          });
        if (rows.length > 0) {
          const { error } = await sb.from("tenant_modules").upsert(rows, {
            onConflict: "tenant_id,module_code",
          });
          if (error) throw new Error(`module apply: ${error.message}`);
        }
      }

      // Recompute status from progress when the user is mid-wizard.
      if (!input.status || input.status === "in_progress") {
        const percent = welcomeProgressPercent(state);
        if (percent === 100) state = { ...state, status: "go_live" };
        else if (percent >= 50) state = { ...state, status: "ready" };
        else if (state.status === "not_started") state = { ...state, status: "in_progress" };
      }

      if (input.action === "complete") {
        const readiness = computeReadiness(state);
        const allCompleted = Object.fromEntries(
          WELCOME_STEPS.map((s) => [
            s.key,
            { status: "completed", completed_at: new Date().toISOString() },
          ])
        );
        state = {
          ...state,
          current_step: "success",
          status: "completed",
          steps_progress: allCompleted,
          readiness,
          health: computeHealth(state),
        };
      }

      // Refresh computed snapshots + persist
      state = await persistWelcomeState(sb, state, ctx.profile?.id ?? null);

      // Bridge to the existing go-live checklist so the dashboard stays in sync.
      try {
        await syncSetupProgress(sb, state);
      } catch {
        // Non-fatal — the wizard state is already saved.
      }

      summary = await loadTenantSummary(sb, state.tenant_id, state.company_id);
      return apiOk(serialize(state, summary));
    } catch (e) {
      return apiError("INTERNAL", e instanceof Error ? e.message : "Failed to save welcome state", 500);
    }
  }
);


