"use client";

import { useEffect } from "react";
import { BrainCircuit, ShieldCheck, Lock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StepHeader, SectionCard, ToggleCard, EntityChip, type StepProps } from "../step-types";

const AI_AGENTS = [
  "Executive AI",
  "Finance AI",
  "Procurement AI",
  "Inventory AI",
  "Manufacturing AI",
  "Asset AI",
  "Fleet AI",
  "HR AI",
  "Payroll AI",
  "CRM AI",
  "Project AI",
  "Service Desk AI",
  "Compliance AI",
  "Risk AI",
];

export function AiStep({
  value,
  selection,
  onPatchAnswers,
  onPatchSelections,
  registerSubmit,
  finishStep,
}: StepProps) {
  const v = value ?? {};
  const sel = selection ?? {};
  const set = (key: string, val: unknown) => onPatchAnswers({ [key]: val });

  const toggleAgent = (agent: string) => {
    const current: string[] = sel.agents ?? [];
    onPatchSelections({
      agents: current.includes(agent) ? current.filter((a) => a !== agent) : [...current, agent],
    });
  };

  const submit = () => finishStep();

  useEffect(() => {
    registerSubmit(submit);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, selection]);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <StepHeader
        title="AI configuration"
        description="Provision your tenant AI workspace: specialized agents, knowledge base and guardrails — all scoped to your tenant only."
        badge={
          <Badge variant="secondary" className="gap-1">
            <BrainCircuit className="h-3 w-3" /> {v.enable_ai === false ? "Disabled" : "AI ready"}
          </Badge>
        }
      />

      <SectionCard title="AI platform">
        <ToggleCard
          title="Enable SecureTrack AI"
          description="AI copilot, anomaly detection, insights and predictive recommendations across modules."
          checked={v.enable_ai !== false}
          onChange={(val) => set("enable_ai", val)}
        />
      </SectionCard>

      {v.enable_ai !== false ? (
        <>
          <SectionCard title="AI agents" description="Specialized assistants for your teams — each respects RBAC/ABAC and tenant isolation.">
            <div className="flex flex-wrap gap-2">
              {AI_AGENTS.map((a) => (
                <EntityChip key={a} label={a} active={(sel.agents ?? []).includes(a)} onClick={() => toggleAgent(a)} />
              ))}
            </div>
          </SectionCard>

          <SectionCard title="Guardrails">
            <div className="space-y-3">
              <ToggleCard
                title="Require approval before AI writes data"
                description="AI recommendations never modify records without workflow approval."
                checked={v.require_approval !== false}
                onChange={(val) => set("require_approval", val)}
                badge={<Badge variant="outline"><Lock className="h-3 w-3 mr-1" /> Mandatory</Badge>}
              />
              <ToggleCard
                title="Explainable recommendations"
                description="Every AI output includes reasoning you can audit."
                checked={v.explainable !== false}
                onChange={(val) => set("explainable", val)}
              />
              <ToggleCard
                title="Tenant-isolated AI memory"
                description="The knowledge base and conversation memory are exclusive to this organization."
                checked={v.isolated_memory !== false}
                onChange={(val) => set("isolated_memory", val)}
              />
            </div>
          </SectionCard>

          <div className="flex items-start gap-2 rounded-xl border bg-muted/30 p-3 text-sm text-muted-foreground">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              AI context is created per tenant: embeddings, prompts and memory are never shared, searched, or trained
              across organizations.
            </p>
          </div>
        </>
      ) : null}

      <div className="flex justify-end">
        <Button onClick={submit}>Continue to Training</Button>
      </div>
    </div>
  );
}