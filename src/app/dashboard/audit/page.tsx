"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ScrollText, Activity, Search, ShieldAlert, Siren, Scale,
  GitBranch, Globe, Download, Printer, FileStack, Link2,
  ShieldCheck, Clock, Wand2, ArrowRight, Package, LayoutDashboard,
  Server, FileBarChart, Smartphone, Settings2, Archive, ClipboardList,
  Network,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LoadingState } from "@/components/ui/loading-state";
import { StatCard } from "@/components/ui/stat-card";
import { createClient } from "@/lib/supabase/client";
import { AUDIT_LIFECYCLE } from "@/lib/audit";

const MODULES = [
  { title: "Executive Dashboard", href: "/dashboard/audit/executive", icon: LayoutDashboard, desc: "Security & compliance scores" },
  { title: "IT Dashboard", href: "/dashboard/audit/it", icon: Server, desc: "Changes · logins · API · devices" },
  { title: "Event Trail", href: "/dashboard/audit/events", icon: Search, desc: "Full-text · filters · before/after" },
  { title: "Live Security", href: "/dashboard/audit/live", icon: Activity, desc: "Sessions · failed logins · risk" },
  { title: "Reports", href: "/dashboard/audit/reports", icon: FileBarChart, desc: "11 system audit reports" },
  { title: "Findings", href: "/dashboard/audit/findings", icon: ClipboardList, desc: "Outstanding control findings" },
  { title: "Alerts", href: "/dashboard/audit/alerts", icon: ShieldAlert, desc: "Real-time security alerts" },
  { title: "Incidents", href: "/dashboard/audit/incidents", icon: Siren, desc: "IR · Service Desk bridge" },
  { title: "AI Assistant", href: "/dashboard/audit/ai", icon: Wand2, desc: "Summarize · correlate · fraud" },
  { title: "Integrity Chain", href: "/dashboard/audit/integrity", icon: Link2, desc: "Hash verify · checkpoints" },
  { title: "Secure Archive", href: "/dashboard/audit/archive", icon: Archive, desc: "Seal · dual-control retrieve" },
  { title: "Approvals", href: "/dashboard/audit/approvals", icon: GitBranch, desc: "Multi-step approval trails" },
  { title: "Compliance", href: "/dashboard/audit/compliance", icon: Scale, desc: "ISO · SOC2 · GDPR · UG-DPA" },
  { title: "Audit Packages", href: "/dashboard/audit/packages", icon: Package, desc: "Evidence packs · export" },
  { title: "SIEM", href: "/dashboard/audit/siem", icon: Network, desc: "Splunk · Sentinel · QRadar · Elastic" },
  { title: "Configuration", href: "/dashboard/audit/config", icon: Settings2, desc: "Policies · roles · history" },
  { title: "API Audit", href: "/dashboard/audit/api", icon: Globe, desc: "Requests · tokens · rate limits" },
  { title: "Exports", href: "/dashboard/audit/exports", icon: Download, desc: "CSV · PDF · Excel monitoring" },
  { title: "Print Audit", href: "/dashboard/audit/print", icon: Printer, desc: "Who · what · copies · watermark" },
  { title: "File Audit", href: "/dashboard/audit/files", icon: FileStack, desc: "Upload · download · versions" },
  { title: "Sessions", href: "/dashboard/audit/sessions", icon: ShieldCheck, desc: "Active · MFA · terminate" },
  { title: "Retention", href: "/dashboard/audit/retention", icon: Clock, desc: "30d → permanent policies" },
  { title: "Mobile Center", href: "/dashboard/audit/mobile", icon: Smartphone, desc: "PWA · alerts · search · IR" },
  { title: "Legacy Logs", href: "/dashboard/audit/legacy", icon: ScrollText, desc: "Original audit_logs view" },
];

export default function AuditHubPage() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    events: 0,
    alerts: 0,
    incidents: 0,
    sessions: 0,
    highRisk: 0,
    frameworks: 0,
  });

  useEffect(() => {
    async function load() {
      const sb = createClient();
      const [events, alerts, incidents, sessions, highRisk, frameworks] = await Promise.all([
        sb.from("eal_events").select("*", { count: "exact", head: true }),
        sb.from("eal_alerts").select("*", { count: "exact", head: true }).eq("status", "open"),
        sb.from("eal_incidents").select("*", { count: "exact", head: true }).in("status", ["open", "investigating"]),
        sb.from("eal_sessions").select("*", { count: "exact", head: true }).eq("status", "active"),
        sb.from("eal_events").select("*", { count: "exact", head: true }).gte("risk_score", 70),
        sb.from("eal_frameworks").select("*", { count: "exact", head: true }).eq("is_active", true),
      ]);
      setStats({
        events: events.count ?? 0,
        alerts: alerts.count ?? 0,
        incidents: incidents.count ?? 0,
        sessions: sessions.count ?? 0,
        highRisk: highRisk.count ?? 0,
        frameworks: frameworks.count ?? 0,
      });
      setLoading(false);
    }
    load().catch(() => setLoading(false));
  }, []);

  if (loading) return <LoadingState message="Loading audit & compliance platform…" />;

  return (
    <div>
      <PageHeader
        title="Enterprise Audit & Compliance"
        description="Immutable trail · integrity chain · AI fraud · ISO/SOC2/GDPR · digital forensics"
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard/audit/executive">Executive</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard/audit/mobile">Mobile</Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/dashboard/audit/events">Search events</Link>
            </Button>
          </div>
        }
      />

      <div className="mb-6 flex flex-wrap gap-1.5">
        {AUDIT_LIFECYCLE.map((s) => (
          <Badge key={s} variant="outline" className="text-[10px] font-normal">{s}</Badge>
        ))}
      </div>

      <Card className="mb-6 border-primary/20 bg-gradient-to-r from-primary/5 to-transparent">
        <CardContent className="pt-4 text-sm">
          <strong>Append-only & tamper-evident:</strong> every ERP action is hash-chained,
          user-attributed, and searchable. Records cannot be edited or deleted.
          Alerts feed Incident Response and Service Desk automatically.
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mb-8">
        <StatCard title="Audit events" value={String(stats.events)} icon={ScrollText} />
        <StatCard title="Open alerts" value={String(stats.alerts)} icon={ShieldAlert} />
        <StatCard title="Open incidents" value={String(stats.incidents)} icon={Siren} />
        <StatCard title="Active sessions" value={String(stats.sessions)} icon={Activity} />
        <StatCard title="High-risk events" value={String(stats.highRisk)} icon={ShieldAlert} />
        <StatCard title="Frameworks" value={String(stats.frameworks)} icon={Scale} />
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {MODULES.map((m) => (
          <Link
            key={m.href}
            href={m.href}
            className="group flex items-center gap-3 rounded-lg border p-4 hover:border-primary/40 hover:bg-muted/40 transition"
          >
            <div className="rounded-md bg-primary/10 p-2">
              <m.icon className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-medium text-sm group-hover:text-primary">{m.title}</p>
              <p className="text-xs text-muted-foreground truncate">{m.desc}</p>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100" />
          </Link>
        ))}
      </div>
    </div>
  );
}
