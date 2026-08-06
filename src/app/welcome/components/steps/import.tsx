"use client";

import { useEffect } from "react";
import { Upload, Database, FileSpreadsheet } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StepHeader, SectionCard, ToggleCard, EntityChip, type StepProps } from "../step-types";
import { IMPORT_ENTITIES, IMPORT_SOURCES } from "@/lib/platform/welcome";
import { toast } from "sonner";

export function ImportStep({
  data,
  value,
  selection,
  onPatchAnswers,
  onPatchSelections,
  registerSubmit,
  finishStep,
  goTo,
}: StepProps) {
  const v = value ?? {};
  const sel = selection ?? {};
  const set = (key: string, val: unknown) => onPatchAnswers({ [key]: val });

  const toggleEntity = (entity: string) => {
    const current: string[] = sel.entities ?? [];
    onPatchSelections({
      entities: current.includes(entity) ? current.filter((e) => e !== entity) : [...current, entity],
    });
  };

  const toggleSource = (source: string) => {
    const current: string[] = sel.sources ?? [];
    onPatchSelections({
      sources: current.includes(source) ? current.filter((s) => s !== source) : [...current, source],
    });
  };

  const submit = () => {
    if (v.have_data === true && (sel.entities?.length ?? 0) === 0) {
      toast.error("Select at least one entity to import (or choose 'No existing data')");
      return;
    }
    finishStep();
  };

  useEffect(() => {
    registerSubmit(submit);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, selection, data]);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <StepHeader
        title="Data import"
        description="Bring in your existing master data and opening balances. Templates are generated for your selections."
        badge={
          <Badge variant="secondary" className="gap-1">
            <Upload className="h-3 w-3" /> Import Center ready
          </Badge>
        }
      />

      <SectionCard title="Do you have existing data?">
        <div className="space-y-3">
          <ToggleCard
            title="Yes — import my existing data"
            description="Customers, suppliers, products, accounts, balances and more."
            checked={v.have_data === true}
            onChange={(val) => set("have_data", val)}
          />
          <ToggleCard
            title="No — start fresh"
            description="Skip the import for now. You can import any time from Settings → Setup."
            checked={v.have_data === false}
            onChange={(val) => set("have_data", val ? false : undefined)}
          />
        </div>
      </SectionCard>

      {v.have_data !== false ? (
        <>
          <SectionCard title="What would you like to import?">
            <div className="flex flex-wrap gap-2">
              {IMPORT_ENTITIES.map((e) => (
                <EntityChip
                  key={e}
                  label={e}
                  active={(sel.entities ?? []).includes(e)}
                  onClick={() => toggleEntity(e)}
                />
              ))}
            </div>
            {(sel.entities?.length ?? 0) > 0 ? (
              <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                <FileSpreadsheet className="h-4 w-4" /> Templates ready for {sel.entities.length} entit
                {(sel.entities?.length ?? 0) === 1 ? "y" : "ies"}.
              </p>
            ) : null}
          </SectionCard>

          <SectionCard title="Source system">
            <div className="flex flex-wrap gap-2">
              {IMPORT_SOURCES.map((s) => (
                <EntityChip key={s} label={s} active={(sel.sources ?? []).includes(s)} onClick={() => toggleSource(s)} />
              ))}
            </div>
          </SectionCard>
        </>
      ) : null}

      <div className="flex items-start gap-2 rounded-xl border bg-muted/30 p-3 text-sm text-muted-foreground">
        <Database className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          Imports run tenant-isolated: your files, mappings and results can never be seen by another organization.
        </p>
      </div>

      <div className="flex justify-end">
        <Button onClick={submit}>Continue to Integrations</Button>
      </div>
    </div>
  );
}