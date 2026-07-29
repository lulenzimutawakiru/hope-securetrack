/** AI User Management Assistant */

export interface UserRiskInput {
  id: string;
  email?: string | null;
  first_name?: string;
  last_name?: string;
  is_active?: boolean | null;
  account_status?: string | null;
  last_login_at?: string | null;
  failed_login_count?: number | null;
  mfa_enabled?: boolean | null;
  require_mfa?: boolean | null;
  mfa_enforced?: boolean | null;
  user_type?: string | null;
  job_title?: string | null;
  role_slug?: string | null;
  role_name?: string | null;
  permission_count?: number;
  account_expires_at?: string | null;
}

export interface IdmAiInsight {
  type: "role" | "permissions" | "inactive" | "security" | "suspicious" | "expiry" | "mfa" | "onboarding";
  severity: "info" | "low" | "medium" | "high";
  title: string;
  detail: string;
  userId?: string;
  userLabel?: string;
  actions: string[];
}

export function analyzeUserRisks(users: UserRiskInput[]): IdmAiInsight[] {
  const insights: IdmAiInsight[] = [];
  const now = Date.now();
  const day = 864e5;

  for (const u of users) {
    const label = [u.first_name, u.last_name].filter(Boolean).join(" ") || u.email || u.id;
    const lastLogin = u.last_login_at ? new Date(u.last_login_at).getTime() : null;
    const inactiveDays = lastLogin ? (now - lastLogin) / day : 999;
    const fails = Number(u.failed_login_count || 0);
    const mfaOn = Boolean(u.mfa_enabled || u.require_mfa || u.mfa_enforced);
    const perms = Number(u.permission_count || 0);
    const isAdmin =
      (u.role_slug || "").includes("admin") ||
      (u.user_type || "") === "administrator" ||
      (u.role_name || "").toLowerCase().includes("admin");

    if (u.is_active && inactiveDays > 90) {
      insights.push({
        type: "inactive",
        severity: inactiveDays > 180 ? "high" : "medium",
        title: "Inactive account",
        detail: `${label} has not logged in for ${Math.floor(inactiveDays)} days.`,
        userId: u.id,
        userLabel: label,
        actions: ["Suspend account", "Start offboarding review"],
      });
    }

    if (fails >= 3) {
      insights.push({
        type: "suspicious",
        severity: fails >= 5 ? "high" : "medium",
        title: "Repeated failed logins",
        detail: `${label} has ${fails} failed login attempts.`,
        userId: u.id,
        userLabel: label,
        actions: ["Review login history", "Force password reset", "Enable MFA"],
      });
    }

    if (isAdmin && !mfaOn) {
      insights.push({
        type: "mfa",
        severity: "high",
        title: "Admin without MFA",
        detail: `${label} has elevated access but MFA is not enforced.`,
        userId: u.id,
        userLabel: label,
        actions: ["Require MFA", "Notify security"],
      });
    }

    if (perms > 40) {
      insights.push({
        type: "permissions",
        severity: "medium",
        title: "Possible excessive permissions",
        detail: `${label} is linked to ~${perms} permission grants — review SoD.`,
        userId: u.id,
        userLabel: label,
        actions: ["Run access review", "Reduce role scope"],
      });
    }

    if (u.account_expires_at) {
      const daysLeft = (new Date(u.account_expires_at).getTime() - now) / day;
      if (daysLeft >= 0 && daysLeft <= 14) {
        insights.push({
          type: "expiry",
          severity: daysLeft <= 3 ? "high" : "medium",
          title: "Account expiring soon",
          detail: `${label} expires in ${Math.ceil(daysLeft)} day(s).`,
          userId: u.id,
          userLabel: label,
          actions: ["Extend access", "Convert to permanent", "Schedule offboard"],
        });
      }
    }

    if (
      u.user_type === "employee" &&
      !u.role_slug &&
      u.account_status === "pending_activation"
    ) {
      insights.push({
        type: "onboarding",
        severity: "info",
        title: "Incomplete onboarding",
        detail: `${label} pending activation without primary role.`,
        userId: u.id,
        userLabel: label,
        actions: ["Assign role", "Complete provision request"],
      });
    }
  }

  // Global recommendations
  const total = users.length || 1;
  const mfaCount = users.filter((u) => u.mfa_enabled || u.require_mfa || u.mfa_enforced).length;
  const mfaPct = Math.round((mfaCount / total) * 100);
  if (mfaPct < 50) {
    insights.push({
      type: "security",
      severity: "medium",
      title: "Low MFA adoption",
      detail: `Only ${mfaPct}% of users have MFA required/enabled.`,
      actions: ["Enforce MFA for finance", "Enforce MFA for admins", "Campaign enablement"],
    });
  }

  const locked = users.filter(
    (u) => u.account_status === "locked" || (u.failed_login_count || 0) >= 5
  ).length;
  if (locked > 0) {
    insights.push({
      type: "security",
      severity: "low",
      title: `${locked} locked / high-failure accounts`,
      detail: "Review for brute-force or credential stuffing.",
      actions: ["Open security dashboard", "Unlock after verification"],
    });
  }

  return insights.sort((a, b) => {
    const order = { high: 0, medium: 1, low: 2, info: 3 };
    return order[a.severity] - order[b.severity];
  });
}

export function recommendRole(params: {
  job_title?: string | null;
  department?: string | null;
  user_type?: string | null;
  availableRoles: Array<{ id: string; name: string; slug: string }>;
}): { roleId: string | null; reason: string } {
  const hay = `${params.job_title || ""} ${params.department || ""} ${params.user_type || ""}`.toLowerCase();
  const rules: Array<{ keys: string[]; slugHints: string[] }> = [
    { keys: ["finance", "accountant", "cashier"], slugHints: ["finance", "accountant"] },
    { keys: ["hr", "human", "people"], slugHints: ["hr"] },
    { keys: ["production", "operator", "machine"], slugHints: ["production"] },
    { keys: ["warehouse", "store", "inventory"], slugHints: ["warehouse", "inventory"] },
    { keys: ["sales", "commercial"], slugHints: ["sales"] },
    { keys: ["it", "admin", "system"], slugHints: ["admin", "super"] },
    { keys: ["audit"], slugHints: ["audit"] },
  ];

  for (const rule of rules) {
    if (!rule.keys.some((k) => hay.includes(k))) continue;
    const match = params.availableRoles.find((r) =>
      rule.slugHints.some((h) => r.slug.includes(h) || r.name.toLowerCase().includes(h))
    );
    if (match) {
      return {
        roleId: match.id,
        reason: `Matched ${params.department || params.job_title || "profile"} → ${match.name}`,
      };
    }
  }

  const employee = params.availableRoles.find((r) => r.slug.includes("employee") || r.slug === "user");
  return {
    roleId: employee?.id || params.availableRoles[0]?.id || null,
    reason: employee ? "Default employee role" : "First available role",
  };
}
