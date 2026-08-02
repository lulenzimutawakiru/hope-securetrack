"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";
import { reportError } from "@/lib/audit";
import { useTranslations } from "next-intl";
import * as Sentry from "@sentry/nextjs";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations();

  useEffect(() => {
    console.error("[app-error]", error);
    reportError(error).catch(console.error);
    Sentry.captureException(error);
  }, [error]);

  return (
    <div className="min-h-[50vh] flex flex-col items-center justify-center gap-4 p-8 text-center">
      <AlertTriangle className="h-12 w-12 text-destructive" />
      <h2 className="text-xl font-semibold">{t("error.heading")}</h2>
      <p className="text-sm text-muted-foreground max-w-md">
        {t("error.description")}
      </p>
      {error.digest && (
        <p className="text-xs font-mono text-muted-foreground">
          {t("error.ref", { digest: error.digest })}
        </p>
      )}
      <div className="flex gap-2">
        <Button onClick={reset}>{t("error.tryAgain")}</Button>
        <Button
          variant="outline"
          onClick={() => (window.location.href = "/dashboard")}
        >
          {t("error.dashboard")}
        </Button>
      </div>
    </div>
  );
}
