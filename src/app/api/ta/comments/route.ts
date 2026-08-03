import { z } from "zod";
import { createApiHandler, apiOk, apiError } from "@/lib/api/handler";
import { createClient } from "@/lib/supabase/server";
import { writeServerAudit } from "@/lib/api/audit";
import { taRefExists } from "@/lib/ta/ref-tables";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Broad TA permission gate; fine-grained ownership is enforced per action. */
const TA_PERMS = [
  "ta.view",
  "ta.manage",
  "ta.admin",
  "ta.recruit",
  "ta.approve",
  "hr.recruit",
];

const listSchema = z.object({
  ref_table: z.string().min(1).max(80),
  ref_id: z.string().uuid(),
});

const createSchema = z.object({
  ref_table: z.string().min(1).max(80),
  ref_id: z.string().uuid(),
  body: z.string().trim().min(1).max(4000),
});

const deleteSchema = z.object({
  id: z.string().uuid(),
});

/** List non-deleted comments for a TA entity row (company-scoped via RLS). */
export const GET = createApiHandler(
  { auth: true, permissions: TA_PERMS, module: "ta" },
  async ({ req, ctx }) => {
    if (!ctx) return apiError("UNAUTHORIZED", "Sign in required", 401);
    const parsed = listSchema.safeParse({
      ref_table: req.nextUrl.searchParams.get("ref_table"),
      ref_id: req.nextUrl.searchParams.get("ref_id"),
    });
    if (!parsed.success) {
      return apiError("VALIDATION", "ref_table and ref_id (uuid) are required", 400);
    }

    const sb = await createClient();
    const ref = await taRefExists(sb, parsed.data.ref_table, parsed.data.ref_id, ctx.companyId);
    if (!ref.ok) return apiError("VALIDATION", ref.message, ref.status);

    const { data, error } = await sb
      .from("ta_comments")
      .select("*")
      .eq("ref_table", parsed.data.ref_table)
      .eq("ref_id", parsed.data.ref_id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) return apiError("INTERNAL", error.message, 500);
    return apiOk(data ?? []);
  }
);

/** Create a comment. Actor and company come from the session, never the body. */
export const POST = createApiHandler(
  {
    auth: true,
    permissions: TA_PERMS,
    module: "ta",
    rateLimit: { limit: 30, windowMs: 60_000 },
    bodySchema: createSchema,
  },
  async ({ ctx, body, ip }) => {
    if (!ctx) return apiError("UNAUTHORIZED", "Sign in required", 401);

    const sb = await createClient();
    const ref = await taRefExists(sb, body.ref_table, body.ref_id, ctx.companyId);
    if (!ref.ok) return apiError("VALIDATION", ref.message, ref.status);

    // Author name is derived from the session profile, not client-supplied.
    const { data: prof } = await sb
      .from("user_profiles")
      .select("first_name,last_name")
      .eq("id", ctx.user.id)
      .maybeSingle();
    const authorName =
      prof?.first_name
        ? `${prof.first_name} ${prof.last_name ?? ""}`.trim()
        : null;

    const { data, error } = await sb
      .from("ta_comments")
      .insert({
        company_id: ctx.companyId,
        ref_table: body.ref_table,
        ref_id: body.ref_id,
        author_id: ctx.user.id,
        author_name: authorName,
        body: body.body,
      })
      .select("*")
      .single();
    if (error) return apiError("INTERNAL", error.message, 500);

    await writeServerAudit(sb, {
      company_id: ctx.companyId,
      user_id: ctx.user.id,
      action: "ta.comment.create",
      module: "ta",
      entity_type: body.ref_table,
      entity_id: body.ref_id,
      after_state: { comment_id: data.id },
      ip_address: ip,
    });

    return apiOk(data);
  }
);

/** Soft-delete a comment: author, or a TA manager/admin. */
export const DELETE = createApiHandler(
  {
    auth: true,
    permissions: TA_PERMS,
    module: "ta",
    rateLimit: { limit: 60, windowMs: 60_000 },
  },
  async ({ req, ctx, ip }) => {
    if (!ctx) return apiError("UNAUTHORIZED", "Sign in required", 401);
    const parsed = deleteSchema.safeParse({ id: req.nextUrl.searchParams.get("id") });
    if (!parsed.success) {
      return apiError("VALIDATION", "id (uuid) is required", 400);
    }

    const sb = await createClient();
    const { data: row } = await sb
      .from("ta_comments")
      .select("*")
      .eq("id", parsed.data.id)
      .maybeSingle();
    if (!row) return apiError("NOT_FOUND", "Comment not found", 404);

    const canManage =
      ctx.isPlatformAdmin ||
      ctx.permissions.some((p) => p === "ta.admin" || p === "ta.manage");
    if (row.author_id !== ctx.user.id && !canManage) {
      return apiError("FORBIDDEN", "You can only delete your own comments", 403);
    }

    const { error } = await sb
      .from("ta_comments")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", parsed.data.id);
    if (error) return apiError("INTERNAL", error.message, 500);

    await writeServerAudit(sb, {
      company_id: ctx.companyId,
      user_id: ctx.user.id,
      action: "ta.comment.delete",
      module: "ta",
      entity_type: row.ref_table,
      entity_id: row.ref_id,
      before_state: { comment_id: row.id },
      ip_address: ip,
    });

    return apiOk({ id: parsed.data.id });
  }
);
