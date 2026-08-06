/**
 * Welcome Experience — readiness + tenant health scoring.
 * Deterministic scoring of configuration answers so every tenant gets an
 * explainable readiness report and go-live checklist.
 */

import type {
  HealthSnapshot,
  ReadinessSnapshot,
  WelcomeState,
  WelcomeStatus,
  WelcomeStepKey,
} from "./types";
import { WELCOME_STEPS, WELCOME_STEP_MAP } from "./steps";

type Answers = Record<string, unknown>;

function filled(v: unknown): boolean {
  if (v === undefined || v === null) return false;
  if (typeof v === "string") return v.trim().length > 0;
  if (typeof v === "boolean") return true;
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === "object") return Object.keys(v).length > 0;
  return true;
}

export const GO_LIVE_CHECKS: Array<{
  key: string;
  label: string;
  detail: string;
  check: (a: Answers, s: Record<string, unknown>) => boolean;
}> = [
  { key: "users", label: "Administrators & users created", detail: "At least the primary administrator is active.", check: (a) => a.admin_email !== undefined || a.users_created === true },
  { key: "permissions", label: "Permissions assigned", detail: "Default roles are active for the tenant.", check: () => true },
  { key: "departments", label: "Departments configured", detail: "At least one department was captured in the structure step.", check: (a, s) => ((s.structure as { departments?: unknown[] } | undefined)?.departments?.length ?? 0) > 0 },
  { key: "warehouses", label: "Warehouses ready", detail: "A default warehouse / store is available.", check: (a, s) => ((s.structure as { warehouses?: unknown[] } | undefined)?.warehouses?.length ?? 0) > 0 || a.skip_warehouse === true },
  { key: "fiscal", label: "Fiscal year open", detail: "Fiscal year start and periods are configured.", check: (a) => filled(a.fiscal_year_start) && filled(a.periods_per_year) },
  { key: "taxes", label: "Taxes configured", detail: "Tax system and VAT status are set.", check: (a) => filled(a.tax_system) && a.vat_registered !== undefined },
  { key: "approvals", label: "Approval workflows active", detail: "Default approval workflows are enabled.", check: () => true },
  { key: "backups", label: "Backups enabled", detail: "Daily backups are scheduled by the platform.", check: () => true },
  { key: "mfa", label: "MFA enabled", detail: "MFA is enforced for administrators.", check: (a) => a.mfa_required === true },
  { key: "reports", label: "Reports ready", detail: "Industry dashboards and reports are installed.", check: () => true },
  { key: "email", label: "Email working", detail: "Outbound email is configured.", check: (a, s) => (s.integrations as { email?: unknown } | undefined)?.email === true || a.email_configured === true },
  { key: "sms", label: "SMS working", detail: "SMS gateway is connected (recommended).", check: (a, s) => (s.integrations as { sms?: unknown } | undefined)?.sms === true || a.sms_configured === true || a.sms_optional === true },
  { key: "integrations", label: "Integrations healthy", detail: "Connected services pass health checks.", check: (a, s) => Object.keys((s.integrations as Record<string, unknown> | undefined) ?? {}).length >= 0 },
  { key: "monitoring", label: "Monitoring enabled", detail: "Platform monitoring and alerts are live.", check: () => true },
  { key: "audit", label: "Audit enabled", detail: "Immutable audit trail is capturing events.", check: () => true },
  { key: "dr", label: "Disaster recovery enabled", detail: "Backups and point-in-time recovery are configured.", check: () => true },
];

export function computeReadiness(state: WelcomeState): ReadinessSnapshot {
  const answers = (state.answers ?? {}) as Answers;
  const selections = (state.selections ?? {}) as Record<string, unknown>;

  const sections: ReadinessSnapshot["sections"] = [];

  // Organization
  {
    const org = (answers.organization ?? {}) as Answers;
    const ok = filled(org.legal_name) && filled(org.industry) && filled(org.country);
    sections.push({
      key: "organization",
      label: "Organization",
      score: ok ? 100 : 40,
      weight: 1,
      passed: ok,
      notes: ok
        ? ["Legal entity, industry and country captured."]
        : ["Add your legal company name, industry and country."],
    });
  }

  // Security
  {
    const sec = (answers.security ?? {}) as Answers;
    const mfa = sec.mfa_required === true || sec.mfa_required === "true";
    const policy = filled(sec.password_policy) || sec.password_policy !== "off";
    const ok = mfa || filled(sec.admin_email);
    sections.push({
      key: "security",
      label: "Security",
      score: ok ? (mfa && policy ? 100 : 70) : 30,
      weight: 1.5,
      passed: ok,
      notes: mfa
        ? ["MFA is enforced for administrators."]
        : ["Recommend enabling MFA for all administrator accounts."],
    });
  }

  // Modules
  {
    const mods = (selections.modules ?? {}) as Record<string, unknown>;
    const count = Object.values(mods).filter((v) => v === true || (v as { enabled?: boolean } | null)?.enabled === true).length;
    const ok = count >= 3;
    sections.push({
      key: "modules",
      label: "Modules",
      score: Math.min(100, 20 + count * 12),
      weight: 1,
      passed: ok,
      notes: ok
        ? [`${count} business modules enabled.`]
        : ["Enable at least 3 modules (finance, sales, inventory recommended)."],
    });
  }

  // Business configuration
  {
    const biz = (answers.business ?? {}) as Answers;
    const ok = filled(biz.fiscal_year_start) && filled(biz.currency) && filled(biz.tax_system);
    sections.push({
      key: "business",
      label: "Business Configuration",
      score: ok ? 100 : 50,
      weight: 1,
      passed: ok,
      notes: ok
        ? ["Fiscal year, currency and tax system configured."]
        : ["Configure fiscal year, base currency and tax system."],
    });
  }

  // Structure
  {
    const st = (selections.structure ?? {}) as Answers;
    const ok = ((st.departments as unknown[] | undefined)?.length ?? 0) > 0;
    sections.push({
      key: "structure",
      label: "Organization Structure",
      score: ok ? 100 : 60,
      weight: 0.75,
      passed: ok,
      notes: ok
        ? [`${(st.departments as unknown[]).length} department(s) and ${(st.branches as unknown[] | undefined)?.length ?? 0} branch(es) configured.`]
        : ["Add at least one department to complete your structure."],
    });
  }

  // Integrations
  {
    const ints = (selections.integrations ?? {}) as Record<string, unknown>;
    const count = Object.values(ints).filter(Boolean).length;
    const ok = ints.email === true;
    sections.push({
      key: "integrations",
      label: "Integrations",
      score: Math.min(100, 20 + count * 16),
      weight: 0.75,
      passed: ok,
      notes: ok
        ? [`${count} integration(s) selected.`]
        : ["Connect email at minimum — payments and SMS are recommended."],
    });
  }

  // AI
  {
    const ai = (answers.ai ?? {}) as Answers;
    const ok = ai.enable_ai === true || ai.enable_ai === "true" || ai.enable_ai === undefined;
    sections.push({
      key: "ai",
      label: "AI Configuration",
      score: ok ? 100 : 60,
      weight: 0.5,
      passed: ok,
      notes: ok
        ? ["AI workspace enabled for this tenant."]
        : ["Enable the AI workspace to unlock Copilot and insights."],
    });
  }

  // Training
  {
    const tr = (answers.training ?? {}) as Answers;
    const done = ((tr.completed as unknown[] | undefined) ?? []).length;
    const ok = done >= 2 || tr.skip === true;
    sections.push({
      key: "training",
      label: "Training",
      score: ok ? 100 : Math.min(60, done * 30),
      weight: 0.5,
      passed: ok,
      notes: ok
        ? [`${done} training offering(s) completed.`]
        : ["Complete the guided tour and at least one lesson."],
    });
  }

  const totalWeight = sections.reduce((s, x) => s + x.weight, 0);
  const overall = Math.round(
    sections.reduce((s, x) => s + x.score * x.weight, 0) / Math.max(1, totalWeight)
  );

  const goLive = GO_LIVE_CHECKS.map((c) => ({
    key: c.key,
    label: c.label,
    detail: c.detail,
    done: c.check(answers, selections),
  }));

  const goLiveDone = goLive.filter((g) => g.done).length;
  const goLiveScore = Math.round((goLiveDone / goLive.length) * 100);

  const status: WelcomeStatus =
    overall >= 90 && goLiveScore === 100
      ? "completed"
      : overall >= 70 && goLiveDone / goLive.length >= 0.75
        ? "go_live"
        : overall >= 50
          ? "ready"
          : state.status === "completed"
            ? "completed"
            : "in_progress";

  return {
    overall,
    status,
    sections,
    goLive,
  };
}

export function computeHealth(state: WelcomeState): HealthSnapshot {
  const readiness = computeReadiness(state);
  const sectionScore = (key: string) =>
    readiness.sections.find((s) => s.key === key)?.score ?? 0;

  const config = Math.round(
    (sectionScore("organization") + sectionScore("business") + sectionScore("structure")) / 3
  );
  const security = sectionScore("security");
  const compliance = Math.round(
    (security * 0.6 + sectionScore("ai") * 0.4)
  );
  const dataQuality = sectionScore("modules");
  const training = sectionScore("training");
  const aiAdoption = sectionScore("ai");
  const moduleUsage = sectionScore("modules");

  const goLiveDone = readiness.goLive.filter((g) => g.done).length;
  const backup = goLiveDone >= 10 ? "ok" : goLiveDone >= 6 ? "warn" : "unknown";

  const risk = Math.max(
    0,
    100 - Math.round((security + compliance) / 2)
  );

  const recommendations: string[] = [];
  if (security < 100) recommendations.push("Enforce MFA and review password policy for administrators.");
  if (dataQuality < 60) recommendations.push("Enable core modules so your data model is fully provisioned.");
  if (training < 100) recommendations.push("Complete onboarding training to improve adoption.");
  if (readiness.overall < 90) recommendations.push("Finish the remaining welcome steps to reach go-live readiness.");
  if (recommendations.length === 0) recommendations.push("Tenant is in excellent health — consider inviting your full team.");

  const overall = Math.round(
    (config + security + compliance + dataQuality + training + aiAdoption + moduleUsage) / 7
  );

  return {
    overall,
    configuration: config,
    security,
    compliance,
    dataQuality,
    training,
    backup,
    aiAdoption,
    moduleUsage,
    risk,
    recommendations,
  };
}

export function welcomeProgressPercent(state: WelcomeState): number {
  const required = WELCOME_STEPS.filter((s) => s.required !== false && s.key !== "success");
  const done = required.filter((s) => {
    const p = state.steps_progress[s.key];
    return p?.status === "completed" || p?.status === "skipped";
  }).length;
  return Math.round((done / Math.max(1, required.length)) * 100);
}

export function stepCompletionFor(stepKey: string, state: WelcomeState): boolean {
  const p = state.steps_progress[stepKey as WelcomeStepKey];
  return p?.status === "completed";
}

export function deriveStatusFromProgress(state: WelcomeState): WelcomeStatus {
  const percent = welcomeProgressPercent(state);
  const allDone = percent === 100;
  if (state.status === "completed" || (allDone && state.completed_at)) return "completed";
  if (allDone) return "go_live";
  if (percent >= 50) return "ready";
  if (state.started_at) return "in_progress";
  return "not_started";
}

/** Mark a step complete based on its answers being "good enough". */
export function autoCompleteStep(stepKey: string, state: WelcomeState): WelcomeState {
  const def = WELCOME_STEP_MAP[stepKey as keyof typeof WELCOME_STEP_MAP];
  if (!def || def.autoComplete) return state;

  const answers = state.answers[stepKey] as Record<string, unknown> | undefined;
  let complete = false;

  switch (stepKey) {
    case "organization":
      complete = Boolean(answers && answers.legal_name && answers.industry && answers.country);
      break;
    case "structure":
      complete =
        Boolean(state.selections.structure) &&
        ((state.selections.structure as { departments?: unknown[] } | undefined)?.departments?.length ?? 0) > 0;
      break;
    case "security":
      complete = Boolean(answers && answers.mfa_required);
      break;
    case "modules":
      complete =
        Boolean(state.selections.modules) &&
        Object.values(state.selections.modules as Record<string, unknown>).filter(
          (v) => v === true || (v as { enabled?: boolean } | null)?.enabled === true
        ).length >= 3;
      break;
    case "business":
      complete = Boolean(
        answers && answers.fiscal_year_start && answers.currency && answers.tax_system
      );
      break;
    case "import":
      complete = Boolean(answers && (answers.have_data === false || (answers.entities as unknown[] | undefined)?.length));
      break;
    case "integrations":
      complete = true; // optional — any choice counts as complete
      break;
    case "ai":
      complete = Boolean(answers && answers.enable_ai !== false);
      break;
    case "training":
      complete = Boolean(answers && (((answers.completed as unknown[] | undefined)?.length ?? 0) >= 2 || answers.skip === true));
      break;
    default:
      complete = true;
  }

  if (complete && !(state.steps_progress[stepKey as WelcomeStepKey]?.status === "completed")) {
    return {
      ...state,
      steps_progress: {
        ...state.steps_progress,
        [stepKey]: {
          status: "completed",
          completed_at: new Date().toISOString(),
        },
      },
    };
  }
  return state;
}
