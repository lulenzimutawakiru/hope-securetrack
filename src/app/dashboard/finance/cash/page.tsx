"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Banknote } from "lucide-react";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingState } from "@/components/ui/loading-state";
import { StatCard } from "@/components/ui/stat-card";
import { useUser } from "@/hooks/use-user";
import {
  getCashPosition,
  listCashForecasts,
  listPettyCash,
  createPettyCash,
  listMobileMoney,
  predictCashShortfall,
} from "@/lib/finance";
import { formatNumber } from "@/lib/utils";
import { toast } from "sonner";

export default function FinanceCashPage() {
  const { auth } = useUser();
  const [pos, setPos] = useState<Record<string, unknown> | null>(null);
  const [forecasts, setForecasts] = useState<Array<Record<string, unknown>>>([]);
  const [petty, setPetty] = useState<Array<Record<string, unknown>>>([]);
  const [momo, setMomo] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ payee: "", purpose: "", amount: "100000" });
  const [riskMsg, setRiskMsg] = useState("");

  const load = async () => {
    try {
      const [p, f, pc, m] = await Promise.all([
        getCashPosition(),
        listCashForecasts(),
        listPettyCash(),
        listMobileMoney(),
      ]);
      setPos(p as Record<string, unknown> | null);
      setForecasts(f);
      setPetty(pc);
      setMomo(m);
      setRiskMsg(
        predictCashShortfall(
          f.map((x) => ({
            forecast_date: String(x.forecast_date),
            projected_balance: Number(x.projected_balance),
            net_flow: Number(x.net_flow),
          }))
        ).message
      );
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
      await createPettyCash({
        company_id: auth.profile.company_id,
        payee: form.payee,
        purpose: form.purpose,
        amount: parseFloat(form.amount) || 0,
        created_by: auth.user.id,
      });
      toast.success("Petty cash voucher posted");
      setOpen(false);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  };

  if (loading) return <LoadingState message="Loading cash management…" />;

  return (
    <div>
      <PageHeader
        title="Cash Management"
        description="Position · vault · petty cash · MoMo · Airtel Money · liquidity forecast"
        actions={
          <div className="flex gap-2">
            <Button asChild size="sm" variant="outline">
              <Link href="/dashboard/finance/bank">Banks</Link>
            </Button>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Petty cash</Button>
              </DialogTrigger>
              <DialogContent>
                <form onSubmit={submit}>
                  <DialogHeader><DialogTitle>Petty cash voucher</DialogTitle></DialogHeader>
                  <div className="grid gap-3 py-3">
                    <div>
                      <Label>Payee</Label>
                      <Input required value={form.payee} onChange={(e) => setForm({ ...form, payee: e.target.value })} />
                    </div>
                    <div>
                      <Label>Purpose</Label>
                      <Input required value={form.purpose} onChange={(e) => setForm({ ...form, purpose: e.target.value })} />
                    </div>
                    <div>
                      <Label>Amount</Label>
                      <Input value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
                    </div>
                  </div>
                  <DialogFooter><Button type="submit">Post</Button></DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        <StatCard title="Total cash" value={formatNumber(Math.round(Number(pos?.total_cash || 0)))} icon={Banknote} />
        <StatCard title="Bank" value={formatNumber(Math.round(Number(pos?.bank_balance || 0)))} />
        <StatCard title="Cash / vault" value={formatNumber(Math.round(Number(pos?.cash_balance || 0)))} />
        <StatCard title="Mobile money" value={formatNumber(Math.round(Number(pos?.mobile_money_balance || 0)))} />
      </div>

      <Card className="mb-6 border-amber-500/30 bg-amber-500/5">
        <CardContent className="p-4 text-sm">{riskMsg}</CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2 mb-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Cash flow forecast</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {forecasts.map((f) => (
              <div key={String(f.id)} className="flex justify-between text-sm border-b last:border-0 pb-2">
                <div>
                  <p className="font-medium">{f.forecast_date ? String(f.forecast_date).slice(0, 10) : "—"}</p>
                  <p className="text-[10px] text-muted-foreground">
                    In {formatNumber(Number(f.inflow || 0))} · Out {formatNumber(Number(f.outflow || 0))}
                  </p>
                </div>
                <div className="text-right">
                  <p className={`font-semibold ${Number(f.net_flow || 0) < 0 ? "text-destructive" : "text-emerald-600"}`}>
                    {formatNumber(Number(f.net_flow || 0))}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    Bal {formatNumber(Number(f.projected_balance || 0))}
                  </p>
                </div>
              </div>
            ))}
            {forecasts.length === 0 && (
              <p className="text-sm text-muted-foreground">No forecasts — apply migration 00047.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Mobile money (MTN / Airtel)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {momo.map((t) => (
              <div key={String(t.id)} className="flex justify-between text-sm border-b last:border-0 pb-2">
                <div>
                  <Badge variant="outline" className="text-[10px] mr-1">{String(t.provider)}</Badge>
                  <span className="capitalize text-xs">{String(t.direction)}</span>
                  <p className="text-[10px] text-muted-foreground">{String(t.phone || t.reference || "")}</p>
                </div>
                <span className="font-semibold">{formatNumber(Number(t.amount || 0))}</span>
              </div>
            ))}
            {momo.length === 0 && <p className="text-sm text-muted-foreground">No MoMo transactions</p>}
          </CardContent>
        </Card>
      </div>

      <h2 className="text-sm font-semibold mb-2">Petty cash vouchers</h2>
      <div className="rounded-lg border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Voucher</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Payee</TableHead>
              <TableHead>Purpose</TableHead>
              <TableHead className="text-right">Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {petty.map((p) => (
              <TableRow key={String(p.id)}>
                <TableCell className="font-mono text-xs">{String(p.voucher_number)}</TableCell>
                <TableCell className="text-xs">{p.txn_date ? String(p.txn_date).slice(0, 10) : "—"}</TableCell>
                <TableCell className="text-sm">{String(p.payee || "—")}</TableCell>
                <TableCell className="text-sm max-w-[200px] truncate">{String(p.purpose || "—")}</TableCell>
                <TableCell className="text-right">{formatNumber(Number(p.amount || 0))}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
