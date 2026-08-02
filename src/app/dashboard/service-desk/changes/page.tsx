"use client";

import { useEffect, useState } from "react";
import { GitBranch, Plus, Check, X } from "lucide-react";
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
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import { StatCard } from "@/components/ui/stat-card";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/hooks/use-user";
import { toast } from "sonner";
import { crudUpdate } from "@/lib/api/crud-client";
import { CHANGE_TYPES, createChange, approveChange } from "@/lib/service-desk";

export default function ChangesPage() {
  const { auth } = useUser();
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    title: "",
    description: "",
    change_type: "normal",
    risk_level: "medium",
    impact: "medium",
    implementation_plan: "",
    rollback_plan: "",
  });

  const companyId = auth?.profile?.company_id as string | undefined;

  const load = async () => {
    const { data } = await createClient()
      .from("sd_changes")
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
    try {
      await createChange({
        company_id: companyId,
        ...form,
        requested_by: auth?.user?.id,
      });
      toast.success("Change request created");
      setOpen(false);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  };

  const submitCab = async (id: string) => {
    const crudRes3 = await crudUpdate("sd_changes", id, { status: "cab_review" });
    toast.success("Submitted to CAB");
    await load();
  };

  if (loading) return <LoadingState message="Loading changes…" />;

  const pending = rows.filter((r) => r.status === "cab_review" || r.status === "submitted").length;

  return (
    <div>
      <PageHeader
        title="Change Management"
        description="Standard · normal · emergency · CAB · implementation · rollback"
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Change request</Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto">
              <form onSubmit={create}>
                <DialogHeader><DialogTitle>New change</DialogTitle></DialogHeader>
                <div className="grid gap-3 py-3">
                  <div>
                    <Label>Title</Label>
                    <Input required value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
                  </div>
                  <div>
                    <Label>Type</Label>
                    <Select value={form.change_type} onValueChange={(v) => setForm((f) => ({ ...f, change_type: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {CHANGE_TYPES.map((t) => (
                          <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Description</Label>
                    <Input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
                  </div>
                  <div>
                    <Label>Implementation plan</Label>
                    <Input value={form.implementation_plan} onChange={(e) => setForm((f) => ({ ...f, implementation_plan: e.target.value }))} />
                  </div>
                  <div>
                    <Label>Rollback plan</Label>
                    <Input value={form.rollback_plan} onChange={(e) => setForm((f) => ({ ...f, rollback_plan: e.target.value }))} />
                  </div>
                </div>
                <DialogFooter><Button type="submit">Create draft</Button></DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 mb-6">
        <StatCard title="Changes" value={String(rows.length)} icon={GitBranch} />
        <StatCard title="Pending CAB" value={String(pending)} icon={GitBranch} />
      </div>

      {rows.length === 0 ? (
        <EmptyState title="No changes" description="Create a change request for infrastructure updates." />
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Number</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Risk</TableHead>
                <TableHead>Status</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={String(r.id)}>
                  <TableCell className="font-mono text-sm">{String(r.change_number)}</TableCell>
                  <TableCell className="text-sm">{String(r.title)}</TableCell>
                  <TableCell className="capitalize text-sm">{String(r.change_type)}</TableCell>
                  <TableCell className="capitalize text-sm">{String(r.risk_level)}</TableCell>
                  <TableCell><StatusBadge status={String(r.status)} /></TableCell>
                  <TableCell className="space-x-1">
                    {r.status === "draft" && (
                      <Button size="sm" variant="outline" onClick={() => submitCab(String(r.id))}>
                        Submit CAB
                      </Button>
                    )}
                    {(r.status === "cab_review" || r.status === "submitted") && auth?.user?.id && (
                      <>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={async () => {
                            await approveChange(String(r.id), auth.user!.id, true);
                            toast.success("Approved");
                            await load();
                          }}
                        >
                          <Check className="h-4 w-4 text-green-600" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={async () => {
                            await approveChange(String(r.id), auth.user!.id, false, "Rejected by CAB");
                            toast.success("Rejected");
                            await load();
                          }}
                        >
                          <X className="h-4 w-4 text-destructive" />
                        </Button>
                      </>
                    )}
                    {r.status === "approved" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={async () => {
                          const crudRes2 = await crudUpdate("sd_changes", String(r.id), { status: "implementing" });
                          toast.success("Implementing");
                          await load();
                        }}
                      >
                        Implement
                      </Button>
                    )}
                    {r.status === "implementing" && (
                      <Button
                        size="sm"
                        onClick={async () => {
                          const crudRes = await crudUpdate("sd_changes", String(r.id), {
                              status: "implemented",
                              implemented_at: new Date().toISOString(),
                            });
                          toast.success("Implemented");
                          await load();
                        }}
                      >
                        Complete
                      </Button>
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
