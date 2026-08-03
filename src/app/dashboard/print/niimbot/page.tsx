"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bluetooth, Loader2, Printer, Radio } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LoadingState } from "@/components/ui/loading-state";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/hooks/use-user";
import { toast } from "sonner";
import {
  NIIMBOT_MODELS, LABEL_SIZES, webBluetoothSupported,
  discoverNiimbotBluetooth, registerPrinter, enqueuePrint,
  type DiscoveredPrinter,
} from "@/lib/print";

export default function NiimbotHubPage() {
  const { auth } = useUser();
  const [loading, setLoading] = useState(true);
  const [devices, setDevices] = useState<Array<Record<string, unknown>>>([]);
  const [discovering, setDiscovering] = useState(false);
  const [found, setFound] = useState<DiscoveredPrinter | null>(null);
  const bleOk = webBluetoothSupported();

  const companyId = auth?.profile?.company_id as string | undefined;

  const load = async () => {
    const { data } = await createClient()
      .from("printers")
      .select("*")
      .eq("is_active", true)
      .or("brand.ilike.%niimbot%,model.in.(B21,B1,B18,D11,D110,B3S,B203)");
    setDevices((data as Array<Record<string, unknown>>) || []);
    setLoading(false);
  };

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, []);

  const discover = async () => {
    setDiscovering(true);
    try {
      const d = await discoverNiimbotBluetooth();
      setFound(d);
      if (d) toast.success(`Found ${d.name}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Discovery failed");
    } finally {
      setDiscovering(false);
    }
  };

  const saveFound = async () => {
    if (!companyId || !found) return;
    try {
      await registerPrinter({
        company_id: companyId,
        name: found.name,
        model: found.model,
        brand: "Niimbot",
        manufacturer: "Niimbot",
        printer_type: "label",
        transport: "bluetooth",
        connection_type: "bluetooth",
        bluetooth_address: found.bluetoothAddress,
        label_width_mm: 50,
        label_height_mm: 30,
        discovery_source: "web_bluetooth",
        is_default: true,
      });
      toast.success("Niimbot registered");
      setFound(null);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    }
  };

  const testPrint = async (printerId: string) => {
    if (!companyId) return;
    try {
      await enqueuePrint({
        company_id: companyId,
        job_title: "Niimbot test label",
        document_type: "qr_auth",
        printer_id: printerId,
        copies: 1,
        payload_json: {
          serial: `TEST-${Date.now().toString(36).toUpperCase()}`,
          product_name: "SecureTrack Paper A4",
          batch: "TEST",
        },
        submitted_by: auth?.user?.id,
      });
      toast.success("Test job queued");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Queue failed");
    }
  };

  if (loading) return <LoadingState message="Loading Niimbot hub…" />;

  return (
    <div>
      <PageHeader
        title="Niimbot Integration"
        description="Bluetooth pairing · QR/barcode labels · batch · auto-cut · queue"
        actions={
          <Button size="sm" onClick={discover} disabled={!bleOk || discovering}>
            {discovering ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Bluetooth className="h-4 w-4 mr-1" />}
            Discover BLE
          </Button>
        }
      />

      {!bleOk && (
        <Card className="mb-4 border-amber-200 bg-amber-50/50">
          <CardContent className="pt-4 text-sm text-muted-foreground">
            Web Bluetooth requires Chrome/Edge on HTTPS. Register devices manually or use the print agent.
          </CardContent>
        </Card>
      )}

      {found && (
        <Card className="mb-4 border-primary">
          <CardContent className="pt-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-medium">{found.name}</p>
              <p className="text-xs text-muted-foreground">Model {found.model} · {found.transport}</p>
            </div>
            <Button size="sm" onClick={saveFound}>Register as printer</Button>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-3 mb-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Printer className="h-4 w-4" /> Registered Niimbot devices
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {devices.length === 0 ? (
              <p className="text-sm text-muted-foreground">No Niimbot devices yet. Discover or register from the registry.</p>
            ) : (
              devices.map((d) => (
                <div key={String(d.id)} className="flex items-center justify-between rounded border p-3">
                  <div>
                    <p className="font-medium text-sm">{String(d.name)}</p>
                    <p className="text-xs text-muted-foreground">
                      {String(d.model)} · {String(d.status)} · {String(d.label_width_mm || 50)}×{String(d.label_height_mm || 30)} mm
                    </p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => testPrint(String(d.id))}>
                    Test print
                  </Button>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Supported models</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-1">
            {NIIMBOT_MODELS.map((m) => (
              <Badge key={m} variant="outline">{m}</Badge>
            ))}
          </CardContent>
          <CardHeader className="pt-0">
            <CardTitle className="text-base">Label sizes</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-1">
            {LABEL_SIZES.filter((s) => s.w <= 50).map((s) => (
              <Badge key={s.value} variant="secondary" className="text-[10px]">{s.label}</Badge>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap gap-2 text-sm">
        <Button asChild variant="outline" size="sm"><Link href="/dashboard/print/queue">Queue</Link></Button>
        <Button asChild variant="outline" size="sm"><Link href="/dashboard/print/designer">Designer</Link></Button>
        <Button asChild variant="outline" size="sm"><Link href="/dashboard/labels">Batch QR labels</Link></Button>
        <Button asChild variant="outline" size="sm"><Link href="/dashboard/printers"><Radio className="h-3 w-3 mr-1" /> Classic discover</Link></Button>
      </div>
    </div>
  );
}
