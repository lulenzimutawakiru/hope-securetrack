/**
 * Shared module-level loading skeleton for Next.js loading.tsx boundaries
 * and inline suspense fallbacks.
 */
export function ModuleLoading({
  rows = 5,
}: {
  /** Number of table-row skeletons to render. */
  rows?: number;
}) {
  return (
    <div className="space-y-4 p-1" aria-busy="true" aria-label="Loading">
      <div className="h-8 w-64 animate-pulse rounded bg-muted" />
      <div className="h-10 w-full animate-pulse rounded bg-muted" />
      <div className="space-y-2">
        {Array.from({ length: rows }).map((_, i) => (
          <div
            key={i}
            className="h-12 w-full animate-pulse rounded bg-muted/60"
          />
        ))}
      </div>
    </div>
  );
}
