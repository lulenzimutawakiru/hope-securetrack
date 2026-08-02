"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Download, Upload, Eye, Trash2 } from "lucide-react";
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
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/hooks/use-user";
import { formatNumber } from "@/lib/utils";
import { toast } from "sonner";
import { crudUpdate } from "@/lib/api/crud-client";
import {
  ASSET_DOMAINS,
  registerAsset,
  bulkRegisterFromFixedAssets,
} from "@/lib/assets";

export default function AssetRegisterPage() {
  const { auth } = useUser();
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [form, setForm] = useState({
    name: "",
    domain: "it",
    type_code: "LAP",
    manufacturer: "",
    model: "",
    serial_number: "",
    department: "",
    purchase_cost: "0",
    purchase_date: "",
    warranty_end: "",
    supplier_name: "",
    po_number: "",
    notes: "",
  });

  const companyId = auth?.profile?.company_id as string | undefined;
  const userId = auth?.profile?.id as string | undefined;

  const load = async () => {
    let query = createClient()
      .from("ast_assets")
      .select("*")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(500);
    if (statusFilter !== "all") query = query.eq("status", statusFilter);
    const { data } = await query;
    setRows((data as Array<Record<string, unknown>>) || []);
    setLoading(false);
  };

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, [statusFilter]);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId) {
      toast.error("No company context");
      return;
    }
    try {
      const res = await registerAsset({
        company_id: companyId,
        name: form.name,
        domain: form.domain,
        type_code: form.type_code.toUpperCase(),
        category_code: `${form.domain.toUpperCase()}-${form.type_code.toUpperCase()}`,
        manufacturer: form.manufacturer || undefined,
        model: form.model || undefined,
        serial_number: form.serial_number || undefined,
        department: form.department || undefined,
        purchase_cost: Number(form.purchase_cost) || 0,
        purchase_date: form.purchase_date || undefined,
        warranty_end: form.warranty_end || undefined,
        supplier_name: form.supplier_name || undefined,
        po_number: form.po_number || undefined,
        notes: form.notes || undefined,
        created_by: userId,
      });
      toast.success(`Registered ${res.asset.asset_tag}`);
      setOpen(false);
      setForm({
        name: "", domain: "it", type_code: "LAP", manufacturer: "", model: "",
        serial_number: "", department: "", purchase_cost: "0", purchase_date: "",
        warranty_end: "", supplier_name: "", po_number: "", notes: "",
      });
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to register");
    }
  };

  const softDelete = async (id: string) => {
    const crudRes = await crudUpdate("ast_assets", id, { deleted_at: new Date().toISOString(), status: "retired" });
    if (!crudRes.ok) toast.error(crudRes.error);
    else {
      toast.success("Asset archived");
      await load();
    }
  };

  const importFa = async () => {
    if (!companyId) return;
    try {
      const r = await bulkRegisterFromFixedAssets(companyId, userId);
      toast.success(`Imported ${r.count} fixed asset(s)`);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Import failed");
    }
  };

  const filtered = rows.filter((r) => {
    if (!q) return true;
    const s = q.toLowerCase();
    return (
      String(r.asset_tag || "").toLowerCase().includes(s) ||
      String(r.name || "").toLowerCase().includes(s) ||
      String(r.serial_number || "").toLowerCase().includes(s) ||
      String(r.department || "").toLowerCase().includes(s)
    );
  });

  const exportCsv = () => {
    const header = "tag,name,domain,type,status,serial,cost,value,department\n";
    const body = filtered
      .map((r) =>
        [
          r.asset_tag, r.name, r.domain, r.type_code, r.status,
          r.serial_number, r.purchase_cost, r.current_value, r.department,
        ].join(",")
      )
      .join("\n");
    const blob = new Blob([header + body], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "asset-register.csv";
    a.click();
  };

  if (loading) return <LoadingState message="Loading asset register…" />;

  return (
    <div>
      <PageHeader
        title="Asset Register"
        description="Unique tags · multi-ID · full lifecycle · soft-delete archive"
        actions={
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={exportCsv}>
              <Download className="h-4 w-4 mr-1" /> Export
            </Button>
            <Button size="sm" variant="outline" onClick={importFa}>
              <Upload className="h-4 w-4 mr-1" /> From finance
            </Button>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Register</Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                <form onSubmit={create}>
                  <DialogHeader>
                    <DialogTitle>Register asset</DialogTitle>
                  </DialogHeader>
                  <div className="grid gap-3 py-3">
                    <div>
                      <Label>Name</Label>
                      <Input required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label>Domain</Label>
                        <Select value={form.domain} onValueChange={(v) => setForm((f) => ({ ...f, domain: v }))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {ASSET_DOMAINS.map((d) => (
                              <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Type code</Label>
                        <Input required maxLength={6} value={form.type_code}
                          onChange={(e) => setForm((f) => ({ ...f, type_code: e.target.value.toUpperCase() }))}
                          placeholder="LAP" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label>Manufacturer</Label>
                        <Input value={form.manufacturer} onChange={(e) => setForm((f) => ({ ...f, manufacturer: e.target.value }))} />
                      </div>
                      <div>
                        <Label>Model</Label>
                        <Input value={form.model} onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))} />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label>Serial #</Label>
                        <Input value={form.serial_number} onChange={(e) => setForm((f) => ({ ...f, serial_number: e.target.value }))} />
                      </div>
                      <div>
                        <Label>Department</Label>
                        <Input value={form.department} onChange={(e) => setForm((f) => ({ ...f, department: e.target.value }))} />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label>Purchase cost</Label>
                        <Input type="number" value={form.purchase_cost} onChange={(e) => setForm((f) => ({ ...f, purchase_cost: e.target.value }))} />
                      </div>
                      <div>
                        <Label>Purchase date</Label>
                        <Input type="date" value={form.purchase_date} onChange={(e) => setForm((f) => ({ ...f, purchase_date: e.target.value }))} />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label>Warranty end</Label>
                        <Input type="date" value={form.warranty_end} onChange={(e) => setForm((f) => ({ ...f, warranty_end: e.target.value }))} />
                      </div>
                      <div>
                        <Label>PO number</Label>
                        <Input value={form.po_number} onChange={(e) => setForm((f) => ({ ...f, po_number: e.target.value }))} />
                      </div>
                    </div>
                    <div>
                      <Label>Supplier</Label>
                      <Input value={form.supplier_name} onChange={(e) => setForm((f) => ({ ...f, supplier_name: e.target.value }))} />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button type="submit">Generate tag & IDs</Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        }
      />

      <div className="mb-4 flex flex-wrap gap-2">
        <Input
          className="max-w-xs"
          placeholder="Search tag, name, serial…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="assigned">Assigned</SelectItem>
            <SelectItem value="maintenance">Maintenance</SelectItem>
            <SelectItem value="missing">Missing</SelectItem>
            <SelectItem value="retired">Retired</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState title="No assets" description="Register an asset or import from finance fixed assets." />
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tag</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Domain</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Serial</TableHead>
                <TableHead className="text-right">Value</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r) => (
                <TableRow key={String(r.id)}>
                  <TableCell className="font-mono text-xs">{String(r.asset_tag)}</TableCell>
                  <TableCell className="font-medium">{String(r.name)}</TableCell>
                  <TableCell className="uppercase text-xs">{String(r.domain)}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize text-[10px]">{String(r.status)}</Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{String(r.serial_number || "—")}</TableCell>
                  <TableCell className="text-right text-sm">{formatNumber(Number(r.current_value || 0))}</TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button asChild size="sm" variant="ghost">
                      <Link href={`/dashboard/assets/${r.id}`}><Eye className="h-4 w-4" /></Link>
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => softDelete(String(r.id))}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
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
