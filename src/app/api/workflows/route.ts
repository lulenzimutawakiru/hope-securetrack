import { NextRequest } from "next/server";
import { z } from "zod";
import { requireApiAuth } from "@/lib/security/api-auth";
import { apiError, apiOk, parseJson, clientIp, rateLimitStrict } from "@/lib/api";
import { createClient } from "@/lib/supabase/server";
import {
  applyTransition,
  createInstance,
  getWorkflowDef,
  listWorkflowDefs,
} from "@/lib/workflows/engine";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** List workflow definitions + optional company instances */
export async function GET(req: NextRequest) {
  const auth = await requireApiAuth({ allowPlatformAdmin: true });
  if ("response" in auth) return auth.response;

  const defId = req.nextUrl.searchParams.get("definition_id");
  const defs = defId
    ? [getWorkflowDef(defId)].filter(Boolean)
    : listWorkflowDefs();

  const supabase = await createClient();
  const { data: instances } = await supabase
    .from("wf_instances")
    .select("id,definition_id,entity_type,entity_id,entity_code,status,created_at,updated_at")
    .eq("company_id", auth.ctx.companyId)
    .is("deleted_at", null)
    .order("updated_at", { ascending: false })
    .limit(50);

  return apiOk({
    definitions: defs,
    instances: instances || [],
  });
}

const startSchema = z.object({
  definition_id: z.string().min(2).max(80),
  entity_type: z.string().min(1).max(80),
  entity_id: z.string().uuid().optional().nullable(),
  entity_code: z.string().max(120).optional().nullable(),
  metadata: z.record(z.unknown()).optional(),
});

const advanceSchema = z.object({
  instance_id: z.string().uuid(),
  event: z.string().min(1).max(80),
  notes: z.string().max(1000).optional(),
});

/**
 * POST: start | advance workflow instances
 */
export async function POST(req: NextRequest) {
  // Any authenticated company user may start/advance (RLS scopes instances).
  // Permission workflow.manage is seeded for privileged roles (migration 00068).
  const auth = await requireApiAuth({ allowPlatformAdmin: true });
  if ("response" in auth) return auth.response;

  const ip = clientIp(req);
  const rl = await rateLimitStrict(`wf:${auth.ctx.user.id}:${ip}`, 60, 60_000);
  if (!rl.allowed) return apiError("RATE_LIMIT", "Rate limit exceeded", 429);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("VALIDATION", "Invalid JSON");
  }

  const action = String((body as { action?: string }).action || "start");
  const supabase = await createClient();

  if (action === "advance") {
    const parsed = parseJson(advanceSchema, body);
    if (!parsed.success) return apiError("VALIDATION", parsed.error);

    const { data: row, error } = await supabase
      .from("wf_instances")
      .select("*")
      .eq("id", parsed.data.instance_id)
      .eq("company_id", auth.ctx.companyId)
      .maybeSingle();

    if (error || !row) return apiError("NOT_FOUND", "Workflow instance not found", 404);

    const def = getWorkflowDef(String(row.definition_id));
    if (!def) return apiError("NOT_FOUND", "Unknown workflow definition", 404);

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

    const result = applyTransition(def, instance, parsed.data.event, {
      actorId: auth.ctx.user.id,
      notes: parsed.data.notes,
    });

    if (!result.ok) {
      return apiError("VALIDATION", result.error, 400, {
        allowedEvents: result.allowedEvents,
      });
    }

    if (result.dualControl && process.env.DUAL_CONTROL_REQUIRED === "true") {
      return apiError(
        "FORBIDDEN",
        "This transition requires dual-control approval before execution",
        403,
        { dual_control: true, event: parsed.data.event, to: result.to }
      );
    }

    const { data: updated, error: uErr } = await supabase
      .from("wf_instances")
      .update({
        status: result.to,
        history: result.instance.history,
        updated_by: auth.ctx.user.id,
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
  const parsed = parseJson(startSchema, body);
  if (!parsed.success) return apiError("VALIDATION", parsed.error);

  const def = getWorkflowDef(parsed.data.definition_id);
  if (!def) return apiError("NOT_FOUND", "Unknown workflow definition", 404);

  const inst = createInstance(def, {
    companyId: auth.ctx.companyId,
    entityType: parsed.data.entity_type,
    entityId: parsed.data.entity_id || crypto.randomUUID(),
    metadata: parsed.data.metadata,
  });

  const { data: created, error: cErr } = await supabase
    .from("wf_instances")
    .insert({
      company_id: auth.ctx.companyId,
      definition_id: def.id,
      entity_type: parsed.data.entity_type,
      entity_id: parsed.data.entity_id || null,
      entity_code: parsed.data.entity_code || null,
      status: inst.status,
      history: inst.history,
      metadata: inst.metadata || {},
      created_by: auth.ctx.user.id,
      updated_by: auth.ctx.user.id,
    })
    .select("*")
    .single();

  if (cErr) return apiError("INTERNAL", cErr.message, 500);

  return apiOk({ instance: created, definition: def });
}

type WorkflowHistory = Array<{
  at: string;
  from: string;
  to: string;
  event: string;
  actorId?: string | null;
  notes?: string;
}>;
