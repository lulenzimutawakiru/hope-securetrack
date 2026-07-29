"use client";

import { useEffect, useState } from "react";
import { FileText, Plus, Eye } from "lucide-react";
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
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/hooks/use-user";
import { formatNumber } from "@/lib/utils";
import { toast } from "sonner";
import { generatePackingList } from "@/lib/packaging";

export default function PackingListsPage() {
  const { auth } = useUser();
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [form, setForm] = useState({
    customer_name: "",
    order_ref: "",
    product_name: "Premium A4 Copy Paper",
    carton_serials: "",
    pallet_serials: "",
  });

  const companyId = auth?.profile?.company_id as string | undefined;

  const load = async () => {
    const { data } = await createClient()
      .from("pkg_packing_lists")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    setRows((data as Array<Record<string, unknown>>) || []);
    setLoading(false);
  };

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, []);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId) return;
    try {
      const cartons = form.carton_serials.split(/[\n,]+/).map((s) => s.trim()).filter(Boolean);
      const pallets = form.pallet_serials.split(/[\n,]+/).map((s) => s.trim()).filter(Boolean);
      if (!cartons.length) {
        toast.error("Add at least one carton serial");
        return;
      }
      const list = await generatePackingList({
        company_id: companyId,
        customer_name: form.customer_name,
        order_ref: form.order_ref,
        product_name: form.product_name,
        carton_serials: cartons,
        pallet_serials: pallets,
        issued_by: auth?.user?.id,
      });
      toast.success(`Packing list ${list.list_number}`);
      setPreview(String(list.html_body));
      setOpen(false);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  };

  if (loading) return <LoadingState message="Loading packing lists…" />;

  return (
    <div>
      <PageHeader
        title="Packing Lists"
        description="Customer · cartons · pallets · weights · signatures · PDF"
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Generate list</Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto">
              <form onSubmit={create}>
                <DialogHeader><DialogTitle>Packing list</DialogTitle></DialogHeader>
                <div className="grid gap-3 py-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label>Customer</Label>
                      <Input value={form.customer_name} onChange={(e) => setForm((f) => ({ ...f, customer_name: e.target.value }))} />
                    </div>
                    <div>
                      <Label>Order ref</Label>
                      <Input value={form.order_ref} onChange={(e) => setForm((f) => ({ ...f, order_ref: e.target.value }))} />
                    </div>
                  </div>
                  <div>
                    <Label>Product</Label>
                    <Input value={form.product_name} onChange={(e) => setForm((f) => ({ ...f, product_name: e.target.value }))} />
                  </div>
                  <div>
                    <Label>Carton serials</Label>
                    <textarea
                      className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
                      value={form.carton_serials}
                      onChange={(e) => setForm((f) => ({ ...f, carton_serials: e.target.value }))}
                      required
                    />
                  </div>
                  <div>
                    <Label>Pallet serials (optional)</Label>
                    <textarea
                      className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
                      value={form.pallet_serials}
                      onChange={(e) => setForm((f) => ({ ...f, pallet_serials: e.target.value }))}
                    />
                  </div>
                </div>
                <DialogFooter><Button type="submit">Generate</Button></DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      {rows.length === 0 ? (
        <EmptyState icon={FileText} title="No packing lists" description="Generate shipment packing documents." />
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Order</TableHead>
                <TableHead className="text-right">Cartons</TableHead>
                <TableHead className="text-right">Pallets</TableHead>
                <TableHead className="text-right">Gross kg</TableHead>
                <TableHead>Status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={String(r.id)}>
                  <TableCell className="font-mono text-xs">{String(r.list_number)}</TableCell>
                  <TableCell className="text-sm">{String(r.customer_name || "—")}</TableCell>
                  <TableCell className="text-sm">{String(r.order_ref || "—")}</TableCell>
                  <TableCell className="text-right">{String(r.carton_count)}</TableCell>
                  <TableCell className="text-right">{String(r.pallet_count)}</TableCell>
                  <TableCell className="text-right">{formatNumber(Number(r.gross_weight_kg || 0))}</TableCell>
                  <TableCell><StatusBadge status={String(r.status)} /></TableCell>
                  <TableCell>
                    <Button size="sm" variant="outline" onClick={() => setPreview(String(r.html_body || ""))}>
                      <Eye className="h-3 w-3 mr-1" /> PDF
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh]">
          <DialogHeader><DialogTitle>Packing list</DialogTitle></DialogHeader>
          {preview && <iframe title="Packing list" srcDoc={preview} className="w-full h-[70vh] rounded border bg-white" />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
