"use client";

import { useEffect, useMemo } from "react";
import { Plug, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StepHeader, SectionCard, type StepProps } from "../step-types";
import { iconByName } from "../icon-map";

const CATEGORY_LABELS: Record<string, string> = {
  communications: "Communications",
  payments: "Payments & mobile money",
  identity: "Identity",
  productivity: "Productivity",
  data: "Data & APIs",
  iot: "IoT & devices",
};

export function IntegrationsStep({
  data,
  selection,
  onPatchSelections,
  registerSubmit,
  finishStep,
}: StepProps) {
  const sel = selection ?? {};
  const selected: Record<string, boolean> = sel.integrations ?? {};

  useEffect(() => {
    registerSubmit(() => finishStep());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selection, data]);

  const toggle = (code: string) => {
    onPatchSelections({ integrations: { ...selected, [code]: !selected[code] } });
  };

  const categories = useMemo(() => {
    const map = new Map<string, typeof data.integrations>();
    for (const i of data.integrations) {
      const arr = map.get(i.category) ?? [];
      arr.push(i);
      map.set(i.category, arr);
    }
    return Array.from(map.entries());
  }, [data.integrations]);

  const enabledCount = Object.values(selected).filter(Boolean).length;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <StepHeader
        title="Integrations"
        description="Connect email, SMS, payments and productivity apps. Connections are per-tenant — credentials and data never cross organizations."
        badge={
          <Badge variant="secondary" className="gap-1">
            <Plug className="h-3 w-3" /> {enabledCount} connected
          </Badge>
        }
      />

      {categories.map(([category, integrations]) => (
        <SectionCard key={category} title={CATEGORY_LABELS[category] ?? category}>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {integrations.map((i) => {
              const Icon = iconByName(i.icon);
              const isOn = selected[i.code] === true;
              return (
                <button
                  key={i.code}
                  type="button"
                  onClick={() => toggle(i.code)}
                  className={[
                    "rounded-xl border p-4 text-left transition-colors",
                    isOn ? "border-primary/60 bg-primary/5 ring-1 ring-primary/20" : "border-border hover:border-primary/40 hover:bg-muted/40",
                  ].join(" ")}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Icon className="h-[18px] w-[18px]" />
                    </div>
                    {isOn ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : null}
                  </div>
                  <p className="mt-3 text-sm font-semibold">{i.name}</p>
                  <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{i.description}</p>
                </button>
              );
            })}
          </div>
        </SectionCard>
      ))}

      <div className="flex justify-end">
        <Button onClick={() => finishStep()}>Continue to AI Configuration</Button>
      </div>
    </div>
  );
}