"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Database } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { LoadingState } from "@/components/ui/loading-state";
import { createClient } from "@/lib/supabase/crud-compat";
import { formatNumber } from "@/lib/utils";

export default function DataWarehousePage() {
  const [loading, setLoading] = useState(true);
  const [objects, setObjects] = useState<Array<Record<string, unknown>>>([]);
  const [marts, setMarts] = useState<Array<Record<string, unknown>>>([]);
  const [models, setModels] = useState<Array<Record<string, unknown>>>([]);
  const [forecasts, setForecasts] = useState<Array<Record<string, unknown>>>([]);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const [o, m, mod, f] = await Promise.all([
        supabase.from("bi_dwh_objects").select("*").order("object_type").order("object_key"),
        supabase.from("bi_data_marts").select("*").order("mart_code"),
        supabase.from("bi_analytics_models").select("*").order("analytics_type"),
        supabase.from("bi_forecast_results").select("*").order("created_at", { ascending: false }),
      ]);
      setObjects(o.data ?? []);
      setMarts(m.data ?? []);
      setModels(mod.data ?? []);
      setForecasts(f.data ?? []);
      setLoading(false);
    }
    load();
  }, []);

  if (loading) return <LoadingState message="Loading data warehouse catalog…" />;

  const facts = objects.filter((o) => o.object_type === "fact");
  const dims = objects.filter((o) => o.object_type === "dimension");
  const other = objects.filter(
    (o) => !["fact", "dimension"].includes(String(o.object_type))
  );

  return (
    <div>
      <PageHeader
        title="Enterprise Data Warehouse"
        description="Star / snowflake catalog · facts · dimensions · SCD · OLAP cubes · data lake zones · marts"
        actions={
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard/reports">Hub</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard/reports/analytics">Analytics</Link>
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-xs text-muted-foreground">Facts</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{facts.length}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-xs text-muted-foreground">Dimensions</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{dims.length}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-xs text-muted-foreground">Data marts</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{marts.length}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-xs text-muted-foreground">Analytics models</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{models.length}</CardContent>
        </Card>
      </div>

      <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
        <Database className="h-4 w-4" />
        Warehouse objects
      </h3>
      <div className="rounded-lg border overflow-x-auto mb-8">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Key</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Grain / SCD</TableHead>
              <TableHead className="text-right">Rows (est.)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {objects.map((o) => (
              <TableRow key={String(o.id)}>
                <TableCell className="font-mono text-xs">{String(o.object_key)}</TableCell>
                <TableCell className="text-sm">{String(o.object_name)}</TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-[10px]">
                    {String(o.object_type)}
                  </Badge>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground max-w-[220px]">
                  {String(o.grain ?? "—")}
                  {o.scd_type ? ` · SCD${o.scd_type}` : ""}
                </TableCell>
                <TableCell className="text-right text-sm">
                  {formatNumber(Number(o.row_estimate ?? 0))}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <h3 className="text-sm font-semibold mb-2">Data marts</h3>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 mb-8">
        {marts.map((m) => (
          <Card key={String(m.id)}>
            <CardHeader className="pb-1">
              <CardTitle className="text-sm">{String(m.name)}</CardTitle>
              <p className="text-xs font-mono text-muted-foreground">{String(m.mart_code)}</p>
            </CardHeader>
            <CardContent className="text-xs space-y-1">
              <Badge variant="secondary" className="capitalize">
                {String(m.domain)}
              </Badge>
              <p className="text-muted-foreground">{String(m.description ?? "")}</p>
              <p>
                Facts: {(m.fact_objects as string[] | null)?.join(", ") || "—"}
              </p>
              <p>
                Dims: {(m.dimension_objects as string[] | null)?.join(", ") || "—"}
              </p>
              <p className="text-muted-foreground">Owner: {String(m.owner_name ?? "—")}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <h3 className="text-sm font-semibold mb-2">Analytics models</h3>
      <div className="rounded-lg border overflow-x-auto mb-8">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Domain</TableHead>
              <TableHead>Algorithm</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {models.map((m) => (
              <TableRow key={String(m.id)}>
                <TableCell className="font-mono text-xs">{String(m.model_code)}</TableCell>
                <TableCell className="text-sm">{String(m.name)}</TableCell>
                <TableCell className="capitalize text-xs">{String(m.analytics_type)}</TableCell>
                <TableCell className="text-xs">{String(m.domain)}</TableCell>
                <TableCell className="font-mono text-[10px]">{String(m.algorithm)}</TableCell>
                <TableCell>
                  <Badge className="bg-green-100 text-green-800 text-[10px]">
                    {String(m.status)}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {other.length > 0 && (
        <p className="text-xs text-muted-foreground mb-4">
          Cubes / lake zones: {other.map((o) => String(o.object_key)).join(", ")}
        </p>
      )}

      <h3 className="text-sm font-semibold mb-2">Forecast results</h3>
      <div className="rounded-lg border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Metric</TableHead>
              <TableHead>Period</TableHead>
              <TableHead className="text-right">Forecast</TableHead>
              <TableHead className="text-right">Range</TableHead>
              <TableHead>Unit</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {forecasts.map((f) => (
              <TableRow key={String(f.id)}>
                <TableCell className="font-mono text-xs">{String(f.metric_key)}</TableCell>
                <TableCell className="text-xs">
                  {String(f.period_start ?? "")} → {String(f.period_end ?? "")}
                </TableCell>
                <TableCell className="text-right font-medium">
                  {formatNumber(Number(f.forecast_value))}
                </TableCell>
                <TableCell className="text-right text-xs text-muted-foreground">
                  {formatNumber(Number(f.lower_bound))} – {formatNumber(Number(f.upper_bound))}
                </TableCell>
                <TableCell className="text-xs">{String(f.unit ?? "")}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
