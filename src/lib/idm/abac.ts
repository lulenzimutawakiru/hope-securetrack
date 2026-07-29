/** Attribute-Based Access Control evaluation */

export interface AbacContext {
  department?: string | null;
  user_type?: string | null;
  role_slug?: string | null;
  role_name?: string | null;
  job_title?: string | null;
  location_name?: string | null;
  cost_center?: string | null;
  data_scope?: string | null;
  is_remote?: boolean;
}

export interface AbacRule {
  id?: string;
  rule_code?: string;
  name?: string;
  conditions: Record<string, unknown>;
  effect: "allow" | "deny" | string;
  permission_slugs?: string[] | null;
  action_label?: string | null;
  priority?: number | null;
  is_active?: boolean | null;
}

function matchCondition(ctx: AbacContext, conditions: Record<string, unknown>): boolean {
  for (const [key, expected] of Object.entries(conditions)) {
    if (expected == null || expected === "") continue;
    const exp = String(expected).toLowerCase();

    if (key === "role_contains") {
      const hay = `${ctx.role_slug || ""} ${ctx.role_name || ""} ${ctx.job_title || ""}`.toLowerCase();
      if (!hay.includes(exp)) return false;
      continue;
    }

    const actual = String(
      (ctx as Record<string, unknown>)[key] ?? ""
    ).toLowerCase();
    if (actual !== exp) return false;
  }
  return true;
}

export function evaluateAbac(
  rules: AbacRule[],
  ctx: AbacContext,
  permissionSlug?: string
): {
  allowed: boolean | null;
  matched: AbacRule[];
  deny: AbacRule | null;
  allow: AbacRule | null;
} {
  const active = rules
    .filter((r) => r.is_active !== false)
    .sort((a, b) => (a.priority ?? 100) - (b.priority ?? 100));

  const matched: AbacRule[] = [];
  let deny: AbacRule | null = null;
  let allow: AbacRule | null = null;

  for (const rule of active) {
    if (!matchCondition(ctx, rule.conditions || {})) continue;
    if (
      permissionSlug &&
      rule.permission_slugs?.length &&
      !rule.permission_slugs.includes(permissionSlug)
    ) {
      continue;
    }
    matched.push(rule);
    if (rule.effect === "deny" && !deny) deny = rule;
    if (rule.effect === "allow" && !allow) allow = rule;
  }

  // Deny wins
  if (deny) return { allowed: false, matched, deny, allow };
  if (allow) return { allowed: true, matched, deny, allow };
  return { allowed: null, matched, deny, allow };
}

export function explainAbac(
  result: ReturnType<typeof evaluateAbac>
): string {
  if (result.deny) {
    return `Denied by rule ${result.deny.rule_code || result.deny.name}: ${result.deny.action_label || "access blocked"}`;
  }
  if (result.allow) {
    return `Allowed by rule ${result.allow.rule_code || result.allow.name}: ${result.allow.action_label || "access granted"}`;
  }
  return "No ABAC rule matched — fall back to RBAC permissions.";
}
