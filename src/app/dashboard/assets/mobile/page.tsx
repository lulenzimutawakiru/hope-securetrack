"use client";

import Link from "next/link";
import {
  Smartphone, QrCode, ScanLine, Camera, MapPin, WifiOff, RefreshCw, Wrench,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const CAPABILITIES = [
  { icon: QrCode, title: "QR / barcode scan", desc: "Device camera or hardware wedge scanners" },
  { icon: Smartphone, title: "NFC tap", desc: "View asset, verify ownership, open maintenance" },
  { icon: ScanLine, title: "RFID bulk", desc: "UHF/HF handheld readers for warehouse sweeps" },
  { icon: Camera, title: "Photo capture", desc: "Condition photos on assign / return / audit" },
  { icon: MapPin, title: "GPS stamp", desc: "Vehicles and high-value mobile equipment" },
  { icon: WifiOff, title: "Offline queue", desc: "PWA offline-first with sync when online" },
  { icon: RefreshCw, title: "Status update", desc: "Found · missing · damaged · retired" },
  { icon: Wrench, title: "Fault report", desc: "Scan tag → create maintenance request instantly" },
];

export default function AssetMobilePage() {
  return (
    <div>
      <PageHeader
        title="Mobile Asset Operations"
        description="Field scanning · offline PWA · GPS · NFC · RFID · fault reporting"
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm"><Link href="/dashboard/assets/scan">Open scanner</Link></Button>
            <Button asChild size="sm" variant="outline"><Link href="/dashboard/assets/audits">Audits</Link></Button>
          </div>
        }
      />

      <Card className="mb-6 border-primary/20 bg-gradient-to-r from-primary/5 to-transparent">
        <CardContent className="pt-4 text-sm">
          <strong>Progressive Web App:</strong> install Hope SecureTrack on mobile devices for
          home-screen access, camera scanning, and offline audit queues that sync when connectivity returns.
          Uses the platform <code className="text-xs bg-muted px-1 rounded">use-offline-queue</code> and
          service worker patterns already deployed for inventory and packing floors.
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        {CAPABILITIES.map((c) => (
          <Card key={c.title}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <c.icon className="h-4 w-4 text-primary" />
                {c.title}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">{c.desc}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Field checklist</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {[
            "Open Scan / Verify and allow camera permission",
            "Scan QR on asset label or enter tag manually",
            "Confirm ownership and condition on digital twin",
            "Update location with GPS if high-value / fleet",
            "Start inventory audit for RFID/QR sweep rounds",
            "Report faults → maintenance work request",
          ].map((step, i) => (
            <div key={step} className="flex gap-2 items-start">
              <Badge variant="outline" className="shrink-0 text-[10px]">{i + 1}</Badge>
              <span>{step}</span>
            </div>
          ))}
          <div className="flex flex-wrap gap-2 pt-4">
            <Button asChild size="sm" variant="outline"><Link href="/dashboard/assets/register">Register</Link></Button>
            <Button asChild size="sm" variant="outline"><Link href="/dashboard/assets/tags">Print tags</Link></Button>
            <Button asChild size="sm" variant="outline"><Link href="/dashboard/assets">Hub</Link></Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
