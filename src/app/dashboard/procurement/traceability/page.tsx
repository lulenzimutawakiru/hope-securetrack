"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, GitBranch } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingState } from "@/components/ui/loading-state";
import { EmptyState } from "@/components/ui/empty-state";
import { useUser } from "@/hooks/use-user";
import {
  listMaterialLots,
  createMaterialLot,
  listTraceLinks,
  addTraceLink,
  listSuppliers,
} from "@/lib/srm";
import { formatNumber } from "@/lib/utils";
import { toast } from "sonner";

export default function SrmTraceabilityPage() {
  const { auth } = useUser();
  const [lots, setLots] = useState<Array<Record<string, unknown>>>([]);
  const [links, setLinks] = useState<Array<Record<string, unknown>>>([]);
  const [suppliers, setSuppliers] = useState<Array<Record<string, unknown>>>([]);
  const [selectedLot, setSelectedLot] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [lotOpen, setLotOpen] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [lotForm, setLotForm] = useState({
    supplier_id: "",
    material_name: "",
    category_code: "RAW",
    quantity: "1000",
    uom: "KG",
  });
  const [linkForm, setLinkForm] = useState({
    link_type: "production_batch",
    ref_code: "",
    quantity_used: "",
    notes: "",
  });

  const load = async () => {
    try {
      const [l, s] = await Promise.all([listMaterialLots(), listSuppliers({ limit: 80 })]);
      setLots(l);
      setSuppliers(s);
      if (selectedLot) {
        setLinks(await listTraceLinks(selectedLot));
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Load failed");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selectedLot) {
      listTraceLinks(selectedLot).then(setLinks).catch(() => setLinks([]));
    } else {
      setLinks([]);
    }
  }, [selectedLot]);

  const submitLot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth) return;
    try {
      const lot = await createMaterialLot({
        company_id: auth.profile.company_id,
        supplier_id: lotForm.supplier_id || null,
        material_name: lotForm.material_name,
        category_code: lotForm.category_code,
        quantity: parseFloat(lotForm.quantity) || 0,
        uom: lotForm.uom,
      });
      toast.success(`Lot ${lot.lot_number} created`);
      setLotOpen(false);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  };

  const submitLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth || !selectedLot) return;
    try {
      await addTraceLink({
        company_id: auth.profile.company_id,
        material_lot_id: selectedLot,
        link_type: linkForm.link_type,
        ref_code: linkForm.ref_code,
        quantity_used: parseFloat(linkForm.quantity_used) || undefined,
        notes: linkForm.notes,
        created_by: auth.user.id,
      });
      toast.success("Trace link added");
      setLinkOpen(false);
      setLinks(await listTraceLinks(selectedLot));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  };

  if (loading) return <LoadingState message="Loading material traceability…" />;

  const selected = lots.find((l) => l.id === selectedLot);

  return (
    <div>
      <PageHeader
        title="Manufacturing Material Traceability"
        description="Supplier → raw lot → production batch → finished product → QC → complaints → recalls"
        actions={
          <div className="flex gap-2">
            <Button asChild size="sm" variant="outline">
              <Link href="/dashboard/production">Production</Link>
            </Button>
            <Dialog open={lotOpen} onOpenChange={setLotOpen}>
              <DialogTrigger asChild>
                <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Material lot</Button>
              </DialogTrigger>
              <DialogContent>
                <form onSubmit={submitLot}>
                  <DialogHeader><DialogTitle>Register material lot</DialogTitle></DialogHeader>
                  <div className="grid gap-3 py-3">
                    <div>
                      <Label>Supplier</Label>
                      <Select value={lotForm.supplier_id} onValueChange={(v) => setLotForm({ ...lotForm, supplier_id: v })}>
                        <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                        <SelectContent>
                          {suppliers.map((s) => (
                            <SelectItem key={String(s.id)} value={String(s.id)}>{String(s.name)}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Material name</Label>
                      <Input required value={lotForm.material_name} onChange={(e) => setLotForm({ ...lotForm, material_name: e.target.value })} />
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <Label>Category</Label>
                        <Input value={lotForm.category_code} onChange={(e) => setLotForm({ ...lotForm, category_code: e.target.value })} />
                      </div>
                      <div>
                        <Label>Qty</Label>
                        <Input value={lotForm.quantity} onChange={(e) => setLotForm({ ...lotForm, quantity: e.target.value })} />
                      </div>
                      <div>
                        <Label>UoM</Label>
                        <Input value={lotForm.uom} onChange={(e) => setLotForm({ ...lotForm, uom: e.target.value })} />
                      </div>
                    </div>
                  </div>
                  <DialogFooter><Button type="submit">Create lot</Button></DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        }
      />

      {lots.length === 0 ? (
        <EmptyState
          icon={GitBranch}
          title="No material lots"
          description="Apply migration 00046 for seed lots or register a new lot."
        />
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-lg border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Lot #</TableHead>
                  <TableHead>Material</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead>QC</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lots.map((l) => (
                  <TableRow
                    key={String(l.id)}
                    className={`cursor-pointer ${selectedLot === l.id ? "bg-muted/60" : ""}`}
                    onClick={() => setSelectedLot(String(l.id))}
                  >
                    <TableCell className="font-mono text-xs">{String(l.lot_number)}</TableCell>
                    <TableCell className="font-medium text-sm">{String(l.material_name)}</TableCell>
                    <TableCell className="text-sm">
                      {(l.suppliers as { name?: string } | null)?.name || "—"}
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {formatNumber(Number(l.quantity || 0))} {String(l.uom || "")}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={String(l.quality_status)} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">
                Trace chain {selected ? `· ${String(selected.lot_number)}` : ""}
              </CardTitle>
              {selectedLot && (
                <Dialog open={linkOpen} onOpenChange={setLinkOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" variant="outline"><Plus className="h-3 w-3 mr-1" /> Link</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <form onSubmit={submitLink}>
                      <DialogHeader><DialogTitle>Add trace link</DialogTitle></DialogHeader>
                      <div className="grid gap-3 py-3">
                        <div>
                          <Label>Type</Label>
                          <Select value={linkForm.link_type} onValueChange={(v) => setLinkForm({ ...linkForm, link_type: v })}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {["production_batch", "finished_product", "qc", "complaint", "recall"].map((t) => (
                                <SelectItem key={t} value={t}>{t.replace(/_/g, " ")}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label>Reference code</Label>
                          <Input value={linkForm.ref_code} onChange={(e) => setLinkForm({ ...linkForm, ref_code: e.target.value })} placeholder="PO-MFG-…" />
                        </div>
                        <div>
                          <Label>Qty used</Label>
                          <Input value={linkForm.quantity_used} onChange={(e) => setLinkForm({ ...linkForm, quantity_used: e.target.value })} />
                        </div>
                        <div>
                          <Label>Notes</Label>
                          <Input value={linkForm.notes} onChange={(e) => setLinkForm({ ...linkForm, notes: e.target.value })} />
                        </div>
                      </div>
                      <DialogFooter><Button type="submit">Add link</Button></DialogFooter>
                    </form>
                  </DialogContent>
                </Dialog>
              )}
            </CardHeader>
            <CardContent>
              {!selectedLot && (
                <p className="text-sm text-muted-foreground">Select a material lot to view end-to-end traceability.</p>
              )}
              {selectedLot && links.length === 0 && (
                <p className="text-sm text-muted-foreground">No links yet — add production, finished goods, or QC links.</p>
              )}
              <div className="space-y-3">
                {links.map((link, idx) => (
                  <div key={String(link.id)} className="relative pl-6">
                    {idx < links.length - 1 && (
                      <span className="absolute left-2 top-6 bottom-0 w-px bg-border" />
                    )}
                    <span className="absolute left-0 top-1.5 h-4 w-4 rounded-full bg-primary/20 border-2 border-primary" />
                    <div className="rounded-md border p-2">
                      <div className="flex justify-between gap-2">
                        <Badge variant="secondary" className="text-[10px] capitalize">
                          {String(link.link_type).replace(/_/g, " ")}
                        </Badge>
                        <span className="text-[10px] font-mono">{String(link.ref_code || "—")}</span>
                      </div>
                      {link.notes ? (
                        <p className="text-xs text-muted-foreground mt-1">{String(link.notes)}</p>
                      ) : null}
                      {link.quantity_used != null && (
                        <p className="text-[10px] mt-1">Qty: {formatNumber(Number(link.quantity_used))}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
