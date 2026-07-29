"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Truck, ClipboardList, Route, Users, MapPin, PackageCheck,
  ScanLine, FileSignature, AlertTriangle, RotateCcw, FileText,
  BarChart3, Wand2, Smartphone, ArrowRight, Warehouse, Navigation,
  Globe,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LoadingState } from "@/components/ui/loading-state";
import { StatCard } from "@/components/ui/stat-card";
import { createClient } from "@/lib/supabase/client";
import { DISPATCH_LIFECYCLE } from "@/lib/dispatch";

const MODULES = [
  { title: "Requests", href: "/dashboard/dispatch/requests", icon: ClipboardList, desc: "SO · transfers · collections" },
  { title: "Planning", href: "/dashboard/dispatch/planning", icon: Warehouse, desc: "Group · schedule · bays" },
  { title: "Fleet", href: "/dashboard/dispatch/fleet", icon: Truck, desc: "Trucks · vans · GPS units" },
  { title: "Drivers", href: "/dashboard/dispatch/drivers", icon: Users, desc: "Licenses · scores · trips" },
  { title: "Routes", href: "/dashboard/dispatch/routes", icon: Route, desc: "AI multi-stop optimize" },
  { title: "Loading", href: "/dashboard/dispatch/loading", icon: ScanLine, desc: "QR verify · seal · bay" },
  { title: "Live Tracking", href: "/dashboard/dispatch/tracking", icon: Navigation, desc: "GPS · ETA · map" },
  { title: "Proof of Delivery", href: "/dashboard/dispatch/pod", icon: FileSignature, desc: "Signature · photos · GPS" },
  { title: "Exceptions", href: "/dashboard/dispatch/exceptions", icon: AlertTriangle, desc: "Failed · delayed · SD" },
  { title: "Returns", href: "/dashboard/dispatch/returns", icon: RotateCcw, desc: "RMA · restock · credit" },
  { title: "Documents", href: "/dashboard/dispatch/documents", icon: FileText, desc: "DN · BOL · waybill · QR" },
  { title: "Customer Portal", href: "/dashboard/dispatch/portal", icon: Globe, desc: "Track · ETA · issues" },
  { title: "Mobile Driver", href: "/dashboard/dispatch/mobile", icon: Smartphone, desc: "Offline PWA · POD" },
  { title: "Analytics", href: "/dashboard/dispatch/analytics", icon: BarChart3, desc: "OTD · utilization · cost" },
  { title: "AI Assistant", href: "/dashboard/dispatch/ai", icon: Wand2, desc: "Delay · fleet · routes" },
  { title: "Legacy Dispatch", href: "/dashboard/dispatch/legacy", icon: PackageCheck, desc: "Classic SO dispatch list" },
];

export default function DispatchHubPage() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    pending: 0,
    vehicles: 0,
    drivers: 0,
    loading: 0,
    inTransit: 0,
    delivered: 0,
    failed: 0,
    exceptions: 0,
  });

  useEffect(() => {
    async function load() {
      const sb = createClient();
      const [pending, vehicles, drivers, loadingSess, inTransit, delivered, failed, exceptions] =
        await Promise.all([
          sb.from("dsp_requests").select("*", { count: "exact", head: true }).eq("status", "pending").is("deleted_at", null),
          sb.from("fleet_vehicles").select("*", { count: "exact", head: true }).eq("status", "available"),
          sb.from("dsp_drivers").select("*", { count: "exact", head: true }).eq("status", "available"),
          sb.from("dsp_requests").select("*", { count: "exact", head: true }).eq("status", "loading"),
          sb.from("dsp_requests").select("*", { count: "exact", head: true }).eq("status", "in_transit"),
          sb.from("dsp_requests").select("*", { count: "exact", head: true }).eq("status", "delivered"),
          sb.from("dsp_requests").select("*", { count: "exact", head: true }).eq("status", "failed"),
          sb.from("dsp_exceptions").select("*", { count: "exact", head: true }).eq("status", "open"),
        ]);
      setStats({
        pending: pending.count ?? 0,
        vehicles: vehicles.count ?? 0,
        drivers: drivers.count ?? 0,
        loading: loadingSess.count ?? 0,
        inTransit: inTransit.count ?? 0,
        delivered: delivered.count ?? 0,
        failed: failed.count ?? 0,
        exceptions: exceptions.count ?? 0,
      });
      setLoading(false);
    }
    load().catch(() => setLoading(false));
  }, []);

  if (loading) return <LoadingState message="Loading dispatch & delivery platform…" />;

  return (
    <div>
      <PageHeader
        title="Enterprise Dispatch & Delivery"
        description="Plan · assign · load · track · POD · returns · AI routes · nationwide logistics"
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard/dispatch/tracking">Live map</Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/dashboard/dispatch/requests">New request</Link>
            </Button>
          </div>
        }
      />

      <div className="mb-6 flex flex-wrap gap-1.5">
        {DISPATCH_LIFECYCLE.map((s) => (
          <Badge key={s} variant="outline" className="text-[10px] font-normal">{s}</Badge>
        ))}
      </div>

      <Card className="mb-6 border-primary/20 bg-gradient-to-r from-primary/5 to-transparent">
        <CardContent className="pt-4 text-sm flex items-start gap-3">
          <MapPin className="h-5 w-5 text-primary shrink-0 mt-0.5" />
          <div>
            <strong>End-to-end outbound logistics:</strong> sales/production → packaging →
            dispatch request → route optimization → QR loading seal → GPS transit → digital POD →
            invoice. Chain of custody with shipment QR at every handoff.
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        <StatCard title="Pending requests" value={String(stats.pending)} icon={ClipboardList} />
        <StatCard title="Vehicles ready" value={String(stats.vehicles)} icon={Truck} />
        <StatCard title="Drivers available" value={String(stats.drivers)} icon={Users} />
        <StatCard title="Awaiting loading" value={String(stats.loading)} icon={ScanLine} />
        <StatCard title="In transit" value={String(stats.inTransit)} icon={Navigation} />
        <StatCard title="Delivered" value={String(stats.delivered)} icon={PackageCheck} />
        <StatCard title="Failed" value={String(stats.failed)} icon={AlertTriangle} />
        <StatCard title="Open exceptions" value={String(stats.exceptions)} icon={AlertTriangle} />
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {MODULES.map((m) => (
          <Link
            key={m.href}
            href={m.href}
            className="group flex items-center gap-3 rounded-lg border p-4 hover:border-primary/40 hover:bg-muted/40 transition"
          >
            <div className="rounded-md bg-primary/10 p-2">
              <m.icon className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-medium text-sm group-hover:text-primary">{m.title}</p>
              <p className="text-xs text-muted-foreground truncate">{m.desc}</p>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100" />
          </Link>
        ))}
      </div>
    </div>
  );
}
