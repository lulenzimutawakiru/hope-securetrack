"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Printer, Tag, ExternalLink } from "lucide-react";
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
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
      toast.success("Print job created — open Label Studio to print");
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
        description="Queue jobs and produce SecureTrack QR verification labels"
        actions={
          <div className="flex gap-2">
            <Link href="/dashboard/labels">
              <Button variant="default">
                <Tag className="mr-2 h-4 w-4" />
                Open Label Studio
              </Button>
            </Link>
            {hasPermission("printing.create") && (
              <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline">
                    <Plus className="mr-2 h-4 w-4" />
                    Queue Job
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <form onSubmit={handleCreate}>
                    <DialogHeader>
                      <DialogTitle>Create Print Job</DialogTitle>
                      <DialogDescription>
                        Track a label print run (browser or print agent)
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
            )}
          </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-3 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Browser labels
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm mb-3">
              Print QR verification labels from any workstation (A4 sheets).
            </p>
            <Link href="/dashboard/labels">
              <Button size="sm" className="w-full">
                <Tag className="mr-2 h-4 w-4" />
                Label Studio
                <ExternalLink className="ml-2 h-3 w-3" />
              </Button>
            </Link>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Workflow
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-1">
            <p>1. Create production batch</p>
            <p>2. Generate QR codes</p>
            <p>3. Build & print labels</p>
            <p>4. Mark printed → pack / warehouse</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Public verify URL
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs font-mono break-all mb-2">
              {(process.env.NEXT_PUBLIC_APP_URL ||
                "https://hope-securetrack.vercel.app") + "/verify"}
            </p>
            <Link href="/verify" target="_blank">
              <Button size="sm" variant="outline" className="w-full">
                Open portal
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      {jobs.length === 0 ? (
        <EmptyState
          icon={Printer}
          title="No print jobs yet"
          description="Queue a job or print directly from Label Studio"
          action={
            <Link href="/dashboard/labels">
              <Button>Produce labels</Button>
            </Link>
          }
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
                    {formatNumber(j.printed_labels)} /{" "}
                    {formatNumber(j.total_labels)}
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
                  <TableCell className="text-right space-x-2">
                    {j.batch_id && (
                      <Link href={`/dashboard/labels?batch=${j.batch_id}`}>
                        <Button size="sm" variant="outline">
                          Labels
                        </Button>
                      </Link>
                    )}
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
