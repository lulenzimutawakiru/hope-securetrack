"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { TrendingUp, Plus } from "lucide-react";
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
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/hooks/use-user";
import { formatDate, formatNumber } from "@/lib/utils";
import { toast } from "sonner";

export default function DemandPlanningPage() {
  const { auth } = useUser();
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [products, setProducts] = useState<Array<{ id: string; name: string; product_code: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    product_id: "",
    horizon: "weekly",
    period_start: "",
    period_end: "",
    forecast_qty: "",
  });

  const load = async () => {
    const supabase = createClient();
    const [{ data }, { data: prod }] = await Promise.all([
      supabase
        .from("demand_forecasts")
        .select("*, products(name, product_code)")
        .order("period_start")
        .limit(100),
      supabase
        .from("products")
        .select("id,name,product_code")
        .eq("is_active", true)
        .order("name")
        .limit(100),
    ]);
    setRows(data ?? []);
    setProducts(prod ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth) return;
    const supabase = createClient();
    const code = `FC-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;
    const { error } = await supabase.from("demand_forecasts").insert({
      company_id: auth.profile.company_id,
      forecast_code: code,
      product_id: form.product_id || null,
      horizon: form.horizon,
      period_start: form.period_start,
      period_end: form.period_end,
      forecast_qty: Number(form.forecast_qty),
      baseline_qty: Number(form.forecast_qty),
      model_name: "manual",
      confidence_pct: 75,
      created_by: auth.profile.id,
    });
    if (error) toast.error(error.message);
    else {
      toast.success(`Forecast ${code} saved`);
      setOpen(false);
      load();
    }
  };

  if (loading) return <LoadingState />;

  const totalFc = rows.reduce((s, r) => s + Number(r.forecast_qty || 0), 0);
  const avgConf =
    rows.length === 0
      ? 0
      : rows.reduce((s, r) => s + Number(r.confidence_pct || 0), 0) / rows.length;

  return (
    <div>
      <PageHeader
        title="Demand Planning"
        description="Historical + AI forecasts · daily/weekly/monthly · product family & warehouse"
        actions={
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard/scm">Hub</Link>
            </Button>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-1" />
                  Add forecast
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Demand forecast line</DialogTitle>
                </DialogHeader>
                <form onSubmit={create} className="space-y-3">
                  <div className="space-y-1">
                    <Label>Product</Label>
                    <Select
                      value={form.product_id}
                      onValueChange={(v) => setForm((f) => ({ ...f, product_id: v }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Product" />
                      </SelectTrigger>
                      <SelectContent>
                        {products.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.product_code} — {p.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label>Start</Label>
                      <Input
                        type="date"
                        value={form.period_start}
                        onChange={(e) => setForm((f) => ({ ...f, period_start: e.target.value }))}
                        required
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>End</Label>
                      <Input
                        type="date"
                        value={form.period_end}
                        onChange={(e) => setForm((f) => ({ ...f, period_end: e.target.value }))}
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label>Forecast qty</Label>
                    <Input
                      type="number"
                      min="0"
                      step="any"
                      value={form.forecast_qty}
                      onChange={(e) => setForm((f) => ({ ...f, forecast_qty: e.target.value }))}
                      required
                    />
                  </div>
                  <DialogFooter>
                    <Button type="submit">Save</Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-3 mb-6">
        <StatCard title="Forecast lines" value={formatNumber(rows.length)} icon={TrendingUp} />
        <StatCard title="Total forecast qty" value={formatNumber(totalFc)} />
        <StatCard title="Avg confidence" value={`${avgConf.toFixed(0)}%`} />
      </div>

      {rows.length === 0 ? (
        <EmptyState icon={TrendingUp} title="No forecasts" description="Create demand plans" />
      ) : (
        <div className="rounded-lg border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Product</TableHead>
                <TableHead>Horizon</TableHead>
                <TableHead>Period</TableHead>
                <TableHead className="text-right">Baseline</TableHead>
                <TableHead className="text-right">Forecast</TableHead>
                <TableHead className="text-right">Δ%</TableHead>
                <TableHead>Model</TableHead>
                <TableHead className="text-right">Confidence</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => {
                const prod = r.products as { name?: string; product_code?: string } | null;
                const base = Number(r.baseline_qty || 0);
                const fc = Number(r.forecast_qty || 0);
                const delta = base ? ((fc - base) / base) * 100 : 0;
                return (
                  <TableRow key={String(r.id)}>
                    <TableCell className="font-mono text-sm">
                      {String(r.forecast_code)}
                    </TableCell>
                    <TableCell>
                      {prod?.product_code ?? String(r.product_family ?? "—")}{" "}
                      <span className="text-muted-foreground text-sm">{prod?.name}</span>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {String(r.horizon)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm whitespace-nowrap">
                      {formatDate(String(r.period_start))} → {formatDate(String(r.period_end))}
                    </TableCell>
                    <TableCell className="text-right">{formatNumber(base)}</TableCell>
                    <TableCell className="text-right font-medium">
                      {formatNumber(fc)}
                    </TableCell>
                    <TableCell
                      className={`text-right ${delta > 10 ? "text-amber-700 font-medium" : ""}`}
                    >
                      {delta > 0 ? "+" : ""}
                      {delta.toFixed(1)}%
                    </TableCell>
                    <TableCell className="text-sm">{String(r.model_name)}</TableCell>
                    <TableCell className="text-right">
                      {formatNumber(Number(r.confidence_pct))}%
                    </TableCell>
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
