/**
 * Employee ID numbering ? configurable per company.
 *
 * Supported format tokens (see idm_employee_numbering_rules.format):
 *   {PREFIX}  rule prefix (or rule code when prefix is empty)
 *   {COMPANY} company code (uppercased)
 *   {BRANCH}  branch code (uppercased, supplied at issue time)
 *   {DEPT}    department code (uppercased, supplied at issue time)
 *   {YEAR}    4-digit year
 *   {YY}      2-digit year
 *   {SEQ}     auto-increment sequence (padded to rule padding, default 5)
 *   {SEQ:n}   auto-increment sequence padded to n digits
 *
 * Example formats:
 *   EMP-000001                      -> static prefix + sequence
 *   EMP-{YEAR}-{SEQ}                -> EMP-2026-00042
 *   {BRANCH}-EMP-{YEAR}-{SEQ}       -> KLA-EMP-2026-00042
 *   {DEPT}-EMP-{SEQ}                -> FIN-EMP-00042
 */

import { createClient } from "@/lib/supabase/crud-compat";

export const EMPLOYEE_NUMBER_TOKENS = [
  { token: "{PREFIX}", label: "Rule prefix / code", example: "EMP-" },
  { token: "{COMPANY}", label: "Company code", example: "HDG-" },
  { token: "{BRANCH}", label: "Branch code", example: "KLA-" },
  { token: "{DEPT}", label: "Department code", example: "FIN-" },
  { token: "{YEAR}", label: "Year (4 digit)", example: "2026" },
  { token: "{YY}", label: "Year (2 digit)", example: "26" },
  { token: "{SEQ}", label: "Sequence (padded)", example: "00042" },
  { token: "{SEQ:6}", label: "Sequence (6 digit)", example: "000042" },
] as const;

export interface EmployeeNumberingRule {
  id: string;
  company_id: string;
  rule_code: string;
  name: string;
  description: string | null;
  format: string;
  prefix: string | null;
  padding: number | null;
  per_year: boolean | null;
  next_sequence: number | null;
  last_issued_year: number | null;
  is_default: boolean;
  is_active: boolean;
}

export interface EmployeeNumberPreviewCtx {
  prefix?: string | null;
  companyCode?: string | null;
  branchCode?: string | null;
  departmentCode?: string | null;
  year?: number;
  sequence?: number;
  padding?: number;
}

function pad(n: number, width: number): string {
  return String(Math.max(n, 0)).padStart(Math.max(width, 1), "0");
}

/** Pure formatter ? mirrors the SQL token replacement for previews. */
export function formatEmployeeNumber(
  template: string,
  ctx: EmployeeNumberPreviewCtx = {}
): string {
  const year = ctx.year ?? new Date().getFullYear();
  const seq = ctx.sequence ?? 1;
  let out = template || "EMP-{YEAR}-{SEQ}";
  out = out
    .replace(/{PREFIX}/gi, ctx.prefix ?? "")
    .replace(/{COMPANY}/gi, (ctx.companyCode ?? "").toUpperCase())
    .replace(/{BRANCH}/gi, (ctx.branchCode ?? "").toUpperCase())
    .replace(/{DEPT}/gi, (ctx.departmentCode ?? "").toUpperCase())
    .replace(/{YEAR}/gi, String(year))
    .replace(/{YY}/gi, String(year).slice(-2));
  out = out.replace(/{SEQ:(\d+)}/gi, (_m, w: string) =>
    pad(seq, Number(w))
  );
  out = out.replace(/{SEQ}/gi, pad(seq, ctx.padding ?? 5));
  return out;
}

export interface NextEmployeeIdInput {
  companyId: string;
  ruleId?: string | null;
  branchCode?: string | null;
  departmentCode?: string | null;
}

/**
 * Atomically issue the next employee ID for a company using the
 * configured numbering rule (SQL function serialises on the rule row).
 * Falls back to a best-effort client-side number if the RPC is missing.
 */
export async function nextEmployeeId(
  input: NextEmployeeIdInput
): Promise<string> {
  const { data, error } = await createClient().rpc("issue_employee_number", {
    p_company_id: input.companyId,
    p_rule_id: input.ruleId ?? null,
    p_branch_code: input.branchCode ?? null,
    p_department_code: input.departmentCode ?? null,
  });
  if (!error && typeof data === "string" && data.length > 0) {
    return data;
  }
  // Fallback: EMP-YYYY-<count+1>
  const year = new Date().getFullYear();
  const { count } = await createClient()
    .from("user_profiles")
    .select("*", { count: "exact", head: true })
    .eq("company_id", input.companyId);
  return `EMP-${year}-${pad((count ?? 0) + 1, 5)}`;
}

/** Load active numbering rules for a company (default first). */
export async function listNumberingRules(
  companyId: string
): Promise<EmployeeNumberingRule[]> {
  const { data } = await createClient()
    .from("idm_employee_numbering_rules")
    .select("*")
    .eq("company_id", companyId)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: true });
  return (data as EmployeeNumberingRule[]) ?? [];
}
