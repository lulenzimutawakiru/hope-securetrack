"use client";

import Link from "next/link";
import {
  Smartphone, Navigation, ScanLine, FileSignature, AlertTriangle, MapPin, WifiOff,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const CAPS = [
  { icon: MapPin, title: "Assigned stops", desc: "View today deliveries and sequence" },
  { icon: Navigation, title: "Navigate", desc: "Open maps for next customer" },
  { icon: ScanLine, title: "Scan QR/barcode", desc: "Loading and customer site verify" },
  { icon: FileSignature, title: "Capture POD", desc: "Signature · photo · GPS stamp" },
  { icon: AlertTriangle, title: "Report incident", desc: "Breakdown · refused · delay" },
  { icon: WifiOff, title: "Offline sync", desc: "PWA queue when network returns" },
];

export default function DispatchMobilePage() {
  return (
    <div className="max-w-lg mx-auto pb-16">
      <PageHeader
        title="Mobile Driver App"
        description="PWA · Android/iOS · offline · POD · navigation"
      />

      <Card className="mb-4 border-primary/20">
        <CardContent className="pt-4 text-sm flex gap-3">
          <Smartphone className="h-5 w-5 text-primary shrink-0" />
          <p>
            Install SecureTrack ERP as a Progressive Web App for home-screen access,
            camera scanning, GPS, and offline delivery queues.
          </p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-2 mb-6">
        {CAPS.map((c) => (
          <Card key={c.title}>
            <CardHeader className="pb-1">
              <CardTitle className="text-xs flex items-center gap-1">
                <c.icon className="h-3.5 w-3.5 text-primary" />
                {c.title}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-[11px] text-muted-foreground">{c.desc}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground">Quick open</p>
        {[
          { href: "/dashboard/dispatch/routes", label: "My routes" },
          { href: "/dashboard/dispatch/tracking", label: "GPS tracking" },
          { href: "/dashboard/dispatch/pod", label: "Proof of delivery" },
          { href: "/dashboard/dispatch/loading", label: "Loading scan" },
          { href: "/dashboard/dispatch/exceptions", label: "Report exception" },
        ].map((l) => (
          <Button key={l.href} asChild variant="outline" className="w-full justify-between">
            <Link href={l.href}>
              {l.label}
              <Badge variant="secondary" className="text-[9px]">Go</Badge>
            </Link>
          </Button>
        ))}
      </div>
    </div>
  );
}
