"use client";

import { useState } from "react";
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
import { useEntityAll } from "@/hooks/use-entity-all";
import { formatNumber } from "@/lib/utils";

interface WarehouseRow {
  id: string;
  name: string;
  code: string;
  warehouse_type: string | null;
  city: string | null;
  capacity_units: number | null;
}

interface ZoneRow {
  id: string;
  warehouse_id: string | null;
  code: string;
  name: string;
  zone_type: string | null;
}

interface BinRow {
  id: string;
  warehouse_id: string | null;
  code: string;
  aisle: string | null;
  shelf: string | null;
  barcode: string | null;
  capacity_units: number | null;
}

export default function LocationsPage() {
  const [selectedWh, setSelectedWh] = useState<string | null>(null);

  // Reads flow through the hardened CRUD API: tenant/company are derived
  // server-side, rows are permission-checked and dual-key (tenant + company)
  // scoped. All three location entities gate view on inventory.view, so the
  // warehouse roles that drive this page resolve through the CRUD surface
  // with no PostgREST joins.
  const warehousesQ = useEntityAll<WarehouseRow>("warehouses", {
    sort: "name",
    filters: { is_active: true },
  });
  const zonesQ = useEntityAll<ZoneRow>("warehouse_zones", {
    sort: "code",
  });
  const binsQ = useEntityAll<BinRow>("warehouse_bins", {
    sort: "code",
  });

  const warehouses = warehousesQ.data ?? [];
  const zones = zonesQ.data ?? [];
  const bins = binsQ.data ?? [];

  // Default the selected warehouse to the first active warehouse until the
  // user picks one, preserving the pre-CRUD behaviour without an effect.
  const activeWhId = selectedWh ?? warehouses[0]?.id ?? null;

  if (warehousesQ.isLoading || zonesQ.isLoading || binsQ.isLoading) {
    return <LoadingState />;
  }

  const whZones = zones.filter((z) => z.warehouse_id === activeWhId);
  const whBins = bins.filter((b) => b.warehouse_id === activeWhId);
  const selected = warehouses.find((w) => w.id === activeWhId);

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
            key={w.id}
            className={`cursor-pointer transition-colors ${
              activeWhId === w.id ? "border-hope-teal ring-1 ring-hope-teal/30" : ""
            }`}
            onClick={() => setSelectedWh(w.id)}
          >
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center justify-between">
                <span>{w.name}</span>
                <Badge variant="secondary">{w.code}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-1">
              <div className="capitalize">
                Type: {String(w.warehouse_type ?? "main").replace(/_/g, " ")}
              </div>
              <div>City: {w.city ?? "—"}</div>
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
              Zones — {selected.name}
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
                      <TableRow key={z.id}>
                        <TableCell className="font-mono text-sm">
                          {z.code}
                        </TableCell>
                        <TableCell>{z.name}</TableCell>
                        <TableCell className="capitalize">
                          {String(z.zone_type ?? "storage").replace(/_/g, " ")}
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
                      <TableRow key={b.id}>
                        <TableCell className="font-mono text-sm">
                          {b.code}
                        </TableCell>
                        <TableCell>{b.aisle ?? "—"}</TableCell>
                        <TableCell>{b.shelf ?? "—"}</TableCell>
                        <TableCell className="font-mono text-xs">
                          {b.barcode ?? "—"}
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
