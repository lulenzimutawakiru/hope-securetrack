import { createClient } from "@/lib/supabase/crud-compat";
import { enrichColor } from "./colors";
import { applyTemplate, buildDocumentHtml, defaultLayoutJson } from "./templates";
import { scanAssetsExpiry, scanTemplatesForCompliance } from "./compliance";

function sb() {
  return createClient();
}

function pad(n: number, w = 5) {
  return String(n).padStart(w, "0");
}

export async function nextCode(companyId: string, table: string, prefix: string) {
  const { count } = await sb()
    .from(table)
    .select("*", { count: "exact", head: true })
    .eq("company_id", companyId);
  return `${prefix}-${pad((count ?? 0) + 1)}`;
}

export async function logBrandAudit(input: {
  company_id: string;
  actor_id?: string | null;
  action: string;
  entity_type?: string;
  entity_id?: string;
  details?: string;
}) {
  await sb().from("brand_audit").insert({
    company_id: input.company_id,
    actor_id: input.actor_id,
    action: input.action,
    entity_type: input.entity_type,
    entity_id: input.entity_id,
    details: input.details,
  });
}

export async function createBrandProfile(input: {
  company_id: string;
  brand_code?: string;
  brand_name: string;
  trading_name?: string;
  email?: string;
  website?: string;
  phone?: string;
  address?: string;
  is_primary?: boolean;
}) {
  const brand_code = input.brand_code || (await nextCode(input.company_id, "brand_profiles", "BRD"));
  const { data, error } = await sb()
    .from("brand_profiles")
    .insert({
      company_id: input.company_id,
      brand_code,
      brand_name: input.brand_name,
      trading_name: input.trading_name,
      email: input.email,
      website: input.website,
      phone: input.phone,
      address: input.address,
      is_primary: input.is_primary ?? false,
      is_active: true,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function addBrandColor(input: {
  company_id: string;
  brand_id?: string | null;
  name: string;
  hex_value: string;
  color_role?: string;
  usage_rules?: string;
  pantone?: string;
}) {
  const enriched = enrichColor(input.hex_value);
  const { data, error } = await sb()
    .from("brand_colors")
    .insert({
      company_id: input.company_id,
      brand_id: input.brand_id,
      name: input.name,
      color_role: input.color_role || "custom",
      ...enriched,
      pantone: input.pantone,
      usage_rules: input.usage_rules,
      status: "approved",
    })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function addBrandAsset(input: {
  company_id: string;
  brand_id?: string | null;
  title: string;
  asset_type?: string;
  file_url?: string;
  file_name?: string;
  file_format?: string;
  tags?: string[];
  expires_on?: string | null;
  uploaded_by?: string | null;
}) {
  const asset_code = await nextCode(input.company_id, "brand_assets", "AST");
  const { data, error } = await sb()
    .from("brand_assets")
    .insert({
      company_id: input.company_id,
      brand_id: input.brand_id,
      asset_code,
      title: input.title,
      asset_type: input.asset_type || "image",
      file_url: input.file_url,
      file_name: input.file_name,
      file_format: input.file_format,
      tags: input.tags || [],
      expires_on: input.expires_on,
      status: "pending",
      uploaded_by: input.uploaded_by,
      version: 1,
    })
    .select("*")
    .single();
  if (error) throw error;

  await sb().from("brand_approvals").insert({
    company_id: input.company_id,
    entity_type: "asset",
    entity_id: data.id,
    stage: "marketing_review",
    status: "pending",
    created_by: input.uploaded_by,
  });

  await logBrandAudit({
    company_id: input.company_id,
    actor_id: input.uploaded_by,
    action: "create_asset",
    entity_type: "asset",
    entity_id: data.id,
    details: asset_code,
  });
  return data;
}

export async function createTemplate(input: {
  company_id: string;
  brand_id?: string | null;
  name: string;
  category?: string;
  document_type?: string;
  canvas_size?: string;
  header_html?: string;
  footer_html?: string;
  html_body?: string;
  created_by?: string | null;
}) {
  const template_code = await nextCode(input.company_id, "brand_templates", "TPL");
  const { data, error } = await sb()
    .from("brand_templates")
    .insert({
      company_id: input.company_id,
      brand_id: input.brand_id,
      template_code,
      name: input.name,
      category: input.category || "finance",
      document_type: input.document_type || "invoice",
      canvas_size: input.canvas_size || "A4",
      layout_json: defaultLayoutJson(input.canvas_size || "A4"),
      header_html: input.header_html,
      footer_html: input.footer_html,
      html_body: input.html_body || "<p>{{content}}</p>",
      status: "draft",
      version: 1,
      created_by: input.created_by,
    })
    .select("*")
    .single();
  if (error) throw error;

  await sb().from("brand_approvals").insert({
    company_id: input.company_id,
    entity_type: "template",
    entity_id: data.id,
    stage: "marketing_review",
    status: "pending",
    created_by: input.created_by,
  });

  return data;
}

export async function advanceApproval(input: {
  approval_id: string;
  company_id: string;
  approve: boolean;
  reviewer_id: string;
  comments?: string;
}) {
  const { data: appr } = await sb()
    .from("brand_approvals")
    .select("*")
    .eq("id", input.approval_id)
    .single();
  if (!appr) throw new Error("Approval not found");

  const stageOrder = ["marketing_review", "brand_review", "management_review", "published"];
  const idx = stageOrder.indexOf(appr.stage);
  let nextStage = appr.stage;
  let status = "pending";

  if (!input.approve) {
    nextStage = "rejected";
    status = "rejected";
  } else if (idx >= 0 && idx < stageOrder.length - 1) {
    nextStage = stageOrder[idx + 1];
    status = nextStage === "published" ? "approved" : "pending";
  }

  await sb()
    .from("brand_approvals")
    .update({
      stage: nextStage,
      status,
      reviewer_id: input.reviewer_id,
      comments: input.comments,
      decided_at: new Date().toISOString(),
    })
    .eq("id", input.approval_id);

  // Sync entity status
  if (appr.entity_type === "template") {
    const patch: Record<string, unknown> = { status: nextStage === "published" ? "published" : nextStage };
    if (nextStage === "published") {
      patch.published_at = new Date().toISOString();
      patch.approved_by = input.reviewer_id;
      patch.approved_at = new Date().toISOString();
    }
    if (nextStage === "rejected") patch.status = "rejected";
    await sb().from("brand_templates").update(patch).eq("id", appr.entity_id);
  }
  if (appr.entity_type === "asset") {
    const patch: Record<string, unknown> = {
      status: nextStage === "published" || status === "approved" ? "active" : nextStage === "rejected" ? "rejected" : "pending",
    };
    if (status === "approved" || nextStage === "published") {
      patch.approved_by = input.reviewer_id;
      patch.approved_at = new Date().toISOString();
      patch.status = "active";
    }
    await sb().from("brand_assets").update(patch).eq("id", appr.entity_id);
  }

  await logBrandAudit({
    company_id: input.company_id,
    actor_id: input.reviewer_id,
    action: input.approve ? "approve" : "reject",
    entity_type: appr.entity_type,
    entity_id: appr.entity_id,
    details: nextStage,
  });

  return { stage: nextStage, status };
}

export async function renderTemplatePreview(templateId: string, extraTokens: Record<string, string> = {}) {
  const { data: tpl } = await sb().from("brand_templates").select("*").eq("id", templateId).single();
  if (!tpl) throw new Error("Template not found");

  const { data: brand } = await sb()
    .from("brand_profiles")
    .select("*")
    .eq("company_id", tpl.company_id)
    .eq("is_primary", true)
    .maybeSingle();

  const { data: colors } = await sb()
    .from("brand_colors")
    .select("color_role,hex_value")
    .eq("company_id", tpl.company_id)
    .limit(20);

  const primary = colors?.find((c) => c.color_role === "primary")?.hex_value || "#0D7377";
  const secondary = colors?.find((c) => c.color_role === "secondary")?.hex_value || "#1B263B";
  const accent = colors?.find((c) => c.color_role === "accent")?.hex_value || "#00AEEF";

  const tokens = {
    company_name: brand?.brand_name || "SecureTrack ERP",
    company_address: brand?.address || "",
    company_phone: brand?.phone || "",
    company_email: brand?.email || "",
    company_website: brand?.website || "",
    tax_number: brand?.tax_number || "",
    primary_color: primary,
    secondary_color: secondary,
    accent_color: accent,
    customer_name: "Sample Customer Ltd",
    supplier_name: "Sample Supplier",
    po_number: "PO-DEMO-001",
    total: "UGX 1,250,000",
    batch: "B240722A",
    gsm: "80",
    qr: "QR-DEMO",
    name: "Jane Doe",
    title: "Production Manager",
    full_name: "Jane Doe",
    job_title: "Production Manager",
    phone: "+256700000000",
    line_items:
      "<tr><th>Item</th><th>Qty</th><th>Amount</th></tr><tr><td>Premium A4</td><td>100</td><td>1,250,000</td></td></tr>",
    content: "Sample content",
    ...extraTokens,
  };

  return buildDocumentHtml({
    header_html: tpl.header_html,
    body_html: tpl.html_body,
    footer_html: tpl.footer_html,
    tokens,
    title: tpl.name,
  });
}

export async function runComplianceScan(companyId: string) {
  const [{ data: templates }, { data: assets }, { data: colors }] = await Promise.all([
    sb().from("brand_templates").select("id,name,status,version,published_at,html_body,header_html").eq("company_id", companyId).is("deleted_at", null),
    sb().from("brand_assets").select("id,title,expires_on,status").eq("company_id", companyId).is("deleted_at", null),
    sb().from("brand_colors").select("hex_value,color_role").eq("company_id", companyId),
  ]);

  const palette = (colors || []).map((c) => c.hex_value);
  const primary = colors?.find((c) => c.color_role === "primary")?.hex_value;

  const findings = [
    ...scanTemplatesForCompliance({
      templates: (templates || []) as Array<{
        id: string;
        name: string;
        status: string;
        version: number;
        published_at?: string | null;
        html_body?: string | null;
        header_html?: string | null;
      }>,
      approvedColors: palette,
      primaryColor: primary,
    }),
    ...scanAssetsExpiry(
      (assets || []) as Array<{ id: string; title: string; expires_on?: string | null; status?: string }>
    ),
  ];

  for (const f of findings) {
    await sb().from("brand_compliance_issues").insert({
      company_id: companyId,
      issue_type: f.issue_type,
      title: f.title,
      description: f.description,
      severity: f.severity,
      entity_type: f.entity_type,
      entity_id: f.entity_id,
      status: "open",
      detected_by: "ai",
    });
  }

  return findings;
}

export async function syncUiThemeToSettings(companyId: string, userId?: string | null) {
  const { data: theme } = await sb()
    .from("brand_ui_themes")
    .select("*")
    .eq("company_id", companyId)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();
  if (!theme) return;

  // Upsert into system_settings if table exists (best-effort via known keys)
  const rows = [
    { key: "brand.primary_color", value: JSON.stringify(theme.primary_color) },
    { key: "brand.secondary_color", value: JSON.stringify(theme.secondary_color) },
    { key: "brand.font_family", value: JSON.stringify(theme.font_family) },
    { key: "brand.login_tagline", value: JSON.stringify(theme.login_tagline || "") },
    { key: "brand.app_name", value: JSON.stringify(theme.theme_name || "SecureTrack ERP") },
  ];

  for (const r of rows) {
    await sb().from("system_settings").upsert(
      {
        company_id: companyId,
        setting_key: r.key,
        setting_value: r.value,
        updated_by: userId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "company_id,setting_key" }
    );
  }
}

export { applyTemplate, buildDocumentHtml };
