/**
 * Central API route helper — authZ, validation, correlation, rate limit, idempotency.
 * Prefer this for new/mutative routes. Preserves existing route handlers.
 */

import { NextRequest, NextResponse } from "next/server";
import type { z } from "zod";
import {
  requireApiAuth,
  type AuthedContext,
} from "@/lib/security/api-auth";
import {
  apiError,
  apiOk,
  clientIp,
  parseJson,
  rateLimitStrict,
  type ApiErrorCode,
} from "@/lib/api";
import {
  correlationFromRequest,
  log,
  newCorrelationId,
} from "@/lib/observability/logger";
import {
  getIdempotentResponse,
  readIdempotencyKey,
  saveIdempotentResponse,
} from "./idempotency";
import { createClient } from "@/lib/supabase/server";
import { rejectClientTenantSpoof } from "@/lib/tenant/get-tenant-context";

export type ApiHandlerContext = {
  req: NextRequest;
  correlationId: string;
  ip: string;
  ctx?: AuthedContext;
  body?: unknown;
  /** Dynamic route segments from Next.js App Router (e.g. { id: "..." }) */
  params: Record<string, string>;
};

export type ApiHandlerOptions<T extends z.ZodTypeAny | undefined = undefined> = {
  /** Require authenticated session */
  auth?: boolean;
  permissions?: string[];
  allowPlatformAdmin?: boolean;
  requireMfa?: boolean | "privileged";
  /** Rate limit: requests per windowMs */
  rateLimit?: { limit: number; windowMs: number; key?: string };
  /** Zod schema for JSON body (POST/PUT/PATCH) */
  bodySchema?: T;
  /** Enable idempotency-key header handling for successful mutations */
  idempotent?: boolean;
  /** Module tag for logs */
  module?: string;
};

/** Next.js App Router route context (params may be a Promise in Next 15+). */
export type NextRouteContext = {
  params?: Promise<Record<string, string>> | Record<string, string>;
};

function withCorrelation(res: NextResponse, correlationId: string) {
  res.headers.set("x-correlation-id", correlationId);
  return res;
}

async function resolveParams(
  routeCtx?: NextRouteContext
): Promise<Record<string, string>> {
  if (!routeCtx?.params) return {};
  const raw = await Promise.resolve(routeCtx.params);
  if (!raw || typeof raw !== "object") return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (v != null) out[k] = String(v);
  }
  return out;
}

/**
 * Wrap a route handler with enterprise API controls.
 *
 * Supports dynamic segments:
 * ```ts
 * export const POST = createApiHandler({...}, async ({ params, ctx, body }) => {
 *   const id = params.id;
 * });
 * ```
 */
export function createApiHandler<T extends z.ZodTypeAny | undefined = undefined>(
  opts: ApiHandlerOptions<T>,
  handler: (
    args: ApiHandlerContext & {
      body: T extends z.ZodTypeAny ? z.infer<T> : unknown;
      ctx: AuthedContext | undefined;
    }
  ) => Promise<NextResponse>
) {
  return async (
    req: NextRequest,
    routeCtx?: NextRouteContext
  ): Promise<NextResponse> => {
    const correlationId = correlationFromRequest(req) || newCorrelationId();
    const ip = clientIp(req);
    const started = Date.now();
    const params = await resolveParams(routeCtx);

    try {
      if (opts.rateLimit) {
        const key =
          opts.rateLimit.key ||
          `api:${opts.module || "route"}:${ip}`;
        const rl = await rateLimitStrict(
          key,
          opts.rateLimit.limit,
          opts.rateLimit.windowMs
        );
        if (!rl.allowed) {
          return withCorrelation(
            apiError("RATE_LIMIT", "Rate limit exceeded", 429),
            correlationId
          );
        }
      }

      let ctx: AuthedContext | undefined;
      if (opts.auth !== false && opts.auth !== undefined ? opts.auth : opts.permissions) {
        const auth = await requireApiAuth({
          permissions: opts.permissions,
          allowPlatformAdmin: opts.allowPlatformAdmin,
          requireMfa: opts.requireMfa,
        });
        if ("response" in auth) {
          auth.response.headers.set("x-correlation-id", correlationId);
          return auth.response;
        }
        ctx = auth.ctx;
      } else if (opts.auth === true) {
        const auth = await requireApiAuth({
          allowPlatformAdmin: opts.allowPlatformAdmin,
          requireMfa: opts.requireMfa,
        });
        if ("response" in auth) {
          auth.response.headers.set("x-correlation-id", correlationId);
          return auth.response;
        }
        ctx = auth.ctx;
      }

      // Idempotency (auth required to scope by company)
      const idempKey = opts.idempotent ? readIdempotencyKey(req) : null;
      if (idempKey && ctx?.companyId) {
        const sb = await createClient();
        const cached = await getIdempotentResponse(sb, idempKey, ctx.companyId);
        if (cached) {
          const res = NextResponse.json(cached.body, { status: cached.status });
          res.headers.set("x-idempotent-replay", "true");
          return withCorrelation(res, correlationId);
        }
      }

      let body: unknown = undefined;
      if (opts.bodySchema && ["POST", "PUT", "PATCH"].includes(req.method)) {
        let raw: unknown;
        try {
          raw = await req.json();
        } catch {
          return withCorrelation(
            apiError("VALIDATION", "Invalid JSON"),
            correlationId
          );
        }
        // Never trust client tenant_id as authority
        rejectClientTenantSpoof(raw);
        const parsed = parseJson(opts.bodySchema, raw);
        if (!parsed.success) {
          return withCorrelation(
            apiError("VALIDATION", parsed.error),
            correlationId
          );
        }
        body = parsed.data;
        // Force ownership fields after parse if object
        if (body && typeof body === "object" && ctx) {
          const b = body as Record<string, unknown>;
          if ("tenant_id" in b) b.tenant_id = ctx.tenantId;
          if ("company_id" in b && ctx.companyId) {
            // Only overwrite if client tried to set different company without elevation
            if (
              b.company_id &&
              String(b.company_id) !== ctx.companyId &&
              !ctx.isElevated
            ) {
              return withCorrelation(
                apiError(
                  "FORBIDDEN",
                  "company_id outside active company is not allowed",
                  403
                ),
                correlationId
              );
            }
            b.company_id = ctx.companyId;
          }
        }
      }

      const res = await handler({
        req,
        correlationId,
        ip,
        ctx,
        params,
        body: body as T extends z.ZodTypeAny ? z.infer<T> : unknown,
      });

      res.headers.set("x-correlation-id", correlationId);

      if (idempKey && ctx?.companyId && res.status >= 200 && res.status < 300) {
        try {
          const clone = res.clone();
          const json = await clone.json();
          const sb = await createClient();
          await saveIdempotentResponse(sb, idempKey, ctx.companyId, res.status, json);
        } catch {
          /* non-blocking */
        }
      }

      log.info("api.request", {
        correlationId,
        module: opts.module,
        action: req.method,
        companyId: ctx?.companyId,
        userId: ctx?.user.id,
        durationMs: Date.now() - started,
        path: req.nextUrl.pathname,
      });

      return res;
    } catch (e) {
      log.error("api.unhandled", {
        correlationId,
        module: opts.module,
        error: e instanceof Error ? e.message : String(e),
        durationMs: Date.now() - started,
      });
      return withCorrelation(
        apiError(
          "INTERNAL" as ApiErrorCode,
          e instanceof Error ? e.message : "Internal error",
          500
        ),
        correlationId
      );
    }
  };
}

export { apiOk, apiError };
