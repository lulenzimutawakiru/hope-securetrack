"use client";

import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import {
  Plus, Trash2, Copy, Download, RefreshCw, Search, Pencil, Archive, Eye,
  MessageSquare, Paperclip, FileText, Upload, Send,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { LoadingState } from "@/components/ui/loading-state";
import { EmptyState } from "@/components/ui/empty-state";
import { useUser } from "@/hooks/use-user";
import {
  taList, taCreate, taUpdate, taSoftDelete, taDuplicate,
  taBulkStatus, taNextNumber, toCsv, downloadCsv, taRestore,
} from "@/lib/ta/crud";
import {
  taListComments, taAddComment, taDeleteComment,
  taListAttachments, taUploadAttachment, taDeleteAttachment,
  getTaFileUrl, formatFileSize,
} from "@/lib/ta/activity";
import { toast } from "sonner";

export type TaFieldDef = {
  key: string;
  label: string;
  type?: "text" | "number" | "date" | "datetime" | "select" | "textarea";
  options?: string[];
  required?: boolean;
  createOnly?: boolean;
  /** auto-generate number with this prefix */
  autoNumber?: string;
};

export type TaEntityConfig = {
  /** Show the detail drawer (comments + attachments) for records */
  detail?: boolean;
  title: string;
  description: string;
  table: string;
  numberField?: string;
  numberPrefix?: string;
  searchCols?: string[];
  columns: Array<{ key: string; label: string }>;
  fields: TaFieldDef[];
  statusField?: string;
  statusOptions?: string[];
  defaults?: Record<string, unknown>;
};

export function TaEntityPage({ config }: { config: TaEntityConfig }) {
  const { auth } = useUser();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [showDeleted, setShowDeleted] = useState(false);
  const [detailRow, setDetailRow] = useState<Record<string, unknown> | null>(null);
  const [comments, setComments] = useState<Array<Record<string, unknown>>>([]);
  const [attachments, setAttachments] = useState<Array<Record<string, unknown>>>([]);
  const [commentBody, setCommentBody] = useState("");
  const [detailBusy, setDetailBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const companyId = auth?.profile?.company_id;

  const load = async () => {
    if (!companyId) { setLoading(false); return; }
    try {
      const data = await taList(config.table, {
        companyId,
        status: config.statusField ? status : undefined,
        search: q,
        searchCols: config.searchCols,
        orderBy: "created_at",
        limit: 400,
        includeDeleted: showDeleted,
      });
      setRows(data as Array<Record<string, unknown>>);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Load failed");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    load();
  }, [auth, status, showDeleted]);

  const filtered = useMemo(() => {
    if (!q.trim()) return rows;
    const s = q.trim().toLowerCase();
    const cols = config.searchCols || config.columns.map((c) => c.key);
    return rows.filter((r) => cols.some((c) => String(r[c] ?? "").toLowerCase().includes(s)));
  }, [rows, q, config]);

  const openCreate = async () => {
    const init: Record<string, string> = {};
    for (const f of config.fields) {
      if (f.autoNumber && companyId) {
        init[f.key] = await taNextNumber(
          config.table,
          companyId,
          f.autoNumber,
          f.key
        );
      } else if (config.defaults?.[f.key] != null) {
        init[f.key] = String(config.defaults[f.key]);
      } else {
        init[f.key] = f.type === "number" ? "0" : "";
      }
    }
    setForm(init);
    setEditId(null);
    setOpen(true);
  };

  const openEdit = (row: Record<string, unknown>) => {
    const init: Record<string, string> = {};
    for (const f of config.fields) {
      init[f.key] = row[f.key] != null ? String(row[f.key]) : "";
    }
    setForm(init);
    setEditId(row.id as string);
    setOpen(true);
  };

  const save = async () => {
    if (!companyId || !auth) return;
    for (const f of config.fields) {
      if (f.required && !form[f.key]?.trim()) {
        toast.error(`${f.label} is required`);
        return;
      }
    }
    setBusy(true);
    try {
      const payload: Record<string, unknown> = { company_id: companyId };
      for (const f of config.fields) {
        if (f.createOnly && editId) continue;
        // Skip status when entity has no status column configured
        if (f.key === "status" && !config.statusField) continue;
        let v: unknown = form[f.key];
        if (f.type === "number") v = form[f.key] === "" ? null : Number(form[f.key]);
        if (v === "" || v === null || v === undefined) {
          // omit empty optional fields (tables may not have notes/product_name/etc.)
          if (!f.required) continue;
          v = null;
        }
        payload[f.key] = v;
      }
      if (editId) {
        await taUpdate(config.table, editId, payload, auth.user.id);
        toast.success("Updated");
      } else {
        await taCreate(config.table, payload, auth.user.id);
        toast.success("Created");
      }
      setOpen(false);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Soft-delete this record?")) return;
    try {
      await taSoftDelete(config.table, id, auth?.user.id);
      toast.success("Deleted");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    }
  };

  const restore = async (id: string) => {
    try {
      await taRestore(config.table, id, auth?.user.id);
      toast.success("Restored");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Restore failed");
    }
  };

  const duplicate = async (row: Record<string, unknown>) => {
    try {
      const overrides: Record<string, unknown> = { status: "draft" };
      if (config.numberField && config.numberPrefix && companyId) {
        overrides[config.numberField] = await taNextNumber(
          config.table,
          companyId,
          config.numberPrefix,
          config.numberField
        );
      }
      await taDuplicate(config.table, row.id as string, overrides, auth?.user.id);
      toast.success("Duplicated");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Duplicate failed");
    }
  };

  const bulkStatus = async (st: string) => {
    if (selected.size === 0) return toast.error("Select rows first");
    try {
      await taBulkStatus(config.table, Array.from(selected), st, auth?.user.id);
      toast.success(`Status → ${st}`);
      setSelected(new Set());
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Bulk update failed");
    }
  };

  const openDetail = async (row: Record<string, unknown>) => {
    setDetailRow(row);
    try {
      const [c, a] = await Promise.all([
        taListComments(config.table, row.id as string),
        taListAttachments(config.table, row.id as string),
      ]);
      setComments(c);
      setAttachments(a);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Detail load failed");
    }
  };

  const refreshDetail = async (id: string) => {
    try {
      const [c, a] = await Promise.all([
        taListComments(config.table, id),
        taListAttachments(config.table, id),
      ]);
      setComments(c);
      setAttachments(a);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Detail refresh failed");
    }
  };

  const addComment = async () => {
    if (!detailRow || !companyId || !auth) return;
    const body = commentBody.trim();
    if (!body) return toast.error("Write a comment first");
    setDetailBusy(true);
    try {
      await taAddComment({
        refTable: config.table,
        refId: detailRow.id as string,
        body,
      });
      setCommentBody("");
      await refreshDetail(detailRow.id as string);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Comment failed");
    } finally {
      setDetailBusy(false);
    }
  };

  const deleteComment = async (id: string) => {
    if (!confirm("Delete this comment?")) return;
    try {
      await taDeleteComment(id);
      if (detailRow) await refreshDetail(detailRow.id as string);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    }
  };

  const onUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !detailRow || !companyId) return;
    if (file.size > 25 * 1024 * 1024) {
      toast.error("Max file size is 25 MB");
      return;
    }
    setUploading(true);
    try {
      await taUploadAttachment({
        refTable: config.table,
        refId: detailRow.id as string,
        file,
      });
      toast.success("Uploaded");
      await refreshDetail(detailRow.id as string);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const downloadAttachment = async (a: Record<string, unknown>) => {
    try {
      const url = await getTaFileUrl(String(a.storage_path));
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Download failed");
    }
  };

  const deleteAttachment = async (a: Record<string, unknown>) => {
    if (!confirm(`Delete ${String(a.file_name)}?`)) return;
    try {
      await taDeleteAttachment(a.id as string);
      if (detailRow) await refreshDetail(detailRow.id as string);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    }
  };
  const exportCsv = () => {
    const cols = config.columns.map((c) => c.key);
    downloadCsv(
      `${config.table}-${new Date().toISOString().slice(0, 10)}.csv`,
      toCsv(filtered, cols)
    );
  };

  if (loading) return <LoadingState message={`Loading ${config.title}…`} />;

  return (
    <div>
      <PageHeader
        title={config.title}
        description={config.description}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => load()}>
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="outline" onClick={exportCsv}>
              <Download className="h-4 w-4 mr-1" /> Export
            </Button>
            <Button
              size="sm"
              variant={showDeleted ? "secondary" : "outline"}
              onClick={() => setShowDeleted((v) => !v)}
            >
              <Archive className="h-4 w-4 mr-1" /> {showDeleted ? "Hide deleted" : "Show deleted"}
            </Button>
            <Button size="sm" onClick={openCreate} disabled={showDeleted}>
              <Plus className="h-4 w-4 mr-1" /> Create
            </Button>
          </div>
        }
      />

      <div className="flex flex-wrap gap-2 mb-4">
        <div className="relative flex-1 min-w-[180px] max-w-sm">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input className="pl-8" placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        {config.statusField && config.statusOptions && (
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All status</SelectItem>
              {config.statusOptions.map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {selected.size > 0 && config.statusOptions && (
          <Select onValueChange={bulkStatus}>
            <SelectTrigger className="w-[160px]"><SelectValue placeholder={`Bulk (${selected.size})`} /></SelectTrigger>
            <SelectContent>
              {config.statusOptions.map((s) => (
                <SelectItem key={s} value={s}>→ {s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {filtered.length === 0 ? (
        <EmptyState title="No records" description="Create the first record." />
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8">
                  <input
                    type="checkbox"
                    checked={selected.size === filtered.length && filtered.length > 0}
                    onChange={(e) => {
                      if (e.target.checked) setSelected(new Set(filtered.map((r) => r.id as string)));
                      else setSelected(new Set());
                    }}
                  />
                </TableHead>
                {config.columns.map((c) => (
                  <TableHead key={c.key}>{c.label}</TableHead>
                ))}
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r) => (
                <TableRow key={r.id as string}>
                  <TableCell>
                    <input
                      type="checkbox"
                      checked={selected.has(r.id as string)}
                      onChange={(e) => {
                        const next = new Set(selected);
                        if (e.target.checked) next.add(r.id as string);
                        else next.delete(r.id as string);
                        setSelected(next);
                      }}
                    />
                  </TableCell>
                  {config.columns.map((c) => (
                    <TableCell key={c.key} className="text-sm">
                      {c.key === (config.statusField || "status") ? (
                        <Badge variant="outline">{String(r[c.key] ?? "—")}</Badge>
                      ) : (
                        String(r[c.key] ?? "—")
                      )}
                    </TableCell>
                  ))}
                  <TableCell className="text-right space-x-1">
                    {r.deleted_at ? (
                      <Button size="sm" variant="outline" onClick={() => restore(r.id as string)}>
                        Restore
                      </Button>
                    ) : (
                      <>
                        {config.detail && (
                          <Button size="sm" variant="ghost" onClick={() => openDetail(r)}>
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" onClick={() => openEdit(r)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => duplicate(r)}>
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => remove(r.id as string)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editId ? "Edit" : "Create"} {config.title}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            {config.fields.map((f) => {
              if (f.createOnly && editId) return null;
              return (
                <div key={f.key} className={f.type === "textarea" ? "sm:col-span-2" : ""}>
                  <Label className="text-xs">{f.label}{f.required ? " *" : ""}</Label>
                  {f.type === "select" && f.options ? (
                    <SearchableSelect
                      value={form[f.key] || ""}
                      onValueChange={(v) => setForm({ ...form, [f.key]: v })}
                      placeholder="Select"
                      options={f.options}
                    />
                  ) : f.type === "textarea" ? (
                    <Textarea value={form[f.key] || ""} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} />
                  ) : (
                    <Input
                      type={f.type === "number" ? "number" : f.type === "date" ? "date" : f.type === "datetime" ? "datetime-local" : "text"}
                      value={form[f.key] || ""}
                      onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                      disabled={!!f.autoNumber && !editId}
                    />
                  )}
                </div>
              );
            })}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={busy}>{busy ? "Saving…" : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {config.detail && detailRow && (
        <Sheet open onOpenChange={(v) => { if (!v) { setDetailRow(null); setCommentBody(""); } }}>
          <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
            <SheetHeader>
              <SheetTitle>{config.title} detail</SheetTitle>
              <SheetDescription>
                {String(detailRow[config.columns[0]?.key ?? "id"] ?? "")}
              </SheetDescription>
            </SheetHeader>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {config.fields.map((f) => {
                const v = detailRow[f.key];
                if (v == null || v === "") return null;
                return (
                  <div key={f.key} className="text-sm">
                    <div className="text-xs text-muted-foreground">{f.label}</div>
                    <div className="font-medium break-words">
                      {f.type === "date" && typeof v === "string" ? v.slice(0, 10) : String(v)}
                    </div>
                  </div>
                );
              })}
            </div>

            <Separator className="my-4" />

            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <MessageSquare className="h-4 w-4" /> Comments ({comments.length})
              </div>
              {comments.length === 0 ? (
                <p className="text-sm text-muted-foreground">No comments yet.</p>
              ) : (
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {comments.map((c) => (
                    <div key={c.id as string} className="rounded-md border p-2 text-sm">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium">{String(c.author_name || "User")}</span>
                        <span className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">
                            {new Date(String(c.created_at)).toLocaleString()}
                          </span>
                          <button
                            className="text-muted-foreground hover:text-destructive"
                            onClick={() => deleteComment(c.id as string)}
                            aria-label="Delete comment"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </span>
                      </div>
                      <p className="mt-1 whitespace-pre-wrap">{String(c.body)}</p>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex items-start gap-2">
                <Textarea
                  className="min-h-[60px]"
                  placeholder="Add a comment..."
                  value={commentBody}
                  onChange={(e) => setCommentBody(e.target.value)}
                />
                <Button size="sm" onClick={addComment} disabled={detailBusy}>
                  <Send className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            <Separator className="my-4" />

            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Paperclip className="h-4 w-4" /> Attachments ({attachments.length})
              </div>
              {attachments.length === 0 ? (
                <p className="text-sm text-muted-foreground">No attachments yet.</p>
              ) : (
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {attachments.map((a) => (
                    <div key={a.id as string} className="flex items-center justify-between gap-2 rounded-md border p-2 text-sm">
                      <div className="flex items-center gap-2 min-w-0">
                        <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <div className="min-w-0">
                          <div className="truncate font-medium">{String(a.file_name)}</div>
                          <div className="text-xs text-muted-foreground">{formatFileSize(Number(a.file_size_bytes))}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button size="sm" variant="ghost" onClick={() => downloadAttachment(a)}>
                          <Download className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => deleteAttachment(a)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex items-center gap-2">
                <input ref={fileInputRef} type="file" className="hidden" onChange={onUpload} />
                <Button size="sm" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                  <Upload className="h-3.5 w-3.5 mr-1" />
                  {uploading ? "Uploading..." : "Upload file"}
                </Button>
              </div>
            </div>
          </SheetContent>
        </Sheet>
      )}
    </div>
  );
}

