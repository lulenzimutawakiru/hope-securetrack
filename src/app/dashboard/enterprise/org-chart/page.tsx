"use client";

import { useEffect, useState } from "react";
import { Network, Plus, ChevronRight, Users } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { LoadingState } from "@/components/ui/loading-state";
import { useUser } from "@/hooks/use-user";
import {
  listOrgNodes, createOrgNode, buildOrgTree, moveOrgNode, ORG_NODE_TYPES,
} from "@/lib/enterprise-company";
import { toast } from "sonner";

type TreeNode = Record<string, unknown> & { children: TreeNode[] };

function OrgNodeView({
  node,
  depth = 0,
  onMoveParent,
  nodes,
}: {
  node: TreeNode;
  depth?: number;
  onMoveParent: (id: string, parentId: string | null) => void;
  nodes: Array<Record<string, unknown>>;
}) {
  const [open, setOpen] = useState(depth < 2);
  const hasKids = node.children?.length > 0;
  return (
    <div>
      <div
        className="flex items-center gap-2 rounded-md border bg-white px-3 py-2 mb-1 hover:border-hope-navy/40"
        style={{ marginLeft: depth * 18 }}
      >
        {hasKids ? (
          <button type="button" onClick={() => setOpen(!open)} className="p-0.5">
            <ChevronRight className={`h-3.5 w-3.5 transition ${open ? "rotate-90" : ""}`} />
          </button>
        ) : (
          <span className="w-4" />
        )}
        <Users className="h-3.5 w-3.5 text-hope-navy shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium truncate">{String(node.name)}</p>
          <p className="text-[11px] text-muted-foreground">
            {String(node.manager_name || "—")} · <span className="font-mono">{String(node.code)}</span>
          </p>
        </div>
        <Badge variant="outline" className="text-[10px] shrink-0">{String(node.node_type)}</Badge>
        <Select
          value={(node.parent_id as string) || "root"}
          onValueChange={(v) => onMoveParent(node.id as string, v === "root" ? null : v)}
        >
          <SelectTrigger className="w-[120px] h-7 text-[10px]"><SelectValue placeholder="Parent" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="root">Root</SelectItem>
            {nodes.filter((n) => n.id !== node.id).map((n) => (
              <SelectItem key={n.id as string} value={n.id as string}>{String(n.name)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {open && hasKids && node.children.map((c) => (
        <OrgNodeView key={c.id as string} node={c} depth={depth + 1} onMoveParent={onMoveParent} nodes={nodes} />
      ))}
    </div>
  );
}

export default function OrgChartPage() {
  const { auth } = useUser();
  const [loading, setLoading] = useState(true);
  const [nodes, setNodes] = useState<Array<Record<string, unknown>>>([]);
  const [tree, setTree] = useState<TreeNode[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    code: "", name: "", node_type: "department", parent_id: "", manager_name: "",
  });

  const load = async () => {
    if (!auth?.profile?.company_id) { setLoading(false); return; }
    try {
      const list = await listOrgNodes(auth.profile.company_id);
      setNodes(list as Array<Record<string, unknown>>);
      setTree(buildOrgTree(list as Array<Record<string, unknown>>));
    } catch { /* */ } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [auth]);

  const save = async () => {
    if (!auth || !form.code || !form.name) return toast.error("Code and name required");
    try {
      await createOrgNode({
        company_id: auth.profile.company_id,
        code: form.code,
        name: form.name,
        node_type: form.node_type,
        parent_id: form.parent_id || null,
        manager_name: form.manager_name,
      });
      toast.success("Node added");
      setOpen(false);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  };

  const onMove = async (id: string, parentId: string | null) => {
    try {
      await moveOrgNode(id, parentId);
      toast.success("Hierarchy updated");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Move failed");
    }
  };

  if (loading) return <LoadingState message="Loading organization chart…" />;

  return (
    <div>
      <PageHeader
        title="Organization Chart"
        description="Board → CEO → directors → managers · drag parent · search · interactive"
        actions={
          <Button size="sm" onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4 mr-1" /> Add node
          </Button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-4">
        <Card className="lg:col-span-3">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Network className="h-4 w-4" /> Hierarchy ({nodes.length} nodes)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {tree.length === 0 ? (
              <p className="text-sm text-muted-foreground">No org nodes yet. Add a company root.</p>
            ) : (
              tree.map((n) => (
                <OrgNodeView key={n.id as string} node={n} onMoveParent={onMove} nodes={nodes} />
              ))
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Node types</CardTitle></CardHeader>
          <CardContent className="flex flex-wrap gap-1">
            {ORG_NODE_TYPES.map((t) => (
              <Badge key={t} variant="outline" className="text-[10px]">{t}</Badge>
            ))}
          </CardContent>
        </Card>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add org node</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Code</Label><Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} /></div>
            <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div>
              <Label>Type</Label>
              <Select value={form.node_type} onValueChange={(v) => setForm({ ...form, node_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ORG_NODE_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Manager</Label><Input value={form.manager_name} onChange={(e) => setForm({ ...form, manager_name: e.target.value })} /></div>
            <div>
              <Label>Parent</Label>
              <Select value={form.parent_id || "none"} onValueChange={(v) => setForm({ ...form, parent_id: v === "none" ? "" : v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Root</SelectItem>
                  {nodes.map((n) => (
                    <SelectItem key={n.id as string} value={n.id as string}>{String(n.name)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
