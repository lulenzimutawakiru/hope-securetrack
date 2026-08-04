"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Building2 } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingState } from "@/components/ui/loading-state";
import { FileUpload } from "@/components/ui/file-upload";
import { createClient } from "@/lib/supabase/crud-compat";
import { crudUpdate } from "@/lib/api/crud-client";
import { useUser } from "@/hooks/use-user";
import { toast } from "sonner";

type CompanyForm = {
  id: string;
  name: string;
  code: string;
  legal_name: string;
  tax_id: string;
  vat_number: string;
  nssf_employer_number: string;
  registration_number: string;
  address: string;
  city: string;
  district: string;
  country: string;
  phone: string;
  email: string;
  website: string;
  base_currency: string;
  fiscal_year_start_month: string;
  timezone: string;
  industry: string;
  logo_url: string;
  watermark_url: string;
  seal_url: string;
};

const empty: CompanyForm = {
  id: "",
  name: "",
  code: "",
  legal_name: "",
  tax_id: "",
  vat_number: "",
  nssf_employer_number: "",
  registration_number: "",
  address: "",
  city: "",
  district: "",
  country: "Uganda",
  phone: "",
  email: "",
  website: "",
  base_currency: "UGX",
  fiscal_year_start_month: "1",
  timezone: "Africa/Kampala",
  industry: "",
  logo_url: "",
  watermark_url: "",
  seal_url: "",
};

export default function CompanySettingsPage() {
  const { auth } = useUser();
  const [form, setForm] = useState<CompanyForm>(empty);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!auth) {
      setLoading(false);
      return;
    }
    const supabase = createClient();
    const { data, error } = await supabase
      .from("companies")
      .select("*")
      .eq("id", auth.profile.company_id)
      .maybeSingle();
    if (error) toast.error(error.message);
    if (data) {
      setForm({
        id: data.id,
        name: data.name ?? "",
        code: data.code ?? "",
        legal_name: data.legal_name ?? "",
        tax_id: data.tax_id ?? "",
        vat_number: data.vat_number ?? "",
        nssf_employer_number: data.nssf_employer_number ?? "",
        registration_number: data.registration_number ?? "",
        address: data.address ?? "",
        city: data.city ?? "",
        district: data.district ?? "",
        country: data.country ?? "Uganda",
        phone: data.phone ?? "",
        email: data.email ?? "",
        website: data.website ?? "",
        base_currency: data.base_currency ?? "UGX",
        fiscal_year_start_month: String(data.fiscal_year_start_month ?? 1),
        timezone: data.timezone ?? "Africa/Kampala",
        industry: data.industry ?? "",
        logo_url: data.logo_url ?? "",
        watermark_url: data.watermark_url ?? "",
        seal_url: data.seal_url ?? "",
      });
    }
    setLoading(false);
  };

  useEffect(() => {
    if (auth) load();
    else setLoading(false);
  }, [auth]);

  const set = (k: keyof CompanyForm, v: string) =>
    setForm((f) => ({ ...f, [k]: v }));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth || !form.id) return;
    setSaving(true);
    const payload = {
      name: form.name,
      legal_name: form.legal_name || null,
      tax_id: form.tax_id || null,
      vat_number: form.vat_number || null,
      nssf_employer_number: form.nssf_employer_number || null,
      registration_number: form.registration_number || null,
      address: form.address || null,
      city: form.city || null,
      district: form.district || null,
      country: form.country || null,
      phone: form.phone || null,
      email: form.email || null,
      website: form.website || null,
      base_currency: form.base_currency || "UGX",
      fiscal_year_start_month: Number(form.fiscal_year_start_month) || 1,
      timezone: form.timezone || "Africa/Kampala",
      industry: form.industry || null,
      logo_url: form.logo_url || null,
      watermark_url: form.watermark_url || null,
      seal_url: form.seal_url || null,
    };
    const res = await crudUpdate("companies", form.id, payload);
    if (!res.ok) {
      toast.error(res.error);
    } else {
      toast.success("Company saved");
    }
    setSaving(false);
  };

  if (loading) return <LoadingState />;

  return (
    <div>
      <PageHeader
        title="Company Management"
        description="Legal entity, tax identifiers, fiscal calendar, and corporate identity assets"
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href="/dashboard/settings">Hub</Link>
          </Button>
        }
      />

      <form onSubmit={save}>
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                Legal identity
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Company name</Label>
                  <Input value={form.name} onChange={(e) => set("name", e.target.value)} required />
                </div>
                <div className="space-y-1">
                  <Label>Code</Label>
                  <Input value={form.code} disabled />
                </div>
              </div>
              <div className="space-y-1">
                <Label>Legal name</Label>
                <Input value={form.legal_name} onChange={(e) => set("legal_name", e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>TIN / Tax ID</Label>
                  <Input value={form.tax_id} onChange={(e) => set("tax_id", e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>VAT number</Label>
                  <Input value={form.vat_number} onChange={(e) => set("vat_number", e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Registration no.</Label>
                  <Input
                    value={form.registration_number}
                    onChange={(e) => set("registration_number", e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label>NSSF employer no.</Label>
                  <Input
                    value={form.nssf_employer_number}
                    onChange={(e) => set("nssf_employer_number", e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label>Industry</Label>
                <Input value={form.industry} onChange={(e) => set("industry", e.target.value)} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Contact & location</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1">
                <Label>Address</Label>
                <Input value={form.address} onChange={(e) => set("address", e.target.value)} />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label>City</Label>
                  <Input value={form.city} onChange={(e) => set("city", e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>District</Label>
                  <Input value={form.district} onChange={(e) => set("district", e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>Country</Label>
                  <Input value={form.country} onChange={(e) => set("country", e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Phone</Label>
                  <Input value={form.phone} onChange={(e) => set("phone", e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>Email</Label>
                  <Input value={form.email} onChange={(e) => set("email", e.target.value)} type="email" />
                </div>
              </div>
              <div className="space-y-1">
                <Label>Website</Label>
                <Input value={form.website} onChange={(e) => set("website", e.target.value)} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Fiscal & currency</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label>Base currency</Label>
                  <Input value={form.base_currency} onChange={(e) => set("base_currency", e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>FY start month</Label>
                  <Input
                    type="number"
                    min={1}
                    max={12}
                    value={form.fiscal_year_start_month}
                    onChange={(e) => set("fiscal_year_start_month", e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Timezone</Label>
                  <Input value={form.timezone} onChange={(e) => set("timezone", e.target.value)} />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Brand assets</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <FileUpload
                bucket="logos"
                category="logo"
                folder="company"
                entityTable="companies"
                entityId={form.id || undefined}
                entityField="logo_url"
                value={form.logo_url}
                preview
                label="Company logo"
                hint="PNG, JPG, WebP or SVG · max 10 MB"
                onUploaded={async (r) => {
                  set("logo_url", r.publicUrl);
                  if (form.id) {
                    await crudUpdate("companies", form.id, { logo_url: r.publicUrl });
                  }
                }}
                onCleared={() => set("logo_url", "")}
              />
              <FileUpload
                bucket="branding"
                category="seal"
                folder="company"
                entityTable="companies"
                entityId={form.id || undefined}
                entityField="seal_url"
                value={form.seal_url}
                preview
                label="Digital seal / stamp"
                hint="PNG with transparency recommended"
                onUploaded={async (r) => {
                  set("seal_url", r.publicUrl);
                  if (form.id) {
                    await crudUpdate("companies", form.id, { seal_url: r.publicUrl });
                  }
                }}
                onCleared={() => set("seal_url", "")}
              />
              <FileUpload
                bucket="branding"
                category="watermark"
                folder="company"
                entityTable="companies"
                entityId={form.id || undefined}
                entityField="watermark_url"
                value={form.watermark_url}
                preview
                label="Watermark"
                onUploaded={async (r) => {
                  set("watermark_url", r.publicUrl);
                  if (form.id) {
                    await crudUpdate("companies", form.id, {
                      watermark_url: r.publicUrl,
                    });
                  }
                }}
                onCleared={() => set("watermark_url", "")}
              />
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Or paste logo URL</Label>
                <Input value={form.logo_url} onChange={(e) => set("logo_url", e.target.value)} placeholder="https://…" />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="mt-6">
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : "Save company"}
          </Button>
        </div>
      </form>
    </div>
  );
}
