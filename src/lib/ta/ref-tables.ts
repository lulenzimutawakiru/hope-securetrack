/**
 * Server-side allowlist of talent acquisition entity tables that support
 * comments/attachments. Never interpolate a client-supplied table name into a
 * query: resolve it against this set first, then pass the validated member to
 * the Supabase query builder.
 */
export const TA_REF_TABLES: ReadonlySet<string> = new Set([
  "ta_headcount_plans",
  "ta_requisitions",
  "ta_positions",
  "ta_job_library",
  "ta_vacancies",
  "ta_pipeline_stages",
  "ta_candidates",
  "ta_applications",
  "ta_talent_pool",
  "ta_referrals",
  "ta_agencies",
  "ta_campus_events",
  "ta_assessments",
  "ta_assessment_attempts",
  "ta_interviews",
  "ta_background_checks",
  "ta_references",
  "ta_medical_exams",
  "ta_offers",
  "ta_onboarding_tasks",
  "ta_documents",
  "ta_settings",
  "ta_audit_log",
  "ta_ai_insights",
]);

export function isTaRefTable(refTable: string): boolean {
  return TA_REF_TABLES.has(refTable);
}

/**
 * Verify the referenced TA row exists in the caller's company using the
 * caller's scoped client (RLS enforces company isolation). Returns null when
 * the row exists, otherwise an error message suitable for an API response.
 */
export async function taRefExists(
  sb: import("@supabase/supabase-js").SupabaseClient,
  refTable: string,
  refId: string,
  companyId: string
): Promise<{ ok: true } | { ok: false; message: string; status: number }> {
  if (!isTaRefTable(refTable)) {
    return { ok: false, message: "Unsupported ref_table", status: 400 };
  }
  const { data, error } = await sb
    .from(refTable)
    .select("id")
    .eq("id", refId)
    .eq("company_id", companyId)
    .maybeSingle();
  if (error) {
    return {
      ok: false,
      message: `Referenced record is not readable: ${error.message}`,
      status: 400,
    };
  }
  if (!data) {
    return {
      ok: false,
      message: "Referenced record not found in the active company",
      status: 404,
    };
  }
  return { ok: true };
}

/** Sanitize a file name for storage paths (keep letters, digits, . _ -). */
export function sanitizeFileName(name: string): string {
  const clean = name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120).trim();
  return clean || "file";
}
