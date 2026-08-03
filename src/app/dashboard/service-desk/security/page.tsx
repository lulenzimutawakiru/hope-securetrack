"use client";

import { useEffect, useState } from "react";
import {
  Activity, AlertTriangle, CheckCircle2, Eye, FileText, Fingerprint,
  KeyRound, Lock, ShieldAlert, ShieldCheck, UserCheck, XCircle,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LoadingState } from "@/components/ui/loading-state";
import { EmptyState } from "@/components/ui/empty-state";
import { StatCard } from "@/components/ui/stat-card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/hooks/use-user";
import { formatDateTime } from "@/lib/utils";
import { verifyIntegrityChain } from "@/lib/audit/service";

const SEVERITY_STYLES: Record<string, string> = {
  critical: "bg-red-500/10 text-red-600 border-red-200",
  high: "bg-orange-500/10 text-orange-600 border-orange-200",
  medium: "bg-amber-500/10 text-amber-600 border-amber-200",
  low: "bg-blue-500/10 text-blue-600 border-blue-200",
  info: "bg-slate-500/10 text-slate-600 border-slate-200",
};

const SD_PERMISSIONS = [
  { slug: "sd.view", label: "View Service Desk", icon: Eye, desc: "View tickets and service desk" },
  { slug: "sd.manage", label: "Manage Service Desk", icon: Activity, desc: "Manage tickets and configuration" },
  { slug: "sd.agent", label: "Agent Workspace", icon: UserCheck, desc: "Work tickets as agent" },
  { slug: "sd.admin", label: "Administration", icon: ShieldCheck, desc: "SLA, catalog, CMDB admin" },
  { slug: "sd.knowledge", label: "Knowledge Base", icon: FileText, desc: "Manage knowledge base" },
  { slug: "sd.change", label: "Change Management", icon: KeyRound, desc: "Approve IT changes" },
  { slug: "sd.ai", label: "AI Assistant", icon: Fingerprint, desc: "AI triage and assistant" },
  { slug: "sd.portal", label: "Service Portal", icon: Lock, desc: "Self-service portal" },
  { slug: "sd.approve", label: "Ticket Approver", icon: UserCheck, desc: "Approve ticket-driven requests" },
  { slug: "sd.major", label: "Major Incidents", icon: AlertTriangle, desc: "Major incident war room" },
  { slug: "sd.field", label: "Field Service", icon: Activity, desc: "Field service mobile ops" },
];

const CONTROLS = [
  { title: "Row Level Security", detail: "All service desk tables enforce tenant_company_access via RLS - never disabled.", icon: ShieldCheck },
  { title: "Tamper-evident audit chain", detail: "Every event is hashed into a company-scoped integrity chain with prev-hash links.", icon: Lock },
  { title: "Tenant isolation", detail: "tenant_id / company_id derived from the authenticated session, never from client input.", icon: KeyRound },
  { title: "RBAC permissions", detail: "Eleven service desk permission slugs gate view, manage, agent and admin actions.", icon: UserCheck },
];

interface IntegrityResult {
  valid: boolean;
  message: string;
  eventsChecked: number;
}

export default function SecurityPage() {
  const { auth, hasPermission } = useUser();
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<Array<Record<string, unknown>>>([]);
  const [count, setCount] = useState(0);
  const [highCount, setHighCount] = useState(0);
  const [integrity, setIntegrity] = useState<IntegrityResult | null>(null);
  const [checking, setChecking] = useState(false);

  const companyId = auth?.profile?.company_id as string | undefined;
  const granted = SD_PERMISSIONS.filter((p) => hasPermission(p.slug)).length;
  const isAdmin = hasPermission("sd.admin");

  const load = async () => {
    const supabase = createClient();
    const [{ data: eventsData }, { count: total }, { count: severe }] = await Promise.all([
      supabase
        .from("eal_events")
        .select(
          "audit_id,event_id,user_email,full_name,module,entity_type,entity_id,action,crud_op,severity,title,details,changed_fields,risk_score,ip_address,created_at"
        )
        .or("module.eq.sd,entity_type.like.sd/%")
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("eal_events")
        .select("*", { count: "exact", head: true })
        .eq("module", "sd"),
      supabase
        .from("eal_events")
        .select("*", { count: "exact", head: true })
        .eq("module", "sd")
        .in("severity", ["high", "critical"]),
    ]);
    setEvents((eventsData as Array<Record<string, unknown>>) || []);
    setCount(total ?? 0);
    setHighCount(severe ?? 0);
    setLoading(false);
  };

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, []);

  const runIntegrityCheck = async () => {
    if (!companyId) return;
    setChecking(true);
    try {
      const result = await verifyIntegrityChain(companyId, 500);
      setIntegrity({
        valid: Boolean(result.valid),
        message: result.message,
        eventsChecked: Number(result.events_checked || 0),
      });
    } catch {
      setIntegrity({ valid: false, message: "Integrity check failed", eventsChecked: 0 });
    } finally {
      setChecking(false);
    }
  };

  if (loading) return <LoadingState message="Loading security and audit trail..." />;

  return (
    <div>
      <PageHeader
        title="Security & Audit"
        description="Audit trail | permissions | integrity | retention"
        actions={
          <Button size="sm" variant="outline" onClick={runIntegrityCheck} disabled={checking || !companyId}>
            <Lock className="h-4 w-4 mr-1" />
            {checking ? "Checking..." : "Run integrity check"}
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        <StatCard title="SD audit events" value={String(count)} icon={FileText} description="Tamper-evident EAL chain" />
        <StatCard title="High / critical" value={String(highCount)} icon={ShieldAlert} description="Security-relevant severity" trend={highCount > 0 ? "ACTION" : undefined} />
        <StatCard
          title="Integrity chain"
          value={integrity ? (integrity.valid ? "VERIFIED" : "BROKEN") : "UNCHECKED"}
          icon={integrity?.valid ? CheckCircle2 : XCircle}
          description={integrity ? `${integrity.eventsChecked} events checked` : "Run a check to verify"}
        />
        <StatCard title="Permissions granted" value={`${granted}/${SD_PERMISSIONS.length}`} icon={UserCheck} description="SD permission slugs" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3 mb-8">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center justify-between">
              <span>Audit trail</span>
              <Badge variant="outline" className="text-[10px] font-normal">{count} total</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {events.length === 0 ? (
              <EmptyState
                icon={ShieldCheck}
                title="No service desk audit events yet"
                description="CRUD operations, approvals, escalations and security events will appear here."
              />
            ) : (
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Event</TableHead>
                      <TableHead>Severity</TableHead>
                      <TableHead>Actor</TableHead>
                      <TableHead>Entity</TableHead>
                      <TableHead>Op</TableHead>
                      <TableHead>IP</TableHead>
                      <TableHead>When</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {events.map((ev) => {
                      const sev = String(ev.severity || "info");
                      return (
                        <TableRow key={String(ev.audit_id || ev.event_id)}>
                          <TableCell className="max-w-[260px]">
                            <div className="font-mono text-xs">{String(ev.audit_id)}</div>
                            <div className="text-xs truncate">{String(ev.title || ev.action || ev.event_id)}</div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={SEVERITY_STYLES[sev] ?? SEVERITY_STYLES.info}>
                              {sev}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs">
                            <div>{String(ev.full_name || ev.user_email || "-")}</div>
                          </TableCell>
                          <TableCell className="text-xs">
                            <div className="text-muted-foreground">{String(ev.entity_type || "-")}</div>
                            {ev.entity_id ? (
                              <div className="font-mono text-[10px] text-muted-foreground">
                                {String(ev.entity_id).slice(0, 8)}
                              </div>
                            ) : null}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-[10px]">{String(ev.crud_op || "-")}</Badge>
                          </TableCell>
                          <TableCell className="text-xs font-mono">{String(ev.ip_address || "-")}</TableCell>
                          <TableCell className="text-xs whitespace-nowrap text-muted-foreground">
                            {ev.created_at ? formatDateTime(String(ev.created_at)) : "-"}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Permissions</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {SD_PERMISSIONS.map((p) => {
                const grantedFlag = hasPermission(p.slug);
                const Icon = p.icon;
                return (
                  <div key={p.slug} className="flex items-center gap-3 rounded-md border p-2.5">
                    <div className="rounded-md bg-muted p-1.5">
                      <Icon className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium">{p.label}</div>
                      <div className="text-[11px] text-muted-foreground">{p.desc}</div>
                    </div>
                    {grantedFlag ? (
                      <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-200 text-[10px]">GRANTED</Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] text-muted-foreground">DENIED</Badge>
                    )}
                  </div>
                );
              })}
              {isAdmin && (
                <p className="text-[11px] text-muted-foreground pt-1">
                  You hold sd.admin - full service desk administration scope.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Security controls</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {CONTROLS.map((c) => (
                <div key={c.title} className="flex items-start gap-3 rounded-md border p-2.5">
                  <c.icon className="h-4 w-4 text-hope-teal mt-0.5 shrink-0" />
                  <div>
                    <div className="text-sm font-medium">{c.title}</div>
                    <div className="text-[11px] text-muted-foreground">{c.detail}</div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}