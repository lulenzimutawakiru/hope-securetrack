"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, ArrowUp, Clock, Siren } from "lucide-react";
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
import { createClient } from "@/lib/supabase/crud-compat";
import { useUser } from "@/hooks/use-user";
import { toast } from "sonner";
import { detectSlaBreachRisks, logTicketEvent, type SlaBreachRisk } from "@/lib/service-desk";

const RISK_STYLES: Record<string, string> = {
  high: "bg-red-500/10 text-red-600 border-red-200",
  medium: "bg-amber-500/10 text-amber-600 border-amber-200",
  low: "bg-emerald-500/10 text-emerald-600 border-emerald-200",
};

export default function EscalationsPage() {
  const { auth } = useUser();
  const [loading, setLoading] = useState(true);
  const [risks, setRisks] = useState<SlaBreachRisk[]>([]);
  const [rules, setRules] = useState<Array<Record<string, unknown>>>([]);
  const [events, setEvents] = useState<Array<Record<string, unknown>>>([]);
  const [escalating, setEscalating] = useState<string | null>(null);

  const companyId = auth?.profile?.company_id as string | undefined;

  const load = async () => {
    const supabase = createClient();
    const [{ data: tickets }, { data: rulesData }, { data: eventsData }] = await Promise.all([
      supabase
        .from("support_tickets")
        .select("id,ticket_number,subject,priority,status,assigned_to,sla_resolve_due,sla_resolve_met")
        .is("deleted_at", null)
        .not("status", "in", '("closed","resolved","archived")')
        .order("created_at", { ascending: false })
        .limit(500),
      supabase.from("sd_escalation_rules").select("*").order("escalate_to_level"),
      supabase
        .from("sd_ticket_events")
        .select("id,event_type,message,new_value,created_at,ticket_id,actor_name")
        .eq("event_type", "escalate")
        .order("created_at", { ascending: false })
        .limit(20),
    ]);
    setRisks(detectSlaBreachRisks((tickets as Array<Record<string, unknown>>) || []));
    setRules((rulesData as Array<Record<string, unknown>>) || []);
    setEvents((eventsData as Array<Record<string, unknown>>) || []);
    setLoading(false);
  };

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, []);

  const escalate = async (risk: SlaBreachRisk) => {
    if (!companyId) return;
    setEscalating(risk.ticketId);
    try {
      await logTicketEvent({
        company_id: companyId,
        ticket_id: risk.ticketId,
        event_type: "escalate",
        message: `Manual escalation: ${risk.message} (${risk.priority} priority)`,
        new_value: "supervisor",
        actor_id: auth?.user?.id ?? null,
        actor_name: auth?.profile?.first_name
          ? `${auth.profile.first_name} ${auth.profile.last_name}`.trim()
          : (auth?.profile?.email ?? "Agent"),
        is_public: false,
      });
      toast.success("Ticket escalated to supervisor");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Escalation failed");
    } finally {
      setEscalating(null);
    }
  };

  if (loading) return <LoadingState message="Loading escalation center..." />;

  const breached = risks.filter((r) => r.risk === "high");
  const medium = risks.filter((r) => r.risk === "medium");

  return (
    <div>
      <PageHeader
        title="Escalation Center"
        description="SLA breach watch · escalation ladder · manual escalate · audit trail"
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        <StatCard title="At risk tickets" value={String(risks.length)} icon={Clock} description="Medium + high risk" />
        <StatCard title="Breached / imminent" value={String(breached.length)} icon={AlertTriangle} />
        <StatCard title="Near deadline" value={String(medium.length)} icon={Clock} />
        <StatCard title="Escalation rules" value={String(rules.length)} icon={Siren} />
      </div>

      <Card className="mb-6">
        <CardHeader className="pb-2"><CardTitle className="text-base">SLA breach watch</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ticket</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Risk</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {risks.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6}>
                    <EmptyState title="No SLA risks" description="All active tickets are comfortably within their resolve window." />
                  </TableCell>
                </TableRow>
              )}
              {risks.map((r) => (
                <TableRow key={r.ticketId}>
                  <TableCell className="font-mono text-xs">{r.ticketNumber}</TableCell>
                  <TableCell className="max-w-[280px] truncate text-sm">{r.subject}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize text-[10px]">{r.priority}</Badge>
                  </TableCell>
                  <TableCell>
                    <span className={`rounded-md border px-2 py-0.5 text-[10px] font-medium uppercase ${RISK_STYLES[r.risk]}`}>
                      {r.risk}
                    </span>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{r.message}</p>
                  </TableCell>
                  <TableCell className="capitalize text-sm">open</TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={escalating === r.ticketId}
                      onClick={() => escalate(r)}
                    >
                      <ArrowUp className="h-3.5 w-3.5 mr-1" />
                      Escalate
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Escalation ladder</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="text-sm space-y-2">
              {["L1 Agent", "Team Leader", "IT Manager", "Director", "Executive"].map((l, i) => (
                <div key={l} className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium">{i + 1}</div>
                  <span>{l}</span>
                  {i < 4 && <span className="text-muted-foreground text-xs">{"\u2193"}</span>}
                </div>
              ))}
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Rule</TableHead>
                  <TableHead>Trigger</TableHead>
                  <TableHead>Level</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rules.length === 0 && (
                  <TableRow><TableCell colSpan={3} className="text-sm text-muted-foreground">No escalation rules configured.</TableCell></TableRow>
                )}
                {rules.map((r) => (
                  <TableRow key={String(r.id)}>
                    <TableCell className="text-sm">{String(r.name)}</TableCell>
                    <TableCell className="text-xs capitalize">{String(r.trigger_type).replace(/_/g, " ")}</TableCell>
                    <TableCell>L{String(r.escalate_to_level)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Escalation audit trail</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {events.length === 0 && (
              <EmptyState title="No escalations yet" description="Escalated tickets appear here with full audit context." />
            )}
            {events.map((e) => (
              <div key={String(e.id)} className="rounded-md border p-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium">{String(e.actor_name || "System")}</span>
                  <Badge variant="outline" className="text-[10px]">L{String(e.new_value) || "1"}</Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-1">{String(e.message)}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{new Date(String(e.created_at)).toLocaleString()}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}