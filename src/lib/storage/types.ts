/** Enterprise file storage buckets & categories */

export const STORAGE_BUCKETS = {
  avatars: "avatars",
  logos: "logos",
  branding: "branding",
  attachments: "attachments",
  documents: "documents",
  media: "media",
} as const;

export type StorageBucket = (typeof STORAGE_BUCKETS)[keyof typeof STORAGE_BUCKETS];

export type MediaCategory =
  | "avatar"
  | "logo"
  | "seal"
  | "watermark"
  | "favicon"
  | "document"
  | "attachment"
  | "media"
  | "branding"
  | "photo"
  | "other";

export const PUBLIC_BUCKETS: StorageBucket[] = [
  "avatars",
  "logos",
  "branding",
  "media",
];

export const MAX_SIZES: Record<StorageBucket, number> = {
  avatars: 5 * 1024 * 1024,
  logos: 10 * 1024 * 1024,
  branding: 20 * 1024 * 1024,
  attachments: 50 * 1024 * 1024,
  documents: 50 * 1024 * 1024,
  media: 100 * 1024 * 1024,
};

export const ACCEPT_MAP: Record<StorageBucket, string> = {
  avatars: "image/jpeg,image/png,image/webp,image/gif",
  logos: "image/jpeg,image/png,image/webp,image/svg+xml,image/gif",
  branding: "image/jpeg,image/png,image/webp,image/svg+xml,image/gif,application/pdf",
  attachments:
    "image/*,application/pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.zip",
  documents: "application/pdf,image/jpeg,image/png,.doc,.docx,.xls,.xlsx",
  media: "image/*,video/mp4,video/webm,audio/mpeg,audio/wav",
};

export interface UploadInput {
  file: File;
  companyId: string;
  bucket: StorageBucket;
  category?: MediaCategory;
  folder?: string;
  entityTable?: string;
  entityId?: string;
  entityField?: string;
  uploadedBy?: string | null;
  /** Overwrite path instead of random name */
  fixedName?: string;
}

export interface UploadResult {
  id?: string;
  bucket: string;
  path: string;
  publicUrl: string;
  fileName: string;
  originalName: string;
  mimeType: string;
  size: number;
  isPublic: boolean;
}
