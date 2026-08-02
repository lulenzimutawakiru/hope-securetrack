"use client";

import { useEffect, useState } from "react";
import { ClipboardList, Plus } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/hooks/use-user";
import { toast } from "sonner";
import { crudCreate, crudUpdate } from "@/lib/api/crud-client";

export default function AuditFindingsPage() {
  const { auth } = useUser();
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    title: "",
    description: "",
    severity: "medium",
    category: "control_gap",
    framework_code: "ISO27001",
    owner_name: "",
    due_date: "",
  });

  const companyId = auth?.profile?.company_id as string | undefined;
  const userId = auth?.profile?.id as string | undefined;

  const load = async () => {
    const { data } = await createClient()
      .from("eal_findings")
      .select("*")
      .order("created_at", { ascending: false });
    setRows((data as Array<Record<string, unknown>>) || []);
    setLoading(false);
  };

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, []);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId) return;
    const { count } = await createClient()
      .from("eal_findings")
      .select("*", { count: "exact", head: true })
      .eq("company_id", companyId);
    const crudRes2 = await crudCreate("eal_findings", {
      company_id: companyId,
      finding_number: `FND-${String((count ?? 0) + 1).padStart(4, "0")}`,
      title: form.title,
      description: form.description,
      severity: form.severity,
      category: form.category,
      framework_code: form.framework_code,
      owner_name: form.owner_name,
      due_date: form.due_date || null,
      status: "open",
      created_by: userId,
    });
    if (!crudRes2.ok) toast.error(crudRes2.error);
    else {
      toast.success("Finding opened");
      setOpen(false);
      await load();
    }
  };

  const setStatus = async (id: string, status: string) => {
    const patch: Record<string, unknown> = { status };
    if (status === "closed") patch.closed_at = new Date().toISOString();
    const crudRes = await crudUpdate("eal_findings", id, patch);
    toast.success(`Status → ${status}`);
    await load();
  };

  if (loading) return <LoadingState message="Loading findings…" />;

  return (
    <div>
      <PageHeader
        title="Outstanding Findings"
        description="Control gaps · fraud · access · process · audit dashboard"
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Finding</Button>
            </DialogTrigger>
            <DialogContent>
              <form onSubmit={create}>
                <DialogHeader><DialogTitle>New finding</DialogTitle></DialogHeader>
                <div className="grid gap-3 py-3">
                  <div>
                    <Label>Title</Label>
                    <Input required value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
                  </div>
                  <div>
                    <Label>Description</Label>
                    <Input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label>Severity</Label>
                      <Select value={form.severity} onValueChange={(v) => setForm((f) => ({ ...f, severity: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low">Low</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                          <SelectItem value="critical">Critical</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Framework</Label>
                      <Input value={form.framework_code} onChange={(e) => setForm((f) => ({ ...f, framework_code: e.target.value }))} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label>Owner</Label>
                      <Input value={form.owner_name} onChange={(e) => setForm((f) => ({ ...f, owner_name: e.target.value }))} />
                    </div>
                    <div>
                      <Label>Due</Label>
                      <Input type="date" value={form.due_date} onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))} />
                    </div>
                  </div>
                </div>
                <DialogFooter><Button type="submit">Create</Button></DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      {rows.length === 0 ? (
        <EmptyState title="No findings" description="Seed findings appear after migration 00040." icon={ClipboardList} />
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Severity</TableHead>
                <TableHead>Framework</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={String(r.id)}>
                  <TableCell className="font-mono text-xs">{String(r.finding_number)}</TableCell>
                  <TableCell>
                    <p className="text-sm font-medium">{String(r.title)}</p>
                    <p className="text-xs text-muted-foreground line-clamp-1">{String(r.description || "")}</p>
                  </TableCell>
                  <TableCell>
                    <Badge variant={r.severity === "high" || r.severity === "critical" ? "destructive" : "outline"} className="text-[10px] capitalize">
                      {String(r.severity)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs">{String(r.framework_code || "—")}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-[10px] capitalize">{String(r.status)}</Badge>
                  </TableCell>
                  <TableCell className="text-xs">{String(r.owner_name || "—")}</TableCell>
                  <TableCell className="text-right space-x-1">
                    {r.status === "open" && (
                      <Button size="sm" variant="outline" onClick={() => setStatus(String(r.id), "in_remediation")}>
                        Remediate
                      </Button>
                    )}
                    {r.status !== "closed" && (
                      <Button size="sm" onClick={() => setStatus(String(r.id), "closed")}>Close</Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
