"use client";

import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { TrendingDown, TrendingUp, Minus } from "lucide-react";

type Props = {
  title: string;
  value: string | number;
  description?: string;
  icon?: LucideIcon;
  trend?: "up" | "down" | "flat";
  trendLabel?: string;
  tone?: "default" | "success" | "warning" | "danger" | "info";
  className?: string;
  href?: string;
};

const toneRing: Record<NonNullable<Props["tone"]>, string> = {
  default: "from-accent/10 to-transparent",
  success: "from-success/15 to-transparent",
  warning: "from-warning/15 to-transparent",
  danger: "from-danger/15 to-transparent",
  info: "from-info/15 to-transparent",
};

export function KpiMetric({
  title,
  value,
  description,
  icon: Icon,
  trend,
  trendLabel,
  tone = "default",
  className,
}: Props) {
  const TrendIcon =
    trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : Minus;

  return (
    <div
      className={cn(
        "surface-card relative overflow-hidden p-4 sm:p-5 transition-shadow hover:shadow-enterprise",
        className
      )}
    >
      <div
        className={cn(
          "pointer-events-none absolute inset-0 bg-gradient-to-br opacity-80",
          toneRing[tone]
        )}
      />
      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="text-overline">{title}</p>
          <p className="text-2xl sm:text-3xl font-semibold tracking-tight tabular-nums truncate">
            {value}
          </p>
          {(description || trendLabel) && (
            <div className="flex flex-wrap items-center gap-1.5 text-caption">
              {trend && (
                <span
                  className={cn(
                    "inline-flex items-center gap-0.5 font-medium",
                    trend === "up" && "text-success",
                    trend === "down" && "text-danger",
                    trend === "flat" && "text-muted-foreground"
                  )}
                >
                  <TrendIcon className="h-3.5 w-3.5" />
                  {trendLabel}
                </span>
              )}
              {description && <span>{description}</span>}
            </div>
          )}
        </div>
        {Icon && (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/5 text-primary dark:bg-primary/10">
            <Icon className="h-5 w-5" />
          </div>
        )}
      </div>
    </div>
  );
}
