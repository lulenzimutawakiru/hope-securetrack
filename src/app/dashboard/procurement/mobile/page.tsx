"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Users,
  FileText,
  ClipboardCheck,
  QrCode,
  Camera,
  Scale,
  Award,
  CheckCircle,
  ShieldAlert,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LoadingState } from "@/components/ui/loading-state";
import { listSuppliers, listOnboarding, listNcrs, listDeliverySlots } from "@/lib/srm";
import { formatNumber } from "@/lib/utils";

export default function SrmMobilePage() {
  const [loading, setLoading] = useState(true);
  const [suppliers, setSuppliers] = useState<Array<Record<string, unknown>>>([]);
  const [onboarding, setOnboarding] = useState<Array<Record<string, unknown>>>([]);
  const [ncrs, setNcrs] = useState<Array<Record<string, unknown>>>([]);
  const [slots, setSlots] = useState<Array<Record<string, unknown>>>([]);

  useEffect(() => {
    async function load() {
      try {
        const [s, o, n, d] = await Promise.all([
          listSuppliers({ limit: 12 }),
          listOnboarding(),
          listNcrs(),
          listDeliverySlots().catch(() => []),
        ]);
        setSuppliers(s);
        setOnboarding(o.filter((x) => ["submitted", "under_review"].includes(String(x.status))).slice(0, 5));
        setNcrs(n.filter((x) => String(x.status) !== "closed").slice(0, 5));
        setSlots(d.slice(0, 5));
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) return <LoadingState message="Loading mobile SRM…" />;

  const actions = [
    { href: "/dashboard/procurement/onboarding", icon: CheckCircle, label: "Approve" },
    { href: "/dashboard/procurement/orders", icon: FileText, label: "POs" },
    { href: "/dashboard/procurement/quality", icon: ClipboardCheck, label: "Inspect" },
    { href: "/dashboard/assets/scan", icon: QrCode, label: "Scan" },
    { href: "/dashboard/inventory/grn", icon: Camera, label: "GRN" },
    { href: "/dashboard/procurement/matching", icon: Scale, label: "Match" },
    { href: "/dashboard/procurement/contracts", icon: Award, label: "Contract" },
    { href: "/dashboard/procurement/risk", icon: ShieldAlert, label: "Risk" },
  ];

  return (
    <div className="max-w-lg mx-auto pb-24 px-1">
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b -mx-1 px-3 py-3 mb-4">
        <h1 className="text-lg font-bold">Mobile SRM</h1>
        <p className="text-xs text-muted-foreground">
          Field procurement · offline-ready PWA · scan · photo · approve
        </p>
      </div>

      <div className="grid grid-cols-4 gap-2 mb-4">
        {actions.map((a) => {
          const Icon = a.icon;
          return (
            <Link
              key={a.href + a.label}
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
          <Link href="/dashboard/procurement/onboarding">
            <Plus className="h-4 w-4 mr-1" /> Onboard
          </Link>
        </Button>
        <Button asChild variant="outline" className="flex-1" size="sm">
          <Link href="/dashboard/procurement/suppliers">
            <Users className="h-4 w-4 mr-1" /> Suppliers
          </Link>
        </Button>
      </div>

      <h2 className="text-xs font-semibold uppercase text-muted-foreground mb-2">Pending approvals</h2>
      <div className="space-y-2 mb-6">
        {onboarding.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-3">No pending onboarding</p>
        )}
        {onboarding.map((o) => (
          <Link key={String(o.id)} href="/dashboard/procurement/onboarding">
            <Card className="hover:border-primary/40 mb-2">
              <CardContent className="p-3">
                <p className="font-medium text-sm">{String(o.company_name)}</p>
                <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                  <span className="capitalize">{String(o.status).replace(/_/g, " ")}</span>
                  <span>{String(o.application_number)}</span>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <h2 className="text-xs font-semibold uppercase text-muted-foreground mb-2">Open NCRs</h2>
      <div className="space-y-2 mb-6">
        {ncrs.map((n) => (
          <Card key={String(n.id)}>
            <CardContent className="p-3">
              <p className="font-medium text-sm">{String(n.title)}</p>
              <div className="flex gap-2 mt-1">
                <Badge variant="outline" className="text-[10px]">{String(n.severity)}</Badge>
                <Badge variant="secondary" className="text-[10px]">{String(n.status)}</Badge>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <h2 className="text-xs font-semibold uppercase text-muted-foreground mb-2">Delivery slots</h2>
      <div className="space-y-2 mb-6">
        {slots.map((s) => (
          <Card key={String(s.id)}>
            <CardContent className="p-3 flex justify-between gap-2">
              <div>
                <p className="text-sm font-medium">
                  {s.slot_date ? String(s.slot_date).slice(0, 10) : "—"} · {String(s.slot_window)}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {(s.suppliers as { name?: string } | null)?.name || "Supplier"} · {String(s.warehouse_name || "")}
                </p>
              </div>
              <Badge className="text-[10px] h-fit">{String(s.status)}</Badge>
            </CardContent>
          </Card>
        ))}
        {slots.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-2">No slots scheduled</p>
        )}
      </div>

      <h2 className="text-xs font-semibold uppercase text-muted-foreground mb-2">Suppliers</h2>
      <div className="space-y-2">
        {suppliers.slice(0, 6).map((s) => (
          <Card key={String(s.id)}>
            <CardContent className="p-3 flex justify-between">
              <div>
                <p className="font-medium text-sm">{String(s.name)}</p>
                <p className="text-[10px] text-muted-foreground">
                  Score {String(s.overall_score ?? "—")} · risk {String(s.risk_score ?? "—")}
                </p>
              </div>
              <div className="text-right text-[10px]">
                <p className="font-semibold">{formatNumber(Number(s.spend_ytd || 0))}</p>
                <p className="text-muted-foreground capitalize">{String(s.supplier_class || "")}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <p className="text-[10px] text-center text-muted-foreground mt-8">
        Offline queue syncs via PWA · QR/barcode · camera capture · biometric unlock supported
      </p>
    </div>
  );
}
