"use client";

import { ModuleError } from "@/components/ui/module-error";

export default function PrintingError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ModuleError error={error} reset={reset} title="Printing module error" />;
}
