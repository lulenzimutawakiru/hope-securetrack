"use client";

import { useEffect, useState } from "react";
import {
  HeartPulse, ThumbsUp, Bot, Star, Plus, Sparkles, Smile, Frown, Angry,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingState } from "@/components/ui/loading-state";
import { EmptyState } from "@/components/ui/empty-state";
import { StatCard } from "@/components/ui/stat-card";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/hooks/use-user";
import { formatNumber } from "@/lib/utils";
import { toast } from "sonner";
import { cxIntelligence, recordNps } from "@/lib/service-desk";
import type { Insight } from "@/lib/service-desk";

const SEVERITY_VARIANT: Record<
  string,
  "default" | "secondary" | "destructive" | "outline" | "success" | "warning"
> = {
  critical: "destructive",
  warning: "warning",
  info: "outline",
  success: "success",
};

const SENTIMENT_META = [
  { key: "positive", label: "Positive", icon: Smile },
  { key: "neutral", label: "Neutral", icon: Star },
  { key: "negative", label: "Negative", icon: Frown },
  { key: "frustrated", label: "Frustrated", icon: Angry },
] as const;

export default function CxIntelligencePage() {
  const { auth } = useUser();
  const [cx, setCx] = useState<ReturnType<typeof cxIntelligence> | null>(null);
  const [tickets, setTickets] = useState<
    Array<{ id: string; ticket_number: string; subject: string | null }>
  >([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    ticket_id: "",
    score: "9",
    respondent_name: "",
    comment: "",
  });

  const companyId = auth?.profile?.company_id as string | undefined;

  const load = async () => {
    const supabase = createClient();
    const [csatRes, npsRes, msgRes, aiRes, tickRes] = await Promise.all([
      supabase.from("sd_csat_responses").select("id,ticket_id,score,comment,created_at").limit(300),
      supabase.from("sd_nps_responses").select("id,ticket_id,score,comment,respondent_name,created_at").limit(300),
      supabase.from("sd_messages").select("id,ticket_id,body,created_at").limit(400),
      supabase.from("sd_ai_sessions").select("id,outcome,user_message,created_at").is("deleted_at", null).limit(300),
      supabase.from("support_tickets").select("id,ticket_number,subject,requester_name,status").limit(300),
    ]);

    const csat = (csatRes.data as Array<Record<string, unknown>>) || [];
    const nps = (npsRes.data as Array<Record<string, unknown>>) || [];
    const messages = (msgRes.data as Array<Record<string, unknown>>) || [];
    const aiSessions = (aiRes.data as Array<Record<string, unknown>>) || [];
    const allTickets = (tickRes.data as Array<Record<string, unknown>>) || [];

    setCx(
      cxIntelligence({ csat, nps, messages, aiSessions, tickets: allTickets })
    );
    setTickets(
      allTickets
        .filter((t) =>
          ["resolved", "closed", "customer_confirmation"].includes(String(t.status || ""))
        )
        .map((t) => ({
          id: String(t.id),
          ticket_number: String(t.ticket_number || t.id),
          subject: (t.subject as string | null) || null,
        }))
    );
    setLoading(false);
  };

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId) return;
    try {
      await recordNps({
        company_id: companyId,
        ticket_id: form.ticket_id || null,
        score: Number(form.score),
        comment: form.comment || null,
        respondent_name: form.respondent_name || null,
      });
      toast.success("NPS response recorded");
      setOpen(false);
      setForm({ ticket_id: "", score: "9", respondent_name: "", comment: "" });
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  };

  if (loading) return <LoadingState message="Loading CX intelligence…" />;
  if (!cx) return <EmptyState icon={HeartPulse} title="No CX data" description="CSAT, NPS and conversation data will appear here." />;

  const sentimentTotal = Object.values(cx.sentimentMix).reduce((s, n) => s + n, 0);

  return (
    <div>
      <PageHeader
        title="Customer Experience Intelligence"
        description="Voice of customer · NPS · sentiment · AI deflection · follow-up watch"
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Record NPS</Button>
            </DialogTrigger>
            <DialogContent>
              <form onSubmit={submit}>
                <DialogHeader><DialogTitle>NPS response (0—10)</DialogTitle></DialogHeader>
                <div className="grid gap-3 py-3">
                  <div>
                    <Label>Ticket (optional)</Label>
                    <Select value={form.ticket_id} onValueChange={(v) => setForm((f) => ({ ...f, ticket_id: v }))}>
                      <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>
                        {tickets.map((t) => (
                          <SelectItem key={t.id} value={t.id}>{t.ticket_number}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Score (0—10)</Label>
                    <Select value={form.score} onValueChange={(v) => setForm((f) => ({ ...f, score: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                          <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Respondent name</Label>
                    <Input
                      value={form.respondent_name}
                      onChange={(e) => setForm((f) => ({ ...f, respondent_name: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label>Comment</Label>
                    <Input
                      value={form.comment}
                      onChange={(e) => setForm((f) => ({ ...f, comment: e.target.value }))}
                    />
                  </div>
                </div>
                <DialogFooter><Button type="submit">Save</Button></DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 mb-6">
        <StatCard
          title="Average CSAT"
          value={cx.csatAverage !== null ? formatNumber(cx.csatAverage) : "—"}
          description={`${cx.csatCount} response${cx.csatCount === 1 ? "" : "s"}`}
          icon={Star}
        />
        <StatCard
          title="NPS score"
          value={cx.npsScore !== null ? String(cx.npsScore) : "—"}
          description={`${cx.promoters} promoters / ${cx.passives} passive / ${cx.detractors} detractors`}
          icon={ThumbsUp}
        />
        <StatCard
          title="AI deflection"
          value={cx.deflectionRate !== null ? `${cx.deflectionRate}%` : "—"}
          description={`${cx.aiResolved} resolved by AI / ${cx.aiTicketCreated} tickets created`}
          icon={Bot}
        />
        <StatCard
          title="Conversation sentiment"
          value={String(sentimentTotal)}
          description="Analyzed from customer messages"
          icon={HeartPulse}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="h-4 w-4" /> AI insights
            </CardTitle>
          </CardHeader>
          <CardContent>
            {cx.insights.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No signals yet. Insights appear when low CSAT, NPS detractors, negative sentiment or deflection gaps are detected.
              </p>
            ) : (
              <div className="space-y-2">
                {cx.insights.map((insight: Insight) => (
                  <div key={insight.id} className="rounded-md border p-3 text-sm">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant={SEVERITY_VARIANT[insight.severity] || "outline"}>
                        {insight.severity}
                      </Badge>
                      <span className="font-medium">{insight.title}</span>
                    </div>
                    <p className="text-muted-foreground text-xs">{insight.description}</p>
                    {insight.action && (
                      <p className="text-xs mt-1 text-hope-teal">Action: {insight.action}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <HeartPulse className="h-4 w-4" /> Sentiment mix
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {SENTIMENT_META.map((s) => {
                const count = cx.sentimentMix[s.key];
                const pct = sentimentTotal > 0 ? Math.round((count / sentimentTotal) * 100) : 0;
                return (
                  <div key={s.key} className="flex items-center gap-3">
                    <s.icon className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm w-24">{s.label}</span>
                    <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-hope-teal"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground w-16 text-right">
                      {count} ({pct}%)
                    </span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Follow-up watchlist</CardTitle>
        </CardHeader>
        <CardContent>
          {cx.needsFollowUp.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No customers need follow-up right now.
            </p>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ticket</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead>Requester</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Risk</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cx.needsFollowUp.map((f) => (
                    <TableRow key={f.ticketId}>
                      <TableCell className="font-mono text-xs">{f.ticketNumber}</TableCell>
                      <TableCell className="text-sm">{f.subject}</TableCell>
                      <TableCell className="text-sm">{f.requester || "—"}</TableCell>
                      <TableCell className="text-xs">{f.reason}</TableCell>
                      <TableCell>
                        <Badge variant={f.score <= 2 ? "destructive" : "warning"} className="text-[10px]">
                          {f.score <= 2 ? "High" : "Medium"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}