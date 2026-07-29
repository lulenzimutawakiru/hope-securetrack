"use client";

import { cn } from "@/lib/utils";

type Props = {
  children: React.ReactNode;
  className?: string;
  /** Tighter padding for dense grids */
  dense?: boolean;
};

/** Consistent responsive page container for ERP modules */
export function PageShell({ children, className, dense }: Props) {
  return (
    <div
      className={cn(
        "enterprise-container w-full",
        dense ? "space-y-4" : "space-y-6",
        className
      )}
    >
      {children}
    </div>
  );
}

export function SectionTitle({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        {description && (
          <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
        )}
      </div>
      {action}
    </div>
  );
}
