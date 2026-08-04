"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bot, Send } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LoadingState } from "@/components/ui/loading-state";
import { createClient } from "@/lib/supabase/crud-compat";
import { useUser } from "@/hooks/use-user";
import { formatNumber } from "@/lib/utils";
import { toast } from "sonner";
import { crudCreate } from "@/lib/api/crud-client";

const SUGGESTIONS = [
  "Why did production efficiency decline last month?",
  "Which supplier has the highest delivery delays?",
  "Show the top five customers by profit.",
  "Predict next quarter's paper demand.",
  "Generate a Board report.",
  "Which department exceeded its budget?",
];

type Msg = { role: "user" | "assistant"; content: string; intent?: string };

export default function AiAssistantPage() {
  const { auth } = useUser();
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: "assistant",
      content:
        "I am the SecureTrack ERP Executive Assistant. Ask about production, suppliers, customers, forecasts, board packs, or budgets.",
      intent: "system",
    },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function init() {
      if (!auth) {
        setLoading(false);
        return;
      }
      const supabase = createClient();
      const crudRes = await crudCreate("bi_assistant_sessions", {
          company_id: auth.profile.company_id,
          user_id: auth.profile.id,
          title: "Executive session",
        });
      if (!crudRes.ok) {
        setLoading(false);
        return;
      }
      const data = crudRes.data as Record<string, unknown>;
      setSessionId(data?.id ? String(data.id) : null);
      setLoading(false);
    }
    init();
  }, [auth]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const answerQuestion = async (question: string) => {
    if (!auth || !question.trim()) return;
    setBusy(true);
    const userMsg: Msg = { role: "user", content: question.trim() };
    setMessages((m) => [...m, userMsg]);
    setInput("");

    const supabase = createClient();
    const [{ data: playbooks }, { data: kpis }, { data: forecasts }] = await Promise.all([
      supabase.from("bi_assistant_playbooks").select("*").eq("is_active", true),
      supabase.from("bi_kpis").select("kpi_code, name, actual_value, target_value, unit").eq("is_active", true),
      supabase.from("bi_forecast_results").select("*").order("created_at", { ascending: false }).limit(5),
    ]);

    const q = question.toLowerCase();
    const matched = (playbooks ?? []).find((p) => {
      try {
        return new RegExp(String(p.trigger_pattern), "i").test(q);
      } catch {
        return String(p.trigger_pattern).toLowerCase().split("|").some((t) => q.includes(t.trim()));
      }
    });

    const kpiMap: Record<string, { actual: number; target: number; unit: string }> = {};
    (kpis ?? []).forEach((k) => {
      kpiMap[String(k.kpi_code)] = {
        actual: Number(k.actual_value),
        target: Number(k.target_value),
        unit: String(k.unit ?? ""),
      };
    });

    const demand = (forecasts ?? []).find((f) => f.metric_key === "paper_demand_tonnes");

    let content: string;
    let intent = "general";

    if (matched) {
      intent = String(matched.intent);
      content = String(matched.answer_template)
        .replace("{{peff}}", formatNumber(kpiMap["KPI-PEFF"]?.actual ?? 88.5))
        .replace("{{target}}", formatNumber(kpiMap["KPI-PEFF"]?.target ?? 92))
        .replace("{{slt}}", formatNumber(kpiMap["KPI-SLT"]?.actual ?? 9.5))
        .replace("{{demand}}", formatNumber(Number(demand?.forecast_value ?? 420)))
        .replace("{{low}}", formatNumber(Number(demand?.lower_bound ?? 380)))
        .replace("{{high}}", formatNumber(Number(demand?.upper_bound ?? 460)));
    } else {
      content =
        "I could not map that to a playbook. Try questions about production efficiency, supplier delays, customer profit, paper demand, board reports, or budgets. Open AI Insights and Executive Center for deeper analysis.";
    }

    const assistantMsg: Msg = { role: "assistant", content, intent };
    setMessages((m) => [...m, assistantMsg]);

    if (sessionId) {
      const messagesToSave = [
        {
          session_id: sessionId,
          role: "user",
          content: question.trim(),
        },
        {
          session_id: sessionId,
          role: "assistant",
          content,
          intent,
          confidence: matched ? 0.82 : 0.4,
          sources: matched?.data_hooks ?? [],
        },
      ];
      for (const msg of messagesToSave) {
        const crudRes2 = await crudCreate("bi_assistant_messages", msg);
        if (!crudRes2.ok) toast.error(crudRes2.error);
      }
    }
    setBusy(false);
  };

  if (loading) return <LoadingState />;

  return (
    <div>
      <PageHeader
        title="AI Executive Assistant"
        description="Ask natural-language questions — production · suppliers · customers · forecasts · board packs · budgets"
        actions={
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard/reports">Hub</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard/reports/ai">AI insights</Link>
            </Button>
          </div>
        }
      />

      <div className="flex flex-wrap gap-2 mb-4">
        {SUGGESTIONS.map((s) => (
          <Button
            key={s}
            size="sm"
            variant="outline"
            className="text-xs h-auto py-1.5 whitespace-normal text-left"
            disabled={busy}
            onClick={() => answerQuestion(s)}
          >
            {s}
          </Button>
        ))}
      </div>

      <Card className="mb-4">
        <CardContent className="pt-4 space-y-3 max-h-[480px] overflow-y-auto">
          {messages.map((m, i) => (
            <div
              key={i}
              className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                  m.role === "user"
                    ? "bg-hope-navy text-white"
                    : "bg-muted text-foreground"
                }`}
              >
                {m.role === "assistant" && (
                  <div className="flex items-center gap-1 text-[10px] text-muted-foreground mb-1">
                    <Bot className="h-3 w-3" />
                    Assistant
                    {m.intent && m.intent !== "system" && (
                      <Badge variant="outline" className="text-[9px] ml-1">
                        {m.intent}
                      </Badge>
                    )}
                  </div>
                )}
                {m.content}
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </CardContent>
      </Card>

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!input.trim()) {
            toast.error("Enter a question");
            return;
          }
          answerQuestion(input);
        }}
      >
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask the executive assistant…"
          disabled={busy}
        />
        <Button type="submit" disabled={busy}>
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}
