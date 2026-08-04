/**
 * WhatsApp-to-ticket webhook (shared secret, no user session).
 *   POST /api/v2/servicedesk/webhooks/whatsapp
 * Headers: x-webhook-secret (SD_WEBHOOK_SECRET | JOB_WORKER_SECRET),
 *          x-company-id (UUID)
 * Body: { external_id?, from_address?, subject, body?, category?,
 *         service_type?, ticket_type?, auto_convert? (default true),
 *         metadata? }
 */

import { NextRequest, NextResponse } from "next/server";
import { handleServiceDeskWebhook } from "@/lib/service-desk/webhook";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest): Promise<NextResponse> {
  return handleServiceDeskWebhook(req, "whatsapp");
}