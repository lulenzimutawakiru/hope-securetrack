import { createClient } from "@/lib/supabase/client";
import { formatAssetTag, sequenceKey } from "./numbering";
import { buildAssetQrPayload, buildEncryptedQrData, buildTagLabelHtml } from "./tags";

function sb() {
  return createClient();
}

export async function logAstAudit(input: {
  company_id: string;
  actor_id?: string | null;
  action: string;
  entity_type?: string;
  entity_id?: string;
  details?: string;
}) {
  await sb().from("ast_audit_log").insert({
    company_id: input.company_id,
    actor_id: input.actor_id,
    action: input.action,
    entity_type: input.entity_type,
    entity_id: input.entity_id,
    details: input.details,
  });
}

export async function nextAssetTag(input: {
  company_id: string;
  domain: string;
  type_code: string;
  company_prefix?: string;
}): Promise<string> {
  const key = sequenceKey(input.domain, input.type_code);
  const { data: seq } = await sb()
    .from("ast_number_sequences")
    .select("*")
    .eq("company_id", input.company_id)
    .eq("sequence_key", key)
    .maybeSingle();

  let next = 1;
  let pad = 6;
  if (seq) {
    next = Number(seq.last_number) + 1;
    pad = Number(seq.pad_width) || 6;
    await sb()
      .from("ast_number_sequences")
      .update({ last_number: next, updated_at: new Date().toISOString() })
      .eq("id", seq.id);
  } else {
    await sb().from("ast_number_sequences").insert({
      company_id: input.company_id,
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
  // Duplicate serial check
  if (input.serial_number) {
    const { count } = await sb()
      .from("ast_assets")
      .select("*", { count: "exact", head: true })
      .eq("company_id", input.company_id)
      .eq("serial_number", input.serial_number)
      .is("deleted_at", null);
    if ((count ?? 0) > 0) {
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

  const { data: asset, error } = await sb()
    .from("ast_assets")
    .insert({
      company_id: input.company_id,
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
      created_by: input.created_by,
    })
    .select("*")
    .single();
  if (error) throw error;

  // Generate identifiers
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

  await sb().from("ast_identifiers").insert([
    {
      company_id: input.company_id,
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
      company_id: input.company_id,
      asset_id: asset.id,
      id_type: "barcode",
      id_value: asset_tag,
      symbology: "code128",
      is_primary: false,
      status: "active",
    },
    {
      company_id: input.company_id,
      asset_id: asset.id,
      id_type: "rfid",
      id_value: `RFID-${asset_tag.replace(/-/g, "")}`,
      symbology: "uhf",
      is_primary: false,
      status: "active",
    },
  ]);

  await sb().from("ast_events").insert({
    company_id: input.company_id,
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
    entity_id: asset.id,
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
  // Close prior active assignment
  await sb()
    .from("ast_assignments")
    .update({ status: "returned", returned_at: new Date().toISOString() })
    .eq("asset_id", input.asset_id)
    .eq("status", "active");

  const { data, error } = await sb()
    .from("ast_assignments")
    .insert({
      company_id: input.company_id,
      asset_id: input.asset_id,
      assignment_type: input.assignment_type || "employee",
      assignee_name: input.assignee_name,
      assignee_id: input.assignee_id,
      department: input.department,
      expected_return: input.expected_return,
      condition_out: input.condition_out || "good",
      status: "active",
      created_by: input.created_by,
      notes: input.notes,
    })
    .select("*")
    .single();
  if (error) throw error;

  await sb()
    .from("ast_assets")
    .update({
      status: "assigned",
      department: input.department,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.asset_id);

  await sb().from("ast_events").insert({
    company_id: input.company_id,
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
  await sb()
    .from("ast_assignments")
    .update({
      status: "returned",
      returned_at: new Date().toISOString(),
      condition_in: input.condition_in || "good",
    })
    .eq("asset_id", input.asset_id)
    .eq("status", "active");

  await sb()
    .from("ast_assets")
    .update({ status: "active", updated_at: new Date().toISOString() })
    .eq("id", input.asset_id);

  await sb().from("ast_events").insert({
    company_id: input.company_id,
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
  const { data, error } = await sb()
    .from("ast_locations")
    .insert({
      company_id: input.company_id,
      asset_id: input.asset_id,
      location_label: input.location_label,
      location_type: input.location_type || "manual",
      latitude: input.latitude,
      longitude: input.longitude,
      recorded_by: input.recorded_by,
    })
    .select("*")
    .single();
  if (error) throw error;

  await sb()
    .from("ast_assets")
    .update({
      warehouse_location: input.location_label,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.asset_id);

  await sb().from("ast_events").insert({
    company_id: input.company_id,
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
  const { count } = await sb()
    .from("ast_audits")
    .select("*", { count: "exact", head: true })
    .eq("company_id", input.company_id);
  const audit_number = `AUD-${String((count ?? 0) + 1).padStart(5, "0")}`;

  const { data, error } = await sb()
    .from("ast_audits")
    .insert({
      company_id: input.company_id,
      audit_number,
      name: input.name,
      scope_type: input.scope_type || "company",
      scope_value: input.scope_value,
      method: input.method || "qr",
      status: "in_progress",
      started_at: new Date().toISOString(),
      created_by: input.created_by,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data;
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
  const { data: asset } = await sb()
    .from("ast_assets")
    .select("id, asset_tag")
    .eq("company_id", input.company_id)
    .or(`asset_tag.eq.${tag},serial_number.eq.${tag}`)
    .maybeSingle();

  // Also try identifier match
  let assetId = asset?.id;
  let assetTag = asset?.asset_tag || tag;
  if (!assetId) {
    const { data: ident } = await sb()
      .from("ast_identifiers")
      .select("asset_id, id_value")
      .eq("company_id", input.company_id)
      .eq("id_value", input.scanned_value)
      .maybeSingle();
    if (ident) {
      assetId = ident.asset_id;
      const { data: a } = await sb()
        .from("ast_assets")
        .select("asset_tag")
        .eq("id", ident.asset_id)
        .maybeSingle();
      assetTag = a?.asset_tag || tag;
    }
  }

  const result = input.result || (assetId ? "found" : "missing");

  const { data, error } = await sb()
    .from("ast_audit_lines")
    .insert({
      company_id: input.company_id,
      audit_id: input.audit_id,
      asset_id: assetId,
      asset_tag: assetTag,
      result,
      scanned_value: input.scanned_value,
      notes: input.notes,
      scanned_by: input.scanned_by,
    })
    .select("*")
    .single();
  if (error) throw error;

  // Update counters
  const { data: audit } = await sb()
    .from("ast_audits")
    .select("*")
    .eq("id", input.audit_id)
    .single();
  if (audit) {
    const patch: Record<string, number> = {};
    if (result === "found") patch.found_count = Number(audit.found_count) + 1;
    if (result === "missing") patch.missing_count = Number(audit.missing_count) + 1;
    if (result === "damaged") patch.damaged_count = Number(audit.damaged_count) + 1;
    if (result === "moved") patch.moved_count = Number(audit.moved_count) + 1;
    await sb().from("ast_audits").update(patch).eq("id", input.audit_id);
  }

  if (result === "missing" && assetId) {
    await sb().from("ast_assets").update({ status: "missing" }).eq("id", assetId);
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
  const { data, error } = await sb()
    .from("ast_maintenance_links")
    .insert({
      company_id: input.company_id,
      asset_id: input.asset_id,
      title: input.title,
      maintenance_type: input.maintenance_type || "corrective",
      status: "open",
      scheduled_date: input.scheduled_date,
      notes: input.notes,
      work_order_ref: `MNT-${Date.now().toString(36).toUpperCase()}`,
    })
    .select("*")
    .single();
  if (error) throw error;

  await sb()
    .from("ast_assets")
    .update({ status: "maintenance", updated_at: new Date().toISOString() })
    .eq("id", input.asset_id);

  await sb().from("ast_events").insert({
    company_id: input.company_id,
    asset_id: input.asset_id,
    event_type: "maintenance",
    title: input.title,
  });

  return data;
}

export async function getAssetTwin(assetId: string) {
  const [
    { data: asset },
    { data: identifiers },
    { data: assignments },
    { data: locations },
    { data: documents },
    { data: maintenance },
    { data: events },
  ] = await Promise.all([
    sb().from("ast_assets").select("*").eq("id", assetId).single(),
    sb().from("ast_identifiers").select("*").eq("asset_id", assetId),
    sb().from("ast_assignments").select("*").eq("asset_id", assetId).order("assigned_at", { ascending: false }).limit(10),
    sb().from("ast_locations").select("*").eq("asset_id", assetId).order("recorded_at", { ascending: false }).limit(20),
    sb().from("ast_documents").select("*").eq("asset_id", assetId),
    sb().from("ast_maintenance_links").select("*").eq("asset_id", assetId).order("created_at", { ascending: false }),
    sb().from("ast_events").select("*").eq("asset_id", assetId).order("created_at", { ascending: false }).limit(30),
  ]);

  return {
    asset,
    identifiers: identifiers || [],
    assignments: assignments || [],
    locations: locations || [],
    documents: documents || [],
    maintenance: maintenance || [],
    events: events || [],
  };
}

export async function previewTagHtml(assetId: string) {
  const { data: asset } = await sb().from("ast_assets").select("*").eq("id", assetId).single();
  if (!asset) throw new Error("Asset not found");
  return buildTagLabelHtml({
    assetTag: asset.asset_tag,
    name: asset.name,
    department: asset.department,
    serial: asset.serial_number,
  });
}

export async function bulkRegisterFromFixedAssets(companyId: string, actorId?: string | null) {
  const { data: fas } = await sb()
    .from("fixed_assets")
    .select("*")
    .eq("company_id", companyId)
    .is("deleted_at", null)
    .limit(100);

  let n = 0;
  for (const fa of fas || []) {
    const exists = await sb()
      .from("ast_assets")
      .select("id")
      .eq("fixed_asset_id", fa.id)
      .maybeSingle();
    if (exists.data) continue;
    try {
      await registerAsset({
        company_id: companyId,
        name: fa.asset_name,
        domain: "mfg",
        type_code: "FA",
        category_code: "FA",
        purchase_cost: Number(fa.acquisition_cost || 0),
        purchase_date: fa.purchase_date,
        warranty_end: fa.warranty_expiry,
        department: fa.location,
        fixed_asset_id: fa.id,
        serial_number: fa.barcode,
        created_by: actorId,
      });
      n += 1;
    } catch {
      // skip
    }
  }
  return { count: n };
}
