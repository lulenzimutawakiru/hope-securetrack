"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Wand2, MessageCircle } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LoadingState } from "@/components/ui/loading-state";
import { createClient } from "@/lib/supabase/client";
import {
  generatePayrollInsights,
  answerPayrollFaq,
  detectDuplicateRisk,
  type PayrollAiInsight,
} from "@/lib/payroll";

export default function PayAiPage() {
  const [loading, setLoading] = useState(true);
  const [insights, setInsights] = useState<PayrollAiInsight[]>([]);
  const [dupes, setDupes] = useState<string[]>([]);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");

  useEffect(() => {
    async function load() {
      const sb = createClient();
      const [
        { count: pending },
        { count: loans },
        { count: ot },
        { data: lastRun },
        { data: lines },
      ] = await Promise.all([
        sb.from("pay_approvals").select("*", { count: "exact", head: true }).eq("status", "pending"),
        sb.from("pay_loans").select("*", { count: "exact", head: true }).eq("status", "active"),
        sb.from("pay_overtime_claims").select("*", { count: "exact", head: true }).eq("status", "pending"),
        sb.from("payroll_runs").select("*").order("created_at", { ascending: false }).limit(1).maybeSingle(),
        sb.from("payroll_lines").select("employee_id,net_pay").order("created_at", { ascending: false }).limit(500),
      ]);

      const nets = (lines || []).map((l) => Number(l.net_pay || 0));
      const avgNet = nets.length ? nets.reduce((a, b) => a + b, 0) / nets.length : 0;
      const maxNet = nets.length ? Math.max(...nets) : 0;
      const zeroPayCount = nets.filter((n) => n === 0).length;

      setInsights(
        generatePayrollInsights({
          employeeCount: lastRun?.employee_count,
          grossTotal: Number(lastRun?.gross_total || 0),
          netTotal: Number(lastRun?.net_total || 0),
          pendingApprovals: pending ?? 0,
          openLoans: loans ?? 0,
          pendingOt: ot ?? 0,
          avgNet,
          maxNet,
          zeroPayCount,
        })
      );
      setDupes(
        detectDuplicateRisk(
          (lines || []).map((l) => ({
            employee_id: String(l.employee_id),
            net_pay: Number(l.net_pay || 0),
          }))
        )
      );
      setLoading(false);
    }
    load().catch(() => setLoading(false));
  }, []);

  if (loading) return <LoadingState message="Loading AI payroll assistant…" />;

  const severityVariant = (s: string) => {
    if (s === "high") return "destructive" as const;
    if (s === "medium") return "default" as const;
    return "outline" as const;
  };

  return (
    <div>
      <PageHeader
        title="AI Payroll Assistant"
        description="Anomaly detection · cost forecast · duplicate risk · employee FAQ"
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Wand2 className="h-4 w-4" /> Insights
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {dupes.length > 0 && (
              <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3">
                <p className="font-medium text-sm text-destructive">Duplicate payment risk</p>
                {dupes.map((d) => (
                  <p key={d} className="text-xs text-muted-foreground">{d}</p>
                ))}
              </div>
            )}
            {insights.map((ins, i) => (
              <div key={i} className="rounded-md border p-3">
                <div className="flex gap-2 mb-1">
                  <Badge variant={severityVariant(ins.severity)} className="text-[10px]">{ins.severity}</Badge>
                  <Badge variant="outline" className="text-[10px] capitalize">{ins.type}</Badge>
                </div>
                <p className="font-medium text-sm">{ins.title}</p>
                <p className="text-xs text-muted-foreground mt-1">{ins.detail}</p>
                <div className="flex flex-wrap gap-1 mt-2">
                  {ins.actions.map((a) => (
                    <Badge key={a} variant="secondary" className="text-[10px] font-normal">{a}</Badge>
                  ))}
                </div>
              </div>
            ))}
            <div className="flex flex-wrap gap-2 pt-2">
              <Button asChild size="sm" variant="outline"><Link href="/dashboard/payroll/approvals">Approvals</Link></Button>
              <Button asChild size="sm" variant="outline"><Link href="/dashboard/payroll/runs">Runs</Link></Button>
              <Button asChild size="sm" variant="outline"><Link href="/dashboard/payroll/loans">Loans</Link></Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <MessageCircle className="h-4 w-4" /> Payroll FAQ
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              placeholder="Ask about PAYE, NSSF, payslips, loans…"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") setAnswer(answerPayrollFaq(question));
              }}
            />
            <Button size="sm" onClick={() => setAnswer(answerPayrollFaq(question))}>Ask</Button>
            {answer && (
              <div className="rounded-md border bg-muted/40 p-3 text-sm">{answer}</div>
            )}
            <div className="text-xs text-muted-foreground space-y-1">
              <p>Try:</p>
              <ul className="list-disc pl-4">
                <li>How is PAYE calculated?</li>
                <li>What is NSSF employee rate?</li>
                <li>How do I get my payslip?</li>
                <li>How do salary advances work?</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
