"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Plus } from "lucide-react";
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
import { PROBLEM_STATUSES, createProblem } from "@/lib/service-desk";

export default function ProblemsPage() {
  const { auth } = useUser();
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", root_cause: "", workaround: "" });

  const companyId = auth?.profile?.company_id as string | undefined;

  const load = async () => {
    const { data } = await createClient()
      .from("sd_problems")
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
      await createProblem({
        company_id: companyId,
        title: form.title,
        description: form.description,
        created_by: auth?.user?.id,
      });
      toast.success("Problem record created");
      setOpen(false);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  };

  const updateStatus = async (id: string, status: string) => {
    const patch: Record<string, unknown> = { status };
    if (status === "resolved" || status === "closed") patch.resolved_at = new Date().toISOString();
    if (status === "known_error") patch.known_error = true;
    const crudRes = await crudUpdate("sd_problems", id, patch);
    if (!crudRes.ok) toast.error(crudRes.error);
    else {
      toast.success(`Status → ${status}`);
      await load();
    }
  };

  if (loading) return <LoadingState message="Loading problems…" />;

  const known = rows.filter((r) => r.known_error || r.status === "known_error").length;
  const openCount = rows.filter((r) => r.status === "open" || r.status === "investigating").length;

  return (
    <div>
      <PageHeader
        title="Problem Management"
        description="Recurring issues · RCA · known errors · workarounds · permanent fixes"
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Problem</Button>
            </DialogTrigger>
            <DialogContent>
              <form onSubmit={create}>
                <DialogHeader><DialogTitle>New problem</DialogTitle></DialogHeader>
                <div className="grid gap-3 py-3">
                  <div>
                    <Label>Title</Label>
                    <Input required value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
                  </div>
                  <div>
                    <Label>Description</Label>
                    <Input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
                  </div>
                </div>
                <DialogFooter><Button type="submit">Create</Button></DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3 mb-6">
        <StatCard title="Problems" value={String(rows.length)} icon={AlertTriangle} />
        <StatCard title="Open / investigating" value={String(openCount)} icon={AlertTriangle} />
        <StatCard title="Known errors" value={String(known)} icon={AlertTriangle} />
      </div>

      {rows.length === 0 ? (
        <EmptyState title="No problems" description="Link recurring incidents into problem records." />
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Number</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Known error</TableHead>
                <TableHead>Update</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={String(r.id)}>
                  <TableCell className="font-mono text-sm">{String(r.problem_number)}</TableCell>
                  <TableCell>
                    <div className="text-sm font-medium">{String(r.title)}</div>
                    {r.workaround ? (
                      <div className="text-xs text-muted-foreground">WA: {String(r.workaround)}</div>
                    ) : null}
                  </TableCell>
                  <TableCell><StatusBadge status={String(r.status)} /></TableCell>
                  <TableCell>{r.known_error ? "Yes" : "No"}</TableCell>
                  <TableCell>
                    <Select value={String(r.status)} onValueChange={(v) => updateStatus(String(r.id), v)}>
                      <SelectTrigger className="h-8 w-[140px]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {PROBLEM_STATUSES.map((s) => (
                          <SelectItem key={s} value={s}>{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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
