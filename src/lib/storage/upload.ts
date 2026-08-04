import { createClient } from "@/lib/supabase/client";
import {
  MAX_SIZES,
  PUBLIC_BUCKETS,
  type StorageBucket,
  type UploadInput,
  type UploadResult,
} from "./types";
import { mustCreate, mustList, mustUpdate } from "@/lib/crud/domain-helpers";

/** Browser client ONLY for Storage API (objects), not table mutations. */
function storageClient() {
  return createClient();
}

function sanitizeFileName(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 120);
}

function extOf(file: File): string {
  const parts = file.name.split(".");
  return parts.length > 1 ? parts.pop()!.toLowerCase() : "bin";
}

/** Build storage path: companyId/folder/timestamp-random-name.ext */
export function buildStoragePath(input: {
  companyId: string;
  folder?: string;
  fileName: string;
  fixedName?: string;
}): string {
  const folder = (input.folder || "general").replace(/^\/+|\/+$/g, "");
  const name = input.fixedName
    ? sanitizeFileName(input.fixedName)
    : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${sanitizeFileName(input.fileName)}`;
  return `${input.companyId}/${folder}/${name}`;
}

export function getPublicUrl(bucket: string, path: string): string {
  const { data } = storageClient().storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

export async function getSignedUrl(
  bucket: string,
  path: string,
  expiresIn = 3600
): Promise<string> {
  const { data, error } = await storageClient()
    .storage.from(bucket)
    .createSignedUrl(path, expiresIn);
  if (error) throw error;
  return data.signedUrl;
}

export async function uploadFile(input: UploadInput): Promise<UploadResult> {
  const max = MAX_SIZES[input.bucket];
  if (input.file.size > max) {
    throw new Error(
      `File too large. Max ${Math.round(max / (1024 * 1024))} MB for ${input.bucket}.`
    );
  }

  const isPublic = PUBLIC_BUCKETS.includes(input.bucket);
  const path = buildStoragePath({
    companyId: input.companyId,
    folder: input.folder || input.category || "general",
    fileName: input.file.name,
    fixedName: input.fixedName
      ? `${input.fixedName}.${extOf(input.file)}`
      : undefined,
  });

  const { error: upErr } = await storageClient()
    .storage.from(input.bucket)
    .upload(path, input.file, {
      cacheControl: "3600",
      upsert: Boolean(input.fixedName),
      contentType: input.file.type || "application/octet-stream",
    });

  if (upErr) throw upErr;

  let publicUrl = getPublicUrl(input.bucket, path);
  if (!isPublic) {
    try {
      publicUrl = await getSignedUrl(input.bucket, path, 60 * 60 * 24 * 7);
    } catch {
      /* keep public URL path for reference */
    }
  }

  // Register in media library via CRUD (not browser table writes)
  let mediaId: string | undefined;
  try {
    const reg = await mustCreate<Record<string, unknown>>("media_files", {
      bucket_id: input.bucket,
      storage_path: path,
      public_url: publicUrl,
      file_name: path.split("/").pop() || input.file.name,
      original_name: input.file.name,
      mime_type: input.file.type || null,
      file_size_bytes: input.file.size,
      category: input.category || "attachment",
      entity_table: input.entityTable || null,
      entity_id: input.entityId || null,
      entity_field: input.entityField || null,
      uploaded_by: input.uploadedBy || null,
      is_public: isPublic,
    });
    mediaId = reg?.id ? String(reg.id) : undefined;
  } catch {
    /* registry optional if migration pending */
  }

  return {
    id: mediaId,
    bucket: input.bucket,
    path,
    publicUrl,
    fileName: path.split("/").pop() || input.file.name,
    originalName: input.file.name,
    mimeType: input.file.type,
    size: input.file.size,
    isPublic,
  };
}

export async function deleteFile(
  bucket: StorageBucket | string,
  path: string,
  mediaId?: string
): Promise<void> {
  const { error } = await storageClient().storage.from(bucket).remove([path]);
  if (error) throw error;
  try {
    if (mediaId) {
      await mustUpdate("media_files", mediaId, {
        deleted_at: new Date().toISOString(),
      });
    } else {
      const rows = await mustList<Record<string, unknown>>("media_files", {
        pageSize: 10,
        filters: { storage_path: path, bucket_id: bucket },
      });
      for (const r of rows) {
        if (r.id)
          await mustUpdate("media_files", String(r.id), {
            deleted_at: new Date().toISOString(),
          });
      }
    }
  } catch {
    /* registry optional */
  }
}

export async function listMediaFiles(opts?: {
  companyId?: string;
  category?: string;
  entityTable?: string;
  entityId?: string;
  limit?: number;
}) {
  void opts?.companyId;
  const filters: Record<string, unknown> = {};
  if (opts?.category) filters.category = opts.category;
  if (opts?.entityTable) filters.entity_table = opts.entityTable;
  if (opts?.entityId) filters.entity_id = opts.entityId;
  return mustList("media_files", {
    pageSize: opts?.limit ?? 100,
    sort: "created_at",
    order: "desc",
    filters: Object.keys(filters).length ? filters : undefined,
  });
}

/** Convenience helpers */
export async function uploadAvatar(
  file: File,
  companyId: string,
  userId: string
): Promise<UploadResult> {
  const result = await uploadFile({
    file,
    companyId,
    bucket: "avatars",
    category: "avatar",
    folder: "profiles",
    entityTable: "user_profiles",
    entityId: userId,
    entityField: "avatar_url",
    uploadedBy: userId,
    fixedName: userId,
  });
  await sb()
    .from("user_profiles")
    .update({ avatar_url: result.publicUrl, updated_at: new Date().toISOString() })
    .eq("id", userId);
  return result;
}

export async function uploadCompanyLogo(
  file: File,
  companyId: string,
  userId?: string | null,
  field: "logo_url" | "dark_logo_url" | "seal_url" | "watermark_url" | "favicon_url" = "logo_url"
): Promise<UploadResult> {
  const bucket = field === "logo_url" || field === "dark_logo_url" ? "logos" : "branding";
  const category =
    field === "seal_url"
      ? "seal"
      : field === "watermark_url"
        ? "watermark"
        : field === "favicon_url"
          ? "favicon"
          : "logo";

  const result = await uploadFile({
    file,
    companyId,
    bucket,
    category,
    folder: "company",
    entityTable: "companies",
    entityId: companyId,
    entityField: field,
    uploadedBy: userId,
    fixedName: `${companyId}-${field}`,
  });

  await sb()
    .from("companies")
    .update({ [field]: result.publicUrl, updated_at: new Date().toISOString() })
    .eq("id", companyId);

  // Keep branding table in sync when present
  try {
    await sb()
      .from("ec_company_branding")
      .upsert(
        {
          company_id: companyId,
          [field === "logo_url" ? "logo_url" : field]: result.publicUrl,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "company_id" }
      );
  } catch {
    /* optional */
  }

  return result;
}

export async function uploadEntityAttachment(input: {
  file: File;
  companyId: string;
  entityTable: string;
  entityId: string;
  entityField?: string;
  category?: UploadInput["category"];
  uploadedBy?: string | null;
  privateFile?: boolean;
}): Promise<UploadResult> {
  return uploadFile({
    file: input.file,
    companyId: input.companyId,
    bucket: input.privateFile ? "attachments" : "documents",
    category: input.category || "attachment",
    folder: input.entityTable,
    entityTable: input.entityTable,
    entityId: input.entityId,
    entityField: input.entityField || "file_url",
    uploadedBy: input.uploadedBy,
  });
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}
