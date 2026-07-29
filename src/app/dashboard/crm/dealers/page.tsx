"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Truck } from "lucide-react";
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
import { StatCard } from "@/components/ui/stat-card";
import { useUser } from "@/hooks/use-user";
import { listDealers, createDealer, listCustomers } from "@/lib/crm";
import { formatNumber } from "@/lib/utils";
import { toast } from "sonner";

export default function CrmDealersPage() {
  const { auth } = useUser();
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [customers, setCustomers] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    customer_id: "",
    dealer_type: "dealer",
    territory: "Central Uganda",
    region: "Central",
    sales_target: "100000000",
    commission_pct: "3",
  });

  const load = async () => {
    try {
      const [d, c] = await Promise.all([listDealers(), listCustomers({ limit: 100 })]);
      setRows(d);
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
    if (!auth || !form.customer_id) return;
    try {
      await createDealer({
        company_id: auth.profile.company_id,
        customer_id: form.customer_id,
        dealer_type: form.dealer_type,
        territory: form.territory,
        region: form.region,
        sales_target: parseFloat(form.sales_target) || 0,
        commission_pct: parseFloat(form.commission_pct) || 0,
      });
      toast.success("Dealer registered");
      setOpen(false);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  };

  if (loading) return <LoadingState message="Loading dealers…" />;

  const targetSum = rows.reduce((s, r) => s + Number(r.sales_target || 0), 0);
  const ytdSum = rows.reduce((s, r) => s + Number(r.ytd_sales || 0), 0);

  return (
    <div>
      <PageHeader
        title="Distributor & Dealer Management"
        description="Territory · targets · price lists · commissions · performance"
        actions={
          <div className="flex gap-2">
            <Button asChild size="sm" variant="outline">
              <Link href="/dashboard/sales/commissions">Commissions</Link>
            </Button>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Add dealer</Button>
              </DialogTrigger>
              <DialogContent>
                <form onSubmit={submit}>
                  <DialogHeader><DialogTitle>Register channel partner</DialogTitle></DialogHeader>
                  <div className="grid gap-3 py-3">
                    <div>
                      <Label>Customer account</Label>
                      <Select value={form.customer_id} onValueChange={(v) => setForm({ ...form, customer_id: v })}>
                        <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                        <SelectContent>
                          {customers.map((c) => (
                            <SelectItem key={String(c.id)} value={String(c.id)}>{String(c.name)}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label>Type</Label>
                        <Select value={form.dealer_type} onValueChange={(v) => setForm({ ...form, dealer_type: v })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="dealer">Dealer</SelectItem>
                            <SelectItem value="distributor">Distributor</SelectItem>
                            <SelectItem value="retailer">Retailer</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Commission %</Label>
                        <Input value={form.commission_pct} onChange={(e) => setForm({ ...form, commission_pct: e.target.value })} />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label>Territory</Label>
                        <Input value={form.territory} onChange={(e) => setForm({ ...form, territory: e.target.value })} />
                      </div>
                      <div>
                        <Label>Sales target</Label>
                        <Input value={form.sales_target} onChange={(e) => setForm({ ...form, sales_target: e.target.value })} />
                      </div>
                    </div>
                  </div>
                  <DialogFooter><Button type="submit">Register</Button></DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3 mb-6">
        <StatCard title="Partners" value={String(rows.length)} icon={Truck} />
        <StatCard title="YTD sales" value={formatNumber(ytdSum)} />
        <StatCard title="Annual targets" value={formatNumber(targetSum)} />
      </div>

      {rows.length === 0 ? (
        <EmptyState title="No dealers" description="Link customer accounts as channel partners." />
      ) : (
        <div className="rounded-lg border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Partner</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Territory</TableHead>
                <TableHead className="text-right">YTD</TableHead>
                <TableHead className="text-right">Target</TableHead>
                <TableHead>Pace</TableHead>
                <TableHead>Commission</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => {
                const tgt = Number(r.sales_target || 0);
                const ytd = Number(r.ytd_sales || 0);
                const pct = tgt > 0 ? Math.round((ytd / tgt) * 100) : 0;
                const cust = r.customers as { name?: string; code?: string } | null;
                return (
                  <TableRow key={String(r.id)}>
                    <TableCell className="font-mono text-xs">{String(r.dealer_code)}</TableCell>
                    <TableCell className="font-medium text-sm">{cust?.name || "—"}</TableCell>
                    <TableCell className="capitalize text-sm">{String(r.dealer_type)}</TableCell>
                    <TableCell className="text-sm">{String(r.territory || "—")}</TableCell>
                    <TableCell className="text-right">{formatNumber(ytd)}</TableCell>
                    <TableCell className="text-right">{formatNumber(tgt)}</TableCell>
                    <TableCell>
                      <Badge variant={pct < 50 ? "destructive" : pct < 80 ? "secondary" : "default"}>
                        {pct}%
                      </Badge>
                    </TableCell>
                    <TableCell>{String(r.commission_pct || 0)}%</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
