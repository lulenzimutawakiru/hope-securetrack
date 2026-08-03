"use client";

import { ModuleError } from "@/components/ui/module-error";

export default function RecycleBinError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ModuleError error={error} reset={reset} title="Recycle bin module error" />;
}
