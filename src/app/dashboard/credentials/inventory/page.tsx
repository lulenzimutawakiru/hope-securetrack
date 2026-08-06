"use client";

import { useEffect, useState } from "react";
import { Package, Plus } from "lucide-react";
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
import { StatCard } from "@/components/ui/stat-card";
import { createClient } from "@/lib/supabase/crud-compat";
import { useUser } from "@/hooks/use-user";
import { toast } from "sonner";
import { crudCreate, crudUpdate } from "@/lib/api/crud-client";
import { formatNumber } from "@/lib/utils";

type Inv = {
  id: string;
  batch_number: string;
  card_type: string;
  supplier_name: string | null;
  purchase_date: string | null;
  quantity_received: number;
  quantity_available: number;
  quantity_used: number;
  quantity_damaged: number;
  unit_cost: number;
  currency: string;
  location_name: string | null;
  status: string;
};

export default function CardInventoryPage() {
  const { auth } = useUser();
  const [rows, setRows] = useState<Inv[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    batch_number: "",
    card_type: "pvc_blank",
    supplier_name: "",
    quantity_received: "100",
    unit_cost: "3500",
    location_name: "Security Office",
    purchase_date: new Date().toISOString().slice(0, 10),
  });

  const load = async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("wid_card_inventory")
      .select("*")
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    setRows((data as Inv[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, []);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth?.profile?.company_id) return;
    try {
      const qty = Number(form.quantity_received) || 0;
      const crudRes2 = await crudCreate("wid_card_inventory", {
        company_id: auth.profile.company_id,
        batch_number: form.batch_number || `BATCH-${Date.now()}`,
        card_type: form.card_type,
        supplier_name: form.supplier_name || null,
        purchase_date: form.purchase_date || null,
        quantity_received: qty,
        quantity_available: qty,
        unit_cost: Number(form.unit_cost) || 0,
        location_name: form.location_name || null,
        status: "available",
      });
      if (!crudRes2.ok) throw new Error(crudRes2.error);
      toast.success("Stock batch recorded");
      setOpen(false);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  };

  const markDamaged = async (row: Inv) => {
    if (row.quantity_available < 1) return;
    await crudUpdate("wid_card_inventory", row.id, {
        quantity_available: row.quantity_available - 1,
        quantity_damaged: (row.quantity_damaged || 0) + 1,
        updated_at: new Date().toISOString(),
      });
    toast.success("1 card marked damaged");
    await load();
  };

  if (loading) return <LoadingState message="Loading card inventory…" />;

  const available = rows.reduce((s, r) => s + (r.quantity_available || 0), 0);
  const used = rows.reduce((s, r) => s + (r.quantity_used || 0), 0);

  return (
    <div>
      <PageHeader
        title="Card Inventory"
        description="Blank PVC · RFID · NFC stock · batches · cost · location"
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Receive stock</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Receive card stock</DialogTitle></DialogHeader>
              <form onSubmit={create} className="space-y-3">
                <div>
                  <Label>Batch number</Label>
                  <Input value={form.batch_number} onChange={(e) => setForm((f) => ({ ...f, batch_number: e.target.value }))} placeholder="PVC-2026-002" />
                </div>
                <div>
                  <Label>Type</Label>
                  <Select value={form.card_type} onValueChange={(v) => setForm((f) => ({ ...f, card_type: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["pvc_blank", "rfid_blank", "nfc_blank", "smart_blank", "ribbon", "laminate"].map((t) => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Supplier</Label>
                  <Input value={form.supplier_name} onChange={(e) => setForm((f) => ({ ...f, supplier_name: e.target.value }))} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label>Quantity</Label>
                    <Input type="number" value={form.quantity_received} onChange={(e) => setForm((f) => ({ ...f, quantity_received: e.target.value }))} />
                  </div>
                  <div>
                    <Label>Unit cost (UGX)</Label>
                    <Input type="number" value={form.unit_cost} onChange={(e) => setForm((f) => ({ ...f, unit_cost: e.target.value }))} />
                  </div>
                </div>
                <div>
                  <Label>Location</Label>
                  <Input value={form.location_name} onChange={(e) => setForm((f) => ({ ...f, location_name: e.target.value }))} />
                </div>
                <DialogFooter>
                  <Button type="submit">Save batch</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3 mb-6">
        <StatCard title="Available" value={formatNumber(available)} icon={Package} />
        <StatCard title="Used" value={formatNumber(used)} icon={Package} />
        <StatCard title="Batches" value={String(rows.length)} icon={Package} />
      </div>

      {rows.length === 0 ? (
        <EmptyState title="No stock" description="Receive a batch of blank cards." />
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Batch</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead>Available</TableHead>
                <TableHead>Used</TableHead>
                <TableHead>Damaged</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Status</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-xs">{r.batch_number}</TableCell>
                  <TableCell className="text-xs">{r.card_type}</TableCell>
                  <TableCell>{r.supplier_name || "—"}</TableCell>
                  <TableCell>{r.quantity_available}</TableCell>
                  <TableCell>{r.quantity_used}</TableCell>
                  <TableCell>{r.quantity_damaged}</TableCell>
                  <TableCell>{r.location_name || "—"}</TableCell>
                  <TableCell><StatusBadge status={r.status} /></TableCell>
                  <TableCell>
                    <Button size="sm" variant="outline" onClick={() => markDamaged(r)}>Mark damaged</Button>
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
