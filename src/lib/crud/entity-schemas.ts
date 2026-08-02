/**
 * Per-entity CRUD payload validation.
 *
 * The generic CRUD route historically accepted any JSON object
 * (z.record(z.unknown())), so malformed payloads surfaced as database 500s
 * instead of client 400s. This module adds optional per-entity zod schemas:
 * when an entity has a schema, the CRUD engine validates the raw client
 * payload BEFORE any write and returns a 400 with field-level issues.
 *
 * Safety contract:
 *   - Schemas are deliberately loose: `.passthrough()` so unlisted columns are
 *     never rejected, and only string/UUID fields are type-checked. Numeric and
 *     boolean columns are left to the database (pages have historically sent
 *     both numbers and numeric strings), which avoids regressions while still
 *     catching the classic 500s: objects/arrays/numbers where strings are
 *     expected, and over-long text.
 *   - Identity/lifecycle columns (company_id, tenant_id, created_by,
 *     updated_by, deleted_at) are validated as strings when present; the engine
 *     strips/overwrites them regardless.
 *
 * Add a schema here for any entity you migrate onto the CRUD API.
 */
import { z } from "zod";

const str = (max: number) => z.string().max(max).optional().nullable();
const uuidCol = z.string().min(1).max(64).optional().nullable();
const statusCol = (max = 50) => str(max);

export const ENTITY_SCHEMAS: Record<string, z.ZodType<unknown>> = {
  // ---- Inventory / product master ----------------------------------------
  products: z
    .object({
      id: uuidCol,
      company_id: uuidCol,
      tenant_id: uuidCol,
      name: str(300),
      sku: str(100),
      description: str(4000),
      status: statusCol(),
      category_id: uuidCol,
    })
    .passthrough(),

  // ---- CRM ----------------------------------------------------------------
  customers: z
    .object({
      id: uuidCol,
      company_id: uuidCol,
      tenant_id: uuidCol,
      name: str(300),
      email: str(320),
      phone: str(50),
      status: statusCol(),
      customer_type: str(50),
    })
    .passthrough(),

  crm_contacts: z
    .object({
      id: uuidCol,
      company_id: uuidCol,
      tenant_id: uuidCol,
      first_name: str(150),
      last_name: str(150),
      email: str(320),
      phone: str(50),
      job_title: str(150),
      status: statusCol(),
    })
    .passthrough(),

  crm_activities: z
    .object({
      id: uuidCol,
      company_id: uuidCol,
      tenant_id: uuidCol,
      title: str(300),
      activity_type: str(80),
      status: statusCol(),
      notes: str(4000),
    })
    .passthrough(),

  distributors: z
    .object({
      id: uuidCol,
      company_id: uuidCol,
      tenant_id: uuidCol,
      name: str(300),
      email: str(320),
      phone: str(50),
      status: statusCol(),
      region: str(150),
    })
    .passthrough(),

  // ---- Branding (DAM) -----------------------------------------------------
  brand_ui_themes: z
    .object({
      id: uuidCol,
      company_id: uuidCol,
      tenant_id: uuidCol,
      theme_name: str(100),
      primary_color: str(20),
      secondary_color: str(20),
      accent_color: str(20),
      font_family: str(100),
      logo_url: str(2000),
      favicon_url: str(2000),
      login_tagline: str(500),
      login_background_url: str(2000),
    })
    .passthrough(),

  brand_logos: z
    .object({
      id: uuidCol,
      company_id: uuidCol,
      tenant_id: uuidCol,
      name: str(150),
      logo_type: str(40),
      file_url: str(2000),
      file_format: str(20),
      status: statusCol(30),
    })
    .passthrough(),

  brand_fonts: z
    .object({
      id: uuidCol,
      company_id: uuidCol,
      tenant_id: uuidCol,
      name: str(150),
      font_family: str(100),
      font_file_url: str(2000),
      font_format: str(20),
      status: statusCol(30),
    })
    .passthrough(),

  brand_guidelines: z
    .object({
      id: uuidCol,
      company_id: uuidCol,
      tenant_id: uuidCol,
      title: str(300),
      description: str(8000),
      status: statusCol(30),
    })
    .passthrough(),

  brand_email_signatures: z
    .object({
      id: uuidCol,
      company_id: uuidCol,
      tenant_id: uuidCol,
      name: str(150),
      title: str(300),
      email: str(320),
      phone: str(50),
      signature_html: str(20000),
      status: statusCol(30),
    })
    .passthrough(),

  brand_product_profiles: z
    .object({
      id: uuidCol,
      company_id: uuidCol,
      tenant_id: uuidCol,
      name: str(300),
      sku: str(100),
      description: str(4000),
      status: statusCol(30),
    })
    .passthrough(),

  brand_compliance_issues: z
    .object({
      id: uuidCol,
      company_id: uuidCol,
      tenant_id: uuidCol,
      issue_type: str(50),
      title: str(300),
      description: str(4000),
      entity_type: str(40),
      severity: str(20),
      status: statusCol(30),
    })
    .passthrough(),
};

/** Validate a raw client payload for an entity. No-op when no schema exists. */
export function validatePayload(
  entity: string,
  payload: unknown
): { ok: true } | { ok: false; issues: string[] } {
  const schema = ENTITY_SCHEMAS[entity];
  if (!schema) return { ok: true };
  const result = schema.safeParse(payload ?? {});
  if (result.success) return { ok: true };
  return {
    ok: false,
    issues: result.error.issues.map(
      (issue) => `${issue.path.join(".") || "body"}: ${issue.message}`
    ),
  };
}

/** List of entities with an active schema (used by tests + docs). */
export function getSchemaEntities(): string[] {
  return Object.keys(ENTITY_SCHEMAS).sort();
}
