"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Sparkles, Send } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LoadingState } from "@/components/ui/loading-state";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/hooks/use-user";
import { hopeAiAssist, generateChatInsights } from "@/lib/hopechat";

export default function SecureChatAiPage() {
  const { auth } = useUser();
  const [prompt, setPrompt] = useState("@SecureTrackAI help");
  const [reply, setReply] = useState("");
  const [tasks, setTasks] = useState<string[]>([]);
  const [insights, setInsights] = useState<Array<{ title: string; detail: string; severity: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const companyId = auth?.profile?.company_id as string | undefined;

  useEffect(() => {
    async function load() {
      const sb = createClient();
      const [
        { count: msgs },
        { count: channels },
        { count: meetings },
        { count: files },
      ] = await Promise.all([
        sb.from("hc_messages").select("*", { count: "exact", head: true }).is("deleted_at", null),
        sb.from("hc_channels").select("*", { count: "exact", head: true }).is("deleted_at", null),
        sb.from("hc_meetings").select("*", { count: "exact", head: true }),
        sb.from("hc_files").select("*", { count: "exact", head: true }),
      ]);
      setInsights(
        generateChatInsights({
          dailyMessages: msgs ?? 0,
          activeChannels: channels ?? 0,
          meetings: meetings ?? 0,
          files: files ?? 0,
        })
      );
      setLoading(false);
    }
    load().catch(() => setLoading(false));
  }, []);

  const ask = async () => {
    if (!companyId || !prompt.trim()) return;
    setBusy(true);
    try {
      const r = await hopeAiAssist({ company_id: companyId, prompt });
      setReply(r.reply);
      setTasks(r.suggestedTasks || []);
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <LoadingState message="Loading SecureTrackAI…" />;

  return (
    <div>
      <PageHeader
        title="SecureTrackAI Assistant"
        description="Summarize · draft · translate · minutes · tasks · ERP answers · SOPs"
        actions={
          <Button asChild size="sm" variant="outline"><Link href="/dashboard/chat">Open chat</Link></Button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" /> Ask SecureTrackAI
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Input
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && ask()}
                placeholder="@SecureTrackAI summarize · /hr · /finance · /prod · /it"
              />
              <Button onClick={ask} disabled={busy}>
                <Send className="h-4 w-4" />
              </Button>
            </div>
            <div className="rounded-md border p-3 text-sm min-h-[120px] whitespace-pre-wrap bg-muted/30">
              {reply || "SecureTrackAI will respond here. Try bot commands or ask for a draft reply."}
            </div>
            {tasks.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {tasks.map((t) => (
                  <Badge key={t} variant="secondary" className="text-[10px]">{t}</Badge>
                ))}
              </div>
            )}
            <div className="flex flex-wrap gap-2 text-xs">
              {["@SecureTrackAI help", "/hr leave balance", "/finance invoice", "/prod machine down", "/it password", "summarize"].map((s) => (
                <Button key={s} size="sm" variant="outline" className="h-7 text-xs" onClick={() => setPrompt(s)}>
                  {s}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Collaboration insights</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {insights.map((ins, i) => (
              <div key={i} className="border rounded p-3 text-sm">
                <Badge variant="outline" className="text-[10px] mb-1 capitalize">{ins.severity}</Badge>
                <p className="font-medium">{ins.title}</p>
                <p className="text-xs text-muted-foreground mt-1">{ins.detail}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
