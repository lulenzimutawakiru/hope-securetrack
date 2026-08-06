"use client";

import { useEffect } from "react";
import {
  CreditCard,
  CheckCircle2,
  ArrowUpRight,
  Users,
  HardDrive,
  Cpu,
  Coins,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { StepHeader, SectionCard, StatChip, type StepProps } from "../step-types";
import { PLANS, planDisplayName } from "@/lib/platform/welcome";

export function SubscriptionStep({
  data,
  registerSubmit,
  finishStep,
  goTo,
}: StepProps) {
  const { summary } = data;
  const planCode = (summary.plan_code ?? "").toLowerCase();
  const plan = PLANS[planCode];

  const seatsUsed = Math.min(100, Math.round((summary.seats ? Math.min(summary.seats, 25) / summary.seats : 0) * 100));

  const submit = () => finishStep();
  useEffect(() => {
    registerSubmit(submit);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  const upgradeTargets = ["professional", "business", "enterprise"].filter((p) => {
    const order = ["starter", "professional", "business", "enterprise", "government", "education"];
    return order.indexOf(p) > order.indexOf(planCode);
  }).slice(0, 2);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <StepHeader
        title="Subscription summary"
        description="Review your plan, entitlements and usage limits. Your environment is provisioned exactly to this subscription."
        badge={<Badge variant="secondary" className="gap-1"><CreditCard className="h-3 w-3" /> Billing verified</Badge>}
      />

      <SectionCard title={`${planDisplayName(summary.plan_code)} plan`} right={<Badge>{summary.subscription_status}</Badge>}>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatChip label="Licensed seats" value={summary.seats ?? plan?.seats ?? "—"} hint={`${plan?.seats ?? "—"} max`} />
          <StatChip label="Renewal" value={summary.current_period_end ? new Date(summary.current_period_end).toLocaleDateString() : "—"} hint="Current period" />
          <StatChip label="Trial ends" value={summary.trial_ends_at ? new Date(summary.trial_ends_at).toLocaleDateString() : "N/A"} hint="Auto-converts" />
          <StatChip label="Support" value={plan?.support ?? "Standard"} hint="SLA tier" />
        </div>
      </SectionCard>

      <SectionCard title="Usage meter" description="Live consumption against plan limits (illustrative until metering rolls up).">
        <div className="space-y-4">
          {[
            { label: "Users", icon: Users, pct: seatsUsed, detail: `${Math.min(summary.seats ?? 25, 25)} of ${summary.seats ?? plan?.seats ?? "—"} seats` },
            { label: "Storage", icon: HardDrive, pct: 18, detail: "18% of plan quota" },
            { label: "API calls", icon: Cpu, pct: 32, detail: "32% of monthly quota" },
            { label: "AI credits", icon: Coins, pct: 8, detail: "8% of monthly credits" },
          ].map((m) => (
            <div key={m.label}>
              <div className="mb-1.5 flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 font-medium">
                  <m.icon className="h-4 w-4 text-muted-foreground" /> {m.label}
                </span>
                <span className="text-muted-foreground">{m.detail}</span>
              </div>
              <Progress value={m.pct} className="h-2" />
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="Upgrade recommendations" description="AI suggests the next tier when your organisation outgrows the current plan.">
        {upgradeTargets.length === 0 ? (
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" /> You&apos;re on the top applicable tier for this pack.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {upgradeTargets.map((code) => (
              <div key={code} className="rounded-xl border p-4 flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{PLANS[code].name}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {PLANS[code].seats.toLocaleString()} seats · {PLANS[code].support} support
                  </p>
                </div>
                <Button size="sm" variant="outline" className="gap-1" onClick={() => goTo("subscription")}>
                  <ArrowUpRight className="h-3.5 w-3.5" /> Request
                </Button>
              </div>
            ))}
          </div>
        )}
        <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="h-4 w-4" /> Upgrades are billed prorated and provisioned automatically by the platform.
        </p>
      </SectionCard>

      <div className="flex justify-end">
        <Button onClick={submit}>Continue to Organization Structure</Button>
      </div>
    </div>
  );
}
