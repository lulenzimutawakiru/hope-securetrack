"use client";

import { useState } from "react";
import {
  Bluetooth,
  Printer,
  RefreshCw,
  Plus,
  Radio,
  Wifi,
  Usb,
  Star,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import { toast } from "sonner";
import { useEntityAll } from "@/hooks/use-entity-all";
import { useCrudMutation } from "@/hooks/use-entity-query";
import { formatDateTime } from "@/lib/utils";
import {
  discoverAnyBluetoothPrinter,
  discoverNiimbotBluetooth,
  listSystemPrinters,
  webBluetoothSupported,
  NIIMBOT_MODELS,
  type DiscoveredPrinter,
} from "@/lib/niimbot";
import Link from "next/link";
// Enterprise hub: /dashboard/print

interface PrinterRow {
  id: string;
  name: string;
  model: string;
  serial_number: string | null;
  status: string;
  connection_type: string | null;
  transport: string | null;
  bluetooth_address: string | null;
  device_id: string | null;
  is_default: boolean | null;
  is_active: boolean | null;
  last_seen_at: string | null;
  last_discovered_at: string | null;
  discovery_source: string | null;
  label_width_mm: number | null;
  label_height_mm: number | null;
  firmware_version: string | null;
}

export default function PrintersPage() {
  const q = useEntityAll<PrinterRow>("printers", { sort: "name" });
  const mutation = useCrudMutation<PrinterRow>("printers");
  const [discovering, setDiscovering] = useState(false);
  const [discovered, setDiscovered] = useState<DiscoveredPrinter[]>([]);
  const [manualOpen, setManualOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    model: "B21",
    transport: "bluetooth",
    bluetooth_address: "",
    serial_number: "",
    label_width_mm: "50",
    label_height_mm: "30",
  });

  const bleOk = webBluetoothSupported();

  const printers = [...(q.data ?? [])].sort(
    (a, b) =>
      (b.is_default ? 1 : 0) - (a.is_default ? 1 : 0) ||
      a.name.localeCompare(b.name)
  );
  const saveDiscovered = async (d: DiscoveredPrinter) => {
    setSaving(true);
    try {
      // Upsert-like: match by device_id or name against the loaded list
      const existing = printers.find(
        (p) =>
          (d.deviceId && p.device_id === d.deviceId) || p.name === d.name
      );

      const row = {
        name: d.name,
        model: d.model,
        connection_type: d.transport,
        transport: d.transport,
        device_id: d.deviceId || null,
        bluetooth_address: d.bluetoothAddress || null,
        status: "online",
        is_active: true,
        last_seen_at: new Date().toISOString(),
        last_discovered_at: new Date().toISOString(),
        discovery_source: d.source,
        label_width_mm: 50,
        label_height_mm: 30,
      };

      if (existing?.id) {
        const crudRes5 = await mutation.update(existing.id, row);
        if (!crudRes5.ok) throw new Error(crudRes5.error);
        toast.success(`Updated ${d.name}`);
      } else {
        const crudRes4 = await mutation.create(row);
        if (!crudRes4.ok) throw new Error(crudRes4.error);
        toast.success(`Registered ${d.name}`);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save printer");
    } finally {
      setSaving(false);
    }
  };

  const handleDiscoverNiimbot = async () => {
    setDiscovering(true);
    try {
      const device = await discoverNiimbotBluetooth();
      if (!device) {
        toast.message("No device selected");
        return;
      }
      setDiscovered((prev) => {
        const others = prev.filter((p) => p.id !== device.id);
        return [device, ...others];
      });
      await saveDiscovered(device);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Discovery failed";
      if (!msg.toLowerCase().includes("cancel")) {
        toast.error(msg);
      }
    } finally {
      setDiscovering(false);
    }
  };

  const handleDiscoverAnyBle = async () => {
    setDiscovering(true);
    try {
      const device = await discoverAnyBluetoothPrinter();
      if (!device) return;
      setDiscovered((prev) => {
        const others = prev.filter((p) => p.id !== device.id);
        return [device, ...others];
      });
      await saveDiscovered(device);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Discovery failed";
      if (!msg.toLowerCase().includes("cancel")) toast.error(msg);
    } finally {
      setDiscovering(false);
    }
  };

  const handleSystemScan = async () => {
    setDiscovering(true);
    try {
      const list = await listSystemPrinters();
      if (list.length === 0) {
        toast.message(
          "System printer list API not available. Register Niimbot via Bluetooth or manually."
        );
        return;
      }
      setDiscovered(list);
      toast.success(`Found ${list.length} system printer(s)`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "System scan failed");
    } finally {
      setDiscovering(false);
    }
  };

  const handleManual = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const crudRes3 = await mutation.create({
        name: form.name,
        model: form.model,
        connection_type: form.transport,
        transport: form.transport,
        bluetooth_address: form.bluetooth_address || null,
        serial_number: form.serial_number || null,
        label_width_mm: parseInt(form.label_width_mm, 10) || 50,
        label_height_mm: parseInt(form.label_height_mm, 10) || 30,
        status: "offline",
        is_active: true,
        discovery_source: "manual",
        last_discovered_at: new Date().toISOString(),
      });
      if (!crudRes3.ok) throw new Error(crudRes3.error);
      toast.success("Printer added");
      setManualOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setSaving(false);
    }
  };

  const setDefault = async (id: string) => {
    for (const row of printers) {
      if (!row.is_default || String(row.id) === String(id)) continue;
      const res = await mutation.update(row.id, { is_default: false });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
    }
    const res = await mutation.update(id, { is_default: true });
    if (!res.ok) toast.error(res.error);
    else toast.success("Default printer set");
  };

  const setStatus = async (id: string, status: string) => {
    const res = await mutation.update(id, {
      status,
      last_seen_at: new Date().toISOString(),
    });
    if (!res.ok) toast.error(res.error);
  };

  if (q.isLoading) return <LoadingState />;

  return (
    <div>
      <PageHeader
        title="Printers & Discovery"
        description="Discover Niimbot label printers over Bluetooth and manage print devices"
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href="/dashboard/print">
              <Button variant="outline">Enterprise Print Ops</Button>
            </Link>
            <Link href="/dashboard/labels">
              <Button variant="outline">Print labels</Button>
            </Link>
            <Dialog open={manualOpen} onOpenChange={setManualOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <Plus className="mr-2 h-4 w-4" />
                  Add manually
                </Button>
              </DialogTrigger>
              <DialogContent>
                <form onSubmit={handleManual}>
                  <DialogHeader>
                    <DialogTitle>Register printer</DialogTitle>
                    <DialogDescription>
                      Add a Niimbot or other label printer by hand
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-3 py-4">
                    <div className="space-y-2">
                      <Label>Name</Label>
                      <Input
                        value={form.name}
                        onChange={(e) =>
                          setForm({ ...form, name: e.target.value })
                        }
                        placeholder="Packing line Niimbot B21"
                        required
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label>Model</Label>
                        <Select
                          value={form.model}
                          onValueChange={(v) => setForm({ ...form, model: v })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {NIIMBOT_MODELS.map((m) => (
                              <SelectItem key={m} value={m}>
                                Niimbot {m}
                              </SelectItem>
                            ))}
                            <SelectItem value="Other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Transport</Label>
                        <Select
                          value={form.transport}
                          onValueChange={(v) =>
                            setForm({ ...form, transport: v })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="bluetooth">Bluetooth</SelectItem>
                            <SelectItem value="usb">USB</SelectItem>
                            <SelectItem value="network">Network</SelectItem>
                            <SelectItem value="system">System</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Bluetooth address (optional)</Label>
                      <Input
                        value={form.bluetooth_address}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            bluetooth_address: e.target.value,
                          })
                        }
                        placeholder="AA:BB:CC:DD:EE:FF"
                        className="font-mono"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label>Label width (mm)</Label>
                        <Input
                          value={form.label_width_mm}
                          onChange={(e) =>
                            setForm({ ...form, label_width_mm: e.target.value })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Label height (mm)</Label>
                        <Input
                          value={form.label_height_mm}
                          onChange={(e) =>
                            setForm({
                              ...form,
                              label_height_mm: e.target.value,
                            })
                          }
                        />
                      </div>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button type="submit" disabled={saving}>
                      {saving ? "Saving…" : "Save printer"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-3 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Bluetooth className="h-4 w-4 text-hope-teal" />
              Niimbot Bluetooth
            </CardTitle>
            <CardDescription>
              Pair a B21 / B1 / D11-class label printer
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {!bleOk && (
              <p className="text-xs text-amber-600 flex items-start gap-1">
                <AlertCircle className="h-3 w-3 mt-0.5 shrink-0" />
                Use Chrome or Edge over HTTPS for Web Bluetooth discovery.
              </p>
            )}
            <Button
              className="w-full"
              onClick={handleDiscoverNiimbot}
              disabled={!bleOk || discovering}
            >
              {discovering ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Radio className="mr-2 h-4 w-4" />
              )}
              Discover Niimbot
            </Button>
            <Button
              variant="outline"
              className="w-full"
              onClick={handleDiscoverAnyBle}
              disabled={!bleOk || discovering}
            >
              Scan any BLE device
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Printer className="h-4 w-4" />
              System printers
            </CardTitle>
            <CardDescription>
              OS-installed printers (when browser allows)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="outline"
              className="w-full"
              onClick={handleSystemScan}
              disabled={discovering}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Scan system printers
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Print workflow</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-1">
            <p>1. Discover / register Niimbot</p>
            <p>2. Generate QR codes for a batch</p>
            <p>3. Open Label Studio → build labels</p>
            <p>4. Print to selected printer</p>
            <Link href="/dashboard/printing" className="text-primary text-xs underline">
              Print jobs queue →
            </Link>
          </CardContent>
        </Card>
      </div>

      {discovered.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base">Discovery results</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {discovered.map((d) => (
              <div
                key={d.id}
                className="flex items-center justify-between rounded-lg border p-3"
              >
                <div>
                  <p className="font-medium text-sm">{d.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {d.model} · {d.transport} · {d.source}
                  </p>
                </div>
                <Button
                  size="sm"
                  disabled={saving}
                  onClick={() => saveDiscovered(d)}
                >
                  Register
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {printers.length === 0 ? (
        <EmptyState
          icon={Printer}
          title="No printers registered"
          description="Discover a Niimbot over Bluetooth or add one manually"
        />
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Model</TableHead>
                <TableHead>Transport</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last seen</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {printers.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {p.is_default && (
                        <Star className="h-3.5 w-3.5 text-hope-gold fill-hope-gold" />
                      )}
                      <span className="font-medium">{p.name}</span>
                    </div>
                    {p.device_id && (
                      <p className="text-[10px] font-mono text-muted-foreground truncate max-w-[180px]">
                        {p.device_id}
                      </p>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{p.model}</Badge>
                  </TableCell>
                  <TableCell className="capitalize text-sm">
                    <span className="inline-flex items-center gap-1">
                      {p.transport === "bluetooth" ||
                      p.connection_type === "bluetooth" ? (
                        <Bluetooth className="h-3 w-3" />
                      ) : p.transport === "usb" ? (
                        <Usb className="h-3 w-3" />
                      ) : (
                        <Wifi className="h-3 w-3" />
                      )}
                      {p.transport || p.connection_type || "—"}
                    </span>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={p.status || "offline"} />
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {p.last_seen_at
                      ? formatDateTime(p.last_seen_at)
                      : p.last_discovered_at
                        ? formatDateTime(p.last_discovered_at)
                        : "—"}
                  </TableCell>
                  <TableCell className="text-right space-x-1">
                    {!p.is_default && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setDefault(p.id)}
                      >
                        Set default
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        setStatus(
                          p.id,
                          p.status === "online" ? "offline" : "online"
                        )
                      }
                    >
                      {p.status === "online" ? "Mark offline" : "Mark online"}
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
