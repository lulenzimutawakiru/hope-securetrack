"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { GitPullRequest, Plus } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import { createClient } from "@/lib/supabase/crud-compat";
import { useUser } from "@/hooks/use-user";
import { formatNumber } from "@/lib/utils";
import { toast } from "sonner";
import { crudCreate, crudUpdate } from "@/lib/api/crud-client";

export default function WorkflowsSettingsPage() {
  const { auth } = useUser();
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    workflow_code: "",
    name: "",
    document_type: "purchase_order",
    min_amount: "0",
    max_amount: "",
    department: "",
    steps_json: '[{"role":"manager","order":1,"sla_hours":24}]',
  });

  const load = async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("approval_workflows")
      .select("*")
      .order("workflow_code");
    setRows(data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth) return;
    let steps: unknown = [];
    try {
      steps = JSON.parse(form.steps_json);
    } catch {
      toast.error("Steps must be valid JSON");
      return;
    }
    const crudRes2 = await crudCreate("approval_workflows", {
        company_id: auth.profile.company_id,
        workflow_code: form.workflow_code,
        name: form.name,
        document_type: form.document_type,
        min_amount: Number(form.min_amount) || 0,
        max_amount: form.max_amount ? Number(form.max_amount) : null,
        department: form.department || null,
        steps,
        is_active: true,
      });
    if (!crudRes2.ok) {
      toast.error(crudRes2.error);
      return;
    }
    toast.success("Workflow created");
    setOpen(false);
    load();
  };

  const toggle = async (id: string, is_active: boolean) => {
    if (!auth) return;
    const crudRes = await crudUpdate("approval_workflows", id, { is_active: !is_active, updated_at: new Date().toISOString() });
    if (!crudRes.ok) toast.error(crudRes.error);
    else {
      load();
    }
  };

  if (loading) return <LoadingState />;

  return (
    <div>
      <PageHeader
        title="Approval Workflows"
        description="Value · department · branch rules · sequential / parallel steps · SLA"
        actions={
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard/settings">Hub</Link>
            </Button>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-1" />
                  Workflow
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <form onSubmit={create} className="space-y-3">
                  <DialogHeader>
                    <DialogTitle>New approval workflow</DialogTitle>
                  </DialogHeader>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label>Code</Label>
                      <Input
                        value={form.workflow_code}
                        onChange={(e) => setForm((f) => ({ ...f, workflow_code: e.target.value }))}
                        placeholder="WF-PO-STD"
                        required
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Document type</Label>
                      <Input
                        value={form.document_type}
                        onChange={(e) => setForm((f) => ({ ...f, document_type: e.target.value }))}
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label>Name</Label>
                    <Input
                      value={form.name}
                      onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="space-y-1">
                      <Label>Min amount</Label>
                      <Input
                        type="number"
                        value={form.min_amount}
                        onChange={(e) => setForm((f) => ({ ...f, min_amount: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Max amount</Label>
                      <Input
                        type="number"
                        value={form.max_amount}
                        onChange={(e) => setForm((f) => ({ ...f, max_amount: e.target.value }))}
                        placeholder="∞"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Department</Label>
                      <Input
                        value={form.department}
                        onChange={(e) => setForm((f) => ({ ...f, department: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label>Steps (JSON)</Label>
                    <textarea
                      className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-xs font-mono"
                      value={form.steps_json}
                      onChange={(e) => setForm((f) => ({ ...f, steps_json: e.target.value }))}
                    />
                  </div>
                  <DialogFooter>
                    <Button type="submit">Create</Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        }
      />

      {rows.length === 0 ? (
        <EmptyState icon={GitPullRequest} title="No workflows" description="Define approval chains" />
      ) : (
        <div className="rounded-lg border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Document</TableHead>
                <TableHead className="text-right">Min</TableHead>
                <TableHead className="text-right">Max</TableHead>
                <TableHead>Steps</TableHead>
                <TableHead>Status</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => {
                const steps = Array.isArray(r.steps) ? r.steps : [];
                return (
                  <TableRow key={String(r.id)}>
                    <TableCell className="font-mono text-sm">{String(r.workflow_code)}</TableCell>
                    <TableCell>{String(r.name)}</TableCell>
                    <TableCell className="text-sm">{String(r.document_type)}</TableCell>
                    <TableCell className="text-right text-sm">
                      {formatNumber(Number(r.min_amount || 0))}
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {r.max_amount != null ? formatNumber(Number(r.max_amount)) : "∞"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {steps.length} step{steps.length === 1 ? "" : "s"}
                    </TableCell>
                    <TableCell>
                      {r.is_active ? (
                        <Badge className="bg-green-100 text-green-800">Active</Badge>
                      ) : (
                        <Badge variant="secondary">Inactive</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => toggle(String(r.id), Boolean(r.is_active))}
                      >
                        {r.is_active ? "Disable" : "Enable"}
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
