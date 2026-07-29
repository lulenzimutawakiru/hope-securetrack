"use client";

import Link from "next/link";
import { Smartphone, ScanLine, Scale, ShieldCheck, Layers, Package } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const ACTIONS = [
  { title: "Packing floor", href: "/dashboard/packaging/floor", icon: ScanLine, desc: "Scan reams · build cartons" },
  { title: "Weighing", href: "/dashboard/packaging/weighing", icon: Scale, desc: "Scale capture on tablet" },
  { title: "QC checks", href: "/dashboard/packaging/qc", icon: ShieldCheck, desc: "Pass/fail on line" },
  { title: "Pallets", href: "/dashboard/packaging/pallets", icon: Layers, desc: "Stack & master QR" },
  { title: "Work orders", href: "/dashboard/packaging/work-orders", icon: Package, desc: "Assigned jobs" },
];

export default function PkgMobilePage() {
  return (
    <div>
      <PageHeader
        title="Mobile Packing"
        description="Operators · handheld scanners · offline-ready UI · rugged devices"
      />

      <Card className="mb-6 border-primary/20 bg-gradient-to-r from-primary/5 to-transparent">
        <CardContent className="pt-4 flex flex-wrap items-center gap-4">
          <Smartphone className="h-10 w-10 text-primary" />
          <div className="flex-1 min-w-[200px]">
            <p className="font-semibold">Floor-optimized workflows</p>
            <p className="text-sm text-muted-foreground">
              Use camera/keyboard wedge scanners on Android, iOS, or industrial handhelds.
              Large touch targets for packing floor. Works as responsive PWA in the browser.
            </p>
          </div>
          <div className="flex gap-2">
            <Badge variant="outline">Scan</Badge>
            <Badge variant="outline">Weigh</Badge>
            <Badge variant="outline">QC</Badge>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {ACTIONS.map((a) => (
          <Link
            key={a.href}
            href={a.href}
            className="rounded-lg border p-4 hover:border-primary/40 hover:bg-muted/40 transition"
          >
            <a.icon className="h-6 w-6 text-primary mb-2" />
            <p className="font-medium text-sm">{a.title}</p>
            <p className="text-xs text-muted-foreground mt-1">{a.desc}</p>
          </Link>
        ))}
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">Operator checklist</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-1">
          <p>1. Open work order → assign packing line.</p>
          <p>2. Scan 5 ream serials → pack carton → seal + carton QR.</p>
          <p>3. Weigh carton → run QC checklist.</p>
          <p>4. Stack 40 cartons → build pallet master QR.</p>
          <p>5. Generate packing list for dispatch.</p>
          <Button asChild size="sm" className="mt-3">
            <Link href="/dashboard/packaging/floor">Start packing</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
