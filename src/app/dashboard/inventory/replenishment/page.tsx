"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { RefreshCw, Plus, Brain } from "lucide-react";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/hooks/use-user";
import { formatDate, formatNumber } from "@/lib/utils";
import { toast } from "sonner";

export default function ReplenishmentPage() {
  const { auth } = useUser();
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [insights, setInsights] = useState<Array<Record<string, unknown>>>([]);
  const [products, setProducts] = useState<
    Array<{
      id: string;
      name: string;
      product_code: string;
      reorder_level: number;
      reorder_qty: number;
      safety_stock: number;
      standard_cost: number;
      lead_time_days: number;
      preferred_supplier_name: string | null;
    }>
  >([]);
  const [warehouses, setWarehouses] = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    product_id: "",
    warehouse_id: "",
    quantity: "",
    reason: "",
    source: "manual",
  });

  const load = async () => {
    const supabase = createClient();
    const [{ data }, { data: prod }, { data: wh }, { data: ins }] = await Promise.all([
      supabase
        .from("purchase_requisitions")
        .select("*, products(name, product_code), warehouses(name)")
        .order("created_at", { ascending: false })
        .limit(100),
      supabase
        .from("products")
        .select(
          "id,name,product_code,reorder_level,reorder_qty,safety_stock,standard_cost,lead_time_days,preferred_supplier_name"
        )
        .eq("is_active", true)
        .order("name")
        .limit(200),
      supabase.from("warehouses").select("id,name").eq("is_active", true),
      supabase
        .from("inventory_insights")
        .select("*")
        .in("insight_type", ["reorder", "stockout_prediction", "overstock"])
        .eq("status", "open")
        .order("created_at", { ascending: false })
        .limit(5),
    ]);
    setRows(data ?? []);
    setProducts((prod as typeof products) ?? []);
    setWarehouses(wh ?? []);
    setInsights(ins ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const createReq = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth) return;
    const product = products.find((p) => p.id === form.product_id);
    const qty = Number(form.quantity || product?.reorder_qty || 0);
    if (!form.product_id || !qty) {
      toast.error("Product and quantity required");
      return;
    }
    const supabase = createClient();
    const num = `PR-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;
    const unit = Number(product?.standard_cost || 0);
    const { error } = await supabase.from("purchase_requisitions").insert({
      company_id: auth.profile.company_id,
      requisition_number: num,
      product_id: form.product_id,
      warehouse_id: form.warehouse_id || null,
      quantity: qty,
      suggested_supplier: product?.preferred_supplier_name || null,
      estimated_unit_cost: unit,
      estimated_total: unit * qty,
      lead_time_days: product?.lead_time_days ?? 7,
      reason: form.reason || "Manual replenishment",
      source: form.source,
      status: "submitted",
      priority: "medium",
      required_by: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
      created_by: auth.profile.id,
    });
    if (error) toast.error(error.message);
    else {
      toast.success(`Requisition ${num} created`);
      setOpen(false);
      load();
    }
  };

  const setStatus = async (id: string, status: string) => {
    if (!auth) return;
    const supabase = createClient();
    const patch: Record<string, unknown> = { status };
    if (status === "approved") {
      patch.approved_by = auth.profile.id;
      patch.approved_at = new Date().toISOString();
    }
    const { error } = await supabase
      .from("purchase_requisitions")
      .update(patch)
      .eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success(`Marked ${status}`);
      load();
    }
  };

  const generateFromReorder = async () => {
    if (!auth || !warehouses[0]) return;
    const supabase = createClient();
    const { data: balances } = await supabase
      .from("stock_balances")
      .select("product_id, quantity_on_hand, warehouse_id");
    let created = 0;
    for (const p of products) {
      const bal = (balances ?? []).find((b) => b.product_id === p.id);
      const onHand = Number(bal?.quantity_on_hand || 0);
      const reorder = Number(p.reorder_level || 0);
      if (reorder > 0 && onHand <= reorder) {
        const qty = Number(p.reorder_qty || 10);
        const num = `PR-${new Date().getFullYear()}-R${String(Date.now() + created).slice(-5)}`;
        const unit = Number(p.standard_cost || 0);
        await supabase.from("purchase_requisitions").insert({
          company_id: auth.profile.company_id,
          requisition_number: num,
          product_id: p.id,
          warehouse_id: bal?.warehouse_id || warehouses[0].id,
          quantity: qty,
          estimated_unit_cost: unit,
          estimated_total: unit * qty,
          lead_time_days: p.lead_time_days,
          reason: `Auto: on-hand ${onHand} ≤ reorder ${reorder}`,
          source: "reorder",
          status: "submitted",
          priority: onHand <= Number(p.safety_stock || 0) ? "high" : "medium",
          created_by: auth.profile.id,
        });
        created++;
      }
    }
    toast.success(created ? `Created ${created} requisition(s)` : "No SKUs at reorder level");
    load();
  };

  if (loading) return <LoadingState />;

  return (
    <div>
      <PageHeader
        title="Replenishment Planning"
        description="Reorder points · safety stock · lead times · AI purchase recommendations"
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard/inventory">Hub</Link>
            </Button>
            <Button size="sm" variant="secondary" onClick={generateFromReorder}>
              <RefreshCw className="h-4 w-4 mr-1" />
              Generate from reorder
            </Button>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-1" />
                  New requisition
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Purchase requisition</DialogTitle>
                </DialogHeader>
                <form onSubmit={createReq} className="space-y-3">
                  <div className="space-y-1">
                    <Label>Product</Label>
                    <Select
                      value={form.product_id}
                      onValueChange={(v) => {
                        const p = products.find((x) => x.id === v);
                        setForm((f) => ({
                          ...f,
                          product_id: v,
                          quantity: String(p?.reorder_qty || ""),
                        }));
                      }}
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
                  <div className="space-y-1">
                    <Label>Warehouse</Label>
                    <Select
                      value={form.warehouse_id}
                      onValueChange={(v) => setForm((f) => ({ ...f, warehouse_id: v }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Warehouse" />
                      </SelectTrigger>
                      <SelectContent>
                        {warehouses.map((w) => (
                          <SelectItem key={w.id} value={w.id}>
                            {w.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label>Quantity</Label>
                    <Input
                      type="number"
                      min="0.0001"
                      step="any"
                      value={form.quantity}
                      onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Reason</Label>
                    <Input
                      value={form.reason}
                      onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
                    />
                  </div>
                  <DialogFooter>
                    <Button type="submit">Submit requisition</Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        }
      />

      {insights.length > 0 && (
        <Card className="mb-6">
          <CardHeader className="flex flex-row items-center gap-2 pb-2">
            <Brain className="h-5 w-5 text-hope-gold" />
            <CardTitle className="text-base">AI replenishment signals</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {insights.map((ins) => (
              <div key={String(ins.id)} className="rounded border p-3 text-sm">
                <div className="flex flex-wrap gap-2 mb-1">
                  <StatusBadge status={String(ins.severity)} />
                  <Badge variant="secondary">{String(ins.insight_type).replace(/_/g, " ")}</Badge>
                  <span className="font-medium">{String(ins.title)}</span>
                </div>
                <p className="text-muted-foreground">{String(ins.recommendation)}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {rows.length === 0 ? (
        <EmptyState
          icon={RefreshCw}
          title="No purchase requisitions"
          description="Generate from reorder levels or create manually"
        />
      ) : (
        <div className="rounded-lg border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>PR #</TableHead>
                <TableHead>Product</TableHead>
                <TableHead>Qty</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Est. total</TableHead>
                <TableHead>Required</TableHead>
                <TableHead>Status</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => {
                const prod = r.products as { name?: string; product_code?: string } | null;
                return (
                  <TableRow key={String(r.id)}>
                    <TableCell className="font-mono text-sm">
                      {String(r.requisition_number)}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">
                        {prod?.product_code} — {prod?.name}
                      </div>
                      <div className="text-xs text-muted-foreground max-w-xs truncate">
                        {String(r.reason ?? "")}
                      </div>
                    </TableCell>
                    <TableCell>{formatNumber(Number(r.quantity))}</TableCell>
                    <TableCell className="capitalize">
                      {String(r.source).replace(/_/g, " ")}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={String(r.priority)} />
                    </TableCell>
                    <TableCell>
                      {formatNumber(Math.round(Number(r.estimated_total || 0)))}
                    </TableCell>
                    <TableCell>
                      {r.required_by ? formatDate(String(r.required_by)) : "—"}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={String(r.status)} />
                    </TableCell>
                    <TableCell className="space-x-1">
                      {r.status === "submitted" && (
                        <Button size="sm" variant="outline" onClick={() => setStatus(String(r.id), "approved")}>
                          Approve
                        </Button>
                      )}
                      {r.status === "approved" && (
                        <Button size="sm" onClick={() => setStatus(String(r.id), "ordered")}>
                          Mark ordered
                        </Button>
                      )}
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
