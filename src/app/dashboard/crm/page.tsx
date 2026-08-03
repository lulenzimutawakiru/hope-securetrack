"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Building2,
  Users,
  Calendar,
  FileText,
  Headphones,
  Heart,
  Megaphone,
  Brain,
  Target,
  ShoppingCart,
  TrendingUp,
  CreditCard,
  Globe,
  Truck,
  Gavel,
  MessageSquare,
  BarChart3,
  Smartphone,
  Layers,
  Sparkles,
  Contact,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { LoadingState } from "@/components/ui/loading-state";
import { getCrmDashboardStats } from "@/lib/crm";
import { LIFECYCLE_STAGES } from "@/lib/crm/types";
import { formatNumber } from "@/lib/utils";

const MODULES = [
  { title: "Accounts 360°", href: "/dashboard/crm/accounts", icon: Building2, desc: "Full customer profiles" },
  { title: "Contacts", href: "/dashboard/crm/contacts", icon: Contact, desc: "Unlimited contacts & roles" },
  { title: "Leads", href: "/dashboard/crm/leads", icon: Target, desc: "Capture & score leads" },
  { title: "Opportunities", href: "/dashboard/crm/opportunities", icon: TrendingUp, desc: "Deal tracking" },
  { title: "Pipeline", href: "/dashboard/crm/pipeline", icon: Layers, desc: "Kanban & forecast" },
  { title: "Activities", href: "/dashboard/crm/activities", icon: Calendar, desc: "Calls, visits, follow-ups" },
  { title: "Timeline", href: "/dashboard/crm/timeline", icon: MessageSquare, desc: "Customer activity feed" },
  { title: "Quotations", href: "/dashboard/sales/quotations", icon: FileText, desc: "Branded quotes" },
  { title: "Sales Orders", href: "/dashboard/sales/orders", icon: ShoppingCart, desc: "Quote-to-cash" },
  { title: "Credit", href: "/dashboard/crm/credit", icon: CreditCard, desc: "Limits, holds, aging" },
  { title: "Contracts", href: "/dashboard/crm/contracts", icon: FileText, desc: "Agreements & renewals" },
  { title: "Campaigns", href: "/dashboard/crm/campaigns", icon: Megaphone, desc: "Marketing automation" },
  { title: "Segments", href: "/dashboard/crm/segments", icon: Users, desc: "Audience targeting" },
  { title: "Loyalty", href: "/dashboard/crm/loyalty", icon: Heart, desc: "Points & tiers" },
  { title: "Feedback", href: "/dashboard/crm/feedback", icon: Sparkles, desc: "CSAT · NPS · sentiment" },
  { title: "Communications", href: "/dashboard/crm/communications", icon: MessageSquare, desc: "Email · SMS · WhatsApp" },
  { title: "Documents", href: "/dashboard/crm/documents", icon: FileText, desc: "Contracts & certificates" },
  { title: "Dealers", href: "/dashboard/crm/dealers", icon: Truck, desc: "Channel partners" },
  { title: "Tenders", href: "/dashboard/crm/tenders", icon: Gavel, desc: "Government & institutional" },
  { title: "Customer Portal", href: "/dashboard/crm/portal", icon: Globe, desc: "Self-service" },
  { title: "Service Desk", href: "/dashboard/service-desk", icon: Headphones, desc: "Support tickets" },
  { title: "AI Intelligence", href: "/dashboard/crm/ai", icon: Brain, desc: "Health · churn · NBA" },
  { title: "Analytics", href: "/dashboard/crm/analytics", icon: BarChart3, desc: "CLV · funnel · targets" },
  { title: "Mobile CRM", href: "/dashboard/crm/mobile", icon: Smartphone, desc: "Field sales" },
];

interface Insight {
  id: string;
  title: string;
  recommendation: string;
  severity: string;
  insight_type: string;
}

export default function CrmHubPage() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    customers: 0,
    contacts: 0,
    openLeads: 0,
    openOpps: 0,
    pipelineValue: 0,
    weightedForecast: 0,
    activeContracts: 0,
    openTickets: 0,
    activeCampaigns: 0,
  });
  const [insights, setInsights] = useState<Insight[]>([]);

  useEffect(() => {
    async function load() {
      try {
        const s = await getCrmDashboardStats();
        setStats({
          customers: s.customers,
          contacts: s.contacts,
          openLeads: s.openLeads,
          openOpps: s.openOpps,
          pipelineValue: s.pipelineValue,
          weightedForecast: s.weightedForecast,
          activeContracts: s.activeContracts,
          openTickets: s.openTickets,
          activeCampaigns: s.activeCampaigns,
        });
        setInsights((s.insights as Insight[]) || []);
      } catch {
        /* tables may not be migrated yet */
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) return <LoadingState message="Loading Enterprise CRM…" />;

  return (
    <div>
      <PageHeader
        title="Enterprise CRM"
        description="Customer 360° · Sales · Marketing · Loyalty · Portal · AI — full lifecycle inside SecureTrack ERP"
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm">
              <Link href="/dashboard/crm/accounts">Accounts</Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href="/dashboard/crm/leads">New lead</Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href="/dashboard/crm/pipeline">Pipeline</Link>
            </Button>
          </div>
        }
      />

      <div className="rounded-lg border bg-gradient-to-r from-hope-navy to-hope-teal text-white p-4 mb-6">
        <p className="text-hope-gold text-xs font-semibold uppercase tracking-wide">
          Complete customer lifecycle
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

      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 mb-6">
        <StatCard title="Accounts" value={formatNumber(stats.customers)} icon={Building2} />
        <StatCard title="Contacts" value={formatNumber(stats.contacts)} icon={Users} />
        <StatCard title="Open leads" value={formatNumber(stats.openLeads)} icon={Target} />
        <StatCard title="Open opps" value={formatNumber(stats.openOpps)} icon={TrendingUp} />
        <StatCard
          title="Weighted forecast"
          value={formatNumber(Math.round(stats.weightedForecast))}
          icon={BarChart3}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4 mb-6">
        <StatCard title="Pipeline value" value={formatNumber(Math.round(stats.pipelineValue))} />
        <StatCard title="Active contracts" value={formatNumber(stats.activeContracts)} />
        <StatCard title="Open tickets" value={formatNumber(stats.openTickets)} />
        <StatCard title="Campaigns" value={formatNumber(stats.activeCampaigns)} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3 mb-6">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Brain className="h-4 w-4 text-hope-teal" />
              AI Customer Intelligence
            </CardTitle>
            <Button asChild size="sm" variant="ghost">
              <Link href="/dashboard/crm/ai">Open AI hub</Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {insights.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Insights appear as interactions, orders, and feedback accumulate. Apply migration 00044 for seed intelligence.
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
            <CardTitle className="text-base">ERP integrations</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-1.5">
            <p>Sales · Quotations · Orders · Invoicing</p>
            <p>Production · Packaging · Dispatch</p>
            <p>Finance · Credit · Commissions</p>
            <p>Service Desk · SecureChat · QR Auth</p>
            <p>Inventory · Documents · BI · Portal</p>
            <p className="text-xs pt-2 border-t">
              Multi-company RLS · Uganda DPA / GDPR consent · Full audit trail
            </p>
          </CardContent>
        </Card>
      </div>

      <h2 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wide">
        CRM modules
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
