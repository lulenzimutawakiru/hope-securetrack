"use client";

import { useState } from "react";
import { Package } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/ui/stat-card";
import {
  calculateCartonization,
  DEFAULT_HOPE_A4_RULE,
  estimateMaterialQty,
  type CartonizationResult,
} from "@/lib/packaging";

export default function CartonizationPage() {
  const [units, setUnits] = useState("500");
  const [packsPerCarton, setPacksPerCarton] = useState("5");
  const [cartonsPerPallet, setCartonsPerPallet] = useState("40");
  const [unitWeight, setUnitWeight] = useState("2.5");
  const [result, setResult] = useState<CartonizationResult | null>(null);

  const run = () => {
    const r = calculateCartonization(Number(units) || 0, {
      ...DEFAULT_HOPE_A4_RULE,
      packs_per_carton: Number(packsPerCarton) || 5,
      cartons_per_pallet: Number(cartonsPerPallet) || 40,
      unit_weight_kg: Number(unitWeight) || 2.5,
    });
    setResult(r);
  };

  const mats = result
    ? estimateMaterialQty(result.cartons_required, result.pallets_required, result.total_units)
    : null;

  return (
    <div>
      <PageHeader
        title="Cartonization Engine"
        description="Best carton size · quantity plan · pallet layout · material estimate"
        actions={<Button size="sm" onClick={run}>Calculate</Button>}
      />

      <div className="grid gap-4 sm:grid-cols-4 mb-6">
        <div>
          <Label>Total units (reams)</Label>
          <Input type="number" value={units} onChange={(e) => setUnits(e.target.value)} />
        </div>
        <div>
          <Label>Packs per carton</Label>
          <Input type="number" value={packsPerCarton} onChange={(e) => setPacksPerCarton(e.target.value)} />
        </div>
        <div>
          <Label>Cartons per pallet</Label>
          <Input type="number" value={cartonsPerPallet} onChange={(e) => setCartonsPerPallet(e.target.value)} />
        </div>
        <div>
          <Label>Unit weight kg</Label>
          <Input type="number" step="0.01" value={unitWeight} onChange={(e) => setUnitWeight(e.target.value)} />
        </div>
      </div>

      {!result ? (
        <Card>
          <CardContent className="pt-6 text-sm text-muted-foreground flex items-center gap-2">
            <Package className="h-5 w-5" /> Enter quantity and click Calculate (defaults match Hope A4: 5 reams/carton, 40 cartons/pallet).
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
            <StatCard title="Cartons required" value={String(result.cartons_required)} />
            <StatCard title="Full cartons" value={String(result.full_cartons)} />
            <StatCard title="Pallets" value={String(result.pallets_required)} />
            <StatCard title="Gross kg (est.)" value={String(result.estimated_gross_weight_kg)} />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Plan summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p>Recommended carton: <Badge variant="outline">{result.recommended_carton}</Badge></p>
                <p>Units/carton: {result.units_per_carton}</p>
                <p>Remainder units: {result.remainder_units}</p>
                <p>Last pallet cartons: {result.last_pallet_cartons}</p>
                <p>Net weight: {result.estimated_net_weight_kg} kg</p>
                {result.warnings.map((w) => (
                  <p key={w} className="text-amber-700 text-xs">{w}</p>
                ))}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Material estimate</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-sm">
                {mats &&
                  Object.entries(mats).map(([k, v]) => (
                    <div key={k} className="flex justify-between border-b pb-1">
                      <span className="capitalize">{k.replace(/_/g, " ")}</span>
                      <span className="font-medium">{v}</span>
                    </div>
                  ))}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Pallet plan</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-sm max-h-64 overflow-y-auto">
                {result.pallet_plan.map((p) => (
                  <div key={p.pallet_no} className="flex justify-between border-b pb-1">
                    <span>Pallet {p.pallet_no}</span>
                    <span className="text-muted-foreground">
                      cartons {p.carton_from}–{p.carton_to} ({p.cartons})
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Carton list (first 20)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-sm max-h-64 overflow-y-auto">
                {result.plan.slice(0, 20).map((c) => (
                  <div key={c.carton_no} className="flex justify-between border-b pb-1">
                    <span>
                      Carton {c.carton_no}
                      {c.is_partial && <Badge variant="outline" className="ml-1 text-[9px]">partial</Badge>}
                    </span>
                    <span>{c.units} u · {c.weight_kg} kg</span>
                  </div>
                ))}
                {result.plan.length > 20 && (
                  <p className="text-xs text-muted-foreground">…and {result.plan.length - 20} more</p>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
