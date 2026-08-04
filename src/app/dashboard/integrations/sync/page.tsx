"use client";

import { useEffect, useState } from "react";
import { RefreshCw, Play, Plus } from "lucide-react";
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
import { LoadingState } from "@/components/ui/loading-state";
import { createClient } from "@/lib/supabase/crud-compat";
import { useUser } from "@/hooks/use-user";
import { toast } from "sonner";
import { crudCreate } from "@/lib/api/crud-client";
import { runSyncJob } from "@/lib/integration";

export default function SyncPage() {
  const { auth } = useUser();
  const [jobs, setJobs] = useState<Array<Record<string, unknown>>>([]);
  const [runs, setRuns] = useState<Array<Record<string, unknown>>>([]);
  const [maps, setMaps] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    direction: "inbound",
    source_entity: "",
    target_entity: "",
    sync_mode: "batch",
  });

  const load = async () => {
    const supabase = createClient();
    const [j, r, m] = await Promise.all([
      supabase.from("intg_sync_jobs").select("*").order("name"),
      supabase.from("intg_sync_runs").select("*, intg_sync_jobs(name)").order("started_at", { ascending: false }).limit(30),
      supabase.from("intg_field_maps").select("*"),
    ]);
    setJobs(j.data ?? []);
    setRuns(r.data ?? []);
    setMaps(m.data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, []);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth?.profile?.company_id) return;
    try {
      const supabase = createClient();
      const code = `SYNC-${Date.now().toString(36).toUpperCase()}`;
      const crudRes = await crudCreate("intg_sync_jobs", {
        company_id: auth.profile.company_id,
        job_code: code,
        name: form.name,
        direction: form.direction,
        source_entity: form.source_entity,
        target_entity: form.target_entity,
        sync_mode: form.sync_mode,
        status: "idle",
        is_active: true,
      });
      if (!crudRes.ok) throw new Error(crudRes.error);
      toast.success("Sync job created");
      setOpen(false);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  };

  const run = async (id: string) => {
    try {
      const supabase = createClient();
      const res = await runSyncJob(supabase, id);
      toast.success(`Synced ${res.records_written}/${res.records_read} records`);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Sync failed");
    }
  };

  if (loading) return <LoadingState message="Loading sync engine…" />;

  return (
    <div>
      <PageHeader
        title="Data Synchronization"
        description="Realtime · batch · scheduled · bidirectional · conflict-aware maps"
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 mr-1" /> New sync job</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Sync job</DialogTitle></DialogHeader>
              <form onSubmit={create} className="space-y-3">
                <div><Label>Name</Label><Input required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} /></div>
                <div>
                  <Label>Direction</Label>
                  <Select value={form.direction} onValueChange={(v) => setForm((f) => ({ ...f, direction: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["inbound", "outbound", "bidirectional"].map((d) => (
                        <SelectItem key={d} value={d}>{d}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div><Label>Source entity</Label><Input value={form.source_entity} onChange={(e) => setForm((f) => ({ ...f, source_entity: e.target.value }))} /></div>
                  <div><Label>Target entity</Label><Input value={form.target_entity} onChange={(e) => setForm((f) => ({ ...f, target_entity: e.target.value }))} /></div>
                </div>
                <div>
                  <Label>Mode</Label>
                  <Select value={form.sync_mode} onValueChange={(v) => setForm((f) => ({ ...f, sync_mode: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["realtime", "batch", "scheduled"].map((m) => (
                        <SelectItem key={m} value={m}>{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <DialogFooter><Button type="submit">Create</Button></DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="rounded-md border overflow-x-auto mb-8">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Job</TableHead>
              <TableHead>Direction</TableHead>
              <TableHead>Entities</TableHead>
              <TableHead>Mode</TableHead>
              <TableHead>Synced</TableHead>
              <TableHead>Last</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {jobs.map((j) => (
              <TableRow key={String(j.id)}>
                <TableCell>
                  <div className="font-medium text-sm">{String(j.name)}</div>
                  <div className="font-mono text-[10px] text-muted-foreground">{String(j.job_code)}</div>
                </TableCell>
                <TableCell className="text-xs">{String(j.direction)}</TableCell>
                <TableCell className="text-xs">{String(j.source_entity)} → {String(j.target_entity)}</TableCell>
                <TableCell className="text-xs">{String(j.sync_mode)}</TableCell>
                <TableCell className="text-xs">{String(j.records_synced)}</TableCell>
                <TableCell className="text-xs">{j.last_run_at ? new Date(String(j.last_run_at)).toLocaleString() : "—"}</TableCell>
                <TableCell>
                  <Button size="sm" variant="outline" onClick={() => run(String(j.id))}>
                    <Play className="h-3.5 w-3.5 mr-1" /> Run
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <h3 className="text-sm font-semibold mb-2">Field maps</h3>
      <div className="rounded-md border overflow-x-auto mb-8">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Source → Target</TableHead>
              <TableHead>Fields</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {maps.map((m) => (
              <TableRow key={String(m.id)}>
                <TableCell className="font-mono text-xs">{String(m.map_code)}</TableCell>
                <TableCell className="text-sm">{String(m.name)}</TableCell>
                <TableCell className="text-xs">{String(m.source_system)} → {String(m.target_system)}</TableCell>
                <TableCell className="text-xs">{((m.mappings as unknown[]) || []).length} mappings</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <h3 className="text-sm font-semibold mb-2 flex items-center gap-2"><RefreshCw className="h-4 w-4" /> Sync runs</h3>
      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Job</TableHead>
              <TableHead>Read</TableHead>
              <TableHead>Written</TableHead>
              <TableHead>Failed</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {runs.map((r) => (
              <TableRow key={String(r.id)}>
                <TableCell className="text-xs">{(r.intg_sync_jobs as { name?: string } | null)?.name}</TableCell>
                <TableCell className="text-xs">{String(r.records_read)}</TableCell>
                <TableCell className="text-xs">{String(r.records_written)}</TableCell>
                <TableCell className="text-xs">{String(r.records_failed)}</TableCell>
                <TableCell><StatusBadge status={String(r.status)} /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
