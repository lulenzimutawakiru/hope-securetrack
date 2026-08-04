/**
 * Slack Events API endpoint (URL verification + signed events).
 * Public route — signature verified via SLACK_SIGNING_SECRET.
 */

import { NextRequest, NextResponse } from "next/server";
import { verifySlackSignature } from "@/lib/slack";
import { createAdminClient } from "@/lib/supabase/admin";
import { log } from "@/lib/observability/logger";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-slack-signature");
  const timestamp = req.headers.get("x-slack-request-timestamp");

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // URL verification challenge (can arrive before signature is fully configured)
  if (payload.type === "url_verification") {
    const verified = verifySlackSignature({ signature, timestamp, rawBody });
    if (!verified.ok) {
      // Still allow challenge if signing secret not set in some envs — prefer fail closed in prod
      if (process.env.NODE_ENV === "production") {
        return NextResponse.json({ error: verified.error }, { status: 401 });
      }
    }
    return NextResponse.json({ challenge: payload.challenge });
  }

  const verified = verifySlackSignature({ signature, timestamp, rawBody });
  if (!verified.ok) {
    return NextResponse.json({ error: verified.error }, { status: 401 });
  }

  // Event Callback
  if (payload.type === "event_callback") {
    const teamId =
      (payload.team_id as string) ||
      ((payload.authorizations as Array<{ team_id?: string }>)?.[0]?.team_id as
        | string
        | undefined);
    const event = (payload.event || {}) as Record<string, unknown>;
    const eventType = String(event.type || "unknown");

    try {
      const admin = createAdminClient();
      if (teamId) {
        const { data: ws } = await admin
          .from("intg_slack_workspaces")
          .select("id, company_id")
          .eq("team_id", teamId)
          .is("deleted_at", null)
          .eq("is_enabled", true)
          .limit(1)
          .maybeSingle();
        if (ws) {
          await admin.from("intg_events").insert({
            company_id: ws.company_id,
            event_type: `slack.${eventType}`,
            source_module: "slack",
            entity_type: "slack_event",
            payload: {
              team_id: teamId,
              event,
              event_id: payload.event_id,
            },
            status: "received",
          });
        }
      }
    } catch (e) {
      log.warn("slack.events.ingest_failed", {
        error: e instanceof Error ? e.message : String(e),
      });
    }

    // Acknowledge quickly
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: true });
}
