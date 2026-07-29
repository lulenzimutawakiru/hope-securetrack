import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const schema = z.object({
  email_enabled: z.boolean().optional(),
  in_app_enabled: z.boolean().optional(),
  sms_enabled: z.boolean().optional(),
  push_enabled: z.boolean().optional(),
  whatsapp_enabled: z.boolean().optional(),
  quiet_hours_start: z.string().nullable().optional(),
  quiet_hours_end: z.string().nullable().optional(),
  digest_mode: z.enum(["instant", "hourly", "daily", "weekly"]).optional(),
  digest_hour: z.number().int().min(0).max(23).optional(),
  category_settings: z.record(z.record(z.boolean())).optional(),
  muted_events: z.array(z.string()).optional(),
});

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("company_id")
    .eq("id", user.id)
    .single();

  const { data } = await supabase
    .from("notification_preferences")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  return NextResponse.json({
    preferences: data || {
      email_enabled: true,
      in_app_enabled: true,
      sms_enabled: false,
      push_enabled: false,
      whatsapp_enabled: false,
      digest_mode: "instant",
      digest_hour: 8,
      category_settings: {},
      muted_events: [],
      company_id: profile?.company_id,
      user_id: user.id,
    },
  });
}

export async function PUT(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("company_id")
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

  const payload = {
    company_id: profile.company_id,
    user_id: user.id,
    ...parsed.data,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("notification_preferences")
    .upsert(payload, { onConflict: "company_id,user_id" })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, preferences: data });
}
