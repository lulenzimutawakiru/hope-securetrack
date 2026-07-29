"use client";

import { useEffect, useState } from "react";
import { Ruler, Plus } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/hooks/use-user";
import { toast } from "sonner";

export default function PkgRulesPage() {
  const { auth } = useUser();
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Record<string, unknown> | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    product_name: "Premium A4 Copy Paper",
    product_code: "HDG-PPR-A4",
    units_per_pack: "1",
    packs_per_carton: "5",
    cartons_per_pallet: "40",
    unit_weight_kg: "2.5",
    instructions: "",
  });

  const companyId = auth?.profile?.company_id as string | undefined;

  const load = async () => {
    const { data } = await createClient()
      .from("pkg_product_rules")
      .select("*")
      .eq("is_active", true)
      .order("product_name");
    setRows((data as Array<Record<string, unknown>>) || []);
    if (data?.[0]) setSelected(data[0] as Record<string, unknown>);
    setLoading(false);
  };

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, []);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId) return;
    try {
      const { error } = await createClient().from("pkg_product_rules").insert({
        company_id: companyId,
        product_name: form.product_name,
        product_code: form.product_code,
        units_per_pack: Number(form.units_per_pack) || 1,
        packs_per_carton: Number(form.packs_per_carton) || 5,
        cartons_per_pallet: Number(form.cartons_per_pallet) || 40,
        unit_weight_kg: Number(form.unit_weight_kg) || 2.5,
        label_required: true,
        qr_required: true,
        seal_required: true,
        instructions: form.instructions || null,
        is_active: true,
      });
      if (error) throw error;
      toast.success("Pack rule created");
      setOpen(false);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  };

  if (loading) return <LoadingState message="Loading pack rules…" />;

  return (
    <div>
      <PageHeader
        title="Product Packaging Rules"
        description="Units per pack · packs per carton · cartons per pallet · instructions"
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 mr-1" /> New rule</Button>
            </DialogTrigger>
            <DialogContent>
              <form onSubmit={create}>
                <DialogHeader><DialogTitle>Packaging rule</DialogTitle></DialogHeader>
                <div className="grid gap-3 py-3">
                  <div>
                    <Label>Product name</Label>
                    <Input required value={form.product_name} onChange={(e) => setForm((f) => ({ ...f, product_name: e.target.value }))} />
                  </div>
                  <div>
                    <Label>Product code</Label>
                    <Input value={form.product_code} onChange={(e) => setForm((f) => ({ ...f, product_code: e.target.value }))} />
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <Label>Units/pack</Label>
                      <Input type="number" value={form.units_per_pack} onChange={(e) => setForm((f) => ({ ...f, units_per_pack: e.target.value }))} />
                    </div>
                    <div>
                      <Label>Packs/carton</Label>
                      <Input type="number" value={form.packs_per_carton} onChange={(e) => setForm((f) => ({ ...f, packs_per_carton: e.target.value }))} />
                    </div>
                    <div>
                      <Label>Cartons/pallet</Label>
                      <Input type="number" value={form.cartons_per_pallet} onChange={(e) => setForm((f) => ({ ...f, cartons_per_pallet: e.target.value }))} />
                    </div>
                  </div>
                  <div>
                    <Label>Unit weight kg</Label>
                    <Input type="number" step="0.01" value={form.unit_weight_kg} onChange={(e) => setForm((f) => ({ ...f, unit_weight_kg: e.target.value }))} />
                  </div>
                  <div>
                    <Label>Instructions</Label>
                    <Textarea rows={4} value={form.instructions} onChange={(e) => setForm((f) => ({ ...f, instructions: e.target.value }))} />
                  </div>
                </div>
                <DialogFooter><Button type="submit">Save</Button></DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      {rows.length === 0 ? (
        <EmptyState icon={Ruler} title="No rules" description="Define packaging hierarchy for products." />
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="space-y-2">
            {rows.map((r) => (
              <button
                key={String(r.id)}
                type="button"
                onClick={() => setSelected(r)}
                className={`w-full text-left rounded-md border p-3 hover:bg-muted/50 ${
                  selected?.id === r.id ? "border-primary bg-primary/5" : ""
                }`}
              >
                <p className="font-medium text-sm">{String(r.product_name)}</p>
                <p className="text-[10px] font-mono text-muted-foreground">{String(r.product_code || "")}</p>
              </button>
            ))}
          </div>
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">{selected ? String(selected.product_name) : "Rule"}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {selected ? (
                <>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline">{String(selected.units_per_pack)} unit/pack</Badge>
                    <Badge variant="outline">{String(selected.packs_per_carton)} packs/carton</Badge>
                    <Badge variant="outline">{String(selected.cartons_per_pallet)} cartons/pallet</Badge>
                    <Badge variant="secondary">{String(selected.unit_weight_kg)} kg/unit</Badge>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {Boolean(selected.qr_required) && <Badge>QR required</Badge>}
                    {Boolean(selected.label_required) && <Badge>Label required</Badge>}
                    {Boolean(selected.seal_required) && <Badge>Seal required</Badge>}
                  </div>
                  <pre className="whitespace-pre-wrap text-xs bg-muted/50 p-3 rounded">
                    {String(selected.instructions || "No instructions")}
                  </pre>
                </>
              ) : (
                <p className="text-muted-foreground">Select a rule</p>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
