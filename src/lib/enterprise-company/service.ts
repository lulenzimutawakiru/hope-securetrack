/**
 * Enterprise company domain service.
 * All mutations go through /api/v2/crud (session-scoped, permissioned, audited).
 * Reads use the same path so RLS + API authZ both apply.
 */

import {
  crudCount,
  crudCreate,
  crudGetOne,
  crudList,
  crudUpdate,
  crudDelete,
} from "@/lib/api/crud-client";
import {
  orgStats,
  wouldCreateCycle,
  type OrgNodeLike,
} from "./org-tree";
import { ORG_NODE_TYPES } from "./types";

async function mustCreate<T = Record<string, unknown>>(
  entity: string,
  body: Record<string, unknown>
): Promise<T> {
  const res = await crudCreate<T>(entity, body);
  if (!res.ok) throw new Error(res.error);
  return res.data;
}

async function mustUpdate<T = Record<string, unknown>>(
  entity: string,
  id: string,
  body: Record<string, unknown>
): Promise<T> {
  const res = await crudUpdate<T>(entity, id, body);
  if (!res.ok) throw new Error(res.error);
  return res.data;
}

async function mustList<T = Record<string, unknown>>(
  entity: string,
  opts?: {
    pageSize?: number;
    sort?: string;
    order?: "asc" | "desc";
    filters?: Record<string, unknown>;
    includeDeleted?: boolean;
  }
): Promise<T[]> {
  const res = await crudList<T>(entity, {
    page: 1,
    pageSize: opts?.pageSize ?? 200,
    sort: opts?.sort,
    order: opts?.order,
    filters: opts?.filters,
    includeDeleted: opts?.includeDeleted,
  });
  if (!res.ok) throw new Error(res.error);
  return res.data.data;
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
  try {
    await crudCreate("ec_audit_log", {
      actor_id: input.actor_id || null,
      action: input.action,
      entity_table: input.entity_table || null,
      entity_id: input.entity_id || null,
      entity_code: input.entity_code || null,
      details: input.details || null,
    });
  } catch {
    /* best-effort */
  }
}

export async function getEnterpriseStats(_companyId: string) {
  void _companyId; // company scope comes from session on CRUD path
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
    crudCount("companies"),
    crudCount("branches"),
    crudCount("factories"),
    crudCount("departments"),
    crudCount("warehouses"),
    crudCount("ec_business_units"),
    crudCount("ec_company_documents"),
    crudCount("ec_risk_register", { status: "open" }),
    crudCount("ec_insurance_policies", { status: "active" }),
    crudCount("ec_ai_insights", { status: "open" }),
    crudCount("ec_board_members", { is_active: true }),
  ]);

  return {
    companies,
    branches,
    factories,
    departments,
    warehouses,
    businessUnits,
    documents,
    openRisks: risks,
    insurancePolicies: insurance,
    openInsights: insights,
    boardMembers: board,
  };
}

// ─── Companies ───────────────────────────────────────────────

export async function listCompanies() {
  return mustList("companies", { pageSize: 200, sort: "name", order: "asc" });
}

export async function getCompany(id: string) {
  return crudGetOne("companies", id);
}

export async function updateCompany(
  id: string,
  patch: Record<string, unknown>,
  actorId?: string | null
) {
  const body = { ...patch, updated_by: actorId || null };
  delete body.id;
  delete body.company_id;
  delete body.tenant_id;
  const data = await mustUpdate("companies", id, body);
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
  const data = await mustCreate<Record<string, unknown>>("companies", {
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
  });
  const companyId = String(data.id);

  try {
    await crudCreate("ec_company_branding", {
      primary_color: "#0B1F3A",
      secondary_color: "#C9A227",
    });
  } catch {
    /* branding optional */
  }

  await logCompanyAudit({
    company_id: companyId,
    actor_id: actorId,
    action: "create",
    entity_table: "companies",
    entity_id: companyId,
    entity_code: String(data.code || input.code),
  });
  return data;
}

// ─── Structure ───────────────────────────────────────────────

export async function listBranches(_companyId: string) {
  void _companyId;
  return mustList("branches", { sort: "name", order: "asc" });
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
  return mustCreate("branches", {
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
  });
}

export async function listFactories(_companyId: string) {
  void _companyId;
  return mustList("factories", { sort: "name", order: "asc" });
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
  return mustCreate("factories", {
    code: input.code.toUpperCase(),
    name: input.name,
    plant_manager_name: input.plant_manager_name || null,
    production_capacity: input.production_capacity || null,
    production_lines: input.production_lines || 0,
    city: input.city || null,
    address: input.address || null,
    is_active: true,
  });
}

export async function listDepartments(_companyId: string) {
  void _companyId;
  return mustList("departments", { sort: "name", order: "asc" });
}

export async function createDepartment(input: {
  company_id: string;
  code: string;
  name: string;
  manager_name?: string;
  cost_center_code?: string;
  business_unit_id?: string | null;
}) {
  return mustCreate("departments", {
    code: input.code.toUpperCase(),
    name: input.name,
    manager_name: input.manager_name || null,
    cost_center_code: input.cost_center_code || null,
    business_unit_id: input.business_unit_id || null,
    is_active: true,
  });
}

export async function listWarehouses(_companyId: string) {
  void _companyId;
  return mustList("warehouses", { sort: "name", order: "asc" });
}

export async function listBusinessUnits(_companyId: string) {
  void _companyId;
  return mustList("ec_business_units", { sort: "sort_order", order: "asc" });
}

export async function createBusinessUnit(input: {
  company_id: string;
  code: string;
  name: string;
  unit_type?: string;
  director_name?: string;
  budget_amount?: number;
}) {
  return mustCreate("ec_business_units", {
    code: input.code.toUpperCase(),
    name: input.name,
    unit_type: input.unit_type || "corporate",
    director_name: input.director_name || null,
    budget_amount: input.budget_amount || null,
    status: "active",
  });
}

export async function listCostCenters(_companyId: string) {
  void _companyId;
  return mustList("ec_cost_centers", { sort: "code", order: "asc" });
}

export async function createCostCenter(input: {
  company_id: string;
  code: string;
  name: string;
  manager_name?: string;
}) {
  return mustCreate("ec_cost_centers", {
    code: input.code.toUpperCase(),
    name: input.name,
    manager_name: input.manager_name || null,
    is_active: true,
  });
}

// ─── Org chart ───────────────────────────────────────────────

export async function listOrgNodes(_companyId: string) {
  void _companyId;
  const rows = await mustList<Record<string, unknown>>("ec_org_nodes", {
    pageSize: 500,
    sort: "sort_order",
    order: "asc",
  });
  return rows as unknown as OrgNodeLike[];
}

export async function getOrgNode(id: string) {
  const row = await crudGetOne("ec_org_nodes", id);
  if (!row) throw new Error("Node not found");
  return row;
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
  return mustCreate("ec_org_nodes", {
    code: input.code.toUpperCase(),
    name: input.name,
    node_type: input.node_type,
    parent_id: input.parent_id || null,
    manager_name: input.manager_name || null,
    manager_user_id: input.manager_user_id || null,
    sort_order: input.sort_order ?? 0,
    is_active: input.is_active ?? true,
  });
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
  const body: Record<string, unknown> = {};
  if (patch.code !== undefined) body.code = patch.code.toUpperCase();
  if (patch.name !== undefined) body.name = patch.name;
  if (patch.node_type !== undefined) body.node_type = patch.node_type;
  if (patch.parent_id !== undefined) body.parent_id = patch.parent_id || null;
  if (patch.manager_name !== undefined)
    body.manager_name = patch.manager_name || null;
  if (patch.manager_user_id !== undefined)
    body.manager_user_id = patch.manager_user_id || null;
  if (patch.sort_order !== undefined) body.sort_order = patch.sort_order;
  if (patch.is_active !== undefined) body.is_active = patch.is_active;
  return mustUpdate("ec_org_nodes", id, body);
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

export async function deleteOrgNode(id: string) {
  const children = await mustList("ec_org_nodes", {
    pageSize: 1,
    filters: { parent_id: id },
  });
  if (children.length > 0) {
    throw new Error(
      "Cannot delete a node that still has child nodes. Move or archive children first."
    );
  }
  const res = await crudDelete("ec_org_nodes", id);
  if (!res.ok) throw new Error(res.error);
  return res.data;
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

export async function importOrgNodes(
  companyId: string,
  rows: Array<Record<string, string>>
): Promise<OrgImportResult> {
  const result: OrgImportResult = {
    created: 0,
    updated: 0,
    skipped: 0,
    errors: [],
  };
  if (rows.length === 0) return result;

  const existing = await listOrgNodes(companyId);
  const byCode = new Map(
    existing.map((n) => [String(n.code ?? "").toUpperCase(), n])
  );
  const validTypes = new Set<string>(ORG_NODE_TYPES);

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNo = i + 2;
    const code = (row.code ?? "").trim().toUpperCase();
    const name = (row.name ?? "").trim();
    if (!code || !name) {
      result.errors.push("Row " + rowNo + ": code and name are required");
      result.skipped++;
      continue;
    }
    const nodeType = (row.node_type ?? "department").trim();
    if (!validTypes.has(nodeType)) {
      result.errors.push(
        "Row " + rowNo + ": unknown node_type '" + nodeType + "'"
      );
      result.skipped++;
      continue;
    }
    const managerName = (row.manager_name ?? "").trim() || null;
    const sortOrder = parseInt(row.sort_order ?? "0", 10);
    const isActive = (row.is_active ?? "true").toLowerCase() !== "false";
    const existingNode = byCode.get(code);
    try {
      if (existingNode) {
        await updateOrgNode(String(existingNode.id), {
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
        byCode.set(code, created as Record<string, unknown>);
        result.created++;
      }
    } catch (e) {
      result.errors.push(
        "Row " + rowNo + ": " + (e instanceof Error ? e.message : "failed")
      );
      result.skipped++;
    }
  }

  const fresh = await listOrgNodes(companyId);
  const codeToId = new Map(
    fresh.map((n) => [String(n.code ?? "").toUpperCase(), String(n.id)])
  );
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNo = i + 2;
    const code = (row.code ?? "").trim().toUpperCase();
    const parentCode = (row.parent_code ?? "").trim().toUpperCase();
    const nodeId = codeToId.get(code);
    if (!nodeId || !parentCode) continue;
    const parentId = codeToId.get(parentCode);
    if (!parentId) {
      result.errors.push(
        "Row " + rowNo + ": parent_code '" + row.parent_code + "' not found"
      );
      continue;
    }
    try {
      await assertSafeReparent(companyId, nodeId, parentId);
      await updateOrgNode(nodeId, { parent_id: parentId });
    } catch (e) {
      result.errors.push(
        "Row " +
          rowNo +
          ": " +
          (e instanceof Error ? e.message : "parent link failed")
      );
    }
  }

  return result;
}

// ─── Settings / branding ─────────────────────────────────────

export async function listCompanySettings(_companyId: string) {
  void _companyId;
  return mustList("ec_company_settings", {
    pageSize: 500,
    sort: "domain",
    order: "asc",
  });
}

export async function upsertCompanySetting(input: {
  company_id: string;
  domain: string;
  setting_key: string;
  setting_value: unknown;
  description?: string;
  updated_by?: string | null;
}) {
  const existing = await mustList<Record<string, unknown>>(
    "ec_company_settings",
    {
      pageSize: 5,
      filters: { domain: input.domain, setting_key: input.setting_key },
    }
  );
  const body = {
    domain: input.domain,
    setting_key: input.setting_key,
    setting_value: input.setting_value as object,
    description: input.description || null,
    updated_by: input.updated_by || null,
  };
  if (existing[0]?.id) {
    return mustUpdate("ec_company_settings", String(existing[0].id), body);
  }
  return mustCreate("ec_company_settings", body);
}

export async function getCompanyBranding(_companyId: string) {
  void _companyId;
  const rows = await mustList("ec_company_branding", { pageSize: 1 });
  return rows[0] || null;
}

// ─── Documents ───────────────────────────────────────────────

export async function listDocuments(_companyId: string) {
  void _companyId;
  return mustList("ec_company_documents", {
    sort: "expiry_date",
    order: "asc",
  });
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
  return mustCreate("ec_company_documents", {
    doc_type: input.doc_type,
    title: input.title,
    doc_number: input.doc_number || null,
    file_url: input.file_url || null,
    issued_date: input.issued_date || null,
    expiry_date: input.expiry_date || null,
    uploaded_by: input.uploaded_by || null,
    status: "active",
  });
}

// ─── Calendar ────────────────────────────────────────────────

export async function listCalendarEvents(_companyId: string, year?: number) {
  void _companyId;
  if (year) {
    return mustList("ec_calendar_events", {
      pageSize: 200,
      sort: "start_date",
      order: "asc",
      filters: {
        start_date: {
          gte: `${year}-01-01`,
          lte: `${year}-12-31`,
        },
      },
    });
  }
  return mustList("ec_calendar_events", {
    pageSize: 200,
    sort: "start_date",
    order: "asc",
  });
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
  return mustCreate("ec_calendar_events", {
    event_type: input.event_type,
    title: input.title,
    start_date: input.start_date,
    end_date: input.end_date || input.start_date,
    description: input.description || null,
  });
}

// ─── Governance ──────────────────────────────────────────────

export async function listBoardMembers(_companyId: string) {
  void _companyId;
  return mustList("ec_board_members", { sort: "full_name", order: "asc" });
}

export async function listCommittees(_companyId: string) {
  void _companyId;
  return mustList("ec_committees", { sort: "name", order: "asc" });
}

export async function listMeetings(_companyId: string) {
  void _companyId;
  return mustList("ec_meetings", {
    pageSize: 50,
    sort: "scheduled_at",
    order: "desc",
  });
}

export async function listSignatories(_companyId: string) {
  void _companyId;
  return mustList("ec_authorized_signatories", {
    sort: "full_name",
    order: "asc",
    filters: { is_active: true },
  });
}

export async function createBoardMember(input: {
  company_id: string;
  full_name: string;
  title?: string;
  member_type?: string;
  email?: string;
}) {
  return mustCreate("ec_board_members", {
    full_name: input.full_name,
    title: input.title || null,
    member_type: input.member_type || "director",
    email: input.email || null,
    is_active: true,
  });
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
  const count = await crudCount("ec_meetings");
  const meeting_number = `MTG-${year}-${String(count + 1).padStart(3, "0")}`;

  return mustCreate("ec_meetings", {
    meeting_number,
    title: input.title,
    meeting_type: input.meeting_type || "board",
    scheduled_at: input.scheduled_at || null,
    agenda: input.agenda || null,
    status: "scheduled",
  });
}

// ─── Risk & insurance ────────────────────────────────────────

export async function listRisks(_companyId: string) {
  void _companyId;
  return mustList("ec_risk_register", { sort: "risk_code", order: "asc" });
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
  return mustCreate("ec_risk_register", {
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
  });
}

export async function listInsurance(_companyId: string) {
  void _companyId;
  return mustList("ec_insurance_policies", { sort: "end_date", order: "asc" });
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
  return mustCreate("ec_insurance_policies", {
    policy_type: input.policy_type,
    policy_number: input.policy_number || null,
    insurer_name: input.insurer_name || null,
    coverage_amount: input.coverage_amount || null,
    premium_amount: input.premium_amount || null,
    start_date: input.start_date || null,
    end_date: input.end_date || null,
    status: "active",
  });
}

// ─── Directory ───────────────────────────────────────────────

export async function getDirectory(companyId: string) {
  const [employees, branches, departments, board] = await Promise.all([
    mustList("employees", {
      pageSize: 200,
      sort: "last_name",
      order: "asc",
    }),
    listBranches(companyId),
    listDepartments(companyId),
    listBoardMembers(companyId),
  ]);
  return {
    employees,
    branches,
    departments,
    board,
  };
}

// ─── AI ──────────────────────────────────────────────────────

export async function listAiInsights(_companyId: string) {
  void _companyId;
  return mustList("ec_ai_insights", {
    pageSize: 50,
    sort: "created_at",
    order: "desc",
  });
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
      summary:
        "Operations are concentrated in few branches — geographic diversification is limited.",
      severity: "warning",
      score: 70,
      recommendations: [
        "Open regional sales office",
        "Map dealer network coverage",
        "Set branch P&L targets",
      ],
    });
  }

  if (stats.openRisks > 0) {
    insights.push({
      insight_type: "compliance",
      title: `${stats.openRisks} open risk(s) on register`,
      summary:
        "Open enterprise risks require review schedules and mitigation tracking.",
      severity: stats.openRisks > 3 ? "critical" : "warning",
      score: 75,
      recommendations: [
        "Board risk committee review",
        "Update residual ratings",
        "Link insurance coverage",
      ],
    });
  }

  const horizon = new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10);
  const today = new Date().toISOString().slice(0, 10);
  const docs = await mustList<Record<string, unknown>>("ec_company_documents", {
    pageSize: 200,
  });
  const expiring = docs.filter((d) => {
    const exp = d.expiry_date ? String(d.expiry_date).slice(0, 10) : "";
    return exp && exp >= today && exp <= horizon;
  });

  if (expiring.length > 0) {
    insights.push({
      insight_type: "compliance",
      title: `${expiring.length} document(s) expiring within 90 days`,
      summary:
        "Licenses or certificates need renewal to avoid compliance gaps.",
      severity: "warning",
      score: 82,
      recommendations: [
        "Assign document owners",
        "Start renewal workflows",
        "Calendar reminders",
      ],
    });
  }

  if (stats.factories > 0) {
    insights.push({
      insight_type: "manufacturing",
      title: "Factory capacity review recommended",
      summary: `${stats.factories} factory site(s) registered — align capacity with order pipeline.`,
      severity: "info",
      score: 60,
      recommendations: [
        "Refresh OEE baseline",
        "Sync MES production calendar",
        "Utility consumption audit",
      ],
    });
  }

  for (const i of insights) {
    await mustCreate("ec_ai_insights", {
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
  return mustUpdate("ec_ai_insights", id, {
    status: "resolved",
    resolved_at: new Date().toISOString(),
  });
}
