/**
 * Browser wrappers for TA comments/attachments.
 *
 * All reads/writes go through the server API (`/api/ta/comments`,
 * `/api/ta/attachments`) which owns authN/authZ, tenant/company scoping,
 * ref validation and audit. The browser never sends actor or company fields:
 * they are derived from the session server-side.
 */
import { createClient } from "@/lib/supabase/crud-compat";
import {
  apiGet,
  apiPost,
  apiDelete,
  type ApiResult,
} from "@/lib/api-client";

export type TaCommentRow = Record<string, unknown>;
export type TaAttachmentRow = Record<string, unknown>;

async function unwrap<T>(res: ApiResult<T>): Promise<T> {
  if (!res.ok) throw new Error(res.error);
  return res.data;
}

/** Sanitize a file name for storage paths (kept for callers/compat). */
export function safeFileName(name: string): string {
  const clean = name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120).trim();
  return clean || "file";
}

/** List non-deleted comments for a TA entity row */
export async function taListComments(
  refTable: string,
  refId: string
): Promise<TaCommentRow[]> {
  return unwrap(
    await apiGet<TaCommentRow[]>(
      `/api/ta/comments?ref_table=${encodeURIComponent(refTable)}&ref_id=${encodeURIComponent(refId)}`
    )
  );
}

/** Add a comment to a TA entity row */
export async function taAddComment(input: {
  refTable: string;
  refId: string;
  body: string;
}): Promise<TaCommentRow> {
  const body = input.body.trim();
  if (!body) throw new Error("Comment is required");
  return unwrap(
    await apiPost<TaCommentRow>("/api/ta/comments", {
      ref_table: input.refTable,
      ref_id: input.refId,
      body,
    })
  );
}

/** Soft-delete a comment */
export async function taDeleteComment(id: string): Promise<void> {
  await unwrap(await apiDelete<{ id: string }>("/api/ta/comments", { id }));
}

/** List non-deleted attachments for a TA entity row */
export async function taListAttachments(
  refTable: string,
  refId: string
): Promise<TaAttachmentRow[]> {
  return unwrap(
    await apiGet<TaAttachmentRow[]>(
      `/api/ta/attachments?ref_table=${encodeURIComponent(refTable)}&ref_id=${encodeURIComponent(refId)}`
    )
  );
}

/** Upload a file; the storage path and actor are built server-side */
export async function taUploadAttachment(input: {
  refTable: string;
  refId: string;
  file: File;
}): Promise<TaAttachmentRow> {
  const form = new FormData();
  form.append("ref_table", input.refTable);
  form.append("ref_id", input.refId);
  form.append("file", input.file);

  const res = await fetch("/api/ta/attachments", {
    method: "POST",
    body: form,
    credentials: "same-origin",
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.ok === false) {
    throw new Error(
      String(json?.error?.message || json?.error || `Upload failed (${res.status})`)
    );
  }
  return (json.data ?? json) as TaAttachmentRow;
}

/** Soft-delete an attachment and remove its storage object (server-side) */
export async function taDeleteAttachment(id: string): Promise<void> {
  await unwrap(await apiDelete<{ id: string }>("/api/ta/attachments", { id }));
}

/** Time-limited signed URL for a private TA attachment */
export async function getTaFileUrl(storagePath: string): Promise<string> {
  const { data, error } = await createClient()
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
