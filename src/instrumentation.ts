/**
 * Next.js instrumentation hook - loads Sentry in serverless + edge runtimes.
 *
 * Manual wiring (no `withSentryConfig`): init happens here for Node/edge so
 * unhandled errors and uncaught exceptions in API routes, server components
 * and the jobs worker are captured. The browser config is loaded separately
 * via <SentryClientInit /> in the root layout.
 *
 * Requires SENTRY_DSN (or NEXT_PUBLIC_SENTRY_DSN) to be set; init is a no-op
 * without a DSN.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("../sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("../sentry.edge.config");
  }
}
