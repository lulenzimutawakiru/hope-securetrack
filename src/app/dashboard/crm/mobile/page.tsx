"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Building2,
  Target,
  Calendar,
  QrCode,
  MapPin,
  Plus,
  Phone,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LoadingState } from "@/components/ui/loading-state";
import { listCustomers, listLeads, listActivities } from "@/lib/crm";
import { formatNumber } from "@/lib/utils";

export default function CrmMobilePage() {
  const [loading, setLoading] = useState(true);
  const [customers, setCustomers] = useState<Array<Record<string, unknown>>>([]);
  const [leads, setLeads] = useState<Array<Record<string, unknown>>>([]);
  const [activities, setActivities] = useState<Array<Record<string, unknown>>>([]);

  useEffect(() => {
    async function load() {
      try {
        const [c, l, a] = await Promise.all([
          listCustomers({ limit: 15 }),
          listLeads({ limit: 10 }),
          listActivities({ limit: 10 }),
        ]);
        setCustomers(c);
        setLeads(l);
        setActivities(a);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) return <LoadingState message="Loading field CRM…" />;

  return (
    <div className="max-w-lg mx-auto pb-24 px-1">
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b -mx-1 px-3 py-3 mb-4">
        <h1 className="text-lg font-bold">Mobile CRM</h1>
        <p className="text-xs text-muted-foreground">Field sales · offline-ready PWA · GPS check-in</p>
      </div>

      <div className="grid grid-cols-4 gap-2 mb-4">
        {[
          { href: "/dashboard/crm/leads", icon: Target, label: "Lead" },
          { href: "/dashboard/crm/activities", icon: Calendar, label: "Visit" },
          { href: "/dashboard/sales/quotations", icon: FileText, label: "Quote" },
          { href: "/dashboard/assets/scan", icon: QrCode, label: "Scan" },
        ].map((a) => {
          const Icon = a.icon;
          return (
            <Link
              key={a.href}
              href={a.href}
              className="flex flex-col items-center gap-1 rounded-xl border p-3 hover:bg-muted"
            >
              <Icon className="h-5 w-5 text-primary" />
              <span className="text-[10px] font-medium">{a.label}</span>
            </Link>
          );
        })}
      </div>

      <div className="flex gap-2 mb-4">
        <Button asChild className="flex-1" size="sm">
          <Link href="/dashboard/crm/leads"><Plus className="h-4 w-4 mr-1" /> Capture lead</Link>
        </Button>
        <Button asChild variant="outline" className="flex-1" size="sm">
          <Link href="/dashboard/crm/accounts"><Building2 className="h-4 w-4 mr-1" /> Accounts</Link>
        </Button>
      </div>

      <h2 className="text-xs font-semibold uppercase text-muted-foreground mb-2">Nearby / recent accounts</h2>
      <div className="space-y-2 mb-6">
        {customers.slice(0, 8).map((c) => (
          <Link key={String(c.id)} href="/dashboard/crm/accounts">
            <Card className="hover:border-primary/40">
              <CardContent className="p-3 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate">{String(c.name)}</p>
                  <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {String(c.city || c.region || "Uganda")} · {String(c.customer_class || "corp")}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <Badge variant="secondary" className="text-[10px]">
                    H{String(c.health_score ?? 70)}
                  </Badge>
                  {c.phone ? (
                    <a
                      href={`tel:${c.phone}`}
                      className="flex items-center justify-end gap-0.5 text-[10px] text-primary mt-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Phone className="h-3 w-3" /> Call
                    </a>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <h2 className="text-xs font-semibold uppercase text-muted-foreground mb-2">Open leads</h2>
      <div className="space-y-2 mb-6">
        {leads.slice(0, 5).map((l) => (
          <Card key={String(l.id)}>
            <CardContent className="p-3">
              <p className="font-medium text-sm">{String(l.company_name)}</p>
              <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                <span className="capitalize">{String(l.status)} · score {String(l.lead_score ?? 0)}</span>
                <span>{formatNumber(Number(l.estimated_value || 0))}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <h2 className="text-xs font-semibold uppercase text-muted-foreground mb-2">Today&apos;s activities</h2>
      <div className="space-y-2">
        {activities.slice(0, 5).map((a) => (
          <Card key={String(a.id)}>
            <CardContent className="p-3">
              <p className="font-medium text-sm">{String(a.subject)}</p>
              <p className="text-[10px] text-muted-foreground capitalize mt-0.5">
                {String(a.activity_type)} · {String(a.status)}
              </p>
            </CardContent>
          </Card>
        ))}
        {activities.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">No activities scheduled</p>
        )}
      </div>

      <p className="text-[10px] text-center text-muted-foreground mt-8">
        Offline queue syncs via PWA · GPS check-ins · biometric login supported on device
      </p>
    </div>
  );
}
