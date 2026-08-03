"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { LoadingState } from "@/components/ui/loading-state";
import { toast } from "sonner";
import { Plus, RefreshCw, ShieldCheck } from "lucide-react";

const ACTIONS = [
  "identity.provision",
  "identity.reset_password",
  "payroll.release",
  "payroll.bank_file",
  "finance.gl_post",
  "finance.period_close",
  "billing.payment_void",
  "platform.provision_tenant",
];

type DcRow = {
  id: string;
  action: string;
  status: string;
  maker_id?: string;
  checker_id?: string | null;
  subject_type?: string | null;
  subject_id?: string | null;
  notes?: string | null;
  created_at?: string;
};

export default function DualControlPage() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<DcRow[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    action: "identity.provision",
    subject_type: "",
    subject_id: "",
    notes: "",
  });

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/security/dual-control");
      const json = await res.json();
      if (!res.ok) {
        throw new Error(
          json?.error?.message || json?.error || "Load failed"
        );
      }
      const items =
        (json.data?.items as DcRow[] | undefined) ||
        (json.items as DcRow[] | undefined) ||
        [];
      setRows(items);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load dual-control queue");
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const create = async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/security/dual-control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          op: "create",
          action: form.action,
          subject_type: form.subject_type || undefined,
          subject_id: form.subject_id || undefined,
          notes: form.notes || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(
          json?.error?.message || json?.error || "Create failed"
        );
      }
      toast.success("Dual-control request created");
      setOpen(false);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Create failed");
    } finally {
      setBusy(false);
    }
  };

  const decide = async (id: string, approve: boolean) => {
    setBusy(true);
    try {
      const res = await fetch("/api/security/dual-control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ op: "approve", request_id: id, approve }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(
          json?.error?.message || json?.error || "Action failed"
        );
      }
      toast.success(approve ? "Approved" : "Rejected");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <LoadingState message="Loading dual-control queue…" />;

  return (
    <div>
      <PageHeader
        title="Dual-control (maker-checker)"
        description="Enterprise segregation of duties for identity, payroll, finance, and platform actions"
        actions={
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={load}>
              <RefreshCw className="h-4 w-4 mr-1" /> Refresh
            </Button>
            <Button size="sm" onClick={() => setOpen(true)}>
              <Plus className="h-4 w-4 mr-1" /> New request
            </Button>
          </div>
        }
      />

      <div className="rounded-lg border bg-muted/30 p-3 text-sm mb-4 flex gap-2">
        <ShieldCheck className="h-4 w-4 shrink-0 mt-0.5 text-primary" />
        <p className="text-xs text-muted-foreground">
          When <code className="text-[10px]">DUAL_CONTROL_REQUIRED=true</code>, sensitive APIs
          (identity provision/reset) require an approved request id. Makers cannot approve their own
          requests.
        </p>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Action</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Subject</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Request ID</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-mono text-xs">{r.action}</TableCell>
                <TableCell>
                  <Badge variant="secondary" className="text-[10px]">{r.status}</Badge>
                </TableCell>
                <TableCell className="text-xs">
                  {r.subject_type || "—"}
                  {r.subject_id ? ` · ${String(r.subject_id).slice(0, 8)}…` : ""}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {r.created_at ? new Date(r.created_at).toLocaleString() : ""}
                </TableCell>
                <TableCell className="font-mono text-[10px] max-w-[8rem] truncate" title={r.id}>
                  {r.id}
                </TableCell>
                <TableCell className="space-x-1">
                  {r.status === "pending" && (
                    <>
                      <Button size="sm" disabled={busy} onClick={() => decide(r.id, true)}>
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() => decide(r.id, false)}
                      >
                        Reject
                      </Button>
                    </>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-8">
                  No dual-control requests. Create one before high-risk operations.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New dual-control request</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Action</Label>
              <Select
                value={form.action}
                onValueChange={(v) => setForm({ ...form, action: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ACTIONS.map((a) => (
                    <SelectItem key={a} value={a}>
                      {a}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Subject type (optional)</Label>
              <Input
                value={form.subject_type}
                onChange={(e) => setForm({ ...form, subject_type: e.target.value })}
                placeholder="user | payroll_run | journal"
              />
            </div>
            <div>
              <Label>Subject ID (optional UUID)</Label>
              <Input
                value={form.subject_id}
                onChange={(e) => setForm({ ...form, subject_id: e.target.value })}
              />
            </div>
            <div>
              <Label>Notes</Label>
              <Input
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={create} disabled={busy}>
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
