"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Archive, ArchiveRestore, Briefcase, Building2, ChevronDown, ChevronRight,
  CircleDollarSign, CornerDownRight, Download, Expand, Factory, FolderKanban,
  GitBranch, Globe2, HardHat, Headset, Landmark, Layers, ListTree, MapPin,
  MoreHorizontal, Network, Package, Pencil, Plus, Search, Shrink, Store,
  Trash2, TrendingUp, Upload, Users, Warehouse, X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubContent,
  DropdownMenuSubTrigger, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import styles from "./org-chart.module.css";

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

/* ------------------------------------------------------------------ */
/* Type theming                                                        */
/* ------------------------------------------------------------------ */

type TypeMeta = {
  icon: LucideIcon;
  chip: string;
  badge: string;
  dot: string;
};

const TYPE_META: Record<string, TypeMeta> = {
  enterprise_group: {
    icon: Globe2,
    chip: "bg-indigo-500/10 text-indigo-600",
    badge: "border-indigo-200 bg-indigo-50 text-indigo-700",
    dot: "bg-indigo-500",
  },
  holding: {
    icon: Landmark,
    chip: "bg-violet-500/10 text-violet-600",
    badge: "border-violet-200 bg-violet-50 text-violet-700",
    dot: "bg-violet-500",
  },
  company: {
    icon: Building2,
    chip: "bg-hope-navy/10 text-hope-navy",
    badge: "border-hope-navy/20 bg-hope-navy/5 text-hope-navy",
    dot: "bg-hope-navy",
  },
  subsidiary: {
    icon: Building2,
    chip: "bg-blue-500/10 text-blue-600",
    badge: "border-blue-200 bg-blue-50 text-blue-700",
    dot: "bg-blue-500",
  },
  branch: {
    icon: GitBranch,
    chip: "bg-sky-500/10 text-sky-600",
    badge: "border-sky-200 bg-sky-50 text-sky-700",
    dot: "bg-sky-500",
  },
  factory: {
    icon: Factory,
    chip: "bg-slate-500/10 text-slate-600",
    badge: "border-slate-200 bg-slate-50 text-slate-700",
    dot: "bg-slate-500",
  },
  warehouse: {
    icon: Warehouse,
    chip: "bg-amber-500/10 text-amber-600",
    badge: "border-amber-200 bg-amber-50 text-amber-700",
    dot: "bg-amber-500",
  },
  office: {
    icon: Building2,
    chip: "bg-teal-500/10 text-teal-600",
    badge: "border-teal-200 bg-teal-50 text-teal-700",
    dot: "bg-teal-500",
  },
  distribution_center: {
    icon: Package,
    chip: "bg-orange-500/10 text-orange-600",
    badge: "border-orange-200 bg-orange-50 text-orange-700",
    dot: "bg-orange-500",
  },
  retail_outlet: {
    icon: Store,
    chip: "bg-rose-500/10 text-rose-600",
    badge: "border-rose-200 bg-rose-50 text-rose-700",
    dot: "bg-rose-500",
  },
  service_center: {
    icon: Headset,
    chip: "bg-cyan-500/10 text-cyan-600",
    badge: "border-cyan-200 bg-cyan-50 text-cyan-700",
    dot: "bg-cyan-500",
  },
  regional_office: {
    icon: MapPin,
    chip: "bg-blue-500/10 text-blue-600",
    badge: "border-blue-200 bg-blue-50 text-blue-700",
    dot: "bg-blue-500",
  },
  project_site: {
    icon: HardHat,
    chip: "bg-yellow-500/10 text-yellow-600",
    badge: "border-yellow-200 bg-yellow-50 text-yellow-700",
    dot: "bg-yellow-500",
  },
  business_unit: {
    icon: Briefcase,
    chip: "bg-emerald-500/10 text-emerald-600",
    badge: "border-emerald-200 bg-emerald-50 text-emerald-700",
    dot: "bg-emerald-500",
  },
  department: {
    icon: FolderKanban,
    chip: "bg-teal-500/10 text-teal-600",
    badge: "border-teal-200 bg-teal-50 text-teal-700",
    dot: "bg-teal-500",
  },
  cost_center: {
    icon: CircleDollarSign,
    chip: "bg-lime-500/10 text-lime-600",
    badge: "border-lime-200 bg-lime-50 text-lime-700",
    dot: "bg-lime-500",
  },
  profit_center: {
    icon: TrendingUp,
    chip: "bg-green-500/10 text-green-600",
    badge: "border-green-200 bg-green-50 text-green-700",
    dot: "bg-green-500",
  },
};

const FALLBACK_META: TypeMeta = {
  icon: Network,
  chip: "bg-muted text-muted-foreground",
  badge: "border-border bg-muted/40 text-muted-foreground",
  dot: "bg-muted-foreground",
};

function typeMeta(nodeType?: string): TypeMeta {
  return (nodeType && TYPE_META[nodeType]) || FALLBACK_META;
}

function typeLabel(nodeType?: string): string {
  return String(nodeType ?? "node").replace(/_/g, " ");
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

function Highlight({ text, query }: { text: string; query: string }) {
  const q = query.trim();
  if (!q) return <>{text}</>;
  const lower = text.toLowerCase();
  const needle = q.toLowerCase();
  const parts: React.ReactNode[] = [];
  let i = 0;
  let key = 0;
  while (i < text.length) {
    const idx = lower.indexOf(needle, i);
    if (idx === -1) {
      parts.push(text.slice(i));
      break;
    }
    if (idx > i) parts.push(text.slice(i, idx));
    parts.push(
      <mark key={key++} className="rounded-sm bg-hope-gold/30 px-0.5 text-inherit">
        {text.slice(idx, idx + q.length)}
      </mark>
    );
    i = idx + q.length;
  }
  return <>{parts}</>;
}

/* ------------------------------------------------------------------ */
/* Shared node actions dropdown                                        */
/* ------------------------------------------------------------------ */

type ActionsProps = {
  node: OrgRow;
  nodes: OrgRow[];
  onEdit: (node: OrgRow) => void;
  onArchive: (id: string) => void;
  onRestore: (id: string) => void;
  onDelete: (id: string) => void;
  onMove: (id: string, parentId: string | null) => void;
};

function OrgNodeActions({ node, nodes, onEdit, onArchive, onRestore, onDelete, onMove }: ActionsProps) {
  const candidates = nodes.filter(
    (n) => n.id !== node.id && !descendantIds(nodes, node.id).has(n.id)
  );
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground transition hover:bg-muted hover:text-foreground"
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuLabel className="truncate text-xs font-medium capitalize">
          {String(node.name ?? node.code ?? "")}
        </DropdownMenuLabel>
        <DropdownMenuItem onClick={() => onEdit(node)}>
          <Pencil className="mr-2 h-3.5 w-3.5" /> Edit details
        </DropdownMenuItem>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <CornerDownRight className="mr-2 h-3.5 w-3.5" /> Move to ...
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="max-h-72 overflow-y-auto">
            <DropdownMenuItem onClick={() => onMove(node.id, null)}>
              <Network className="mr-2 h-3.5 w-3.5" /> Root
            </DropdownMenuItem>
            {candidates.map((n) => (
              <DropdownMenuItem key={n.id} onClick={() => onMove(node.id, n.id)}>
                <span className="mr-2 h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground/50" />
                <span className="truncate">{String(n.name ?? n.code)}</span>
              </DropdownMenuItem>
            ))}
            {candidates.length === 0 && (
              <p className="px-2 py-1.5 text-xs text-muted-foreground">No valid parents</p>
            )}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSeparator />
        {node.is_active === false ? (
          <DropdownMenuItem onClick={() => onRestore(node.id)}>
            <ArchiveRestore className="mr-2 h-3.5 w-3.5" /> Restore
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem onClick={() => onArchive(node.id)}>
            <Archive className="mr-2 h-3.5 w-3.5" /> Archive
          </DropdownMenuItem>
        )}
        <DropdownMenuItem
          className="text-red-600 focus:bg-red-50 focus:text-red-600"
          onClick={() => onDelete(node.id)}
        >
          <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
/* ------------------------------------------------------------------ */
/* Chart view (visual org tree)                                        */
/* ------------------------------------------------------------------ */

type NodeHandlers = {
  nodes: OrgRow[];
  canManage: boolean;
  collapsed: Set<string>;
  query: string;
  onToggle: (id: string) => void;
  onMove: (id: string, parentId: string | null) => void;
  onEdit: (node: OrgRow) => void;
  onArchive: (id: string) => void;
  onRestore: (id: string) => void;
  onDelete: (id: string) => void;
};

function ChartNode({ node, handlers }: { node: OrgTreeNode<OrgRow>; handlers: NodeHandlers }) {
  const { nodes, canManage, collapsed, query, onToggle, onMove, onEdit, onArchive, onRestore, onDelete } = handlers;
  const hasKids = node.children.length > 0;
  const searching = query.trim().length > 0;
  const expanded = searching || !collapsed.has(node.id);
  const meta = typeMeta(node.node_type);
  const Icon = meta.icon;
  const direct = node.children.length;
  const inSubtree = hasKids ? descendantIds(nodes, node.id).size : 0;

  return (
    <li>
      <motion.div
        initial={{ opacity: 0, y: 10, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.22, ease: "easeOut" }}
      >
        <div
          className={cn(
            "group relative w-60 rounded-2xl border bg-card p-3 text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md",
            node.is_active === false
              ? "border-amber-200/70 opacity-75"
              : "hover:border-hope-navy/30"
          )}
          title={orgPath(nodes, node.id).join(" / ")}
        >
          <span className={cn("absolute inset-x-3 top-0 h-0.5 rounded-full", meta.dot)} />
          <div className="flex items-start gap-2.5">
            <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", meta.chip)}>
              <Icon className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1 pt-0.5">
              <div className="flex items-center gap-1.5">
                <p className="truncate text-[13px] font-semibold leading-tight">
                  <Highlight text={String(node.name ?? "")} query={query} />
                </p>
                {node.is_active === false && (
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" title="Archived" />
                )}
              </div>
              <p className="mt-0.5 truncate font-mono text-[10px] text-muted-foreground">
                {String(node.code ?? "")}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-0.5 pt-0.5">
              {hasKids && (
                <button
                  type="button"
                  onClick={() => onToggle(node.id)}
                  disabled={searching}
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-muted disabled:opacity-40"
                  title={expanded ? "Collapse" : "Expand"}
                >
                  <ChevronDown
                    className={cn("h-4 w-4 transition-transform duration-200", expanded && "rotate-180")}
                  />
                </button>
              )}
              {canManage && (
                <OrgNodeActions
                  node={node}
                  nodes={nodes}
                  onEdit={onEdit}
                  onArchive={onArchive}
                  onRestore={onRestore}
                  onDelete={onDelete}
                  onMove={onMove}
                />
              )}
            </div>
          </div>
          <div className="mt-2.5 flex items-center gap-2 border-t pt-2">
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full border px-1.5 py-px text-[10px] font-medium capitalize",
                meta.badge
              )}
            >
              <Icon className="h-2.5 w-2.5" />
              {typeLabel(node.node_type)}
            </span>
            <span className="ml-auto flex min-w-0 items-center gap-1 text-[10px] text-muted-foreground">
              {node.manager_name ? (
                <>
                  <Avatar className="h-4 w-4">
                    <AvatarFallback className="bg-hope-navy text-[8px] text-white">
                      {initials(String(node.manager_name))}
                    </AvatarFallback>
                  </Avatar>
                  <span className="max-w-[7.5rem] truncate">{node.manager_name}</span>
                </>
              ) : (
                <span className="italic opacity-70">No manager</span>
              )}
            </span>
          </div>
          {inSubtree > 0 && (
            <p className="mt-1.5 flex items-center gap-1 text-[10px] text-muted-foreground/80">
              <Users className="h-3 w-3" />
              {direct} direct · {inSubtree} in sub-tree
            </p>
          )}
        </div>
      </motion.div>

      {hasKids && expanded && (
        <ul className={styles.treeLevel}>
          {node.children.map((child) => (
            <ChartNode key={child.id} node={child} handlers={handlers} />
          ))}
        </ul>
      )}
    </li>
  );
}

/* ------------------------------------------------------------------ */
/* List view (tree rows)                                               */
/* ------------------------------------------------------------------ */

function TreeNode({ node, handlers }: { node: OrgTreeNode<OrgRow>; handlers: NodeHandlers }) {
  const { nodes, canManage, collapsed, query, onToggle, onMove, onEdit, onArchive, onRestore, onDelete } = handlers;
  const hasKids = node.children.length > 0;
  const searching = query.trim().length > 0;
  const expanded = searching || !collapsed.has(node.id);
  const meta = typeMeta(node.node_type);
  const Icon = meta.icon;

  return (
    <div>
      <motion.div
        initial={{ opacity: 0, x: -6 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.18 }}
      >
        <div
          className={cn(
            "group flex items-center gap-2.5 rounded-xl border bg-card px-3 py-2.5 transition-colors hover:bg-muted/40",
            node.is_active === false
              ? "border-amber-200/60 opacity-70"
              : "hover:border-hope-navy/30"
          )}
          title={orgPath(nodes, node.id).join(" / ")}
        >
          {hasKids ? (
            <button
              type="button"
              onClick={() => onToggle(node.id)}
              disabled={searching}
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted disabled:opacity-40"
            >
              <ChevronRight
                className={cn("h-3.5 w-3.5 transition-transform duration-200", expanded && "rotate-90")}
              />
            </button>
          ) : (
            <span className="w-6 shrink-0" />
          )}
          <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", meta.chip)}>
            <Icon className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">
              <Highlight text={String(node.name ?? "")} query={query} />
              {node.is_active === false && (
                <span className="ml-1.5 rounded-full bg-amber-500/10 px-1.5 py-px text-[10px] font-medium text-amber-600">
                  archived
                </span>
              )}
            </p>
            <p className="truncate text-[11px] text-muted-foreground">
              {node.manager_name ? String(node.manager_name) : "No manager"}
              <span className="text-muted-foreground/60"> · {String(node.code ?? "")}</span>
            </p>
          </div>
          <span
            className={cn(
              "hidden items-center gap-1 rounded-full border px-1.5 py-px text-[10px] font-medium capitalize sm:inline-flex",
              meta.badge
            )}
          >
            <Icon className="h-2.5 w-2.5" />
            {typeLabel(node.node_type)}
          </span>
          {canManage && (
            <OrgNodeActions
              node={node}
              nodes={nodes}
              onEdit={onEdit}
              onArchive={onArchive}
              onRestore={onRestore}
              onDelete={onDelete}
              onMove={onMove}
            />
          )}
        </div>
      </motion.div>
      {hasKids && expanded && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          transition={{ duration: 0.2 }}
          className="ml-[26px] border-l border-border/60 pl-2.5"
        >
          {node.children.map((child) => (
            <TreeNode key={child.id} node={child} handlers={handlers} />
          ))}
        </motion.div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Stat tile                                                           */
/* ------------------------------------------------------------------ */

function StatTile({
  label,
  value,
  hint,
  icon: Icon,
  chip,
}: {
  label: string;
  value: number;
  hint: string;
  icon: LucideIcon;
  chip: string;
}) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border bg-card p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
      <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl transition-transform group-hover:scale-105", chip)}>
        <Icon className="h-5 w-5" />
      </div>
      <p className="mt-3 text-2xl font-bold tracking-tight">{value}</p>
      <p className="text-xs font-medium text-foreground/80">{label}</p>
      <p className="text-[11px] text-muted-foreground">{hint}</p>
    </div>
  );
}

function OrgEmpty({
  title,
  hint,
  action,
}: {
  title: string;
  hint: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed bg-muted/20 px-6 py-16 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-hope-navy to-hope-teal text-white shadow-sm">
        <Network className="h-6 w-6" />
      </div>
      <div>
        <p className="text-sm font-semibold">{title}</p>
        <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      </div>
      {action}
    </div>
  );
}
/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function OrgChartPage() {
  const { auth, hasPermission } = useUser();
  const companyId = auth?.profile?.company_id ?? null;
  const canManage = hasPermission("ec.manage");

  const [loading, setLoading] = useState(true);
  const [nodes, setNodes] = useState<OrgRow[]>([]);
  const [stats, setStats] = useState<OrgStats>({ total: 0, active: 0, archived: 0, maxDepth: 0, byType: {} });
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [view, setView] = useState<"chart" | "list">("chart");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<OrgRow | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    if (!companyId) {
      setLoading(false);
      return;
    }
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

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        e.key === "/" &&
        target &&
        !["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) &&
        !target.isContentEditable
      ) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const tree = useMemo(() => buildOrgTree(nodes), [nodes]);
  const flat = useMemo(() => flattenTree(tree), [tree]);

  const visibleTree = useMemo(() => {
    const q = query.trim().toLowerCase();
    let keep: Set<string> | null = null;
    if (q) {
      keep = new Set(
        flat
          .filter(
            (f) =>
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

  if (loading) return <LoadingState message="Loading organization chart..." />;

  const handlers: NodeHandlers = {
    nodes,
    canManage,
    collapsed,
    query,
    onToggle: toggleCollapse,
    onMove,
    onEdit: openEdit,
    onArchive,
    onRestore,
    onDelete,
  };

  const dialogMeta = typeMeta(form.node_type);
  const DialogTypeIcon = dialogMeta.icon;
  const dialogCandidates = nodes.filter(
    (n) => !editing || (n.id !== editing.id && !descendantIds(nodes, editing.id).has(n.id))
  );

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
                  <Upload className="h-4 w-4 mr-1" /> {importing ? "Importing..." : "Import"}
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
        <StatTile
          label="Total units"
          value={stats.total}
          hint="Across all types"
          icon={Network}
          chip="bg-indigo-500/10 text-indigo-600"
        />
        <StatTile
          label="Active"
          value={stats.active}
          hint="Currently in use"
          icon={Users}
          chip="bg-emerald-500/10 text-emerald-600"
        />
        <StatTile
          label="Archived"
          value={stats.archived}
          hint="Inactive units"
          icon={Archive}
          chip="bg-amber-500/10 text-amber-600"
        />
        <StatTile
          label="Max depth"
          value={stats.maxDepth}
          hint="Levels in hierarchy"
          icon={Layers}
          chip="bg-violet-500/10 text-violet-600"
        />
      </div>

      <Card className="overflow-visible">
        <div className="flex flex-col gap-3 p-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name, code or manager..."
              className="h-9 pl-8 pr-12"
            />
            {query ? (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground transition hover:text-foreground"
                title="Clear search"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            ) : (
              <kbd className="pointer-events-none absolute right-2.5 top-1/2 hidden -translate-y-1/2 rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground sm:inline-block">
                /
              </kbd>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center gap-0.5 rounded-xl border bg-muted/40 p-0.5">
              <button
                type="button"
                onClick={() => setView("chart")}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition",
                  view === "chart"
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Network className="h-3.5 w-3.5" /> Chart
              </button>
              <button
                type="button"
                onClick={() => setView("list")}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition",
                  view === "list"
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <ListTree className="h-3.5 w-3.5" /> List
              </button>
            </div>
            <Button size="sm" variant="ghost" onClick={expandAll}>
              <Expand className="h-3.5 w-3.5 mr-1" /> Expand
            </Button>
            <Button size="sm" variant="ghost" onClick={collapseAll}>
              <Shrink className="h-3.5 w-3.5 mr-1" /> Collapse
            </Button>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 border-t bg-muted/20 px-3 py-2.5">
          <span className="mr-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Type
          </span>
          {ORG_NODE_TYPES.map((t) => {
            const meta = typeMeta(t);
            const TIcon = meta.icon;
            const count = stats.byType[t] ?? 0;
            const active = typeFilter === t;
            return (
              <button
                key={t}
                type="button"
                onClick={() => setTypeFilter(active ? null : t)}
                className={cn(
                  "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium transition-all",
                  active
                    ? cn(meta.badge, "shadow-sm")
                    : "border-border bg-card text-muted-foreground hover:border-hope-navy/30 hover:text-foreground"
                )}
              >
                <TIcon className="h-3 w-3" />
                <span className="capitalize">{typeLabel(t)}</span>
                {count > 0 && (
                  <span className={cn("rounded-full px-1 text-[9px]", active ? "bg-black/5" : "bg-muted")}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
          {typeFilter && (
            <Button size="sm" variant="ghost" className="h-6 gap-1 text-[10px]" onClick={() => setTypeFilter(null)}>
              <X className="h-3 w-3" /> Clear
            </Button>
          )}
        </div>
      </Card>

      <AnimatePresence mode="wait" initial={false}>
        {view === "chart" ? (
          <motion.div
            key="chart"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            <Card className="overflow-hidden">
              <CardContent className="p-0">
                <div className={cn("max-h-[72vh]", styles.scrollArea)}>
                  {visibleTree.length === 0 ? (
                    <OrgEmpty
                      title={nodes.length === 0 ? "No org units yet" : "No matches"}
                      hint={
                        nodes.length === 0
                          ? "Add a company root to start building your hierarchy."
                          : "Nothing matches the current search or type filter."
                      }
                      action={
                        nodes.length === 0 && canManage ? (
                          <Button size="sm" onClick={openCreate}>
                            <Plus className="h-4 w-4 mr-1" /> Add your first node
                          </Button>
                        ) : undefined
                      }
                    />
                  ) : (
                    <ul className={styles.treeRoot}>
                      {visibleTree.map((n) => (
                        <ChartNode key={n.id} node={n} handlers={handlers} />
                      ))}
                    </ul>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ) : (
          <motion.div
            key="list"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            <Card>
              <CardContent className="p-3">
                {visibleTree.length === 0 ? (
                  <OrgEmpty
                    title={nodes.length === 0 ? "No org units yet" : "No matches"}
                    hint={
                      nodes.length === 0
                        ? "Add a company root to start building your hierarchy."
                        : "Nothing matches the current search or type filter."
                    }
                    action={
                      nodes.length === 0 && canManage ? (
                        <Button size="sm" onClick={openCreate}>
                          <Plus className="h-4 w-4 mr-1" /> Add your first node
                        </Button>
                      ) : undefined
                    }
                  />
                ) : (
                  visibleTree.map((n) => (
                    <TreeNode key={n.id} node={n} handlers={handlers} />
                  ))
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className={cn("flex h-8 w-8 items-center justify-center rounded-lg", dialogMeta.chip)}>
                <DialogTypeIcon className="h-4 w-4" />
              </span>
              {editing ? "Edit org unit" : "Add org unit"}
            </DialogTitle>
            <DialogDescription>
              {editing
                ? "Update the unit details below. Changes are audit-logged."
                : "Create a new unit in the organization hierarchy."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <Label>Code</Label>
                <Input
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value })}
                  placeholder="e.g. HR-001"
                />
              </div>
              <div>
                <Label>Type</Label>
                <Select value={form.node_type} onValueChange={(v) => setForm({ ...form, node_type: v })}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ORG_NODE_TYPES.map((t) => {
                      const m = typeMeta(t);
                      const Ti = m.icon;
                      return (
                        <SelectItem key={t} value={t}>
                          <span className="flex items-center gap-2">
                            <Ti className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="capitalize">{typeLabel(t)}</span>
                          </span>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Name</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Human Resources"
              />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <Label>Parent</Label>
                <Select
                  value={form.parent_id || "none"}
                  onValueChange={(v) => setForm({ ...form, parent_id: v === "none" ? "" : v })}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">
                      <span className="flex items-center gap-2">
                        <Network className="h-3.5 w-3.5 text-muted-foreground" />
                        Root
                      </span>
                    </SelectItem>
                    {dialogCandidates.map((n) => (
                      <SelectItem key={n.id} value={n.id}>
                        <span className="flex items-center gap-2">
                          <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50" />
                          <span className="truncate">{String(n.name ?? n.code)}</span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Sort order</Label>
                <Input
                  type="number"
                  value={form.sort_order}
                  onChange={(e) => setForm({ ...form, sort_order: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label>Manager</Label>
              <Input
                value={form.manager_name}
                onChange={(e) => setForm({ ...form, manager_name: e.target.value })}
                placeholder="e.g. Jane Doe"
              />
            </div>
            {editing && (
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={form.is_active}
                  onCheckedChange={(v) => setForm({ ...form, is_active: v === true })}
                />
                Active unit
              </label>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving ? "Saving..." : editing ? "Save changes" : "Add unit"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}