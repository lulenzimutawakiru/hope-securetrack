"use client";

import Link from "next/link";
import {
  Smartphone, Bluetooth, Wifi, QrCode, Printer, KeyRound, ListOrdered, Tag,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const ACTIONS = [
  { title: "Bluetooth / Niimbot", href: "/dashboard/print/niimbot", icon: Bluetooth, desc: "Pair label printers on phone" },
  { title: "Queue & status", href: "/dashboard/print/queue", icon: ListOrdered, desc: "Monitor remote jobs" },
  { title: "Secure release", href: "/dashboard/print/release", icon: KeyRound, desc: "PIN unlock confidential jobs" },
  { title: "QR & barcodes", href: "/dashboard/print/codes", icon: QrCode, desc: "Generate codes on tablet" },
  { title: "Inventory labels", href: "/dashboard/print/inventory-labels", icon: Tag, desc: "Shelf/bin from warehouse floor" },
  { title: "Registry", href: "/dashboard/print/registry", icon: Printer, desc: "Branch printer selection" },
];

export default function PrintMobilePage() {
  return (
    <div>
      <PageHeader
        title="Mobile & Remote Printing"
        description="Android · iOS · tablets · BLE · Wi-Fi · remote branch queues"
      />

      <Card className="mb-6 border-primary/20 bg-gradient-to-r from-primary/5 to-transparent">
        <CardContent className="pt-4 flex flex-wrap items-center gap-4">
          <Smartphone className="h-10 w-10 text-primary" />
          <div className="flex-1 min-w-[200px]">
            <p className="font-semibold">Responsive print ops</p>
            <p className="text-sm text-muted-foreground">
              Full ERP UI works on mobile browsers. Use Chrome for Niimbot Web Bluetooth.
              Remote users submit jobs to branch printers and release with PIN.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline"><Wifi className="h-3 w-3 mr-1" /> Wi-Fi</Badge>
            <Badge variant="outline"><Bluetooth className="h-3 w-3 mr-1" /> BLE</Badge>
            <Badge variant="outline">PWA-ready</Badge>
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
          <CardTitle className="text-base">Remote print checklist</CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-2 text-muted-foreground">
          <p>1. Select branch printer in Registry or job form.</p>
          <p>2. Submit document/label job from anywhere (queue).</p>
          <p>3. For confidential jobs, use Secure Release PIN at the device.</p>
          <p>4. Cancel or retry from Queue on mobile.</p>
          <p>5. Download secure PDF previews offline; sync when online.</p>
          <div className="pt-2">
            <Button asChild size="sm"><Link href="/dashboard/print/queue">Open queue</Link></Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
