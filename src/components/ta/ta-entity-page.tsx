"use client";

/**
 * Talent Acquisition EntityPage — SecureEntityPage + optional detail drawer
 * (comments + attachments via /api/ta/*).
 */

import { useCallback, useEffect, useState } from "react";
import {
  MessageSquare,
  Paperclip,
  Eye,
  Send,
  Upload,
  Trash2,
  FileText,
} from "lucide-react";
import {
  SecureEntityPage,
  type SecureEntityConfig,
  type SecureFieldDef,
} from "@/components/enterprise/secure-entity-page";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  taListComments,
  taAddComment,
  taDeleteComment,
  taListAttachments,
  taUploadAttachment,
  taDeleteAttachment,
  getTaFileUrl,
  formatFileSize,
  type TaCommentRow,
  type TaAttachmentRow,
} from "@/lib/ta/activity";
import { toast } from "sonner";

export type TaFieldDef = SecureFieldDef;
export type TaEntityConfig = SecureEntityConfig & {
  /** Show detail drawer with comments + attachments */
  detail?: boolean;
};

function DetailDrawer({
  open,
  onOpenChange,
  refTable,
  refId,
  title,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  refTable: string;
  refId: string;
  title: string;
}) {
  const [comments, setComments] = useState<TaCommentRow[]>([]);
  const [attachments, setAttachments] = useState<TaAttachmentRow[]>([]);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    if (!refId) return;
    try {
      const [c, a] = await Promise.all([
        taListComments(refTable, refId),
        taListAttachments(refTable, refId),
      ]);
      setComments(c);
      setAttachments(a);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load activity");
    }
  }, [refTable, refId]);

  useEffect(() => {
    if (open && refId) void reload();
  }, [open, refId, reload]);

  const sendComment = async () => {
    if (!body.trim()) return;
    setBusy(true);
    try {
      await taAddComment({ refTable, refId, body });
      setBody("");
      await reload();
      toast.success("Comment added");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Comment failed");
    } finally {
      setBusy(false);
    }
  };

  const onUpload = async (file: File) => {
    setBusy(true);
    try {
      await taUploadAttachment({ refTable, refId, file });
      await reload();
      toast.success("Attachment uploaded");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Eye className="h-4 w-4" /> {title}
          </SheetTitle>
          <SheetDescription>
            Comments and attachments (server-scoped)
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          <section>
            <h3 className="text-sm font-medium flex items-center gap-2 mb-2">
              <MessageSquare className="h-4 w-4" /> Comments
            </h3>
            <div className="space-y-2 max-h-48 overflow-y-auto mb-3">
              {comments.length === 0 && (
                <p className="text-xs text-muted-foreground">No comments yet.</p>
              )}
              {comments.map((c) => (
                <div
                  key={String(c.id)}
                  className="rounded border p-2 text-sm space-y-1"
                >
                  <p className="whitespace-pre-wrap">{String(c.body ?? "")}</p>
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] text-muted-foreground">
                      {c.created_at
                        ? new Date(String(c.created_at)).toLocaleString()
                        : ""}
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 w-6 p-0"
                      onClick={async () => {
                        try {
                          await taDeleteComment(String(c.id));
                          await reload();
                        } catch (e) {
                          toast.error(
                            e instanceof Error ? e.message : "Delete failed"
                          );
                        }
                      }}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            <Textarea
              placeholder="Add a comment…"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={3}
            />
            <Button
              size="sm"
              className="mt-2"
              disabled={busy || !body.trim()}
              onClick={() => void sendComment()}
            >
              <Send className="h-3.5 w-3.5 mr-1" /> Post
            </Button>
          </section>

          <Separator />

          <section>
            <h3 className="text-sm font-medium flex items-center gap-2 mb-2">
              <Paperclip className="h-4 w-4" /> Attachments
            </h3>
            <div className="space-y-2 max-h-48 overflow-y-auto mb-3">
              {attachments.length === 0 && (
                <p className="text-xs text-muted-foreground">No files yet.</p>
              )}
              {attachments.map((a) => (
                <div
                  key={String(a.id)}
                  className="rounded border p-2 text-sm flex items-center justify-between gap-2"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText className="h-4 w-4 shrink-0" />
                    <div className="min-w-0">
                      <button
                        type="button"
                        className="truncate block text-left text-primary underline-offset-2 hover:underline"
                        onClick={async () => {
                          try {
                            const url = await getTaFileUrl(
                              String(a.storage_path ?? a.path ?? "")
                            );
                            window.open(url, "_blank", "noopener,noreferrer");
                          } catch (e) {
                            toast.error(
                              e instanceof Error ? e.message : "Open failed"
                            );
                          }
                        }}
                      >
                        {String(a.file_name ?? a.name ?? "file")}
                      </button>
                      <span className="text-[10px] text-muted-foreground">
                        {formatFileSize(Number(a.file_size ?? a.size ?? 0))}
                      </span>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 w-6 p-0 shrink-0"
                    onClick={async () => {
                      try {
                        await taDeleteAttachment(String(a.id));
                        await reload();
                      } catch (e) {
                        toast.error(
                          e instanceof Error ? e.message : "Delete failed"
                        );
                      }
                    }}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
            <label className="inline-flex cursor-pointer">
              <input
                type="file"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void onUpload(f);
                  e.target.value = "";
                }}
              />
              <span className="inline-flex items-center justify-center rounded-md border border-input bg-background h-8 px-3 text-xs font-medium hover:bg-accent">
                <Upload className="h-3.5 w-3.5 mr-1" /> Upload
              </span>
            </label>
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export function TaEntityPage({ config }: { config: TaEntityConfig }) {
  const { detail, renderRowActions: _ignored, ...rest } = config;
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [active, setActive] = useState<{ id: string; label: string } | null>(
    null
  );

  const openDetail = (row: Record<string, unknown>) => {
    const id = String(row.id ?? "");
    if (!id) return;
    const label =
      String(
        row.name ??
          row.title ??
          row.code ??
          row.candidate_name ??
          row.job_title ??
          rest.title
      ) || rest.title;
    setActive({ id, label });
    setDrawerOpen(true);
  };

  return (
    <>
      <SecureEntityPage
        config={{
          ...rest,
          entity: rest.entity || rest.table,
          renderRowActions: detail
            ? (row) => (
                <Button
                  size="sm"
                  variant="ghost"
                  title="Comments & attachments"
                  onClick={() => openDetail(row)}
                >
                  <Eye className="h-3.5 w-3.5" />
                </Button>
              )
            : undefined,
        }}
      />
      {detail && active && (
        <DetailDrawer
          open={drawerOpen}
          onOpenChange={setDrawerOpen}
          refTable={rest.table}
          refId={active.id}
          title={active.label}
        />
      )}
    </>
  );
}
