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
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("company_id, role_id, roles!user_profiles_role_id_fkey(slug)")
    .eq("id", user.id)
    .single();

  if (!profile?.company_id) {
    return NextResponse.json({ error: "No company" }, { status: 400 });
  }

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

  try {
    if (body.event_key) {
      const result = await notifyFromEvent({
        companyId: profile.company_id,
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
      companyId: profile.company_id,
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
