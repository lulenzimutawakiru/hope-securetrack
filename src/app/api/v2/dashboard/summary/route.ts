/**
 * GET /api/v2/dashboard/summary - single-request dashboard aggregate.
 *
 * The dashboard previously fired ~12 parallel CRUD calls, each of which paid
 * the full authN/authZ chain (8+ Supabase round trips). This route resolves
 * the auth context once and runs the same tenant-scoped engine queries in
 * parallel server-side, so the browser makes exactly one round trip.
 */

import { apiError, apiOk, createApiHandler } from "@/lib/api/handler";
import { EngineError } from "@/lib/crud/crud-engine";
import * as engine from "@/lib/crud/crud-engine";
import type { CrudScope } from "@/lib/crud/crud-engine";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type ServerClient = Awaited<ReturnType<typeof createClient>>;

async function countEntity(
  sb: ServerClient,
  scope: CrudScope,
  entity: string,
  filters?: Record<string, unknown>
): Promise<number> {
  const { total } = await engine.listEntities(
    scope,
    entity,
    { page: 1, pageSize: 1, filters },
    { sb }
  );
  return total ?? 0;
}

async function recentEntity(
  sb: ServerClient,
  scope: CrudScope,
  entity: string,
  sort: string
): Promise<Record<string, unknown>[]> {
  const { data } = await engine.listEntities<Record<string, unknown>>(
    scope,
    entity,
    { page: 1, pageSize: 5, sort, order: "desc" },
    { sb }
  );
  return data ?? [];
}

export const GET = createApiHandler(
  {
    auth: true,
    allowPlatformAdmin: true,
    requireMfa: "privileged",
    rateLimit: { limit: 120, windowMs: 60_000 },
    module: "crud",
  },
  async ({ ctx }) => {
    if (!ctx) return apiError("UNAUTHORIZED", "Sign in required", 401);
    const scope: CrudScope = {
      userId: ctx.user.id,
      companyId: ctx.companyId,
      tenantId: ctx.tenantId,
      isElevated: ctx.isElevated,
      isPlatformAdmin: ctx.isPlatformAdmin,
      permissions: ctx.permissions,
    };
    const sb = await createClient();

    const can = (p: string) => ctx.permissions.includes(p);
    // Platform staff bypass the permission gate (engine allows them).
    const granted = (p: string) => ctx.isPlatformAdmin || can(p);
    const canProduction = granted("production.view") || granted("mes.view");
    const canQr = granted("qr.view");
    const canInventory = granted("inventory.view");
    const canFraud = granted("fraud.manage");
    const canVerify = granted("verification.view");
    const canPrint =
      granted("print.view") ||
      granted("printing.create") ||
      granted("lbl.view");

    const today = new Date().toISOString().slice(0, 10);
    const todayStart = `${today}T00:00:00`;

    try {
      const [
        batchesToday,
        batchesInProgress,
        qrGenerated,
        qrPrinted,
        verificationsToday,
        openFraudAlerts,
        inventoryReams,
        inventoryCartons,
        pendingPrintJobs,
        recentBatches,
        recentAlerts,
        recentVerifications,
      ] = await Promise.all([
        canProduction
          ? countEntity(sb, scope, "production_batches", {
              created_at: { gte: todayStart },
            })
          : 0,
        canProduction
          ? countEntity(sb, scope, "production_batches", {
              production_status: ["in_progress", "qc_pending"],
            })
          : 0,
        canQr ? countEntity(sb, scope, "qr_codes") : 0,
        canQr
          ? countEntity(sb, scope, "qr_codes", {
              status: ["printed", "verified", "packed", "dispatched", "sold"],
            })
          : 0,
        canVerify
          ? countEntity(sb, scope, "verification_logs", {
              verified_at: { gte: todayStart },
            })
          : 0,
        canFraud
          ? countEntity(sb, scope, "fraud_alerts", {
              status: ["open", "investigating"],
            })
          : 0,
        canInventory
          ? countEntity(sb, scope, "reams", {
              inventory_status: "in_warehouse",
            })
          : 0,
        canInventory
          ? countEntity(sb, scope, "cartons", {
              inventory_status: "in_warehouse",
            })
          : 0,
        canPrint
          ? countEntity(sb, scope, "print_jobs", {
              status: ["pending", "queued", "printing"],
            })
          : 0,
        canProduction
          ? recentEntity(sb, scope, "production_batches", "created_at")
          : [],
        canFraud ? recentEntity(sb, scope, "fraud_alerts", "created_at") : [],
        canVerify
          ? recentEntity(sb, scope, "verification_logs", "verified_at")
          : [],
      ]);

      return apiOk({
        batchesToday,
        batchesInProgress,
        qrGenerated,
        qrPrinted,
        verificationsToday,
        openFraudAlerts,
        inventoryReams,
        inventoryCartons,
        pendingPrintJobs,
        recentBatches,
        recentAlerts,
        recentVerifications,
      });
    } catch (e) {
      if (e instanceof EngineError) {
        if (e.code === "UNKNOWN_ENTITY" || e.code === "NOT_FOUND") {
          return apiError("NOT_FOUND", e.message, 404);
        }
        if (
          e.code === "MISSING_PERMISSION" ||
          e.code === "FORBIDDEN" ||
          e.code === "CROSS_TENANT" ||
          e.code === "CROSS_COMPANY"
        ) {
          return apiError("FORBIDDEN", e.message, 403);
        }
        return apiError("INTERNAL", e.message, 500);
      }
      return apiError(
        "INTERNAL",
        e instanceof Error ? e.message : "Internal error",
        500
      );
    }
  }
);
