"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ClipboardList, Plus } from "lucide-react";
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
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import { createClient } from "@/lib/supabase/crud-compat";
import { formatDate, formatNumber } from "@/lib/utils";
import { toast } from "sonner";
import { apiPost } from "@/lib/api-client";

export default function ProcurementRequisitionsPage() {
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [products, setProducts] = useState<Array<{ id: string; name: string; product_code: string; standard_cost: number }>>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    product_id: "",
    quantity: "1",
    department: "Production",
    request_type: "material",
    priority: "medium",
    justification: "",
    required_by: "",
  });

  const load = async () => {
    const supabase = createClient();
    const [{ data }, { data: prod }] = await Promise.all([
      supabase
        .from("purchase_requisitions")
        .select("*, products(name, product_code)")
        .order("created_at", { ascending: false })
        .limit(100),
      supabase
        .from("products")
        .select("id,name,product_code,standard_cost")
        .eq("is_active", true)
        .order("name")
        .limit(200),
    ]);
    setRows(data ?? []);
    setProducts((prod as typeof products) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await apiPost<{ requisition?: { requisition_number?: string } }>(
        "/api/procurement/requisitions",
        {
          product_id: form.product_id || null,
          quantity: Number(form.quantity),
          department: form.department,
          request_type: form.request_type,
          priority: form.priority,
          justification: form.justification,
          required_by: form.required_by || null,
        }
      );
      if (!res.ok) throw new Error(res.error);
      toast.success(`Requisition ${res.data?.requisition?.requisition_number ?? ""} submitted`);
      setOpen(false);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  };

  const approve = async (id: string) => {
    try {
      const res = await apiPost(`/api/procurement/requisitions/${encodeURIComponent(id)}/approve`, {});
      if (!res.ok) throw new Error(res.error);
      toast.success("Approved");
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  };

  if (loading) return <LoadingState />;

  return (
    <div>
      <PageHeader
        title="Purchase Requisitions"
        description="Material · service · CAPEX · OPEX · emergency · budget & approval workflow"
        actions={
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard/procurement">Hub</Link>
            </Button>
            <Button asChild variant="secondary" size="sm">
              <Link href="/dashboard/inventory/replenishment">Inventory PRs</Link>
            </Button>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-1" />
                  New PR
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Purchase requisition</DialogTitle>
                </DialogHeader>
                <form onSubmit={create} className="space-y-3">
                  <div className="space-y-1">
                    <Label>Product</Label>
                    <Select
                      value={form.product_id}
                      onValueChange={(v) => setForm((f) => ({ ...f, product_id: v }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select product" />
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
                      <Label>Type</Label>
                      <Select
                        value={form.request_type}
                        onValueChange={(v) => setForm((f) => ({ ...f, request_type: v }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {["material", "service", "capex", "opex", "emergency"].map((t) => (
                            <SelectItem key={t} value={t}>
                              {t}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label>Department</Label>
                      <Input
                        value={form.department}
                        onChange={(e) => setForm((f) => ({ ...f, department: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Required by</Label>
                      <Input
                        type="date"
                        value={form.required_by}
                        onChange={(e) => setForm((f) => ({ ...f, required_by: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label>Justification</Label>
                    <Input
                      value={form.justification}
                      onChange={(e) => setForm((f) => ({ ...f, justification: e.target.value }))}
                      required
                    />
                  </div>
                  <DialogFooter>
                    <Button type="submit">Submit for approval</Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        }
      />

      {rows.length === 0 ? (
        <EmptyState icon={ClipboardList} title="No requisitions" description="Create material or service requests" />
      ) : (
        <div className="rounded-lg border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>PR #</TableHead>
                <TableHead>Item</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Dept</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="text-right">Est. total</TableHead>
                <TableHead>Priority</TableHead>
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
                      {prod?.product_code
                        ? `${prod.product_code} — ${prod.name}`
                        : String(r.item_description ?? r.reason ?? "—")}
                    </TableCell>
                    <TableCell className="capitalize">
                      {String(r.request_type ?? r.source ?? "—").replace(/_/g, " ")}
                    </TableCell>
                    <TableCell>{String(r.department ?? "—")}</TableCell>
                    <TableCell className="text-right">
                      {formatNumber(Number(r.quantity))}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatNumber(Math.round(Number(r.estimated_total || 0)))}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={String(r.priority)} />
                    </TableCell>
                    <TableCell>
                      {r.required_by ? formatDate(String(r.required_by)) : "—"}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={String(r.status)} />
                    </TableCell>
                    <TableCell>
                      {r.status === "submitted" && (
                        <Button size="sm" variant="outline" onClick={() => approve(String(r.id))}>
                          Approve
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
