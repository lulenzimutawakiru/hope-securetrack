"use client";

import { useEffect } from "react";
import { Settings2 } from "lucide-react";
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
import { StepHeader, SectionCard, Field, ToggleCard, type StepProps } from "../step-types";
import { toast } from "sonner";

const NUMBERING_RULES = [
  { key: "customer_numbering", label: "Customer numbering" },
  { key: "supplier_numbering", label: "Supplier numbering" },
  { key: "invoice_numbering", label: "Invoice numbering" },
  { key: "po_numbering", label: "Purchase order numbering" },
  { key: "receipt_numbering", label: "Receipt numbering" },
  { key: "asset_numbering", label: "Asset numbering" },
];

const CALENDARS = [
  { key: "holiday_calendar", label: "Holiday calendar" },
  { key: "working_hours", label: "Working hours" },
  { key: "leave_calendar", label: "Leave calendar" },
  { key: "payroll_calendar", label: "Payroll calendar" },
];

export function BusinessStep({
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
  const set = (key: string, val: unknown) => onPatchAnswers({ [key]: val });

  const submit = () => {
    if (!v.fiscal_year_start) {
      toast.error("Select your fiscal year start");
      return;
    }
    if (!v.tax_system) {
      toast.error("Select your tax system");
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
        title="Business configuration"
        description="Your industry pack pre-configured fiscal, tax, numbering and calendar rules. Review and adjust â€” everything is tenant-specific."
        badge={
          <Badge variant="secondary" className="gap-1">
            <Settings2 className="h-3 w-3" /> {data.summary.country_code ?? "Localized"} defaults
          </Badge>
        }
      />

      <SectionCard title="Fiscal year" description="Defines accounting periods and closing cycles.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Fiscal year start" required>
            <Select value={v.fiscal_year_start ?? "jan"} onValueChange={(val) => set("fiscal_year_start", val)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"].map((m) => (
                  <SelectItem key={m} value={m}>
                    {new Date(2026, ["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"].indexOf(m), 1).toLocaleString("en", { month: "long" })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Accounting periods per year">
            <Select value={v.periods_per_year ?? "12"} onValueChange={(val) => set("periods_per_year", val)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="12">12 monthly periods</SelectItem>
                <SelectItem value="13">13 periods (4-4-5)</SelectItem>
                <SelectItem value="4">4 quarterly periods</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Base currency">
            <Input value={v.currency ?? data.summary.currency ?? "UGX"} onChange={(e) => set("currency", e.target.value.toUpperCase())} />
          </Field>
          <Field label="Exchange rate policy">
            <Select value={v.exchange_rate_policy ?? "daily"} onValueChange={(val) => set("exchange_rate_policy", val)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Daily central bank rates</SelectItem>
                <SelectItem value="monthly">Monthly average</SelectItem>
                <SelectItem value="manual">Manual entry</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </div>
      </SectionCard>

      <SectionCard title="Taxes" description="Applied to every invoice, quote and statutory return.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Tax system" required>
            <Select value={v.tax_system ?? "vat"} onValueChange={(val) => set("tax_system", val)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="vat">VAT / GST</SelectItem>
                <SelectItem value="sales_tax">Sales tax (US-style)</SelectItem>
                <SelectItem value="withholding">Withholding tax focus</SelectItem>
                <SelectItem value="none">No indirect tax</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Default VAT rate %">
            <Input
              type="number"
              value={v.vat_rate ?? 18}
              onChange={(e) => set("vat_rate", Number(e.target.value))}
            />
          </Field>
        </div>
        <div className="mt-4 space-y-3">
          <ToggleCard
            title="Registered for VAT"
            description="Enables VAT collection, input credit and filing reports."
            checked={v.vat_registered === true}
            onChange={(val) => set("vat_registered", val)}
          />
          <ToggleCard
            title="Withholding tax enabled"
            description="Apply WHT to supplier payments and customer receipts."
            checked={v.withholding_tax === true}
            onChange={(val) => set("withholding_tax", val)}
          />
        </div>
      </SectionCard>

      <SectionCard title="Document numbering" description="Configure number sequences per document type.">
        <div className="space-y-3">
          {NUMBERING_RULES.map((n) => (
            <ToggleCard
              key={n.key}
              title={n.label}
              description="Prefix + running sequence, e.g. INV-2026-0001"
              checked={sel.numbering?.[n.key] !== false}
              onChange={(val) => onPatchSelections({ numbering: { ...(sel.numbering ?? {}), [n.key]: val } })}
            />
          ))}
        </div>
      </SectionCard>

      <SectionCard title="Calendars & terms">
        <div className="space-y-3">
          {CALENDARS.map((c) => (
            <ToggleCard
              key={c.key}
              title={c.label}
              description="Included in your tenant calendar set."
              checked={sel.calendars?.[c.key] !== false}
              onChange={(val) => onPatchSelections({ calendars: { ...(sel.calendars ?? {}), [c.key]: val } })}
            />
          ))}
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="Default payment terms">
            <Select value={v.payment_terms ?? "net30"} onValueChange={(val) => set("payment_terms", val)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cod">Cash on delivery</SelectItem>
                <SelectItem value="net15">Net 15</SelectItem>
                <SelectItem value="net30">Net 30</SelectItem>
                <SelectItem value="net60">Net 60</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Incoterms (optional)">
            <Input
              value={(sel.incoterms ?? []).join(", ")}
              onChange={(e) =>
                onPatchSelections({
                  incoterms: e.target.value.split(",").map((s: string) => s.trim()).filter(Boolean),
                })
              }
              placeholder="FOB, CIF, EXWâ€¦"
            />
          </Field>
        </div>
      </SectionCard>

      <div className="flex justify-end">
        <Button onClick={submit}>Continue to Data Import</Button>
      </div>
    </div>
  );
}