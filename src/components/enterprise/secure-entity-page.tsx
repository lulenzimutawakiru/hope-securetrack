"use client";

/**
 * Secure EntityPage — generic master-data grid for ERP modules.
 *
 * All reads/writes go through `/api/v2/crud/[entity]` (session-scoped tenant,
 * permission checks, audit). Never use the browser Supabase client for writes.
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  Plus,
  Trash2,
  Copy,
  Download,
  RefreshCw,
  Search,
  Pencil,
  Upload,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Textarea } from "@/components/ui/textarea";
import { LoadingState } from "@/components/ui/loading-state";
import { EmptyState } from "@/components/ui/empty-state";
import {
  useCrudMutation,
  useEntityList,
} from "@/hooks/use-entity-query";
import {
  downloadCsv,
  parseCsv,
  toCsv,
  validateImportRows,
  type ImportFieldMap,
} from "@/lib/enterprise/csv";
import { toast } from "sonner";

export type SecureFieldDef = {
  key: string;
  label: string;
  type?: "text" | "number" | "date" | "datetime" | "select" | "textarea";
  options?: string[];
  required?: boolean;
  createOnly?: boolean;
  /** Auto-generate number with this prefix on create */
  autoNumber?: string;
};

export type SecureEntityConfig = {
  title: string;
  description: string;
  /**
   * Registry entity key for /api/v2/crud (usually the table name).
   * Falls back to `table` when omitted.
   */
  entity?: string;
  /** Database table / export filename stem */
  table: string;
  numberField?: string;
  numberPrefix?: string;
  searchCols?: string[];
  columns: Array<{ key: string; label: string }>;
  fields: SecureFieldDef[];
  statusField?: string;
  statusOptions?: string[];
  defaults?: Record<string, unknown>;
  /** Enable CSV import (default true) */
  allowImport?: boolean;
  /** Show soft-deleted toggle (default false) */
  allowShowDeleted?: boolean;
  /**
   * Extra per-row action buttons (e.g. TA detail drawer).
   * Rendered before edit/duplicate/delete.
   */
  renderRowActions?: (row: Record<string, unknown>) => ReactNode;
};

function nextDocumentNumber(prefix: string, total: number): string {
  const year = new Date().getFullYear();
  return `${prefix}-${year}-${String(total + 1).padStart(5, "0")}`;
}

export function SecureEntityPage({ config }: { config: SecureEntityConfig }) {
  const entity = config.entity || config.table;
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [status, setStatus] = useState("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [showDeleted, setShowDeleted] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);

  const filters = useMemo(() => {
    if (!config.statusField || status === "all") return undefined;
    return { [config.statusField]: status };
  }, [config.statusField, status]);

  const list = useEntityList<Record<string, unknown>>(
    entity,
    {
      page: 1,
      pageSize: 100,
      search: debouncedQ || undefined,
      filters,
      includeDeleted: showDeleted || undefined,
      sort: "created_at",
      order: "desc",
    },
    { enabled: Boolean(entity) }
  );

  const mutations = useCrudMutation<Record<string, unknown>>(entity);
  const rows = list.data?.data ?? [];
  const total = list.data?.total ?? 0;

  const openCreate = useCallback(() => {
    const init: Record<string, string> = {};
    for (const f of config.fields) {
      if (f.autoNumber) {
        init[f.key] = nextDocumentNumber(f.autoNumber, total);
      } else if (config.defaults?.[f.key] != null) {
        init[f.key] = String(config.defaults[f.key]);
      } else {
        init[f.key] = f.type === "number" ? "0" : "";
      }
    }
    setForm(init);
    setEditId(null);
    setOpen(true);
  }, [config, total]);

  const openEdit = (row: Record<string, unknown>) => {
    const init: Record<string, string> = {};
    for (const f of config.fields) {
      init[f.key] = row[f.key] != null ? String(row[f.key]) : "";
    }
    setForm(init);
    setEditId(row.id as string);
    setOpen(true);
  };

  const buildPayload = (): Record<string, unknown> | null => {
    for (const f of config.fields) {
      if (f.required && !form[f.key]?.trim()) {
        toast.error(`${f.label} is required`);
        return null;
      }
    }
    const payload: Record<string, unknown> = {};
    for (const f of config.fields) {
      if (f.createOnly && editId) continue;
      if (f.key === "status" && !config.statusField) continue;
      let v: unknown = form[f.key];
      if (f.type === "number") v = form[f.key] === "" ? null : Number(form[f.key]);
      if (v === "" || v === null || v === undefined) {
        if (!f.required) continue;
        v = null;
      }
      payload[f.key] = v;
    }
    return payload;
  };

  const save = async () => {
    const payload = buildPayload();
    if (!payload) return;
    setBusy(true);
    try {
      if (editId) {
        const res = await mutations.update(editId, payload);
        if (!res.ok) throw new Error(res.error);
        toast.success("Updated");
      } else {
        const res = await mutations.create(payload);
        if (!res.ok) throw new Error(res.error);
        toast.success("Created");
      }
      setOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Soft-delete this record?")) return;
    try {
      const res = await mutations.remove(id);
      if (!res.ok) throw new Error(res.error);
      toast.success("Deleted");
      setSelected((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    }
  };

  const duplicate = async (row: Record<string, unknown>) => {
    try {
      const {
        id: _id,
        created_at: _c,
        updated_at: _u,
        deleted_at: _d,
        created_by: _cb,
        updated_by: _ub,
        company_id: _co,
        tenant_id: _te,
        ...rest
      } = row;
      const overrides: Record<string, unknown> = {
        ...rest,
        status: config.statusField ? "draft" : rest.status,
      };
      if (config.numberField && config.numberPrefix) {
        overrides[config.numberField] = nextDocumentNumber(
          config.numberPrefix,
          total
        );
      }
      // Drop undefined / null identity leftovers
      delete overrides.id;
      const res = await mutations.create(overrides);
      if (!res.ok) throw new Error(res.error);
      toast.success("Duplicated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Duplicate failed");
    }
  };

  const bulkStatus = async (st: string) => {
    if (selected.size === 0) return toast.error("Select rows first");
    setBusy(true);
    try {
      let ok = 0;
      let fail = 0;
      for (const id of selected) {
        const res = await mutations.update(id, { status: st });
        if (res.ok) ok += 1;
        else fail += 1;
      }
      if (ok) toast.success(`Status → ${st} (${ok})`);
      if (fail) toast.error(`${fail} row(s) failed`);
      setSelected(new Set());
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Bulk update failed");
    } finally {
      setBusy(false);
    }
  };

  const exportCsv = () => {
    const cols = config.columns.map((c) => c.key);
    downloadCsv(
      `${config.table}-${new Date().toISOString().slice(0, 10)}.csv`,
      toCsv(rows, cols)
    );
  };

  const onImportFile = async (file: File) => {
    if (config.allowImport === false) return;
    const text = await file.text();
    const columns: Record<string, string> = {};
    for (const f of config.fields) {
      if (f.autoNumber) continue;
      columns[f.key] = f.key;
      columns[f.label] = f.key;
    }
    const fieldMap: ImportFieldMap = {
      columns,
      required: config.fields
        .filter((f) => f.required && !f.autoNumber)
        .map((f) => f.key),
      numberFields: config.fields
        .filter((f) => f.type === "number")
        .map((f) => f.key),
      defaults: config.defaults,
      maxRows: 500,
    };
    setBusy(true);
    try {
      const parsed = parseCsv(text);
      if (parsed.errors.length && !parsed.rows.length) {
        toast.error(parsed.errors[0] || "Invalid CSV");
        return;
      }
      const { valid, invalid } = validateImportRows(parsed.rows, fieldMap);
      let success = 0;
      let failed = invalid.length;
      for (const row of valid) {
        // company_id / tenant_id stripped server-side
        const body = { ...row };
        delete body.company_id;
        delete body.tenant_id;
        const res = await mutations.create(body);
        if (res.ok) success += 1;
        else failed += 1;
      }
      if (success) toast.success(`Imported ${success} row(s)`);
      if (failed) toast.error(`${failed} row(s) failed`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Import failed");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  if (list.isLoading && !list.data) {
    return <LoadingState message={`Loading ${config.title}…`} />;
  }

  if (list.isError) {
    return (
      <div className="p-6">
        <EmptyState
          title="Failed to load"
          description={
            list.error instanceof Error
              ? list.error.message
              : "Could not load records. Check permissions."
          }
        />
        <Button className="mt-4" variant="outline" onClick={() => list.refetch()}>
          <RefreshCw className="h-4 w-4 mr-1" /> Retry
        </Button>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={config.title}
        description={config.description}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => list.refetch()}
              disabled={list.isFetching}
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="outline" onClick={exportCsv}>
              <Download className="h-4 w-4 mr-1" /> Export
            </Button>
            {config.allowImport !== false && (
              <>
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
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy || mutations.isMutating}
                  onClick={() => fileRef.current?.click()}
                >
                  <Upload className="h-4 w-4 mr-1" /> Import
                </Button>
              </>
            )}
            <Button size="sm" onClick={openCreate}>
              <Plus className="h-4 w-4 mr-1" /> Create
            </Button>
          </div>
        }
      />

      <div className="flex flex-wrap gap-2 mb-4">
        <div className="relative flex-1 min-w-[180px] max-w-sm">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Search…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        {config.statusField && config.statusOptions && (
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All status</SelectItem>
              {config.statusOptions.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {config.allowShowDeleted && (
          <Button
            size="sm"
            variant={showDeleted ? "secondary" : "outline"}
            onClick={() => setShowDeleted((v) => !v)}
          >
            {showDeleted ? "Hide deleted" : "Show deleted"}
          </Button>
        )}
        {selected.size > 0 && config.statusOptions && (
          <Select onValueChange={bulkStatus}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder={`Bulk (${selected.size})`} />
            </SelectTrigger>
            <SelectContent>
              {config.statusOptions.map((s) => (
                <SelectItem key={s} value={s}>
                  → {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {rows.length === 0 ? (
        <EmptyState title="No records" description="Create the first record." />
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8">
                  <input
                    type="checkbox"
                    checked={selected.size === rows.length && rows.length > 0}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelected(new Set(rows.map((r) => r.id as string)));
                      } else {
                        setSelected(new Set());
                      }
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
              {rows.map((r) => (
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
                        <Badge variant="outline">
                          {String(r[c.key] ?? "—")}
                        </Badge>
                      ) : (
                        String(r[c.key] ?? "—")
                      )}
                    </TableCell>
                  ))}
                  <TableCell className="text-right space-x-1">
                    {config.renderRowActions?.(r)}
                    <Button size="sm" variant="ghost" onClick={() => openEdit(r)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => void duplicate(r)}
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => void remove(r.id as string)}
                    >
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
            <DialogTitle>
              {editId ? "Edit" : "Create"} {config.title}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            {config.fields.map((f) => {
              if (f.createOnly && editId) return null;
              return (
                <div
                  key={f.key}
                  className={f.type === "textarea" ? "sm:col-span-2" : ""}
                >
                  <Label className="text-xs">
                    {f.label}
                    {f.required ? " *" : ""}
                  </Label>
                  {f.type === "select" && f.options ? (
                    <SearchableSelect
                      value={form[f.key] || ""}
                      onValueChange={(v) => setForm({ ...form, [f.key]: v })}
                      placeholder="Select"
                      options={f.options}
                    />
                  ) : f.type === "textarea" ? (
                    <Textarea
                      value={form[f.key] || ""}
                      onChange={(e) =>
                        setForm({ ...form, [f.key]: e.target.value })
                      }
                    />
                  ) : (
                    <Input
                      type={
                        f.type === "number"
                          ? "number"
                          : f.type === "date"
                            ? "date"
                            : f.type === "datetime"
                              ? "datetime-local"
                              : "text"
                      }
                      value={form[f.key] || ""}
                      onChange={(e) =>
                        setForm({ ...form, [f.key]: e.target.value })
                      }
                      disabled={!!f.autoNumber && !editId}
                    />
                  )}
                </div>
              );
            })}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => void save()}
              disabled={busy || mutations.isMutating}
            >
              {busy || mutations.isMutating ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
