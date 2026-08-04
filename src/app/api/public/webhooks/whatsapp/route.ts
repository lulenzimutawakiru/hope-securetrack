/**
 * Meta WhatsApp Cloud API webhook (verify + inbound messages).
 * Forwards inbound messages into service-desk inbox when configured.
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { providersConfig } from "@/lib/providers/config";
import { verifyWhatsAppSignature } from "@/lib/providers/comms/whatsapp";
import { ingressRateLimit } from "@/lib/security/public-ingress";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Meta subscription verification */
export async function GET(req: NextRequest) {
  const mode = req.nextUrl.searchParams.get("hub.mode");
  const token = req.nextUrl.searchParams.get("hub.verify_token");
  const challenge = req.nextUrl.searchParams.get("hub.challenge");
  const expected = providersConfig.whatsapp.verifyToken;

  if (mode === "subscribe" && expected && token === expected && challenge) {
    return new NextResponse(challenge, { status: 200 });
  }
  return NextResponse.json({ error: "Verification failed" }, { status: 403 });
}

export async function POST(req: NextRequest) {
  try {
    const rl = await ingressRateLimit("whatsapp-webhook", 300, 60_000, req);
    if (!rl.ok) {
      return NextResponse.json({ error: "Rate limit" }, { status: 429 });
    }

    const rawBody = await req.text();
    const sig = req.headers.get("x-hub-signature-256");
    if (providersConfig.whatsapp.appSecret) {
      if (!verifyWhatsAppSignature(rawBody, sig)) {
        return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
      }
    }

    const body = JSON.parse(rawBody || "{}") as {
      entry?: Array<{
        changes?: Array<{
          value?: {
            messages?: Array<{
              from?: string;
              id?: string;
              timestamp?: string;
              text?: { body?: string };
              type?: string;
            }>;
            contacts?: Array<{ profile?: { name?: string } }>;
          };
        }>;
      }>;
    };

    const admin = createAdminClient();
    const defaultCompany = process.env.DEFAULT_COMPANY_ID || "";

    for (const entry of body.entry || []) {
      for (const change of entry.changes || []) {
        const messages = change.value?.messages || [];
        const contactName =
          change.value?.contacts?.[0]?.profile?.name || "WhatsApp User";
        for (const msg of messages) {
          if (!msg.from || !msg.text?.body) continue;
          // Prefer service-desk inbound table when present
          try {
            await admin.from("sd_inbound_items").insert({
              company_id: defaultCompany || null,
              channel: "whatsapp",
              external_id: msg.id || null,
              from_address: msg.from,
              from_name: contactName,
              subject: "WhatsApp message",
              body: msg.text.body,
              status: "new",
              received_at: new Date(
                Number(msg.timestamp || 0) * 1000 || Date.now()
              ).toISOString(),
              raw_payload: msg,
            });
          } catch {
            /* table optional / company required */
          }
        }
      }
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Webhook failed" },
      { status: 500 }
    );
  }
}
