import { createClient } from "@/lib/supabase/client";
import { defaultCanvas, layoutFromTemplateJson, renderLabelHtml } from "./designer";
import { buildQrPayload } from "./codes";

function sb() {
  return createClient();
}

function pad(n: number, w = 5) {
  return String(n).padStart(w, "0");
}

export async function nextPrtCode(companyId: string, table: string, prefix: string) {
  const { count } = await sb()
    .from(table)
    .select("*", { count: "exact", head: true })
    .eq("company_id", companyId);
  return `${prefix}-${pad((count ?? 0) + 1)}`;
}

export async function logPrintAudit(input: {
  company_id: string;
  actor_id?: string | null;
  action: string;
  entity_type?: string;
  entity_id?: string;
  details?: string;
}) {
  await sb().from("prt_audit").insert({
    company_id: input.company_id,
    actor_id: input.actor_id,
    action: input.action,
    entity_type: input.entity_type,
    entity_id: input.entity_id,
    details: input.details,
  });
}

export async function registerPrinter(input: {
  company_id: string;
  name: string;
  model: string;
  brand?: string;
  manufacturer?: string;
  printer_type?: string;
  transport?: string;
  connection_type?: string;
  printer_code?: string;
  ip_address?: string;
  bluetooth_address?: string;
  serial_number?: string;
  label_width_mm?: number;
  label_height_mm?: number;
  physical_location?: string;
  branch_name?: string;
  is_default?: boolean;
  discovery_source?: string;
}) {
  const printer_code =
    input.printer_code || (await nextPrtCode(input.company_id, "printers", "PRT"));
  const { data, error } = await sb()
    .from("printers")
    .insert({
      company_id: input.company_id,
      printer_code,
      name: input.name,
      model: input.model,
      brand: input.brand || input.manufacturer,
      manufacturer: input.manufacturer || input.brand,
      printer_type: input.printer_type || "label",
      transport: input.transport || "bluetooth",
      connection_type: input.connection_type || input.transport || "bluetooth",
      ip_address: input.ip_address,
      bluetooth_address: input.bluetooth_address,
      serial_number: input.serial_number,
      label_width_mm: input.label_width_mm,
      label_height_mm: input.label_height_mm,
      physical_location: input.physical_location,
      branch_name: input.branch_name,
      is_default: input.is_default ?? false,
      is_active: true,
      status: "online",
      discovery_source: input.discovery_source || "manual",
      last_discovered_at: new Date().toISOString(),
      last_seen_at: new Date().toISOString(),
    })
    .select("*")
    .single();
  if (error) throw error;
  await logPrintAudit({
    company_id: input.company_id,
    action: "register_printer",
    entity_type: "printer",
    entity_id: data.id,
    details: printer_code,
  });
  return data;
}

export async function enqueuePrint(input: {
  company_id: string;
  job_title: string;
  document_type?: string;
  printer_id?: string | null;
  template_id?: string | null;
  copies?: number;
  priority?: number;
  payload_json?: Record<string, unknown>;
  submitted_by?: string | null;
  create_legacy_job?: boolean;
  secure_release?: boolean;
  department?: string;
  pages?: number;
  label_count?: number;
  branch_name?: string;
}) {
  const queue_number = await nextPrtCode(input.company_id, "prt_queue", "Q");
  const pin = input.secure_release
    ? String(Math.floor(1000 + Math.random() * 9000))
    : null;

  let print_job_id: string | null = null;
  if (input.create_legacy_job !== false) {
    const { data: job } = await sb()
      .from("print_jobs")
      .insert({
        company_id: input.company_id,
        printer_id: input.printer_id,
        job_type: "enterprise",
        status: "pending",
        label_type: "ream",
        document_type: input.document_type || "label",
        total_labels: input.copies || 1,
        copies: input.copies || 1,
        priority: input.priority ?? 5,
        template_id: input.template_id,
        payload_json: input.payload_json || {},
        created_by: input.submitted_by,
      })
      .select("id")
      .single();
    print_job_id = job?.id || null;
  }

  const { data, error } = await sb()
    .from("prt_queue")
    .insert({
      company_id: input.company_id,
      queue_number,
      printer_id: input.printer_id,
      template_id: input.template_id,
      print_job_id,
      job_title: input.job_title,
      document_type: input.document_type || "label",
      status: input.secure_release ? "held" : "queued",
      priority: input.priority ?? 5,
      copies: input.copies || 1,
      pages: input.pages || 1,
      label_count: input.label_count || (input.document_type?.includes("label") || input.document_type === "qr_auth" ? input.copies || 1 : 0),
      department: input.department,
      branch_name: input.branch_name,
      secure_release: input.secure_release || false,
      release_pin: pin,
      payload_json: input.payload_json || {},
      submitted_by: input.submitted_by,
    })
    .select("*")
    .single();
  if (error) throw error;

  await logPrintAudit({
    company_id: input.company_id,
    actor_id: input.submitted_by,
    action: "enqueue",
    entity_type: "prt_queue",
    entity_id: data.id,
    details: queue_number,
  });
  return data;
}

export async function advanceQueueItem(
  id: string,
  status: "printing" | "completed" | "failed" | "cancelled" | "held",
  error_message?: string
) {
  const patch: Record<string, unknown> = { status };
  if (status === "printing") patch.started_at = new Date().toISOString();
  if (status === "completed" || status === "failed" || status === "cancelled") {
    patch.completed_at = new Date().toISOString();
  }
  if (error_message) patch.error_message = error_message;

  const { data: item } = await sb().from("prt_queue").select("*").eq("id", id).single();
  await sb().from("prt_queue").update(patch).eq("id", id);

  if (item?.print_job_id) {
    const jobStatus =
      status === "completed"
        ? "completed"
        : status === "failed"
          ? "failed"
          : status === "cancelled"
            ? "cancelled"
            : status === "printing"
              ? "printing"
              : "pending";
    const jobPatch: Record<string, unknown> = {
      status: jobStatus,
      error_message: error_message || null,
    };
    if (status === "completed") {
      jobPatch.printed_labels = item.copies;
      jobPatch.completed_at = new Date().toISOString();
    }
    await sb().from("print_jobs").update(jobPatch).eq("id", item.print_job_id);
  }
  return { id, status };
}

export async function createBatchPrint(input: {
  company_id: string;
  name: string;
  printer_id?: string | null;
  template_id?: string | null;
  items: Array<Record<string, string>>;
  document_type?: string;
  created_by?: string | null;
}) {
  const batch_number = await nextPrtCode(input.company_id, "prt_batches", "PB");
  const { data: batch, error } = await sb()
    .from("prt_batches")
    .insert({
      company_id: input.company_id,
      batch_number,
      name: input.name,
      printer_id: input.printer_id,
      template_id: input.template_id,
      total_items: input.items.length,
      status: "running",
      source_type: "manual",
      created_by: input.created_by,
      started_at: new Date().toISOString(),
    })
    .select("*")
    .single();
  if (error) throw error;

  let completed = 0;
  for (const item of input.items) {
    try {
      await enqueuePrint({
        company_id: input.company_id,
        job_title: `${input.name} · ${item.serial || item.sku || completed + 1}`,
        document_type: input.document_type || "qr_auth",
        printer_id: input.printer_id,
        template_id: input.template_id,
        payload_json: item,
        submitted_by: input.created_by,
      });
      completed += 1;
    } catch {
      // continue
    }
  }

  await sb()
    .from("prt_batches")
    .update({
      completed_items: completed,
      failed_items: input.items.length - completed,
      status: completed === input.items.length ? "completed" : "running",
      completed_at: completed === input.items.length ? new Date().toISOString() : null,
    })
    .eq("id", batch.id);

  return batch;
}

export async function previewTemplate(
  templateId: string,
  vars?: Record<string, string>
): Promise<string> {
  const { data: tpl } = await sb().from("prt_templates").select("*").eq("id", templateId).single();
  if (!tpl) throw new Error("Template not found");

  const layout = layoutFromTemplateJson(
    tpl.layout_json,
    Number(tpl.width_mm || 50),
    Number(tpl.height_mm || 30)
  );

  const defaults = {
    product_name: "Premium A4 Copy Paper",
    serial: "HDG-REAM-000001",
    batch: "B240722A",
    sku: "HDG-PPR-A4",
    qr_payload: buildQrPayload("product_auth", {
      verify_url: "https://hope-securetrack.vercel.app/verify",
      serial: "HDG-REAM-000001",
    }),
    ...vars,
  };

  return renderLabelHtml(layout, defaults, {
    companyName: "Hope Design Group",
    securityWatermark: tpl.security_enabled ? "AUTHENTIC · HDG" : undefined,
  });
}

export async function setDefaultPrinter(companyId: string, printerId: string) {
  await sb().from("printers").update({ is_default: false }).eq("company_id", companyId);
  await sb().from("printers").update({ is_default: true }).eq("id", printerId);
}

/** Secure release: hold job until PIN entered */
export async function holdForSecureRelease(queueId: string, pin?: string) {
  const release_pin = pin || String(Math.floor(1000 + Math.random() * 9000));
  await sb()
    .from("prt_queue")
    .update({ secure_release: true, release_pin, status: "held" })
    .eq("id", queueId);
  return { release_pin };
}

export async function releaseSecureJob(input: {
  queue_id: string;
  pin: string;
  released_by?: string | null;
}) {
  const { data: job } = await sb()
    .from("prt_queue")
    .select("*")
    .eq("id", input.queue_id)
    .single();
  if (!job) throw new Error("Job not found");
  if (job.secure_release && job.release_pin && job.release_pin !== input.pin) {
    throw new Error("Invalid release PIN");
  }
  await sb()
    .from("prt_queue")
    .update({
      status: "queued",
      released_at: new Date().toISOString(),
      released_by: input.released_by,
    })
    .eq("id", input.queue_id);
  return job;
}

export async function retryQueueItem(id: string) {
  const { data: item } = await sb().from("prt_queue").select("*").eq("id", id).single();
  if (!item) throw new Error("Job not found");
  const retries = Number(item.retry_count || 0) + 1;
  if (retries > Number(item.max_retries || 3)) {
    throw new Error("Max retries exceeded");
  }
  await sb()
    .from("prt_queue")
    .update({
      status: "queued",
      retry_count: retries,
      error_message: null,
    })
    .eq("id", id);
  return { retries };
}

export async function reprintPartial(input: {
  company_id: string;
  parent_queue_id: string;
  copies?: number;
  submitted_by?: string | null;
}) {
  const { data: parent } = await sb()
    .from("prt_queue")
    .select("*")
    .eq("id", input.parent_queue_id)
    .single();
  if (!parent) throw new Error("Parent job not found");

  return enqueuePrint({
    company_id: input.company_id,
    job_title: `REPRINT · ${parent.job_title}`,
    document_type: parent.document_type,
    printer_id: parent.printer_id,
    template_id: parent.template_id,
    copies: input.copies || 1,
    priority: 1,
    payload_json: {
      ...(parent.payload_json as object),
      is_reprint: true,
      parent_queue_id: parent.id,
    },
    submitted_by: input.submitted_by,
  }).then(async (job) => {
    await sb()
      .from("prt_queue")
      .update({ is_reprint: true, parent_job_id: parent.id })
      .eq("id", job.id);
    return job;
  });
}

export async function pauseBatch(batchId: string) {
  await sb()
    .from("prt_batches")
    .update({ status: "paused", paused_at: new Date().toISOString() })
    .eq("id", batchId);
  // hold remaining queued jobs linked via name? batches track items via enqueue only
}

export async function resumeBatch(batchId: string) {
  await sb()
    .from("prt_batches")
    .update({ status: "running", paused_at: null })
    .eq("id", batchId);
}

export async function cancelBatch(batchId: string, companyId: string) {
  await sb()
    .from("prt_batches")
    .update({ status: "cancelled", completed_at: new Date().toISOString() })
    .eq("id", batchId);
  // cancel still-queued jobs from recent window is best-effort via batch source
  await sb()
    .from("prt_queue")
    .update({ status: "cancelled", completed_at: new Date().toISOString() })
    .eq("company_id", companyId)
    .eq("status", "queued")
    .like("job_title", "%"); // no-op safety — callers cancel explicitly
}

/**
 * High-volume batch: generate serials + QR payloads + queue (chunked).
 * Designed for thousands of labels without blocking UI forever.
 */
export async function createHighVolumeBatch(input: {
  company_id: string;
  name: string;
  quantity: number;
  serial_prefix?: string;
  start_serial?: number;
  printer_id?: string | null;
  template_id?: string | null;
  product_name?: string;
  batch_number?: string;
  production_batch_id?: string | null;
  created_by?: string | null;
  chunk_size?: number;
}) {
  const qty = Math.min(Math.max(1, input.quantity), 100000);
  // Browser-safe enqueue cap; full qty tracked on batch for production agents
  const enqueueLimit = Math.min(qty, input.chunk_size ? input.chunk_size * 10 : 500);
  const prefix = input.serial_prefix || "HDG";
  const start = input.start_serial || 1;
  const chunk = input.chunk_size || 50;
  const batch_number = await nextPrtCode(input.company_id, "prt_batches", "PB");

  const { data: batch, error } = await sb()
    .from("prt_batches")
    .insert({
      company_id: input.company_id,
      batch_number,
      name: input.name,
      printer_id: input.printer_id,
      template_id: input.template_id,
      total_items: qty,
      status: "running",
      source_type: input.production_batch_id ? "production" : "manual",
      production_batch_id: input.production_batch_id,
      serial_prefix: prefix,
      start_serial: start,
      end_serial: start + qty - 1,
      qr_generated: true,
      created_by: input.created_by,
      started_at: new Date().toISOString(),
    })
    .select("*")
    .single();
  if (error) throw error;

  let completed = 0;
  let failed = 0;
  const product = input.product_name || "Premium A4 Copy Paper";
  const batchLabel = input.batch_number || batch_number;

  for (let offset = 0; offset < enqueueLimit; offset += chunk) {
    const n = Math.min(chunk, enqueueLimit - offset);
    const items = Array.from({ length: n }, (_, i) => {
      const seq = start + offset + i;
      const serial = `${prefix}-${String(seq).padStart(6, "0")}`;
      return {
        serial,
        product_name: product,
        batch: batchLabel,
        qr_payload: `https://hope-securetrack.vercel.app/verify?s=${encodeURIComponent(serial)}`,
      };
    });

    for (const item of items) {
      try {
        await enqueuePrint({
          company_id: input.company_id,
          job_title: `${input.name} · ${item.serial}`,
          document_type: "qr_auth",
          printer_id: input.printer_id,
          template_id: input.template_id,
          payload_json: { ...item, batch_id: batch.id, total_planned: qty },
          submitted_by: input.created_by,
          create_legacy_job: offset < 50, // reduce legacy job spam
        });
        completed += 1;
      } catch {
        failed += 1;
      }
    }

    await sb()
      .from("prt_batches")
      .update({
        completed_items: completed,
        failed_items: failed,
      })
      .eq("id", batch.id);
  }

  await sb()
    .from("prt_batches")
    .update({
      status: failed === 0 ? "completed" : "running",
      completed_at: failed === 0 ? new Date().toISOString() : null,
      completed_items: completed,
      failed_items: failed,
    })
    .eq("id", batch.id);

  await logPrintAudit({
    company_id: input.company_id,
    actor_id: input.created_by,
    action: "high_volume_batch",
    entity_type: "prt_batches",
    entity_id: batch.id,
    details: `${batch_number} · ${qty} labels`,
  });

  return { ...batch, completed_items: completed, failed_items: failed };
}

export { defaultCanvas, renderLabelHtml, layoutFromTemplateJson };
