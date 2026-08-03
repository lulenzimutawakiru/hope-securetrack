"use client";

import { ModuleError } from "@/components/ui/module-error";

export default function DispatchError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ModuleError error={error} reset={reset} title="Dispatch module error" />;
}
