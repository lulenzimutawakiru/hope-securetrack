"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app-error]", error);
  }, [error]);

  return (
    <div className="min-h-[50vh] flex flex-col items-center justify-center gap-4 p-8 text-center">
      <AlertTriangle className="h-12 w-12 text-destructive" />
      <h2 className="text-xl font-semibold">Something went wrong</h2>
      <p className="text-sm text-muted-foreground max-w-md">
        An unexpected error occurred. Your data is safe. Try again or return to
        the dashboard.
      </p>
      {error.digest && (
        <p className="text-xs font-mono text-muted-foreground">
          Ref: {error.digest}
        </p>
      )}
      <div className="flex gap-2">
        <Button onClick={reset}>Try again</Button>
        <Button variant="outline" onClick={() => (window.location.href = "/dashboard")}>
          Dashboard
        </Button>
      </div>
    </div>
  );
}
