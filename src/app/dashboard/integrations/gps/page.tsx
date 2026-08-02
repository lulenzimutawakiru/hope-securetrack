"use client";

import { useEffect, useState } from "react";
import { MapPin, Plus } from "lucide-react";
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
import { LoadingState } from "@/components/ui/loading-state";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/hooks/use-user";
import { toast } from "sonner";
import { crudCreate } from "@/lib/api/crud-client";

export default function GpsPage() {
  const { auth } = useUser();
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [vehicle, setVehicle] = useState("VAN-01");

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

  const ping = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth?.profile?.company_id) return;
    try {
      // Kampala area sample coords with jitter
      const lat = 0.3476 + (Math.random() - 0.5) * 0.05;
      const lng = 32.5825 + (Math.random() - 0.5) * 0.05;
      const supabase = createClient();
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
        description="Trackers · location · speed · fuel · routes · delivery status"
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
