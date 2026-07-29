/** ERP event → print automation */

import { createClient } from "@/lib/supabase/client";
import { enqueuePrint, nextPrtCode } from "./service";

export const AUTOMATION_EVENTS = [
  { value: "production_complete", label: "Production completes" },
  { value: "grn_received", label: "Goods received" },
  { value: "invoice_approved", label: "Invoice approved" },
  { value: "po_issued", label: "Purchase order issued" },
  { value: "employee_hired", label: "Employee hired" },
  { value: "id_approved", label: "ID approved" },
  { value: "asset_registered", label: "Asset registered" },
  { value: "shipment_dispatched", label: "Shipment dispatched" },
] as const;

function sb() {
  return createClient();
}

/**
 * Fire automation rules for an ERP event. Creates queue jobs for matching active rules.
 */
export async function firePrintAutomation(input: {
  company_id: string;
  trigger_event: string;
  source_ref?: string;
  payload?: Record<string, unknown>;
  submitted_by?: string | null;
}): Promise<{ fired: number; queueIds: string[] }> {
  const { data: rules } = await sb()
    .from("prt_automation_rules")
    .select("*")
    .eq("company_id", input.company_id)
    .eq("trigger_event", input.trigger_event)
    .eq("is_active", true)
    .order("priority");

  const queueIds: string[] = [];
  let fired = 0;

  for (const rule of rules || []) {
    try {
      const job = await enqueuePrint({
        company_id: input.company_id,
        job_title: `${rule.name} · ${input.source_ref || input.trigger_event}`,
        document_type: rule.document_type || "label",
        printer_id: rule.printer_id,
        template_id: rule.template_id,
        copies: rule.copies || 1,
        priority: rule.priority || 5,
        payload_json: {
          automation: true,
          trigger_event: input.trigger_event,
          source_ref: input.source_ref,
          ...(input.payload || {}),
        },
        submitted_by: input.submitted_by,
      });

      // secure release if configured
      if (rule.secure_release) {
        const pin = String(Math.floor(1000 + Math.random() * 9000));
        await sb()
          .from("prt_queue")
          .update({ secure_release: true, release_pin: pin, status: "held" })
          .eq("id", job.id);
      }

      await sb().from("prt_automation_log").insert({
        company_id: input.company_id,
        rule_id: rule.id,
        trigger_event: input.trigger_event,
        source_ref: input.source_ref,
        queue_id: job.id,
        status: "fired",
        details: rule.rule_code,
      });

      queueIds.push(job.id);
      fired += 1;
    } catch (err) {
      await sb().from("prt_automation_log").insert({
        company_id: input.company_id,
        rule_id: rule.id,
        trigger_event: input.trigger_event,
        source_ref: input.source_ref,
        status: "failed",
        details: err instanceof Error ? err.message : "error",
      });
    }
  }

  return { fired, queueIds };
}

export async function pickFailoverPrinter(
  companyId: string,
  preferredId?: string | null
): Promise<string | null> {
  if (preferredId) {
    const { data: preferred } = await sb()
      .from("printers")
      .select("id,status")
      .eq("id", preferredId)
      .maybeSingle();
    if (preferred && preferred.status === "online") return preferred.id;
  }

  // least_queue among online printers
  const { data: printers } = await sb()
    .from("printers")
    .select("id")
    .eq("company_id", companyId)
    .eq("is_active", true)
    .eq("status", "online");

  if (!printers?.length) return preferredId || null;

  let best: string | null = null;
  let bestCount = Infinity;
  for (const p of printers) {
    const { count } = await sb()
      .from("prt_queue")
      .select("*", { count: "exact", head: true })
      .eq("printer_id", p.id)
      .in("status", ["queued", "printing", "held"]);
    const c = count ?? 0;
    if (c < bestCount) {
      bestCount = c;
      best = p.id;
    }
  }
  return best;
}

export async function checkQuota(input: {
  company_id: string;
  department?: string;
  pages?: number;
  labels?: number;
}): Promise<{ allowed: boolean; reason?: string }> {
  const keys: Array<{ type: string; key: string }> = [
    { type: "company", key: "ALL" },
  ];
  if (input.department) keys.push({ type: "department", key: input.department });

  for (const k of keys) {
    const { data: q } = await sb()
      .from("prt_quotas")
      .select("*")
      .eq("company_id", input.company_id)
      .eq("scope_type", k.type)
      .eq("scope_key", k.key)
      .eq("is_active", true)
      .maybeSingle();
    if (!q) continue;
    if (input.pages && Number(q.used_pages) + input.pages > Number(q.max_pages)) {
      return { allowed: false, reason: `${k.key} page quota exceeded` };
    }
    if (input.labels && Number(q.used_labels) + input.labels > Number(q.max_labels)) {
      return { allowed: false, reason: `${k.key} label quota exceeded` };
    }
  }
  return { allowed: true };
}

export async function consumeQuota(input: {
  company_id: string;
  department?: string;
  pages?: number;
  labels?: number;
}) {
  const scopes = [{ type: "company", key: "ALL" }];
  if (input.department) scopes.push({ type: "department", key: input.department });

  for (const s of scopes) {
    const { data: q } = await sb()
      .from("prt_quotas")
      .select("*")
      .eq("company_id", input.company_id)
      .eq("scope_type", s.type)
      .eq("scope_key", s.key)
      .maybeSingle();
    if (!q) continue;
    await sb()
      .from("prt_quotas")
      .update({
        used_pages: Number(q.used_pages) + (input.pages || 0),
        used_labels: Number(q.used_labels) + (input.labels || 0),
      })
      .eq("id", q.id);
  }
}

export { nextPrtCode };
