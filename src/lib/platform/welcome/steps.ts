/**
 * Canonical Welcome Experience step catalog.
 * Drives the wizard rail, readiness scoring, and deep links.
 */

import type { WelcomeStepDef, WelcomeStepKey } from "./types";

export const WELCOME_STEPS: WelcomeStepDef[] = [
  {
    key: "welcome",
    label: "Welcome",
    shortLabel: "Welcome",
    description: "Meet your AI assistant and start the guided setup.",
    icon: "Sparkles",
    group: "foundation",
    required: false,
    autoComplete: true,
  },
  {
    key: "organization",
    label: "Organization",
    shortLabel: "Org verification",
    description: "Verify your legal entity, industry, branding and locale.",
    icon: "Building2",
    group: "foundation",
    href: "/dashboard/settings/company",
    required: true,
  },
  {
    key: "subscription",
    label: "Subscription",
    shortLabel: "Plan & billing",
    description: "Review your plan, limits and upgrade recommendations.",
    icon: "CreditCard",
    group: "foundation",
    href: "/dashboard/billing",
    required: false,
    autoComplete: true,
  },
  {
    key: "structure",
    label: "Organization Structure",
    shortLabel: "Structure",
    description: "Configure companies, branches, departments and warehouses.",
    icon: "Network",
    group: "foundation",
    href: "/dashboard/settings/branches",
    required: true,
  },
  {
    key: "security",
    label: "Security",
    shortLabel: "Security",
    description: "Set up administrators, MFA, SSO and security policies.",
    icon: "ShieldCheck",
    group: "foundation",
    href: "/dashboard/settings/security",
    required: true,
  },
  {
    key: "modules",
    label: "Business Modules",
    shortLabel: "Modules",
    description: "Enable the modules that power your business processes.",
    icon: "Blocks",
    group: "configure",
    href: "/dashboard/settings/modules",
    required: true,
  },
  {
    key: "business",
    label: "Business Configuration",
    shortLabel: "Business config",
    description: "Fiscal year, taxes, currencies, numbering and calendars.",
    icon: "Settings2",
    group: "configure",
    href: "/dashboard/settings/localization",
    required: true,
  },
  {
    key: "import",
    label: "Data Import",
    shortLabel: "Import data",
    description: "Bring in customers, suppliers, products and opening balances.",
    icon: "Upload",
    group: "configure",
    href: "/dashboard/settings/setup",
    required: false,
  },
  {
    key: "integrations",
    label: "Integrations",
    shortLabel: "Integrations",
    description: "Connect email, payments, mobile money and productivity apps.",
    icon: "Plug",
    group: "configure",
    href: "/dashboard/integrations",
    required: false,
  },
  {
    key: "ai",
    label: "AI Configuration",
    shortLabel: "AI",
    description: "Provision your tenant AI workspace, agents and guardrails.",
    icon: "BrainCircuit",
    group: "configure",
    href: "/dashboard/settings/ai",
    required: false,
  },
  {
    key: "training",
    label: "Training",
    shortLabel: "Training",
    description: "Learn the platform through tours, lessons and the knowledge base.",
    icon: "GraduationCap",
    group: "activate",
    href: "/dashboard/settings/setup",
    required: false,
  },
  {
    key: "readiness",
    label: "Readiness",
    shortLabel: "Readiness",
    description: "AI scores your configuration and flags gaps before go-live.",
    icon: "Gauge",
    group: "activate",
    required: true,
  },
  {
    key: "go_live",
    label: "Go Live",
    shortLabel: "Go live",
    description: "Confirm the final checklist and activate your environment.",
    icon: "Rocket",
    group: "activate",
    href: "/dashboard",
    required: true,
  },
  {
    key: "success",
    label: "Success",
    shortLabel: "Success",
    description: "Launch dashboard, invite users and explore quick actions.",
    icon: "PartyPopper",
    group: "activate",
    href: "/dashboard",
    required: false,
    autoComplete: true,
  },
];

export const WELCOME_STEP_MAP: Record<WelcomeStepKey, WelcomeStepDef> =
  Object.fromEntries(WELCOME_STEPS.map((s) => [s.key, s])) as Record<
    WelcomeStepKey,
    WelcomeStepDef
  >;

export const WELCOME_STEP_KEYS: WelcomeStepKey[] = WELCOME_STEPS.map((s) => s.key);

export const WELCOME_GROUPS: Array<{
  key: string;
  label: string;
  steps: WelcomeStepDef[];
}> = [
  {
    key: "foundation",
    label: "Foundation",
    steps: WELCOME_STEPS.filter((s) => s.group === "foundation"),
  },
  {
    key: "configure",
    label: "Configure",
    steps: WELCOME_STEPS.filter((s) => s.group === "configure"),
  },
  {
    key: "activate",
    label: "Activate",
    steps: WELCOME_STEPS.filter((s) => s.group === "activate"),
  },
];

export function stepIndex(key: WelcomeStepKey): number {
  return Math.max(0, WELCOME_STEP_KEYS.indexOf(key));
}

export function nextStepKey(key: WelcomeStepKey): WelcomeStepKey {
  const i = stepIndex(key);
  return WELCOME_STEP_KEYS[Math.min(WELCOME_STEP_KEYS.length - 1, i + 1)];
}

export function prevStepKey(key: WelcomeStepKey): WelcomeStepKey {
  const i = stepIndex(key);
  return WELCOME_STEP_KEYS[Math.max(0, i - 1)];
}

export function defaultStepProgress(): Record<string, { status: string; completed_at?: string }> {
  return Object.fromEntries(
    WELCOME_STEPS.map((s) => [
      s.key,
      { status: s.autoComplete ? "completed" : "pending" },
    ])
  );
}
