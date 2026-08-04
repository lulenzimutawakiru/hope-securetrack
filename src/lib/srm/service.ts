import { createClient } from "@/lib/supabase/crud-compat";
import { computeOverallScore, predictDisruptionRisk } from "./ai";
import type { NcrInput, OnboardingInput, RiskInput, SupplierInput } from "./types";

function sb() {
  return createClient();
}

function genCode(prefix: string) {
  return `${prefix}-${Date.now().toString(36).toUpperCase()}`;
}

export async function logSrmAudit(input: {
  company_id: string;
  actor_id?: string | null;
  action: string;
  entity_type?: string;
  entity_id?: string;
  details?: string;
}) {
  await sb().from("srm_audit_log").insert({
    company_id: input.company_id,
    actor_id: input.actor_id,
    action: input.action,
    entity_type: input.entity_type,
    entity_id: input.entity_id,
    details: input.details,
  });
}

// ─── Suppliers ───────────────────────────────────────────────

export async function listSuppliers(opts?: {
  search?: string;
  category?: string;
  supplier_class?: string;
  status?: string;
  limit?: number;
}) {
  let q = sb()
    .from("suppliers")
    .select("*")
    .is("deleted_at", null)
    .order("name")
    .limit(opts?.limit ?? 300);
  if (opts?.category) q = q.eq("category", opts.category);
  if (opts?.supplier_class) q = q.eq("supplier_class", opts.supplier_class);
  if (opts?.status) q = q.eq("supplier_status", opts.status);
  if (opts?.search) {
    const s = opts.search.trim();
    q = q.or(`name.ilike.%${s}%,code.ilike.%${s}%,email.ilike.%${s}%`);
  }
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

export async function createSupplier(input: SupplierInput, actorId?: string | null) {
  const code = input.code || genCode("SUP");
  const { data, error } = await sb()
    .from("suppliers")
    .insert({
      company_id: input.company_id,
      code,
      name: input.name,
      trading_name: input.trading_name || null,
      category: input.category || "raw_materials",
      supplier_type: input.supplier_type || "general",
      supplier_class: input.supplier_class || "approved",
      supplier_status: input.supplier_status || "registered",
      contact_person: input.contact_person || null,
      email: input.email || null,
      phone: input.phone || null,
      whatsapp: input.whatsapp || null,
      country: input.country || "Uganda",
      city: input.city || null,
      region: input.region || null,
      currency: input.currency || "UGX",
      preferred_currency: input.currency || "UGX",
      payment_terms_days: input.payment_terms_days ?? 30,
      tin_vat: input.tin_vat || null,
      registration_number: input.registration_number || null,
      notes: input.notes || null,
      is_active: true,
      is_approved_vendor: false,
      on_time_delivery_pct: 100,
      quality_score: 80,
      overall_score: 75,
      risk_score: 50,
    })
    .select("*")
    .single();
  if (error) throw error;

  await addTimeline({
    company_id: input.company_id,
    supplier_id: data.id,
    kind: "system",
    title: "Supplier registered",
    body: `${code} — ${input.name}`,
    actor_id: actorId,
  });

  await logSrmAudit({
    company_id: input.company_id,
    actor_id: actorId,
    action: "supplier.create",
    entity_type: "supplier",
    entity_id: data.id,
    details: code,
  });

  return data;
}

export async function updateSupplier(
  id: string,
  patch: Record<string, unknown>,
  actorId?: string | null
) {
  const { data, error } = await sb()
    .from("suppliers")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  if (data?.company_id) {
    await logSrmAudit({
      company_id: data.company_id as string,
      actor_id: actorId,
      action: "supplier.update",
      entity_type: "supplier",
      entity_id: id,
    });
  }
  return data;
}

export async function approveSupplier(id: string, companyId: string, actorId?: string | null) {
  return updateSupplier(
    id,
    {
      is_approved_vendor: true,
      supplier_status: "approved",
      onboarded_at: new Date().toISOString(),
    },
    actorId
  ).then(async (data) => {
    await addTimeline({
      company_id: companyId,
      supplier_id: id,
      kind: "onboarding",
      title: "Supplier approved",
      actor_id: actorId,
    });
    return data;
  });
}

export async function softDeleteSupplier(id: string, actorId?: string | null) {
  return updateSupplier(id, { deleted_at: new Date().toISOString(), is_active: false }, actorId);
}

export async function restoreSupplier(id: string, actorId?: string | null) {
  return updateSupplier(id, { deleted_at: null, is_active: true, archived_at: null }, actorId);
}

export async function archiveSupplier(id: string, actorId?: string | null) {
  return updateSupplier(
    id,
    { archived_at: new Date().toISOString(), is_active: false, supplier_status: "inactive" },
    actorId
  );
}

export async function suspendSupplier(
  id: string,
  companyId: string,
  reason?: string,
  actorId?: string | null
) {
  const data = await updateSupplier(
    id,
    {
      supplier_status: "suspended",
      is_active: false,
      suspended_at: new Date().toISOString(),
      suspended_reason: reason || "Suspended by procurement",
      is_approved_vendor: false,
    },
    actorId
  );
  await addTimeline({
    company_id: companyId,
    supplier_id: id,
    kind: "system",
    title: "Supplier suspended",
    body: reason,
    actor_id: actorId,
  });
  return data;
}

export async function reactivateSupplier(id: string, companyId: string, actorId?: string | null) {
  const data = await updateSupplier(
    id,
    {
      supplier_status: "active",
      is_active: true,
      suspended_at: null,
      suspended_reason: null,
      is_approved_vendor: true,
      deleted_at: null,
    },
    actorId
  );
  await addTimeline({
    company_id: companyId,
    supplier_id: id,
    kind: "system",
    title: "Supplier reactivated",
    actor_id: actorId,
  });
  return data;
}

export async function mergeSuppliers(input: {
  company_id: string;
  source_id: string;
  target_id: string;
  actor_id?: string | null;
}) {
  await sb().from("srm_contacts").update({ supplier_id: input.target_id }).eq("supplier_id", input.source_id);
  await sb().from("srm_timeline").update({ supplier_id: input.target_id }).eq("supplier_id", input.source_id);
  await sb().from("srm_documents").update({ supplier_id: input.target_id }).eq("supplier_id", input.source_id);
  await sb().from("srm_ncrs").update({ supplier_id: input.target_id }).eq("supplier_id", input.source_id);
  await sb().from("srm_risks").update({ supplier_id: input.target_id }).eq("supplier_id", input.source_id);

  await sb()
    .from("suppliers")
    .update({
      deleted_at: new Date().toISOString(),
      merged_into_id: input.target_id,
      is_active: false,
      supplier_status: "inactive",
    })
    .eq("id", input.source_id);

  await sb().from("srm_merge_log").insert({
    company_id: input.company_id,
    source_supplier_id: input.source_id,
    target_supplier_id: input.target_id,
    actor_id: input.actor_id,
    merged_fields: { contacts: true, timeline: true, documents: true, ncrs: true, risks: true },
  });

  await addTimeline({
    company_id: input.company_id,
    supplier_id: input.target_id,
    kind: "system",
    title: "Duplicate supplier merged",
    body: `Merged source ${input.source_id}`,
    actor_id: input.actor_id,
  });

  await logSrmAudit({
    company_id: input.company_id,
    actor_id: input.actor_id,
    action: "supplier.merge",
    entity_type: "supplier",
    entity_id: input.target_id,
    details: `source=${input.source_id}`,
  });
}

// ─── Contacts ────────────────────────────────────────────────

export async function listContacts(supplierId?: string) {
  let q = sb().from("srm_contacts").select("*").is("deleted_at", null).order("first_name");
  if (supplierId) q = q.eq("supplier_id", supplierId);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

export async function createContact(input: {
  company_id: string;
  supplier_id: string;
  first_name: string;
  last_name?: string;
  role_title?: string;
  contact_role?: string;
  email?: string;
  mobile?: string;
  is_primary?: boolean;
}) {
  const { data, error } = await sb()
    .from("srm_contacts")
    .insert({
      company_id: input.company_id,
      supplier_id: input.supplier_id,
      first_name: input.first_name,
      last_name: input.last_name || null,
      role_title: input.role_title || null,
      contact_role: input.contact_role || "sales",
      email: input.email || null,
      mobile: input.mobile || null,
      is_primary: input.is_primary ?? false,
      is_active: true,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

// ─── Timeline ────────────────────────────────────────────────

export async function addTimeline(input: {
  company_id: string;
  supplier_id?: string | null;
  kind: string;
  title: string;
  body?: string;
  channel?: string;
  amount?: number;
  actor_id?: string | null;
  actor_name?: string;
}) {
  const { data, error } = await sb()
    .from("srm_timeline")
    .insert({
      company_id: input.company_id,
      supplier_id: input.supplier_id || null,
      kind: input.kind,
      title: input.title,
      body: input.body || null,
      channel: input.channel || null,
      amount: input.amount ?? null,
      actor_id: input.actor_id || null,
      actor_name: input.actor_name || null,
      occurred_at: new Date().toISOString(),
    })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function listTimeline(supplierId?: string, limit = 80) {
  let q = sb()
    .from("srm_timeline")
    .select("*")
    .order("occurred_at", { ascending: false })
    .limit(limit);
  if (supplierId) q = q.eq("supplier_id", supplierId);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

// ─── Onboarding ──────────────────────────────────────────────

export async function listOnboarding(opts?: { status?: string }) {
  let q = sb()
    .from("srm_onboarding")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);
  if (opts?.status) q = q.eq("status", opts.status);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

export async function createOnboarding(input: OnboardingInput) {
  const application_number = genCode("ONB");
  const { data, error } = await sb()
    .from("srm_onboarding")
    .insert({
      company_id: input.company_id,
      application_number,
      company_name: input.company_name,
      trading_name: input.trading_name || null,
      category: input.category || "raw_materials",
      contact_name: input.contact_name || null,
      email: input.email || null,
      phone: input.phone || null,
      tin_number: input.tin_number || null,
      vat_number: input.vat_number || null,
      registration_number: input.registration_number || null,
      status: "submitted",
      submitted_at: new Date().toISOString(),
      documents_checklist: {},
      created_by: input.created_by || null,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function reviewOnboarding(
  id: string,
  status: "approved" | "rejected" | "under_review" | "documents_pending",
  opts?: { reason?: string; reviewer_id?: string | null; company_id?: string }
) {
  const patch: Record<string, unknown> = {
    status,
    updated_at: new Date().toISOString(),
    reviewer_id: opts?.reviewer_id || null,
    reviewed_at: new Date().toISOString(),
  };
  if (status === "approved") {
    patch.approved_at = new Date().toISOString();
    patch.approved_by = opts?.reviewer_id || null;
  }
  if (status === "rejected") patch.rejected_reason = opts?.reason || null;

  const { data, error } = await sb()
    .from("srm_onboarding")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;

  // Auto-create supplier on approval if none linked
  if (status === "approved" && !data.supplier_id && opts?.company_id) {
    const sup = await createSupplier(
      {
        company_id: opts.company_id,
        name: data.company_name as string,
        trading_name: (data.trading_name as string) || undefined,
        category: (data.category as string) || undefined,
        contact_person: (data.contact_name as string) || undefined,
        email: (data.email as string) || undefined,
        phone: (data.phone as string) || undefined,
        tin_vat: (data.tin_number as string) || undefined,
        registration_number: (data.registration_number as string) || undefined,
        supplier_status: "approved",
        supplier_class: "approved",
      },
      opts.reviewer_id
    );
    await sb()
      .from("srm_onboarding")
      .update({ supplier_id: sup.id })
      .eq("id", id);
    await approveSupplier(sup.id, opts.company_id, opts.reviewer_id);
  }

  return data;
}

// ─── Documents ───────────────────────────────────────────────

export async function listDocuments(supplierId?: string) {
  let q = sb()
    .from("srm_documents")
    .select("*")
    .is("deleted_at", null)
    .order("expires_at", { ascending: true, nullsFirst: false })
    .limit(200);
  if (supplierId) q = q.eq("supplier_id", supplierId);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

export async function createDocument(input: {
  company_id: string;
  supplier_id: string;
  doc_type: string;
  title: string;
  file_name?: string;
  file_url?: string;
  expires_at?: string;
  uploaded_by?: string | null;
}) {
  const { data, error } = await sb()
    .from("srm_documents")
    .insert({
      company_id: input.company_id,
      supplier_id: input.supplier_id,
      doc_type: input.doc_type,
      title: input.title,
      file_name: input.file_name || null,
      file_url: input.file_url || null,
      expires_at: input.expires_at || null,
      status: "valid",
      version: 1,
      is_latest: true,
      uploaded_by: input.uploaded_by || null,
    })
    .select("*")
    .single();
  if (error) throw error;

  await addTimeline({
    company_id: input.company_id,
    supplier_id: input.supplier_id,
    kind: "document",
    title: `Document uploaded: ${input.title}`,
    actor_id: input.uploaded_by,
  });

  return data;
}

// ─── Quality / NCR ───────────────────────────────────────────

export async function listNcrs(opts?: { status?: string; supplier_id?: string }) {
  let q = sb().from("srm_ncrs").select("*").order("created_at", { ascending: false }).limit(100);
  if (opts?.status) q = q.eq("status", opts.status);
  if (opts?.supplier_id) q = q.eq("supplier_id", opts.supplier_id);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

export async function createNcr(input: NcrInput) {
  const ncr_number = genCode("NCR");
  const { data, error } = await sb()
    .from("srm_ncrs")
    .insert({
      company_id: input.company_id,
      ncr_number,
      supplier_id: input.supplier_id,
      purchase_order_id: input.purchase_order_id || null,
      title: input.title,
      description: input.description || null,
      severity: input.severity || "medium",
      status: "open",
      defect_type: input.defect_type || null,
      quantity_affected: input.quantity_affected ?? 0,
      capa_required: input.capa_required ?? true,
      capa_description: input.capa_description || null,
      capa_due_date: input.capa_due_date || null,
      created_by: input.created_by || null,
    })
    .select("*")
    .single();
  if (error) throw error;

  await addTimeline({
    company_id: input.company_id,
    supplier_id: input.supplier_id,
    kind: "qc",
    title: `NCR opened: ${input.title}`,
    body: ncr_number,
    actor_id: input.created_by,
  });

  return data;
}

export async function updateNcrStatus(id: string, status: string) {
  const patch: Record<string, unknown> = {
    status,
    updated_at: new Date().toISOString(),
  };
  if (status === "closed") patch.closed_at = new Date().toISOString();
  const { data, error } = await sb().from("srm_ncrs").update(patch).eq("id", id).select("*").single();
  if (error) throw error;
  return data;
}

export async function listInspections() {
  const { data, error } = await sb()
    .from("srm_quality_inspections")
    .select("*")
    .order("inspected_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  return data || [];
}

export async function createInspection(input: {
  company_id: string;
  supplier_id?: string | null;
  result: string;
  defect_count?: number;
  defect_rate_pct?: number;
  notes?: string;
  inspector_id?: string | null;
  purchase_order_id?: string | null;
}) {
  const inspection_number = genCode("QI");
  const { data, error } = await sb()
    .from("srm_quality_inspections")
    .insert({
      company_id: input.company_id,
      supplier_id: input.supplier_id || null,
      purchase_order_id: input.purchase_order_id || null,
      inspection_number,
      result: input.result,
      defect_count: input.defect_count ?? 0,
      defect_rate_pct: input.defect_rate_pct ?? 0,
      notes: input.notes || null,
      inspector_id: input.inspector_id || null,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

// ─── Scorecards ──────────────────────────────────────────────

export async function listScorecards() {
  const { data, error } = await sb()
    .from("srm_scorecards")
    .select("*, suppliers(name, code)")
    .order("generated_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  return data || [];
}

export async function generateScorecard(input: {
  company_id: string;
  supplier_id: string;
  factors: {
    on_time_delivery: number;
    delivery_accuracy: number;
    product_quality: number;
    defect_rate: number;
    cost_competitiveness: number;
    invoice_accuracy: number;
    response_time: number;
    contract_compliance: number;
    sustainability: number;
  };
}) {
  const { overall, grade } = computeOverallScore(input.factors);
  const now = new Date();
  const { data, error } = await sb()
    .from("srm_scorecards")
    .upsert(
      {
        company_id: input.company_id,
        supplier_id: input.supplier_id,
        period_year: now.getFullYear(),
        period_month: now.getMonth() + 1,
        ...input.factors,
        overall_score: overall,
        grade,
        generated_at: now.toISOString(),
      },
      { onConflict: "company_id,supplier_id,period_year,period_month" }
    )
    .select("*")
    .single();
  if (error) throw error;

  await sb()
    .from("suppliers")
    .update({
      overall_score: overall,
      on_time_delivery_pct: input.factors.on_time_delivery,
      quality_score: input.factors.product_quality,
      last_review_at: now.toISOString(),
    })
    .eq("id", input.supplier_id);

  return data;
}

// ─── Risks ───────────────────────────────────────────────────

export async function listRisks(opts?: { status?: string }) {
  let q = sb()
    .from("srm_risks")
    .select("*, suppliers(name, code)")
    .order("risk_score", { ascending: false })
    .limit(100);
  if (opts?.status) q = q.eq("status", opts.status);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

export async function createRisk(input: RiskInput) {
  const { data, error } = await sb()
    .from("srm_risks")
    .insert({
      company_id: input.company_id,
      supplier_id: input.supplier_id || null,
      risk_type: input.risk_type,
      title: input.title,
      description: input.description || null,
      likelihood: input.likelihood ?? 3,
      impact: input.impact ?? 3,
      status: "open",
      mitigation: input.mitigation || null,
      owner_id: input.owner_id || null,
    })
    .select("*")
    .single();
  if (error) throw error;

  if (input.supplier_id) {
    await addTimeline({
      company_id: input.company_id,
      supplier_id: input.supplier_id,
      kind: "risk",
      title: `Risk logged: ${input.title}`,
      actor_id: input.owner_id,
    });
  }
  return data;
}

// ─── Insights ────────────────────────────────────────────────

export async function listInsights() {
  const { data, error } = await sb()
    .from("srm_insights")
    .select("*")
    .eq("status", "open")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return data || [];
}

export async function dismissInsight(id: string) {
  const { error } = await sb()
    .from("srm_insights")
    .update({ status: "dismissed", dismissed_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

// ─── Portal ──────────────────────────────────────────────────

export async function enableSupplierPortal(supplierId: string, companyId: string) {
  const token = Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  const { data, error } = await sb()
    .from("suppliers")
    .update({ portal_enabled: true, portal_token: token })
    .eq("id", supplierId)
    .select("*")
    .single();
  if (error) throw error;
  await logSrmAudit({
    company_id: companyId,
    action: "portal.enable",
    entity_type: "supplier",
    entity_id: supplierId,
  });
  return data;
}

export async function listPortalRequests() {
  const { data, error } = await sb()
    .from("srm_portal_requests")
    .select("*, suppliers(name, code)")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  return data || [];
}

// ─── Match logs ──────────────────────────────────────────────

export async function listMatchLogs() {
  const { data, error } = await sb()
    .from("srm_match_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  return data || [];
}

// ─── Categories ──────────────────────────────────────────────

export async function listCategories() {
  const { data, error } = await sb()
    .from("srm_categories")
    .select("*")
    .eq("is_active", true)
    .order("sort_order");
  if (error) throw error;
  return data || [];
}

// ─── Dashboard ───────────────────────────────────────────────

export async function getSrmDashboardStats() {
  const [suppliers, onboarding, ncrs, risks, contracts, openPo, openRfq, insights] =
    await Promise.all([
      sb().from("suppliers").select("*", { count: "exact", head: true }).is("deleted_at", null).eq("is_active", true),
      sb()
        .from("srm_onboarding")
        .select("*", { count: "exact", head: true })
        .in("status", ["submitted", "under_review", "documents_pending"]),
      sb()
        .from("srm_ncrs")
        .select("*", { count: "exact", head: true })
        .in("status", ["open", "investigating", "capa_pending"]),
      sb().from("srm_risks").select("*", { count: "exact", head: true }).eq("status", "open"),
      sb()
        .from("procurement_contracts")
        .select("*", { count: "exact", head: true })
        .eq("status", "active"),
      sb()
        .from("purchase_orders")
        .select("total_amount")
        .not("status", "in", '("closed","cancelled")'),
      sb()
        .from("rfqs")
        .select("*", { count: "exact", head: true })
        .in("status", ["draft", "published"]),
      sb()
        .from("srm_insights")
        .select("*")
        .eq("status", "open")
        .order("created_at", { ascending: false })
        .limit(8),
    ]);

  const poSpend = (openPo.data || []).reduce((s, r) => s + Number(r.total_amount || 0), 0);

  const { data: topSpend } = await sb()
    .from("suppliers")
    .select("id, name, code, spend_ytd, overall_score, risk_score, supplier_class")
    .is("deleted_at", null)
    .order("spend_ytd", { ascending: false })
    .limit(5);

  return {
    activeSuppliers: suppliers.count ?? 0,
    pendingOnboarding: onboarding.count ?? 0,
    openNcrs: ncrs.count ?? 0,
    openRisks: risks.count ?? 0,
    activeContracts: contracts.count ?? 0,
    openPoSpend: poSpend,
    openRfqs: openRfq.count ?? 0,
    insights: insights.data || [],
    topSpend: topSpend || [],
  };
}

export async function refreshSupplierRisk(supplierId: string) {
  const { data: sup } = await sb().from("suppliers").select("*").eq("id", supplierId).maybeSingle();
  if (!sup) throw new Error("Supplier not found");

  const { count } = await sb()
    .from("srm_ncrs")
    .select("*", { count: "exact", head: true })
    .eq("supplier_id", supplierId)
    .in("status", ["open", "investigating", "capa_pending"]);

  const disruption = predictDisruptionRisk({
    on_time_delivery: Number(sup.on_time_delivery_pct),
    supply_risk: Number(sup.supply_risk || 40),
    country_risk: Number(sup.country_risk || 30),
    financial_risk: Number(sup.financial_risk || 40),
    open_ncrs: count ?? 0,
  });

  await sb()
    .from("suppliers")
    .update({ disruption_risk: disruption, risk_score: disruption })
    .eq("id", supplierId);

  return { disruption_risk: disruption };
}

// ─── Approved Registry ───────────────────────────────────────

export async function listRegistryItems() {
  const { data, error } = await sb()
    .from("srm_registry_items")
    .select("*")
    .eq("is_active", true)
    .order("category_code");
  if (error) throw error;
  return data || [];
}

export async function listRegistryApprovals() {
  const { data, error } = await sb()
    .from("srm_registry_approvals")
    .select("*, srm_registry_items(code, name, category_code, criticality), suppliers(name, code)")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  return data || [];
}

export async function approveForRegistry(input: {
  company_id: string;
  registry_item_id: string;
  supplier_id: string;
  approved_until?: string;
  notes?: string;
  approved_by?: string | null;
}) {
  const { data, error } = await sb()
    .from("srm_registry_approvals")
    .upsert(
      {
        company_id: input.company_id,
        registry_item_id: input.registry_item_id,
        supplier_id: input.supplier_id,
        status: "approved",
        approved_until: input.approved_until || null,
        notes: input.notes || null,
        approved_by: input.approved_by || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "registry_item_id,supplier_id" }
    )
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

// ─── Traceability ────────────────────────────────────────────

export async function listMaterialLots(opts?: { supplier_id?: string }) {
  let q = sb()
    .from("srm_material_lots")
    .select("*, suppliers(name, code)")
    .order("received_at", { ascending: false })
    .limit(150);
  if (opts?.supplier_id) q = q.eq("supplier_id", opts.supplier_id);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

export async function createMaterialLot(input: {
  company_id: string;
  supplier_id?: string | null;
  material_name: string;
  category_code?: string;
  quantity?: number;
  uom?: string;
  quality_status?: string;
  warehouse_location?: string;
  notes?: string;
  purchase_order_id?: string | null;
}) {
  const lot_number = genCode("LOT");
  const { data, error } = await sb()
    .from("srm_material_lots")
    .insert({
      company_id: input.company_id,
      lot_number,
      supplier_id: input.supplier_id || null,
      material_name: input.material_name,
      category_code: input.category_code || null,
      quantity: input.quantity ?? 0,
      uom: input.uom || "KG",
      quality_status: input.quality_status || "accepted",
      warehouse_location: input.warehouse_location || null,
      notes: input.notes || null,
      purchase_order_id: input.purchase_order_id || null,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function listTraceLinks(materialLotId?: string) {
  let q = sb()
    .from("srm_trace_links")
    .select("*")
    .order("linked_at", { ascending: false })
    .limit(200);
  if (materialLotId) q = q.eq("material_lot_id", materialLotId);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

export async function addTraceLink(input: {
  company_id: string;
  material_lot_id: string;
  link_type: string;
  ref_code?: string;
  ref_type?: string;
  quantity_used?: number;
  notes?: string;
  created_by?: string | null;
}) {
  const { data, error } = await sb()
    .from("srm_trace_links")
    .insert({
      company_id: input.company_id,
      material_lot_id: input.material_lot_id,
      link_type: input.link_type,
      ref_code: input.ref_code || null,
      ref_type: input.ref_type || null,
      quantity_used: input.quantity_used ?? null,
      notes: input.notes || null,
      created_by: input.created_by || null,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

// ─── Compliance ──────────────────────────────────────────────

export async function listComplianceItems(opts?: { status?: string }) {
  let q = sb()
    .from("srm_compliance_items")
    .select("*, suppliers(name, code)")
    .order("due_date", { ascending: true, nullsFirst: false })
    .limit(200);
  if (opts?.status) q = q.eq("status", opts.status);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

export async function resolveComplianceItem(id: string) {
  const { data, error } = await sb()
    .from("srm_compliance_items")
    .update({
      status: "resolved",
      resolved_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function getComplianceDashboard() {
  const [compliance, docs, ncrs, contracts, risks] = await Promise.all([
    sb().from("srm_compliance_items").select("*").neq("status", "resolved"),
    sb()
      .from("srm_documents")
      .select("id, title, expires_at, supplier_id, doc_type, status")
      .is("deleted_at", null)
      .not("expires_at", "is", null),
    sb()
      .from("srm_ncrs")
      .select("*", { count: "exact", head: true })
      .in("status", ["open", "investigating", "capa_pending"]),
    sb()
      .from("procurement_contracts")
      .select("id, title, end_date, status, supplier_id, value_limit, spend_to_date")
      .eq("status", "active"),
    sb().from("srm_risks").select("*", { count: "exact", head: true }).eq("status", "open"),
  ]);

  const now = Date.now();
  const expiringCerts = (docs.data || []).filter((d) => {
    if (!d.expires_at) return false;
    const days = (new Date(String(d.expires_at)).getTime() - now) / (1000 * 60 * 60 * 24);
    return days <= 60;
  });

  const expiringContracts = (contracts.data || []).filter((c) => {
    if (!c.end_date) return false;
    const days = (new Date(String(c.end_date)).getTime() - now) / (1000 * 60 * 60 * 24);
    return days <= 90;
  });

  const openCompliance = compliance.data || [];
  const overdue = openCompliance.filter(
    (c) => c.due_date && new Date(String(c.due_date)).getTime() < now
  );

  return {
    openCompliance: openCompliance.length,
    overdue: overdue.length,
    expiringCerts: expiringCerts.length,
    expiringContracts: expiringContracts.length,
    openCapas: ncrs.count ?? 0,
    openRisks: risks.count ?? 0,
    items: openCompliance,
    certs: expiringCerts,
    contracts: expiringContracts,
  };
}

// ─── Strategic Collaboration ─────────────────────────────────

export async function listDemandForecasts() {
  const { data, error } = await sb()
    .from("srm_demand_forecasts")
    .select("*, suppliers(name, code)")
    .order("period_year", { ascending: false })
    .order("period_month", { ascending: false })
    .limit(100);
  if (error) throw error;
  return data || [];
}

export async function createDemandForecast(input: {
  company_id: string;
  supplier_id: string;
  period_year: number;
  period_month: number;
  material_code?: string;
  material_name?: string;
  forecast_qty: number;
  uom?: string;
  created_by?: string | null;
}) {
  const { data, error } = await sb()
    .from("srm_demand_forecasts")
    .insert({
      company_id: input.company_id,
      supplier_id: input.supplier_id,
      period_year: input.period_year,
      period_month: input.period_month,
      material_code: input.material_code || null,
      material_name: input.material_name || null,
      forecast_qty: input.forecast_qty,
      uom: input.uom || "KG",
      status: "shared",
      shared_at: new Date().toISOString(),
      created_by: input.created_by || null,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function listCapacityConfirmations() {
  const { data, error } = await sb()
    .from("srm_capacity_confirmations")
    .select("*, suppliers(name, code)")
    .order("period_start", { ascending: false })
    .limit(50);
  if (error) throw error;
  return data || [];
}

export async function listDeliverySlots() {
  const { data, error } = await sb()
    .from("srm_delivery_slots")
    .select("*, suppliers(name, code)")
    .order("slot_date", { ascending: true })
    .limit(100);
  if (error) throw error;
  return data || [];
}

export async function reserveDeliverySlot(
  id: string,
  reserved_for: string,
  status: "reserved" | "confirmed" | "cancelled" = "reserved"
) {
  const { data, error } = await sb()
    .from("srm_delivery_slots")
    .update({ status, reserved_for })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function listCollabDocuments() {
  const { data, error } = await sb()
    .from("srm_collab_documents")
    .select("*, suppliers(name, code)")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  return data || [];
}

// ─── Advanced Analytics ──────────────────────────────────────

export async function getAdvancedAnalytics() {
  const [suppliers, scorecards, savings, contracts, inbound] = await Promise.all([
    sb()
      .from("suppliers")
      .select(
        "id, name, code, category, supplier_class, spend_ytd, overall_score, risk_score, on_time_delivery_pct, quality_score, disruption_risk, is_active"
      )
      .is("deleted_at", null)
      .limit(500),
    sb().from("srm_scorecards").select("*").order("generated_at", { ascending: false }).limit(100),
    sb().from("srm_procurement_savings").select("*").order("period_year", { ascending: false }).limit(50),
    sb()
      .from("procurement_contracts")
      .select("id, title, end_date, status, supplier_id, value_limit, spend_to_date, currency")
      .order("end_date", { ascending: true, nullsFirst: false })
      .limit(100),
    sb()
      .from("inbound_shipments")
      .select("id, status, supplier_id, eta, actual_arrival")
      .limit(200),
  ]);

  const sups = suppliers.data || [];
  const spendBySupplier = sups
    .map((s) => ({
      id: s.id as string,
      name: String(s.name),
      spend: Number(s.spend_ytd || 0),
      score: Number(s.overall_score || 0),
      risk: Number(s.risk_score || 0),
      otd: Number(s.on_time_delivery_pct || 0),
      class: String(s.supplier_class || "approved"),
    }))
    .sort((a, b) => b.spend - a.spend);

  const catMap = new Map<string, number>();
  for (const s of sups) {
    const k = String(s.category || "general");
    catMap.set(k, (catMap.get(k) || 0) + Number(s.spend_ytd || 0));
  }
  const spendByCategory = Array.from(catMap.entries())
    .map(([category, spend]) => ({ category, spend }))
    .sort((a, b) => b.spend - a.spend);

  const rankings = [...spendBySupplier].sort((a, b) => b.score - a.score);

  const riskHeatmap = sups.map((s) => ({
    name: String(s.name),
    risk: Number(s.disruption_risk ?? s.risk_score ?? 50),
    performance: Number(s.overall_score || 70),
    spend: Number(s.spend_ytd || 0),
  }));

  const now = Date.now();
  const contractCalendar = (contracts.data || [])
    .filter((c) => c.end_date)
    .map((c) => {
      const days = Math.ceil((new Date(String(c.end_date)).getTime() - now) / (1000 * 60 * 60 * 24));
      return {
        id: c.id as string,
        title: String(c.title),
        end_date: String(c.end_date),
        days,
        status: String(c.status),
        value_limit: Number(c.value_limit || 0),
      };
    })
    .sort((a, b) => a.days - b.days);

  const ships = inbound.data || [];
  const delivered = ships.filter((s) => s.status === "delivered" || s.actual_arrival);
  const delayed = ships.filter((s) => s.status === "delayed");
  const deliveryPerformance = {
    total: ships.length,
    onTime: delivered.length,
    delayed: delayed.length,
    onTimePct: ships.length ? Math.round((delivered.length / ships.length) * 100) : 100,
  };

  const savingsRows = savings.data || [];
  const totalSavings = savingsRows.reduce((s, r) => s + Number(r.savings_amount || 0), 0);

  return {
    spendBySupplier: spendBySupplier.slice(0, 15),
    spendByCategory,
    topSuppliers: spendBySupplier.slice(0, 10),
    rankings: rankings.slice(0, 15),
    riskHeatmap: riskHeatmap.sort((a, b) => b.risk - a.risk).slice(0, 20),
    contractCalendar: contractCalendar.slice(0, 20),
    deliveryPerformance,
    savings: savingsRows,
    totalSavings,
    scorecards: scorecards.data || [],
  };
}

