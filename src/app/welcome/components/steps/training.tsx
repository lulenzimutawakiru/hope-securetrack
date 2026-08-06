"use client";

import { useEffect } from "react";
import { GraduationCap, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StepHeader, SectionCard, ToggleCard, EntityChip, type StepProps } from "../step-types";
import { TRAINING_OFFERINGS, TRAINING_AUDIENCES } from "@/lib/platform/welcome";
import { toast } from "sonner";

export function TrainingStep({
  value,
  selection,
  onPatchAnswers,
  onPatchSelections,
  registerSubmit,
  finishStep,
  skipStep,
}: StepProps) {
  const v = value ?? {};
  const sel = selection ?? {};
  const set = (key: string, val: unknown) => onPatchAnswers({ [key]: val });

  const toggleOffering = (key: string) => {
    const current: string[] = sel.offerings ?? [];
    onPatchSelections({
      offerings: current.includes(key) ? current.filter((o) => o !== key) : [...current, key],
    });
  };

  const toggleAudience = (a: string) => {
    const current: string[] = sel.audiences ?? [];
    onPatchSelections({
      audiences: current.includes(a) ? current.filter((x) => x !== a) : [...current, a],
    });
  };

  const submit = () => {
    const count = (sel.offerings?.length ?? 0);
    if (count < 2 && v.skip !== true) {
      toast.warning("Pick at least 2 training offerings, or skip — training can continue after go-live.");
      return;
    }
    finishStep();
  };

  useEffect(() => {
    registerSubmit(submit);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, selection]);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <StepHeader
        title="Training"
        description="Get your team ready with guided tours, lessons and the knowledge base. Training continues after go-live."
        badge={
          <Badge variant="secondary" className="gap-1">
            <GraduationCap className="h-3 w-3" /> {(sel.offerings?.length ?? 0)} selected
          </Badge>
        }
      />

      <SectionCard title="Choose your learning path">
        <div className="grid gap-3 sm:grid-cols-2">
          {TRAINING_OFFERINGS.map((o) => (
            <ToggleCard
              key={o.key}
              title={o.label}
              description={o.description}
              checked={(sel.offerings ?? []).includes(o.key)}
              onChange={() => toggleOffering(o.key)}
            />
          ))}
        </div>
      </SectionCard>

      <SectionCard title="Who needs training?">
        <div className="flex flex-wrap gap-2">
          {TRAINING_AUDIENCES.map((a) => (
            <EntityChip key={a} label={a} active={(sel.audiences ?? []).includes(a)} onClick={() => toggleAudience(a)} />
          ))}
        </div>
      </SectionCard>

      <ToggleCard
        title="Skip training for now"
        description="You can complete training later from the dashboard."
        checked={v.skip === true}
        onChange={(val) => set("skip", val ? true : undefined)}
      />

      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={skipStep}>
          Skip this step
        </Button>
        <Button onClick={submit}>
          <CheckCircle2 className="h-4 w-4 mr-2" /> Continue to Readiness
        </Button>
      </div>
    </div>
  );
}