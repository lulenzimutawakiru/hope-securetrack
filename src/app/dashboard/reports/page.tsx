"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  BarChart3,
  LayoutDashboard,
  Target,
  Brain,
  FileStack,
  Library,
  PenLine,
  CalendarClock,
  Scale,
  LineChart,
  Crown,
  FileOutput,
  ArrowRight,
  AlertTriangle,
  Activity,
  ShieldCheck,
  Search,
  Bot,
  Database,
  PieChart,
  Server,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { LoadingState } from "@/components/ui/loading-state";
import { createClient } from "@/lib/supabase/client";
import { formatNumber } from "@/lib/utils";

const PILLARS = [
  "Data",
  "Reports",
  "Dashboards",
  "KPIs",
  "AI",
  "Documents",
  "Governance",
];

const MODULES = [
  {
    title: "Report Library",
    href: "/dashboard/reports/library",
    icon: Library,
    desc: "Catalog · financial · operational · regulatory · AI",
  },
  {
    title: "Report Designer",
    href: "/dashboard/reports/designer",
    icon: PenLine,
    desc: "Dynamic definitions · parameters · layouts",
  },
  {
    title: "Dashboard Center",
    href: "/dashboard/reports/dashboards",
    icon: LayoutDashboard,
    desc: "25+ role dashboards · widgets · live KPIs",
  },
  {
    title: "KPI Engine",
    href: "/dashboard/reports/kpis",
    icon: Target,
    desc: "Targets · variance · trends · thresholds",
  },
  {
    title: "AI Decision Intelligence",
    href: "/dashboard/reports/ai",
    icon: Brain,
    desc: "Forecast · risk · what-if · root cause",
  },
  {
    title: "Document Generator",
    href: "/dashboard/reports/documents",
    icon: FileStack,
    desc: "Invoices · PO · payslips · certificates · packs",
  },
  {
    title: "Document Intelligence",
    href: "/dashboard/reports/intelligence",
    icon: ShieldCheck,
    desc: "Board · minutes · QR/asset certs · hash · seal",
  },
  {
    title: "Enterprise Search",
    href: "/dashboard/reports/search",
    icon: Search,
    desc: "Global search across ERP entities",
  },
  {
    title: "AI Executive Assistant",
    href: "/dashboard/reports/assistant",
    icon: Bot,
    desc: "Natural-language decision Q&A",
  },
  {
    title: "Data Warehouse",
    href: "/dashboard/reports/warehouse",
    icon: Database,
    desc: "Facts · dims · marts · cubes · forecasts",
  },
  {
    title: "Visualization Gallery",
    href: "/dashboard/reports/visualization",
    icon: PieChart,
    desc: "22+ chart types · live samples",
  },
  {
    title: "Schedules & Delivery",
    href: "/dashboard/reports/schedules",
    icon: CalendarClock,
    desc: "Cron · multi-channel delivery",
  },
  {
    title: "Regulatory & Compliance",
    href: "/dashboard/reports/regulatory",
    icon: Scale,
    desc: "URA · NSSF · IFRS · ISO 9001/27001",
  },
  {
    title: "Analytics Studio",
    href: "/dashboard/reports/analytics",
    icon: LineChart,
    desc: "Descriptive → prescriptive analytics",
  },
  {
    title: "Executive Center",
    href: "/dashboard/reports/executive",
    icon: Crown,
    desc: "CEO · MD · Board · Investor views",
  },
  {
    title: "Export Center",
    href: "/dashboard/reports/export",
    icon: FileOutput,
    desc: "Watermarked PDF · Excel · CSV",
  },
  {
    title: "Architecture & Security",
    href: "/dashboard/reports/architecture",
    icon: Server,
    desc: "Services · MFA · RLS · scale targets",
  },
  {
    title: "Run History",
    href: "/dashboard/reports/history",
    icon: Activity,
    desc: "Audit of report executions",
  },
];

export default function ReportsBiHubPage() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    reports: 0,
    dashboards: 0,
    kpis: 0,
    insights: 0,
    schedules: 0,
    docs: 0,
  });
  const [insights, setInsights] = useState<Array<Record<string, unknown>>>([]);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const [r, d, k, i, s, doc, { data: open }] = await Promise.all([
        supabase
          .from("bi_report_definitions")
          .select("*", { count: "exact", head: true })
          .is("deleted_at", null),
        supabase
          .from("bi_dashboards")
          .select("*", { count: "exact", head: true })
          .is("deleted_at", null),
        supabase
          .from("bi_kpis")
          .select("*", { count: "exact", head: true })
          .eq("is_active", true)
          .is("deleted_at", null),
        supabase
          .from("bi_ai_insights")
          .select("*", { count: "exact", head: true })
          .eq("status", "open"),
        supabase
          .from("bi_report_schedules")
          .select("*", { count: "exact", head: true })
          .eq("is_active", true),
        supabase
          .from("bi_document_jobs")
          .select("*", { count: "exact", head: true }),
        supabase
          .from("bi_ai_insights")
          .select("*")
          .eq("status", "open")
          .order("created_at", { ascending: false })
          .limit(5),
      ]);
      setStats({
        reports: r.count ?? 0,
        dashboards: d.count ?? 0,
        kpis: k.count ?? 0,
        insights: i.count ?? 0,
        schedules: s.count ?? 0,
        docs: doc.count ?? 0,
      });
      setInsights(open ?? []);
      setLoading(false);
    }
    load();
  }, []);

  if (loading) return <LoadingState message="Loading BI & analytics platform…" />;

  return (
    <div>
      <PageHeader
        title="Enterprise Reporting & BI"
        description="SecureTrack ERP — Reports · Dashboards · KPIs · AI Decision Intelligence · Regulatory · Documents"
        actions={
          <div className="flex gap-2">
            <Link href="/dashboard/reports/library">
              <Button size="sm">Report library</Button>
            </Link>
            <Link href="/dashboard/reports/dashboards">
              <Button size="sm" variant="outline">
                Dashboards
              </Button>
            </Link>
            <Link href="/dashboard/reports/assistant">
              <Button size="sm" variant="outline">
                AI assistant
              </Button>
            </Link>
            <Link href="/dashboard/reports/search">
              <Button size="sm" variant="outline">
                Search
              </Button>
            </Link>
          </div>
        }
      />

      <div className="rounded-lg border bg-gradient-to-r from-hope-navy to-[#0d2847] text-white p-4 mb-6 text-sm">
        <p className="text-hope-gold text-xs font-semibold uppercase tracking-wide flex items-center gap-2">
          <BarChart3 className="h-3.5 w-3.5" />
          Decision intelligence architecture
        </p>
        <p className="text-white/80 mt-2 flex flex-wrap items-center gap-2">
          {PILLARS.map((p, i) => (
            <span key={p} className="flex items-center gap-2">
              {i > 0 && <ArrowRight className="h-3 w-3 text-white/40" />}
              <span className="rounded bg-white/10 px-2 py-0.5 text-xs">{p}</span>
            </span>
          ))}
        </p>
        <p className="text-white/50 text-xs mt-2">
          Beyond PDF/Excel: interactive drill-down, pixel layouts, matrix/pivot, scheduled
          packs, URA regulatory packages, and AI forecasting for SecureTrack ERP.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 mb-6">
        <StatCard title="Reports" value={formatNumber(stats.reports)} icon={Library} />
        <StatCard title="Dashboards" value={formatNumber(stats.dashboards)} icon={LayoutDashboard} />
        <StatCard title="Active KPIs" value={formatNumber(stats.kpis)} icon={Target} />
        <StatCard title="Open AI insights" value={formatNumber(stats.insights)} icon={Brain} />
        <StatCard title="Schedules" value={formatNumber(stats.schedules)} icon={CalendarClock} />
        <StatCard title="Doc jobs" value={formatNumber(stats.docs)} icon={FileStack} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 mb-8">
        {MODULES.map((m) => (
          <Link key={m.href} href={m.href}>
            <Card className="h-full hover:border-hope-teal transition-colors cursor-pointer">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <m.icon className="h-4 w-4 text-hope-teal" />
                  {m.title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">{m.desc}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            Priority AI insights
          </CardTitle>
          <Link href="/dashboard/reports/ai">
            <Button variant="ghost" size="sm">
              View all
              <ArrowRight className="h-3.5 w-3.5 ml-1" />
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          {insights.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No open AI insights. Run migration seeds or generate from AI center.
            </p>
          ) : (
            <ul className="space-y-3">
              {insights.map((ins) => (
                <li
                  key={String(ins.id)}
                  className="flex flex-wrap items-start gap-2 border-b last:border-0 pb-3 last:pb-0"
                >
                  <StatusBadge status={String(ins.severity ?? "info")} />
                  <Badge variant="outline" className="text-[10px] font-mono">
                    {String(ins.insight_type)}
                  </Badge>
                  <div className="flex-1 min-w-[200px]">
                    <p className="text-sm font-medium">{String(ins.title)}</p>
                    <p className="text-xs text-muted-foreground line-clamp-1">
                      {String(ins.recommendation ?? ins.summary ?? "")}
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {ins.confidence != null
                      ? `${Math.round(Number(ins.confidence) * 100)}% conf.`
                      : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
