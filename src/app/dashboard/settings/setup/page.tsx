"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  Circle,
  ArrowRight,
  Loader2,
  Rocket,
  SkipForward,
  RefreshCw,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { LoadingState } from "@/components/ui/loading-state";
import { toast } from "sonner";
import { useUser } from "@/hooks/use-user";

type SetupStepRow = {
  id?: string;
  step_key: string;
  step_label?: string | null;
  status: string;
  sort_order?: number;
  description?: string;
  href?: string;
  completed_at?: string | null;
};

type Summary = {
  total: number;
  completed: number;
  remaining: number;
  percent: number;
  isComplete: boolean;
  nextStep: SetupStepRow | null;
};

export default function TenantSetupWizardPage() {
  const { auth, loading: authLoading } = useUser();
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [steps, setSteps] = useState<SetupStepRow[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v2/platform/setup");
      const json = await res.json();
      if (!res.ok || json?.ok === false) {
        throw new Error(json?.error?.message || "Failed to load setup");
      }
      const data = json.data ?? json;
      setSteps(data.steps || []);
      setSummary(data.summary || null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load setup");
      setSteps([]);
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading && auth) load();
  }, [authLoading, auth, load]);

  const mark = async (
    step: SetupStepRow,
    status: "completed" | "skipped" | "in_progress" | "pending"
  ) => {
    setBusyKey(step.step_key);
    try {
      const res = await fetch("/api/v2/platform/setup", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          step_id: step.id,
          step_key: step.step_key,
          status,
        }),
      });
      const json = await res.json();
      if (!res.ok || json?.ok === false) {
        throw new Error(json?.error?.message || "Update failed");
      }
      const data = json.data ?? json;
      if (data.summary) setSummary(data.summary);
      await load();
      toast.success(
        status === "skipped"
          ? "Step skipped"
          : status === "completed"
            ? "Step completed"
            : "Step updated"
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed");
    } finally {
      setBusyKey(null);
    }
  };

  if (authLoading || loading) {
    return <LoadingState message="Loading setup wizard…" />;
  }

  if (!auth) {
    return (
      <div className="text-sm text-muted-foreground">
        Sign in required to view the setup wizard.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Go-live setup"
        description="Complete these steps to finish onboarding your organization on SecureTrack ERP"
        actions={
          <Button size="sm" variant="outline" onClick={load}>
            <RefreshCw className="h-4 w-4 mr-1" /> Refresh
          </Button>
        }
      />

      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Rocket className="h-4 w-4 text-hope-teal" />
              Progress
            </CardTitle>
            {summary?.isComplete ? (
              <Badge variant="secondary" className="text-[10px]">
                Complete
              </Badge>
            ) : (
              <Badge variant="outline" className="text-[10px]">
                {summary?.remaining ?? 0} remaining
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              {summary?.completed ?? 0} of {summary?.total ?? 0} steps
            </span>
            <span className="font-medium">{summary?.percent ?? 0}%</span>
          </div>
          <Progress value={summary?.percent ?? 0} className="h-2" />
          {summary?.isComplete ? (
            <p className="text-sm text-green-700 dark:text-green-400 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" />
              Setup complete. Your tenant is ready for production use.
            </p>
          ) : summary?.nextStep ? (
            <p className="text-sm text-muted-foreground">
              Next:{" "}
              <strong className="text-foreground">
                {summary.nextStep.step_label || summary.nextStep.step_key}
              </strong>
            </p>
          ) : null}
        </CardContent>
      </Card>

      <div className="space-y-3">
        {steps.map((s, idx) => {
          const done = s.status === "completed" || s.status === "skipped";
          const busy = busyKey === s.step_key;
          return (
            <Card
              key={s.step_key}
              className={done ? "opacity-90 border-muted" : "border-primary/20"}
            >
              <CardContent className="flex flex-col sm:flex-row sm:items-center gap-4 py-4">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className="mt-0.5 shrink-0">
                    {done ? (
                      <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                    ) : (
                      <Circle className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs text-muted-foreground font-mono">
                        {String(idx + 1).padStart(2, "0")}
                      </span>
                      <h3 className="font-medium text-sm">
                        {s.step_label || s.step_key}
                      </h3>
                      <Badge
                        variant={
                          s.status === "completed"
                            ? "secondary"
                            : s.status === "skipped"
                              ? "outline"
                              : "default"
                        }
                        className="text-[10px] capitalize"
                      >
                        {s.status}
                      </Badge>
                    </div>
                    {s.description ? (
                      <p className="text-xs text-muted-foreground mt-1">
                        {s.description}
                      </p>
                    ) : null}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 sm:justify-end shrink-0">
                  {s.href ? (
                    <Button size="sm" variant="outline" asChild>
                      <Link href={s.href}>
                        Open <ArrowRight className="h-3.5 w-3.5 ml-1" />
                      </Link>
                    </Button>
                  ) : null}
                  {!done ? (
                    <>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={busy}
                        onClick={() => mark(s, "skipped")}
                      >
                        {busy ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <>
                            <SkipForward className="h-3.5 w-3.5 mr-1" /> Skip
                          </>
                        )}
                      </Button>
                      <Button
                        size="sm"
                        disabled={busy}
                        onClick={() => mark(s, "completed")}
                      >
                        {busy ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          "Mark done"
                        )}
                      </Button>
                    </>
                  ) : s.status === "skipped" || s.status === "completed" ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={busy}
                      onClick={() => mark(s, "pending")}
                    >
                      Reopen
                    </Button>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          );
        })}

        {steps.length === 0 && (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              No setup steps found for this tenant. If you just provisioned,
              refresh or contact platform support.
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
