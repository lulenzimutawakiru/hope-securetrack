"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Brain, Plus } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import { createClient } from "@/lib/supabase/crud-compat";
import { useUser } from "@/hooks/use-user";
import { toast } from "sonner";
import { crudCreate, crudUpdate } from "@/lib/api/crud-client";

const TYPES = [
  "forecast",
  "predictive",
  "prescriptive",
  "risk",
  "root_cause",
  "scenario",
  "what_if",
  "fraud",
  "attrition",
  "churn",
  "demand",
  "cashflow",
  "failure",
  "supplier_risk",
];

export default function AiDecisionPage() {
  const { auth } = useUser();
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("open");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    insight_type: "forecast",
    domain: "finance",
    title: "",
    summary: "",
    recommendation: "",
    confidence: "0.75",
    severity: "medium",
    horizon: "30d",
  });

  const load = async () => {
    const supabase = createClient();
    let q = supabase
      .from("bi_ai_insights")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    if (filter !== "all") q = q.eq("status", filter);
    const { data } = await q;
    setRows(data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [filter]);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth) return;
    const crudRes2 = await crudCreate("bi_ai_insights", {
      company_id: auth.profile.company_id,
      insight_type: form.insight_type,
      domain: form.domain,
      title: form.title,
      summary: form.summary,
      recommendation: form.recommendation,
      confidence: Number(form.confidence),
      severity: form.severity,
      horizon: form.horizon,
      status: "open",
    });
    if (!crudRes2.ok) toast.error(crudRes2.error);
    else {
      toast.success("Insight logged");
      setOpen(false);
      load();
    }
  };

  const setStatus = async (id: string, status: string) => {
    const crudRes = await crudUpdate("bi_ai_insights", id, {
        status,
        resolved_at: status === "actioned" || status === "dismissed" ? new Date().toISOString() : null,
      });
    if (!crudRes.ok) toast.error(crudRes.error);
    else load();
  };

  if (loading) return <LoadingState />;

  return (
    <div>
      <PageHeader
        title="AI Decision Intelligence"
        description="Forecasting · predictive · prescriptive · risk · what-if · root cause · fraud"
        actions={
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard/reports">Hub</Link>
            </Button>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-1" />
                  Insight
                </Button>
              </DialogTrigger>
              <DialogContent>
                <form onSubmit={create} className="space-y-3">
                  <DialogHeader>
                    <DialogTitle>Log AI insight</DialogTitle>
                  </DialogHeader>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label>Type</Label>
                      <select
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        value={form.insight_type}
                        onChange={(e) => setForm((f) => ({ ...f, insight_type: e.target.value }))}
                      >
                        {TYPES.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <Label>Domain</Label>
                      <Input
                        value={form.domain}
                        onChange={(e) => setForm((f) => ({ ...f, domain: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label>Title</Label>
                    <Input
                      value={form.title}
                      onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Summary</Label>
                    <Input
                      value={form.summary}
                      onChange={(e) => setForm((f) => ({ ...f, summary: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Recommendation</Label>
                    <Input
                      value={form.recommendation}
                      onChange={(e) => setForm((f) => ({ ...f, recommendation: e.target.value }))}
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="space-y-1">
                      <Label>Confidence</Label>
                      <Input
                        type="number"
                        step="0.01"
                        min={0}
                        max={1}
                        value={form.confidence}
                        onChange={(e) => setForm((f) => ({ ...f, confidence: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Severity</Label>
                      <Input
                        value={form.severity}
                        onChange={(e) => setForm((f) => ({ ...f, severity: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Horizon</Label>
                      <Input
                        value={form.horizon}
                        onChange={(e) => setForm((f) => ({ ...f, horizon: e.target.value }))}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button type="submit">Create</Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        }
      />

      <div className="flex gap-2 mb-4">
        {["open", "acknowledged", "actioned", "dismissed", "all"].map((s) => (
          <Button
            key={s}
            size="sm"
            variant={filter === s ? "default" : "outline"}
            onClick={() => setFilter(s)}
            className="capitalize"
          >
            {s}
          </Button>
        ))}
      </div>

      {rows.length === 0 ? (
        <EmptyState icon={Brain} title="No insights" description="AI forecasts and risk signals appear here" />
      ) : (
        <div className="grid gap-3">
          {rows.map((r) => (
            <Card key={String(r.id)}>
              <CardHeader className="pb-2">
                <div className="flex flex-wrap items-center gap-2">
                  <CardTitle className="text-base">{String(r.title)}</CardTitle>
                  <StatusBadge status={String(r.severity ?? "info")} />
                  <Badge variant="outline" className="font-mono text-[10px]">
                    {String(r.insight_type)}
                  </Badge>
                  <Badge variant="secondary" className="text-[10px]">
                    {String(r.domain)}
                  </Badge>
                  <span className="text-xs text-muted-foreground ml-auto">
                    {r.confidence != null
                      ? `${Math.round(Number(r.confidence) * 100)}% confidence`
                      : ""}
                    {r.horizon ? ` · ${String(r.horizon)}` : ""}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm text-muted-foreground">{String(r.summary ?? "")}</p>
                {r.recommendation ? (
                  <p className="text-sm">
                    <span className="font-medium text-hope-teal">Prescribe: </span>
                    {String(r.recommendation)}
                  </p>
                ) : null}
                <div className="flex flex-wrap gap-2 pt-1">
                  {String(r.status) === "open" && (
                    <>
                      <Button size="sm" variant="outline" onClick={() => setStatus(String(r.id), "acknowledged")}>
                        Acknowledge
                      </Button>
                      <Button size="sm" onClick={() => setStatus(String(r.id), "actioned")}>
                        Mark actioned
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setStatus(String(r.id), "dismissed")}>
                        Dismiss
                      </Button>
                    </>
                  )}
                  {String(r.status) === "acknowledged" && (
                    <Button size="sm" onClick={() => setStatus(String(r.id), "actioned")}>
                      Mark actioned
                    </Button>
                  )}
                  <Badge variant="outline" className="capitalize">
                    {String(r.status)}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
