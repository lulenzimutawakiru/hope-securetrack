"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ShoppingBag,
  FileText,
  FileQuestion,
  ClipboardList,
  Ship,
  Truck,
  Users,
  Brain,
  Award,
  PackageCheck,
  FileBarChart,
  UserPlus,
  ShieldAlert,
  ClipboardCheck,
  Globe,
  MessageSquare,
  FolderOpen,
  Scale,
  BarChart3,
  Contact,
  Tags,
  Smartphone,
  ShieldCheck,
  BookCheck,
  Handshake,
  GitBranch,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { LoadingState } from "@/components/ui/loading-state";
import { getSrmDashboardStats, LIFECYCLE_STAGES } from "@/lib/srm";
import { formatNumber } from "@/lib/utils";

const MODULES = [
  { title: "Suppliers 360°", href: "/dashboard/procurement/suppliers", icon: Users, desc: "Master vendor profiles" },
  { title: "Contacts", href: "/dashboard/procurement/contacts", icon: Contact, desc: "Multi-contact management" },
  { title: "Categories", href: "/dashboard/procurement/categories", icon: Tags, desc: "Unlimited spend categories" },
  { title: "Onboarding", href: "/dashboard/procurement/onboarding", icon: UserPlus, desc: "Digital qualification" },
  { title: "Documents", href: "/dashboard/procurement/documents", icon: FolderOpen, desc: "Certificates & expiry" },
  { title: "Timeline", href: "/dashboard/procurement/timeline", icon: MessageSquare, desc: "Supplier activity feed" },
  { title: "Requisitions", href: "/dashboard/procurement/requisitions", icon: ClipboardList, desc: "Demand & CAPEX" },
  { title: "RFQ / RFP / RFI", href: "/dashboard/procurement/rfq", icon: FileQuestion, desc: "Sourcing & evaluation" },
  { title: "Purchase Orders", href: "/dashboard/procurement/orders", icon: FileText, desc: "PO lifecycle" },
  { title: "Contracts", href: "/dashboard/procurement/contracts", icon: Award, desc: "Framework & SLAs" },
  { title: "Inbound Logistics", href: "/dashboard/procurement/inbound", icon: Ship, desc: "Shipments & GRN link" },
  { title: "Quality / NCR", href: "/dashboard/procurement/quality", icon: ClipboardCheck, desc: "Inspection & CAPA" },
  { title: "Invoice Matching", href: "/dashboard/procurement/matching", icon: Scale, desc: "3-way PO+GRN+Invoice" },
  { title: "Performance", href: "/dashboard/procurement/performance", icon: BarChart3, desc: "Scorecards & KPIs" },
  { title: "Risk Management", href: "/dashboard/procurement/risk", icon: ShieldAlert, desc: "Disruption & ESG" },
  { title: "Supplier Portal", href: "/dashboard/procurement/portal", icon: Globe, desc: "Self-service admin" },
  { title: "AI Intelligence", href: "/dashboard/procurement/ai", icon: Brain, desc: "Recommend · predict · negotiate" },
  { title: "Analytics", href: "/dashboard/procurement/analytics", icon: FileBarChart, desc: "Spend · risk heatmap · savings" },
  { title: "Compliance", href: "/dashboard/procurement/compliance", icon: ShieldCheck, desc: "Certs · CAPA · contracts · ESG" },
  { title: "Approved Registry", href: "/dashboard/procurement/registry", icon: BookCheck, desc: "Approved material suppliers" },
  { title: "Traceability", href: "/dashboard/procurement/traceability", icon: GitBranch, desc: "Lot → batch → product" },
  { title: "Collaboration", href: "/dashboard/procurement/collaboration", icon: Handshake, desc: "CPFR · capacity · slots" },
  { title: "Mobile SRM", href: "/dashboard/procurement/mobile", icon: Smartphone, desc: "Field approve · scan · inspect" },
  { title: "Fleet", href: "/dashboard/procurement/fleet", icon: Truck, desc: "Vehicles & maintenance" },
  { title: "Goods Receipt", href: "/dashboard/inventory/grn", icon: PackageCheck, desc: "GRN & warehouse" },
];

interface Insight {
  id: string;
  title: string;
  recommendation: string;
  severity: string;
  insight_type: string;
}

export default function SrmHubPage() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    activeSuppliers: 0,
    pendingOnboarding: 0,
    openNcrs: 0,
    openRisks: 0,
    activeContracts: 0,
    openPoSpend: 0,
    openRfqs: 0,
  });
  const [insights, setInsights] = useState<Insight[]>([]);
  const [topSpend, setTopSpend] = useState<Array<Record<string, unknown>>>([]);

  useEffect(() => {
    async function load() {
      try {
        const s = await getSrmDashboardStats();
        setStats({
          activeSuppliers: s.activeSuppliers,
          pendingOnboarding: s.pendingOnboarding,
          openNcrs: s.openNcrs,
          openRisks: s.openRisks,
          activeContracts: s.activeContracts,
          openPoSpend: s.openPoSpend,
          openRfqs: s.openRfqs,
        });
        setInsights((s.insights as Insight[]) || []);
        setTopSpend(s.topSpend || []);
      } catch {
        /* migration may be pending */
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) return <LoadingState message="Loading Enterprise SRM…" />;

  return (
    <div>
      <PageHeader
        title="Enterprise SRM"
        description="Supplier Relationship Management · Vendor lifecycle · Procurement collaboration · AI intelligence"
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm">
              <Link href="/dashboard/procurement/suppliers">Suppliers</Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href="/dashboard/procurement/onboarding">Onboard</Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href="/dashboard/procurement/rfq">RFQ</Link>
            </Button>
          </div>
        }
      />

      <div className="rounded-lg border bg-gradient-to-r from-hope-navy to-hope-teal text-white p-4 mb-6">
        <p className="text-hope-gold text-xs font-semibold uppercase tracking-wide">
          Complete supplier lifecycle
        </p>
        <div className="flex flex-wrap gap-1.5 mt-2">
          {LIFECYCLE_STAGES.map((s, i) => (
            <span
              key={s}
              className="text-[10px] sm:text-xs bg-white/10 border border-white/15 rounded-full px-2 py-0.5"
            >
              {i + 1}. {s}
            </span>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 mb-6">
        <StatCard title="Active suppliers" value={formatNumber(stats.activeSuppliers)} icon={Users} />
        <StatCard title="Pending onboarding" value={formatNumber(stats.pendingOnboarding)} icon={UserPlus} />
        <StatCard title="Open POs spend" value={formatNumber(Math.round(stats.openPoSpend))} icon={ShoppingBag} />
        <StatCard title="Open RFQs" value={formatNumber(stats.openRfqs)} icon={FileQuestion} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4 mb-6">
        <StatCard title="Active contracts" value={formatNumber(stats.activeContracts)} />
        <StatCard title="Open NCRs" value={formatNumber(stats.openNcrs)} />
        <StatCard title="Open risks" value={formatNumber(stats.openRisks)} />
        <StatCard title="Modules" value={String(MODULES.length)} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3 mb-6">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Brain className="h-4 w-4 text-hope-teal" />
              AI Procurement Intelligence
            </CardTitle>
            <Button asChild size="sm" variant="ghost">
              <Link href="/dashboard/procurement/ai">Open AI hub</Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {insights.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Insights appear after migration 00045 (seed intelligence included).
              </p>
            ) : (
              insights.map((i) => (
                <div key={i.id} className="rounded-lg border p-3">
                  <div className="flex justify-between gap-2">
                    <p className="font-medium text-sm">{i.title}</p>
                    <StatusBadge status={i.severity} />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{i.recommendation}</p>
                  <Badge variant="secondary" className="text-[10px] mt-2 capitalize">
                    {i.insight_type?.replace(/_/g, " ")}
                  </Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top spend suppliers</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {topSpend.length === 0 && (
              <p className="text-sm text-muted-foreground">No spend data yet.</p>
            )}
            {topSpend.map((s) => (
              <div key={String(s.id)} className="flex justify-between text-sm border-b last:border-0 pb-2">
                <div>
                  <p className="font-medium">{String(s.name)}</p>
                  <p className="text-[10px] text-muted-foreground capitalize">
                    {String(s.supplier_class || "—")} · score {String(s.overall_score ?? "—")}
                  </p>
                </div>
                <span className="font-semibold text-xs">{formatNumber(Number(s.spend_ytd || 0))}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <h2 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wide">
        SRM modules
      </h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {MODULES.map((m) => {
          const Icon = m.icon;
          return (
            <Link
              key={m.href + m.title}
              href={m.href}
              className="group rounded-lg border bg-card p-4 hover:border-primary/40 hover:shadow-sm transition-all"
            >
              <div className="flex items-start gap-3">
                <div className="rounded-md bg-primary/10 p-2 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                  <Icon className="h-4 w-4" />
                </div>
                <div>
                  <p className="font-medium text-sm">{m.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{m.desc}</p>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
