"use client";

import { ModuleError } from "@/components/ui/module-error";

export default function SecurityError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ModuleError error={error} reset={reset} title="Security module error" />;
}
