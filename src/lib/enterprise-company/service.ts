import { createClient } from "@/lib/supabase/client";
import { orgStats, wouldCreateCycle } from "./org-tree";
import { ORG_NODE_TYPES } from "./types";

function sb() {
  return createClient();
}

export async function logCompanyAudit(input: {
  company_id?: string | null;
  actor_id?: string | null;
  action: string;
  entity_table?: string;
  entity_id?: string;
  entity_code?: string;
  details?: string;
}) {
  await sb().from("ec_audit_log").insert({
    company_id: input.company_id || null,
    actor_id: input.actor_id || null,
    action: input.action,
    entity_table: input.entity_table || null,
    entity_id: input.entity_id || null,
    entity_code: input.entity_code || null,
    details: input.details || null,
  });
}

export async function getEnterpriseStats(companyId: string) {
  const [
    companies,
    branches,
    factories,
    departments,
    warehouses,
    businessUnits,
    documents,
    risks,
    insurance,
    insights,
    board,
  ] = await Promise.all([
    sb().from("companies").select("*", { count: "exact", head: true }).is("deleted_at", null),
    sb().from("branches").select("*", { count: "exact", head: true }).eq("company_id", companyId).is("deleted_at", null),
    sb().from("factories").select("*", { count: "exact", head: true }).eq("company_id", companyId),
    sb().from("departments").select("*", { count: "exact", head: true }).eq("company_id", companyId),
    sb().from("warehouses").select("*", { count: "exact", head: true }).eq("company_id", companyId),
    sb().from("ec_business_units").select("*", { count: "exact", head: true }).eq("company_id", companyId).is("deleted_at", null),
    sb().from("ec_company_documents").select("*", { count: "exact", head: true }).eq("company_id", companyId).is("deleted_at", null),
    sb().from("ec_risk_register").select("*", { count: "exact", head: true }).eq("company_id", companyId).eq("status", "open"),
    sb().from("ec_insurance_policies").select("*", { count: "exact", head: true }).eq("company_id", companyId).eq("status", "active"),
    sb().from("ec_ai_insights").select("*", { count: "exact", head: true }).eq("company_id", companyId).eq("status", "open"),
    sb().from("ec_board_members").select("*", { count: "exact", head: true }).eq("company_id", companyId).eq("is_active", true),
  ]);

  return {
    companies: companies.count ?? 0,
    branches: branches.count ?? 0,
    factories: factories.count ?? 0,
    departments: departments.count ?? 0,
    warehouses: warehouses.count ?? 0,
    businessUnits: businessUnits.count ?? 0,
    documents: documents.count ?? 0,
    openRisks: risks.count ?? 0,
    insurancePolicies: insurance.count ?? 0,
    openInsights: insights.count ?? 0,
    boardMembers: board.count ?? 0,
  };
}

// ─── Companies ───────────────────────────────────────────────

export async function listCompanies() {
  const { data, error } = await sb()
    .from("companies")
    .select("*")
    .is("deleted_at", null)
    .order("name");
  if (error) throw error;
  return data || [];
}

export async function getCompany(id: string) {
  const { data, error } = await sb().from("companies").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data;
}

export async function updateCompany(
  id: string,
  patch: Record<string, unknown>,
  actorId?: string | null
) {
  const { data, error } = await sb()
    .from("companies")
    .update({
      ...patch,
      updated_by: actorId || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  await logCompanyAudit({
    company_id: id,
    actor_id: actorId,
    action: "update",
    entity_table: "companies",
    entity_id: id,
    details: "Company master updated",
  });
  return data;
}

export async function createCompany(
  input: {
    name: string;
    code: string;
    company_type?: string;
    legal_name?: string;
    trading_name?: string;
    parent_company_id?: string | null;
    country?: string;
    base_currency?: string;
  },
  actorId?: string | null
) {
  const { data, error } = await sb()
    .from("companies")
    .insert({
      name: input.name,
      code: input.code.toUpperCase(),
      legal_name: input.legal_name || input.name,
      trading_name: input.trading_name || input.name,
      company_type: input.company_type || "operating",
      parent_company_id: input.parent_company_id || null,
      country: input.country || "Uganda",
      base_currency: input.base_currency || "UGX",
      company_status: "active",
      is_active: true,
      created_by: actorId || null,
    })
    .select("*")
    .single();
  if (error) throw error;

  await sb().from("ec_company_branding").upsert({
    company_id: data.id,
    primary_color: "#0B1F3A",
    secondary_color: "#C9A227",
  });

  await logCompanyAudit({
    company_id: data.id,
    actor_id: actorId,
    action: "create",
    entity_table: "companies",
    entity_id: data.id,
    entity_code: data.code,
  });
  return data;
}

// ─── Structure ───────────────────────────────────────────────

export async function listBranches(companyId: string) {
  const { data, error } = await sb()
    .from("branches")
    .select("*")
    .eq("company_id", companyId)
    .is("deleted_at", null)
    .order("name");
  if (error) throw error;
  return data || [];
}

export async function createBranch(input: {
  company_id: string;
  code: string;
  name: string;
  region?: string;
  district?: string;
  manager_name?: string;
  address?: string;
  branch_type?: string;
  cost_center_code?: string;
  tax_region?: string;
}) {
  const { data, error } = await sb()
    .from("branches")
    .insert({
      company_id: input.company_id,
      code: input.code.toUpperCase(),
      name: input.name,
      region: input.region || null,
      district: input.district || null,
      manager_name: input.manager_name || null,
      address: input.address || null,
      branch_type: input.branch_type || "office",
      cost_center_code: input.cost_center_code || null,
      tax_region: input.tax_region || null,
      is_active: true,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function listFactories(companyId: string) {
  const { data, error } = await sb()
    .from("factories")
    .select("*")
    .eq("company_id", companyId)
    .order("name");
  if (error) throw error;
  return data || [];
}

export async function createFactory(input: {
  company_id: string;
  code: string;
  name: string;
  plant_manager_name?: string;
  production_capacity?: number;
  production_lines?: number;
  city?: string;
  address?: string;
}) {
  const { data, error } = await sb()
    .from("factories")
    .insert({
      company_id: input.company_id,
      code: input.code.toUpperCase(),
      name: input.name,
      plant_manager_name: input.plant_manager_name || null,
      production_capacity: input.production_capacity || null,
      production_lines: input.production_lines || 0,
      city: input.city || null,
      address: input.address || null,
      is_active: true,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function listDepartments(companyId: string) {
  const { data, error } = await sb()
    .from("departments")
    .select("*")
    .eq("company_id", companyId)
    .order("name");
  if (error) throw error;
  return data || [];
}

export async function createDepartment(input: {
  company_id: string;
  code: string;
  name: string;
  manager_name?: string;
  cost_center_code?: string;
  business_unit_id?: string | null;
}) {
  const { data, error } = await sb()
    .from("departments")
    .insert({
      company_id: input.company_id,
      code: input.code.toUpperCase(),
      name: input.name,
      manager_name: input.manager_name || null,
      cost_center_code: input.cost_center_code || null,
      business_unit_id: input.business_unit_id || null,
      is_active: true,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function listWarehouses(companyId: string) {
  const { data, error } = await sb()
    .from("warehouses")
    .select("*")
    .eq("company_id", companyId)
    .order("name");
  if (error) throw error;
  return data || [];
}

export async function listBusinessUnits(companyId: string) {
  const { data, error } = await sb()
    .from("ec_business_units")
    .select("*")
    .eq("company_id", companyId)
    .is("deleted_at", null)
    .order("sort_order");
  if (error) throw error;
  return data || [];
}

export async function createBusinessUnit(input: {
  company_id: string;
  code: string;
  name: string;
  unit_type?: string;
  director_name?: string;
  budget_amount?: number;
}) {
  const { data, error } = await sb()
    .from("ec_business_units")
    .insert({
      company_id: input.company_id,
      code: input.code.toUpperCase(),
      name: input.name,
      unit_type: input.unit_type || "corporate",
      director_name: input.director_name || null,
      budget_amount: input.budget_amount || null,
      status: "active",
    })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function listCostCenters(companyId: string) {
  const { data, error } = await sb()
    .from("ec_cost_centers")
    .select("*")
    .eq("company_id", companyId)
    .is("deleted_at", null)
    .order("code");
  if (error) throw error;
  return data || [];
}

export async function createCostCenter(input: {
  company_id: string;
  code: string;
  name: string;
  manager_name?: string;
}) {
  const { data, error } = await sb()
    .from("ec_cost_centers")
    .insert({
      company_id: input.company_id,
      code: input.code.toUpperCase(),
      name: input.name,
      manager_name: input.manager_name || null,
      is_active: true,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

// ─── Org chart ───────────────────────────────────────────────

export async function listOrgNodes(companyId: string) {
  const { data, error } = await sb()
    .from("ec_org_nodes")
    .select("*")
    .eq("company_id", companyId)
    .is("deleted_at", null)
    .order("sort_order")
    .order("name");
  if (error) throw error;
  return data || [];
}

export async function getOrgNode(id: string) {
  const { data, error } = await sb()
    .from("ec_org_nodes")
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data;
}

export type OrgNodeInput = {
  company_id: string;
  code: string;
  name: string;
  node_type: string;
  parent_id?: string | null;
  manager_name?: string | null;
  manager_user_id?: string | null;
  sort_order?: number;
  is_active?: boolean;
};

export async function createOrgNode(input: OrgNodeInput) {
  const { data, error } = await sb()
    .from("ec_org_nodes")
    .insert({
      company_id: input.company_id,
      code: input.code.toUpperCase(),
      name: input.name,
      node_type: input.node_type,
      parent_id: input.parent_id || null,
      manager_name: input.manager_name || null,
      manager_user_id: input.manager_user_id || null,
      sort_order: input.sort_order ?? 0,
      is_active: input.is_active ?? true,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export type OrgNodePatch = {
  code?: string;
  name?: string;
  node_type?: string;
  parent_id?: string | null;
  manager_name?: string | null;
  manager_user_id?: string | null;
  sort_order?: number;
  is_active?: boolean;
};

/** Reject a reparent that would create a cycle (self or descendant as parent). */
export async function assertSafeReparent(
  companyId: string,
  nodeId: string,
  parentId: string | null | undefined
) {
  if (!parentId) return;
  if (parentId === nodeId) {
    throw new Error("A node cannot be its own parent");
  }
  const nodes = await listOrgNodes(companyId);
  if (!nodes.some((n) => n.id === nodeId)) {
    throw new Error("Node not found");
  }
  if (wouldCreateCycle(nodes, nodeId, parentId)) {
    throw new Error("Cannot move a node under one of its own descendants");
  }
}

export async function updateOrgNode(id: string, patch: OrgNodePatch) {
  const { data, error } = await sb()
    .from("ec_org_nodes")
    .update({
      ...(patch.code !== undefined ? { code: patch.code.toUpperCase() } : {}),
      ...(patch.name !== undefined ? { name: patch.name } : {}),
      ...(patch.node_type !== undefined ? { node_type: patch.node_type } : {}),
      ...(patch.parent_id !== undefined ? { parent_id: patch.parent_id || null } : {}),
      ...(patch.manager_name !== undefined ? { manager_name: patch.manager_name || null } : {}),
      ...(patch.manager_user_id !== undefined ? { manager_user_id: patch.manager_user_id || null } : {}),
      ...(patch.sort_order !== undefined ? { sort_order: patch.sort_order } : {}),
      ...(patch.is_active !== undefined ? { is_active: patch.is_active } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function moveOrgNode(
  companyId: string,
  id: string,
  parentId: string | null
) {
  await assertSafeReparent(companyId, id, parentId);
  return updateOrgNode(id, { parent_id: parentId });
}

export async function archiveOrgNode(id: string) {
  return updateOrgNode(id, { is_active: false });
}

export async function restoreOrgNode(id: string) {
  return updateOrgNode(id, { is_active: true });
}

/** Soft-delete a leaf node; refuses when children still exist. */
export async function deleteOrgNode(id: string) {
  const { data: children, error: childError } = await sb()
    .from("ec_org_nodes")
    .select("id")
    .eq("parent_id", id)
    .is("deleted_at", null)
    .limit(1);
  if (childError) throw childError;
  if (children && children.length > 0) {
    throw new Error("Cannot delete a node that still has child nodes. Move or archive children first.");
  }
  const { data, error } = await sb()
    .from("ec_org_nodes")
    .update({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function getOrgStats(companyId: string) {
  const nodes = await listOrgNodes(companyId);
  return orgStats(nodes);
}

export type OrgImportResult = {
  created: number;
  updated: number;
  skipped: number;
  errors: string[];
};

/** Bulk upsert org nodes from CSV rows; parents wired by code on a second pass. */
export async function importOrgNodes(
  companyId: string,
  rows: Array<Record<string, string>>
): Promise<OrgImportResult> {
  const result: OrgImportResult = { created: 0, updated: 0, skipped: 0, errors: [] };
  if (rows.length === 0) return result;

  const existing = await listOrgNodes(companyId);
  const byCode = new Map(existing.map((n) => [String(n.code ?? "").toUpperCase(), n]));
  const validTypes = new Set<string>(ORG_NODE_TYPES);

  // First pass: upsert by code (no parent yet).
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNo = i + 2; // 1-based, header is row 1
    const code = (row.code ?? "").trim().toUpperCase();
    const name = (row.name ?? "").trim();
    if (!code || !name) {
      result.errors.push("Row " + rowNo + ": code and name are required");
      result.skipped++;
      continue;
    }
    const nodeType = (row.node_type ?? "department").trim();
    if (!validTypes.has(nodeType)) {
      result.errors.push("Row " + rowNo + ": unknown node_type '" + nodeType + "'");
      result.skipped++;
      continue;
    }
    const managerName = (row.manager_name ?? "").trim() || null;
    const sortOrder = parseInt(row.sort_order ?? "0", 10);
    const isActive = (row.is_active ?? "true").toLowerCase() !== "false";
    const existingNode = byCode.get(code);
    try {
      if (existingNode) {
        await updateOrgNode(existingNode.id, {
          name,
          node_type: nodeType,
          manager_name: managerName,
          sort_order: Number.isNaN(sortOrder) ? undefined : sortOrder,
          is_active: isActive,
        });
        result.updated++;
      } else {
        const created = await createOrgNode({
          company_id: companyId,
          code,
          name,
          node_type: nodeType,
          manager_name: managerName,
          sort_order: Number.isNaN(sortOrder) ? 0 : sortOrder,
          is_active: isActive,
        });
        byCode.set(code, created);
        result.created++;
      }
    } catch (e) {
      result.errors.push("Row " + rowNo + ": " + (e instanceof Error ? e.message : "update failed"));
      result.skipped++;
    }
  }

  // Second pass: wire parents by parent_code, cycle-safe.
  const fresh = await listOrgNodes(companyId);
  const codeToId = new Map(fresh.map((n) => [String(n.code ?? "").toUpperCase(), n.id]));
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNo = i + 2;
    const code = (row.code ?? "").trim().toUpperCase();
    const parentCode = (row.parent_code ?? "").trim().toUpperCase();
    const nodeId = codeToId.get(code);
    if (!nodeId || !parentCode) continue;
    const parentId = codeToId.get(parentCode);
    if (!parentId) {
      result.errors.push("Row " + rowNo + ": parent_code '" + row.parent_code + "' not found");
      continue;
    }
    try {
      await assertSafeReparent(companyId, nodeId, parentId);
      await updateOrgNode(nodeId, { parent_id: parentId });
    } catch (e) {
      result.errors.push("Row " + rowNo + ": " + (e instanceof Error ? e.message : "parent link failed"));
    }
  }

  return result;
}

// ─── Settings / branding ─────────────────────────────────────

export async function listCompanySettings(companyId: string) {
  const { data, error } = await sb()
    .from("ec_company_settings")
    .select("*")
    .eq("company_id", companyId)
    .order("domain")
    .order("setting_key");
  if (error) throw error;
  return data || [];
}

export async function upsertCompanySetting(input: {
  company_id: string;
  domain: string;
  setting_key: string;
  setting_value: unknown;
  description?: string;
  updated_by?: string | null;
}) {
  const { data, error } = await sb()
    .from("ec_company_settings")
    .upsert(
      {
        company_id: input.company_id,
        domain: input.domain,
        setting_key: input.setting_key,
        setting_value: input.setting_value as object,
        description: input.description || null,
        updated_by: input.updated_by || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "company_id,domain,setting_key" }
    )
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function getCompanyBranding(companyId: string) {
  const { data, error } = await sb()
    .from("ec_company_branding")
    .select("*")
    .eq("company_id", companyId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

// ─── Documents ───────────────────────────────────────────────

export async function listDocuments(companyId: string) {
  const { data, error } = await sb()
    .from("ec_company_documents")
    .select("*")
    .eq("company_id", companyId)
    .is("deleted_at", null)
    .order("expiry_date", { ascending: true, nullsFirst: false });
  if (error) throw error;
  return data || [];
}

export async function createDocument(input: {
  company_id: string;
  doc_type: string;
  title: string;
  doc_number?: string;
  file_url?: string;
  issued_date?: string;
  expiry_date?: string;
  uploaded_by?: string | null;
}) {
  const { data, error } = await sb()
    .from("ec_company_documents")
    .insert({
      company_id: input.company_id,
      doc_type: input.doc_type,
      title: input.title,
      doc_number: input.doc_number || null,
      file_url: input.file_url || null,
      issued_date: input.issued_date || null,
      expiry_date: input.expiry_date || null,
      uploaded_by: input.uploaded_by || null,
      status: "active",
    })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

// ─── Calendar ────────────────────────────────────────────────

export async function listCalendarEvents(companyId: string, year?: number) {
  let q = sb()
    .from("ec_calendar_events")
    .select("*")
    .eq("company_id", companyId)
    .order("start_date");
  if (year) {
    q = q
      .gte("start_date", `${year}-01-01`)
      .lte("start_date", `${year}-12-31`);
  }
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

export async function createCalendarEvent(input: {
  company_id: string;
  event_type: string;
  title: string;
  start_date: string;
  end_date?: string;
  description?: string;
  created_by?: string | null;
}) {
  const { data, error } = await sb()
    .from("ec_calendar_events")
    .insert({
      company_id: input.company_id,
      event_type: input.event_type,
      title: input.title,
      start_date: input.start_date,
      end_date: input.end_date || input.start_date,
      description: input.description || null,
      created_by: input.created_by || null,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

// ─── Governance ──────────────────────────────────────────────

export async function listBoardMembers(companyId: string) {
  const { data, error } = await sb()
    .from("ec_board_members")
    .select("*")
    .eq("company_id", companyId)
    .order("full_name");
  if (error) throw error;
  return data || [];
}

export async function listCommittees(companyId: string) {
  const { data, error } = await sb()
    .from("ec_committees")
    .select("*")
    .eq("company_id", companyId)
    .order("name");
  if (error) throw error;
  return data || [];
}

export async function listMeetings(companyId: string) {
  const { data, error } = await sb()
    .from("ec_meetings")
    .select("*")
    .eq("company_id", companyId)
    .order("scheduled_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return data || [];
}

export async function listSignatories(companyId: string) {
  const { data, error } = await sb()
    .from("ec_authorized_signatories")
    .select("*")
    .eq("company_id", companyId)
    .eq("is_active", true)
    .order("full_name");
  if (error) throw error;
  return data || [];
}

export async function createBoardMember(input: {
  company_id: string;
  full_name: string;
  title?: string;
  member_type?: string;
  email?: string;
}) {
  const { data, error } = await sb()
    .from("ec_board_members")
    .insert({
      company_id: input.company_id,
      full_name: input.full_name,
      title: input.title || null,
      member_type: input.member_type || "director",
      email: input.email || null,
      is_active: true,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function createMeeting(input: {
  company_id: string;
  title: string;
  meeting_type?: string;
  scheduled_at?: string;
  agenda?: string;
  created_by?: string | null;
}) {
  const year = new Date().getFullYear();
  const { count } = await sb()
    .from("ec_meetings")
    .select("*", { count: "exact", head: true })
    .eq("company_id", input.company_id);
  const meeting_number = `MTG-${year}-${String((count ?? 0) + 1).padStart(3, "0")}`;

  const { data, error } = await sb()
    .from("ec_meetings")
    .insert({
      company_id: input.company_id,
      meeting_number,
      title: input.title,
      meeting_type: input.meeting_type || "board",
      scheduled_at: input.scheduled_at || null,
      agenda: input.agenda || null,
      status: "scheduled",
      created_by: input.created_by || null,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

// ─── Risk & insurance ────────────────────────────────────────

export async function listRisks(companyId: string) {
  const { data, error } = await sb()
    .from("ec_risk_register")
    .select("*")
    .eq("company_id", companyId)
    .is("deleted_at", null)
    .order("risk_code");
  if (error) throw error;
  return data || [];
}

export async function createRisk(input: {
  company_id: string;
  risk_code: string;
  title: string;
  category: string;
  description?: string;
  likelihood?: string;
  impact?: string;
  risk_owner?: string;
  mitigation_plan?: string;
}) {
  const { data, error } = await sb()
    .from("ec_risk_register")
    .insert({
      company_id: input.company_id,
      risk_code: input.risk_code.toUpperCase(),
      title: input.title,
      category: input.category,
      description: input.description || null,
      likelihood: input.likelihood || "medium",
      impact: input.impact || "medium",
      residual_rating: input.impact || "medium",
      risk_owner: input.risk_owner || null,
      mitigation_plan: input.mitigation_plan || null,
      status: "open",
    })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function listInsurance(companyId: string) {
  const { data, error } = await sb()
    .from("ec_insurance_policies")
    .select("*")
    .eq("company_id", companyId)
    .is("deleted_at", null)
    .order("end_date");
  if (error) throw error;
  return data || [];
}

export async function createInsurance(input: {
  company_id: string;
  policy_type: string;
  policy_number?: string;
  insurer_name?: string;
  coverage_amount?: number;
  premium_amount?: number;
  start_date?: string;
  end_date?: string;
}) {
  const { data, error } = await sb()
    .from("ec_insurance_policies")
    .insert({
      company_id: input.company_id,
      policy_type: input.policy_type,
      policy_number: input.policy_number || null,
      insurer_name: input.insurer_name || null,
      coverage_amount: input.coverage_amount || null,
      premium_amount: input.premium_amount || null,
      start_date: input.start_date || null,
      end_date: input.end_date || null,
      status: "active",
    })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

// ─── Directory ───────────────────────────────────────────────

export async function getDirectory(companyId: string) {
  const [employees, branches, departments, board] = await Promise.all([
    sb()
      .from("employees")
      .select("id, employee_number, first_name, last_name, email, phone, department, job_title, status")
      .eq("company_id", companyId)
      .order("last_name")
      .limit(200),
    listBranches(companyId),
    listDepartments(companyId),
    listBoardMembers(companyId),
  ]);
  return {
    employees: employees.data || [],
    branches,
    departments,
    board,
  };
}

// ─── AI ──────────────────────────────────────────────────────

export async function listAiInsights(companyId: string) {
  const { data, error } = await sb()
    .from("ec_ai_insights")
    .select("*")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return data || [];
}

export async function generateCorporateInsights(companyId: string) {
  const stats = await getEnterpriseStats(companyId);
  const insights: Array<{
    insight_type: string;
    title: string;
    summary: string;
    severity: string;
    score: number;
    recommendations: string[];
  }> = [];

  if (stats.branches <= 1) {
    insights.push({
      insight_type: "strategic",
      title: "Single-branch concentration",
      summary: "Operations are concentrated in few branches — geographic diversification is limited.",
      severity: "warning",
      score: 70,
      recommendations: ["Open regional sales office", "Map dealer network coverage", "Set branch P&L targets"],
    });
  }

  if (stats.openRisks > 0) {
    insights.push({
      insight_type: "compliance",
      title: `${stats.openRisks} open risk(s) on register`,
      summary: "Open enterprise risks require review schedules and mitigation tracking.",
      severity: stats.openRisks > 3 ? "critical" : "warning",
      score: 75,
      recommendations: ["Board risk committee review", "Update residual ratings", "Link insurance coverage"],
    });
  }

  const { data: expiring } = await sb()
    .from("ec_company_documents")
    .select("id")
    .eq("company_id", companyId)
    .is("deleted_at", null)
    .lt("expiry_date", new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10))
    .gte("expiry_date", new Date().toISOString().slice(0, 10));

  if ((expiring?.length || 0) > 0) {
    insights.push({
      insight_type: "compliance",
      title: `${expiring!.length} document(s) expiring within 90 days`,
      summary: "Licenses or certificates need renewal to avoid compliance gaps.",
      severity: "warning",
      score: 82,
      recommendations: ["Assign document owners", "Start renewal workflows", "Calendar reminders"],
    });
  }

  if (stats.factories > 0) {
    insights.push({
      insight_type: "manufacturing",
      title: "Factory capacity review recommended",
      summary: `${stats.factories} factory site(s) registered — align capacity with order pipeline.`,
      severity: "info",
      score: 60,
      recommendations: ["Refresh OEE baseline", "Sync MES production calendar", "Utility consumption audit"],
    });
  }

  for (const i of insights) {
    await sb().from("ec_ai_insights").insert({
      company_id: companyId,
      insight_type: i.insight_type,
      title: i.title,
      summary: i.summary,
      severity: i.severity,
      score: i.score,
      recommendations: i.recommendations,
      status: "open",
    });
  }
  return insights;
}

export async function resolveInsight(id: string) {
  const { data, error } = await sb()
    .from("ec_ai_insights")
    .update({ status: "resolved", resolved_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}
