"use client";

import { useEffect, useMemo, useState } from "react";
import { Blocks, CheckCircle2, Lock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StepHeader, SectionCard, type StepProps } from "../step-types";
import { iconByName } from "../icon-map";
import { toast } from "sonner";

type ModuleToggle = boolean | { enabled?: boolean };

function moduleEnabled(v: ModuleToggle): boolean {
  return v === true || (v as { enabled?: boolean } | undefined)?.enabled === true;
}

const ENTITLEMENT_BADGE: Record<string, { label: string; variant: "default" | "secondary" | "outline" }> = {
  licensed: { label: "Licensed", variant: "default" },
  trial: { label: "Trial", variant: "secondary" },
  recommended: { label: "AI recommended", variant: "outline" },
};

export function ModulesStep({
  data,
  selection,
  onPatchSelections,
  registerSubmit,
  finishStep,
}: StepProps) {
  const sel = selection ?? {};
  const selected = (sel.modules ?? {}) as Record<string, ModuleToggle>;
  const [seeded, setSeeded] = useState(false);

  const recByCode = useMemo(
    () => new Map(data.module_recommendations.map((r) => [r.code, r])),
    [data.module_recommendations]
  );

  // Seed once: enable everything licensed/trial by default, leave platform
  // extras (recommended) off so the user consciously opts in.
  useEffect(() => {
    if (seeded || sel.modules !== undefined) return;
    const initial: Record<string, boolean> = {};
    for (const r of data.module_recommendations) {
      if (r.entitlement === "licensed" || r.entitlement === "trial") initial[r.code] = true;
    }
    onPatchSelections({ modules: initial });
    setSeeded(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seeded, data]);

  const toggle = (code: string) => {
    const next = { ...selected, [code]: !moduleEnabled(selected[code]) };
    onPatchSelections({ modules: next });
  };

  const enabledCount = Object.values(selected).filter(moduleEnabled).length;
  const coreCount = data.modules.filter((m) => m.core).length;

  const submit = () => {
    if (enabledCount < 3) {
      toast.error("Enable at least 3 modules before continuing");
      return;
    }
    finishStep();
  };

  useEffect(() => {
    registerSubmit(submit);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selection, data]);

  const categories = useMemo(() => {
    const map = new Map<string, typeof data.modules>();
    for (const m of data.modules) {
      const arr = map.get(m.category) ?? [];
      arr.push(m);
      map.set(m.category, arr);
    }
    return Array.from(map.entries());
  }, [data.modules]);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <StepHeader
        title="Business modules"
        description="AI has pre-selected the modules for your industry and plan. Toggle anything â€” your tenant is provisioned exactly to this selection."
        badge={
          <Badge variant="secondary" className="gap-1">
            <Blocks className="h-3 w-3" /> {enabledCount} enabled Â· {coreCount} core
          </Badge>
        }
      />

      <div className="flex items-start gap-2 rounded-xl border bg-muted/30 p-3 text-sm text-muted-foreground">
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
        <p>
          Enabled modules are provisioned into this tenant immediately. Disabled modules stay hidden from the
          navigation and API â€” and never share data with enabled ones.
        </p>
      </div>

      {categories.map(([category, modules]) => (
        <SectionCard key={category} title={category}>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {modules.map((m) => {
              const rec = recByCode.get(m.code);
              const Icon = iconByName(m.icon);
              const isOn = moduleEnabled(selected[m.code]);
              const isCore = m.core === true;
              const badge = rec ? ENTITLEMENT_BADGE[rec.entitlement] : undefined;
              return (
                <button
                  key={m.code}
                  type="button"
                  onClick={() => !isCore && toggle(m.code)}
                  className={[
                    "rounded-xl border p-4 text-left transition-colors",
                    isOn ? "border-primary/60 bg-primary/5 ring-1 ring-primary/20" : "border-border hover:border-primary/40 hover:bg-muted/40",
                    isCore ? "opacity-90 cursor-default" : "cursor-pointer",
                  ].join(" ")}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Icon className="h-[18px] w-[18px]" />
                    </div>
                    {isCore ? (
                      <Badge variant="outline" className="gap-1">
                        <Lock className="h-3 w-3" /> Core
                      </Badge>
                    ) : (
                      <span
                        className={[
                          "mt-0.5 h-5 w-9 shrink-0 rounded-full transition-colors",
                          isOn ? "bg-primary" : "bg-input",
                        ].join(" ")}
                      >
                        <span
                          className={[
                            "block h-4 w-4 translate-x-0.5 rounded-full bg-background shadow transition-transform",
                            isOn && "translate-x-[18px]",
                          ].join(" ")}
                        />
                      </span>
                    )}
                  </div>
                  <p className="mt-3 text-sm font-semibold">{m.name}</p>
                  <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{m.description}</p>
                  {rec ? (
                    <div className="mt-2 flex items-center gap-1.5">
                      <Badge variant={badge?.variant ?? "outline"}>{badge?.label}</Badge>
                      <span className="text-[11px] text-muted-foreground line-clamp-1">{rec.reason}</span>
                    </div>
                  ) : null}
                </button>
              );
            })}
          </div>
        </SectionCard>
      ))}

      <div className="flex justify-end">
        <Button onClick={submit}>Apply modules &amp; continue</Button>
      </div>
    </div>
  );
}