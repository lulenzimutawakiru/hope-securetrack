"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { ScreenshotFrame } from "./screenshot-frame";
import { ANALYTICS_VIEWS } from "@/lib/marketing/data";

export function AnalyticsShowcase() {
  const [activeId, setActiveId] = useState(ANALYTICS_VIEWS[0].id);
  const active = ANALYTICS_VIEWS.find((v) => v.id === activeId) ?? ANALYTICS_VIEWS[0];

  return (
    <div className="overflow-hidden rounded-2xl border border-border/60 bg-background/70 shadow-xl shadow-primary/5">
      <div className="flex flex-wrap gap-1.5 border-b border-border/60 p-3">
        {ANALYTICS_VIEWS.map((view) => (
          <button
            key={view.id}
            type="button"
            onClick={() => setActiveId(view.id)}
            className={cn(
              "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
              view.id === activeId
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border/70 text-muted-foreground hover:border-primary/40 hover:text-foreground",
            )}
            aria-pressed={view.id === activeId}
          >
            <view.icon className="h-3.5 w-3.5" aria-hidden="true" />
            {view.label}
          </button>
        ))}
      </div>
      <div className="grid gap-4 p-4 sm:p-6 lg:grid-cols-[1.6fr_1fr]">
        <ScreenshotFrame
          src="/screenshots/analytics.jpg"
          alt={`SecureTrack ERP analytics studio view for ${active.label}`}
          title={`Analytics Studio · ${active.label}`}
          badge="Live"
          className="h-full"
          imageClassName="min-h-72 lg:min-h-80"
        />
        <Card className="border-border/60">
          <CardContent className="p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{active.label}</p>
            <h3 className="mt-1 text-xl font-bold tracking-tight">Live analytics, real data</h3>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{active.caption}</p>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-border/60 p-3">
                <p className="text-xs text-muted-foreground">Data source</p>
                <p className="mt-1 text-sm font-bold">Live ERP data</p>
              </div>
              <div className="rounded-xl border border-border/60 p-3">
                <p className="text-xs text-muted-foreground">AI forecast</p>
                <p className="mt-1 text-sm font-bold text-primary">Built in</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}