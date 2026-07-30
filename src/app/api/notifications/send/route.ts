import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
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
  type: z.enum(["info", "warning", "error", "success", "fraud_alert"]).optional(),
  link: z.string().optional(),
  action_label: z.string().optional(),
  template_key: z.string().optional(),
  vars: z.record(z.union([z.string(), z.number(), z.null()])).optional(),
  /** Fire automation rule by event key */
  event_key: z.string().optional(),
  force: z.boolean().optional(),
  all_users: z.boolean().optional(),
});

export async function POST(req: NextRequest) {
  const { requireApiAuth } = await import("@/lib/security/api-auth");
  const { clientIp, rateLimit } = await import("@/lib/api");

  const ip = clientIp(req);
  const rl = rateLimit(`notif-send:${ip}`, 40, 60_000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded" },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec || 60) } }
    );
  }

  const auth = await requireApiAuth({
    permissions: [
      "communications.manage",
      "comm.manage",
      "notifications.manage",
      "settings.manage",
      "iam.manage",
    ],
    allowPlatformAdmin: true,
  });
  if ("response" in auth) return auth.response;
  const { ctx } = auth;

  const supabase = await createClient();
  const user = ctx.user;

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("company_id, role_id, roles!user_profiles_role_id_fkey(slug)")
    .eq("id", user.id)
    .single();

  if (!profile?.company_id && !ctx.companyId) {
    return NextResponse.json({ error: "No company" }, { status: 400 });
  }

  const companyId = profile?.company_id || ctx.companyId;

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const body = parsed.data;

  // all_users requires elevated permission
  if (body.all_users && !ctx.isPlatformAdmin && !ctx.permissions.includes("iam.manage")) {
    return NextResponse.json(
      { error: "Broadcast to all users requires iam.manage" },
      { status: 403 }
    );
  }

  try {
    if (body.event_key) {
      const result = await notifyFromEvent({
        companyId: companyId,
        eventKey: body.event_key,
        vars: body.vars,
        actorUserId: user.id,
        createdBy: user.id,
      });
      return NextResponse.json({ ok: true, mode: "event", ...result });
    }

    if (!body.title) {
      return NextResponse.json(
        { error: "title is required when event_key is not set" },
        { status: 400 }
      );
    }

    let userIds = body.user_ids;
    if (body.all_users) {
      userIds = undefined; // service resolves all
    } else if (!userIds?.length) {
      userIds = [user.id];
    }

    const result = await notifyUsers({
      companyId: companyId,
      userIds: body.all_users ? undefined : userIds,
      title: body.title,
      message: body.message,
      channels: body.channels,
      category: body.category,
      priority: body.priority,
      type: body.type,
      link: body.link,
      actionLabel: body.action_label,
      templateKey: body.template_key,
      vars: body.vars,
      createdBy: user.id,
      force: body.force,
      sourceModule: "api",
      sourceEvent: "manual.send",
    });

    return NextResponse.json({ ok: true, mode: "direct", ...result });
  } catch (e) {
    return NextResponse.json(
      {
        error: e instanceof Error ? e.message : "Notification send failed",
      },
      { status: 500 }
    );
  }
}
