"use client";

import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { LoadingState } from "@/components/ui/loading-state";
import { EmptyState } from "@/components/ui/empty-state";
import { useUser } from "@/hooks/use-user";
import { listDepartments, createDepartment } from "@/lib/enterprise-company";
import { toast } from "sonner";

export default function DepartmentsPage() {
  const { auth } = useUser();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ code: "", name: "", manager_name: "", cost_center_code: "" });

  const load = async () => {
    if (!auth?.profile?.company_id) { setLoading(false); return; }
    try {
      setRows((await listDepartments(auth.profile.company_id)) as Array<Record<string, unknown>>);
    } catch { /* */ } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [auth]);

  const save = async () => {
    if (!auth || !form.code || !form.name) return toast.error("Code and name required");
    try {
      await createDepartment({
        company_id: auth.profile.company_id,
        code: form.code,
        name: form.name,
        manager_name: form.manager_name || undefined,
        cost_center_code: form.cost_center_code || undefined,
      });
      toast.success("Department created");
      setOpen(false);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  };

  if (loading) return <LoadingState message="Loading departments…" />;

  return (
    <div>
      <PageHeader
        title="Departments"
        description="Finance · HR · Production · Warehouse · QC · ICT · Dispatch · Service Desk"
        actions={<Button size="sm" onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-1" /> Add</Button>}
      />
      {rows.length === 0 ? (
        <EmptyState title="No departments" description="Seed or create departments." />
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Manager</TableHead>
                <TableHead>Cost center</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id as string}>
                  <TableCell className="font-mono text-xs">{String(r.code)}</TableCell>
                  <TableCell className="font-medium text-sm">{String(r.name)}</TableCell>
                  <TableCell className="text-xs">{String(r.manager_name || "—")}</TableCell>
                  <TableCell className="font-mono text-xs">{String(r.cost_center_code || "—")}</TableCell>
                  <TableCell>
                    <Badge variant={r.is_active !== false ? "default" : "secondary"}>
                      {r.is_active !== false ? "active" : "inactive"}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>New department</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Code</Label><Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} /></div>
            <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div><Label>Manager</Label><Input value={form.manager_name} onChange={(e) => setForm({ ...form, manager_name: e.target.value })} /></div>
            <div><Label>Cost center</Label><Input value={form.cost_center_code} onChange={(e) => setForm({ ...form, cost_center_code: e.target.value })} /></div>
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
