/** Username generation rules */

export function slugifyPart(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 40);
}

export function generateUsername(params: {
  pattern: string;
  first_name: string;
  last_name: string;
  email?: string | null;
  employee_id?: string | null;
  department?: string | null;
  custom_template?: string | null;
}): string {
  const first = slugifyPart(params.first_name || "user");
  const last = slugifyPart(params.last_name || "account");
  const emp = slugifyPart(params.employee_id || "");
  const dept = slugifyPart(params.department || "dept");
  const emailPrefix = slugifyPart((params.email || "").split("@")[0] || first);

  switch (params.pattern) {
    case "employee.number":
      return emp || `hdg${String(Date.now()).slice(-6)}`;
    case "department.employee": {
      const num = emp.replace(/\D/g, "") || String(Date.now()).slice(-3);
      return `${dept}${num}`;
    }
    case "email.prefix":
      return emailPrefix || `${first}.${last}`;
    case "custom": {
      const t = params.custom_template || "{first}.{last}";
      return t
        .replace(/\{first\}/gi, first)
        .replace(/\{last\}/gi, last)
        .replace(/\{email\}/gi, emailPrefix)
        .replace(/\{employee\}/gi, emp)
        .replace(/\{dept\}/gi, dept)
        .toLowerCase();
    }
    case "firstname.lastname":
    default:
      return `${first}.${last}`;
  }
}

export function ensureUniqueUsername(base: string, existing: Set<string>): string {
  let candidate = base;
  let i = 1;
  while (existing.has(candidate.toLowerCase())) {
    candidate = `${base}${i}`;
    i += 1;
    if (i > 999) {
      candidate = `${base}${Date.now().toString(36)}`;
      break;
    }
  }
  return candidate;
}
