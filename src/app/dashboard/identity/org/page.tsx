"use client";

import { useEffect, useState } from "react";
import { Network, Plus, ChevronRight, Building2 } from "lucide-react";
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
  listOrgUnits,
  createOrgUnit,
  buildOrgTree,
  ORG_UNIT_TYPES,
} from "@/lib/digital-identity";
import { toast } from "sonner";

type TreeNode = Record<string, unknown> & { children: TreeNode[] };

function OrgNode({ node, depth = 0 }: { node: TreeNode; depth?: number }) {
  const [open, setOpen] = useState(depth < 2);
  const hasKids = node.children?.length > 0;
  return (
    <div className="select-none">
      <div
        className="flex items-center gap-2 rounded-md border bg-white px-3 py-2 mb-1 hover:border-hope-navy/40"
        style={{ marginLeft: depth * 16 }}
      >
        {hasKids ? (
          <button type="button" onClick={() => setOpen(!open)} className="p-0.5">
            <ChevronRight className={`h-3.5 w-3.5 transition ${open ? "rotate-90" : ""}`} />
          </button>
        ) : (
          <span className="w-4" />
        )}
        <Building2 className="h-3.5 w-3.5 text-hope-navy shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium truncate">{String(node.name)}</p>
          <p className="text-[11px] text-muted-foreground font-mono">{String(node.code)}</p>
        </div>
        <Badge variant="outline" className="text-[10px] shrink-0">
          {String(node.unit_type)}
        </Badge>
      </div>
      {open && hasKids && node.children.map((c) => (
        <OrgNode key={c.id as string} node={c} depth={depth + 1} />
      ))}
    </div>
  );
}

export default function OrgStructurePage() {
  const { auth } = useUser();
  const [loading, setLoading] = useState(true);
  const [units, setUnits] = useState<Array<Record<string, unknown>>>([]);
  const [tree, setTree] = useState<TreeNode[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    code: "",
    name: "",
    unit_type: "department",
    parent_id: "",
  });

  const load = async () => {
    if (!auth) return;
    try {
      const list = await listOrgUnits(auth.profile.company_id);
      setUnits(list as Array<Record<string, unknown>>);
      setTree(await buildOrgTree(list as Array<Record<string, unknown>>));
    } catch {
      /* pending */
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [auth]);

  const save = async () => {
    if (!auth || !form.code || !form.name) {
      toast.error("Code and name required");
      return;
    }
    try {
      await createOrgUnit({
        company_id: auth.profile.company_id,
        code: form.code,
        name: form.name,
        unit_type: form.unit_type,
        parent_id: form.parent_id || null,
      });
      toast.success("Org unit created");
      setOpen(false);
      setForm({ code: "", name: "", unit_type: "department", parent_id: "" });
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Create failed");
    }
  };

  if (loading) return <LoadingState message="Loading organization structure…" />;

  return (
    <div>
      <PageHeader
        title="Organization Structure"
        description="Unlimited companies · branches · plants · warehouses · departments · cost centers"
        actions={
          <Button size="sm" onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4 mr-1" /> Add unit
          </Button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Network className="h-4 w-4" /> Org chart
            </CardTitle>
          </CardHeader>
          <CardContent>
            {tree.length === 0 ? (
              <p className="text-sm text-muted-foreground">No org units yet. Add a company root.</p>
            ) : (
              tree.map((n) => <OrgNode key={n.id as string} node={n} />)
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Unit types ({units.length})</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-1.5">
            {ORG_UNIT_TYPES.map((t) => {
              const n = units.filter((u) => u.unit_type === t).length;
              return (
                <Badge key={t} variant={n ? "default" : "outline"} className="text-[10px]">
                  {t} {n || ""}
                </Badge>
              );
            })}
          </CardContent>
        </Card>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add organization unit</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Code</Label>
              <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="DEPT-QA" />
            </div>
            <div>
              <Label>Name</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <Label>Type</Label>
              <Select value={form.unit_type} onValueChange={(v) => setForm({ ...form, unit_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ORG_UNIT_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Parent</Label>
              <Select
                value={form.parent_id || "none"}
                onValueChange={(v) => setForm({ ...form, parent_id: v === "none" ? "" : v })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None (root)</SelectItem>
                  {units.map((u) => (
                    <SelectItem key={u.id as string} value={u.id as string}>
                      {String(u.name)}
                    </SelectItem>
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
