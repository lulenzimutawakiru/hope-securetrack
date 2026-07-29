"use client";

import { useEffect, useState } from "react";
import { Palette, Plus } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LoadingState } from "@/components/ui/loading-state";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/hooks/use-user";
import { toast } from "sonner";
import { COLOR_ROLES, addBrandColor, contrastRatio, accessibilityPass } from "@/lib/branding";

export default function BrandColorsPage() {
  const { auth } = useUser();
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", hex_value: "#0D7377", color_role: "primary", usage_rules: "", pantone: "" });

  const companyId = auth?.profile?.company_id as string | undefined;

  const load = async () => {
    const { data } = await createClient()
      .from("brand_colors")
      .select("*")
      .order("sort_order");
    setRows((data as Array<Record<string, unknown>>) || []);
    setLoading(false);
  };

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, []);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId) return;
    try {
      await addBrandColor({ company_id: companyId, ...form });
      toast.success("Color added");
      setOpen(false);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  };

  if (loading) return <LoadingState message="Loading palette…" />;

  return (
    <div>
      <PageHeader
        title="Brand Colors"
        description="HEX · RGB · CMYK · Pantone · contrast · accessibility"
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Add color</Button>
            </DialogTrigger>
            <DialogContent>
              <form onSubmit={create}>
                <DialogHeader><DialogTitle>Add brand color</DialogTitle></DialogHeader>
                <div className="grid gap-3 py-3">
                  <div>
                    <Label>Name</Label>
                    <Input required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label>HEX</Label>
                      <div className="flex gap-2">
                        <Input type="color" className="w-12 p-1 h-9" value={form.hex_value} onChange={(e) => setForm((f) => ({ ...f, hex_value: e.target.value }))} />
                        <Input value={form.hex_value} onChange={(e) => setForm((f) => ({ ...f, hex_value: e.target.value }))} />
                      </div>
                    </div>
                    <div>
                      <Label>Role</Label>
                      <Select value={form.color_role} onValueChange={(v) => setForm((f) => ({ ...f, color_role: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {COLOR_ROLES.map((r) => (
                            <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div>
                    <Label>Pantone</Label>
                    <Input value={form.pantone} onChange={(e) => setForm((f) => ({ ...f, pantone: e.target.value }))} />
                  </div>
                  <div>
                    <Label>Usage rules</Label>
                    <Input value={form.usage_rules} onChange={(e) => setForm((f) => ({ ...f, usage_rules: e.target.value }))} />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Contrast vs white: {contrastRatio(form.hex_value, "#FFFFFF")} ·{" "}
                    {accessibilityPass(form.hex_value) ? "AA pass" : "AA fail"}
                  </p>
                </div>
                <DialogFooter><Button type="submit">Save</Button></DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((c) => (
          <Card key={String(c.id)}>
            <CardContent className="pt-4">
              <div className="h-16 rounded-md border mb-3" style={{ backgroundColor: String(c.hex_value) }} />
              <div className="flex justify-between gap-2">
                <div>
                  <div className="font-medium text-sm">{String(c.name)}</div>
                  <div className="text-xs font-mono">{String(c.hex_value)}</div>
                </div>
                <Badge variant="outline" className="capitalize text-[10px] h-fit">{String(c.color_role)}</Badge>
              </div>
              <div className="mt-2 text-[10px] text-muted-foreground space-y-0.5">
                <div>RGB {String(c.rgb_value || "—")}</div>
                <div>CMYK {String(c.cmyk_value || "—")}</div>
                <div>HSL {String(c.hsl_value || "—")}</div>
                {c.pantone ? <div>Pantone {String(c.pantone)}</div> : null}
                <div>
                  Contrast {String(c.contrast_ratio ?? "—")} ·{" "}
                  {c.accessibility_pass ? "AA ✓" : "AA ✗"}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      {rows.length === 0 && (
        <p className="text-sm text-muted-foreground mt-4 flex items-center gap-2">
          <Palette className="h-4 w-4" /> No colors yet — apply migration 00033 for HDG palette seed.
        </p>
      )}
    </div>
  );
}
