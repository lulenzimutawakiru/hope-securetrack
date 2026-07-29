"use client";

import { useEffect, useState } from "react";
import { Plus, Factory } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import { createClient } from "@/lib/supabase/client";
import { formatDate, formatNumber } from "@/lib/utils";
import { useUser } from "@/hooks/use-user";
import { toast } from "sonner";
import type { ProductionBatch, Product } from "@/types/database";
import { PRODUCTION_STATUSES } from "@/lib/constants";

export default function ProductionPage() {
  const { auth, hasPermission } = useUser();
  const [batches, setBatches] = useState<ProductionBatch[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState<string>("all");
  const [form, setForm] = useState({
    product_id: "",
    quantity_reams: "100",
    shift: "morning",
    notes: "",
    manufacturing_date: new Date().toISOString().slice(0, 10),
  });

  const load = async () => {
    const supabase = createClient();
    let query = supabase
      .from("production_batches")
      .select("*, products(name, product_code)")
      .order("created_at", { ascending: false });

    if (filter !== "all") {
      query = query.eq("production_status", filter);
    }

    const [{ data }, { data: prods }] = await Promise.all([
      query,
      supabase.from("products").select("*").eq("is_active", true).order("name"),
    ]);

    setBatches((data as ProductionBatch[]) ?? []);
    setProducts((prods as Product[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [filter]);

  const generateBatchNumber = () => {
    const d = new Date();
    const date = d.toISOString().slice(0, 10).replace(/-/g, "");
    const rand = Math.floor(Math.random() * 9000) + 1000;
    return `HDG-${date}-${rand}`;
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth) return;
    setSaving(true);

    try {
      const supabase = createClient();
      const product = products.find((p) => p.id === form.product_id);
      if (!product) {
        toast.error("Select a product");
        return;
      }

      const { data: factory } = await supabase
        .from("factories")
        .select("id")
        .eq("company_id", auth.profile.company_id)
        .eq("is_active", true)
        .limit(1)
        .single();

      if (!factory) {
        toast.error("No active factory found");
        return;
      }

      const batchNumber = generateBatchNumber();
      const { error } = await supabase.from("production_batches").insert({
        company_id: auth.profile.company_id,
        factory_id: factory.id,
        product_id: product.id,
        batch_number: batchNumber,
        product_code: product.product_code,
        paper_size: product.paper_size,
        gsm: product.gsm,
        color: product.color,
        quantity_reams: parseInt(form.quantity_reams, 10),
        manufacturing_date: form.manufacturing_date,
        shift: form.shift,
        notes: form.notes || null,
        production_status: "draft",
        qc_status: "pending",
        created_by: auth.profile.id,
        operator_id: auth.profile.id,
      });

      if (error) throw error;

      toast.success(`Batch ${batchNumber} created`);
      setOpen(false);
      setForm({
        product_id: "",
        quantity_reams: "100",
        shift: "morning",
        notes: "",
        manufacturing_date: new Date().toISOString().slice(0, 10),
      });
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create batch");
    } finally {
      setSaving(false);
    }
  };

  const updateStatus = async (id: string, production_status: string) => {
    const supabase = createClient();
    const { error } = await supabase
      .from("production_batches")
      .update({ production_status })
      .eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Status updated");
    load();
  };

  if (loading) return <LoadingState />;

  return (
    <div>
      <PageHeader
        title="Production"
        description="Manage production batches and manufacturing runs"
        actions={
          hasPermission("production.create") && (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  New Batch
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <form onSubmit={handleCreate}>
                  <DialogHeader>
                    <DialogTitle>Create Production Batch</DialogTitle>
                    <DialogDescription>
                      Start a new manufacturing batch for Hope Design products
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="space-y-2">
                      <Label>Product</Label>
                      <Select
                        value={form.product_id}
                        onValueChange={(v) => setForm({ ...form, product_id: v })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select product" />
                        </SelectTrigger>
                        <SelectContent>
                          {products.map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.name} ({p.product_code})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Quantity (reams)</Label>
                      <Input
                        type="number"
                        min={1}
                        max={10000}
                        value={form.quantity_reams}
                        onChange={(e) =>
                          setForm({ ...form, quantity_reams: e.target.value })
                        }
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Manufacturing Date</Label>
                      <Input
                        type="date"
                        value={form.manufacturing_date}
                        onChange={(e) =>
                          setForm({ ...form, manufacturing_date: e.target.value })
                        }
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Shift</Label>
                      <Select
                        value={form.shift}
                        onValueChange={(v) => setForm({ ...form, shift: v })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="morning">Morning</SelectItem>
                          <SelectItem value="afternoon">Afternoon</SelectItem>
                          <SelectItem value="night">Night</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Notes</Label>
                      <Input
                        value={form.notes}
                        onChange={(e) => setForm({ ...form, notes: e.target.value })}
                        placeholder="Optional notes"
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button type="submit" disabled={saving || !form.product_id}>
                      {saving ? "Creating..." : "Create Batch"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          )
        }
      />

      <div className="mb-4 flex gap-2 flex-wrap">
        <Button
          variant={filter === "all" ? "default" : "outline"}
          size="sm"
          onClick={() => setFilter("all")}
        >
          All
        </Button>
        {PRODUCTION_STATUSES.map((s) => (
          <Button
            key={s}
            variant={filter === s ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter(s)}
            className="capitalize"
          >
            {s.replace(/_/g, " ")}
          </Button>
        ))}
      </div>

      {batches.length === 0 ? (
        <EmptyState
          icon={Factory}
          title="No production batches"
          description="Create your first batch to start tracking manufacturing"
        />
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Batch #</TableHead>
                <TableHead>Product</TableHead>
                <TableHead>Reams</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>QC</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {batches.map((b) => (
                <TableRow key={b.id}>
                  <TableCell className="font-mono font-medium">
                    {b.batch_number}
                  </TableCell>
                  <TableCell>
                    <div>
                      <p className="text-sm">{b.products?.name ?? b.product_code}</p>
                      <p className="text-xs text-muted-foreground">
                        {b.paper_size} · {b.gsm}gsm
                      </p>
                    </div>
                  </TableCell>
                  <TableCell>{formatNumber(b.quantity_reams)}</TableCell>
                  <TableCell>{formatDate(b.manufacturing_date)}</TableCell>
                  <TableCell>
                    <StatusBadge status={b.qc_status} />
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={b.production_status} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Select
                      value={b.production_status}
                      onValueChange={(v) => updateStatus(b.id, v)}
                    >
                      <SelectTrigger className="w-[140px] ml-auto">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PRODUCTION_STATUSES.map((s) => (
                          <SelectItem key={s} value={s} className="capitalize">
                            {s.replace(/_/g, " ")}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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
