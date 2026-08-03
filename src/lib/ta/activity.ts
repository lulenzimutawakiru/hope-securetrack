import { createClient } from "@/lib/supabase/client";

function sb() {
  return createClient();
}

export type TaCommentRow = Record<string, unknown>;
export type TaAttachmentRow = Record<string, unknown>;

/** Sanitize a file name for storage paths (keep letters, digits, . _ -) */
export function safeFileName(name: string): string {
  const clean = name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120).trim();
  return clean || "file";
}

/** List non-deleted comments for a TA entity row */
export async function taListComments(
  refTable: string,
  refId: string
): Promise<TaCommentRow[]> {
  const { data, error } = await sb()
    .from("ta_comments")
    .select("*")
    .eq("ref_table", refTable)
    .eq("ref_id", refId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  return (data as TaCommentRow[]) || [];
}

/** Add a comment to a TA entity row */
export async function taAddComment(input: {
  companyId: string;
  refTable: string;
  refId: string;
  body: string;
  authorId?: string | null;
  authorName?: string | null;
}): Promise<TaCommentRow> {
  const body = input.body.trim();
  if (!body) throw new Error("Comment is required");
  const { data, error } = await sb()
    .from("ta_comments")
    .insert({
      company_id: input.companyId,
      ref_table: input.refTable,
      ref_id: input.refId,
      author_id: input.authorId ?? null,
      author_name: input.authorName ?? null,
      body,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as TaCommentRow;
}

/** Soft-delete a comment */
export async function taDeleteComment(id: string): Promise<void> {
  const { error } = await sb()
    .from("ta_comments")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

/** List non-deleted attachments for a TA entity row */
export async function taListAttachments(
  refTable: string,
  refId: string
): Promise<TaAttachmentRow[]> {
  const { data, error } = await sb()
    .from("ta_attachments")
    .select("*")
    .eq("ref_table", refTable)
    .eq("ref_id", refId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  return (data as TaAttachmentRow[]) || [];
}

/** Upload a file to the company-scoped attachments bucket and register metadata */
export async function taUploadAttachment(input: {
  companyId: string;
  refTable: string;
  refId: string;
  file: File;
  uploaderId?: string | null;
}): Promise<TaAttachmentRow> {
  const { companyId, refTable, refId, file, uploaderId } = input;
  const clean = safeFileName(file.name);
  const path = `${companyId}/ta/${refTable}/${refId}/${crypto.randomUUID()}-${clean}`;

  const { error: upErr } = await sb()
    .storage
    .from("attachments")
    .upload(path, file, {
      contentType: file.type || "application/octet-stream",
      cacheControl: "3600",
      upsert: false,
    });
  if (upErr) throw upErr;

  const { data, error } = await sb()
    .from("ta_attachments")
    .insert({
      company_id: companyId,
      ref_table: refTable,
      ref_id: refId,
      file_name: file.name,
      file_type: file.type || null,
      file_size_bytes: file.size,
      storage_path: path,
      uploaded_by: uploaderId ?? null,
    })
    .select("*")
    .single();
  if (error) throw error;

  // Keep ta_candidates.resume_url in sync when the file looks like a resume/CV/cover letter
  if (refTable === "ta_candidates" && /resume|cv|cover/i.test(file.name)) {
    try {
      await sb()
        .from("ta_candidates")
        .update({ resume_url: path, updated_at: new Date().toISOString() })
        .eq("id", refId);
    } catch {
      /* non-blocking */
    }
  }

  return data as TaAttachmentRow;
}

/** Soft-delete an attachment and remove its storage object */
export async function taDeleteAttachment(
  id: string,
  storagePath?: string
): Promise<void> {
  if (storagePath) {
    const { error: rmErr } = await sb().storage.from("attachments").remove([storagePath]);
    if (rmErr) throw rmErr;
  }
  const { error } = await sb()
    .from("ta_attachments")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

/** Time-limited signed URL for a private TA attachment */
export async function getTaFileUrl(storagePath: string): Promise<string> {
  const { data, error } = await sb()
    .storage
    .from("attachments")
    .createSignedUrl(storagePath, 3600);
  if (error) throw error;
  return data.signedUrl;
}

/** Human-readable file size */
export function formatFileSize(bytes: number | null | undefined): string {
  const n = Number(bytes || 0);
  if (n <= 0) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}