"use client";

import { useEffect, useState } from "react";
import { Building2, Plus, Save } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LoadingState } from "@/components/ui/loading-state";
import { EmptyState } from "@/components/ui/empty-state";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/hooks/use-user";
import { toast } from "sonner";

type Brand = {
  id: string;
  brand_code: string;
  name: string;
  company_display_name: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  accent_color: string | null;
  watermark_text: string | null;
  signature_name: string | null;
  signature_title: string | null;
  footer_text: string | null;
  branch_name: string | null;
  is_default: boolean;
  is_active: boolean;
};

export default function BrandingPage() {
  const { auth } = useUser();
  const [rows, setRows] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Brand | null>(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("wid_card_brands")
      .select("*")
      .is("deleted_at", null)
      .order("name");
    const list = (data as Brand[]) ?? [];
    setRows(list);
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
        .from("wid_card_brands")
        .update({
          name: selected.name,
          company_display_name: selected.company_display_name,
          primary_color: selected.primary_color,
          secondary_color: selected.secondary_color,
          accent_color: selected.accent_color,
          watermark_text: selected.watermark_text,
          signature_name: selected.signature_name,
          signature_title: selected.signature_title,
          footer_text: selected.footer_text,
          branch_name: selected.branch_name,
          is_default: selected.is_default,
          updated_at: new Date().toISOString(),
        })
        .eq("id", selected.id);
      if (error) throw error;
      toast.success("Brand saved");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const create = async () => {
    if (!auth?.profile?.company_id) return;
    try {
      const supabase = createClient();
      const code = `BRAND-${Date.now().toString(36).toUpperCase()}`;
      const { data, error } = await supabase
        .from("wid_card_brands")
        .insert({
          company_id: auth.profile.company_id,
          brand_code: code,
          name: "New branch brand",
          company_display_name: "Hope Design Group Ltd",
          primary_color: "#0f766e",
          secondary_color: "#0f172a",
          accent_color: "#f59e0b",
          watermark_text: "HOPE DESIGN",
          is_default: false,
        })
        .select()
        .single();
      if (error) throw error;
      setSelected(data as Brand);
      toast.success("Brand created");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Create failed");
    }
  };

  if (loading) return <LoadingState message="Loading branding…" />;

  return (
    <div>
      <PageHeader
        title="Company Brand Management"
        description="Logo colours · watermarks · signatures · multi-branch card styles"
        actions={
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={create}>
              <Plus className="h-4 w-4 mr-1" /> New brand
            </Button>
            <Button size="sm" onClick={save} disabled={!selected || saving}>
              <Save className="h-4 w-4 mr-1" />{saving ? "Saving…" : "Save"}
            </Button>
          </div>
        }
      />

      {rows.length === 0 ? (
        <EmptyState title="No brands" description="Create a card brand profile." />
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          <Card>
            <CardHeader><CardTitle className="text-sm">Brands</CardTitle></CardHeader>
            <CardContent className="space-y-1">
              {rows.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => setSelected(b)}
                  className={`w-full text-left rounded-lg border px-3 py-2 text-sm ${selected?.id === b.id ? "border-teal-600 bg-teal-50" : "hover:bg-muted"}`}
                >
                  <div className="font-medium flex items-center gap-2">
                    <Building2 className="h-4 w-4" /> {b.name}
                    {b.is_default && <Badge className="text-[10px]">Default</Badge>}
                  </div>
                  <div className="text-xs font-mono text-muted-foreground">{b.brand_code}</div>
                </button>
              ))}
            </CardContent>
          </Card>

          {selected && (
            <Card className="lg:col-span-2">
              <CardHeader><CardTitle className="text-sm">Edit · {selected.brand_code}</CardTitle></CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label>Name</Label>
                  <Input value={selected.name} onChange={(e) => setSelected({ ...selected, name: e.target.value })} />
                </div>
                <div>
                  <Label>Display company</Label>
                  <Input value={selected.company_display_name || ""} onChange={(e) => setSelected({ ...selected, company_display_name: e.target.value })} />
                </div>
                <div>
                  <Label>Primary</Label>
                  <Input type="color" value={selected.primary_color || "#0f766e"} onChange={(e) => setSelected({ ...selected, primary_color: e.target.value })} />
                </div>
                <div>
                  <Label>Secondary</Label>
                  <Input type="color" value={selected.secondary_color || "#0f172a"} onChange={(e) => setSelected({ ...selected, secondary_color: e.target.value })} />
                </div>
                <div>
                  <Label>Accent</Label>
                  <Input type="color" value={selected.accent_color || "#f59e0b"} onChange={(e) => setSelected({ ...selected, accent_color: e.target.value })} />
                </div>
                <div>
                  <Label>Watermark</Label>
                  <Input value={selected.watermark_text || ""} onChange={(e) => setSelected({ ...selected, watermark_text: e.target.value })} />
                </div>
                <div>
                  <Label>Signature name</Label>
                  <Input value={selected.signature_name || ""} onChange={(e) => setSelected({ ...selected, signature_name: e.target.value })} />
                </div>
                <div>
                  <Label>Signature title</Label>
                  <Input value={selected.signature_title || ""} onChange={(e) => setSelected({ ...selected, signature_title: e.target.value })} />
                </div>
                <div className="sm:col-span-2">
                  <Label>Footer</Label>
                  <Input value={selected.footer_text || ""} onChange={(e) => setSelected({ ...selected, footer_text: e.target.value })} />
                </div>
                <div>
                  <Label>Branch</Label>
                  <Input value={selected.branch_name || ""} onChange={(e) => setSelected({ ...selected, branch_name: e.target.value })} />
                </div>
                <label className="flex items-center gap-2 text-sm mt-6">
                  <input
                    type="checkbox"
                    checked={selected.is_default}
                    onChange={(e) => setSelected({ ...selected, is_default: e.target.checked })}
                  />
                  Default brand
                </label>
                <div
                  className="sm:col-span-2 h-20 rounded-lg flex items-center justify-center text-white font-bold"
                  style={{
                    background: `linear-gradient(90deg, ${selected.primary_color}, ${selected.secondary_color})`,
                  }}
                >
                  {selected.company_display_name || "Preview"}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
