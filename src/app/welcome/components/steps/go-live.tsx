"use client";

import { useEffect, useMemo, useState } from "react";
import { Rocket, CheckCircle2, ShieldCheck, HeartPulse, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StepHeader, SectionCard, type StepProps } from "../step-types";

export function GoLiveStep({ data, registerSubmit, onComplete }: StepProps) {
  const [launching, setLaunching] = useState(false);
  const readiness = useMemo(() => data.state.readiness, [data.state.readiness]);
  const health = useMemo(() => data.state.health, [data.state.health]);

  const done = readiness?.goLive?.filter((g) => g.done).length ?? 0;
  const total = readiness?.goLive?.length ?? 0;
  const pct = readiness?.overall ?? 0;

  const launch = () => {
    setLaunching(true);
    onComplete();
  };

  useEffect(() => {
    registerSubmit(() => launch());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  const healthDims = health
    ? [
        { label: "Configuration", value: health.configuration },
        { label: "Security", value: health.security },
        { label: "Compliance", value: health.compliance },
        { label: "Data quality", value: health.dataQuality },
        { label: "Training", value: health.training },
        { label: "AI adoption", value: health.aiAdoption },
      ]
    : [];

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <StepHeader
        title="Go live"
        description="Confirm the final checklist and activate your environment. Everything is reversible — you stay in control."
        badge={
          <Badge variant="default" className="gap-1">
            <Rocket className="h-3 w-3" /> {done}/{total} checks
          </Badge>
        }
      />

      <SectionCard title="Final checklist">
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

      {health ? (
        <SectionCard title="Tenant health" description="Live health snapshot of your environment.">
          <div className="flex items-center gap-3">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <HeartPulse className="h-8 w-8" />
            </div>
            <div>
              <p className="text-3xl font-bold">{health.overall}%</p>
              <p className="text-xs text-muted-foreground">Overall health · risk {health.risk}%</p>
            </div>
            <Badge variant="outline" className="gap-1 ml-auto">
              <ShieldCheck className="h-3 w-3" /> {health.backup === "ok" ? "Backups OK" : "Backups scheduled"}
            </Badge>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {healthDims.map((d) => (
              <div key={d.label} className="rounded-xl border p-3">
                <p className="text-xs text-muted-foreground">{d.label}</p>
                <p className="text-lg font-semibold mt-1">{d.value}%</p>
              </div>
            ))}
          </div>
        </SectionCard>
      ) : null}

      <div className="rounded-2xl border bg-gradient-to-br from-primary/10 via-background to-background p-6">
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <p className="text-lg font-semibold">Ready when you are</p>
            <p className="text-sm text-muted-foreground">
              Readiness {pct}% — you can launch now or fine-tune from the dashboard first.
            </p>
          </div>
          <Button size="lg" className="gap-2" onClick={launch} disabled={launching}>
            {launching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}
            {launching ? "Activating…" : "Launch SecureTrack ERP"}
          </Button>
        </div>
      </div>
    </div>
  );
}