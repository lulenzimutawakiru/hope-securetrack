import { z } from "zod";
import { apiError, apiOk, createApiHandler } from "@/lib/api/handler";
import {
  approveDualControlRequest,
  createDualControlRequest,
  listPendingDualControl,
} from "@/lib/security/dual-control";

export const dynamic = "force-dynamic";

const PERMS = [
  "security.dual_control",
  "security.admin",
  "iam.manage",
  "finance.approve",
  "payroll.approve",
] as const;

const createSchema = z.object({
  op: z.literal("create").optional(),
  action: z.string().min(3).max(80),
  subject_type: z.string().optional(),
  subject_id: z.string().uuid().optional(),
  payload: z.record(z.unknown()).optional(),
  notes: z.string().max(2000).optional(),
});

const approveSchema = z.object({
  op: z.literal("approve"),
  request_id: z.string().uuid(),
  approve: z.boolean(),
  notes: z.string().max(2000).optional(),
});

const postSchema = z.union([approveSchema, createSchema]);

export const GET = createApiHandler(
  {
    auth: true,
    permissions: [...PERMS],
    allowPlatformAdmin: true,
    requireMfa: "privileged",
    module: "security",
  },
  async ({ ctx }) => {
    if (!ctx) return apiError("UNAUTHORIZED", "Sign in required", 401);
    const rows = await listPendingDualControl(ctx.companyId);
    return apiOk({ items: rows });
  }
);

export const POST = createApiHandler(
  {
    auth: true,
    permissions: [...PERMS],
    allowPlatformAdmin: true,
    requireMfa: "privileged",
    bodySchema: postSchema,
    rateLimit: { limit: 40, windowMs: 60_000 },
    module: "security",
  },
  async ({ ctx, body }) => {
    if (!ctx) return apiError("UNAUTHORIZED", "Sign in required", 401);
    const data = body as z.infer<typeof postSchema>;

    try {
      if ("op" in data && data.op === "approve") {
        const row = await approveDualControlRequest({
          request_id: data.request_id,
          checker_id: ctx.user.id,
          company_id: ctx.companyId,
          approve: data.approve,
          notes: data.notes,
        });
        return apiOk({ request: row });
      }

      const created = await createDualControlRequest({
        company_id: ctx.companyId,
        action: data.action,
        maker_id: ctx.user.id,
        subject_type: data.subject_type,
        subject_id: data.subject_id,
        payload: data.payload,
        notes: data.notes,
      });
      return apiOk({ request: created }, { status: 201 });
    } catch (e) {
      return apiError(
        "INTERNAL",
        e instanceof Error ? e.message : "Dual-control failed",
        500
      );
    }
  }
);
