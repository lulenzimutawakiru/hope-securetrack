"use client";

import { useEffect, useState } from "react";
import { Route, Wand2 } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import { createClient } from "@/lib/supabase/crud-compat";
import { useUser } from "@/hooks/use-user";
import { toast } from "sonner";
import { createOptimizedRoute } from "@/lib/dispatch";

export default function DispatchRoutesPage() {
  const { auth } = useUser();
  const [routes, setRoutes] = useState<Array<Record<string, unknown>>>([]);
  const [stops, setStops] = useState<Array<Record<string, unknown>>>([]);
  const [pending, setPending] = useState<Array<Record<string, unknown>>>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [activeRoute, setActiveRoute] = useState<string | null>(null);
  const [name, setName] = useState("Metro route");
  const [loading, setLoading] = useState(true);

  const companyId = auth?.profile?.company_id as string | undefined;
  const userId = auth?.profile?.id as string | undefined;

  const load = async () => {
    const sb = createClient();
    const [{ data: r }, { data: p }] = await Promise.all([
      sb.from("dsp_routes").select("*").order("created_at", { ascending: false }).limit(50),
      sb.from("dsp_requests").select("id, request_number, customer_name, priority, weight_kg, status")
        .in("status", ["pending", "planned"])
        .is("deleted_at", null),
    ]);
    setRoutes((r as Array<Record<string, unknown>>) || []);
    setPending((p as Array<Record<string, unknown>>) || []);
    setLoading(false);
  };

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!activeRoute) return;
    createClient()
      .from("dsp_route_stops")
      .select("*")
      .eq("route_id", activeRoute)
      .order("sequence_no")
      .then(({ data }) => setStops((data as Array<Record<string, unknown>>) || []));
  }, [activeRoute]);

  const toggle = (id: string) => {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  };

  const optimize = async () => {
    if (!companyId || selected.length === 0) {
      toast.error("Select at least one pending request");
      return;
    }
    try {
      const res = await createOptimizedRoute({
        company_id: companyId,
        name,
        request_ids: selected,
        strategy: "balanced",
        created_by: userId});
      toast.success(
        `Route ${res.route.route_number} · ${res.optimization.totalDistanceKm} km · score ${res.optimization.score}`
      );
      setSelected([]);
      setActiveRoute(res.route.id);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Optimize failed");
    }
  };

  if (loading) return <LoadingState message="Loading routes…" />;

  return (
    <div>
      <PageHeader
        title="Route Optimization"
        description="Multi-stop · fastest / shortest / fuel · dynamic sequence"
      />

      <div className="grid gap-4 lg:grid-cols-2 mb-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pending stops</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex gap-2 mb-2">
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Route name" />
              <Button size="sm" onClick={optimize}>
                <Wand2 className="h-4 w-4 mr-1" /> Optimize
              </Button>
            </div>
            {pending.map((p) => (
              <label key={String(p.id)} className="flex items-center gap-2 text-sm border rounded p-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selected.includes(String(p.id))}
                  onChange={() => toggle(String(p.id))}
                />
                <span className="font-mono text-xs">{String(p.request_number)}</span>
                <span className="flex-1 truncate">{String(p.customer_name)}</span>
                <Badge variant="outline" className="text-[10px]">{String(p.priority)}</Badge>
              </label>
            ))}
            {pending.length === 0 && <p className="text-sm text-muted-foreground">No pending requests</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><Route className="h-4 w-4" /> Stop sequence</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {stops.map((s) => (
              <div key={String(s.id)} className="flex gap-2 text-sm border-b pb-1">
                <Badge variant="secondary" className="text-[10px]">{String(s.sequence_no)}</Badge>
                <div className="min-w-0">
                  <p className="font-medium truncate">{String(s.customer_name)}</p>
                  <p className="text-xs text-muted-foreground truncate">{String(s.address || "")}</p>
                </div>
              </div>
            ))}
            {stops.length === 0 && <p className="text-sm text-muted-foreground">Select a route or optimize</p>}
          </CardContent>
        </Card>
      </div>

      {routes.length === 0 ? (
        <EmptyState title="No routes" description="Optimize selected requests to create a route." />
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Stops</TableHead>
                <TableHead>Distance</TableHead>
                <TableHead>ETA min</TableHead>
                <TableHead>Score</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {routes.map((r) => (
                <TableRow
                  key={String(r.id)}
                  className="cursor-pointer"
                  onClick={() => setActiveRoute(String(r.id))}
                >
                  <TableCell className="font-mono text-xs">{String(r.route_number)}</TableCell>
                  <TableCell className="text-sm font-medium">{String(r.name)}</TableCell>
                  <TableCell>{String(r.total_stops)}</TableCell>
                  <TableCell className="text-xs">{String(r.total_distance_km)} km</TableCell>
                  <TableCell className="text-xs">{String(r.estimated_duration_min)}</TableCell>
                  <TableCell>{String(r.optimization_score)}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-[10px] capitalize">{String(r.status)}</Badge>
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
