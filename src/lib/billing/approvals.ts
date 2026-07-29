/**
 * Multi-level invoice approval workflow.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export const APPROVAL_ROLES = [
  { step: 1, role: "finance_officer", label: "Finance Officer" },
  { step: 2, role: "finance_manager", label: "Finance Manager" },
  { step: 3, role: "director", label: "Director" },
  { step: 4, role: "ceo", label: "CEO" },
] as const;

export async function submitForApproval(
  supabase: SupabaseClient,
  invoiceId: string,
  actorId?: string | null,
  comments?: string
) {
  const { data: inv, error } = await supabase
    .from("invoices")
    .select("*")
    .eq("id", invoiceId)
    .single();
  if (error || !inv) throw error || new Error("Invoice not found");

  const amount = Number(inv.total_amount || 0);
  const { data: steps } = await supabase
    .from("bill_approval_steps")
    .select("*")
    .eq("company_id", inv.company_id)
    .eq("is_active", true)
    .order("step_order");

  const required = (steps || []).filter(
    (s) => amount >= Number(s.min_amount || 0)
  );
  const first = required[0] || { step_order: 1, role_name: "finance_officer" };

  await supabase.from("bill_approval_actions").insert({
    company_id: inv.company_id,
    invoice_id: invoiceId,
    step_order: 0,
    role_name: "submitter",
    action: "submit",
    comments: comments || "Submitted for approval",
    actor_id: actorId || null,
  });

  // Snapshot version
  await supabase.from("bill_invoice_versions").insert({
    company_id: inv.company_id,
    invoice_id: invoiceId,
    version_no: Number(inv.version_no || 1),
    snapshot_json: inv,
    change_note: "Submitted for approval",
    created_by: actorId || null,
  });

  const { data, error: uErr } = await supabase
    .from("invoices")
    .update({
      approval_status: `pending_${first.role_name}`,
      approval_level: first.step_order,
      status: inv.status === "draft" ? "draft" : inv.status,
      updated_at: new Date().toISOString(),
    })
    .eq("id", invoiceId)
    .select()
    .single();
  if (uErr) throw uErr;
  return data;
}

export async function actOnApproval(
  supabase: SupabaseClient,
  input: {
    invoice_id: string;
    action: "approve" | "reject" | "return";
    role_name: string;
    comments?: string;
    signature_data?: string;
    actor_id?: string | null;
  }
) {
  const { data: inv, error } = await supabase
    .from("invoices")
    .select("*")
    .eq("id", input.invoice_id)
    .single();
  if (error || !inv) throw error || new Error("Invoice not found");

  await supabase.from("bill_approval_actions").insert({
    company_id: inv.company_id,
    invoice_id: input.invoice_id,
    step_order: inv.approval_level || 1,
    role_name: input.role_name,
    action: input.action,
    comments: input.comments || null,
    signature_data: input.signature_data || null,
    actor_id: input.actor_id || null,
  });

  if (input.action === "reject" || input.action === "return") {
    const { data } = await supabase
      .from("invoices")
      .update({
        approval_status: input.action === "reject" ? "rejected" : "none",
        approval_level: 0,
        updated_at: new Date().toISOString(),
      })
      .eq("id", input.invoice_id)
      .select()
      .single();
    return data;
  }

  // approve — advance or complete
  const amount = Number(inv.total_amount || 0);
  const { data: steps } = await supabase
    .from("bill_approval_steps")
    .select("*")
    .eq("company_id", inv.company_id)
    .eq("is_active", true)
    .order("step_order");

  const required = (steps || []).filter(
    (s) => amount >= Number(s.min_amount || 0)
  );
  const currentIdx = required.findIndex(
    (s) => s.step_order === inv.approval_level
  );
  const next = required[currentIdx + 1];

  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
    version_no: Number(inv.version_no || 1) + 1,
  };

  if (input.role_name === "finance_officer" || input.role_name === "finance_manager") {
    patch.finance_signature = input.signature_data || inv.finance_signature;
  }
  if (input.role_name === "director" || input.role_name === "ceo") {
    patch.manager_signature = input.signature_data || inv.manager_signature;
  }

  if (next) {
    patch.approval_status = `pending_${next.role_name}`;
    patch.approval_level = next.step_order;
  } else {
    patch.approval_status = "approved";
    patch.approval_level = inv.approval_level;
    patch.status = "issued";
    patch.approved_at = new Date().toISOString();
    patch.approved_by = input.actor_id || null;
    patch.locked_at = new Date().toISOString();
    patch.locked_by = input.actor_id || null;
  }

  const { data, error: uErr } = await supabase
    .from("invoices")
    .update(patch)
    .eq("id", input.invoice_id)
    .select()
    .single();
  if (uErr) throw uErr;
  return data;
}
