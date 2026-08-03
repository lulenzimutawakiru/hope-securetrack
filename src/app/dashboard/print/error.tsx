"use client";

import { ModuleError } from "@/components/ui/module-error";

export default function PrintError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ModuleError error={error} reset={reset} title="Print module error" />;
}
