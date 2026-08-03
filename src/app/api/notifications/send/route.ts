import { z } from "zod";
import { NextResponse } from "next/server";
import { apiError, createApiHandler } from "@/lib/api/handler";
import { notifyUsers, notifyFromEvent } from "@/lib/notifications/service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const schema = z.object({
  title: z.string().min(1).max(255).optional(),
  message: z.string().optional(),
  user_ids: z.array(z.string().uuid()).optional(),
  channels: z
    .array(z.enum(["in_app", "email", "sms", "push", "whatsapp"]))
    .optional(),
  category: z.string().optional(),
  priority: z.enum(["low", "normal", "high", "urgent"]).optional(),
  type: z
    .enum(["info", "warning", "error", "success", "fraud_alert"])
    .optional(),
  link: z.string().optional(),
  action_label: z.string().optional(),
  template_key: z.string().optional(),
  vars: z.record(z.union([z.string(), z.number(), z.null()])).optional(),
  event_key: z.string().optional(),
  force: z.boolean().optional(),
  all_users: z.boolean().optional(),
});

export const POST = createApiHandler(
  {
    auth: true,
    permissions: [
      "communications.manage",
      "comm.manage",
      "notifications.manage",
      "settings.manage",
      "iam.manage",
    ],
    allowPlatformAdmin: true,
    bodySchema: schema,
    rateLimit: { limit: 40, windowMs: 60_000 },
    module: "notifications",
  },
  async ({ ctx, body }) => {
    if (!ctx) return apiError("UNAUTHORIZED", "Sign in required", 401);
    const data = body as z.infer<typeof schema>;
    const companyId = ctx.companyId;

    if (
      data.all_users &&
      !ctx.isPlatformAdmin &&
      !ctx.permissions.includes("iam.manage")
    ) {
      return apiError(
        "FORBIDDEN",
        "Broadcast to all users requires iam.manage",
        403
      );
    }

    try {
      if (data.event_key) {
        const result = await notifyFromEvent({
          companyId,
          eventKey: data.event_key,
          vars: data.vars,
          actorUserId: ctx.user.id,
          createdBy: ctx.user.id,
        });
        return NextResponse.json({ ok: true, mode: "event", ...result });
      }

      if (!data.title) {
        return apiError(
          "VALIDATION",
          "title is required when event_key is not set"
        );
      }

      let userIds = data.user_ids;
      if (data.all_users) {
        userIds = undefined;
      } else if (!userIds?.length) {
        userIds = [ctx.user.id];
      }

      const result = await notifyUsers({
        companyId,
        userIds: data.all_users ? undefined : userIds,
        title: data.title,
        message: data.message,
        channels: data.channels,
        category: data.category,
        priority: data.priority,
        type: data.type,
        link: data.link,
        actionLabel: data.action_label,
        templateKey: data.template_key,
        vars: data.vars,
        createdBy: ctx.user.id,
        force: data.force,
        sourceModule: "api",
        sourceEvent: "manual.send",
      });

      return NextResponse.json({ ok: true, mode: "direct", ...result });
    } catch (e) {
      return apiError(
        "INTERNAL",
        e instanceof Error ? e.message : "Notification send failed",
        500
      );
    }
  }
);
