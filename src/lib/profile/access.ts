import type { ProfileSectionAccess } from "./types";

/**
 * Field / section level access based on role permissions and relationship.
 */
export function resolveSectionAccess(params: {
  permissions: string[];
  isSelf: boolean;
  isManagerOf: boolean;
  isHr: boolean;
  isFinance: boolean;
  isAdmin: boolean;
}): ProfileSectionAccess {
  const p = new Set(params.permissions);
  const has = (...slugs: string[]) => slugs.some((s) => p.has(s));
  const hr =
    params.isHr ||
    params.isAdmin ||
    has("hr.view", "hr.manage", "profile.manage", "profile.view");
  const finance =
    params.isFinance ||
    params.isAdmin ||
    has("profile.payroll", "finance.view", "hr.payroll");
  const manager = params.isManagerOf || has("profile.manager") || hr;
  const self = params.isSelf || has("profile.self");

  return {
    personal: hr || self,
    employment: hr || manager || self,
    job: hr || manager || self,
    timeline: hr || manager || self,
    identity: hr || self || has("wid.view"),
    account: hr || self || has("iam.view"),
    documents: hr || self || has("profile.documents"),
    skills: true,
    certifications: hr || manager || self,
    training: hr || manager || self,
    performance: hr || manager || (self && has("hr.view", "profile.self")),
    attendance: hr || manager || self,
    payroll: finance,
    projects: hr || manager || self,
    assets: hr || manager || self,
    helpdesk: hr || self || has("crm.service"),
    security: hr || has("profile.security", "iam.security", "wid.security") || params.isAdmin,
  };
}

export function canEditField(
  fieldGroup: string,
  access: ProfileSectionAccess,
  isSelf: boolean,
  isHr: boolean
): boolean {
  if (isHr) return true;
  if (!isSelf) return false;
  // Employees can edit personal contact fields via self-service (pending approval)
  const selfEditable = ["personal", "contact", "skills", "documents"];
  return selfEditable.includes(fieldGroup) && access.personal;
}

export function maskPayrollValue(value: string | number | null | undefined, canView: boolean): string {
  if (canView) return value == null ? "—" : String(value);
  return "••••••";
}
