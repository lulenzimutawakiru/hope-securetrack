"use client";

/**
 * Dashboard CTA that nudges tenants still mid-onboarding back into the
 * Welcome Experience. Reads the tenant-scoped welcome state from the API;
 * hides itself once the wizard reaches 100% / completed status.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { useUser } from "@/hooks/use-user";
import { apiGet } from "@/lib/api-client";

type WelcomePayload = {
  state?: {
    status?: string;
    current_step?: string;
  };
  progress?: number;
  summary?: {
    organization_name?: string | null;
    plan_name?: string | null;
  } | null;
};

export function WelcomeCta() {
  const { auth, loading: authLoading, hasPermission } = useUser();
  const [data, setData] = useState<WelcomePayload | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading || !auth) return;
    const canView =
      hasPermission("settings.view") ||
      hasPermission("settings.manage") ||
      hasPermission("settings.admin") ||
      hasPermission("dashboard.view");
    if (!canView) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    apiGet<WelcomePayload>("/api/v2/welcome")
      .then((res) => {
        if (cancelled) return;
        if (res.ok) setData(res.data);
      })
      .catch(() => {
        // Non-fatal — the dashboard renders fine without the CTA.
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [auth, authLoading, hasPermission]);

  if (authLoading || loading || !data) return null;
  const progress = data.progress ?? 0;
  const status = data.state?.status;
  if (progress >= 100 || status === "completed") return null;
  const pct = Math.min(100, Math.max(0, progress));

  return (
    <Link
      href="/welcome"
      className="group relative block overflow-hidden rounded-2xl border border-primary/30 bg-gradient-to-r from-primary/15 via-primary/5 to-background p-4 shadow-enterprise-sm transition-shadow hover:shadow-enterprise-lg sm:p-5"
    >
      <div className="relative flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <p className="text-sm font-semibold">Finish your enterprise setup</p>
          </div>
          <p className="max-w-xl text-xs text-muted-foreground">
            Your workspace is {pct}% configured
            {data.summary?.organization_name ? ` for ${data.summary.organization_name}` : ""}.
            Continue the guided AI onboarding to activate finance, security, teams and reports.
          </p>
          <div className="flex items-center gap-2 pt-0.5">
            <Progress value={pct} className="h-1.5 w-40" />
            <span className="text-xs font-medium tabular-nums text-muted-foreground">{pct}%</span>
          </div>
        </div>
        <span className="inline-flex items-center gap-1 text-sm font-medium text-primary">
          Continue setup
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </span>
      </div>
    </Link>
  );
}
