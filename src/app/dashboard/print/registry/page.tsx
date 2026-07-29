"use client";

import { useEffect, useState } from "react";
import { Printer, Plus, Star } from "lucide-react";
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
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/hooks/use-user";
import { toast } from "sonner";
import {
  PRINTER_TYPES, ALL_BRANDS, CONNECTION_TYPES,
  registerPrinter, setDefaultPrinter,
} from "@/lib/print";

export default function PrintRegistryPage() {
  const { auth } = useUser();
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [form, setForm] = useState({
    name: "",
    model: "",
    brand: "Zebra",
    printer_type: "label",
    transport: "network",
    ip_address: "",
    bluetooth_address: "",
    serial_number: "",
    branch_name: "Kampala HQ",
    physical_location: "",
    label_width_mm: "50",
    label_height_mm: "30",
  });

  const companyId = auth?.profile?.company_id as string | undefined;

  const load = async () => {
    const { data } = await createClient()
      .from("printers")
      .select("*")
      .eq("is_active", true)
      .order("is_default", { ascending: false });
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
      await registerPrinter({
        company_id: companyId,
        name: form.name,
        model: form.model,
        brand: form.brand,
        manufacturer: form.brand,
        printer_type: form.printer_type,
        transport: form.transport,
        connection_type: form.transport,
        ip_address: form.ip_address || undefined,
        bluetooth_address: form.bluetooth_address || undefined,
        serial_number: form.serial_number || undefined,
        branch_name: form.branch_name,
        physical_location: form.physical_location,
        label_width_mm: form.label_width_mm ? Number(form.label_width_mm) : undefined,
        label_height_mm: form.label_height_mm ? Number(form.label_height_mm) : undefined,
      });
      toast.success("Printer registered");
      setOpen(false);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  };

  const makeDefault = async (id: string) => {
    if (!companyId) return;
    try {
      await setDefaultPrinter(companyId, id);
      toast.success("Default printer set");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  };

  const filtered = rows.filter((r) => {
    const s = q.trim().toLowerCase();
    if (!s) return true;
    return (
      String(r.name).toLowerCase().includes(s) ||
      String(r.model).toLowerCase().includes(s) ||
      String(r.brand || "").toLowerCase().includes(s) ||
      String(r.printer_code || "").toLowerCase().includes(s)
    );
  });

  if (loading) return <LoadingState message="Loading printer registry…" />;

  return (
    <div>
      <PageHeader
        title="Printer Registry"
        description="Enterprise inventory · brands · IP · BLE · location · default"
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Register printer</Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto">
              <form onSubmit={create}>
                <DialogHeader><DialogTitle>Register printer</DialogTitle></DialogHeader>
                <div className="grid gap-3 py-3">
                  <div>
                    <Label>Name</Label>
                    <Input required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label>Brand</Label>
                      <Select value={form.brand} onValueChange={(v) => setForm((f) => ({ ...f, brand: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {ALL_BRANDS.map((b) => (
                            <SelectItem key={b} value={b}>{b}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Model</Label>
                      <Input required value={form.model} onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label>Type</Label>
                      <Select value={form.printer_type} onValueChange={(v) => setForm((f) => ({ ...f, printer_type: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {PRINTER_TYPES.map((t) => (
                            <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Connection</Label>
                      <Select value={form.transport} onValueChange={(v) => setForm((f) => ({ ...f, transport: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {CONNECTION_TYPES.map((t) => (
                            <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label>IP address</Label>
                      <Input value={form.ip_address} onChange={(e) => setForm((f) => ({ ...f, ip_address: e.target.value }))} />
                    </div>
                    <div>
                      <Label>Bluetooth MAC</Label>
                      <Input value={form.bluetooth_address} onChange={(e) => setForm((f) => ({ ...f, bluetooth_address: e.target.value }))} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label>Label W (mm)</Label>
                      <Input value={form.label_width_mm} onChange={(e) => setForm((f) => ({ ...f, label_width_mm: e.target.value }))} />
                    </div>
                    <div>
                      <Label>Label H (mm)</Label>
                      <Input value={form.label_height_mm} onChange={(e) => setForm((f) => ({ ...f, label_height_mm: e.target.value }))} />
                    </div>
                  </div>
                  <div>
                    <Label>Location</Label>
                    <Input value={form.physical_location} onChange={(e) => setForm((f) => ({ ...f, physical_location: e.target.value }))} />
                  </div>
                </div>
                <DialogFooter><Button type="submit">Save</Button></DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="mb-4">
        <Input placeholder="Search printers…" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-sm" />
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={Printer} title="No printers" description="Register devices or apply migration seed." />
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Printer</TableHead>
                <TableHead>Brand / Model</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Connection</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r) => (
                <TableRow key={String(r.id)}>
                  <TableCell>
                    <div className="font-medium text-sm flex items-center gap-1">
                      {String(r.name)}
                      {Boolean(r.is_default) && <Star className="h-3 w-3 text-amber-500 fill-amber-500" />}
                    </div>
                    <div className="text-[10px] font-mono text-muted-foreground">{String(r.printer_code || r.id).slice(0, 12)}</div>
                  </TableCell>
                  <TableCell className="text-sm">
                    {String(r.brand || "—")} / {String(r.model)}
                  </TableCell>
                  <TableCell className="capitalize text-sm">{String(r.printer_type || "label")}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-[10px]">{String(r.transport || r.connection_type || "—")}</Badge>
                    {r.ip_address ? <div className="text-[10px] font-mono">{String(r.ip_address)}</div> : null}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-[140px] truncate">
                    {String(r.physical_location || r.branch_name || "—")}
                  </TableCell>
                  <TableCell><StatusBadge status={String(r.status || "offline")} /></TableCell>
                  <TableCell>
                    {!r.is_default && (
                      <Button size="sm" variant="ghost" onClick={() => makeDefault(String(r.id))}>
                        Set default
                      </Button>
                    )}
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
