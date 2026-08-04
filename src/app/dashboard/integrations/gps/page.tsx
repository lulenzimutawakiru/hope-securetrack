"use client";

import { useEffect, useState } from "react";
import { MapPin, Plus, Navigation, Search } from "lucide-react";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingState } from "@/components/ui/loading-state";
import { createClient } from "@/lib/supabase/crud-compat";
import { useUser } from "@/hooks/use-user";
import { toast } from "sonner";
import { crudCreate } from "@/lib/api/crud-client";
import { apiPost } from "@/lib/api-client";

export default function GpsPage() {
  const { auth } = useUser();
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [vehicle, setVehicle] = useState("VAN-01");
  const [geoQuery, setGeoQuery] = useState("Kampala");
  const [geoResult, setGeoResult] = useState<string>("");
  const [routeInfo, setRouteInfo] = useState<string>("");
  const [mapBusy, setMapBusy] = useState(false);

  const load = async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("intg_gps_positions")
      .select("*")
      .order("recorded_at", { ascending: false })
      .limit(50);
    setRows(data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, []);

  const geocode = async () => {
    setMapBusy(true);
    try {
      const res = await apiPost<{
        data?: {
          features?: Array<{ place_name: string; center: [number, number] }>;
        };
        features?: Array<{ place_name: string; center: [number, number] }>;
      }>("/api/v2/integrations/maps", {
        action: "geocode",
        query: geoQuery,
        country: "ug",
      });
      if (!res.ok) throw new Error(res.error);
      const payload = res.data as {
        data?: { features?: Array<{ place_name: string; center: [number, number] }> };
        features?: Array<{ place_name: string; center: [number, number] }>;
      };
      const features =
        payload?.data?.features || payload?.features || [];
      if (!features.length) {
        setGeoResult("No results");
        return;
      }
      const f = features[0];
      setGeoResult(
        `${f.place_name} → lng ${f.center[0].toFixed(5)}, lat ${f.center[1].toFixed(5)}`
      );
      toast.success("Geocoded via Mapbox");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Geocode failed");
    } finally {
      setMapBusy(false);
    }
  };

  const directions = async () => {
    setMapBusy(true);
    try {
      // Kampala CBD → Entebbe-ish sample
      const res = await apiPost<{
        data?: { distance_m?: number; duration_s?: number };
      }>("/api/v2/integrations/maps", {
        action: "directions",
        origin: [32.5825, 0.3476],
        destination: [32.4435, 0.0512],
        profile: "driving",
      });
      if (!res.ok) throw new Error(res.error);
      const d = (res.data as { data?: { distance_m?: number; duration_s?: number } })
        ?.data;
      const km = ((d?.distance_m || 0) / 1000).toFixed(1);
      const min = Math.round((d?.duration_s || 0) / 60);
      setRouteInfo(`Sample route: ${km} km · ~${min} min`);
      toast.success("Directions calculated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Directions failed");
    } finally {
      setMapBusy(false);
    }
  };

  const ping = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth?.profile?.company_id) return;
    try {
      // Kampala area sample coords with jitter
      const lat = 0.3476 + (Math.random() - 0.5) * 0.05;
      const lng = 32.5825 + (Math.random() - 0.5) * 0.05;
      const crudRes = await crudCreate("intg_gps_positions", {
        company_id: auth.profile.company_id,
        vehicle_code: vehicle,
        latitude: lat,
        longitude: lng,
        speed_kmh: Math.random() * 80,
        fuel_pct: 20 + Math.random() * 70,
        heading: Math.random() * 360,
      });
      if (!crudRes.ok) throw new Error(crudRes.error);
      toast.success("GPS position recorded");
      setOpen(false);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  };

  if (loading) return <LoadingState message="Loading fleet GPS…" />;

  return (
    <div>
      <PageHeader
        title="GPS & Fleet Integration"
        description="Trackers · Mapbox geocode/routes · location · speed · fuel"
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Record position</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>GPS ping</DialogTitle></DialogHeader>
              <form onSubmit={ping} className="space-y-3">
                <div><Label>Vehicle code</Label><Input value={vehicle} onChange={(e) => setVehicle(e.target.value)} /></div>
                <DialogFooter><Button type="submit"><MapPin className="h-4 w-4 mr-1" /> Capture</Button></DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      <Card className="mb-6">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Navigation className="h-4 w-4" />
            Mapbox geocode & directions
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <div className="space-y-1 min-w-[220px] flex-1">
            <Label>Address / place</Label>
            <Input
              value={geoQuery}
              onChange={(e) => setGeoQuery(e.target.value)}
              placeholder="Kampala Industrial Area"
            />
          </div>
          <Button size="sm" onClick={geocode} disabled={mapBusy}>
            <Search className="h-4 w-4 mr-1" />
            Geocode
          </Button>
          <Button size="sm" variant="outline" onClick={directions} disabled={mapBusy}>
            <Navigation className="h-4 w-4 mr-1" />
            Sample route
          </Button>
          {(geoResult || routeInfo) && (
            <div className="w-full text-sm text-muted-foreground space-y-1">
              {geoResult ? <p>{geoResult}</p> : null}
              {routeInfo ? <p>{routeInfo}</p> : null}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Vehicle</TableHead>
              <TableHead>Lat</TableHead>
              <TableHead>Lng</TableHead>
              <TableHead>Speed</TableHead>
              <TableHead>Fuel %</TableHead>
              <TableHead>When</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={String(r.id)}>
                <TableCell className="font-mono text-xs">{String(r.vehicle_code)}</TableCell>
                <TableCell className="text-xs font-mono">{Number(r.latitude).toFixed(5)}</TableCell>
                <TableCell className="text-xs font-mono">{Number(r.longitude).toFixed(5)}</TableCell>
                <TableCell className="text-xs">{Number(r.speed_kmh).toFixed(1)} km/h</TableCell>
                <TableCell className="text-xs">{Number(r.fuel_pct).toFixed(0)}%</TableCell>
                <TableCell className="text-xs">{new Date(String(r.recorded_at)).toLocaleString()}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
