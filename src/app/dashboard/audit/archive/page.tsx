"use client";

import { useEffect, useState } from "react";
import { Archive, Unlock } from "lucide-react";
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
import { formatDateTime } from "@/lib/utils";
import { toast } from "sonner";
import {
  archiveEvents,
  requestArchiveRetrieval,
  approveArchiveRetrieval,
  fulfillArchiveRetrieval,
} from "@/lib/audit";

export default function AuditArchivePage() {
  const { auth } = useUser();
  const [batches, setBatches] = useState<Array<Record<string, unknown>>>([]);
  const [retrievals, setRetrievals] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ period_start: "", period_end: "", notes: "" });
  const [reason, setReason] = useState("");

  const companyId = auth?.profile?.company_id as string | undefined;
  const userId = auth?.profile?.id as string | undefined;

  const load = async () => {
    const sb = createClient();
    const [{ data: b }, { data: r }] = await Promise.all([
      sb.from("eal_archive_batches").select("*").order("sealed_at", { ascending: false }),
      sb.from("eal_archive_retrievals").select("*").order("created_at", { ascending: false }).limit(30),
    ]);
    setBatches((b as Array<Record<string, unknown>>) || []);
    setRetrievals((r as Array<Record<string, unknown>>) || []);
    setLoading(false);
  };

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, []);

  const seal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId) return;
    try {
      const batch = await archiveEvents({
        company_id: companyId,
        period_start: form.period_start,
        period_end: form.period_end + "T23:59:59",
        sealed_by: userId,
        notes: form.notes,
      });
      toast.success(`Sealed ${batch.batch_number} (${batch.event_count} events)`);
      setOpen(false);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Archive failed");
    }
  };

  const request = async (batchId: string) => {
    if (!companyId || !reason.trim()) {
      toast.error("Enter retrieval reason first");
      return;
    }
    try {
      await requestArchiveRetrieval({
        company_id: companyId,
        batch_id: batchId,
        requested_by: userId,
        reason,
      });
      toast.success("Retrieval requested — awaiting approval");
      setReason("");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  };

  const approve = async (id: string, ok: boolean) => {
    try {
      await approveArchiveRetrieval({ retrieval_id: id, approved_by: userId, approve: ok });
      toast.success(ok ? "Approved" : "Denied");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  };

  const fulfill = async (id: string) => {
    if (!companyId) return;
    try {
      const res = await fulfillArchiveRetrieval({
        company_id: companyId,
        retrieval_id: id,
        fulfilled_by: userId,
      });
      toast.success(`Fulfilled · ${res.events.length} events · token ${res.access_token_hint}`);
      const blob = new Blob([JSON.stringify(res.events, null, 2)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `archive-retrieval-${res.access_token_hint}.json`;
      a.click();
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  };

  if (loading) return <LoadingState message="Loading secure archive…" />;

  return (
    <div>
      <PageHeader
        title="Secure Archive & Retrieval"
        description="Seal hot events into encrypted archive · dual-control retrieval · never delete"
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Archive className="h-4 w-4 mr-1" /> Seal period</Button>
            </DialogTrigger>
            <DialogContent>
              <form onSubmit={seal}>
                <DialogHeader><DialogTitle>Archive batch</DialogTitle></DialogHeader>
                <div className="grid gap-3 py-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label>From</Label>
                      <Input type="date" required value={form.period_start} onChange={(e) => setForm((f) => ({ ...f, period_start: e.target.value }))} />
                    </div>
                    <div>
                      <Label>To</Label>
                      <Input type="date" required value={form.period_end} onChange={(e) => setForm((f) => ({ ...f, period_end: e.target.value }))} />
                    </div>
                  </div>
                  <div>
                    <Label>Notes</Label>
                    <Input value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
                  </div>
                </div>
                <DialogFooter><Button type="submit">Seal archive</Button></DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="mb-4">
        <Label className="text-xs">Retrieval business reason (required)</Label>
        <Input
          className="mt-1 max-w-xl"
          placeholder="e.g. External financial audit Q1 2026 — ticket AUD-442"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </div>

      {batches.length === 0 ? (
        <EmptyState title="No archive batches" description="Seal a period after migration 00040." icon={Archive} />
      ) : (
        <div className="rounded-md border overflow-x-auto mb-8">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Batch</TableHead>
                <TableHead>Period</TableHead>
                <TableHead>Events</TableHead>
                <TableHead>Seal</TableHead>
                <TableHead>Status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {batches.map((b) => (
                <TableRow key={String(b.id)}>
                  <TableCell className="font-mono text-xs">{String(b.batch_number)}</TableCell>
                  <TableCell className="text-xs">
                    {String(b.period_start).slice(0, 10)} → {String(b.period_end).slice(0, 10)}
                  </TableCell>
                  <TableCell>{String(b.event_count)}</TableCell>
                  <TableCell className="font-mono text-[10px] max-w-[100px] truncate">{String(b.integrity_seal)}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-[10px] capitalize">{String(b.status)}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="outline" onClick={() => request(String(b.id))}>
                      <Unlock className="h-3 w-3 mr-1" /> Request
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <h3 className="text-sm font-medium mb-2">Retrieval queue</h3>
      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>When</TableHead>
              <TableHead>Reason</TableHead>
              <TableHead>Status</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {retrievals.map((r) => (
              <TableRow key={String(r.id)}>
                <TableCell className="text-xs whitespace-nowrap">{formatDateTime(String(r.created_at))}</TableCell>
                <TableCell className="text-xs max-w-[240px] truncate">{String(r.reason)}</TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-[10px] capitalize">{String(r.approval_status)}</Badge>
                </TableCell>
                <TableCell className="text-right space-x-1">
                  {r.approval_status === "pending" && (
                    <>
                      <Button size="sm" variant="outline" onClick={() => approve(String(r.id), true)}>Approve</Button>
                      <Button size="sm" variant="ghost" onClick={() => approve(String(r.id), false)}>Deny</Button>
                    </>
                  )}
                  {r.approval_status === "approved" && (
                    <Button size="sm" onClick={() => fulfill(String(r.id))}>Fulfill (JSON)</Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {retrievals.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-sm text-muted-foreground">No retrieval requests</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
