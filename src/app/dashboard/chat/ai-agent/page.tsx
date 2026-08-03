"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Bot, Send, Loader2, ShieldCheck, ShieldAlert, ExternalLink, Sparkles, History,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { LoadingState } from "@/components/ui/loading-state";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useUser } from "@/hooks/use-user";
import { formatDateTime } from "@/lib/utils";
import { runCopilot, listCopilotSessions, COPILOT_DOMAINS } from "@/lib/hopechat";
import type { CopilotResult } from "@/lib/hopechat";
import { toast } from "sonner";

const EXAMPLES: Array<{ domain: string; prompt: string }> = [
  { domain: "hr", prompt: "How many leave days do I have?" },
  { domain: "finance", prompt: "Show unpaid supplier invoices for review" },
  { domain: "it", prompt: "My laptop cannot connect to WiFi - what should I do?" },
  { domain: "assets", prompt: "Check warranty status for my assigned device" },
  { domain: "management", prompt: "Give me an executive summary of recent activity" },
  { domain: "approval", prompt: "What approvals are pending for me?" },
];

export default function ChatAiAgentPage() {
  const { auth } = useUser();
  const [domain, setDomain] = useState("general");
  const [prompt, setPrompt] = useState("");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<CopilotResult | null>(null);
  const [sessions, setSessions] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);

  const companyId = auth?.profile?.company_id as string | undefined;

  const load = async () => {
    if (!companyId) {
      setLoading(false);
      return;
    }
    try {
      const data = await listCopilotSessions(companyId);
      setSessions((data as Array<Record<string, unknown>>) || []);
    } catch {
      /* keep empty */
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [companyId]);

  const run = async () => {
    if (!companyId || !prompt.trim()) return;
    setRunning(true);
    try {
      const { result: res } = await runCopilot({
        company_id: companyId,
        tenant_id: auth?.tenantId || null,
        user_id: auth?.user?.id,
        agent_domain: domain,
        user_message: prompt.trim(),
        permissions: auth?.permissions || [],
      });
      setResult(res);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Copilot request failed");
    } finally {
      setRunning(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="AI Enterprise Agent"
        description="Tenant-aware ERP copilot - HR, Finance, IT, Assets, Management and Approvals"
        actions={
          <Badge variant="outline" className="gap-1">
            <ShieldCheck className="h-3.5 w-3.5" /> Permission-gated and audited
          </Badge>
        }
      />

      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Select value={domain} onValueChange={setDomain}>
              <SelectTrigger className="w-56">
                <SelectValue placeholder="Assistant domain" />
              </SelectTrigger>
              <SelectContent>
                {COPILOT_DOMAINS.map((d) => (
                  <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="text-xs text-muted-foreground">
              Answers are permission-filtered to your role. No tenant data leaves your company scope.
            </span>
          </div>
          <Textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Ask anything - e.g. 'Show unpaid supplier invoices', 'How many leave days do I have?'"
            rows={3}
          />
          <div className="mt-3 flex items-center justify-between gap-2">
            <div className="flex flex-wrap gap-2">
              {EXAMPLES.map((ex) => (
                <button
                  key={`${ex.domain}-${ex.prompt}`}
                  onClick={() => {
                    setDomain(ex.domain);
                    setPrompt(ex.prompt);
                  }}
                  className="rounded-full border bg-background px-2.5 py-1 text-[11px] text-muted-foreground hover:bg-muted"
                >
                  {ex.prompt}
                </button>
              ))}
            </div>
            <Button onClick={run} disabled={running || !prompt.trim()}>
              {running ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Send className="h-4 w-4 mr-1" />
              )}
              Ask copilot
            </Button>
          </div>
        </CardContent>
      </Card>

      {result && (
        <Card className="mb-6 border-primary/30">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <Sparkles className="h-4 w-4 text-primary" />
              Copilot response
            </CardTitle>
            <div className="flex items-center gap-2">
              {result.permissionGranted ? (
                <Badge variant="success" className="gap-1">
                  <ShieldCheck className="h-3 w-3" /> Permission granted
                </Badge>
              ) : (
                <Badge variant="destructive" className="gap-1">
                  <ShieldAlert className="h-3 w-3" /> Permission denied
                </Badge>
              )}
              <Badge variant="outline">{result.intent}</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-sm">{result.answer}</p>
            {result.actions.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {result.actions.map((a) => (
                  <Button key={a.label} size="sm" variant="outline" asChild>
                    <Link href={a.href || "/dashboard/chat"}>
                      {a.label} <ExternalLink className="h-3.5 w-3.5 ml-1" />
                    </Link>
                  </Button>
                ))}
              </div>
            )}
            {!result.permissionGranted && (
              <p className="mt-3 text-xs text-muted-foreground">
                {result.permissionReason} - this interaction was written to the copilot audit log.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <History className="h-4 w-4" /> Recent copilot sessions
          </CardTitle>
          <Badge variant="secondary">{sessions.length} logged</Badge>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6"><LoadingState message="Loading sessions..." /></div>
          ) : sessions.length === 0 ? (
            <EmptyState
              icon={Bot}
              title="No copilot sessions yet"
              description="Ask the AI agent a question to start a permission-audited session."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Question</TableHead>
                  <TableHead>Agent</TableHead>
                  <TableHead>Intent</TableHead>
                  <TableHead>Access</TableHead>
                  <TableHead>Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sessions.slice(0, 12).map((s) => (
                  <TableRow key={String(s.id)}>
                    <TableCell className="max-w-[300px]">
                      <p className="truncate">{String(s.user_message || "")}</p>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{String(s.agent_domain || "general")}</Badge>
                    </TableCell>
                    <TableCell className="text-xs">{String(s.intent || "--")}</TableCell>
                    <TableCell>
                      {Boolean(s.permission_granted) ? (
                        <Badge variant="success">granted</Badge>
                      ) : (
                        <Badge variant="destructive">denied</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDateTime(String(s.created_at || ""))}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}