"use client";

import { useEffect, useState } from "react";
import { Plus, Printer } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import { createClient } from "@/lib/supabase/client";
import { formatDateTime, formatNumber } from "@/lib/utils";
import { useUser } from "@/hooks/use-user";
import { toast } from "sonner";
import type { PrintJob, ProductionBatch } from "@/types/database";

export default function PrintingPage() {
  const { auth, hasPermission } = useUser();
  const [jobs, setJobs] = useState<PrintJob[]>([]);
  const [batches, setBatches] = useState<ProductionBatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    batchId: "",
    labelType: "ream",
    totalLabels: "50",
  });

  const load = async () => {
    const supabase = createClient();
    const [{ data }, { data: batchData }] = await Promise.all([
      supabase
        .from("print_jobs")
        .select("*, production_batches(batch_number, product_code)")
        .order("created_at", { ascending: false })
        .limit(100),
      supabase
        .from("production_batches")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50),
    ]);
    setJobs((data as PrintJob[]) ?? []);
    setBatches((batchData as ProductionBatch[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth) return;
    setSaving(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.from("print_jobs").insert({
        company_id: auth.profile.company_id,
        batch_id: form.batchId,
        job_type: "batch",
        status: "pending",
        label_type: form.labelType,
        total_labels: parseInt(form.totalLabels, 10),
        created_by: auth.profile.id,
      });
      if (error) throw error;
      toast.success("Print job created");
      setOpen(false);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create job");
    } finally {
      setSaving(false);
    }
  };

  const updateStatus = async (id: string, status: string) => {
    const supabase = createClient();
    const updates: Record<string, unknown> = { status };
    if (status === "printing") updates.started_at = new Date().toISOString();
    if (status === "completed") updates.completed_at = new Date().toISOString();
    const { error } = await supabase.from("print_jobs").update(updates).eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Job updated");
      load();
    }
  };

  if (loading) return <LoadingState />;

  return (
    <div>
      <PageHeader
        title="Printing"
        description="Manage label print jobs for Niimbot and batch printers"
        actions={
          hasPermission("printing.create") && (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  New Print Job
                </Button>
              </DialogTrigger>
              <DialogContent>
                <form onSubmit={handleCreate}>
                  <DialogHeader>
                    <DialogTitle>Create Print Job</DialogTitle>
                    <DialogDescription>
                      Queue labels for printing via the print agent
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="space-y-2">
                      <Label>Batch</Label>
                      <Select
                        value={form.batchId}
                        onValueChange={(v) => setForm({ ...form, batchId: v })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select batch" />
                        </SelectTrigger>
                        <SelectContent>
                          {batches.map((b) => (
                            <SelectItem key={b.id} value={b.id}>
                              {b.batch_number}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Label Type</Label>
                      <Select
                        value={form.labelType}
                        onValueChange={(v) => setForm({ ...form, labelType: v })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ream">Ream</SelectItem>
                          <SelectItem value="carton">Carton</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Total Labels</Label>
                      <Input
                        type="number"
                        min={1}
                        value={form.totalLabels}
                        onChange={(e) =>
                          setForm({ ...form, totalLabels: e.target.value })
                        }
                        required
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button type="submit" disabled={saving || !form.batchId}>
                      {saving ? "Creating..." : "Create Job"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          )
        }
      />

      {jobs.length === 0 ? (
        <EmptyState
          icon={Printer}
          title="No print jobs"
          description="Create a print job to start labeling products"
        />
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Batch</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Progress</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {jobs.map((j) => (
                <TableRow key={j.id}>
                  <TableCell className="font-mono text-sm">
                    {j.production_batches?.batch_number ?? "—"}
                  </TableCell>
                  <TableCell className="capitalize">{j.label_type}</TableCell>
                  <TableCell>
                    {formatNumber(j.printed_labels)} / {formatNumber(j.total_labels)}
                    {j.failed_labels > 0 && (
                      <span className="text-red-500 text-xs ml-1">
                        ({j.failed_labels} failed)
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={j.status} />
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDateTime(j.created_at)}
                  </TableCell>
                  <TableCell className="text-right">
                    {j.status === "pending" && (
                      <Button size="sm" onClick={() => updateStatus(j.id, "queued")}>
                        Queue
                      </Button>
                    )}
                    {j.status === "queued" && (
                      <Button size="sm" onClick={() => updateStatus(j.id, "printing")}>
                        Start
                      </Button>
                    )}
                    {j.status === "printing" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => updateStatus(j.id, "completed")}
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
