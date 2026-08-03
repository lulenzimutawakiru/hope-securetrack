"use client";

import { ModuleError } from "@/components/ui/module-error";

export default function SettingsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ModuleError error={error} reset={reset} title="Settings module error" />;
}
