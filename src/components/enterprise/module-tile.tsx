"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  title: string;
  description: string;
  href: string;
  icon: LucideIcon;
  badge?: string;
  className?: string;
};

export function ModuleTile({
  title,
  description,
  href,
  icon: Icon,
  badge,
  className,
}: Props) {
  return (
    <Link
      href={href}
      className={cn(
        "group surface-card flex flex-col gap-3 p-4 sm:p-5 transition-all hover:border-accent/40 hover:shadow-enterprise focus-visible:ring-2 focus-visible:ring-ring",
        className
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10 text-accent">
          <Icon className="h-5 w-5" />
        </div>
        {badge && (
          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
            {badge}
          </span>
        )}
      </div>
      <div className="space-y-1 flex-1">
        <p className="font-semibold text-sm sm:text-base group-hover:text-accent transition-colors">
          {title}
        </p>
        <p className="text-caption line-clamp-2">{description}</p>
      </div>
      <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground group-hover:text-accent">
        Open
        <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
      </span>
    </Link>
  );
}
