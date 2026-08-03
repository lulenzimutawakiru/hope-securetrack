import { z } from "zod";
import { apiError, apiOk, createApiHandler } from "@/lib/api/handler";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildLabelQrValue } from "@/lib/verification";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const schema = z.object({
  batchId: z.string().uuid(),
  printerId: z.string().uuid().optional().nullable(),
  labelType: z.enum(["ream", "carton"]).default("ream"),
  qrCodeIds: z.array(z.string().uuid()).min(1).max(500),
  copies: z.number().int().min(1).max(10).default(1),
});

/** Queue a Niimbot / agent print job with resolved label payloads. */
export const POST = createApiHandler(
  {
    auth: true,
    permissions: [
      "print.operate",
      "print.manage",
      "printing.create",
      "printing.manage",
      "lbl.print",
    ],
    allowPlatformAdmin: true,
    bodySchema: schema,
    rateLimit: { limit: 30, windowMs: 60_000 },
    module: "print",
  },
  async ({ ctx, body }) => {
    if (!ctx) return apiError("UNAUTHORIZED", "Sign in required", 401);
    const data = body as z.infer<typeof schema>;
    const supabase = await createClient();

    const { data: codes, error: codesErr } = await supabase
      .from("qr_codes")
      .select("id, public_uuid, human_serial, code_type, payload, batch_id")
      .in("id", data.qrCodeIds)
      .eq("company_id", ctx.companyId);

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
        company_id: ctx.companyId,
        batch_id: data.batchId,
        printer_id: data.printerId || null,
        job_type: "niimbot_batch",
        status: "queued",
        label_type: data.labelType,
        total_labels: labels.length * data.copies,
        printed_labels: 0,
        created_by: ctx.profile.id,
        metadata: {
          copies: data.copies,
          labels,
          appUrl,
          protocol: "niimbot",
          queuedAt: new Date().toISOString(),
        },
      })
      .select()
      .single();

    if (error) return apiError("INTERNAL", error.message, 500);

    try {
      const admin = createAdminClient();
      await admin.rpc("create_audit_log", {
        p_company_id: ctx.companyId,
        p_user_id: ctx.profile.id,
        p_action: "printing.queue",
        p_module: "printing",
        p_entity_type: "print_job",
        p_entity_id: job.id,
        p_entity_reference: job.id,
        p_after_state: {
          total: labels.length * data.copies,
          printerId: data.printerId,
          batchId: data.batchId,
        },
      });
    } catch {
      /* non-fatal */
    }

    return apiOk({
      jobId: job.id,
      status: job.status,
      totalLabels: labels.length * data.copies,
      labels: labels.length,
    });
  }
);

export const GET = createApiHandler(
  {
    auth: true,
    permissions: [
      "print.view",
      "print.operate",
      "print.manage",
      "printing.create",
    ],
    allowPlatformAdmin: true,
    module: "print",
  },
  async ({ ctx }) => {
    if (!ctx) return apiError("UNAUTHORIZED", "Sign in required", 401);
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("print_jobs")
      .select("*, printers(name, model, status)")
      .eq("company_id", ctx.companyId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) return apiError("INTERNAL", error.message, 500);
    return apiOk(data);
  }
);
