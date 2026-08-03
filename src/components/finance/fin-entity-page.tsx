"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Plus, Trash2, Copy, Download, RefreshCw, Search, Pencil, Archive, Upload,
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
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Textarea } from "@/components/ui/textarea";
import { LoadingState } from "@/components/ui/loading-state";
import { EmptyState } from "@/components/ui/empty-state";
import { useUser } from "@/hooks/use-user";
import {
  finList, finCreate, finUpdate, finSoftDelete, finDuplicate,
  finBulkStatus, finNextNumber, toCsv, downloadCsv, finImportCsv,
} from "@/lib/finance/crud";
import { toast } from "sonner";

export type FinFieldDef = {
  key: string;
  label: string;
  type?: "text" | "number" | "date" | "datetime" | "select" | "textarea";
  options?: string[];
  required?: boolean;
  createOnly?: boolean;
  /** auto-generate number with this prefix */
  autoNumber?: string;
};

export type FinEntityConfig = {
  title: string;
  description: string;
  table: string;
  numberField?: string;
  numberPrefix?: string;
  searchCols?: string[];
  columns: Array<{ key: string; label: string }>;
  fields: FinFieldDef[];
  statusField?: string;
  statusOptions?: string[];
  defaults?: Record<string, unknown>;
};

export function FinEntityPage({ config }: { config: FinEntityConfig }) {
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
  const fileRef = useRef<HTMLInputElement>(null);

  const companyId = auth?.profile?.company_id;

  const load = async () => {
    if (!companyId) { setLoading(false); return; }
    try {
      const data = await finList(config.table, {
        companyId,
        status: config.statusField ? status : undefined,
        search: q,
        searchCols: config.searchCols,
        orderBy: "created_at",
        limit: 400,
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
  }, [auth, status]);

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
        init[f.key] = await finNextNumber(
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
        await finUpdate(config.table, editId, payload, auth.user.id);
        toast.success("Updated");
      } else {
        await finCreate(config.table, payload, auth.user.id);
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
      await finSoftDelete(config.table, id, auth?.user.id);
      toast.success("Deleted");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    }
  };

  const duplicate = async (row: Record<string, unknown>) => {
    try {
      const overrides: Record<string, unknown> = { status: "draft" };
      if (config.numberField && config.numberPrefix && companyId) {
        overrides[config.numberField] = await finNextNumber(
          config.table,
          companyId,
          config.numberPrefix,
          config.numberField
        );
      }
      await finDuplicate(config.table, row.id as string, overrides, auth?.user.id);
      toast.success("Duplicated");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Duplicate failed");
    }
  };

  const bulkStatus = async (st: string) => {
    if (selected.size === 0) return toast.error("Select rows first");
    try {
      await finBulkStatus(config.table, Array.from(selected), st, auth?.user.id);
      toast.success(`Status → ${st}`);
      setSelected(new Set());
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Bulk update failed");
    }
  };

  const exportCsv = () => {
    const cols = config.columns.map((c) => c.key);
    downloadCsv(
      `${config.table}-${new Date().toISOString().slice(0, 10)}.csv`,
      toCsv(filtered, cols)
    );
  };

  const onImportFile = async (file: File) => {
    if (!companyId || !auth) return;
    const text = await file.text();
    const columns: Record<string, string> = {};
    for (const f of config.fields) {
      if (f.autoNumber) continue;
      columns[f.key] = f.key;
      columns[f.label] = f.key;
    }
    setBusy(true);
    try {
      const result = await finImportCsv(config.table, text, {
        companyId,
        actorId: auth.user.id,
        fieldMap: {
          columns,
          required: config.fields.filter((f) => f.required && !f.autoNumber).map((f) => f.key),
          numberFields: config.fields.filter((f) => f.type === "number").map((f) => f.key),
          defaults: config.defaults,
          maxRows: 2000,
        },
      });
      if (result.success) toast.success(`Imported ${result.success} row(s)`);
      if (result.failed) toast.error(`${result.failed} row(s) failed`);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Import failed");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
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
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void onImportFile(f);
              }}
            />
            <Button size="sm" variant="outline" disabled={busy} onClick={() => fileRef.current?.click()}>
              <Upload className="h-4 w-4 mr-1" /> Import
            </Button>
            <Button size="sm" onClick={openCreate}>
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
                    <Button size="sm" variant="ghost" onClick={() => openEdit(r)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => duplicate(r)}>
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => remove(r.id as string)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
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
    </div>
  );
}
