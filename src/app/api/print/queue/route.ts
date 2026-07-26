import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { apiError, parseJson } from "@/lib/api";
import { buildLabelQrValue } from "@/lib/verification";
import { env } from "@/lib/env";

const schema = z.object({
  batchId: z.string().uuid(),
  printerId: z.string().uuid().optional().nullable(),
  labelType: z.enum(["ream", "carton"]).default("ream"),
  qrCodeIds: z.array(z.string().uuid()).min(1).max(500),
  copies: z.number().int().min(1).max(10).default(1),
});

/**
 * Queue a Niimbot / agent print job with resolved label payloads.
 * Print agent polls print-agent edge function or this queue via print_jobs.
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return apiError("UNAUTHORIZED", "Sign in required", 401);

    const body = await request.json();
    const parsed = parseJson(schema, body);
    if (!parsed.success) return apiError("VALIDATION", parsed.error, 422);

    const { batchId, printerId, labelType, qrCodeIds, copies } = parsed.data;

    const { data: profile } = await supabase
      .from("user_profiles")
      .select("id, company_id")
      .eq("id", user.id)
      .single();
    if (!profile) return apiError("FORBIDDEN", "No user profile", 403);

    const { data: codes, error: codesErr } = await supabase
      .from("qr_codes")
      .select("id, public_uuid, human_serial, code_type, payload, batch_id")
      .in("id", qrCodeIds)
      .eq("company_id", profile.company_id);

    if (codesErr || !codes?.length) {
      return apiError("NOT_FOUND", "No matching QR codes", 404);
    }

    const appUrl = env.app.url;
    const labels = codes.map((c) => ({
      id: c.id,
      serial: c.human_serial,
      publicUuid: c.public_uuid,
      qrData: buildLabelQrValue(c.public_uuid, appUrl),
      type: c.code_type,
    }));

    const { data: job, error } = await supabase
      .from("print_jobs")
      .insert({
        company_id: profile.company_id,
        batch_id: batchId,
        printer_id: printerId || null,
        job_type: "niimbot_batch",
        status: "queued",
        label_type: labelType,
        total_labels: labels.length * copies,
        printed_labels: 0,
        created_by: profile.id,
        metadata: {
          copies,
          labels,
          appUrl,
          protocol: "niimbot",
          queuedAt: new Date().toISOString(),
        },
      })
      .select()
      .single();

    if (error) return apiError("INTERNAL", error.message, 500);

    // Audit (best-effort via admin RPC)
    try {
      const admin = createAdminClient();
      await admin.rpc("create_audit_log", {
        p_company_id: profile.company_id,
        p_user_id: profile.id,
        p_action: "printing.queue",
        p_module: "printing",
        p_entity_type: "print_job",
        p_entity_id: job.id,
        p_entity_reference: job.id,
        p_after_state: {
          total: labels.length * copies,
          printerId,
          batchId,
        },
      });
    } catch {
      /* non-fatal */
    }

    return NextResponse.json({
      ok: true,
      data: {
        jobId: job.id,
        status: job.status,
        totalLabels: labels.length * copies,
        labels: labels.length,
      },
    });
  } catch (e) {
    return apiError(
      "INTERNAL",
      e instanceof Error ? e.message : "Queue failed",
      500
    );
  }
}

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return apiError("UNAUTHORIZED", "Sign in required", 401);

    const { data, error } = await supabase
      .from("print_jobs")
      .select("*, printers(name, model, status)")
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) return apiError("INTERNAL", error.message, 500);
    return NextResponse.json({ ok: true, data });
  } catch (e) {
    return apiError(
      "INTERNAL",
      e instanceof Error ? e.message : "Failed",
      500
    );
  }
}
