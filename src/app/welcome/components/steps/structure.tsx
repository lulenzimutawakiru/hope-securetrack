"use client";

import { useEffect, useState } from "react";
import { Network, Building2, Landmark, Warehouse, Boxes, Layers } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StepHeader, SectionCard, Field, AddTagList, type StepProps } from "../step-types";
import { toast } from "sonner";

const STRUCTURE_SUGGESTIONS: Record<string, string[]> = {
  departments: ["Administration", "Finance", "Sales", "Operations", "IT", "HR"],
  branches: ["Head Office"],
  business_units: ["Core Business"],
  cost_centers: ["General & Admin"],
  warehouses: ["Main Store"],
};

export function StructureStep({
  data,
  value,
  selection,
  onPatchAnswers,
  onPatchSelections,
  registerSubmit,
  finishStep,
}: StepProps) {
  const v = value ?? {};
  const sel = selection ?? {};
  const [errors, setErrors] = useState<Record<string, string>>({});

  const set = (key: string, val: unknown) => onPatchAnswers({ [key]: val });
  const setSel = (key: string, val: string[]) => onPatchSelections({ [key]: val });

  const lists = [
    { key: "branches", label: "Branches", icon: Building2, hint: "Physical or operational locations." },
    { key: "departments", label: "Departments", icon: Layers, hint: "Required before go-live." },
    { key: "business_units", label: "Business units", icon: Boxes, hint: "Divisions with a separate P&L (optional)." },
    { key: "cost_centers", label: "Cost centers", icon: Landmark, hint: "Used for budgeting and allocation." },
    { key: "warehouses", label: "Warehouses / stores", icon: Warehouse, hint: "Stock locations for inventory." },
  ];

  const submit = () => {
    const errs: Record<string, string> = {};
    if (!v.company_name?.trim()) errs.company_name = "Company name is required";
    if ((sel.departments?.length ?? 0) === 0) errs.departments = "Add at least one department";
    setErrors(errs);
    if (Object.keys(errs).length > 0) {
      toast.error("Complete the required structure fields");
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
        title="Organization structure"
        description="Define your company hierarchy. Every record in SecureTrack is scoped to your company, branch and department — this powers multi-company and multi-branch isolation."
        badge={
          <Badge variant="secondary" className="gap-1">
            <Network className="h-3 w-3" /> Multi-company ready
          </Badge>
        }
      />

      <SectionCard title="Company" description="The legal operating entity for this tenant.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Company name" required error={errors.company_name}>
            <Input
              value={v.company_name ?? data.summary.organization_name ?? ""}
              onChange={(e) => set("company_name", e.target.value)}
              placeholder="Acme Manufacturing Ltd"
            />
          </Field>
          <Field label="Structure type">
            <Select value={v.structure_type ?? "single_company"} onValueChange={(val) => set("structure_type", val)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="single_company">Single company</SelectItem>
                <SelectItem value="holding">Holding company</SelectItem>
                <SelectItem value="group">Multi-company group</SelectItem>
                <SelectItem value="franchise">Franchise network</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Subsidiaries / companies">
            <Input
              value={(v.subsidiaries ?? []).join(", ")}
              onChange={(e) =>
                set(
                  "subsidiaries",
                  e.target.value.split(",").map((s: string) => s.trim()).filter(Boolean)
                )
              }
              placeholder="Subsidiary A, Subsidiary B…"
            />
          </Field>
        </div>
      </SectionCard>

      {lists.map((l) => (
        <SectionCard key={l.key} title={l.label} description={l.hint}>
          <AddTagList
            label={`${l.label} — add or remove`}
            values={sel[l.key] ?? []}
            onChange={(next) => setSel(l.key, next)}
            placeholder={`Add ${l.label.toLowerCase().replace(/s$/, "")}…`}
          />
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="text-xs text-muted-foreground self-center">Quick add:</span>
            {(STRUCTURE_SUGGESTIONS[l.key] ?? [])
              .filter((s) => !(sel[l.key] ?? []).includes(s))
              .map((s) => (
                <button
                  key={s}
                  type="button"
                  className="rounded-full border px-2.5 py-1 text-xs hover:bg-muted/50"
                  onClick={() => setSel(l.key, [...(sel[l.key] ?? []), s])}
                >
                  + {s}
                </button>
              ))}
          </div>
          {l.key === "departments" && errors.departments ? (
            <p className="mt-2 text-xs text-destructive">{errors.departments}</p>
          ) : null}
        </SectionCard>
      ))}

      <div className="flex justify-end">
        <Button onClick={submit}>Continue to Security</Button>
      </div>
    </div>
  );
}