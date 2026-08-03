"use client";

import { ModuleError } from "@/components/ui/module-error";

export default function CommunicationsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ModuleError error={error} reset={reset} title="Communications module error" />;
}
