"use client";

import { useEffect, useState } from "react";
import { Sparkles, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { StepHeader, SectionCard, Field, ToggleCard, type StepProps } from "../step-types";
import { COUNTRY_DEFAULTS } from "@/lib/platform/onboarding";
import { INDUSTRY_PACKS } from "@/lib/platform/welcome";
import { toast } from "sonner";

const INDUSTRIES = Object.keys(INDUSTRY_PACKS).sort();

export function OrganizationStep({
  data,
  value,
  onPatchAnswers,
  registerSubmit,
  finishStep,
}: StepProps) {
  const v = value ?? {};
  const { summary, industry_pack: pack } = data;
  const [errors, setErrors] = useState<Record<string, string>>({});

  const set = (key: string, val: unknown) => onPatchAnswers({ [key]: val });

  const applyCountryDefaults = (country: string) => {
    const base = COUNTRY_DEFAULTS[country];
    const next: Record<string, unknown> = { country };
    if (base) {
      if (!v.currency) next.currency = base.currency;
      if (!v.timezone) next.timezone = base.timezone;
    }
    onPatchAnswers(next);
  };

  const submit = () => {
    const errs: Record<string, string> = {};
    if (!v.legal_name?.trim()) errs.legal_name = "Legal company name is required";
    if (!v.industry) errs.industry = "Select your industry";
    if (!v.country) errs.country = "Select your country";
    setErrors(errs);
    if (Object.keys(errs).length > 0) {
      toast.error("Please complete the required organization fields");
      return;
    }
    finishStep();
  };

  useEffect(() => {
    registerSubmit(submit);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, data]);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <StepHeader
        title="Organization verification"
        description="Tell us about your legal entity. Your AI assistant detects your industry and applies best-practice templates automatically."
        badge={
          <Badge variant="secondary" className="gap-1">
            <Sparkles className="h-3 w-3" /> Detected: {pack.label}
          </Badge>
        }
      />

      <SectionCard title="Legal entity" description="This identity is used on invoices, contracts and regulatory filings.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Legal company name" required error={errors.legal_name}>
            <Input
              value={v.legal_name ?? summary.organization_name ?? ""}
              onChange={(e) => set("legal_name", e.target.value)}
              placeholder="Acme Manufacturing Ltd"
            />
          </Field>
          <Field label="Trading name">
            <Input value={v.trading_name ?? ""} onChange={(e) => set("trading_name", e.target.value)} placeholder="Acme" />
          </Field>
          <Field label="Registration number">
            <Input value={v.registration_number ?? ""} onChange={(e) => set("registration_number", e.target.value)} placeholder="80020001234567" />
          </Field>
          <Field label="Tax / TIN number">
            <Input value={v.tax_id ?? ""} onChange={(e) => set("tax_id", e.target.value)} placeholder="TIN" />
          </Field>
          <Field label="VAT number">
            <Input value={v.vat_number ?? ""} onChange={(e) => set("vat_number", e.target.value)} placeholder="VAT" />
          </Field>
          <Field label="Website">
            <Input value={v.website ?? ""} onChange={(e) => set("website", e.target.value)} placeholder="https://…" />
          </Field>
        </div>
      </SectionCard>

      <SectionCard title="Industry" description="The AI industry pack pre-configures modules, workflows, reports and KPIs.">
        <Field label="Industry" required error={errors.industry}>
          <Select value={v.industry ?? summary.industry ?? undefined} onValueChange={(val) => set("industry", val)}>
            <SelectTrigger>
              <SelectValue placeholder="Select industry" />
            </SelectTrigger>
            <SelectContent>
              {INDUSTRIES.map((i) => (
                <SelectItem key={i} value={i}>
                  {i}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <div className="mt-3 flex items-start gap-2 rounded-xl border bg-muted/30 p-3 text-sm text-muted-foreground">
          <Building2 className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            <span className="font-medium text-foreground">{pack.label} pack:</span>{" "}
            {pack.description} Modules: {pack.modules.join(", ")}.
          </p>
        </div>
      </SectionCard>

      <SectionCard title="Contact & branding">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Primary email">
            <Input type="email" value={v.email ?? summary.primary_contact_email ?? ""} onChange={(e) => set("email", e.target.value)} placeholder="admin@company.com" />
          </Field>
          <Field label="Phone">
            <Input value={v.phone ?? ""} onChange={(e) => set("phone", e.target.value)} placeholder="+256 …" />
          </Field>
          <Field label="Brand color">
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={v.brand_color ?? "#0B5FFF"}
                onChange={(e) => set("brand_color", e.target.value)}
                className="h-9 w-12 cursor-pointer rounded-md border bg-transparent"
                aria-label="Brand color"
              />
              <Input value={v.brand_color ?? "#0B5FFF"} onChange={(e) => set("brand_color", e.target.value)} className="font-mono" />
            </div>
          </Field>
          <Field label="Company logo (URL)">
            <Input value={v.logo_url ?? ""} onChange={(e) => set("logo_url", e.target.value)} placeholder="https://…/logo.png" />
          </Field>
        </div>
      </SectionCard>

      <SectionCard title="Location & locale" description="Defaults are inferred from your country — adjust as needed.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Country" required error={errors.country}>
            <Select value={v.country ?? summary.country_code ?? "UG"} onValueChange={applyCountryDefaults}>
              <SelectTrigger>
                <SelectValue placeholder="Select country" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(COUNTRY_DEFAULTS).map(([code, c]) => (
                  <SelectItem key={code} value={code}>
                    {c.countryName} ({code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Currency">
            <Input value={v.currency ?? summary.currency ?? "UGX"} onChange={(e) => set("currency", e.target.value.toUpperCase())} />
          </Field>
          <Field label="Timezone">
            <Input value={v.timezone ?? summary.timezone ?? "UTC"} onChange={(e) => set("timezone", e.target.value)} />
          </Field>
          <Field label="Language">
            <Select value={v.language ?? "en"} onValueChange={(val) => set("language", val)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="fr">Français</SelectItem>
                <SelectItem value="sw">Kiswahili</SelectItem>
                <SelectItem value="lg">Luganda</SelectItem>
                <SelectItem value="ar">العربية</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Region / State">
            <Input value={v.region ?? ""} onChange={(e) => set("region", e.target.value)} placeholder="Central Region" />
          </Field>
          <Field label="City">
            <Input value={v.city ?? ""} onChange={(e) => set("city", e.target.value)} placeholder="Kampala" />
          </Field>
          <Field label="Business type">
            <Select value={v.business_type ?? undefined} onValueChange={(val) => set("business_type", val)}>
              <SelectTrigger>
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                {["Private Limited", "Public Limited", "Sole Proprietorship", "Partnership", "NGO / Non-profit", "Government", "Cooperative / SACCO", "Other"].map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-3 mt-4">
          <Field label="Years in operation">
            <Input type="number" value={v.years_in_operation ?? ""} onChange={(e) => set("years_in_operation", Number(e.target.value))} placeholder="0" />
          </Field>
          <Field label="Employee count">
            <Select value={v.employee_count ?? undefined} onValueChange={(val) => set("employee_count", val)}>
              <SelectTrigger>
                <SelectValue placeholder="Size" />
              </SelectTrigger>
              <SelectContent>
                {["1-10", "11-50", "51-200", "201-500", "501-1000", "1000+"].map((s) => (
                  <SelectItem key={s} value={s}>{s} employees</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Revenue band">
            <Select value={v.revenue_band ?? undefined} onValueChange={(val) => set("revenue_band", val)}>
              <SelectTrigger>
                <SelectValue placeholder="Band" />
              </SelectTrigger>
              <SelectContent>
                {["< $100k", "$100k – $1M", "$1M – $10M", "$10M – $100M", "$100M+"].map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>
      </SectionCard>

      <div className="flex justify-end">
        <Button onClick={submit}>Continue to Subscription</Button>
      </div>
    </div>
  );
}
