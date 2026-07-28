"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Leaf } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/ui/stat-card";
import { LoadingState } from "@/components/ui/loading-state";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { createClient } from "@/lib/supabase/client";
import { formatNumber } from "@/lib/utils";

export default function SustainabilityPage() {
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data } = await supabase
        .from("scm_sustainability")
        .select("*")
        .order("period_label", { ascending: false });
      setRows(data ?? []);
      setLoading(false);
    }
    load();
  }, []);

  if (loading) return <LoadingState />;

  const latest = rows[0];

  return (
    <div>
      <PageHeader
        title="Sustainability & ESG"
        description="Carbon · fuel · packaging waste · recycling · energy · sustainable suppliers"
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href="/dashboard/scm">Hub</Link>
          </Button>
        }
      />

      {!latest ? (
        <EmptyState icon={Leaf} title="No ESG data" description="Record sustainability periods" />
      ) : (
        <>
          <p className="text-sm text-muted-foreground mb-4">
            Latest period: <strong>{String(latest.period_label)}</strong>
          </p>
          <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6 mb-6">
            <StatCard
              title="Carbon (t)"
              value={formatNumber(Number(latest.carbon_tons))}
              icon={Leaf}
            />
            <StatCard title="Fuel (L)" value={formatNumber(Number(latest.fuel_litres))} />
            <StatCard
              title="Pack waste (kg)"
              value={formatNumber(Number(latest.packaging_waste_kg))}
            />
            <StatCard title="Recycled %" value={`${latest.recycled_pct}%`} />
            <StatCard title="Energy (kWh)" value={formatNumber(Number(latest.energy_kwh))} />
            <StatCard
              title="Sustainable suppliers %"
              value={`${latest.sustainable_supplier_pct}%`}
            />
          </div>

          <div className="rounded-lg border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Period</TableHead>
                  <TableHead className="text-right">Carbon t</TableHead>
                  <TableHead className="text-right">Fuel L</TableHead>
                  <TableHead className="text-right">Waste kg</TableHead>
                  <TableHead className="text-right">Recycled %</TableHead>
                  <TableHead className="text-right">Energy kWh</TableHead>
                  <TableHead className="text-right">Sus. suppliers %</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={String(r.id)}>
                    <TableCell className="font-medium">
                      {String(r.period_label)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatNumber(Number(r.carbon_tons))}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatNumber(Number(r.fuel_litres))}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatNumber(Number(r.packaging_waste_kg))}
                    </TableCell>
                    <TableCell className="text-right">{String(r.recycled_pct)}%</TableCell>
                    <TableCell className="text-right">
                      {formatNumber(Number(r.energy_kwh))}
                    </TableCell>
                    <TableCell className="text-right">
                      {String(r.sustainable_supplier_pct)}%
                    </TableCell>
                    <TableCell className="text-sm max-w-xs truncate">
                      {String(r.notes ?? "—")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </div>
  );
}
