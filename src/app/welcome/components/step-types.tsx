/**
 * Shared props + UI primitives for the Welcome Experience wizard steps.
 */

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type {
  IndustryPack,
  ModuleRecommendation,
  TenantSummary,
  WelcomeIntegrationDef,
  WelcomeModuleDef,
  WelcomeState,
  WelcomeStepDef,
  WelcomeStepKey,
} from "@/lib/platform/welcome";

export type WelcomeData = {
  state: WelcomeState;
  summary: TenantSummary;
  industry_pack: IndustryPack;
  module_recommendations: ModuleRecommendation[];
  modules: WelcomeModuleDef[];
  integrations: WelcomeIntegrationDef[];
  plan?: { code?: string | null; name?: string | null } | null;
  progress?: number;
  steps: WelcomeStepDef[];
};

export type StepProps = {
  data: WelcomeData;
  saving: boolean;
  /** answers for the current step */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  value: Record<string, any>;
  /** selections for the current step */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  selection: Record<string, any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onPatchAnswers: (patch: Record<string, any>) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onPatchSelections: (patch: Record<string, any>) => void;
  onComplete: () => void;
  onNext: () => void;
  onBack: () => void;
  goTo: (key: WelcomeStepKey) => void;
  /** Register the step's validated submit handler (Continue button). */
  registerSubmit: (fn: () => void) => void;
  /** Mark current step completed and advance. */
  finishStep: () => void;
  /** Mark current step skipped and advance. */
  skipStep: () => void;
  /** Force a save now. */
  saveNow: () => Promise<void>;
};

export function StepHeader({
  title,
  description,
  badge,
  className,
}: {
  title: string;
  description: string;
  badge?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center gap-2 flex-wrap">
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">{title}</h1>
        {badge}
      </div>
      <p className="text-sm sm:text-base text-muted-foreground max-w-2xl">{description}</p>
    </div>
  );
}

export function SectionCard({
  title,
  description,
  children,
  className,
  right,
}: {
  title?: string;
  description?: string;
  children: ReactNode;
  className?: string;
  right?: ReactNode;
}) {
  return (
    <Card className={className}>
      {title ? (
        <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
          <div>
            <CardTitle className="text-base">{title}</CardTitle>
            {description ? (
              <p className="text-sm text-muted-foreground mt-1">{description}</p>
            ) : null}
          </div>
          {right}
        </CardHeader>
      ) : null}
      <CardContent>{children}</CardContent>
    </Card>
  );
}

export function Field({
  label,
  hint,
  error,
  required,
  children,
  className,
}: {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <label className="text-sm font-medium flex items-center gap-1">
        {label}
        {required ? <span className="text-destructive">*</span> : null}
      </label>
      {children}
      {hint && !error ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}

export function ToggleCard({
  title,
  description,
  checked,
  onChange,
  disabled,
  badge,
  className,
}: {
  title: string;
  description?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  badge?: ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "w-full text-left rounded-xl border p-4 transition-colors",
        checked
          ? "border-primary/60 bg-primary/5 ring-1 ring-primary/20"
          : "border-border hover:border-primary/40 hover:bg-muted/40",
        disabled && "opacity-50 cursor-not-allowed",
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold">{title}</span>
            {badge}
          </div>
          {description ? (
            <p className="text-xs text-muted-foreground mt-1">{description}</p>
          ) : null}
        </div>
        <span
          className={cn(
            "mt-0.5 h-5 w-9 shrink-0 rounded-full transition-colors",
            checked ? "bg-primary" : "bg-input"
          )}
        >
          <span
            className={cn(
              "block h-4 w-4 translate-x-0.5 rounded-full bg-background shadow transition-transform",
              checked && "translate-x-[18px]"
            )}
          />
        </span>
      </div>
    </button>
  );
}

export function EntityChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors",
        active
          ? "border-primary/60 bg-primary/10 text-primary-foreground"
          : "border-border hover:border-primary/40 hover:bg-muted/40"
      )}
    >
      <span
        className={cn(
          "h-2 w-2 rounded-full",
          active ? "bg-primary" : "bg-muted-foreground/40"
        )}
      />
      {label}
    </button>
  );
}

export function AddTagList({
  label,
  values,
  onChange,
  placeholder,
  className,
}: {
  label: string;
  values: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <div className={cn("space-y-2", className)}>
      <label className="text-sm font-medium">{label}</label>
      <div className="flex flex-wrap gap-2">
        {values.map((v, i) => (
          <Badge key={`${v}-${i}`} variant="secondary" className="gap-1 pl-2 pr-1 py-1">
            {v}
            <button
              type="button"
              aria-label={`Remove ${v}`}
              className="rounded-full px-1 hover:bg-destructive/10 hover:text-destructive"
              onClick={() => onChange(values.filter((_, j) => j !== i))}
            >
              ×
            </button>
          </Badge>
        ))}
      </div>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const input = e.currentTarget.elements.namedItem("add") as HTMLInputElement;
          const v = input?.value.trim();
          if (v && !values.includes(v)) onChange([...values, v]);
          if (input) input.value = "";
        }}
      >
        <input
          name="add"
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          placeholder={placeholder ?? `Add ${label.toLowerCase()}…`}
        />
        <button type="submit" className="rounded-md border px-3 text-sm font-medium hover:bg-muted/60">
          Add
        </button>
      </form>
    </div>
  );
}

export function StatChip({
  label,
  value,
  hint,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border p-4">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold mt-1">{value}</p>
      {hint ? <p className="text-xs text-muted-foreground mt-1">{hint}</p> : null}
    </div>
  );
}
