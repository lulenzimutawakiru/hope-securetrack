"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  Sparkles,
  PlayCircle,
  UploadCloud,
  CalendarClock,
  ArrowRight,
  CheckCircle2,
  Building2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StepHeader, type StepProps } from "../step-types";
import { planDisplayName } from "@/lib/platform/welcome";

export function WelcomeIntroStep({ data, goTo, finishStep }: StepProps) {
  const { summary, state, industry_pack: pack } = data;
  const [starting, setStarting] = useState(false);

  const progress = Object.values(state.steps_progress).filter(
    (p) => p?.status === "completed" || p?.status === "skipped"
  ).length;

  const start = () => {
    setStarting(true);
    finishStep();
  };

  return (
    <div className="mx-auto max-w-3xl">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="space-y-8"
      >
        {/* Hero */}
        <div className="relative overflow-hidden rounded-3xl border bg-gradient-to-br from-primary/10 via-background to-background p-8 sm:p-10">
          <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-primary/10 blur-3xl" />
          <div className="relative space-y-5">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg">
                <Building2 className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">SecureTrack ERP</p>
                <p className="text-lg font-semibold leading-tight">
                  {summary.organization_name}
                </p>
              </div>
            </div>

            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
              Welcome to SecureTrack ERP
            </h1>
            <p className="text-muted-foreground max-w-xl text-sm sm:text-base">
              Your enterprise platform has been successfully provisioned. Let&apos;s configure
              your organization for the{" "}
              <span className="font-semibold text-foreground">{pack.label}</span> industry —
              your AI assistant will guide you every step of the way.
            </p>

            <div className="flex flex-wrap items-center gap-3">
              <Badge variant="outline" className="gap-1">
                <Sparkles className="h-3 w-3" /> {planDisplayName(summary.plan_code)} plan
              </Badge>
              <Badge variant="outline">
                {summary.country_code} · {summary.currency}
              </Badge>
              <Badge variant="outline">
                <CheckCircle2 className="h-3 w-3 mr-1" /> {progress}/
                {Object.keys(state.steps_progress).length} steps done
              </Badge>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="grid gap-3 sm:grid-cols-2">
          <Button size="lg" className="h-14 text-base" onClick={start} disabled={starting}>
            {starting ? "Setting up…" : "Start Setup"}
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
          <Button size="lg" variant="outline" className="h-14 text-base" onClick={() => goTo("organization")}>
            <UploadCloud className="mr-2 h-5 w-5" /> Import Existing ERP
          </Button>
          <Button size="lg" variant="outline" className="h-14 text-base" onClick={() => goTo("training")}>
            <PlayCircle className="mr-2 h-5 w-5" /> Watch Guided Tour
          </Button>
          <Button size="lg" variant="ghost" className="h-14 text-base" onClick={() => finishStep()}>
            <CalendarClock className="mr-2 h-5 w-5" /> Schedule Later
          </Button>
        </div>

        {/* Estimate */}
        <div className="rounded-2xl border p-5">
          <StepHeader
            title="Estimated setup time"
            description="10–20 minutes with AI assistance. Everything is saved automatically — you can resume any time."
            badge={<Badge variant="secondary">Auto-save on</Badge>}
          />
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {[
              { label: "Foundation", value: "~5 min", desc: "Org, plan, structure, security" },
              { label: "Configure", value: "~8 min", desc: "Modules, business, import, AI" },
              { label: "Activate", value: "~4 min", desc: "Training, readiness, go-live" },
            ].map((c) => (
              <div key={c.label} className="rounded-xl border p-4">
                <p className="text-sm font-semibold">{c.label}</p>
                <p className="text-lg font-bold text-primary mt-1">{c.value}</p>
                <p className="text-xs text-muted-foreground mt-1">{c.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
