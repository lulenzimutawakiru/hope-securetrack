"use client";

import { useState } from "react";
import {
  Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { ANALYTICS_VIEWS } from "@/lib/marketing/data";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function AnalyticsShowcase() {
  const [activeId, setActiveId] = useState(ANALYTICS_VIEWS[0].id);
  const active = ANALYTICS_VIEWS.find((v) => v.id === activeId) ?? ANALYTICS_VIEWS[0];
  const data = active.points.map((value, i) => ({ month: MONTHS[i], value }));

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
        <div className="h-72 rounded-xl border border-border/50 bg-muted/20 p-4">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
              <defs>
                <linearGradient id="mktArea" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} interval={1} />
              <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} />
              <Tooltip
                cursor={{ stroke: "hsl(var(--primary))", strokeDasharray: "4 4" }}
                contentStyle={{
                  borderRadius: 12,
                  border: "1px solid hsl(var(--border))",
                  background: "hsl(var(--card))",
                  fontSize: 12,
                }}
                labelStyle={{ color: "hsl(var(--muted-foreground))" }}
              />
              <Area type="monotone" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#mktArea)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <Card className="border-border/60">
          <CardContent className="p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{active.label}</p>
            <p className="mt-2 text-3xl font-extrabold tracking-tight">{active.points[active.points.length - 1]}</p>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{active.caption}</p>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-border/60 p-3">
                <p className="text-xs text-muted-foreground">12-mo trend</p>
                <p className="mt-1 text-sm font-bold">+{Math.round(((active.points[11] - active.points[0]) / active.points[0]) * 100)}%</p>
              </div>
              <div className="rounded-xl border border-border/60 p-3">
                <p className="text-xs text-muted-foreground">AI forecast</p>
                <p className="mt-1 text-sm font-bold text-primary">Confident</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}