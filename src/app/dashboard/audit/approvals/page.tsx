"use client";

import { useEffect, useState } from "react";
import { GitBranch, Plus } from "lucide-react";
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
import { createClient } from "@/lib/supabase/crud-compat";
import { useUser } from "@/hooks/use-user";
import { formatDateTime } from "@/lib/utils";
import { toast } from "sonner";
import { recordApproval } from "@/lib/audit";

export default function AuditApprovalsPage() {
  const { auth } = useUser();
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    approval_chain_id: "",
    module: "procurement",
    entity_reference: "",
    approver_name: "",
    decision: "approved",
    comments: "",
    previous_approver: "",
    next_approver: "",
    sequence_no: "1",
  });

  const companyId = auth?.profile?.company_id as string | undefined;

  const load = async () => {
    const { data } = await createClient()
      .from("eal_approvals")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
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
      await recordApproval({
        company_id: companyId,
        approval_chain_id: form.approval_chain_id || `CHAIN-${Date.now().toString(36).toUpperCase()}`,
        sequence_no: Number(form.sequence_no) || 1,
        module: form.module,
        entity_reference: form.entity_reference,
        approver_name: form.approver_name,
        decision: form.decision,
        comments: form.comments,
        previous_approver: form.previous_approver || undefined,
        next_approver: form.next_approver || undefined,
        requestor_name: (auth?.profile as { email?: string } | undefined)?.email,
      });
      toast.success("Approval recorded");
      setOpen(false);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  };

  if (loading) return <LoadingState message="Loading approval trails…" />;

  // Group by chain for visual
  const chains = new Map<string, Array<Record<string, unknown>>>();
  rows.forEach((r) => {
    const k = String(r.approval_chain_id);
    if (!chains.has(k)) chains.set(k, []);
    chains.get(k)!.push(r);
  });

  return (
    <div>
      <PageHeader
        title="Approval Traceability"
        description="Request · approver · decision · signature · previous/next · chain of custody"
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Record step</Button>
            </DialogTrigger>
            <DialogContent>
              <form onSubmit={create}>
                <DialogHeader><DialogTitle>Approval step</DialogTitle></DialogHeader>
                <div className="grid gap-3 py-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label>Chain ID</Label>
                      <Input value={form.approval_chain_id} onChange={(e) => setForm((f) => ({ ...f, approval_chain_id: e.target.value }))} placeholder="PO-CHAIN-100" />
                    </div>
                    <div>
                      <Label>Sequence</Label>
                      <Input type="number" value={form.sequence_no} onChange={(e) => setForm((f) => ({ ...f, sequence_no: e.target.value }))} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label>Module</Label>
                      <Input value={form.module} onChange={(e) => setForm((f) => ({ ...f, module: e.target.value }))} />
                    </div>
                    <div>
                      <Label>Reference</Label>
                      <Input value={form.entity_reference} onChange={(e) => setForm((f) => ({ ...f, entity_reference: e.target.value }))} placeholder="PO-2026-0142" />
                    </div>
                  </div>
                  <div>
                    <Label>Approver</Label>
                    <Input required value={form.approver_name} onChange={(e) => setForm((f) => ({ ...f, approver_name: e.target.value }))} />
                  </div>
                  <div>
                    <Label>Decision</Label>
                    <Select value={form.decision} onValueChange={(v) => setForm((f) => ({ ...f, decision: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="approved">Approved</SelectItem>
                        <SelectItem value="rejected">Rejected</SelectItem>
                        <SelectItem value="delegated">Delegated</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Comments</Label>
                    <Input value={form.comments} onChange={(e) => setForm((f) => ({ ...f, comments: e.target.value }))} />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label>Previous</Label>
                      <Input value={form.previous_approver} onChange={(e) => setForm((f) => ({ ...f, previous_approver: e.target.value }))} />
                    </div>
                    <div>
                      <Label>Next</Label>
                      <Input value={form.next_approver} onChange={(e) => setForm((f) => ({ ...f, next_approver: e.target.value }))} />
                    </div>
                  </div>
                </div>
                <DialogFooter><Button type="submit">Save</Button></DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      {rows.length === 0 ? (
        <EmptyState title="No approval trails" description="PO and finance multi-step approvals appear here." />
      ) : (
        <div className="space-y-6">
          {Array.from(chains.entries()).map(([chainId, steps]) => (
            <div key={chainId} className="rounded-lg border p-4">
              <div className="flex items-center gap-2 mb-3">
                <GitBranch className="h-4 w-4 text-primary" />
                <span className="font-mono text-sm font-medium">{chainId}</span>
                <Badge variant="outline" className="text-[10px]">
                  {String(steps[0]?.entity_reference || steps[0]?.module)}
                </Badge>
              </div>
              <div className="flex flex-wrap gap-2 mb-3">
                {[...steps]
                  .sort((a, b) => Number(a.sequence_no) - Number(b.sequence_no))
                  .map((s, i) => (
                    <div key={String(s.id)} className="flex items-center gap-1 text-xs">
                      {i > 0 && <span className="text-muted-foreground">→</span>}
                      <Badge
                        variant={s.decision === "approved" ? "default" : s.decision === "rejected" ? "destructive" : "outline"}
                        className="capitalize"
                      >
                        {String(s.approver_name)} · {String(s.decision)}
                      </Badge>
                    </div>
                  ))}
              </div>
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>#</TableHead>
                      <TableHead>Approver</TableHead>
                      <TableHead>Decision</TableHead>
                      <TableHead>Comments</TableHead>
                      <TableHead>Signature</TableHead>
                      <TableHead>When</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[...steps]
                      .sort((a, b) => Number(a.sequence_no) - Number(b.sequence_no))
                      .map((s) => (
                        <TableRow key={String(s.id)}>
                          <TableCell>{String(s.sequence_no)}</TableCell>
                          <TableCell className="font-medium text-sm">{String(s.approver_name)}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-[10px] capitalize">{String(s.decision)}</Badge>
                          </TableCell>
                          <TableCell className="text-xs max-w-[200px] truncate">{String(s.comments || "—")}</TableCell>
                          <TableCell className="font-mono text-[10px] max-w-[100px] truncate">
                            {String(s.digital_signature || "—")}
                          </TableCell>
                          <TableCell className="text-xs whitespace-nowrap">
                            {s.decided_at ? formatDateTime(String(s.decided_at)) : "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
