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
  ArrowRight,
  Target,
  ShoppingCart,
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

const LIFECYCLE = [
  "Lead",
  "Qualify",
  "Opportunity",
  "Quotation",
  "Order",
  "Delivery",
  "Invoice",
  "Support",
  "Loyalty",
];

const MODULES = [
  { title: "Accounts 360°", href: "/dashboard/crm/accounts", icon: Building2, desc: "Full customer profiles" },
  { title: "Activities", href: "/dashboard/crm/activities", icon: Calendar, desc: "Calls, visits, follow-ups" },
  { title: "Contracts", href: "/dashboard/crm/contracts", icon: FileText, desc: "Agreements & renewals" },
  { title: "Service Desk", href: "/dashboard/crm/service", icon: Headphones, desc: "Tickets & complaints" },
  { title: "Loyalty", href: "/dashboard/crm/loyalty", icon: Heart, desc: "Points & tiers" },
  { title: "Campaigns", href: "/dashboard/crm/campaigns", icon: Megaphone, desc: "Marketing automation" },
  { title: "Sales Pipeline", href: "/dashboard/sales/pipeline", icon: Target, desc: "Leads & opportunities" },
  { title: "Sales Orders", href: "/dashboard/sales/orders", icon: ShoppingCart, desc: "Quote-to-cash" },
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
    activitiesToday: 0,
    openTickets: 0,
    activeContracts: 0,
    openLeads: 0,
  });
  const [insights, setInsights] = useState<Insight[]>([]);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const today = new Date().toISOString().slice(0, 10);
      const [
        cust,
        contacts,
        acts,
        tickets,
        contracts,
        leads,
        { data: ins },
      ] = await Promise.all([
        supabase.from("customers").select("*", { count: "exact", head: true }),
        supabase.from("crm_contacts").select("*", { count: "exact", head: true }),
        supabase
          .from("crm_activities")
          .select("*", { count: "exact", head: true })
          .gte("scheduled_at", `${today}T00:00:00`)
          .lte("scheduled_at", `${today}T23:59:59`),
        supabase
          .from("support_tickets")
          .select("*", { count: "exact", head: true })
          .in("status", ["open", "assigned", "in_progress"]),
        supabase
          .from("crm_contracts")
          .select("*", { count: "exact", head: true })
          .eq("status", "active"),
        supabase
          .from("sales_leads")
          .select("*", { count: "exact", head: true })
          .in("status", ["new", "contacted", "qualified"]),
        supabase
          .from("crm_insights")
          .select("*")
          .eq("status", "open")
          .order("created_at", { ascending: false })
          .limit(5),
      ]);

      setStats({
        customers: cust.count ?? 0,
        contacts: contacts.count ?? 0,
        activitiesToday: acts.count ?? 0,
        openTickets: tickets.count ?? 0,
        activeContracts: contracts.count ?? 0,
        openLeads: leads.count ?? 0,
      });
      setInsights((ins as Insight[]) ?? []);
      setLoading(false);
    }
    load();
  }, []);

  if (loading) return <LoadingState message="Loading CRM…" />;

  return (
    <div>
      <PageHeader
        title="Enterprise CRM"
        description="Hope Design Group Ltd — 360° customer lifecycle · B2B · Government · Export · Distributors"
        actions={
          <div className="flex gap-2">
            <Link href="/dashboard/crm/accounts">
              <Button>Accounts</Button>
            </Link>
            <Link href="/dashboard/crm/activities">
              <Button variant="outline">Log activity</Button>
            </Link>
          </div>
        }
      />

      <div className="rounded-lg border bg-gradient-to-r from-hope-navy to-hope-teal text-white p-4 mb-6">
        <p className="text-hope-gold text-xs font-semibold uppercase tracking-wide">
          CRM lifecycle
        </p>
        <div className="flex flex-wrap gap-1.5 mt-2">
          {LIFECYCLE.map((s, i) => (
            <span
              key={s}
              className="text-[10px] sm:text-xs bg-white/10 border border-white/15 rounded-full px-2 py-0.5"
            >
              {i + 1}. {s}
            </span>
          ))}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6 mb-6">
        <StatCard title="Accounts" value={formatNumber(stats.customers)} icon={Building2} />
        <StatCard title="Contacts" value={formatNumber(stats.contacts)} icon={Users} />
        <StatCard title="Today's activities" value={formatNumber(stats.activitiesToday)} />
        <StatCard title="Open leads" value={formatNumber(stats.openLeads)} />
        <StatCard title="Active contracts" value={formatNumber(stats.activeContracts)} />
        <StatCard title="Open tickets" value={formatNumber(stats.openTickets)} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3 mb-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Brain className="h-4 w-4 text-hope-teal" />
              AI Customer Intelligence
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {insights.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Insights appear as interactions and sales history grow.
              </p>
            ) : (
              insights.map((i) => (
                <div key={i.id} className="rounded-lg border p-3">
                  <div className="flex justify-between gap-2">
                    <p className="font-medium text-sm">{i.title}</p>
                    <StatusBadge status={i.severity} />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {i.recommendation}
                  </p>
                  <Badge variant="secondary" className="text-[10px] mt-2 capitalize">
                    {i.insight_type.replace(/_/g, " ")}
                  </Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Segments</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-1">
            <p>Corporate · Government · Education · NGO</p>
            <p>Dealers · Distributors · Export · Strategic</p>
            <p className="text-xs pt-2 border-t">
              Integrated with Sales, Finance, Manufacturing, Inventory, Service,
              and SecureTrack product verification.
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {MODULES.map((m) => {
          const Icon = m.icon;
          return (
            <Link
              key={m.href}
              href={m.href}
              className="group rounded-xl border p-4 hover:border-hope-teal/40 hover:bg-muted/40 transition-colors"
            >
              <div className="flex justify-between mb-2">
                <Icon className="h-5 w-5 text-hope-teal" />
                <ArrowRight className="h-4 w-4 opacity-0 group-hover:opacity-100 text-muted-foreground" />
              </div>
              <p className="font-semibold text-sm">{m.title}</p>
              <p className="text-xs text-muted-foreground mt-1">{m.desc}</p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
