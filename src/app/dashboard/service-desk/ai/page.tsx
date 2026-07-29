"use client";

import { useState } from "react";
import Link from "next/link";
import { Wand2 } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useUser } from "@/hooks/use-user";
import { toast } from "sonner";
import { aiTriage, createTicket, predictSlaBreach } from "@/lib/service-desk";

export default function ServiceDeskAiPage() {
  const { auth } = useUser();
  const [text, setText] = useState("My laptop cannot connect to WiFi on the production floor");
  const [result, setResult] = useState<Awaited<ReturnType<typeof aiTriage>> | null>(null);
  const [busy, setBusy] = useState(false);

  const companyId = auth?.profile?.company_id as string | undefined;

  const analyze = async () => {
    if (!companyId) return toast.error("No company");
    setBusy(true);
    try {
      const r = await aiTriage(text, companyId);
      setResult(r);
      toast.success("Triage complete");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  };

  const createFromAi = async () => {
    if (!companyId || !result) return;
    setBusy(true);
    try {
      const t = await createTicket({
        company_id: companyId,
        created_by: auth?.user?.id,
        ticket: {
          subject: text.slice(0, 120),
          description: text,
          category: result.suggestedCategory,
          subcategory: result.suggestedSubcategory,
          service_type: result.suggestedServiceType,
          priority: result.suggestedPriority,
          impact: result.suggestedImpact,
          urgency: result.suggestedUrgency,
          is_major: result.isMajor,
          channel: "web",
          requester_name: auth?.profile
            ? `${auth.profile.first_name} ${auth.profile.last_name}`
            : null,
        },
      });
      toast.success(`Ticket ${t.ticket_number} created`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  };

  const slaPred = predictSlaBreach({
    resolveDue: new Date(Date.now() + 45 * 60_000).toISOString(),
    status: "in_progress",
    priority: result?.suggestedPriority,
  });

  return (
    <div>
      <PageHeader
        title="AI Service Desk Assistant"
        description="Classify · search KB · detect duplicates · suggest priority · auto-route"
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Wand2 className="h-4 w-4" /> User message
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label>Describe the issue</Label>
              <textarea
                className="flex min-h-[140px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={text}
                onChange={(e) => setText(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={analyze} disabled={busy}>
                {busy ? "Analyzing…" : "Analyze"}
              </Button>
              {result?.shouldCreateTicket && (
                <Button variant="outline" onClick={createFromAi} disabled={busy}>
                  Create ticket
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">AI recommendations</CardTitle></CardHeader>
          <CardContent>
            {!result ? (
              <p className="text-sm text-muted-foreground">Run analysis to see classification and KB matches.</p>
            ) : (
              <div className="space-y-3 text-sm">
                <div className="flex flex-wrap gap-1.5">
                  <Badge variant="outline">Category: {result.suggestedCategory}</Badge>
                  <Badge variant="outline">Service: {result.suggestedServiceType}</Badge>
                  <Badge variant="outline">Priority: {result.suggestedPriority}</Badge>
                  <Badge variant="outline">Impact: {result.suggestedImpact}</Badge>
                  {result.isMajor && <Badge variant="destructive">Major</Badge>}
                </div>
                <p className="text-muted-foreground">{result.suggestedReply}</p>

                {result.knowledgeMatches.length > 0 && (
                  <div>
                    <div className="font-medium text-xs mb-1">Knowledge matches</div>
                    {result.knowledgeMatches.map((k) => (
                      <div key={k.id} className="border rounded p-2 mb-1.5">
                        <div className="font-medium">{k.title}</div>
                        <div className="text-xs text-muted-foreground">{k.snippet}</div>
                        <div className="text-[10px]">Score {(k.score * 100).toFixed(0)}%</div>
                      </div>
                    ))}
                    <Button asChild size="sm" variant="link" className="px-0">
                      <Link href="/dashboard/service-desk/knowledge">Open KB</Link>
                    </Button>
                  </div>
                )}

                {result.duplicates.length > 0 && (
                  <div>
                    <div className="font-medium text-xs mb-1">Possible duplicates</div>
                    {result.duplicates.map((d) => (
                      <div key={d.id} className="text-xs border-b py-1">
                        {d.subject} ({(d.score * 100).toFixed(0)}%)
                      </div>
                    ))}
                  </div>
                )}

                <div className="rounded-md border p-2 text-xs">
                  <strong>SLA risk sample:</strong> {slaPred.message} ({slaPred.risk})
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
