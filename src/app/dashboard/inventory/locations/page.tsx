"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MapPin, Warehouse } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import { StatCard } from "@/components/ui/stat-card";
import { createClient } from "@/lib/supabase/client";
import { formatNumber } from "@/lib/utils";

export default function LocationsPage() {
  const [warehouses, setWarehouses] = useState<Array<Record<string, unknown>>>([]);
  const [zones, setZones] = useState<Array<Record<string, unknown>>>([]);
  const [bins, setBins] = useState<Array<Record<string, unknown>>>([]);
  const [selectedWh, setSelectedWh] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const [{ data: wh }, { data: z }, { data: b }] = await Promise.all([
        supabase
          .from("warehouses")
          .select("*")
          .eq("is_active", true)
          .order("name"),
        supabase.from("warehouse_zones").select("*").order("code"),
        supabase.from("warehouse_bins").select("*").order("code"),
      ]);
      setWarehouses(wh ?? []);
      setZones(z ?? []);
      setBins(b ?? []);
      if (wh?.[0]) setSelectedWh(String(wh[0].id));
      setLoading(false);
    }
    load();
  }, []);

  if (loading) return <LoadingState />;

  const whZones = zones.filter((z) => z.warehouse_id === selectedWh);
  const whBins = bins.filter((b) => b.warehouse_id === selectedWh);
  const selected = warehouses.find((w) => w.id === selectedWh);

  return (
    <div>
      <PageHeader
        title="Locations"
        description="Warehouses · zones · racks · shelves · bins · capacity"
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href="/dashboard/inventory">Hub</Link>
          </Button>
        }
      />

      <div className="grid gap-4 md:grid-cols-3 mb-6">
        <StatCard
          title="Warehouses"
          value={formatNumber(warehouses.length)}
          icon={Warehouse}
        />
        <StatCard title="Zones" value={formatNumber(zones.length)} icon={MapPin} />
        <StatCard title="Bins" value={formatNumber(bins.length)} />
      </div>

      <div className="grid gap-4 md:grid-cols-3 mb-6">
        {warehouses.map((w) => (
          <Card
            key={String(w.id)}
            className={`cursor-pointer transition-colors ${
              selectedWh === w.id ? "border-hope-teal ring-1 ring-hope-teal/30" : ""
            }`}
            onClick={() => setSelectedWh(String(w.id))}
          >
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center justify-between">
                <span>{String(w.name)}</span>
                <Badge variant="secondary">{String(w.code)}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-1">
              <div className="capitalize">
                Type: {String(w.warehouse_type ?? "main").replace(/_/g, " ")}
              </div>
              <div>City: {String(w.city ?? "—")}</div>
              <div>
                Capacity:{" "}
                {w.capacity_units != null
                  ? formatNumber(Number(w.capacity_units))
                  : "—"}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {!selected ? (
        <EmptyState
          icon={Warehouse}
          title="No warehouses"
          description="Warehouses are created during company setup"
        />
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <div>
            <h3 className="font-medium mb-3">
              Zones — {String(selected.name)}
            </h3>
            {whZones.length === 0 ? (
              <p className="text-sm text-muted-foreground">No zones defined</p>
            ) : (
              <div className="rounded-lg border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Code</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Type</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {whZones.map((z) => (
                      <TableRow key={String(z.id)}>
                        <TableCell className="font-mono text-sm">
                          {String(z.code)}
                        </TableCell>
                        <TableCell>{String(z.name)}</TableCell>
                        <TableCell className="capitalize">
                          {String(z.zone_type).replace(/_/g, " ")}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>

          <div>
            <h3 className="font-medium mb-3">Bins / locations</h3>
            {whBins.length === 0 ? (
              <p className="text-sm text-muted-foreground">No bins defined</p>
            ) : (
              <div className="rounded-lg border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Code</TableHead>
                      <TableHead>Aisle</TableHead>
                      <TableHead>Shelf</TableHead>
                      <TableHead>Barcode</TableHead>
                      <TableHead className="text-right">Capacity</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {whBins.map((b) => (
                      <TableRow key={String(b.id)}>
                        <TableCell className="font-mono text-sm">
                          {String(b.code)}
                        </TableCell>
                        <TableCell>{String(b.aisle ?? "—")}</TableCell>
                        <TableCell>{String(b.shelf ?? "—")}</TableCell>
                        <TableCell className="font-mono text-xs">
                          {String(b.barcode ?? "—")}
                        </TableCell>
                        <TableCell className="text-right">
                          {b.capacity_units != null
                            ? formatNumber(Number(b.capacity_units))
                            : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
