"use client";

import { useEffect, useState } from "react";
import { Bot, Sparkles, Send, HeartPulse, Radar } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { LoadingState } from "@/components/ui/loading-state";
import { EmptyState } from "@/components/ui/empty-state";
import { createClient } from "@/lib/supabase/crud-compat";
import { useUser } from "@/hooks/use-user";
import { formatDateTime } from "@/lib/utils";
import { toast } from "sonner";
import { virtualAgentRun } from "@/lib/service-desk";
import type { SentimentResult, IntentResult } from "@/lib/service-desk";

const CHANNELS = ["web", "email", "whatsapp", "chat", "phone", "teams", "slack", "mobile"];

const SENTIMENT_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline" | "success" | "warning"> = {
  positive: "success",
  neutral: "secondary",
  negative: "warning",
  frustrated: "destructive",
};

const INTENT_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline" | "success" | "warning"> = {
  report_incident: "destructive",
  request_fulfillment: "default",
  complaint: "warning",
  escalation_request: "destructive",
  question: "secondary",
  acknowledgement: "success",
  greeting: "outline",
};

export default function AiVirtualAgentPage() {
  const { auth } = useUser();
  const [text, setText] = useState(
    "This is the third time my laptop will not connect to WiFi. I am really frustrated!"
  );
  const [channel, setChannel] = useState("chat");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Awaited<ReturnType<typeof virtualAgentRun>> | null>(null);
  const [sessions, setSessions] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);

  const companyId = auth?.profile?.company_id as string | undefined;

  const loadSessions = async () => {
    const { data } = await createClient()
      .from("sd_ai_sessions")
      .select("id,user_message,intent,sentiment,sentiment_score,urgency,outcome,ticket_number,matched_article_title,assistant_reply,created_at")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(20);
    setSessions((data as Array<Record<string, unknown>>) || []);
    setLoading(false);
  };

  useEffect(() => {
    loadSessions().catch(() => setLoading(false));
  }, []);

  const run = async () => {
    if (!companyId || !text.trim()) return;
    setBusy(true);
    try {
      const r = await virtualAgentRun({
        company_id: companyId,
        user_message: text.trim(),
        channel,
        created_by: auth?.user?.id,
        requester_name: auth?.profile
          ? `${auth.profile.first_name} ${auth.profile.last_name}`.trim()
          : null,
      });
      setResult(r);
      toast.success(r.outcome === "ticket_created" ? `Ticket ${r.ticketNumber} created` : "Resolved by AI");
      await loadSessions();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <LoadingState message="Loading AI sessions…" />;

  return (
    <div>
      <PageHeader
        title="AI Virtual Agent"
        description="Sentiment · intent · deflection · predicted CSAT · session transcript"
      />

      <div className="grid gap-4 lg:grid-cols-2 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Bot className="h-4 w-4" /> Customer message
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label>Message</Label>
              <textarea
                className="flex min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={text}
                onChange={(e) => setText(e.target.value)}
              />
            </div>
            <div>
              <Label>Channel</Label>
              <Select value={channel} onValueChange={setChannel}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CHANNELS.map((c) => (
                    <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={run} disabled={busy || !text.trim()}>
              <Send className="h-4 w-4 mr-1" /> {busy ? "Analyzing…" : "Run virtual agent"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="h-4 w-4" /> Agent decision
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!result ? (
              <p className="text-sm text-muted-foreground">
                The virtual agent classifies intent, reads sentiment, predicts CSAT risk and decides whether to resolve or create a ticket.
              </p>
            ) : (
              <div className="space-y-3 text-sm">
                <div className="flex flex-wrap gap-1.5">
                  <Badge variant={SENTIMENT_VARIANT[result.sentiment.label] || "outline"}>
                    Sentiment: {result.sentiment.label} ({result.sentiment.score.toFixed(2)})
                  </Badge>
                  <Badge variant={INTENT_VARIANT[result.intent.intent] || "outline"}>
                    Intent: {result.intent.intent}
                  </Badge>
                  <Badge variant="outline">Urgency: {result.intent.urgencyLevel}</Badge>
                  <Badge variant={result.outcome === "resolved_ai" ? "success" : "default"}>
                    {result.outcome === "resolved_ai" ? "Resolved by AI" : "Ticket created"}
                  </Badge>
                </div>

                {result.ticketNumber && (
                  <p className="text-xs">
                    Ticket <span className="font-mono">{result.ticketNumber}</span> created with priority {result.analysis.suggestedPriority}.
                  </p>
                )}

                <div className="rounded-md border p-2">
                  <div className="font-medium text-xs mb-1">Suggested reply</div>
                  <p className="text-xs text-muted-foreground">{result.reply}</p>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-md border p-2">
                    <div className="text-xs text-muted-foreground flex items-center gap-1">
                      <HeartPulse className="h-3 w-3" /> Predicted CSAT
                    </div>
                    <div className="font-semibold mt-0.5">
                      {result.predictedCsat.predictedScore}/5 {result.predictedCsat.band}
                    </div>
                  </div>
                  <div className="rounded-md border p-2">
                    <div className="text-xs text-muted-foreground flex items-center gap-1">
                      <Radar className="h-3 w-3" /> KB match
                    </div>
                    <div className="font-semibold mt-0.5 truncate">
                      {result.analysis.knowledgeMatches.length > 0
                        ? result.analysis.knowledgeMatches[0].title
                        : "None"}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Recent AI sessions</CardTitle>
        </CardHeader>
        <CardContent>
          {sessions.length === 0 ? (
            <EmptyState
              icon={Bot}
              title="No AI sessions yet"
              description="Run the virtual agent above to start building your deflection analytics."
            />
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Message</TableHead>
                    <TableHead>Intent</TableHead>
                    <TableHead>Sentiment</TableHead>
                    <TableHead>Outcome</TableHead>
                    <TableHead>Ticket</TableHead>
                    <TableHead>Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sessions.map((s) => (
                    <TableRow key={String(s.id)}>
                      <TableCell className="text-sm max-w-[260px]">
                        <p className="truncate">{String(s.user_message || "")}</p>
                        {Boolean(s.matched_article_title) && (
                          <p className="text-xs text-muted-foreground truncate">
                            KB: {String(s.matched_article_title)}
                          </p>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px]">{String(s.intent || "?")}</Badge>
                      </TableCell>
                      <TableCell className="text-xs capitalize">{String(s.sentiment || "?")}</TableCell>
                      <TableCell>
                        <Badge
                          variant={String(s.outcome) === "resolved_ai" ? "success" : "default"}
                          className="text-[10px]"
                        >
                          {String(s.outcome || "?")}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{String(s.ticket_number || "—")}</TableCell>
                      <TableCell className="text-xs whitespace-nowrap">
                        {s.created_at ? formatDateTime(String(s.created_at)) : "—"}
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