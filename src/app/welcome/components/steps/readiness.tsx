"use client";

import { useEffect, useMemo } from "react";
import { Gauge, CheckCircle2, AlertTriangle, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { StepHeader, SectionCard, type StepProps } from "../step-types";

export function ReadinessStep({ data, registerSubmit, finishStep, goTo }: StepProps) {
  const readiness = useMemo(() => data.state.readiness, [data.state.readiness]);

  useEffect(() => {
    registerSubmit(() => finishStep());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  const done = readiness?.goLive?.filter((g) => g.done).length ?? 0;
  const total = readiness?.goLive?.length ?? 0;
  const pct = readiness?.overall ?? 0;
  const ok = pct >= 90;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <StepHeader
        title="Readiness assessment"
        description="AI scores every area of your configuration and flags anything missing before go-live."
        badge={
          <Badge variant={ok ? "default" : "secondary"} className="gap-1">
            <Gauge className="h-3 w-3" /> {pct}% ready
          </Badge>
        }
      />

      <SectionCard title="Overall readiness">
        <div className="flex items-end justify-between">
          <p className="text-4xl font-bold">{pct}%</p>
          <p className="text-sm text-muted-foreground">
            {done}/{total} go-live checks passed
          </p>
        </div>
        <Progress value={pct} className="mt-3 h-2.5" />
        {ok ? (
          <p className="mt-3 flex items-center gap-2 text-sm text-emerald-600">
            <CheckCircle2 className="h-4 w-4" /> Excellent — your environment is ready for go-live.
          </p>
        ) : (
          <p className="mt-3 flex items-center gap-2 text-sm text-amber-600">
            <AlertTriangle className="h-4 w-4" /> A few areas need attention below.
          </p>
        )}
      </SectionCard>

      <SectionCard title="Configuration scorecard">
        <div className="space-y-4">
          {readiness?.sections?.map((s) => (
            <div key={s.key}>
              <div className="mb-1.5 flex items-center justify-between gap-2 text-sm">
                <span className="flex items-center gap-2 font-medium">
                  {s.passed ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                  )}
                  {s.label}
                </span>
                <span className="text-muted-foreground">{s.score}%</span>
              </div>
              <Progress value={s.score} className="h-1.5" />
              {s.notes?.length ? (
                <p className="mt-1 text-xs text-muted-foreground">{s.notes.join(" ")}</p>
              ) : null}
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="Go-live checklist" description="Automated checks against your configuration.">
        <div className="grid gap-2 sm:grid-cols-2">
          {readiness?.goLive?.map((g) => (
            <div
              key={g.key}
              className={[
                "flex items-start gap-2 rounded-lg border p-2.5 text-sm",
                g.done ? "border-emerald-500/30 bg-emerald-500/5" : "border-border",
              ].join(" ")}
            >
              {g.done ? (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
              ) : (
                <span className="mt-1 h-3.5 w-3.5 shrink-0 rounded-full border-2 border-muted-foreground/40" />
              )}
              <div>
                <p className="font-medium">{g.label}</p>
                <p className="text-xs text-muted-foreground">{g.detail}</p>
              </div>
            </div>
          ))}
        </div>
      </SectionCard>

      <div className="flex items-start gap-2 rounded-xl border bg-muted/30 p-3 text-sm text-muted-foreground">
        <Sparkles className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          Missing items can be completed after go-live — the assistant will keep guiding you from the dashboard.
        </p>
      </div>

      <div className="flex justify-end">
        <Button onClick={() => finishStep()}>Continue to Go Live</Button>
      </div>
    </div>
  );
}