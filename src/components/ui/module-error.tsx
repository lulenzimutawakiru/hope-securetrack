"use client";

import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Shared module-level error fallback for Next.js error.tsx boundaries and
 * inline query failures. Renders the error message plus an optional retry.
 */
export function ModuleError({
  error,
  reset,
  title = "Something went wrong",
  className,
}: {
  error?: Error & { digest?: string };
  reset?: () => void;
  title?: string;
  className?: string;
}) {
  return (
    <div
      className={`flex flex-col items-center justify-center gap-4 rounded-lg border border-destructive/30 bg-destructive/5 p-12 text-center ${className ?? ""}`}
    >
      <AlertTriangle className="h-8 w-8 text-destructive" />
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="max-w-md text-sm text-muted-foreground">
        {error?.message ?? "An unexpected error occurred. Please try again."}
      </p>
      {reset && (
        <Button variant="outline" size="sm" onClick={reset}>
          Try again
        </Button>
      )}
    </div>
  );
}
