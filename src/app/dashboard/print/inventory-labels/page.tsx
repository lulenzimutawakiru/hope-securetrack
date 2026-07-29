"use client";

import { useEffect, useState } from "react";
import { Warehouse, Plus } from "lucide-react";
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
import { useUser } from "@/hooks/use-user";
import { toast } from "sonner";
import { nextPrtCode, enqueuePrint } from "@/lib/print";

const KINDS = ["shelf", "bin", "rack", "carton", "pallet", "location"];

export default function InventoryLabelsPage() {
  const { auth } = useUser();
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [printers, setPrinters] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    label_kind: "shelf",
    location_code: "",
    sku: "",
    product_name: "",
    printer_id: "",
  });

  const companyId = auth?.profile?.company_id as string | undefined;

  const load = async () => {
    const sb = createClient();
    const [{ data }, { data: pr }] = await Promise.all([
      sb.from("prt_inventory_labels").select("*").order("created_at", { ascending: false }).limit(100),
      sb.from("printers").select("id,name").eq("is_active", true),
    ]);
    setRows((data as Array<Record<string, unknown>>) || []);
    setPrinters((pr as Array<Record<string, unknown>>) || []);
    setLoading(false);
  };

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, []);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId) return;
    try {
      const label_number = await nextPrtCode(companyId, "prt_inventory_labels", "ILB");
      const barcode = form.sku || form.location_code;
      const queue = await enqueuePrint({
        company_id: companyId,
        job_title: `${form.label_kind} · ${form.location_code}`,
        document_type: form.label_kind === "carton" || form.label_kind === "pallet" ? "shipping" : "shelf",
        printer_id: form.printer_id || null,
        payload_json: {
          location: form.location_code,
          sku: form.sku,
          product_name: form.product_name,
          barcode_value: barcode,
        },
        submitted_by: auth?.user?.id,
      });
      const { error } = await createClient().from("prt_inventory_labels").insert({
        company_id: companyId,
        label_number,
        label_kind: form.label_kind,
        location_code: form.location_code,
        sku: form.sku || null,
        product_name: form.product_name || null,
        barcode_value: barcode,
        printer_id: form.printer_id || null,
        queue_id: queue.id,
        status: "queued",
        created_by: auth?.user?.id,
      });
      if (error) throw error;
      toast.success("Inventory label queued");
      setOpen(false);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  };

  const bulkFromInventory = async () => {
    if (!companyId) return;
    try {
      const { data: products } = await createClient()
        .from("products")
        .select("name,sku,product_code")
        .limit(20);
      let n = 0;
      for (const p of products || []) {
        const loc = `WH-${String(n + 1).padStart(2, "0")}`;
        const label_number = await nextPrtCode(companyId, "prt_inventory_labels", "ILB");
        const sku = String(p.sku || p.product_code || "");
        const queue = await enqueuePrint({
          company_id: companyId,
          job_title: `Shelf · ${sku || p.name}`,
          document_type: "shelf",
          payload_json: {
            location: loc,
            sku,
            product_name: String(p.name),
            barcode_value: sku || loc,
          },
          submitted_by: auth?.user?.id,
        });
        await createClient().from("prt_inventory_labels").insert({
          company_id: companyId,
          label_number,
          label_kind: "shelf",
          location_code: loc,
          sku: sku || null,
          product_name: String(p.name),
          barcode_value: sku || loc,
          queue_id: queue.id,
          status: "queued",
          created_by: auth?.user?.id,
        });
        n += 1;
      }
      toast.success(`Generated ${n} shelf labels from products`);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Bulk failed");
    }
  };

  if (loading) return <LoadingState message="Loading inventory labels…" />;

  return (
    <div>
      <PageHeader
        title="Inventory Labels"
        description="Shelf · bin · rack · carton · pallet · auto from inventory"
        actions={
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={bulkFromInventory}>From products</Button>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button size="sm"><Plus className="h-4 w-4 mr-1" /> New label</Button>
              </DialogTrigger>
              <DialogContent>
                <form onSubmit={create}>
                  <DialogHeader><DialogTitle>Inventory label</DialogTitle></DialogHeader>
                  <div className="grid gap-3 py-3">
                    <div>
                      <Label>Kind</Label>
                      <Select value={form.label_kind} onValueChange={(v) => setForm((f) => ({ ...f, label_kind: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {KINDS.map((k) => (
                            <SelectItem key={k} value={k} className="capitalize">{k}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Location code</Label>
                      <Input required value={form.location_code} onChange={(e) => setForm((f) => ({ ...f, location_code: e.target.value }))} placeholder="A-01-02" />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label>SKU</Label>
                        <Input value={form.sku} onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value }))} />
                      </div>
                      <div>
                        <Label>Product</Label>
                        <Input value={form.product_name} onChange={(e) => setForm((f) => ({ ...f, product_name: e.target.value }))} />
                      </div>
                    </div>
                    <div>
                      <Label>Printer</Label>
                      <Select value={form.printer_id || "none"} onValueChange={(v) => setForm((f) => ({ ...f, printer_id: v === "none" ? "" : v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Default</SelectItem>
                          {printers.map((p) => (
                            <SelectItem key={String(p.id)} value={String(p.id)}>{String(p.name)}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <DialogFooter><Button type="submit">Queue</Button></DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        }
      />

      {rows.length === 0 ? (
        <EmptyState icon={Warehouse} title="No inventory labels" description="Print shelf, bin, and pallet labels." />
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Kind</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>SKU / Product</TableHead>
                <TableHead>Barcode</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={String(r.id)}>
                  <TableCell className="font-mono text-xs">{String(r.label_number)}</TableCell>
                  <TableCell className="capitalize text-sm">{String(r.label_kind)}</TableCell>
                  <TableCell className="font-medium text-sm">{String(r.location_code)}</TableCell>
                  <TableCell className="text-sm">
                    {String(r.sku || "—")}
                    <div className="text-[10px] text-muted-foreground">{String(r.product_name || "")}</div>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{String(r.barcode_value || "—")}</TableCell>
                  <TableCell><StatusBadge status={String(r.status)} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
