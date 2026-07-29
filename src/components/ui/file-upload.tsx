"use client";

import { useRef, useState } from "react";
import { Upload, X, Loader2, FileIcon, ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  uploadFile,
  formatBytes,
  ACCEPT_MAP,
  type StorageBucket,
  type MediaCategory,
  type UploadResult,
} from "@/lib/storage";
import { useUser } from "@/hooks/use-user";
import { toast } from "sonner";

export type FileUploadProps = {
  bucket?: StorageBucket;
  category?: MediaCategory;
  folder?: string;
  entityTable?: string;
  entityId?: string;
  entityField?: string;
  /** Controlled value (public URL) */
  value?: string | null;
  onUploaded?: (result: UploadResult) => void;
  onCleared?: () => void;
  accept?: string;
  label?: string;
  hint?: string;
  /** Image preview for logos/avatars */
  preview?: boolean;
  compact?: boolean;
  className?: string;
  disabled?: boolean;
};

export function FileUpload({
  bucket = "attachments",
  category = "attachment",
  folder,
  entityTable,
  entityId,
  entityField,
  value,
  onUploaded,
  onCleared,
  accept,
  label = "Upload file",
  hint,
  preview = false,
  compact = false,
  className,
  disabled,
}: FileUploadProps) {
  const { auth } = useUser();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [localUrl, setLocalUrl] = useState<string | null>(value || null);

  const displayUrl = localUrl || value || null;
  const isImage =
    preview ||
    bucket === "avatars" ||
    bucket === "logos" ||
    bucket === "branding" ||
    (displayUrl && /\.(png|jpe?g|gif|webp|svg)(\?|$)/i.test(displayUrl));

  const runUpload = async (file: File) => {
    if (!auth?.profile?.company_id) {
      toast.error("Sign in required to upload");
      return;
    }
    setUploading(true);
    try {
      const result = await uploadFile({
        file,
        companyId: auth.profile.company_id,
        bucket,
        category,
        folder,
        entityTable,
        entityId,
        entityField,
        uploadedBy: auth.user.id,
      });
      setLocalUrl(result.publicUrl);
      onUploaded?.(result);
      toast.success(`Uploaded ${file.name}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const onPick = (files: FileList | null) => {
    const file = files?.[0];
    if (file) void runUpload(file);
  };

  const clear = () => {
    setLocalUrl(null);
    onCleared?.();
  };

  return (
    <div className={cn("space-y-2", className)}>
      {label && <p className="text-sm font-medium">{label}</p>}

      <div
        className={cn(
          "relative rounded-lg border border-dashed transition-colors",
          dragOver ? "border-hope-navy bg-hope-navy/5" : "border-muted-foreground/30",
          compact ? "p-3" : "p-4",
          disabled && "opacity-50 pointer-events-none"
        )}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          onPick(e.dataTransfer.files);
        }}
      >
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          accept={accept || ACCEPT_MAP[bucket]}
          disabled={disabled || uploading}
          onChange={(e) => onPick(e.target.files)}
        />

        {displayUrl && isImage ? (
          <div className="flex items-center gap-3">
            <div className="h-16 w-16 shrink-0 overflow-hidden rounded-md border bg-muted">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={displayUrl} alt="Preview" className="h-full w-full object-contain" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted-foreground truncate">{displayUrl}</p>
              <div className="flex gap-2 mt-2">
                <Button type="button" size="sm" variant="outline" onClick={() => inputRef.current?.click()} disabled={uploading}>
                  {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Replace"}
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={clear}>
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </div>
        ) : displayUrl ? (
          <div className="flex items-center gap-3">
            <FileIcon className="h-8 w-8 text-muted-foreground shrink-0" />
            <div className="min-w-0 flex-1">
              <a href={displayUrl} target="_blank" rel="noreferrer" className="text-sm text-primary underline truncate block">
                View file
              </a>
              <div className="flex gap-2 mt-2">
                <Button type="button" size="sm" variant="outline" onClick={() => inputRef.current?.click()} disabled={uploading}>
                  {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Replace"}
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={clear}>
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <button
            type="button"
            className="w-full flex flex-col items-center justify-center gap-2 py-2 text-center"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? (
              <Loader2 className="h-8 w-8 animate-spin text-hope-navy" />
            ) : isImage ? (
              <ImageIcon className="h-8 w-8 text-muted-foreground" />
            ) : (
              <Upload className="h-8 w-8 text-muted-foreground" />
            )}
            <span className="text-sm font-medium">
              {uploading ? "Uploading…" : "Click or drag file here"}
            </span>
            {hint && <span className="text-[11px] text-muted-foreground">{hint}</span>}
          </button>
        )}
      </div>
    </div>
  );
}

/** Multi-file attachment list */
export function MultiFileUpload({
  bucket = "attachments",
  category = "attachment",
  folder,
  entityTable,
  entityId,
  onUploaded,
  className,
}: {
  bucket?: StorageBucket;
  category?: MediaCategory;
  folder?: string;
  entityTable?: string;
  entityId?: string;
  onUploaded?: (result: UploadResult) => void;
  className?: string;
}) {
  const { auth } = useUser();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [files, setFiles] = useState<UploadResult[]>([]);

  const run = async (list: FileList | null) => {
    if (!list?.length || !auth?.profile?.company_id) return;
    setUploading(true);
    try {
      const results: UploadResult[] = [];
      for (const file of Array.from(list)) {
        const r = await uploadFile({
          file,
          companyId: auth.profile.company_id,
          bucket,
          category,
          folder,
          entityTable,
          entityId,
          uploadedBy: auth.user.id,
        });
        results.push(r);
        onUploaded?.(r);
      }
      setFiles((prev) => [...results, ...prev]);
      toast.success(`Uploaded ${results.length} file(s)`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className={cn("space-y-2", className)}>
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        accept={ACCEPT_MAP[bucket]}
        onChange={(e) => run(e.target.files)}
      />
      <Button type="button" variant="outline" size="sm" disabled={uploading} onClick={() => inputRef.current?.click()}>
        {uploading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Upload className="h-4 w-4 mr-1" />}
        Add files
      </Button>
      {files.length > 0 && (
        <ul className="text-xs space-y-1">
          {files.map((f) => (
            <li key={f.path} className="flex items-center gap-2 rounded border px-2 py-1">
              <FileIcon className="h-3.5 w-3.5 shrink-0" />
              <a href={f.publicUrl} target="_blank" rel="noreferrer" className="truncate text-primary underline flex-1">
                {f.originalName}
              </a>
              <span className="text-muted-foreground">{formatBytes(f.size)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
