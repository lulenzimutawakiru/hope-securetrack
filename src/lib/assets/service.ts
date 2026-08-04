/**
 * Asset tagging domain service — all I/O via /api/v2/crud (no browser Supabase client).
 */

import { formatAssetTag, sequenceKey } from "./numbering";
import {
  buildAssetQrPayload,
  buildEncryptedQrData,
  buildTagLabelHtml,
} from "./tags";
import {
  crudCount,
  crudGetOne,
  mustCreate,
  mustGet,
  mustList,
  mustUpdate,
  updateAllMatching,
} from "@/lib/crud/domain-helpers";

export async function logAstAudit(input: {
  company_id: string;
  actor_id?: string | null;
  action: string;
  entity_type?: string;
  entity_id?: string;
  details?: string;
}) {
  try {
    await mustCreate("ast_audit_log", {
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

export async function nextAssetTag(input: {
  company_id: string;
  domain: string;
  type_code: string;
  company_prefix?: string;
}): Promise<string> {
  const key = sequenceKey(input.domain, input.type_code);
  const existing = await mustList<Record<string, unknown>>(
    "ast_number_sequences",
    {
      pageSize: 1,
      filters: { sequence_key: key },
    }
  );

  let next = 1;
  let pad = 6;
  if (existing[0]?.id) {
    next = Number(existing[0].last_number) + 1;
    pad = Number(existing[0].pad_width) || 6;
    await mustUpdate("ast_number_sequences", String(existing[0].id), {
      last_number: next,
    });
  } else {
    await mustCreate("ast_number_sequences", {
      sequence_key: key,
      last_number: 1,
      pad_width: 6,
    });
  }

  return formatAssetTag({
    companyPrefix: input.company_prefix || "HDG",
    domain: input.domain,
    typeCode: input.type_code,
    sequence: next,
    padWidth: pad,
  });
}

export async function registerAsset(input: {
  company_id: string;
  name: string;
  domain?: string;
  type_code?: string;
  category_id?: string | null;
  category_code?: string;
  manufacturer?: string;
  model?: string;
  serial_number?: string;
  department?: string;
  branch_name?: string;
  purchase_cost?: number;
  purchase_date?: string;
  warranty_end?: string;
  supplier_name?: string;
  po_number?: string;
  fixed_asset_id?: string | null;
  created_by?: string | null;
  notes?: string;
}) {
  if (input.serial_number) {
    const count = await crudCount("ast_assets", {
      serial_number: input.serial_number,
    });
    if (count > 0) {
      throw new Error(`Duplicate manufacturer serial: ${input.serial_number}`);
    }
  }

  const domain = input.domain || "it";
  const type_code = input.type_code || "GEN";
  const asset_tag = await nextAssetTag({
    company_id: input.company_id,
    domain,
    type_code,
  });

  const asset = await mustCreate<Record<string, unknown>>("ast_assets", {
    asset_tag,
    name: input.name,
    category_id: input.category_id,
    category_code: input.category_code,
    domain,
    type_code,
    status: "active",
    condition: "good",
    manufacturer: input.manufacturer,
    model: input.model,
    serial_number: input.serial_number,
    department: input.department,
    branch_name: input.branch_name || "Kampala HQ",
    purchase_cost: input.purchase_cost || 0,
    current_value: input.purchase_cost || 0,
    purchase_date: input.purchase_date,
    warranty_end: input.warranty_end,
    supplier_name: input.supplier_name,
    po_number: input.po_number,
    fixed_asset_id: input.fixed_asset_id,
    notes: input.notes,
  });

  const { payload, signature } = buildAssetQrPayload({
    assetTag: asset_tag,
    name: input.name,
    serial: input.serial_number,
    companyId: input.company_id,
  });
  const encrypted = buildEncryptedQrData({
    assetTag: asset_tag,
    name: input.name,
    serial: input.serial_number,
    signature,
  });

  for (const row of [
    {
      asset_id: asset.id,
      id_type: "qr",
      id_value: asset_tag,
      symbology: "qr",
      payload: encrypted,
      is_primary: true,
      is_encrypted: true,
      signature_hash: signature,
      status: "active",
    },
    {
      asset_id: asset.id,
      id_type: "barcode",
      id_value: asset_tag,
      symbology: "code128",
      is_primary: false,
      status: "active",
    },
    {
      asset_id: asset.id,
      id_type: "rfid",
      id_value: `RFID-${asset_tag.replace(/-/g, "")}`,
      symbology: "uhf",
      is_primary: false,
      status: "active",
    },
  ]) {
    await mustCreate("ast_identifiers", row);
  }

  await mustCreate("ast_events", {
    asset_id: asset.id,
    event_type: "created",
    title: `Asset registered ${asset_tag}`,
    details: input.name,
    actor_id: input.created_by,
  });

  await logAstAudit({
    company_id: input.company_id,
    actor_id: input.created_by,
    action: "register",
    entity_type: "ast_assets",
    entity_id: String(asset.id),
    details: asset_tag,
  });

  return { asset, qr_payload: payload, signature };
}

export async function assignAsset(input: {
  company_id: string;
  asset_id: string;
  assignment_type?: string;
  assignee_name: string;
  assignee_id?: string | null;
  department?: string;
  expected_return?: string;
  condition_out?: string;
  created_by?: string | null;
  notes?: string;
}) {
  await updateAllMatching(
    "ast_assignments",
    { asset_id: input.asset_id, status: "active" },
    { status: "returned", returned_at: new Date().toISOString() }
  );

  const data = await mustCreate("ast_assignments", {
    asset_id: input.asset_id,
    assignment_type: input.assignment_type || "employee",
    assignee_name: input.assignee_name,
    assignee_id: input.assignee_id,
    department: input.department,
    expected_return: input.expected_return,
    condition_out: input.condition_out || "good",
    status: "active",
    notes: input.notes,
  });

  await mustUpdate("ast_assets", input.asset_id, {
    status: "assigned",
    department: input.department,
  });

  await mustCreate("ast_events", {
    asset_id: input.asset_id,
    event_type: "assigned",
    title: `Assigned to ${input.assignee_name}`,
    actor_id: input.created_by,
  });

  return data;
}

export async function unassignAsset(input: {
  company_id: string;
  asset_id: string;
  condition_in?: string;
  actor_id?: string | null;
}) {
  await updateAllMatching(
    "ast_assignments",
    { asset_id: input.asset_id, status: "active" },
    {
      status: "returned",
      returned_at: new Date().toISOString(),
      condition_in: input.condition_in || "good",
    }
  );

  await mustUpdate("ast_assets", input.asset_id, { status: "active" });

  await mustCreate("ast_events", {
    asset_id: input.asset_id,
    event_type: "returned",
    title: "Asset returned",
    actor_id: input.actor_id,
  });
}

export async function recordLocation(input: {
  company_id: string;
  asset_id: string;
  location_label: string;
  location_type?: string;
  latitude?: number;
  longitude?: number;
  recorded_by?: string | null;
}) {
  const data = await mustCreate("ast_locations", {
    asset_id: input.asset_id,
    location_label: input.location_label,
    location_type: input.location_type || "manual",
    latitude: input.latitude,
    longitude: input.longitude,
    recorded_by: input.recorded_by,
  });

  await mustUpdate("ast_assets", input.asset_id, {
    warehouse_location: input.location_label,
  });

  await mustCreate("ast_events", {
    asset_id: input.asset_id,
    event_type: "moved",
    title: `Location: ${input.location_label}`,
    actor_id: input.recorded_by,
  });

  return data;
}

export async function startAudit(input: {
  company_id: string;
  name: string;
  scope_type?: string;
  scope_value?: string;
  method?: string;
  created_by?: string | null;
}) {
  const count = await crudCount("ast_audits");
  const audit_number = `AUD-${String(count + 1).padStart(5, "0")}`;

  return mustCreate("ast_audits", {
    audit_number,
    name: input.name,
    scope_type: input.scope_type || "company",
    scope_value: input.scope_value,
    method: input.method || "qr",
    status: "in_progress",
    started_at: new Date().toISOString(),
  });
}

export async function scanAuditLine(input: {
  company_id: string;
  audit_id: string;
  scanned_value: string;
  result?: string;
  scanned_by?: string | null;
  notes?: string;
}) {
  const tag = input.scanned_value.trim().toUpperCase();
  let assetId: string | undefined;
  let assetTag = tag;

  const byTag = await mustList<Record<string, unknown>>("ast_assets", {
    pageSize: 1,
    filters: { asset_tag: tag },
  });
  if (byTag[0]?.id) {
    assetId = String(byTag[0].id);
    assetTag = String(byTag[0].asset_tag || tag);
  } else {
    const bySerial = await mustList<Record<string, unknown>>("ast_assets", {
      pageSize: 1,
      filters: { serial_number: tag },
    });
    if (bySerial[0]?.id) {
      assetId = String(bySerial[0].id);
      assetTag = String(bySerial[0].asset_tag || tag);
    }
  }

  if (!assetId) {
    const idents = await mustList<Record<string, unknown>>("ast_identifiers", {
      pageSize: 1,
      filters: { id_value: input.scanned_value },
    });
    if (idents[0]?.asset_id) {
      assetId = String(idents[0].asset_id);
      const a = await crudGetOne<Record<string, unknown>>(
        "ast_assets",
        assetId
      );
      assetTag = String(a?.asset_tag || tag);
    }
  }

  const result = input.result || (assetId ? "found" : "missing");

  const data = await mustCreate("ast_audit_lines", {
    audit_id: input.audit_id,
    asset_id: assetId || null,
    asset_tag: assetTag,
    result,
    scanned_value: input.scanned_value,
    notes: input.notes,
    scanned_by: input.scanned_by,
  });

  const audit = await crudGetOne<Record<string, unknown>>(
    "ast_audits",
    input.audit_id
  );
  if (audit) {
    const patch: Record<string, number> = {};
    if (result === "found")
      patch.found_count = Number(audit.found_count || 0) + 1;
    if (result === "missing")
      patch.missing_count = Number(audit.missing_count || 0) + 1;
    if (result === "damaged")
      patch.damaged_count = Number(audit.damaged_count || 0) + 1;
    if (result === "moved")
      patch.moved_count = Number(audit.moved_count || 0) + 1;
    if (Object.keys(patch).length) {
      await mustUpdate("ast_audits", input.audit_id, patch);
    }
  }

  if (result === "missing" && assetId) {
    await mustUpdate("ast_assets", assetId, { status: "missing" });
  }

  return data;
}

export async function createMaintenanceFromTag(input: {
  company_id: string;
  asset_id: string;
  title: string;
  maintenance_type?: string;
  scheduled_date?: string;
  notes?: string;
}) {
  const data = await mustCreate("ast_maintenance_links", {
    asset_id: input.asset_id,
    title: input.title,
    maintenance_type: input.maintenance_type || "corrective",
    status: "open",
    scheduled_date: input.scheduled_date,
    notes: input.notes,
    work_order_ref: `MNT-${Date.now().toString(36).toUpperCase()}`,
  });

  await mustUpdate("ast_assets", input.asset_id, { status: "maintenance" });

  await mustCreate("ast_events", {
    asset_id: input.asset_id,
    event_type: "maintenance",
    title: input.title,
  });

  return data;
}

export async function getAssetTwin(assetId: string) {
  const [
    asset,
    identifiers,
    assignments,
    locations,
    documents,
    maintenance,
    events,
  ] = await Promise.all([
    mustGet("ast_assets", assetId),
    mustList("ast_identifiers", {
      pageSize: 50,
      filters: { asset_id: assetId },
    }),
    mustList("ast_assignments", {
      pageSize: 10,
      filters: { asset_id: assetId },
      sort: "assigned_at",
      order: "desc",
    }),
    mustList("ast_locations", {
      pageSize: 20,
      filters: { asset_id: assetId },
      sort: "recorded_at",
      order: "desc",
    }),
    mustList("ast_documents", {
      pageSize: 50,
      filters: { asset_id: assetId },
    }),
    mustList("ast_maintenance_links", {
      pageSize: 50,
      filters: { asset_id: assetId },
      sort: "created_at",
      order: "desc",
    }),
    mustList("ast_events", {
      pageSize: 30,
      filters: { asset_id: assetId },
      sort: "created_at",
      order: "desc",
    }),
  ]);

  return {
    asset,
    identifiers,
    assignments,
    locations,
    documents,
    maintenance,
    events,
  };
}

export async function previewTagHtml(assetId: string) {
  const asset = await mustGet<Record<string, unknown>>("ast_assets", assetId);
  return buildTagLabelHtml({
    assetTag: String(asset.asset_tag || ""),
    name: String(asset.name || ""),
    department: asset.department as string | undefined,
    serial: asset.serial_number as string | undefined,
  });
}

export async function bulkRegisterFromFixedAssets(
  companyId: string,
  actorId?: string | null
) {
  const fas = await mustList<Record<string, unknown>>("fixed_assets", {
    pageSize: 100,
  });

  let n = 0;
  for (const fa of fas) {
    const exists = await mustList("ast_assets", {
      pageSize: 1,
      filters: { fixed_asset_id: fa.id },
    });
    if (exists.length) continue;
    try {
      await registerAsset({
        company_id: companyId,
        name: String(fa.asset_name || "Fixed asset"),
        domain: "mfg",
        type_code: "FA",
        category_code: "FA",
        purchase_cost: Number(fa.acquisition_cost || 0),
        purchase_date: fa.purchase_date as string | undefined,
        warranty_end: fa.warranty_expiry as string | undefined,
        department: fa.location as string | undefined,
        fixed_asset_id: String(fa.id),
        serial_number: fa.barcode as string | undefined,
        created_by: actorId,
      });
      n += 1;
    } catch {
      /* skip */
    }
  }
  return { count: n };
}
