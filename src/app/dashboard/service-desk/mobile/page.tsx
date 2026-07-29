"use client";

import Link from "next/link";
import {
  Smartphone, Ticket, QrCode, Camera, Mic, MapPin, WifiOff, Headphones,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const CAPS = [
  { icon: Ticket, title: "Create tickets", desc: "Employee & customer self-service" },
  { icon: QrCode, title: "Scan asset QR", desc: "Instant maintenance / fault ticket" },
  { icon: Camera, title: "Photos & video", desc: "Attach evidence on site" },
  { icon: Mic, title: "Voice notes", desc: "Hands-free issue description" },
  { icon: MapPin, title: "GPS check-in", desc: "Field service arrival stamp" },
  { icon: WifiOff, title: "Offline sync", desc: "PWA queue when back online" },
  { icon: Headphones, title: "Agent queue", desc: "Work assigned tickets on mobile" },
];

export default function ServiceDeskMobilePage() {
  return (
    <div className="max-w-lg mx-auto pb-16">
      <PageHeader
        title="Mobile Service Desk"
        description="PWA · Android / iOS · offline · QR · field check-in"
      />

      <Card className="mb-4 border-primary/20">
        <CardContent className="pt-4 text-sm flex gap-3">
          <Smartphone className="h-5 w-5 text-primary shrink-0" />
          <p>
            Install Hope SecureTrack as a Progressive Web App for camera, GPS, push-ready
            notifications, and offline ticket drafts that sync when connectivity returns.
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
        {[
          { href: "/dashboard/service-desk/create", label: "Create ticket" },
          { href: "/dashboard/service-desk/agent", label: "Agent workspace" },
          { href: "/dashboard/service-desk/portal", label: "Self-service portal" },
          { href: "/dashboard/service-desk/field", label: "Field jobs" },
          { href: "/dashboard/service-desk/tickets", label: "All tickets" },
        ].map((l) => (
          <Button key={l.href} asChild variant="outline" className="w-full justify-between">
            <Link href={l.href}>
              {l.label}
              <Badge variant="secondary" className="text-[9px]">Open</Badge>
            </Link>
          </Button>
        ))}
      </div>
    </div>
  );
}
