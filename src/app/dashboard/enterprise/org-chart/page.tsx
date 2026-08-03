"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Archive, ArchiveRestore, ChevronRight, Download, Expand, MoreHorizontal,
  Network, Pencil, Plus, Search, Shrink, Trash2, Upload, Users,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { StatCard } from "@/components/ui/stat-card";
import { LoadingState } from "@/components/ui/loading-state";
import { useUser } from "@/hooks/use-user";
import {
  archiveOrgNode, assertSafeReparent, buildOrgTree, createOrgNode,
  deleteOrgNode, descendantIds, filterTreeByIds, flattenTree, getOrgStats,
  importOrgNodes, listOrgNodes, moveOrgNode, ORG_CSV_COLUMNS, ORG_NODE_TYPES,
  orgPath, restoreOrgNode, toOrgCsvRows, updateOrgNode,
  type OrgStats, type OrgTreeNode,
} from "@/lib/enterprise-company";
import { parseCsv } from "@/lib/enterprise/csv";
import { downloadCsv } from "@/lib/documents";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type OrgRow = {
  id: string;
  parent_id?: string | null;
  code?: string;
  name?: string;
  node_type?: string;
  manager_name?: string | null;
  manager_user_id?: string | null;
  sort_order?: number | null;
  is_active?: boolean | null;
  deleted_at?: string | null;
};

type FormState = {
  code: string;
  name: string;
  node_type: string;
  parent_id: string;
  manager_name: string;
  sort_order: string;
  is_active: boolean;
};

const EMPTY_FORM: FormState = {
  code: "",
  name: "",
  node_type: "company",
  parent_id: "",
  manager_name: "",
  sort_order: "0",
  is_active: true,
};

function OrgNodeRow({
  node,
  depth,
  nodes,
  canManage,
  collapsed,
  onToggle,
  onMove,
  onEdit,
  onArchive,
  onRestore,
  onDelete,
}: {
  node: OrgTreeNode<OrgRow>;
  depth: number;
  nodes: OrgRow[];
  canManage: boolean;
  collapsed: Set<string>;
  onToggle: (id: string) => void;
  onMove: (id: string, parentId: string | null) => void;
  onEdit: (node: OrgRow) => void;
  onArchive: (id: string) => void;
  onRestore: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const hasKids = node.children.length > 0;
  const isCollapsed = collapsed.has(node.id);
  const breadcrumb = orgPath(nodes, node.id).join(" / ");
  return (
    <div>
      <div
        className="group flex items-center gap-2 rounded-md border bg-white px-3 py-2 mb-1 hover:border-hope-navy/40"
        style={{ marginLeft: depth * 18 }}
        title={breadcrumb}
      >
        {hasKids ? (
          <button type="button" onClick={() => onToggle(node.id)} className="p-0.5">
            <ChevronRight className={cn("h-3.5 w-3.5 transition", isCollapsed ? "" : "rotate-90")} />
          </button>
        ) : (
          <span className="w-4" />
        )}
        <Users className="h-3.5 w-3.5 text-hope-navy shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium truncate">{String(node.name ?? "")}</p>
          <p className="text-[11px] text-muted-foreground truncate">
            {node.manager_name ? String(node.manager_name) : "No manager"}
            <span className="text-muted-foreground/60"> · {String(node.code ?? "")}</span>
            {node.is_active === false && <span className="text-amber-600"> · archived</span>}
          </p>
        </div>
        <Badge variant="outline" className="text-[10px] shrink-0">{String(node.node_type ?? "node")}</Badge>
        {canManage && (
          <>
            <Select
              value={node.parent_id || "root"}
              onValueChange={(v) => onMove(node.id, v === "root" ? null : v)}
            >
              <SelectTrigger className="w-[110px] h-7 text-[10px]">
                <SelectValue placeholder="Parent" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="root">Root</SelectItem>
                {nodes
                  .filter((n) => n.id !== node.id && !descendantIds(nodes, node.id).has(n.id))
                  .map((n) => (
                    <SelectItem key={n.id} value={n.id}>{String(n.name ?? n.code)}</SelectItem>
                  ))}
              </SelectContent>
            </Select>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                <DropdownMenuItem onClick={() => onEdit(node)}>
                  <Pencil className="h-3.5 w-3.5 mr-2" /> Edit
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {node.is_active === false ? (
                  <DropdownMenuItem onClick={() => onRestore(node.id)}>
                    <ArchiveRestore className="h-3.5 w-3.5 mr-2" /> Restore
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem onClick={() => onArchive(node.id)}>
                    <Archive className="h-3.5 w-3.5 mr-2" /> Archive
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem className="text-red-600" onClick={() => onDelete(node.id)}>
                  <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        )}
      </div>
      {!isCollapsed && hasKids && node.children.map((c) => (
        <OrgNodeRow
          key={c.id}
          node={c}
          depth={depth + 1}
          nodes={nodes}
          canManage={canManage}
          collapsed={collapsed}
          onToggle={onToggle}
          onMove={onMove}
          onEdit={onEdit}
          onArchive={onArchive}
          onRestore={onRestore}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}

export default function OrgChartPage() {
  const { auth, hasPermission } = useUser();
  const companyId = auth?.profile?.company_id ?? null;
  const canManage = hasPermission("ec.manage");

  const [loading, setLoading] = useState(true);
  const [nodes, setNodes] = useState<OrgRow[]>([]);
  const [stats, setStats] = useState<OrgStats>({ total: 0, active: 0, archived: 0, maxDepth: 0, byType: {} });
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<OrgRow | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    if (!companyId) { setLoading(false); return; }
    try {
      const list = await listOrgNodes(companyId);
      setNodes(list as OrgRow[]);
      setStats(await getOrgStats(companyId));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load org chart");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [auth]);

  const tree = useMemo(() => buildOrgTree(nodes), [nodes]);
  const flat = useMemo(() => flattenTree(tree), [tree]);

  const visibleTree = useMemo(() => {
    const q = query.trim().toLowerCase();
    let keep: Set<string> | null = null;
    if (q) {
      keep = new Set(
        flat
          .filter((f) =>
            String(f.node.name ?? "").toLowerCase().includes(q) ||
            String(f.node.code ?? "").toLowerCase().includes(q) ||
            String(f.node.manager_name ?? "").toLowerCase().includes(q)
          )
          .map((f) => f.node.id)
      );
    }
    if (typeFilter) {
      const typeIds = new Set(
        flat.filter((f) => f.node.node_type === typeFilter).map((f) => f.node.id)
      );
      keep = keep ? new Set([...keep].filter((id) => typeIds.has(id))) : typeIds;
    }
    return keep ? filterTreeByIds(tree, keep) : tree;
  }, [tree, flat, query, typeFilter]);

  const toggleCollapse = (id: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const expandAll = () => setCollapsed(new Set());
  const collapseAll = () => setCollapsed(new Set(flat.map((f) => f.node.id)));

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  };

  const openEdit = (node: OrgRow) => {
    setEditing(node);
    setForm({
      code: String(node.code ?? ""),
      name: String(node.name ?? ""),
      node_type: String(node.node_type ?? "department"),
      parent_id: node.parent_id || "",
      manager_name: node.manager_name || "",
      sort_order: String(node.sort_order ?? 0),
      is_active: node.is_active !== false,
    });
    setDialogOpen(true);
  };

  const save = async () => {
    if (!companyId || !form.code.trim() || !form.name.trim()) {
      toast.error("Code and name are required");
      return;
    }
    setSaving(true);
    try {
      const sortOrder = parseInt(form.sort_order, 10);
      if (editing) {
        await assertSafeReparent(companyId, editing.id, form.parent_id || null);
        await updateOrgNode(editing.id, {
          code: form.code,
          name: form.name,
          node_type: form.node_type,
          parent_id: form.parent_id || null,
          manager_name: form.manager_name || null,
          sort_order: Number.isNaN(sortOrder) ? undefined : sortOrder,
          is_active: form.is_active,
        });
        toast.success("Node updated");
      } else {
        await createOrgNode({
          company_id: companyId,
          code: form.code,
          name: form.name,
          node_type: form.node_type,
          parent_id: form.parent_id || null,
          manager_name: form.manager_name || null,
          sort_order: Number.isNaN(sortOrder) ? 0 : sortOrder,
        });
        toast.success("Node added");
      }
      setDialogOpen(false);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const onMove = async (id: string, parentId: string | null) => {
    if (!companyId) return;
    try {
      await moveOrgNode(companyId, id, parentId);
      toast.success("Hierarchy updated");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Move failed");
    }
  };

  const onArchive = async (id: string) => {
    try {
      await archiveOrgNode(id);
      toast.success("Node archived");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Archive failed");
    }
  };

  const onRestore = async (id: string) => {
    try {
      await restoreOrgNode(id);
      toast.success("Node restored");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Restore failed");
    }
  };

  const onDelete = async (id: string) => {
    if (!window.confirm("Delete this node? Only nodes without children can be deleted.")) return;
    try {
      await deleteOrgNode(id);
      toast.success("Node deleted");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    }
  };

  const onExport = () => {
    if (!nodes.length) {
      toast.error("Nothing to export");
      return;
    }
    downloadCsv(
      `org-chart-${new Date().toISOString().slice(0, 10)}.csv`,
      [...ORG_CSV_COLUMNS],
      toOrgCsvRows(nodes).map((r) => ORG_CSV_COLUMNS.map((c) => r[c]))
    );
    toast.success("CSV exported");
  };

  const onImportFile = async (file: File) => {
    if (!companyId) return;
    setImporting(true);
    try {
      const text = await file.text();
      const parsed = parseCsv(text);
      if (parsed.errors.length) toast.error(parsed.errors.slice(0, 3).join(" · "));
      if (!parsed.rows.length) {
        toast.error("No valid rows to import");
        return;
      }
      const result = await importOrgNodes(companyId, parsed.rows);
      const msg = `Imported: ${result.created} created, ${result.updated} updated, ${result.skipped} skipped`;
      if (result.errors.length) {
        toast.warning(`${msg} · ${result.errors.length} issue(s): ${result.errors.slice(0, 3).join(" · ")}`);
      } else {
        toast.success(msg);
      }
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Import failed");
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  if (loading) return <LoadingState message="Loading organization chart…" />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Organization Chart"
        description="Board → CEO → directors → managers · search · filter · import/export"
        actions={
          <>
            <input
              ref={fileRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onImportFile(f);
              }}
            />
            <Button size="sm" variant="outline" onClick={onExport}>
              <Download className="h-4 w-4 mr-1" /> Export
            </Button>
            {canManage && (
              <>
                <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()} disabled={importing}>
                  <Upload className="h-4 w-4 mr-1" /> {importing ? "Importing…" : "Import"}
                </Button>
                <Button size="sm" onClick={openCreate}>
                  <Plus className="h-4 w-4 mr-1" /> Add node
                </Button>
              </>
            )}
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total nodes" value={stats.total} icon={Network} description="Across all types" />
        <StatCard title="Active" value={stats.active} icon={Users} description="Currently in use" />
        <StatCard title="Archived" value={stats.archived} icon={Archive} description="Inactive nodes" />
        <StatCard title="Max depth" value={stats.maxDepth} icon={Expand} description="Levels in hierarchy" />
      </div>

      <div className="grid gap-6 lg:grid-cols-4">
        <Card className="lg:col-span-3">
          <CardHeader className="pb-2 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="text-sm flex items-center gap-2 mr-auto">
                <Network className="h-4 w-4" /> Hierarchy ({nodes.length} nodes)
              </CardTitle>
              <Button size="sm" variant="ghost" onClick={expandAll}>
                <Expand className="h-3.5 w-3.5 mr-1" /> Expand all
              </Button>
              <Button size="sm" variant="ghost" onClick={collapseAll}>
                <Shrink className="h-3.5 w-3.5 mr-1" /> Collapse all
              </Button>
            </div>
            <div className="relative">
              <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search name, code or manager…"
                className="pl-8 h-8 text-sm"
              />
            </div>
          </CardHeader>
          <CardContent>
            {visibleTree.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">
                {nodes.length === 0
                  ? "No org nodes yet. Add a company root."
                  : "No nodes match the current search / filter."}
              </p>
            ) : (
              visibleTree.map((n) => (
                <OrgNodeRow
                  key={n.id}
                  node={n}
                  depth={0}
                  nodes={nodes}
                  canManage={canManage}
                  collapsed={collapsed}
                  onToggle={toggleCollapse}
                  onMove={onMove}
                  onEdit={openEdit}
                  onArchive={onArchive}
                  onRestore={onRestore}
                  onDelete={onDelete}
                />
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Node types</CardTitle></CardHeader>
          <CardContent className="flex flex-wrap gap-1">
            {ORG_NODE_TYPES.map((t) => {
              const count = stats.byType[t] ?? 0;
              const active = typeFilter === t;
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTypeFilter(active ? null : t)}
                  className={cn(
                    "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] transition",
                    active
                      ? "border-hope-navy bg-hope-navy text-white"
                      : "border-border bg-white text-muted-foreground hover:border-hope-navy/40"
                  )}
                >
                  {t} <span className="ml-1 opacity-70">{count}</span>
                </button>
              );
            })}
            {typeFilter && (
              <Button size="sm" variant="ghost" className="h-6 text-[10px]" onClick={() => setTypeFilter(null)}>
                Clear
              </Button>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Edit org node" : "Add org node"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Code</Label>
                <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
              </div>
              <div>
                <Label>Sort order</Label>
                <Input type="number" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Name</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <Label>Type</Label>
              <Select value={form.node_type} onValueChange={(v) => setForm({ ...form, node_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ORG_NODE_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Manager</Label>
              <Input value={form.manager_name} onChange={(e) => setForm({ ...form, manager_name: e.target.value })} />
            </div>
            <div>
              <Label>Parent</Label>
              <Select value={form.parent_id || "none"} onValueChange={(v) => setForm({ ...form, parent_id: v === "none" ? "" : v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Root</SelectItem>
                  {nodes
                    .filter((n) => !editing || (n.id !== editing.id && !descendantIds(nodes, editing.id).has(n.id)))
                    .map((n) => (
                      <SelectItem key={n.id} value={n.id}>{String(n.name ?? n.code)}</SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            {editing && (
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={form.is_active}
                  onCheckedChange={(v) => setForm({ ...form, is_active: v === true })}
                />
                Active (visible in hierarchy)
              </label>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving}>
              {saving ? "Saving…" : editing ? "Save changes" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}