"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FileQuestion, Plus } from "lucide-react";
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
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/hooks/use-user";
import { formatDate, formatNumber } from "@/lib/utils";
import { toast } from "sonner";

export default function RfqPage() {
  const { auth } = useUser();
  const [rfqs, setRfqs] = useState<Array<Record<string, unknown>>>([]);
  const [quotes, setQuotes] = useState<Array<Record<string, unknown>>>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    title: "",
    rfq_type: "rfq",
    category: "raw_materials",
    close_date: "",
  });

  const load = async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("rfqs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    setRfqs(data ?? []);
    setLoading(false);
  };

  const loadQuotes = async (rfqId: string) => {
    const supabase = createClient();
    const { data } = await supabase
      .from("supplier_quotations")
      .select("*, suppliers(name, code)")
      .eq("rfq_id", rfqId)
      .order("total_score", { ascending: false });
    setQuotes(data ?? []);
    setSelected(rfqId);
  };

  useEffect(() => {
    load();
  }, []);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth) return;
    const supabase = createClient();
    const num = `RFQ-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;
    const { error } = await supabase.from("rfqs").insert({
      company_id: auth.profile.company_id,
      rfq_number: num,
      title: form.title,
      rfq_type: form.rfq_type,
      category: form.category,
      status: "published",
      publish_date: new Date().toISOString().slice(0, 10),
      close_date: form.close_date || null,
      created_by: auth.profile.id,
    });
    if (error) toast.error(error.message);
    else {
      toast.success(`Published ${num}`);
      setOpen(false);
      load();
    }
  };

  const award = async (quoteId: string, rfqId: string, supplierId: string) => {
    if (!auth) return;
    const supabase = createClient();
    await supabase
      .from("supplier_quotations")
      .update({ status: "awarded" })
      .eq("id", quoteId);
    await supabase
      .from("supplier_quotations")
      .update({ status: "rejected" })
      .eq("rfq_id", rfqId)
      .neq("id", quoteId);
    await supabase
      .from("rfqs")
      .update({
        status: "awarded",
        awarded_supplier_id: supplierId,
        awarded_at: new Date().toISOString(),
      })
      .eq("id", rfqId);
    toast.success("RFQ awarded");
    load();
    loadQuotes(rfqId);
  };

  if (loading) return <LoadingState />;

  return (
    <div>
      <PageHeader
        title="RFQ / RFP / Tenders"
        description="Electronic sourcing · bid comparison · technical & financial scorecards"
        actions={
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard/procurement">Hub</Link>
            </Button>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-1" />
                  New RFQ
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create RFQ</DialogTitle>
                </DialogHeader>
                <form onSubmit={create} className="space-y-3">
                  <div className="space-y-1">
                    <Label>Title</Label>
                    <Input
                      value={form.title}
                      onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label>Type</Label>
                      <Input
                        value={form.rfq_type}
                        onChange={(e) => setForm((f) => ({ ...f, rfq_type: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Close date</Label>
                      <Input
                        type="date"
                        value={form.close_date}
                        onChange={(e) => setForm((f) => ({ ...f, close_date: e.target.value }))}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button type="submit">Publish</Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-lg border overflow-x-auto">
          {rfqs.length === 0 ? (
            <EmptyState icon={FileQuestion} title="No RFQs" description="Publish a tender or RFQ" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>RFQ #</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Close</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rfqs.map((r) => (
                  <TableRow
                    key={String(r.id)}
                    className="cursor-pointer"
                    onClick={() => loadQuotes(String(r.id))}
                  >
                    <TableCell className="font-mono text-sm">
                      {String(r.rfq_number)}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{String(r.title)}</div>
                      <Badge variant="outline" className="text-xs capitalize">
                        {String(r.rfq_type)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {r.close_date ? formatDate(String(r.close_date)) : "—"}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={String(r.status)} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>

        <div className="rounded-lg border p-4">
          <h3 className="font-medium mb-3">
            {selected ? "Quotation evaluation scorecard" : "Select an RFQ"}
          </h3>
          {!selected ? (
            <p className="text-sm text-muted-foreground">
              Compare price, delivery, technical & financial scores.
            </p>
          ) : quotes.length === 0 ? (
            <p className="text-sm text-muted-foreground">No supplier quotations yet</p>
          ) : (
            <div className="space-y-3">
              {quotes.map((q) => {
                const sup = q.suppliers as { name?: string; code?: string } | null;
                return (
                  <div key={String(q.id)} className="rounded border p-3 space-y-2">
                    <div className="flex justify-between gap-2">
                      <div>
                        <div className="font-medium">
                          {sup?.code} — {sup?.name}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Ref {String(q.quotation_ref ?? "—")} ·{" "}
                          {formatNumber(Number(q.delivery_days || 0))} days ·{" "}
                          {String(q.payment_terms ?? "")}
                        </div>
                      </div>
                      <StatusBadge status={String(q.status)} />
                    </div>
                    <div className="grid grid-cols-4 gap-2 text-center text-xs">
                      <div>
                        <div className="text-muted-foreground">Amount</div>
                        <div className="font-medium">
                          {formatNumber(Math.round(Number(q.total_amount)))}
                        </div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Tech</div>
                        <div className="font-medium">{formatNumber(Number(q.technical_score))}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Fin</div>
                        <div className="font-medium">{formatNumber(Number(q.financial_score))}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Total</div>
                        <div className="font-bold text-hope-teal">
                          {formatNumber(Number(q.total_score))}
                        </div>
                      </div>
                    </div>
                    {q.status !== "awarded" && (
                      <Button
                        size="sm"
                        onClick={() =>
                          award(String(q.id), String(q.rfq_id), String(q.supplier_id))
                        }
                      >
                        Award supplier
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
