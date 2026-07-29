"use client";

import { useEffect, useState } from "react";
import { Palette, Save, Plus, Printer } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { LoadingState } from "@/components/ui/loading-state";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/hooks/use-user";
import { toast } from "sonner";
import { buildInvoiceHtml, printInvoiceHtml } from "@/lib/billing";

type Tpl = {
  id: string;
  template_code: string;
  name: string;
  description: string | null;
  primary_color: string | null;
  show_qr: boolean;
  show_tax_breakdown: boolean;
  show_bank_details: boolean;
  default_terms: string | null;
  default_bank_details: string | null;
  is_default: boolean;
  design_json: Record<string, unknown>;
};

export default function InvoiceDesignerPage() {
  const { auth } = useUser();
  const [templates, setTemplates] = useState<Tpl[]>([]);
  const [selected, setSelected] = useState<Tpl | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const supabase = createClient();
    const { data } = await supabase.from("bill_invoice_templates").select("*").is("deleted_at", null).order("name");
    const list = (data as Tpl[]) ?? [];
    setTemplates(list);
    if (!selected && list[0]) setSelected(list[0]);
    setLoading(false);
  };

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, []);

  const save = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("bill_invoice_templates")
        .update({
          name: selected.name,
          primary_color: selected.primary_color,
          show_qr: selected.show_qr,
          show_tax_breakdown: selected.show_tax_breakdown,
          show_bank_details: selected.show_bank_details,
          default_terms: selected.default_terms,
          default_bank_details: selected.default_bank_details,
          is_default: selected.is_default,
          design_json: selected.design_json,
          updated_at: new Date().toISOString(),
        })
        .eq("id", selected.id);
      if (error) throw error;
      toast.success("Template saved");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const create = async () => {
    if (!auth?.profile?.company_id) return;
    const supabase = createClient();
    const code = `TPL-${Date.now().toString(36).toUpperCase()}`;
    const { data, error } = await supabase
      .from("bill_invoice_templates")
      .insert({
        company_id: auth.profile.company_id,
        template_code: code,
        name: "Custom invoice template",
        primary_color: "#0f766e",
        show_qr: true,
        show_tax_breakdown: true,
        show_bank_details: true,
        default_terms: "Payment due as stated.",
        default_bank_details: "Bank: Stanbic · Hope Design Group Ltd",
        design_json: { header: { title: "TAX INVOICE" }, footer: { showBank: true } },
        created_by: auth.profile.id,
      })
      .select()
      .single();
    if (error) {
      toast.error(error.message);
      return;
    }
    setSelected(data as Tpl);
    toast.success("Template created");
    await load();
  };

  const preview = () => {
    if (!selected) return;
    const html = buildInvoiceHtml({
      title: "TAX INVOICE",
      invoice_number: "HDG-INV-2026-000001",
      invoice_type: "tax",
      status: "issued",
      invoice_date: new Date().toISOString().slice(0, 10),
      due_date: new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10),
      currency: "UGX",
      customer_name: "Sample Customer Ltd",
      customer_address: "Industrial Area, Kampala",
      customer_tax_id: "1000123456",
      payment_terms_label: "Net 30",
      lines: [
        { description: "Security paper cartons", quantity: 50, unit: "carton", unit_price: 85000, tax_rate: 18 },
        { description: "Custom print job", quantity: 1, unit: "job", unit_price: 1200000, tax_rate: 18 },
      ],
      subtotal: 5450000,
      tax_amount: 981000,
      total_amount: 6431000,
      balance_due: 6431000,
      bank_details: selected.default_bank_details,
      terms_conditions: selected.default_terms,
      qr_public_id: "INV-PREVIEW",
      primary_color: selected.primary_color || "#0f766e",
    });
    printInvoiceHtml(html);
  };

  if (loading) return <LoadingState message="Loading invoice designer…" />;

  return (
    <div>
      <PageHeader
        title="Invoice Designer"
        description="Header · logo · tax · QR · bank details · terms · brand colours"
        actions={
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={create}><Plus className="h-4 w-4 mr-1" /> New</Button>
            <Button size="sm" variant="outline" onClick={preview} disabled={!selected}><Printer className="h-4 w-4 mr-1" /> Preview</Button>
            <Button size="sm" onClick={save} disabled={!selected || saving}><Save className="h-4 w-4 mr-1" />{saving ? "Saving…" : "Save"}</Button>
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader><CardTitle className="text-sm">Templates</CardTitle></CardHeader>
          <CardContent className="space-y-1">
            {templates.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setSelected(t)}
                className={`w-full text-left rounded-lg border px-3 py-2 text-sm ${selected?.id === t.id ? "border-teal-600 bg-teal-50" : "hover:bg-muted"}`}
              >
                <div className="font-medium flex items-center gap-2">
                  <Palette className="h-4 w-4" /> {t.name}
                  {t.is_default && <Badge className="text-[10px]">Default</Badge>}
                </div>
                <div className="text-xs font-mono text-muted-foreground">{t.template_code}</div>
              </button>
            ))}
          </CardContent>
        </Card>

        {selected && (
          <Card className="lg:col-span-2">
            <CardHeader><CardTitle className="text-sm">Edit · {selected.template_code}</CardTitle></CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label>Name</Label>
                <Input value={selected.name} onChange={(e) => setSelected({ ...selected, name: e.target.value })} />
              </div>
              <div>
                <Label>Primary colour</Label>
                <Input type="color" value={selected.primary_color || "#0f766e"} onChange={(e) => setSelected({ ...selected, primary_color: e.target.value })} />
              </div>
              <div className="flex flex-col gap-2 justify-end text-sm">
                <label className="flex items-center gap-2"><input type="checkbox" checked={selected.show_qr} onChange={(e) => setSelected({ ...selected, show_qr: e.target.checked })} /> Show QR</label>
                <label className="flex items-center gap-2"><input type="checkbox" checked={selected.show_tax_breakdown} onChange={(e) => setSelected({ ...selected, show_tax_breakdown: e.target.checked })} /> Tax breakdown</label>
                <label className="flex items-center gap-2"><input type="checkbox" checked={selected.show_bank_details} onChange={(e) => setSelected({ ...selected, show_bank_details: e.target.checked })} /> Bank details</label>
                <label className="flex items-center gap-2"><input type="checkbox" checked={selected.is_default} onChange={(e) => setSelected({ ...selected, is_default: e.target.checked })} /> Default template</label>
              </div>
              <div className="sm:col-span-2">
                <Label>Default bank details</Label>
                <textarea
                  className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={selected.default_bank_details || ""}
                  onChange={(e) => setSelected({ ...selected, default_bank_details: e.target.value })}
                />
              </div>
              <div className="sm:col-span-2">
                <Label>Default terms & conditions</Label>
                <textarea
                  className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={selected.default_terms || ""}
                  onChange={(e) => setSelected({ ...selected, default_terms: e.target.value })}
                />
              </div>
              <div className="sm:col-span-2">
                <Label>Header title</Label>
                <Select
                  value={String((selected.design_json as { header?: { title?: string } })?.header?.title || "TAX INVOICE")}
                  onValueChange={(v) =>
                    setSelected({
                      ...selected,
                      design_json: {
                        ...selected.design_json,
                        header: { ...(selected.design_json as { header?: object }).header, title: v },
                      },
                    })
                  }
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["TAX INVOICE", "INVOICE", "PROFORMA INVOICE", "COMMERCIAL INVOICE", "CREDIT NOTE"].map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
