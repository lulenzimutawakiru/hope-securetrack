"use client";

import { useEffect, useState } from "react";
import { Plus, GitBranch, Factory, Warehouse } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { LoadingState } from "@/components/ui/loading-state";
import { EmptyState } from "@/components/ui/empty-state";
import { useUser } from "@/hooks/use-user";
import {
  listBranches, createBranch, listFactories, createFactory, listWarehouses,
} from "@/lib/enterprise-company";
import { toast } from "sonner";

export default function StructurePage() {
  const { auth } = useUser();
  const [loading, setLoading] = useState(true);
  const [branches, setBranches] = useState<Array<Record<string, unknown>>>([]);
  const [factories, setFactories] = useState<Array<Record<string, unknown>>>([]);
  const [warehouses, setWarehouses] = useState<Array<Record<string, unknown>>>([]);
  const [dialog, setDialog] = useState<"branch" | "factory" | null>(null);
  const [form, setForm] = useState({ code: "", name: "", region: "", manager_name: "", city: "" });

  const load = async () => {
    if (!auth?.profile?.company_id) { setLoading(false); return; }
    const cid = auth.profile.company_id;
    try {
      const [b, f, w] = await Promise.all([
        listBranches(cid), listFactories(cid), listWarehouses(cid),
      ]);
      setBranches(b as Array<Record<string, unknown>>);
      setFactories(f as Array<Record<string, unknown>>);
      setWarehouses(w as Array<Record<string, unknown>>);
    } catch { /* */ } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [auth]);

  const save = async () => {
    if (!auth || !form.code || !form.name) return toast.error("Code and name required");
    try {
      if (dialog === "branch") {
        await createBranch({
          company_id: auth.profile.company_id,
          code: form.code,
          name: form.name,
          region: form.region,
          manager_name: form.manager_name,
        });
      } else if (dialog === "factory") {
        await createFactory({
          company_id: auth.profile.company_id,
          code: form.code,
          name: form.name,
          plant_manager_name: form.manager_name,
          city: form.city,
        });
      }
      toast.success("Created");
      setDialog(null);
      setForm({ code: "", name: "", region: "", manager_name: "", city: "" });
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  };

  if (loading) return <LoadingState message="Loading structure…" />;

  return (
    <div>
      <PageHeader
        title="Branches · Factories · Warehouses"
        description="Unlimited sites · cost centers · managers · tax regions"
        actions={
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setDialog("branch")}>
              <Plus className="h-4 w-4 mr-1" /> Branch
            </Button>
            <Button size="sm" onClick={() => setDialog("factory")}>
              <Plus className="h-4 w-4 mr-1" /> Factory
            </Button>
          </div>
        }
      />

      <Tabs defaultValue="branches">
        <TabsList>
          <TabsTrigger value="branches"><GitBranch className="h-3.5 w-3.5 mr-1" /> Branches ({branches.length})</TabsTrigger>
          <TabsTrigger value="factories"><Factory className="h-3.5 w-3.5 mr-1" /> Factories ({factories.length})</TabsTrigger>
          <TabsTrigger value="warehouses"><Warehouse className="h-3.5 w-3.5 mr-1" /> Warehouses ({warehouses.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="branches" className="mt-4">
          {branches.length === 0 ? <EmptyState title="No branches" description="Add your first branch." /> : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Region</TableHead>
                    <TableHead>Manager</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {branches.map((b) => (
                    <TableRow key={b.id as string}>
                      <TableCell className="font-mono text-xs">{String(b.code)}</TableCell>
                      <TableCell className="font-medium text-sm">{String(b.name)}</TableCell>
                      <TableCell className="text-xs">{String(b.branch_type || "—")}</TableCell>
                      <TableCell className="text-xs">{String(b.region || b.city || "—")}</TableCell>
                      <TableCell className="text-xs">{String(b.manager_name || "—")}</TableCell>
                      <TableCell><Badge variant={b.is_active ? "default" : "secondary"}>{b.is_active ? "active" : "inactive"}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="factories" className="mt-4">
          {factories.length === 0 ? <EmptyState title="No factories" description="Register a plant." /> : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Manager</TableHead>
                    <TableHead>Lines</TableHead>
                    <TableHead>Capacity</TableHead>
                    <TableHead>OEE target</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {factories.map((f) => (
                    <TableRow key={f.id as string}>
                      <TableCell className="font-mono text-xs">{String(f.code)}</TableCell>
                      <TableCell className="font-medium text-sm">{String(f.name)}</TableCell>
                      <TableCell className="text-xs">{String(f.plant_manager_name || "—")}</TableCell>
                      <TableCell className="text-xs">{String(f.production_lines ?? "—")}</TableCell>
                      <TableCell className="text-xs">{String(f.production_capacity ?? "—")}</TableCell>
                      <TableCell className="text-xs">{String(f.oee_target ?? 85)}%</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="warehouses" className="mt-4">
          {warehouses.length === 0 ? <EmptyState title="No warehouses" description="Create warehouses in inventory." /> : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>City</TableHead>
                    <TableHead>Type</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {warehouses.map((w) => (
                    <TableRow key={w.id as string}>
                      <TableCell className="font-mono text-xs">{String(w.code)}</TableCell>
                      <TableCell className="font-medium text-sm">{String(w.name)}</TableCell>
                      <TableCell className="text-xs">{String(w.city || "—")}</TableCell>
                      <TableCell className="text-xs">{String(w.warehouse_type || "main")}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={!!dialog} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add {dialog}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div><Label>Code</Label><Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} /></div>
            <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            {dialog === "branch" && (
              <div><Label>Region</Label><Input value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })} /></div>
            )}
            <div><Label>Manager</Label><Input value={form.manager_name} onChange={(e) => setForm({ ...form, manager_name: e.target.value })} /></div>
            {dialog === "factory" && (
              <div><Label>City</Label><Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)}>Cancel</Button>
            <Button onClick={save}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
