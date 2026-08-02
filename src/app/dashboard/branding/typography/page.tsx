"use client";

import { useEffect, useState } from "react";
import { Type, Plus } from "lucide-react";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { crudCreate } from "@/lib/api/crud-client";

const FONT_ROLES = [
  { value: "heading", label: "Heading" },
  { value: "body", label: "Body" },
  { value: "digital", label: "Digital" },
  { value: "print", label: "Print" },
  { value: "mono", label: "Mono" },
];

export default function BrandTypographyPage() {
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    font_role: "body",
    family_name: "Inter",
    fallback_stack: "Inter, system-ui, sans-serif",
    default_size_px: "14",
    default_weight: "400",
    line_spacing: "1.5",
    usage_guidelines: "",
  });


  const load = async () => {
    const { data } = await createClient()
      .from("brand_fonts")
      .select("*")
      .order("font_role");
    setRows((data as Array<Record<string, unknown>>) || []);
    setLoading(false);
  };

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, []);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await crudCreate("brand_fonts", {
      font_role: form.font_role,
      family_name: form.family_name,
      fallback_stack: form.fallback_stack,
      default_size_px: Number(form.default_size_px) || 14,
      default_weight: form.default_weight,
      line_spacing: Number(form.line_spacing) || 1.5,
      usage_guidelines: form.usage_guidelines || null,
      is_active: true,
    });
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Font rule added");
    setOpen(false);
    await load();
  };

  if (loading) return <LoadingState message="Loading typography…" />;

  return (
    <div>
      <PageHeader
        title="Typography"
        description="Heading · body · digital · print · mono fonts and usage rules"
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Add font</Button>
            </DialogTrigger>
            <DialogContent>
              <form onSubmit={create}>
                <DialogHeader><DialogTitle>Define corporate font</DialogTitle></DialogHeader>
                <div className="grid gap-3 py-3">
                  <div>
                    <Label>Role</Label>
                    <Select value={form.font_role} onValueChange={(v) => setForm((f) => ({ ...f, font_role: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {FONT_ROLES.map((r) => (
                          <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Family</Label>
                    <Input required value={form.family_name} onChange={(e) => setForm((f) => ({ ...f, family_name: e.target.value }))} />
                  </div>
                  <div>
                    <Label>Fallback stack</Label>
                    <Input value={form.fallback_stack} onChange={(e) => setForm((f) => ({ ...f, fallback_stack: e.target.value }))} />
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <Label>Size (px)</Label>
                      <Input value={form.default_size_px} onChange={(e) => setForm((f) => ({ ...f, default_size_px: e.target.value }))} />
                    </div>
                    <div>
                      <Label>Weight</Label>
                      <Input value={form.default_weight} onChange={(e) => setForm((f) => ({ ...f, default_weight: e.target.value }))} />
                    </div>
                    <div>
                      <Label>Line spacing</Label>
                      <Input value={form.line_spacing} onChange={(e) => setForm((f) => ({ ...f, line_spacing: e.target.value }))} />
                    </div>
                  </div>
                  <div>
                    <Label>Usage guidelines</Label>
                    <Input value={form.usage_guidelines} onChange={(e) => setForm((f) => ({ ...f, usage_guidelines: e.target.value }))} />
                  </div>
                </div>
                <DialogFooter><Button type="submit">Save</Button></DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      {rows.length === 0 ? (
        <EmptyState icon={Type} title="No fonts" description="Define heading and body typefaces for digital and print." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((f) => (
            <Card key={String(f.id)}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base capitalize">{String(f.font_role)}</CardTitle>
                  <Badge variant="outline">{String(f.default_weight)}</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <p
                  className="text-2xl font-semibold mb-2"
                  style={{
                    fontFamily: String(f.fallback_stack || f.family_name),
                    fontWeight: Number(f.default_weight) || 400,
                    lineHeight: Number(f.line_spacing) || 1.5,
                  }}
                >
                  {String(f.family_name)}
                </p>
                <p className="text-xs text-muted-foreground font-mono">{String(f.fallback_stack)}</p>
                <p className="text-xs mt-2">
                  {String(f.default_size_px)}px · spacing {String(f.line_spacing)}
                </p>
                {f.usage_guidelines ? (
                  <p className="text-xs text-muted-foreground mt-1">{String(f.usage_guidelines)}</p>
                ) : null}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
