"use client";

import { useMemo } from "react";
import Link from "next/link";
import {
  PartyPopper, LayoutDashboard, UserPlus, Contact, ShoppingBag, Upload,
  BrainCircuit, Blocks, BarChart3, GraduationCap, HeartPulse, ArrowRight,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StepHeader, SectionCard, StatChip, type StepProps } from "../step-types";

const QUICK_ACTIONS = [
  { label: "Launch Dashboard", href: "/dashboard", icon: LayoutDashboard, description: "Open your ERP workspace" },
  { label: "Invite Users", href: "/dashboard/identity/users", icon: UserPlus, description: "Add your team and assign roles" },
  { label: "Create First Customer", href: "/dashboard/crm/accounts", icon: Contact, description: "Add an account and start selling" },
  { label: "Create First Supplier", href: "/dashboard/procurement", icon: ShoppingBag, description: "Set up vendors and POs" },
  { label: "Import Data", href: "/dashboard/settings/setup", icon: Upload, description: "Bring in existing records" },
  { label: "Configure AI", href: "/dashboard/settings/ai", icon: BrainCircuit, description: "Tune agents and guardrails" },
  { label: "Install Marketplace Apps", href: "/dashboard/settings/modules", icon: Blocks, description: "Extend your platform" },
  { label: "View Reports", href: "/dashboard/reports", icon: BarChart3, description: "Explore BI and dashboards" },
  { label: "Schedule Training", href: "/dashboard/settings/setup", icon: GraduationCap, description: "Book team enablement" },
];

export function SuccessStep({ data }: StepProps) {
  const health = useMemo(() => data.state.health, [data.state.health]);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="relative overflow-hidden rounded-3xl border bg-gradient-to-br from-emerald-500/15 via-background to-background p-8 sm:p-10 text-center">
        <div className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="relative space-y-4">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500 text-white shadow-lg">
            <PartyPopper className="h-8 w-8" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">Congratulations!</h1>
          <p className="mx-auto max-w-xl text-muted-foreground">
            Your SecureTrack ERP environment is ready. {data.summary.organization_name} is provisioned,
            secured and configured for the {data.industry_pack.label} industry.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Badge variant="default" className="gap-1">
              <HeartPulse className="h-3 w-3" /> Health {health?.overall ?? 0}%
            </Badge>
            <Badge variant="outline">Tenant activated</Badge>
            <Badge variant="outline">Backups scheduled</Badge>
          </div>
          <div className="pt-2">
            <Button asChild size="lg" className="h-13 px-6">
              <Link href="/dashboard">
                Launch Dashboard <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
          </div>
        </div>
      </div>

      <SectionCard title="Quick actions" description="Pick up where you left off — everything is one click away.">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {QUICK_ACTIONS.map((a) => {
            const Icon = a.icon;
            return (
              <Link
                key={a.label}
                href={a.href}
                className="group rounded-xl border p-4 transition-colors hover:border-primary/40 hover:bg-muted/40"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="h-[18px] w-[18px]" />
                </div>
                <p className="mt-3 text-sm font-semibold">{a.label}</p>
                <p className="mt-1 text-xs text-muted-foreground">{a.description}</p>
              </Link>
            );
          })}
        </div>
      </SectionCard>

      {health?.recommendations?.length ? (
        <SectionCard title="AI recommendations" description="Continuous onboarding — the assistant keeps optimizing your tenant.">
          <div className="space-y-2">
            {health.recommendations.map((r, i) => (
              <p key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                {r}
              </p>
            ))}
          </div>
        </SectionCard>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-3">
        <StatChip label="Readiness" value={`${data.state.readiness?.overall ?? 0}%`} hint="Configuration completeness" />
        <StatChip label="Modules enabled" value={(data.summary.modules_enabled?.length ?? 0)} hint="Licensed + welcome selection" />
        <StatChip label="Go-live checks" value={`${data.state.readiness?.goLive?.filter((g) => g.done).length ?? 0}/${data.state.readiness?.goLive?.length ?? 0}`} hint="Passed on activation" />
      </div>
    </div>
  );
}