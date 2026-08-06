/**
 * Shared authentication for platform worker / cron endpoints.
 *
 * Security model (fail closed):
 *  - The only accepted credential is a real shared secret
 *    (JOB_WORKER_SECRET / CRON_SECRET) presented via `x-job-secret` or
 *    `Authorization: Bearer`.
 *  - Platform headers (`User-Agent: vercel-cron/1.0`, `x-vercel-cron-schedule`)
 *    are NEVER used for authentication: they are trivially spoofable and
 *    previously allowed unauthenticated payroll / notification processing.
 *  - When no secret is configured the endpoint refuses to run. Local
 *    development must set the env var; there is no network-visible dev bypass.
 *  - Secret comparison is constant-time.
 */

import { NextRequest } from "next/server";
import { timingSafeEqualString } from "./shared";

export function resolveWorkerSecret(): string {
  return (
    process.env.JOB_WORKER_SECRET?.trim() ||
    process.env.CRON_SECRET?.trim() ||
    ""
  );
}

export function authorizeWorkerRequest(
  req: NextRequest,
  secret: string
): boolean {
  if (!secret) return false;
  const provided =
    req.headers.get("x-job-secret") ||
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
    "";
  const trimmed = provided.trim();
  if (!trimmed) return false;
  return timingSafeEqualString(trimmed, secret);
}
