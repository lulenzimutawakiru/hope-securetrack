import { z } from "zod";
import { apiError, apiOk, createApiHandler } from "@/lib/api/handler";
import { createClient } from "@/lib/supabase/server";
import {
  applyTransition,
  createInstance,
  getWorkflowDef,
  listWorkflowDefs,
} from "@/lib/workflows/engine";
import { dualControlEnforcementEnabled } from "@/lib/security/dual-control";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type WorkflowHistory = Array<{
  at: string;
  from: string;
  to: string;
  event: string;
  actorId?: string | null;
  notes?: string;
}>;

const startSchema = z.object({
  action: z.literal("start").optional(),
  definition_id: z.string().min(2).max(80),
  entity_type: z.string().min(1).max(80),
  entity_id: z.string().uuid().optional().nullable(),
  entity_code: z.string().max(120).optional().nullable(),
  metadata: z.record(z.unknown()).optional(),
});

const advanceSchema = z.object({
  action: z.literal("advance"),
  instance_id: z.string().uuid(),
  event: z.string().min(1).max(80),
  notes: z.string().max(1000).optional(),
});

const postSchema = z.union([advanceSchema, startSchema]);

/** List workflow definitions + company instances */
export const GET = createApiHandler(
  {
    auth: true,
    allowPlatformAdmin: true,
    permissions: [
      "settings.workflows",
      "settings.manage",
      "settings.view",
      "dashboard.view",
    ],
    module: "workflows",
  },
  async ({ req, ctx }) => {
    if (!ctx) return apiError("UNAUTHORIZED", "Sign in required", 401);
    const defId = req.nextUrl.searchParams.get("definition_id");
    const defs = defId
      ? [getWorkflowDef(defId)].filter(Boolean)
      : listWorkflowDefs();

    const supabase = await createClient();
    const { data: instances } = await supabase
      .from("wf_instances")
      .select(
        "id,definition_id,entity_type,entity_id,entity_code,status,created_at,updated_at"
      )
      .eq("company_id", ctx.companyId)
      .is("deleted_at", null)
      .order("updated_at", { ascending: false })
      .limit(50);

    return apiOk({
      definitions: defs,
      instances: instances || [],
    });
  }
);

/** POST: start | advance workflow instances */
export const POST = createApiHandler(
  {
    auth: true,
    allowPlatformAdmin: true,
    permissions: [
      "settings.workflows",
      "settings.manage",
      "dashboard.view",
    ],
    bodySchema: postSchema,
    rateLimit: { limit: 60, windowMs: 60_000 },
    module: "workflows",
  },
  async ({ ctx, body }) => {
    if (!ctx) return apiError("UNAUTHORIZED", "Sign in required", 401);
    const data = body as z.infer<typeof postSchema>;
    const supabase = await createClient();

    if ("action" in data && data.action === "advance") {
      const { data: row, error } = await supabase
        .from("wf_instances")
        .select("*")
        .eq("id", data.instance_id)
        .eq("company_id", ctx.companyId)
        .maybeSingle();

      if (error || !row) {
        return apiError("NOT_FOUND", "Workflow instance not found", 404);
      }

      const def = getWorkflowDef(String(row.definition_id));
      if (!def) {
        return apiError("NOT_FOUND", "Unknown workflow definition", 404);
      }

      const instance = {
        id: row.id as string,
        definitionId: String(row.definition_id),
        companyId: String(row.company_id),
        entityType: String(row.entity_type),
        entityId: String(row.entity_id || ""),
        status: String(row.status),
        history: (row.history as WorkflowHistory) || [],
        metadata: (row.metadata as Record<string, unknown>) || {},
      };

      const result = applyTransition(def, instance, data.event, {
        actorId: ctx.user.id,
        notes: data.notes,
      });

      if (!result.ok) {
        return apiError("VALIDATION", result.error, 400, {
          allowedEvents: result.allowedEvents,
        });
      }

      if (result.dualControl && dualControlEnforcementEnabled()) {
        return apiError(
          "FORBIDDEN",
          "This transition requires dual-control approval before execution",
          403,
          { dual_control: true, event: data.event, to: result.to }
        );
      }

      const { data: updated, error: uErr } = await supabase
        .from("wf_instances")
        .update({
          status: result.to,
          history: result.instance.history,
          updated_by: ctx.user.id,
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.id)
        .select("*")
        .single();

      if (uErr) return apiError("INTERNAL", uErr.message, 500);

      return apiOk({
        instance: updated,
        from: result.from,
        to: result.to,
        effects: result.effects,
      });
    }

    // start
    const start = data as z.infer<typeof startSchema>;
    const def = getWorkflowDef(start.definition_id);
    if (!def) {
      return apiError("NOT_FOUND", "Unknown workflow definition", 404);
    }

    const inst = createInstance(def, {
      companyId: ctx.companyId,
      entityType: start.entity_type,
      entityId: start.entity_id || crypto.randomUUID(),
      metadata: start.metadata,
    });

    const { data: created, error: cErr } = await supabase
      .from("wf_instances")
      .insert({
        company_id: ctx.companyId,
        definition_id: def.id,
        entity_type: start.entity_type,
        entity_id: start.entity_id || null,
        entity_code: start.entity_code || null,
        status: inst.status,
        history: inst.history,
        metadata: inst.metadata || {},
        created_by: ctx.user.id,
        updated_by: ctx.user.id,
      })
      .select("*")
      .single();

    if (cErr) return apiError("INTERNAL", cErr.message, 500);

    return apiOk({ instance: created, definition: def });
  }
);
