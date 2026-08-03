import { z } from "zod";
import { createApiHandler, apiOk, apiError } from "@/lib/api/handler";
import { createClient } from "@/lib/supabase/server";
import { writeServerAudit } from "@/lib/api/audit";
import { taRefExists, sanitizeFileName } from "@/lib/ta/ref-tables";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Matches the client-side cap in the TA entity page. */
const MAX_FILE_SIZE = 25 * 1024 * 1024;

/** Mirrors the `attachments` storage bucket allowlist. */
const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
  "text/csv",
  "application/zip",
]);

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

const deleteSchema = z.object({
  id: z.string().uuid(),
});

/** List non-deleted attachments for a TA entity row (company-scoped via RLS). */
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
      .from("ta_attachments")
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

/**
 * Multipart upload. The storage path is built server-side from the validated
 * allowlisted ref + session company; the client cannot influence the path or
 * the actor columns.
 */
export const POST = createApiHandler(
  {
    auth: true,
    permissions: TA_PERMS,
    module: "ta",
    rateLimit: { limit: 20, windowMs: 60_000 },
  },
  async ({ req, ctx, ip }) => {
    if (!ctx) return apiError("UNAUTHORIZED", "Sign in required", 401);

    const form = await req.formData().catch(() => null);
    if (!form) return apiError("VALIDATION", "Expected multipart/form-data", 400);

    const meta = listSchema.safeParse({
      ref_table: String(form.get("ref_table") ?? ""),
      ref_id: String(form.get("ref_id") ?? ""),
    });
    if (!meta.success) {
      return apiError("VALIDATION", "ref_table and ref_id (uuid) are required", 400);
    }

    const file = form.get("file");
    if (!(file instanceof File)) {
      return apiError("VALIDATION", "file is required", 400);
    }
    if (file.size <= 0) return apiError("VALIDATION", "Empty file", 400);
    if (file.size > MAX_FILE_SIZE) {
      return apiError("VALIDATION", "Max file size is 25 MB", 400);
    }
    const mime = file.type || "application/octet-stream";
    if (!ALLOWED_MIME.has(mime)) {
      return apiError("VALIDATION", `File type ${mime} is not allowed`, 400);
    }

    const sb = await createClient();
    const ref = await taRefExists(sb, meta.data.ref_table, meta.data.ref_id, ctx.companyId);
    if (!ref.ok) return apiError("VALIDATION", ref.message, ref.status);

    const clean = sanitizeFileName(file.name);
    const storagePath = `${ctx.companyId}/ta/${meta.data.ref_table}/${meta.data.ref_id}/${crypto.randomUUID()}-${clean}`;

    const { error: upErr } = await sb.storage.from("attachments").upload(storagePath, file, {
      contentType: mime,
      cacheControl: "3600",
      upsert: false,
    });
    if (upErr) return apiError("INTERNAL", `Upload failed: ${upErr.message}`, 500);

    const { data, error } = await sb
      .from("ta_attachments")
      .insert({
        company_id: ctx.companyId,
        ref_table: meta.data.ref_table,
        ref_id: meta.data.ref_id,
        file_name: file.name,
        file_type: mime,
        file_size_bytes: file.size,
        storage_path: storagePath,
        uploaded_by: ctx.user.id,
      })
      .select("*")
      .single();
    if (error) {
      // Best-effort cleanup of the orphaned object before failing.
      await sb.storage.from("attachments").remove([storagePath]).catch(() => {});
      return apiError("INTERNAL", error.message, 500);
    }

    // Keep ta_candidates.resume_url in sync for resume/CV/cover-letter uploads.
    if (meta.data.ref_table === "ta_candidates" && /resume|cv|cover/i.test(file.name)) {
      try {
        await sb
          .from("ta_candidates")
          .update({ resume_url: storagePath, updated_at: new Date().toISOString() })
          .eq("id", meta.data.ref_id)
          .eq("company_id", ctx.companyId);
      } catch {
        // Best-effort sync; never block the upload on it.
      }
    }

    await writeServerAudit(sb, {
      company_id: ctx.companyId,
      user_id: ctx.user.id,
      action: "ta.attachment.create",
      module: "ta",
      entity_type: meta.data.ref_table,
      entity_id: meta.data.ref_id,
      after_state: { attachment_id: data.id, file_name: data.file_name },
      ip_address: ip,
    });

    return apiOk(data);
  }
);

/** Soft-delete an attachment, remove its object, and clear resume_url if linked. */
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
      .from("ta_attachments")
      .select("*")
      .eq("id", parsed.data.id)
      .maybeSingle();
    if (!row) return apiError("NOT_FOUND", "Attachment not found", 404);

    const canManage =
      ctx.isPlatformAdmin ||
      ctx.permissions.some((p) => p === "ta.admin" || p === "ta.manage");
    if (row.uploaded_by !== ctx.user.id && !canManage) {
      return apiError("FORBIDDEN", "You can only delete your own attachments", 403);
    }

    const storagePath = String(row.storage_path ?? "");

    // Remove the storage object; never block the metadata delete on it.
    if (storagePath) {
      await sb.storage.from("attachments").remove([storagePath]).catch(() => {});
    }

    const { error } = await sb
      .from("ta_attachments")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", parsed.data.id);
    if (error) return apiError("INTERNAL", error.message, 500);

    // Clear a dangling resume_url when the deleted object was the current one.
    if (row.ref_table === "ta_candidates" && storagePath) {
      try {
        await sb
          .from("ta_candidates")
          .update({ resume_url: null, updated_at: new Date().toISOString() })
          .eq("resume_url", storagePath)
          .eq("company_id", ctx.companyId);
      } catch {
        // Best-effort sync; never block the delete on it.
      }
    }

    await writeServerAudit(sb, {
      company_id: ctx.companyId,
      user_id: ctx.user.id,
      action: "ta.attachment.delete",
      module: "ta",
      entity_type: row.ref_table,
      entity_id: row.ref_id,
      before_state: { attachment_id: row.id, file_name: row.file_name },
      ip_address: ip,
    });

    return apiOk({ id: parsed.data.id });
  }
);
