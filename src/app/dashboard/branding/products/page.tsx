"use client";

import { useEffect, useState } from "react";
import { Package, Plus } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { crudCreate } from "@/lib/api/crud-client";

export default function BrandProductsPage() {
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    product_name: "",
    product_code: "",
    brand_label: "SecureTrack Paper",
    packaging_notes: "",
    qr_enabled: true,
    security_print: false,
    hologram_zone: false,
  });


  const load = async () => {
    const { data } = await createClient()
      .from("brand_product_profiles")
      .select("*")
      .order("created_at", { ascending: false });
    setRows((data as Array<Record<string, unknown>>) || []);
    setLoading(false);
  };

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, []);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await crudCreate("brand_product_profiles", {
      product_name: form.product_name,
      product_code: form.product_code || null,
      brand_label: form.brand_label,
      packaging_notes: form.packaging_notes || null,
      qr_enabled: form.qr_enabled,
      security_print: form.security_print,
      hologram_zone: form.hologram_zone,
      status: "active",
    });
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Product brand profile created");
    setOpen(false);
    await load();
  };

  if (loading) return <LoadingState message="Loading product branding…" />;

  return (
    <div>
      <PageHeader
        title="Product & Packaging Branding"
        description="Labels · packaging · QR auth · security print · hologram zones"
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 mr-1" /> New product brand</Button>
            </DialogTrigger>
            <DialogContent>
              <form onSubmit={create}>
                <DialogHeader><DialogTitle>Product brand profile</DialogTitle></DialogHeader>
                <div className="grid gap-3 py-3">
                  <div>
                    <Label>Product name</Label>
                    <Input required value={form.product_name} onChange={(e) => setForm((f) => ({ ...f, product_name: e.target.value }))} placeholder="Premium A4 Copy Paper" />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label>Product code</Label>
                      <Input value={form.product_code} onChange={(e) => setForm((f) => ({ ...f, product_code: e.target.value }))} placeholder="HDG-PPR-A4" />
                    </div>
                    <div>
                      <Label>Brand label</Label>
                      <Input value={form.brand_label} onChange={(e) => setForm((f) => ({ ...f, brand_label: e.target.value }))} />
                    </div>
                  </div>
                  <div>
                    <Label>Packaging notes</Label>
                    <Textarea rows={3} value={form.packaging_notes} onChange={(e) => setForm((f) => ({ ...f, packaging_notes: e.target.value }))} placeholder="Box, carton, label, QR placement…" />
                  </div>
                  <div className="flex flex-wrap gap-4 text-sm">
                    <label className="flex items-center gap-2">
                      <input type="checkbox" checked={form.qr_enabled} onChange={(e) => setForm((f) => ({ ...f, qr_enabled: e.target.checked }))} />
                      QR authentication
                    </label>
                    <label className="flex items-center gap-2">
                      <input type="checkbox" checked={form.security_print} onChange={(e) => setForm((f) => ({ ...f, security_print: e.target.checked }))} />
                      Security print
                    </label>
                    <label className="flex items-center gap-2">
                      <input type="checkbox" checked={form.hologram_zone} onChange={(e) => setForm((f) => ({ ...f, hologram_zone: e.target.checked }))} />
                      Hologram zone
                    </label>
                  </div>
                </div>
                <DialogFooter><Button type="submit">Save</Button></DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      {rows.length === 0 ? (
        <EmptyState icon={Package} title="No product brands" description="Link manufacturing products to packaging and security designs." />
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>Brand</TableHead>
                <TableHead>Security</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={String(r.id)}>
                  <TableCell className="font-medium">{String(r.product_name)}</TableCell>
                  <TableCell className="font-mono text-xs">{String(r.product_code || "—")}</TableCell>
                  <TableCell>{String(r.brand_label || "—")}</TableCell>
                  <TableCell className="space-x-1">
                    {Boolean(r.qr_enabled) && <Badge variant="outline" className="text-[10px]">QR</Badge>}
                    {Boolean(r.security_print) && <Badge variant="outline" className="text-[10px]">Sec</Badge>}
                    {Boolean(r.hologram_zone) && <Badge variant="outline" className="text-[10px]">Holo</Badge>}
                  </TableCell>
                  <TableCell><StatusBadge status={String(r.status || "active")} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
