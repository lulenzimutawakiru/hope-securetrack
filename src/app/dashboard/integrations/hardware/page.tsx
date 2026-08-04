"use client";

import { useEffect, useState } from "react";
import { Printer, Plus } from "lucide-react";
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
import { LoadingState } from "@/components/ui/loading-state";
import { createClient } from "@/lib/supabase/crud-compat";
import { useUser } from "@/hooks/use-user";
import { toast } from "sonner";
import { crudCreate } from "@/lib/api/crud-client";

export default function HardwarePage() {
  const { auth } = useUser();
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    device_class: "printer",
    brand: "Zebra",
    model: "",
    connection_type: "network",
  });

  const load = async () => {
    const supabase = createClient();
    const { data } = await supabase.from("intg_hardware_devices").select("*").order("device_class");
    setRows(data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, []);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth?.profile?.company_id) return;
    try {
      const supabase = createClient();
      const code = `HW-${Date.now().toString(36).toUpperCase()}`;
      const crudRes = await crudCreate("intg_hardware_devices", {
        company_id: auth.profile.company_id,
        device_code: code,
        name: form.name,
        device_class: form.device_class,
        brand: form.brand,
        model: form.model || null,
        connection_type: form.connection_type,
        status: "online",
        is_active: true,
      });
      if (!crudRes.ok) throw new Error(crudRes.error);
      toast.success("Hardware registered");
      setOpen(false);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  };

  if (loading) return <LoadingState message="Loading hardware…" />;

  return (
    <div>
      <PageHeader
        title="Hardware Integrations"
        description="Zebra · Niimbot · Epson · scanners · RFID · biometric · POS"
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Register</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Hardware device</DialogTitle></DialogHeader>
              <form onSubmit={create} className="space-y-3">
                <div><Label>Name</Label><Input required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} /></div>
                <div>
                  <Label>Class</Label>
                  <Select value={form.device_class} onValueChange={(v) => setForm((f) => ({ ...f, device_class: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["printer", "scanner", "rfid", "biometric", "pos", "gps"].map((c) => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div><Label>Brand</Label><Input value={form.brand} onChange={(e) => setForm((f) => ({ ...f, brand: e.target.value }))} /></div>
                  <div><Label>Model</Label><Input value={form.model} onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))} /></div>
                </div>
                <div>
                  <Label>Connection</Label>
                  <Select value={form.connection_type} onValueChange={(v) => setForm((f) => ({ ...f, connection_type: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["network", "bluetooth", "usb", "cloud"].map((c) => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <DialogFooter><Button type="submit">Save</Button></DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />
      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Class</TableHead>
              <TableHead>Brand / Model</TableHead>
              <TableHead>Connection</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={String(r.id)}>
                <TableCell className="font-mono text-xs">{String(r.device_code)}</TableCell>
                <TableCell className="flex items-center gap-2 text-sm">
                  <Printer className="h-3.5 w-3.5 text-muted-foreground" /> {String(r.name)}
                </TableCell>
                <TableCell className="text-xs">{String(r.device_class)}</TableCell>
                <TableCell className="text-xs">{String(r.brand)} {String(r.model || "")}</TableCell>
                <TableCell className="text-xs">{String(r.connection_type)}</TableCell>
                <TableCell><StatusBadge status={String(r.status)} /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
