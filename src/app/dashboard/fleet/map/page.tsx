"use client";

import { useEffect, useState } from "react";
import { MapPin, RefreshCw, Navigation } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingState } from "@/components/ui/loading-state";
import { EmptyState } from "@/components/ui/empty-state";
import { useUser } from "@/hooks/use-user";
import { getLiveVehiclePositions } from "@/lib/fleet";
import { toast } from "sonner";

type Pos = Awaited<ReturnType<typeof getLiveVehiclePositions>>[number];

export default function FleetLiveMapPage() {
  const { auth } = useUser();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Pos[]>([]);
  const [selected, setSelected] = useState<Pos | null>(null);

  const companyId = auth?.profile?.company_id as string | undefined;

  const load = async () => {
    if (!companyId) {
      setLoading(false);
      return;
    }
    try {
      const data = await getLiveVehiclePositions(companyId);
      setRows(data);
      if (selected) {
        const again = data.find((d) => d.id === selected.id);
        if (again) setSelected(again);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Load failed");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, [companyId]);

  if (loading) return <LoadingState message="Loading live vehicle positions…" />;

  const withCoords = rows.filter((r) => r.lat != null && r.lng != null);
  const center = selected && selected.lat != null
    ? { lat: Number(selected.lat), lng: Number(selected.lng) }
    : withCoords[0]
      ? { lat: Number(withCoords[0].lat), lng: Number(withCoords[0].lng) }
      : { lat: 0.3476, lng: 32.5825 };

  const osmUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${center.lng - 0.08}%2C${center.lat - 0.06}%2C${center.lng + 0.08}%2C${center.lat + 0.06}&layer=mapnik&marker=${center.lat}%2C${center.lng}`;

  return (
    <div>
      <PageHeader
        title="Live Vehicle Map"
        description="Real-time GPS positions · speed · ignition · driver identification"
        actions={
          <Button size="sm" variant="outline" onClick={() => { setLoading(true); load(); }}>
            <RefreshCw className="h-4 w-4 mr-1" /> Refresh
          </Button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-3">
          <div className="rounded-lg border overflow-hidden bg-muted/30 aspect-[16/10] min-h-[320px]">
            <iframe
              title="Fleet map"
              src={osmUrl}
              className="w-full h-full min-h-[320px] border-0"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Map centers on selected vehicle. Positions update from fleet_gps_locations and vehicle last-known coordinates.
            Integrate Teltonika / Geotab / Queclink feeds via Integrations hub.
          </p>
        </div>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Navigation className="h-4 w-4" /> Vehicles ({rows.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 max-h-[520px] overflow-y-auto">
            {rows.length === 0 && (
              <EmptyState title="No vehicles" description="Register vehicles and attach GPS devices." />
            )}
            {rows.map((v) => (
              <button
                key={String(v.id)}
                type="button"
                onClick={() => setSelected(v)}
                className={`w-full text-left rounded-md border px-3 py-2 text-sm transition-colors ${
                  selected?.id === v.id ? "bg-muted border-primary" : "hover:bg-muted/50"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{String(v.registration)}</span>
                  <Badge variant="outline">{String(v.status || "—")}</Badge>
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {String(v.make || "")} {String(v.model || "")} · {String(v.driver_name || "No driver")}
                </div>
                <div className="text-xs mt-1 flex items-center gap-2">
                  <MapPin className="h-3 w-3" />
                  {v.lat != null && v.lng != null
                    ? `${Number(v.lat).toFixed(5)}, ${Number(v.lng).toFixed(5)}`
                    : "No GPS fix"}
                  {v.speed_kmh != null && Number(v.speed_kmh) > 0 && (
                    <span>· {Number(v.speed_kmh).toFixed(0)} km/h</span>
                  )}
                  {v.ignition ? <Badge variant="secondary" className="text-[10px]">IGN</Badge> : null}
                </div>
              </button>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
