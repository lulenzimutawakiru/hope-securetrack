"use client";

import { useState } from "react";
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
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/crud-compat";
import { useUser } from "@/hooks/use-user";
import { formatDate, formatNumber } from "@/lib/utils";
import { toast } from "sonner";
import { crudCreate, crudUpdate } from "@/lib/api/crud-client";
import { useEntityAll, fetchAllPages } from "@/hooks/use-entity-all";

export default function ReplenishmentPage() {
  const { auth } = useUser();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    product_id: "",
    warehouse_id: "",
    quantity: "",
    reason: "",
    source: "manual",
  });

  // The PR grid stays on the RLS-bound browser client: the CRUD gate for
  // purchase_requisitions is procurement.view while this page serves the
  // inventory roles (same decision as the inventory hub). Insights and
  // warehouses flow through the hardened CRUD API (inventory.view), and the
  // stock-balance read used by reorder generation is tenant/company-scoped
  // server-side too. Products remain browser-side (products.view).
  const prQ = useQuery({
    queryKey: ["replenishment", "purchase-requisitions"],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("purchase_requisitions")
        .select("*, products(name, product_code), warehouses(name)")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as Array<Record<string, unknown>>;
    },
  });
  const insightsQ = useEntityAll<Record<string, unknown>>("inventory_insights", {
    filters: {
      status: "open",
      insight_type: ["reorder", "stockout_prediction", "overstock"],
    },
    sort: "created_at",
    order: "desc",
    max: 5,
  });
  const warehousesQ = useEntityAll<{
    id: string;
    name: string;
    is_active: boolean;
  }>("warehouses", { select: "id,name,is_active", sort: "name" });
  const productsQ = useQuery({
    queryKey: ["replenishment", "products-reference"],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("products")
        .select(
          "id,name,product_code,reorder_level,reorder_qty,safety_stock,standard_cost,lead_time_days,preferred_supplier_name"
        )
        .eq("is_active", true)
        .order("name")
        .limit(200);
      if (error) throw error;
      return (data ?? []) as Array<{
        id: string;
        name: string;
        product_code: string;
        reorder_level: number;
        reorder_qty: number;
        safety_stock: number;
        standard_cost: number;
        lead_time_days: number;
        preferred_supplier_name: string | null;
      }>;
    },
  });

  const rows = prQ.data ?? [];
  const insights = insightsQ.data ?? [];
  const warehouses = warehousesQ.data ?? [];
  // Form selects list active warehouses only; the first warehouse is still
  // used as the default destination for reorder-generated requisitions.
  const activeWarehouses = warehouses.filter((w) => w.is_active);
  const products = productsQ.data ?? [];
  const loading =
    prQ.isPending ||
    productsQ.isPending ||
    warehousesQ.isPending ||
    insightsQ.isPending;

  const refreshPRs = () => {
    queryClient.invalidateQueries({
      queryKey: ["replenishment", "purchase-requisitions"],
    });
  };

  const createReq = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth?.profile) return;
    const product = products.find((p) => p.id === form.product_id);
    const qty = Number(form.quantity || product?.reorder_qty || 0);
    if (!form.product_id || !qty) {
      toast.error("Product and quantity required");
      return;
    }
    const num = `PR-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;
    const unit = Number(product?.standard_cost || 0);
    const crudRes3 = await crudCreate("purchase_requisitions", {
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
    if (!crudRes3.ok) toast.error(crudRes3.error);
    else {
      toast.success(`Requisition ${num} created`);
      setOpen(false);
      refreshPRs();
    }
  };

  const setStatus = async (id: string, status: string) => {
    if (!auth?.profile) return;
    const patch: Record<string, unknown> = { status };
    if (status === "approved") {
      patch.approved_by = auth.profile.id;
      patch.approved_at = new Date().toISOString();
    }
    const crudRes2 = await crudUpdate("purchase_requisitions", id, patch);
    if (!crudRes2.ok) toast.error(crudRes2.error);
    else {
      toast.success(`Marked ${status}`);
      refreshPRs();
    }
  };

  const generateFromReorder = async () => {
    if (!auth?.profile || !warehouses[0]) return;
    let balances: Array<Record<string, unknown>> = [];
    try {
      balances = await fetchAllPages<Record<string, unknown>>("stock_balances", {
        select: "product_id,quantity_on_hand,warehouse_id",
        max: 1000,
      });
    } catch {
      toast.error("Failed to load stock balances");
      return;
    }
    let created = 0;
    for (const p of products) {
      const bal = balances.find((b) => b.product_id === p.id);
      const onHand = Number(bal?.quantity_on_hand || 0);
      const reorder = Number(p.reorder_level || 0);
      if (reorder > 0 && onHand <= reorder) {
        const qty = Number(p.reorder_qty || 10);
        const num = `PR-${new Date().getFullYear()}-R${String(Date.now() + created).slice(-5)}`;
        const unit = Number(p.standard_cost || 0);
        const crudRes = await crudCreate("purchase_requisitions", {
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
        if (!crudRes.ok) {
          toast.error(crudRes.error ?? "Failed to create requisition");
          continue;
        }
        created++;
      }
    }
    toast.success(created ? `Created ${created} requisition(s)` : "No SKUs at reorder level");
    refreshPRs();
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
                        {activeWarehouses.map((w) => (
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
