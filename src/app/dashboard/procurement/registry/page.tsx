"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, BookCheck } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingState } from "@/components/ui/loading-state";
import { EmptyState } from "@/components/ui/empty-state";
import { useUser } from "@/hooks/use-user";
import {
  listRegistryItems,
  listRegistryApprovals,
  approveForRegistry,
  listSuppliers,
} from "@/lib/srm";
import { toast } from "sonner";

export default function SrmRegistryPage() {
  const { auth } = useUser();
  const [items, setItems] = useState<Array<Record<string, unknown>>>([]);
  const [approvals, setApprovals] = useState<Array<Record<string, unknown>>>([]);
  const [suppliers, setSuppliers] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ registry_item_id: "", supplier_id: "" });

  const load = async () => {
    try {
      const [i, a, s] = await Promise.all([
        listRegistryItems(),
        listRegistryApprovals(),
        listSuppliers({ limit: 100 }),
      ]);
      setItems(i);
      setApprovals(a);
      setSuppliers(s.filter((x) => x.is_approved_vendor || x.is_active));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Load failed");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth || !form.registry_item_id || !form.supplier_id) return;
    try {
      await approveForRegistry({
        company_id: auth.profile.company_id,
        registry_item_id: form.registry_item_id,
        supplier_id: form.supplier_id,
        approved_by: auth.user.id,
        notes: "Approved via registry",
      });
      toast.success("Supplier approved for registry item");
      setOpen(false);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  };

  if (loading) return <LoadingState message="Loading approved supplier registry…" />;

  const byCat = items.reduce<Record<string, Array<Record<string, unknown>>>>((acc, i) => {
    const k = String(i.category_code || "GEN");
    if (!acc[k]) acc[k] = [];
    acc[k].push(i);
    return acc;
  }, {});

  return (
    <div>
      <PageHeader
        title="Approved Supplier Registry"
        description="Pulp · packaging · security inks · plates · chemicals · machinery · ICT · office"
        actions={
          <div className="flex gap-2">
            <Button asChild size="sm" variant="outline">
              <Link href="/dashboard/procurement/suppliers">Suppliers</Link>
            </Button>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Approve for item</Button>
              </DialogTrigger>
              <DialogContent>
                <form onSubmit={submit}>
                  <DialogHeader><DialogTitle>Approve supplier for registry item</DialogTitle></DialogHeader>
                  <div className="grid gap-3 py-3">
                    <div>
                      <Label>Registry item</Label>
                      <Select value={form.registry_item_id} onValueChange={(v) => setForm({ ...form, registry_item_id: v })}>
                        <SelectTrigger><SelectValue placeholder="Select item" /></SelectTrigger>
                        <SelectContent>
                          {items.map((i) => (
                            <SelectItem key={String(i.id)} value={String(i.id)}>
                              {String(i.code)} — {String(i.name)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Supplier</Label>
                      <Select value={form.supplier_id} onValueChange={(v) => setForm({ ...form, supplier_id: v })}>
                        <SelectTrigger><SelectValue placeholder="Select supplier" /></SelectTrigger>
                        <SelectContent>
                          {suppliers.map((s) => (
                            <SelectItem key={String(s.id)} value={String(s.id)}>{String(s.name)}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <DialogFooter><Button type="submit">Approve</Button></DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        {Object.entries(byCat).map(([cat, list]) => (
          <Card key={cat}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <BookCheck className="h-4 w-4 text-primary" />
                {cat}
                <Badge variant="secondary" className="text-[10px]">{list.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              {list.map((i) => (
                <div key={String(i.id)} className="text-xs flex justify-between gap-1">
                  <span className="truncate">{String(i.name)}</span>
                  <Badge
                    variant={i.criticality === "critical" || i.criticality === "strategic" ? "default" : "outline"}
                    className="text-[9px] shrink-0"
                  >
                    {String(i.criticality)}
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>

      {items.length === 0 ? (
        <EmptyState title="No registry items" description="Apply migration 00046 for SecureTrack ERP registry seeds." />
      ) : (
        <>
          <h2 className="text-sm font-semibold mb-2">Approved supplier mappings</h2>
          <div className="rounded-lg border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Valid until</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {approvals.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-8">
                      No approvals yet
                    </TableCell>
                  </TableRow>
                ) : (
                  approvals.map((a) => {
                    const item = a.srm_registry_items as { name?: string; code?: string; category_code?: string } | null;
                    const sup = a.suppliers as { name?: string; code?: string } | null;
                    return (
                      <TableRow key={String(a.id)}>
                        <TableCell className="text-sm font-medium">
                          {item?.name || "—"}
                          <div className="text-[10px] font-mono text-muted-foreground">{item?.code}</div>
                        </TableCell>
                        <TableCell><Badge variant="outline" className="text-[10px]">{item?.category_code}</Badge></TableCell>
                        <TableCell className="text-sm">{sup?.name || "—"}</TableCell>
                        <TableCell><Badge>{String(a.status)}</Badge></TableCell>
                        <TableCell className="text-xs">
                          {a.approved_until ? String(a.approved_until).slice(0, 10) : "—"}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </div>
  );
}
