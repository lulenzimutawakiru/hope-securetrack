"use client";

import { useEffect, useState } from "react";
import { Navigation, MapPin } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LoadingState } from "@/components/ui/loading-state";
import { createClient } from "@/lib/supabase/crud-compat";
import { useUser } from "@/hooks/use-user";
import { toast } from "sonner";
import { recordGpsPoint } from "@/lib/dispatch";
import { formatDateTime } from "@/lib/utils";

export default function DispatchTrackingPage() {
  const { auth } = useUser();
  const [vehicles, setVehicles] = useState<Array<Record<string, unknown>>>([]);
  const [points, setPoints] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [lat, setLat] = useState("0.3476");
  const [lng, setLng] = useState("32.5825");
  const [vehicleId, setVehicleId] = useState("");

  const companyId = auth?.profile?.company_id as string | undefined;

  const load = async () => {
    const sb = createClient();
    const [{ data: v }, { data: p }] = await Promise.all([
      sb.from("fleet_vehicles").select("id, registration, status, current_lat, current_lng, last_gps_at, assigned_driver_name, gps_tracker_id").order("registration"),
      sb.from("dsp_gps_points").select("*").order("recorded_at", { ascending: false }).limit(30),
    ]);
    setVehicles((v as Array<Record<string, unknown>>) || []);
    setPoints((p as Array<Record<string, unknown>>) || []);
    if (v?.[0] && !vehicleId) setVehicleId(String(v[0].id));
    setLoading(false);
  };

  useEffect(() => {
    load().catch(() => setLoading(false));
    const t = setInterval(() => load().catch(() => {}), 20000);
    return () => clearInterval(t);
  }, []);

  const push = async () => {
    if (!companyId || !vehicleId) return;
    try {
      await recordGpsPoint({
        company_id: companyId,
        vehicle_id: vehicleId,
        lat: Number(lat),
        lng: Number(lng),
        speed_kmh: 30,
      });
      toast.success("GPS point recorded");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  };

  if (loading) return <LoadingState message="Loading live tracking…" />;

  // Simple map projection (Kampala bbox)
  const project = (la: number, ln: number) => {
    const x = ((ln - 32.5) / 0.25) * 100;
    const y = ((0.4 - la) / 0.12) * 100;
    return { left: `${Math.min(95, Math.max(5, x))}%`, top: `${Math.min(95, Math.max(5, y))}%` };
  };

  return (
    <div>
      <PageHeader
        title="GPS Live Tracking"
        description="Vehicle location · ETA · speed · route progress · auto-refresh 20s"
      />

      <div className="grid gap-4 lg:grid-cols-3 mb-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <MapPin className="h-4 w-4" /> Live map (Kampala region)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="relative h-80 rounded-lg border bg-gradient-to-br from-emerald-50 to-slate-100 dark:from-emerald-950/30 dark:to-slate-900 overflow-hidden">
              <div className="absolute inset-0 opacity-20"
                style={{
                  backgroundImage:
                    "linear-gradient(#94a3b8 1px, transparent 1px), linear-gradient(90deg, #94a3b8 1px, transparent 1px)",
                  backgroundSize: "40px 40px",
                }}
              />
              {vehicles
                .filter((v) => v.current_lat != null)
                .map((v) => {
                  const pos = project(Number(v.current_lat), Number(v.current_lng));
                  return (
                    <div
                      key={String(v.id)}
                      className="absolute -translate-x-1/2 -translate-y-1/2"
                      style={pos}
                      title={String(v.registration)}
                    >
                      <div className="flex flex-col items-center">
                        <Navigation className="h-5 w-5 text-primary drop-shadow" />
                        <span className="text-[9px] font-mono bg-background/90 px-1 rounded border">
                          {String(v.registration)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              <div className="absolute bottom-2 left-2 text-[10px] text-muted-foreground bg-background/80 px-2 py-1 rounded">
                Interactive schematic · integrate Mapbox/Google in production
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Simulate GPS ping</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <div>
              <Label className="text-xs">Vehicle ID</Label>
              <Input value={vehicleId} onChange={(e) => setVehicleId(e.target.value)} className="font-mono text-xs" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Lat</Label>
                <Input value={lat} onChange={(e) => setLat(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Lng</Label>
                <Input value={lng} onChange={(e) => setLng(e.target.value)} />
              </div>
            </div>
            <Button size="sm" className="w-full" onClick={push}>Record point</Button>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Fleet positions</CardTitle></CardHeader>
          <CardContent className="space-y-2 max-h-64 overflow-y-auto">
            {vehicles.map((v) => (
              <div key={String(v.id)} className="text-sm border-b pb-2 flex justify-between gap-2">
                <div>
                  <p className="font-mono text-xs font-medium">{String(v.registration)}</p>
                  <p className="text-xs text-muted-foreground">{String(v.assigned_driver_name || "—")}</p>
                </div>
                <div className="text-right">
                  <Badge variant="outline" className="text-[10px] capitalize">{String(v.status)}</Badge>
                  <p className="text-[10px] font-mono mt-1">
                    {v.current_lat != null ? `${Number(v.current_lat).toFixed(4)}, ${Number(v.current_lng).toFixed(4)}` : "No GPS"}
                  </p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Recent pings</CardTitle></CardHeader>
          <CardContent className="space-y-1 max-h-64 overflow-y-auto">
            {points.map((p) => (
              <div key={String(p.id)} className="text-xs flex justify-between border-b py-1">
                <span className="font-mono">{Number(p.lat).toFixed(4)}, {Number(p.lng).toFixed(4)}</span>
                <span className="text-muted-foreground">{formatDateTime(String(p.recorded_at))}</span>
              </div>
            ))}
            {points.length === 0 && <p className="text-sm text-muted-foreground">No GPS history</p>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
