"use client";

import { useEffect, useState } from "react";
import { Building2, Plus, Save } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { LoadingState } from "@/components/ui/loading-state";
import { useUser } from "@/hooks/use-user";
import {
  listCompanies, getCompany, updateCompany, createCompany, COMPANY_TYPES,
} from "@/lib/enterprise-company";
import { FileUpload } from "@/components/ui/file-upload";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

export default function CompaniesPage() {
  const { auth } = useUser();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [selected, setSelected] = useState<Record<string, unknown> | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: "", code: "", company_type: "operating", legal_name: "", trading_name: "",
  });
  const [edit, setEdit] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      const list = await listCompanies();
      setRows(list as Array<Record<string, unknown>>);
      if (auth?.profile?.company_id) {
        const c = await getCompany(auth.profile.company_id);
        if (c) {
          setSelected(c as Record<string, unknown>);
          setEdit({
            name: String(c.name || ""),
            legal_name: String(c.legal_name || ""),
            trading_name: String(c.trading_name || ""),
            tax_id: String(c.tax_id || ""),
            vat_number: String(c.vat_number || ""),
            registration_number: String(c.registration_number || ""),
            email: String(c.email || ""),
            phone: String(c.phone || ""),
            website: String(c.website || ""),
            address: String(c.address || ""),
            city: String(c.city || ""),
            country: String(c.country || ""),
            industry: String(c.industry || ""),
            sector: String(c.sector || ""),
            base_currency: String(c.base_currency || "UGX"),
            timezone: String(c.timezone || "Africa/Kampala"),
            company_type: String(c.company_type || "operating"),
          });
        }
      }
    } catch {
      /* pending */
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [auth]);

  const save = async () => {
    if (!selected?.id || !auth) return;
    setSaving(true);
    try {
      await updateCompany(selected.id as string, edit, auth.user.id);
      toast.success("Company updated");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const create = async () => {
    if (!auth || !form.name || !form.code) {
      toast.error("Name and code required");
      return;
    }
    try {
      await createCompany({
        ...form,
        parent_company_id: auth.profile.company_id,
      }, auth.user.id);
      toast.success("Company created");
      setOpen(false);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Create failed");
    }
  };

  if (loading) return <LoadingState message="Loading companies…" />;

  return (
    <div>
      <PageHeader
        title="Company Master"
        description="Legal entities · holding · subsidiaries · joint ventures · full profile"
        actions={
          <Button size="sm" onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4 mr-1" /> Add company
          </Button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-2 rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow
                  key={r.id as string}
                  className={selected?.id === r.id ? "bg-muted/50 cursor-pointer" : "cursor-pointer"}
                  onClick={async () => {
                    const c = await getCompany(r.id as string);
                    if (c) {
                      setSelected(c as Record<string, unknown>);
                      setEdit({
                        name: String(c.name || ""),
                        legal_name: String(c.legal_name || ""),
                        trading_name: String(c.trading_name || ""),
                        tax_id: String(c.tax_id || ""),
                        vat_number: String(c.vat_number || ""),
                        registration_number: String(c.registration_number || ""),
                        email: String(c.email || ""),
                        phone: String(c.phone || ""),
                        website: String(c.website || ""),
                        address: String(c.address || ""),
                        city: String(c.city || ""),
                        country: String(c.country || ""),
                        industry: String(c.industry || ""),
                        sector: String(c.sector || ""),
                        base_currency: String(c.base_currency || "UGX"),
                        timezone: String(c.timezone || "Africa/Kampala"),
                        company_type: String(c.company_type || "operating"),
                      });
                    }
                  }}
                >
                  <TableCell className="font-mono text-xs">{String(r.code)}</TableCell>
                  <TableCell className="text-sm font-medium">{String(r.name)}</TableCell>
                  <TableCell><Badge variant="outline">{String(r.company_type || "operating")}</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <Card className="lg:col-span-3">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <Building2 className="h-4 w-4" /> Company profile
            </CardTitle>
            <Button size="sm" onClick={save} disabled={saving || !selected}>
              <Save className="h-4 w-4 mr-1" /> {saving ? "Saving…" : "Save"}
            </Button>
          </CardHeader>
          <CardContent className="grid sm:grid-cols-2 gap-3">
            {([
              ["name", "Company name"],
              ["legal_name", "Legal name"],
              ["trading_name", "Trading name"],
              ["tax_id", "TIN / Tax ID"],
              ["vat_number", "VAT number"],
              ["registration_number", "Registration #"],
              ["email", "Email"],
              ["phone", "Phone"],
              ["website", "Website"],
              ["address", "Address"],
              ["city", "City"],
              ["country", "Country"],
              ["industry", "Industry"],
              ["sector", "Sector"],
              ["base_currency", "Currency"],
              ["timezone", "Timezone"],
            ] as const).map(([k, label]) => (
              <div key={k}>
                <Label className="text-xs">{label}</Label>
                <Input
                  value={edit[k] || ""}
                  onChange={(e) => setEdit({ ...edit, [k]: e.target.value })}
                />
              </div>
            ))}
            <div>
              <Label className="text-xs">Company type</Label>
              <Select value={edit.company_type || "operating"} onValueChange={(v) => setEdit({ ...edit, company_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {COMPANY_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {selected?.id != null && String(selected.id) !== "" ? (
              <div className="sm:col-span-2">
                <FileUpload
                  bucket="logos"
                  category="logo"
                  folder="company"
                  entityTable="companies"
                  entityId={selected.id as string}
                  entityField="logo_url"
                  value={String(selected.logo_url || edit.logo_url || "")}
                  preview
                  label="Company logo"
                  onUploaded={async (r) => {
                    setEdit((e) => ({ ...e, logo_url: r.publicUrl }));
                    setSelected((s) => (s ? { ...s, logo_url: r.publicUrl } : s));
                    await createClient()
                      .from("companies")
                      .update({ logo_url: r.publicUrl })
                      .eq("id", selected.id as string);
                  }}
                />
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>New company / subsidiary</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Code</Label><Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} /></div>
            <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div>
              <Label>Type</Label>
              <Select value={form.company_type} onValueChange={(v) => setForm({ ...form, company_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {COMPANY_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={create}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
