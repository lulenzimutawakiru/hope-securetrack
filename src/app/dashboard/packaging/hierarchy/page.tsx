"use client";

import { useState } from "react";
import { Warehouse } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buildHierarchyTree, type QrHierarchyNode } from "@/lib/packaging";
import { REAMS_PER_CARTON } from "@/lib/constants";

function NodeView({ node, depth = 0 }: { node: QrHierarchyNode; depth?: number }) {
  return (
    <div className="ml-0" style={{ marginLeft: depth * 12 }}>
      <div className="flex items-center gap-2 rounded border p-2 mb-1 bg-background">
        <Badge variant={node.level === "pallet" ? "default" : node.level === "carton" ? "secondary" : "outline"} className="text-[10px] capitalize">
          {node.level}
        </Badge>
        <span className="font-mono text-sm">{node.serial}</span>
      </div>
      {node.children?.map((c) => (
        <NodeView key={c.serial} node={c} depth={depth + 1} />
      ))}
    </div>
  );
}

export default function QrHierarchyPage() {
  const [palletSerial, setPalletSerial] = useState("PAL-00001");
  const [cartonCount, setCartonCount] = useState("2");
  const [tree, setTree] = useState<QrHierarchyNode | null>(null);

  const build = () => {
    const n = Math.min(5, Math.max(1, Number(cartonCount) || 1));
    const cartons = Array.from({ length: n }, (_, i) => {
      const csn = `CTN-${String(i + 1).padStart(5, "0")}`;
      const reams = Array.from({ length: REAMS_PER_CARTON }, (_, j) =>
        `REAM-${String(i * REAMS_PER_CARTON + j + 1).padStart(6, "0")}`
      );
      return { serial: csn, reams };
    });
    setTree(buildHierarchyTree({ palletSerial, cartons }));
  };

  return (
    <div>
      <PageHeader
        title="QR Authentication Hierarchy"
        description="Pallet QR → Carton QR → Ream QR · SecureTrack Paper 5 reams per carton"
        actions={<Button size="sm" onClick={build}>Build demo tree</Button>}
      />

      <div className="grid gap-4 sm:grid-cols-2 mb-6">
        <div>
          <Label>Pallet serial</Label>
          <Input value={palletSerial} onChange={(e) => setPalletSerial(e.target.value)} />
        </div>
        <div>
          <Label>Cartons in demo (1–5)</Label>
          <Input type="number" value={cartonCount} onChange={(e) => setCartonCount(e.target.value)} />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Warehouse className="h-4 w-4" /> Hierarchy
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!tree ? (
            <p className="text-sm text-muted-foreground">
              Click Build demo tree to visualize pallet → carton ({REAMS_PER_CARTON} reams) → ream QR linkage for authenticity.
            </p>
          ) : (
            <div className="space-y-1">
              <NodeView node={tree} />
              <pre className="mt-4 text-[10px] bg-muted p-3 rounded overflow-x-auto whitespace-pre-wrap">
                {tree.qr_payload}
              </pre>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
