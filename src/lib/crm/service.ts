/**
 * CRM domain service — all I/O via /api/v2/crud (no browser Supabase client).
 */

import {
  computeHealthScore,
  scoreLead,
  sentimentFromText,
  summarizeTimeline,
} from "./ai";
import type {
  CustomerInput,
  LeadInput,
  OpportunityInput,
  TimelineInput,
} from "./types";
import {
  crudCount,
  crudGetOne,
  mustCreate,
  mustDelete,
  mustGet,
  mustList,
  mustRestore,
  mustUpdate,
  updateAllMatching,
} from "@/lib/crud/domain-helpers";

function genCode(prefix: string) {
  return `${prefix}-${Date.now().toString(36).toUpperCase()}`;
}

export async function logCrmAudit(input: {
  company_id: string;
  actor_id?: string | null;
  action: string;
  entity_type?: string;
  entity_id?: string;
  details?: string;
}) {
  try {
    await mustCreate("crm_audit_log", {
      action: input.action,
      entity_type: input.entity_type,
      entity_id: input.entity_id,
      details: input.details,
      actor_id: input.actor_id,
    });
  } catch {
    /* best-effort */
  }
}

// ─── Customers 360 ───────────────────────────────────────────

export async function listCustomers(opts?: {
  search?: string;
  status?: string;
  customer_class?: string;
  limit?: number;
}) {
  const filters: Record<string, unknown> = {};
  if (opts?.status) filters.customer_status = opts.status;
  if (opts?.customer_class) filters.customer_class = opts.customer_class;
  return mustList("customers", {
    pageSize: opts?.limit ?? 200,
    sort: "name",
    order: "asc",
    search: opts?.search,
    filters: Object.keys(filters).length ? filters : undefined,
  });
}

export async function getCustomer(id: string) {
  return crudGetOne("customers", id);
}

export async function createCustomer(
  input: CustomerInput,
  actorId?: string | null
) {
  const code = input.code || genCode("CUS");
  const data = await mustCreate<Record<string, unknown>>("customers", {
    code,
    name: input.name,
    trading_name: input.trading_name || null,
    customer_type: input.customer_type || input.customer_class || "corporate",
    customer_class: input.customer_class || "corporate",
    customer_status: input.customer_status || "active",
    contact_person: input.contact_person || null,
    designation: input.designation || null,
    email: input.email || null,
    phone: input.phone || null,
    whatsapp: input.whatsapp || null,
    industry: input.industry || null,
    city: input.city || null,
    region: input.region || null,
    district: input.district || null,
    country: input.country || "Uganda",
    credit_limit: input.credit_limit ?? 0,
    payment_terms_days: input.payment_terms_days ?? 30,
    currency: input.currency || "UGX",
    preferred_currency: input.currency || "UGX",
    territory: input.territory || null,
    source: input.source || "manual",
    parent_customer_id: input.parent_customer_id || null,
    owner_id: input.owner_id || actorId || null,
    sales_rep_id: input.owner_id || actorId || null,
    notes: input.notes || null,
    is_active: true,
    loyalty_level: "bronze",
    loyalty_points: 0,
    health_score: 70,
    credit_status: "ok",
  });

  await addTimelineEvent({
    company_id: input.company_id,
    customer_id: String(data.id),
    kind: "system",
    title: "Customer account created",
    body: `Account ${code} — ${input.name}`,
    actor_id: actorId,
    actor_name: "System",
  });

  await logCrmAudit({
    company_id: input.company_id,
    actor_id: actorId,
    action: "customer.create",
    entity_type: "customer",
    entity_id: String(data.id),
    details: code,
  });

  return data;
}

export async function updateCustomer(
  id: string,
  patch: Record<string, unknown>,
  actorId?: string | null
) {
  const body = { ...patch };
  delete body.id;
  delete body.company_id;
  delete body.tenant_id;
  delete body.deleted_at;
  const data = await mustUpdate<Record<string, unknown>>("customers", id, body);
  await logCrmAudit({
    company_id: String(data.company_id || ""),
    actor_id: actorId,
    action: "customer.update",
    entity_type: "customer",
    entity_id: id,
  });
  return data;
}

export async function softDeleteCustomer(id: string, actorId?: string | null) {
  await mustDelete("customers", id);
  await logCrmAudit({
    company_id: "",
    actor_id: actorId,
    action: "customer.delete",
    entity_type: "customer",
    entity_id: id,
  });
  return { id, deleted: true };
}

export async function restoreCustomer(id: string, actorId?: string | null) {
  await mustRestore("customers", id);
  return updateCustomer(id, { is_active: true }, actorId);
}

export async function mergeCustomers(input: {
  company_id: string;
  source_id: string;
  target_id: string;
  actor_id?: string | null;
}) {
  const repoint = { customer_id: input.target_id };
  await updateAllMatching("crm_contacts", { customer_id: input.source_id }, repoint);
  await updateAllMatching("crm_activities", { customer_id: input.source_id }, repoint);
  await updateAllMatching("crm_notes", { customer_id: input.source_id }, repoint);
  await updateAllMatching("crm_timeline", { customer_id: input.source_id }, repoint);
  await updateAllMatching("crm_contracts", { customer_id: input.source_id }, repoint);

  await mustUpdate("customers", input.source_id, {
    merged_into_id: input.target_id,
    is_active: false,
  });
  await mustDelete("customers", input.source_id);

  await mustCreate("crm_merge_log", {
    source_customer_id: input.source_id,
    target_customer_id: input.target_id,
    actor_id: input.actor_id,
    merged_fields: {
      contacts: true,
      activities: true,
      timeline: true,
      contracts: true,
    },
  });

  await addTimelineEvent({
    company_id: input.company_id,
    customer_id: input.target_id,
    kind: "system",
    title: "Duplicate customer merged",
    body: `Merged source ${input.source_id} into this account`,
    actor_id: input.actor_id,
  });

  await logCrmAudit({
    company_id: input.company_id,
    actor_id: input.actor_id,
    action: "customer.merge",
    entity_type: "customer",
    entity_id: input.target_id,
    details: `source=${input.source_id}`,
  });
}

// ─── Contacts ────────────────────────────────────────────────

export async function listContacts(customerId?: string) {
  return mustList("crm_contacts", {
    sort: "first_name",
    order: "asc",
    filters: customerId ? { customer_id: customerId } : undefined,
  });
}

export async function createContact(input: {
  company_id: string;
  customer_id: string;
  first_name: string;
  last_name?: string;
  title?: string;
  department?: string;
  email?: string;
  phone?: string;
  mobile?: string;
  is_primary?: boolean;
  is_decision_maker?: boolean;
}) {
  return mustCreate("crm_contacts", {
    customer_id: input.customer_id,
    first_name: input.first_name,
    last_name: input.last_name || null,
    title: input.title || null,
    department: input.department || null,
    email: input.email || null,
    phone: input.phone || null,
    mobile: input.mobile || null,
    is_primary: input.is_primary ?? false,
    is_decision_maker: input.is_decision_maker ?? false,
    is_active: true,
    consent_email: true,
  });
}

// ─── Timeline ────────────────────────────────────────────────

export async function addTimelineEvent(input: TimelineInput) {
  const data = await mustCreate("crm_timeline", {
    customer_id: input.customer_id || null,
    lead_id: input.lead_id || null,
    opportunity_id: input.opportunity_id || null,
    kind: input.kind,
    title: input.title,
    body: input.body || null,
    channel: input.channel || null,
    direction: input.direction || "outbound",
    amount: input.amount ?? null,
    currency: input.currency || "UGX",
    actor_id: input.actor_id || null,
    actor_name: input.actor_name || null,
    occurred_at: new Date().toISOString(),
  });

  if (input.customer_id) {
    try {
      await mustUpdate("customers", input.customer_id, {
        last_contact_at: new Date().toISOString(),
      });
    } catch {
      /* non-blocking */
    }
  }
  return data;
}

export async function getCustomerTimeline(customerId: string, limit = 100) {
  return mustList("crm_timeline", {
    pageSize: limit,
    sort: "occurred_at",
    order: "desc",
    filters: { customer_id: customerId },
  });
}

export async function getTimelineSummary(customerId: string) {
  const events = await getCustomerTimeline(customerId, 30);
  return summarizeTimeline(events);
}

// ─── Leads ───────────────────────────────────────────────────

export async function listLeads(opts?: { status?: string; limit?: number }) {
  return mustList("sales_leads", {
    pageSize: opts?.limit ?? 200,
    sort: "created_at",
    order: "desc",
    filters: opts?.status ? { status: opts.status } : undefined,
  });
}

export async function createLead(input: LeadInput, actorId?: string | null) {
  const lead_number = genCode("LD");
  const lead_score = scoreLead({
    source: input.source,
    estimated_value: input.estimated_value,
    has_email: !!input.email,
    has_phone: !!input.phone,
    industry: input.industry,
    status: "new",
  });

  const data = await mustCreate<Record<string, unknown>>("sales_leads", {
    lead_number,
    company_name: input.company_name,
    contact_name: input.contact_name || null,
    email: input.email || null,
    phone: input.phone || null,
    source: input.source || "manual",
    industry: input.industry || null,
    status: "new",
    estimated_value: input.estimated_value ?? 0,
    currency: input.currency || "UGX",
    notes: input.notes || null,
    territory: input.territory || null,
    assigned_to: input.assigned_to || actorId || null,
    lead_score,
    ai_score: lead_score,
  });

  await addTimelineEvent({
    company_id: input.company_id,
    lead_id: String(data.id),
    kind: "system",
    title: `Lead created: ${input.company_name}`,
    body: `Source: ${input.source || "manual"} · Score: ${lead_score}`,
    actor_id: actorId,
  });

  await logCrmAudit({
    company_id: input.company_id,
    actor_id: actorId,
    action: "lead.create",
    entity_type: "lead",
    entity_id: String(data.id),
    details: lead_number,
  });

  return data;
}

export async function updateLeadStatus(
  id: string,
  status: string,
  extras?: { lost_reason?: string; next_action?: string }
) {
  const existing = await crudGetOne<Record<string, unknown>>("sales_leads", id);
  const patch: Record<string, unknown> = { status };
  if (extras?.lost_reason) patch.lost_reason = extras.lost_reason;
  if (extras?.next_action) patch.next_action = extras.next_action;
  if (existing) {
    const lead_score = scoreLead({
      source: existing.source as string,
      estimated_value: existing.estimated_value as number,
      has_email: !!existing.email,
      has_phone: !!existing.phone,
      industry: existing.industry as string,
      status,
    });
    patch.lead_score = lead_score;
    patch.ai_score = lead_score;
  }
  return mustUpdate("sales_leads", id, patch);
}

export async function convertLeadToCustomer(
  leadId: string,
  actorId?: string | null
) {
  const lead = await mustGet<Record<string, unknown>>("sales_leads", leadId);

  const customer = await createCustomer(
    {
      company_id: lead.company_id as string,
      name: lead.company_name as string,
      contact_person: (lead.contact_name as string) || undefined,
      email: (lead.email as string) || undefined,
      phone: (lead.phone as string) || undefined,
      industry: (lead.industry as string) || undefined,
      source: (lead.source as string) || "lead_conversion",
      customer_status: "prospect",
      customer_class: "corporate",
      territory: (lead.territory as string) || undefined,
    },
    actorId
  );

  if (lead.contact_name) {
    const parts = String(lead.contact_name).split(" ");
    await createContact({
      company_id: lead.company_id as string,
      customer_id: String(customer.id),
      first_name: parts[0] || "Contact",
      last_name: parts.slice(1).join(" ") || undefined,
      email: (lead.email as string) || undefined,
      phone: (lead.phone as string) || undefined,
      is_primary: true,
      is_decision_maker: true,
    });
  }

  await mustUpdate("sales_leads", leadId, {
    status: "converted",
    converted_customer_id: customer.id,
  });

  await addTimelineEvent({
    company_id: lead.company_id as string,
    customer_id: String(customer.id),
    lead_id: leadId,
    kind: "system",
    title: "Lead converted to customer",
    body: `Lead ${lead.lead_number} → ${customer.code}`,
    actor_id: actorId,
  });

  return customer;
}

// ─── Opportunities ───────────────────────────────────────────

export async function listOpportunities(opts?: {
  stage?: string;
  limit?: number;
}) {
  return mustList("sales_opportunities", {
    pageSize: opts?.limit ?? 200,
    sort: "expected_close_date",
    order: "asc",
    filters: opts?.stage ? { stage: opts.stage } : undefined,
  });
}

export async function createOpportunity(
  input: OpportunityInput,
  actorId?: string | null
) {
  const opportunity_number = genCode("OPP");
  const probability = input.probability ?? 20;
  const data = await mustCreate<Record<string, unknown>>("sales_opportunities", {
    opportunity_number,
    name: input.name,
    customer_id: input.customer_id || null,
    lead_id: input.lead_id || null,
    stage: input.stage || "prospecting",
    probability,
    expected_value: input.expected_value ?? 0,
    currency: input.currency || "UGX",
    expected_close_date: input.expected_close_date || null,
    competitors: input.competitors || null,
    win_strategy: input.win_strategy || null,
    products_interest: input.products_interest || null,
    owner_id: input.owner_id || actorId || null,
    notes: input.notes || null,
    forecast_category:
      probability >= 70 ? "commit" : probability >= 40 ? "best_case" : "pipeline",
  });

  if (input.customer_id) {
    await addTimelineEvent({
      company_id: input.company_id,
      customer_id: input.customer_id,
      opportunity_id: String(data.id),
      kind: "system",
      title: `Opportunity opened: ${input.name}`,
      body: `Value ${input.expected_value || 0} · ${probability}%`,
      actor_id: actorId,
    });
  }

  await logCrmAudit({
    company_id: input.company_id,
    actor_id: actorId,
    action: "opportunity.create",
    entity_type: "opportunity",
    entity_id: String(data.id),
    details: opportunity_number,
  });

  return data;
}

export async function moveOpportunityStage(
  id: string,
  stage: string,
  probability?: number
) {
  const patch: Record<string, unknown> = { stage };
  if (probability != null) patch.probability = probability;
  else {
    const defaults: Record<string, number> = {
      prospecting: 10,
      qualification: 25,
      proposal: 50,
      negotiation: 70,
      won: 100,
      lost: 0,
    };
    if (defaults[stage] != null) patch.probability = defaults[stage];
  }
  if (stage === "won" || stage === "lost") {
    patch.closed_at = new Date().toISOString();
  }
  if (Number(patch.probability) >= 70) patch.forecast_category = "commit";
  else if (Number(patch.probability) >= 40) patch.forecast_category = "best_case";
  else patch.forecast_category = "pipeline";

  return mustUpdate("sales_opportunities", id, patch);
}

// ─── Activities ──────────────────────────────────────────────

export async function listActivities(opts?: {
  customer_id?: string;
  limit?: number;
}) {
  return mustList("crm_activities", {
    pageSize: opts?.limit ?? 100,
    sort: "scheduled_at",
    order: "desc",
    filters: opts?.customer_id
      ? { customer_id: opts.customer_id }
      : undefined,
  });
}

export async function createActivity(input: {
  company_id: string;
  customer_id?: string | null;
  lead_id?: string | null;
  opportunity_id?: string | null;
  activity_type?: string;
  subject: string;
  description?: string;
  scheduled_at?: string;
  owner_id?: string | null;
  created_by?: string | null;
}) {
  const data = await mustCreate("crm_activities", {
    customer_id: input.customer_id || null,
    lead_id: input.lead_id || null,
    opportunity_id: input.opportunity_id || null,
    activity_type: input.activity_type || "call",
    status: "planned",
    subject: input.subject,
    description: input.description || null,
    scheduled_at: input.scheduled_at || null,
    owner_id: input.owner_id || input.created_by || null,
  });

  if (input.customer_id) {
    await addTimelineEvent({
      company_id: input.company_id,
      customer_id: input.customer_id,
      kind: (input.activity_type as string) || "call",
      title: input.subject,
      body: input.description,
      actor_id: input.created_by,
    });
  }
  return data;
}

// ─── Campaigns ───────────────────────────────────────────────

export async function listCampaigns() {
  return mustList("crm_campaigns", { sort: "created_at", order: "desc" });
}

export async function createCampaign(input: {
  company_id: string;
  name: string;
  channel?: string;
  segment?: string;
  subject?: string;
  body_html?: string;
  budget?: number;
  starts_at?: string;
  ends_at?: string;
  created_by?: string | null;
  ai_recommendation?: string;
}) {
  return mustCreate("crm_campaigns", {
    code: genCode("CAMP"),
    name: input.name,
    channel: input.channel || "email",
    status: "draft",
    segment: input.segment || null,
    subject: input.subject || null,
    body_html: input.body_html || null,
    budget: input.budget ?? 0,
    currency: "UGX",
    starts_at: input.starts_at || null,
    ends_at: input.ends_at || null,
    ai_recommendation: input.ai_recommendation || null,
  });
}

// ─── Contracts ───────────────────────────────────────────────

export async function listContracts(opts?: { status?: string }) {
  return mustList("crm_contracts", {
    sort: "end_date",
    order: "asc",
    filters: opts?.status ? { status: opts.status } : undefined,
  });
}

export async function createContract(input: {
  company_id: string;
  customer_id: string;
  title: string;
  contract_type?: string;
  start_date?: string;
  end_date?: string;
  value?: number;
  currency?: string;
  terms?: string;
  owner_id?: string | null;
  created_by?: string | null;
}) {
  const contract_number = genCode("CTR");
  const data = await mustCreate("crm_contracts", {
    contract_number,
    customer_id: input.customer_id,
    title: input.title,
    contract_type: input.contract_type || "sales",
    status: "draft",
    start_date: input.start_date || null,
    end_date: input.end_date || null,
    value: input.value ?? 0,
    currency: input.currency || "UGX",
    terms: input.terms || null,
    owner_id: input.owner_id || null,
  });

  await addTimelineEvent({
    company_id: input.company_id,
    customer_id: input.customer_id,
    kind: "note",
    title: `Contract drafted: ${input.title}`,
    body: contract_number,
    actor_id: input.created_by,
  });

  return data;
}

// ─── Loyalty ─────────────────────────────────────────────────

export async function awardLoyaltyPoints(input: {
  company_id: string;
  customer_id: string;
  points: number;
  reason: string;
  reference?: string;
  created_by?: string | null;
}) {
  const cust = await crudGetOne<Record<string, unknown>>(
    "customers",
    input.customer_id
  );
  const current = Number(cust?.loyalty_points || 0);
  const balance_after = current + input.points;

  let tier = "bronze";
  if (balance_after >= 500000) tier = "diamond";
  else if (balance_after >= 150000) tier = "platinum";
  else if (balance_after >= 50000) tier = "gold";
  else if (balance_after >= 10000) tier = "silver";

  await mustCreate("crm_loyalty_ledger", {
    customer_id: input.customer_id,
    points: input.points,
    entry_type: input.points >= 0 ? "earn" : "redeem",
    reason: input.reason,
    reference: input.reference || null,
    balance_after,
  });

  await mustUpdate("customers", input.customer_id, {
    loyalty_points: balance_after,
    loyalty_level: tier,
  });

  return { balance_after, tier };
}

// ─── Feedback ────────────────────────────────────────────────

export async function submitFeedback(input: {
  company_id: string;
  customer_id?: string | null;
  score_type?: string;
  score: number;
  comment?: string;
  channel?: string;
}) {
  const sentiment = input.comment ? sentimentFromText(input.comment) : "neutral";
  const data = await mustCreate("crm_feedback", {
    customer_id: input.customer_id || null,
    score_type: input.score_type || "csat",
    score: input.score,
    comment: input.comment || null,
    channel: input.channel || "portal",
    sentiment,
  });

  if (input.customer_id && input.score_type === "csat") {
    await mustUpdate("customers", input.customer_id, { csat_score: input.score });
  }
  if (input.customer_id && input.score_type === "nps") {
    await mustUpdate("customers", input.customer_id, { nps_score: input.score });
  }
  return data;
}

// ─── Dealers ─────────────────────────────────────────────────

export async function listDealers() {
  return mustList("crm_dealers", { sort: "dealer_code", order: "asc" });
}

export async function createDealer(input: {
  company_id: string;
  customer_id: string;
  dealer_code?: string;
  dealer_type?: string;
  territory?: string;
  region?: string;
  sales_target?: number;
  commission_pct?: number;
}) {
  return mustCreate("crm_dealers", {
    customer_id: input.customer_id,
    dealer_code: input.dealer_code || genCode("DLR"),
    dealer_type: input.dealer_type || "dealer",
    territory: input.territory || null,
    region: input.region || null,
    sales_target: input.sales_target ?? 0,
    commission_pct: input.commission_pct ?? 0,
    is_active: true,
  });
}

// ─── Tenders ─────────────────────────────────────────────────

export async function listTenders() {
  return mustList("crm_tenders", {
    sort: "submission_deadline",
    order: "asc",
  });
}

export async function createTender(input: {
  company_id: string;
  title: string;
  customer_id?: string | null;
  issuing_body?: string;
  tender_type?: string;
  submission_deadline?: string;
  bid_value?: number;
  currency?: string;
  requirements?: string;
  owner_id?: string | null;
}) {
  return mustCreate("crm_tenders", {
    tender_number: genCode("TND"),
    title: input.title,
    customer_id: input.customer_id || null,
    issuing_body: input.issuing_body || null,
    tender_type: input.tender_type || "open",
    status: "identified",
    submission_deadline: input.submission_deadline || null,
    bid_value: input.bid_value ?? 0,
    currency: input.currency || "UGX",
    requirements: input.requirements || null,
    owner_id: input.owner_id || null,
    win_probability: 30,
  });
}

// ─── Portal ──────────────────────────────────────────────────

export async function listPortalRequests(opts?: { status?: string }) {
  return mustList("crm_portal_requests", {
    pageSize: 100,
    sort: "created_at",
    order: "desc",
    filters: opts?.status ? { status: opts.status } : undefined,
  });
}

export async function enableCustomerPortal(
  customerId: string,
  companyId: string
) {
  const token = Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  const data = await mustUpdate("customers", customerId, {
    portal_enabled: true,
    portal_token: token,
  });
  await logCrmAudit({
    company_id: companyId,
    action: "portal.enable",
    entity_type: "customer",
    entity_id: customerId,
  });
  return data;
}

// ─── Credit ──────────────────────────────────────────────────

export async function setCreditHold(
  customerId: string,
  hold: boolean,
  companyId: string,
  actorId?: string | null
) {
  const data = await mustUpdate("customers", customerId, {
    credit_hold: hold,
    credit_status: hold ? "hold" : "ok",
  });

  await addTimelineEvent({
    company_id: companyId,
    customer_id: customerId,
    kind: "system",
    title: hold ? "Credit hold applied" : "Credit hold released",
    actor_id: actorId,
  });

  return data;
}

export async function updateCreditLimit(
  customerId: string,
  limit: number,
  companyId: string,
  actorId?: string | null
) {
  const data = await mustUpdate("customers", customerId, {
    credit_limit: limit,
  });
  await logCrmAudit({
    company_id: companyId,
    actor_id: actorId,
    action: "credit.limit_update",
    entity_type: "customer",
    entity_id: customerId,
    details: String(limit),
  });
  return data;
}

// ─── Health / AI refresh ─────────────────────────────────────

export async function refreshCustomerHealth(
  customerId: string,
  companyId: string
) {
  const tickets = await crudCount("support_tickets", {
    customer_id: customerId,
    status: ["open", "assigned", "in_progress"],
  });

  const cust = await crudGetOne<Record<string, unknown>>(
    "customers",
    customerId
  );

  const creditLimit = Number(cust?.credit_limit || 1);
  const outstanding = Number(cust?.outstanding_balance || 0);
  const last = cust?.last_contact_at
    ? new Date(cust.last_contact_at as string)
    : null;
  const daysSince = last
    ? Math.floor((Date.now() - last.getTime()) / (1000 * 60 * 60 * 24))
    : 60;

  const result = computeHealthScore({
    daysSinceLastOrder: daysSince,
    openTickets: tickets,
    overdueAmount: outstanding > 0 ? outstanding : 0,
    nps: cust?.nps_score as number | null,
    creditUtilization: creditLimit > 0 ? outstanding / creditLimit : 0,
  });

  await mustUpdate("customers", customerId, {
    health_score: result.score,
    churn_risk: result.churn_risk,
  });

  const existing = await mustList<Record<string, unknown>>("crm_health_scores", {
    pageSize: 1,
    filters: { customer_id: customerId },
  });
  const healthBody = {
    customer_id: customerId,
    score: result.score,
    churn_risk: result.churn_risk,
    engagement: result.engagement,
    financial: result.financial,
    support: result.support,
    factors: { next_best_action: result.next_best_action },
    computed_at: new Date().toISOString(),
  };
  if (existing[0]?.id) {
    await mustUpdate("crm_health_scores", String(existing[0].id), healthBody);
  } else {
    await mustCreate("crm_health_scores", healthBody);
  }
  void companyId;
  return result;
}

// ─── Dashboard stats ─────────────────────────────────────────

export async function getCrmDashboardStats() {
  const [
    customers,
    contacts,
    openLeads,
    opps,
    activeContracts,
    openTickets,
    activeCampaigns,
    insights,
  ] = await Promise.all([
    crudCount("customers"),
    crudCount("crm_contacts"),
    crudCount("sales_leads", {
      status: ["new", "contacted", "qualified", "proposal", "negotiation"],
    }),
    mustList<Record<string, unknown>>("sales_opportunities", {
      pageSize: 500,
    }),
    crudCount("crm_contracts", { status: "active" }),
    crudCount("support_tickets", {
      status: ["open", "assigned", "in_progress"],
    }),
    crudCount("crm_campaigns", {
      status: ["draft", "scheduled", "running"],
    }),
    mustList("crm_insights", {
      pageSize: 8,
      sort: "created_at",
      order: "desc",
      filters: { status: "open" },
    }),
  ]);

  const openOpps = opps.filter(
    (o) => o.stage !== "won" && o.stage !== "lost"
  );
  const pipeline = openOpps.reduce<{ total: number; weighted: number; count: number }>(
    (acc, o) => {
      acc.total += Number(o.expected_value || 0);
      acc.weighted += Number(
        o.weighted_value ??
          (Number(o.expected_value || 0) * Number(o.probability || 0)) / 100
      );
      acc.count += 1;
      return acc;
    },
    { total: 0, weighted: 0, count: 0 }
  );

  return {
    customers,
    contacts,
    openLeads,
    openOpps: pipeline.count,
    pipelineValue: pipeline.total,
    weightedForecast: pipeline.weighted,
    activeContracts,
    openTickets,
    activeCampaigns,
    insights,
  };
}

// ─── Communications ──────────────────────────────────────────

export async function logCommunication(input: {
  company_id: string;
  customer_id?: string | null;
  channel: string;
  subject?: string;
  body?: string;
  direction?: string;
  status?: string;
  created_by?: string | null;
}) {
  const data = await mustCreate("crm_communications", {
    customer_id: input.customer_id || null,
    channel: input.channel,
    subject: input.subject || null,
    body: input.body || null,
    direction: input.direction || "outbound",
    status: input.status || "sent",
    sent_at: new Date().toISOString(),
  });

  if (input.customer_id) {
    await addTimelineEvent({
      company_id: input.company_id,
      customer_id: input.customer_id,
      kind:
        input.channel === "email"
          ? "email"
          : input.channel === "whatsapp"
            ? "whatsapp"
            : "sms",
      title: input.subject || `${input.channel} message`,
      body: input.body,
      channel: input.channel,
      actor_id: input.created_by,
    });
  }
  return data;
}

export async function listCommunications(limit = 50) {
  return mustList("crm_communications", {
    pageSize: limit,
    sort: "created_at",
    order: "desc",
  });
}

// ─── Segments ────────────────────────────────────────────────

export async function listSegments() {
  return mustList("crm_segments", {
    sort: "name",
    order: "asc",
    filters: { is_active: true },
  });
}

export async function listInsights() {
  return mustList("crm_insights", {
    pageSize: 50,
    sort: "created_at",
    order: "desc",
    filters: { status: "open" },
  });
}

export async function dismissInsight(id: string) {
  await mustUpdate("crm_insights", id, {
    status: "dismissed",
    dismissed_at: new Date().toISOString(),
  });
}
