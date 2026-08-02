"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";
import { reportError } from "@/lib/audit";
import { EN } from "@/lib/translations/en";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app-error]", error);
    // Report to server‑side audit log
    reportError(error).catch(console.error);
  }, [error]);

  return (
    <div className="min-h-[50vh] flex flex-col items-center justify-center gap-4 p-8 text-center">
      <AlertTriangle className="h-12 w-12 text-destructive" />
      <h2 className="text-xl font-semibold">{EN.error.heading}</h2>
      <p className="text-sm text-muted-foreground max-w-md">
        {EN.error.description}
      </p>
      {error.digest && (
        <p className="text-xs font-mono text-muted-foreground">
          {EN.error.ref(error.digest)}
        </p>
      )}
      <div className="flex gap-2">
        <Button onClick={reset}>{EN.error.tryAgain}</Button>
        <Button
          variant="outline"
          onClick={() => (window.location.href = "/dashboard")}
        >
          {EN.error.dashboard}
        </Button>
      </div>
    </div>
  );
}
