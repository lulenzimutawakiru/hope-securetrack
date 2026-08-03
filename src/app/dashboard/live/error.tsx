"use client";

import { ModuleError } from "@/components/ui/module-error";

export default function LiveError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ModuleError error={error} reset={reset} title="Live module error" />;
}
