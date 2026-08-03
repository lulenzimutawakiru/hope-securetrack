"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Headphones, Ticket, BookOpen, Layers, Database, AlertTriangle,
  GitBranch, MapPin, BarChart3, Wand2, ShoppingBag, Clock,
  ArrowRight, MessageSquare, Settings, LifeBuoy, PlusCircle,
  UserCog, Siren, CheckSquare, Smartphone, FolderTree, Inbox,
  Gauge, Cable, ShieldCheck, Settings2, ArrowUp, HeartPulse, Bot,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LoadingState } from "@/components/ui/loading-state";
import { StatCard } from "@/components/ui/stat-card";
import { createClient } from "@/lib/supabase/client";
import { formatNumber } from "@/lib/utils";
import { SERVICE_DESK_LIFECYCLE } from "@/lib/service-desk";

const MODULES = [
  { title: "Executive Command Center", href: "/dashboard/service-desk/executive", icon: Gauge, desc: "AI insights · SLA · backlog" },
  { title: "Escalation Center", href: "/dashboard/service-desk/escalations", icon: ArrowUp, desc: "SLA breach watch · manual escalate" },
  { title: "Integrations", href: "/dashboard/service-desk/integrations", icon: Cable, desc: "Identity · comms · monitoring · ERP" },
  { title: "Administration", href: "/dashboard/service-desk/admin", icon: Settings2, desc: "Calendars · holidays · SLA schedule" },
  { title: "Security & Audit", href: "/dashboard/service-desk/security", icon: ShieldCheck, desc: "Audit trail · permissions · retention" },
  { title: "Smart Create", href: "/dashboard/service-desk/create", icon: PlusCircle, desc: "AI form · QR · templates" },
  { title: "Tickets", href: "/dashboard/service-desk/tickets", icon: Ticket, desc: "Incidents · requests · lifecycle" },
  { title: "Agent Workspace", href: "/dashboard/service-desk/agent", icon: UserCog, desc: "Work logs · replies · resolve" },
  { title: "Major Incidents", href: "/dashboard/service-desk/major", icon: Siren, desc: "War room · exec notify" },
  { title: "Approvals", href: "/dashboard/service-desk/approvals", icon: CheckSquare, desc: "Multi-level · catalog" },
  { title: "Categories", href: "/dashboard/service-desk/categories", icon: FolderTree, desc: "Unlimited taxonomy" },
  { title: "Inbound Inbox", href: "/dashboard/service-desk/inbound", icon: Inbox, desc: "Email · IoT · WhatsApp" },
  { title: "Conversations", href: "/dashboard/service-desk/conversations", icon: Inbox, desc: "Omnichannel inbox · unified threads" },
  { title: "CX Intelligence", href: "/dashboard/service-desk/cx", icon: HeartPulse, desc: "NPS · sentiment · deflection" },
  { title: "Service Catalog", href: "/dashboard/service-desk/catalog", icon: ShoppingBag, desc: "Self-service marketplace" },
  { title: "Portal", href: "/dashboard/service-desk/portal", icon: LifeBuoy, desc: "Employee & customer portal" },
  { title: "Knowledge Base", href: "/dashboard/service-desk/knowledge", icon: BookOpen, desc: "Articles · FAQs · SOPs" },
  { title: "SLA & Escalation", href: "/dashboard/service-desk/sla", icon: Clock, desc: "Response · resolution · rules" },
  { title: "CMDB", href: "/dashboard/service-desk/cmdb", icon: Database, desc: "CIs · relationships · assets" },
  { title: "Problems", href: "/dashboard/service-desk/problems", icon: AlertTriangle, desc: "RCA · known errors" },
  { title: "Changes", href: "/dashboard/service-desk/changes", icon: GitBranch, desc: "CAB · standard · emergency" },
  { title: "Field Service", href: "/dashboard/service-desk/field", icon: MapPin, desc: "Technicians · GPS · sign-off" },
  { title: "Teams & Agents", href: "/dashboard/service-desk/teams", icon: Headphones, desc: "Routing · skills · capacity" },
  { title: "Automation", href: "/dashboard/service-desk/automation", icon: Settings, desc: "No-code workflow rules" },
  { title: "Channels", href: "/dashboard/service-desk/channels", icon: MessageSquare, desc: "Email · chat · WhatsApp" },
  { title: "AI Assistant", href: "/dashboard/service-desk/ai", icon: Wand2, desc: "Triage · KB · auto-route" },
  { title: "AI Virtual Agent", href: "/dashboard/service-desk/ai-agent", icon: Bot, desc: "Sentiment · intent · deflection" },
  { title: "Analytics", href: "/dashboard/service-desk/reports", icon: BarChart3, desc: "SLA · CSAT · volume" },
  { title: "CSAT", href: "/dashboard/service-desk/csat", icon: Layers, desc: "Satisfaction scores" },
  { title: "Mobile", href: "/dashboard/service-desk/mobile", icon: Smartphone, desc: "PWA · offline · field" },
];

export default function ServiceDeskHubPage() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    open: 0,
    total: 0,
    breached: 0,
    resolved: 0,
    articles: 0,
    catalog: 0,
    problems: 0,
    changes: 0,
    csat: 0,
  });
  const [recent, setRecent] = useState<Array<Record<string, unknown>>>([]);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const now = new Date().toISOString();
      const [
        total, open, resolved, breached, articles, catalog, problems, changes,
        { data: csatRows }, { data: recentTickets },
      ] = await Promise.all([
        supabase.from("support_tickets").select("*", { count: "exact", head: true }).is("deleted_at", null),
        supabase
          .from("support_tickets")
          .select("*", { count: "exact", head: true })
          .is("deleted_at", null)
          .not("status", "in", '("closed","resolved","archived")'),
        supabase
          .from("support_tickets")
          .select("*", { count: "exact", head: true })
          .in("status", ["resolved", "closed"]),
        supabase
          .from("support_tickets")
          .select("*", { count: "exact", head: true })
          .is("deleted_at", null)
          .lt("sla_resolve_due", now)
          .not("status", "in", '("closed","resolved","archived")'),
        supabase.from("sd_knowledge_articles").select("*", { count: "exact", head: true }).eq("status", "published"),
        supabase.from("sd_catalog_items").select("*", { count: "exact", head: true }).eq("is_active", true),
        supabase.from("sd_problems").select("*", { count: "exact", head: true }).neq("status", "closed"),
        supabase.from("sd_changes").select("*", { count: "exact", head: true }).not("status", "in", '("closed","implemented")'),
        supabase.from("sd_csat_responses").select("score").limit(200),
        supabase
          .from("support_tickets")
          .select("id,ticket_number,subject,status,priority,created_at")
          .is("deleted_at", null)
          .order("created_at", { ascending: false })
          .limit(8),
      ]);

      const scores = csatRows || [];
      const avgCsat =
        scores.length > 0
          ? scores.reduce((s, r) => s + Number(r.score || 0), 0) / scores.length
          : 0;

      setStats({
        open: open.count ?? 0,
        total: total.count ?? 0,
        breached: breached.count ?? 0,
        resolved: resolved.count ?? 0,
        articles: articles.count ?? 0,
        catalog: catalog.count ?? 0,
        problems: problems.count ?? 0,
        changes: changes.count ?? 0,
        csat: Math.round(avgCsat * 10) / 10,
      });
      setRecent((recentTickets as Array<Record<string, unknown>>) || []);
      setLoading(false);
    }
    load().catch(() => setLoading(false));
  }, []);

  if (loading) return <LoadingState message="Loading Enterprise Service Desk…" />;

  return (
    <div>
      <PageHeader
        title="Enterprise Ticketing & ITSM"
        description="Case management · multi-channel · AI triage · major incidents · field · QR assets · SLA"
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard/service-desk/executive"><Gauge className="h-4 w-4 mr-1" /> Command center</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard/service-desk/agent"><UserCog className="h-4 w-4 mr-1" /> Agent</Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/dashboard/service-desk/create"><PlusCircle className="h-4 w-4 mr-1" /> New ticket</Link>
            </Button>
          </div>
        }
      />

      <div className="mb-6 flex flex-wrap gap-1.5">
        {SERVICE_DESK_LIFECYCLE.map((s) => (
          <Badge key={s} variant="outline" className="text-[10px] font-normal">{s}</Badge>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5 mb-8">
        <StatCard title="Open tickets" value={String(stats.open)} icon={Ticket} />
        <StatCard title="Total tickets" value={String(stats.total)} icon={Headphones} />
        <StatCard title="SLA breached" value={String(stats.breached)} icon={Clock} />
        <StatCard title="Resolved" value={String(stats.resolved)} icon={Ticket} />
        <StatCard title="CSAT avg" value={stats.csat ? formatNumber(stats.csat) : "—"} icon={Layers} />
        <StatCard title="KB articles" value={String(stats.articles)} icon={BookOpen} />
        <StatCard title="Catalog items" value={String(stats.catalog)} icon={ShoppingBag} />
        <StatCard title="Open problems" value={String(stats.problems)} icon={AlertTriangle} />
        <StatCard title="Active changes" value={String(stats.changes)} icon={GitBranch} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3 mb-8">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2"><CardTitle className="text-base">ITSM modules</CardTitle></CardHeader>
          <CardContent>
            <div className="grid gap-2 sm:grid-cols-2">
              {MODULES.map((m) => (
                <Link
                  key={m.href}
                  href={m.href}
                  className="flex items-start gap-3 rounded-lg border p-3 hover:bg-muted/50 transition-colors"
                >
                  <div className="rounded-md bg-primary/10 p-2">
                    <m.icon className="h-4 w-4 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-sm">{m.title}</span>
                      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{m.desc}</p>
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Recent tickets</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {recent.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No tickets yet. Apply migration 00030 for seed data.
              </p>
            )}
            {recent.map((t) => (
              <Link
                key={String(t.id)}
                href="/dashboard/service-desk/tickets"
                className="block rounded-md border p-2.5 hover:bg-muted/40"
              >
                <div className="flex justify-between gap-2">
                  <span className="text-sm font-mono">{String(t.ticket_number)}</span>
                  <Badge variant="outline" className="text-[10px] capitalize">{String(t.status)}</Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5 truncate">{String(t.subject)}</p>
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
