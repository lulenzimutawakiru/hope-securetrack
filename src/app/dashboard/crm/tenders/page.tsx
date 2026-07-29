"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Gavel } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { useUser } from "@/hooks/use-user";
import { listTenders, createTender, listCustomers } from "@/lib/crm";
import { formatNumber } from "@/lib/utils";
import { toast } from "sonner";

export default function CrmTendersPage() {
  const { auth } = useUser();
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [customers, setCustomers] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    title: "",
    customer_id: "",
    issuing_body: "",
    tender_type: "open",
    bid_value: "100000000",
    submission_deadline: "",
    requirements: "",
  });

  const load = async () => {
    try {
      const [t, c] = await Promise.all([listTenders(), listCustomers({ limit: 80 })]);
      setRows(t);
      setCustomers(c);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Load failed");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth) return;
    try {
      await createTender({
        company_id: auth.profile.company_id,
        title: form.title,
        customer_id: form.customer_id || null,
        issuing_body: form.issuing_body,
        tender_type: form.tender_type,
        bid_value: parseFloat(form.bid_value) || 0,
        submission_deadline: form.submission_deadline
          ? new Date(form.submission_deadline).toISOString()
          : undefined,
        requirements: form.requirements,
        owner_id: auth.user.id,
      });
      toast.success("Tender registered");
      setOpen(false);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  };

  if (loading) return <LoadingState message="Loading tenders…" />;

  const pipeline = rows
    .filter((r) => !["awarded", "lost", "cancelled"].includes(String(r.status)))
    .reduce((s, r) => s + Number(r.bid_value || 0), 0);

  return (
    <div>
      <PageHeader
        title="Tenders & Institutional Sales"
        description="Framework contracts · PO tracking · multi-site · compliance docs"
        actions={
          <div className="flex gap-2">
            <Button asChild size="sm" variant="outline">
              <Link href="/dashboard/crm/contracts">Contracts</Link>
            </Button>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button size="sm"><Plus className="h-4 w-4 mr-1" /> New tender</Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <form onSubmit={submit}>
                  <DialogHeader><DialogTitle>Register tender</DialogTitle></DialogHeader>
                  <div className="grid gap-3 py-3">
                    <div>
                      <Label>Title</Label>
                      <Input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
                    </div>
                    <div>
                      <Label>Issuing body</Label>
                      <Input value={form.issuing_body} onChange={(e) => setForm({ ...form, issuing_body: e.target.value })} />
                    </div>
                    <div>
                      <Label>Customer</Label>
                      <Select value={form.customer_id} onValueChange={(v) => setForm({ ...form, customer_id: v })}>
                        <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
                        <SelectContent>
                          {customers.map((c) => (
                            <SelectItem key={String(c.id)} value={String(c.id)}>{String(c.name)}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label>Bid value</Label>
                        <Input value={form.bid_value} onChange={(e) => setForm({ ...form, bid_value: e.target.value })} />
                      </div>
                      <div>
                        <Label>Deadline</Label>
                        <Input type="date" value={form.submission_deadline} onChange={(e) => setForm({ ...form, submission_deadline: e.target.value })} />
                      </div>
                    </div>
                    <div>
                      <Label>Requirements</Label>
                      <Textarea value={form.requirements} onChange={(e) => setForm({ ...form, requirements: e.target.value })} rows={3} />
                    </div>
                  </div>
                  <DialogFooter><Button type="submit">Save</Button></DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 mb-6">
        <StatCard title="Active tenders" value={String(rows.length)} icon={Gavel} />
        <StatCard title="Bid pipeline" value={formatNumber(pipeline)} />
      </div>

      {rows.length === 0 ? (
        <EmptyState title="No tenders" description="Track government and institutional bids." />
      ) : (
        <div className="rounded-lg border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Number</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Issuer</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Bid value</TableHead>
                <TableHead>Win %</TableHead>
                <TableHead>Deadline</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={String(r.id)}>
                  <TableCell className="font-mono text-xs">{String(r.tender_number)}</TableCell>
                  <TableCell className="font-medium text-sm max-w-[240px]">{String(r.title)}</TableCell>
                  <TableCell className="text-sm">{String(r.issuing_body || "—")}</TableCell>
                  <TableCell><StatusBadge status={String(r.status)} /></TableCell>
                  <TableCell className="text-right">{formatNumber(Number(r.bid_value || 0))}</TableCell>
                  <TableCell>{String(r.win_probability ?? 0)}%</TableCell>
                  <TableCell className="text-xs">
                    {r.submission_deadline
                      ? new Date(String(r.submission_deadline)).toLocaleDateString()
                      : "—"}
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
