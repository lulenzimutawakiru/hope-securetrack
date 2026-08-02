"use client";

import { useEffect, useState } from "react";
import { Plus, RotateCcw } from "lucide-react";
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
import { createClient } from "@/lib/supabase/client";
import { crudCreate, crudUpdate } from "@/lib/api/crud-client";
import { formatNumber } from "@/lib/utils";
import { toast } from "sonner";

export default function ReturnsPage() {
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [customers, setCustomers] = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    customer_id: "",
    reason: "damaged",
    description: "",
    total_amount: "0",
  });

  const load = async () => {
    const supabase = createClient();
    const [{ data }, { data: c }] = await Promise.all([
      supabase
        .from("sales_returns")
        .select("*, customers(name)")
        .order("created_at", { ascending: false })
        .limit(100),
      supabase.from("customers").select("id,name"),
    ]);
    setRows(data ?? []);
    setCustomers(c ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    const num = `RMA-${Date.now().toString(36).toUpperCase()}`;
    const res = await crudCreate("sales_returns", {
      return_number: num,
      customer_id: form.customer_id || null,
      reason: form.reason,
      description: form.description || null,
      total_amount: parseFloat(form.total_amount) || 0,
      currency: "UGX",
      status: "requested",
    });
    if (!res.ok) toast.error(res.error);
    else {
      toast.success(`Return ${num} logged`);
      setOpen(false);
      load();
    }
  };

  const setStatus = async (id: string, status: string) => {
    const updates: Record<string, unknown> = { status };
    if (status === "closed" || status === "refunded") {
      updates.resolved_at = new Date().toISOString();
    }
    await crudUpdate("sales_returns", id, updates);
    toast.success("Return updated");
    load();
  };

  if (loading) return <LoadingState />;

  return (
    <div>
      <PageHeader
        title="Sales Returns"
        description="Damaged goods, wrong deliveries, warranty claims · refunds & credit notes"
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" /> New return
              </Button>
            </DialogTrigger>
            <DialogContent>
              <form onSubmit={create}>
                <DialogHeader>
                  <DialogTitle>Sales return (RMA)</DialogTitle>
                </DialogHeader>
                <div className="grid gap-3 py-4">
                  <div className="space-y-2">
                    <Label>Customer</Label>
                    <Select
                      value={form.customer_id}
                      onValueChange={(v) => setForm({ ...form, customer_id: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        {customers.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Reason</Label>
                    <Select
                      value={form.reason}
                      onValueChange={(v) => setForm({ ...form, reason: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[
                          "damaged",
                          "wrong_delivery",
                          "warranty",
                          "quality",
                          "other",
                        ].map((r) => (
                          <SelectItem key={r} value={r}>
                            {r.replace(/_/g, " ")}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Input
                    placeholder="Description"
                    value={form.description}
                    onChange={(e) =>
                      setForm({ ...form, description: e.target.value })
                    }
                  />
                  <Input
                    type="number"
                    placeholder="Amount (UGX)"
                    value={form.total_amount}
                    onChange={(e) =>
                      setForm({ ...form, total_amount: e.target.value })
                    }
                  />
                </div>
                <DialogFooter>
                  <Button type="submit">Submit</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      {rows.length === 0 ? (
        <EmptyState icon={RotateCcw} title="No returns" />
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>RMA #</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Update</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => {
                const cust = r.customers as { name: string } | null;
                return (
                  <TableRow key={String(r.id)}>
                    <TableCell className="font-mono text-sm">
                      {String(r.return_number)}
                    </TableCell>
                    <TableCell>{cust?.name ?? "—"}</TableCell>
                    <TableCell className="capitalize">
                      {String(r.reason || "").replace(/_/g, " ")}
                    </TableCell>
                    <TableCell>
                      UGX {formatNumber(Number(r.total_amount || 0))}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={String(r.status)} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Select
                        value={String(r.status)}
                        onValueChange={(v) => setStatus(String(r.id), v)}
                      >
                        <SelectTrigger className="w-[130px] ml-auto">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {[
                            "requested",
                            "approved",
                            "received",
                            "refunded",
                            "closed",
                            "rejected",
                          ].map((s) => (
                            <SelectItem key={s} value={s}>
                              {s}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
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
