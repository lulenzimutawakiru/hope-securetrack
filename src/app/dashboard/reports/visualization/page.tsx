"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PieChart as PieIcon } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LoadingState } from "@/components/ui/loading-state";
import { createClient } from "@/lib/supabase/client";
import {
  BarChart, Bar, PieChart, Pie, Cell, AreaChart, Area, RadarChart, Radar,
  PolarGrid, PolarAngleAxis, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid,
  ScatterChart, Scatter, FunnelChart, Funnel, LabelList,
} from "recharts";

const COLORS = ["#0B1F3A", "#C9A227", "#0D7377", "#64748B", "#22c55e", "#ef4444"];

const sampleBar = [
  { name: "Q1", value: 40 },
  { name: "Q2", value: 55 },
  { name: "Q3", value: 48 },
  { name: "Q4", value: 62 },
];
const samplePie = [
  { name: "Security", value: 35 },
  { name: "Paper", value: 28 },
  { name: "Eng", value: 20 },
  { name: "Commercial", value: 17 },
];
const sampleRadar = [
  { subject: "Quality", A: 88 },
  { subject: "OTD", A: 93 },
  { subject: "Margin", A: 72 },
  { subject: "Safety", A: 95 },
  { subject: "Cash", A: 68 },
];
const sampleScatter = [
  { x: 10, y: 30 },
  { x: 20, y: 45 },
  { x: 30, y: 40 },
  { x: 40, y: 70 },
  { x: 50, y: 65 },
];
const sampleFunnel = [
  { name: "Leads", value: 100 },
  { name: "Qualified", value: 70 },
  { name: "Proposal", value: 40 },
  { name: "Won", value: 18 },
];

export default function VisualizationGalleryPage() {
  const [loading, setLoading] = useState(true);
  const [charts, setCharts] = useState<Array<Record<string, unknown>>>([]);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data } = await supabase
        .from("bi_chart_catalog")
        .select("*")
        .order("category")
        .order("name");
      setCharts(data ?? []);
      setLoading(false);
    }
    load();
  }, []);

  if (loading) return <LoadingState />;

  return (
    <div>
      <PageHeader
        title="Enterprise Visualization"
        description="22+ chart types — bar · pie · radar · funnel · scatter · treemap · geo · gantt · sankey · sunburst…"
        actions={
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard/reports">Hub</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard/reports/dashboards">Dashboards</Link>
            </Button>
          </div>
        }
      />

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 mb-8">
        {charts.map((c) => (
          <Card key={String(c.id)} className={!c.is_enabled ? "opacity-50" : undefined}>
            <CardContent className="py-3">
              <div className="flex items-center gap-2">
                <PieIcon className="h-3.5 w-3.5 text-hope-teal" />
                <span className="text-sm font-medium">{String(c.name)}</span>
              </div>
              <Badge variant="outline" className="text-[9px] mt-1 capitalize">
                {String(c.category)}
              </Badge>
              <p className="text-[10px] text-muted-foreground mt-1 line-clamp-2">
                {String(c.description ?? "")}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <h3 className="text-sm font-semibold mb-3">Live samples (Recharts engine)</h3>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-sm">Bar / Column</CardTitle>
          </CardHeader>
          <CardContent className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={sampleBar}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="value" fill="#0D7377" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-sm">Pie / Donut</CardTitle>
          </CardHeader>
          <CardContent className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={samplePie} dataKey="value" nameKey="name" innerRadius={40} outerRadius={80} label>
                  {samplePie.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-sm">Area / Spline</CardTitle>
          </CardHeader>
          <CardContent className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={sampleBar}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Area type="monotone" dataKey="value" stroke="#C9A227" fill="#C9A22733" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-sm">Radar (scorecard)</CardTitle>
          </CardHeader>
          <CardContent className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={sampleRadar}>
                <PolarGrid />
                <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10 }} />
                <Radar dataKey="A" stroke="#0D7377" fill="#0D737766" />
                <Tooltip />
              </RadarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-sm">Scatter</CardTitle>
          </CardHeader>
          <CardContent className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="x" tick={{ fontSize: 10 }} />
                <YAxis dataKey="y" tick={{ fontSize: 10 }} />
                <Tooltip />
                <Scatter data={sampleScatter} fill="#0B1F3A" />
              </ScatterChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-sm">Funnel</CardTitle>
          </CardHeader>
          <CardContent className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <FunnelChart>
                <Tooltip />
                <Funnel dataKey="value" data={sampleFunnel} isAnimationActive>
                  <LabelList position="right" fill="#334155" stroke="none" dataKey="name" fontSize={11} />
                  {sampleFunnel.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Funnel>
              </FunnelChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <p className="text-xs text-muted-foreground mt-4">
        Catalog entries for treemap, heatmap, geo map, gauge, waterfall, box plot, candlestick,
        gantt, sankey, sunburst, timeline, and network graph are registered for dashboard
        widgets; specialized renderers attach via widget_type config.
      </p>
    </div>
  );
}
