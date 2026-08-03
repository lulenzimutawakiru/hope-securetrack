"use client";

import { useEffect, useState } from "react";
import { Activity, RefreshCw, Shield, Server } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LoadingState } from "@/components/ui/loading-state";
import { toast } from "sonner";

type Health = {
  status?: string;
  version?: string;
  durationMs?: number;
  checks?: {
    env?: { ok?: boolean; missingCount?: number };
    supabase?: { ok?: boolean; latencyMs?: number | null };
    resend?: { configured?: boolean };
    platform?: {
      redisRateLimit?: boolean;
      aiCopilot?: boolean;
      jobWorkerSecret?: boolean;
      mfaEnforcePrivileged?: boolean;
      dualControlRequired?: boolean;
      paymentSandbox?: boolean;
      productionSafe?: boolean | null;
    };
  };
};

function Flag({ ok, label }: { ok?: boolean | null; label: string }) {
  const variant =
    ok === true ? "default" : ok === false ? "destructive" : "outline";
  return (
    <div className="flex items-center justify-between gap-2 py-1.5 border-b last:border-0">
      <span className="text-sm">{label}</span>
      <Badge variant={variant as "default" | "destructive" | "outline"}>
        {ok === true ? "on" : ok === false ? "off" : "n/a"}
      </Badge>
    </div>
  );
}

/**
 * Ops posture dashboard — health + production flags (no secrets).
 */
export default function PlatformOpsPage() {
  const [loading, setLoading] = useState(true);
  const [health, setHealth] = useState<Health | null>(null);

  const load = async () => {
    try {
      const res = await fetch("/api/health", { cache: "no-store" });
      const json = await res.json();
      setHealth(json);
      if (res.status >= 500) toast.error("Health endpoint degraded");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Health check failed");
      setHealth(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  if (loading) return <LoadingState message="Loading ops posture…" />;

  const p = health?.checks?.platform;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Platform Ops"
        description="Health · production flags · worker readiness — Phase 5 ops surface"
        actions={
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setLoading(true);
              void load();
            }}
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Activity className="h-4 w-4" /> Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Badge
              variant={
                health?.status === "healthy" ? "default" : "destructive"
              }
            >
              {health?.status || "unknown"}
            </Badge>
            <p className="text-xs text-muted-foreground mt-2">
              v{health?.version || "—"} · {health?.durationMs ?? "—"} ms
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Server className="h-4 w-4" /> Supabase
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Badge
              variant={health?.checks?.supabase?.ok ? "default" : "destructive"}
            >
              {health?.checks?.supabase?.ok ? "ok" : "down"}
            </Badge>
            <p className="text-xs text-muted-foreground mt-2">
              Latency: {health?.checks?.supabase?.latencyMs ?? "—"} ms
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Shield className="h-4 w-4" /> Production safe
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Badge
              variant={
                p?.productionSafe === true
                  ? "default"
                  : p?.productionSafe === false
                    ? "destructive"
                    : "outline"
              }
            >
              {p?.productionSafe === true
                ? "yes"
                : p?.productionSafe === false
                  ? "no"
                  : "dev"}
            </Badge>
            <p className="text-xs text-muted-foreground mt-2">
              MFA + dual-control + sandbox off
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Hardening flags</CardTitle>
        </CardHeader>
        <CardContent>
          <Flag ok={p?.mfaEnforcePrivileged} label="MFA_ENFORCE_PRIVILEGED" />
          <Flag ok={p?.dualControlRequired} label="DUAL_CONTROL_REQUIRED" />
          <Flag
            ok={p?.paymentSandbox === false || p?.paymentSandbox == null}
            label="Payment sandbox disabled"
          />
          <Flag ok={p?.jobWorkerSecret} label="JOB_WORKER_SECRET configured" />
          <Flag ok={p?.redisRateLimit} label="Upstash Redis rate limits" />
          <Flag ok={p?.aiCopilot} label="AI copilot configured" />
          <Flag ok={health?.checks?.resend?.configured} label="Resend email" />
          <Flag ok={health?.checks?.env?.ok} label="Core env present" />
        </CardContent>
      </Card>

      <Card className="border-dashed">
        <CardContent className="pt-4 text-sm text-muted-foreground space-y-1">
          <p>
            Run quarterly DR drill:{" "}
            <code className="text-xs bg-muted px-1 rounded">
              npm run drill:dr
            </code>
          </p>
          <p>
            Job worker:{" "}
            <code className="text-xs bg-muted px-1 rounded">
              POST /api/jobs/worker
            </code>{" "}
            with <code className="text-xs">x-job-secret</code>
          </p>
          <p>
            See{" "}
            <code className="text-xs">docs/PRODUCTION_HARDENING_RUNBOOK.md</code>{" "}
            and <code className="text-xs">docs/PENTEST_READINESS.md</code>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
