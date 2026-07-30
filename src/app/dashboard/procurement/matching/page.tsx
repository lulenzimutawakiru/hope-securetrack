"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Scale, Play, RefreshCw } from "lucide-react";
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
import { StatusBadge } from "@/components/ui/status-badge";
import { LoadingState } from "@/components/ui/loading-state";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { listMatchLogs } from "@/lib/srm";
import { evaluateThreeWayMatch } from "@/lib/procurement/three-way-match";
import { formatNumber } from "@/lib/utils";
import { toast } from "sonner";

export default function SrmMatchingPage() {
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    po_amount: "1000000",
    grn_amount: "1000000",
    invoice_amount: "1000000",
    notes: "",
  });
  const [preview, setPreview] = useState<ReturnType<typeof evaluateThreeWayMatch> | null>(null);

  const load = async () => {
    try {
      const data = await listMatchLogs();
      setRows(data);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Load failed");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const runPreview = () => {
    setPreview(
      evaluateThreeWayMatch({
        poAmount: Number(form.po_amount) || 0,
        grnAmount: Number(form.grn_amount) || 0,
        invoiceAmount: Number(form.invoice_amount) || 0,
      })
    );
  };

  const runMatch = async (dryRun: boolean) => {
    setBusy(true);
    try {
      const res = await fetch("/api/procurement/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          po_amount: Number(form.po_amount) || 0,
          grn_amount: Number(form.grn_amount) || 0,
          invoice_amount: Number(form.invoice_amount) || 0,
          notes: form.notes || undefined,
          dry_run: dryRun,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        throw new Error(json?.error?.message || "Match failed");
      }
      setPreview(json.data.result);
      if (!dryRun) {
        toast.success(`Match saved: ${json.data.result.status}`);
        setOpen(false);
        setLoading(true);
        await load();
      } else {
        toast.message(`Preview: ${json.data.result.status}`);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Match failed");
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <LoadingState message="Loading three-way match…" />;

  const matched = rows.filter((r) => r.match_status === "matched").length;
  const exceptions = rows.filter(
    (r) => r.match_status === "exception" || r.match_status === "partial"
  ).length;

  return (
    <div>
      <PageHeader
        title="Three-Way Invoice Matching"
        description="PO + GRN + Supplier Invoice · variance · tolerance · payment gate"
        actions={
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => { setLoading(true); void load(); }}>
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href="/dashboard/procurement/orders">Purchase orders</Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href="/dashboard/inventory/grn">GRN</Link>
            </Button>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Play className="h-4 w-4 mr-1" /> Run match
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Evaluate three-way match</DialogTitle>
                </DialogHeader>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div>
                    <Label>PO amount</Label>
                    <Input
                      type="number"
                      value={form.po_amount}
                      onChange={(e) => setForm({ ...form, po_amount: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>GRN amount</Label>
                    <Input
                      type="number"
                      value={form.grn_amount}
                      onChange={(e) => setForm({ ...form, grn_amount: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Invoice amount</Label>
                    <Input
                      type="number"
                      value={form.invoice_amount}
                      onChange={(e) => setForm({ ...form, invoice_amount: e.target.value })}
                    />
                  </div>
                  <div className="sm:col-span-3">
                    <Label>Notes</Label>
                    <Input
                      value={form.notes}
                      onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    />
                  </div>
                </div>
                {preview && (
                  <Card className="mt-2">
                    <CardHeader className="py-2">
                      <CardTitle className="text-sm">
                        Result: <StatusBadge status={preview.status} />
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="text-xs text-muted-foreground space-y-1">
                      <p>Variance: {formatNumber(preview.variance)}</p>
                      <p>Can pay: {preview.canPay ? "Yes" : "No"}</p>
                      <ul className="list-disc pl-4">
                        {preview.notes.map((n) => (
                          <li key={n}>{n}</li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                )}
                <DialogFooter className="gap-2">
                  <Button variant="outline" disabled={busy} onClick={runPreview}>
                    Local preview
                  </Button>
                  <Button variant="outline" disabled={busy} onClick={() => runMatch(true)}>
                    Server dry-run
                  </Button>
                  <Button disabled={busy} onClick={() => runMatch(false)}>
                    Save match log
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3 mb-6">
        <StatCard title="Match logs" value={String(rows.length)} icon={Scale} />
        <StatCard title="Matched" value={String(matched)} />
        <StatCard title="Exceptions / partial" value={String(exceptions)} />
      </div>

      <div className="rounded-lg border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">PO amount</TableHead>
              <TableHead className="text-right">GRN amount</TableHead>
              <TableHead className="text-right">Invoice amount</TableHead>
              <TableHead className="text-right">Variance</TableHead>
              <TableHead>Notes</TableHead>
              <TableHead>Matched</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-8">
                  No match logs yet — use Run match to evaluate PO + GRN + invoice
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r) => (
                <TableRow key={String(r.id)}>
                  <TableCell>
                    <StatusBadge status={String(r.match_status)} />
                  </TableCell>
                  <TableCell className="text-right">
                    {formatNumber(Number(r.po_amount || 0))}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatNumber(Number(r.grn_amount || 0))}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatNumber(Number(r.invoice_amount || 0))}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatNumber(Number(r.variance || 0))}
                  </TableCell>
                  <TableCell className="text-sm max-w-[220px] truncate">
                    {String(r.notes || "—")}
                  </TableCell>
                  <TableCell className="text-xs">
                    {r.matched_at
                      ? new Date(String(r.matched_at)).toLocaleDateString()
                      : "—"}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
