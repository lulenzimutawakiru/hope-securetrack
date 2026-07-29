"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  IdCard,
  Palette,
  Users,
  CreditCard,
  Printer,
  Package,
  Shield,
  Fingerprint,
  ScanLine,
  AlertTriangle,
  Smartphone,
  ShieldAlert,
  FileBarChart,
  Wand2,
  Hash,
  Workflow,
  Building2,
  ArrowRight,
  LayoutTemplate,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/ui/loading-state";
import { createClient } from "@/lib/supabase/client";
import { LIFECYCLE_STAGES } from "@/lib/workforce-id";

const MODULES = [
  { title: "Identities", href: "/dashboard/credentials/identities", icon: Users, desc: "Multi-identity lifecycle" },
  { title: "ID Cards", href: "/dashboard/credentials/cards", icon: CreditCard, desc: "Issue · activate · suspend" },
  { title: "Design Studio", href: "/dashboard/credentials/designer", icon: Palette, desc: "Drag-drop card designer" },
  { title: "Templates", href: "/dashboard/credentials/templates", icon: LayoutTemplate, desc: "Executive · factory · visitor" },
  { title: "AI Designer", href: "/dashboard/credentials/ai", icon: Wand2, desc: "Generate layouts by prompt" },
  { title: "Print Queue", href: "/dashboard/credentials/print", icon: Printer, desc: "Zebra · Evolis · browser" },
  { title: "Card Inventory", href: "/dashboard/credentials/inventory", icon: Package, desc: "PVC · RFID stock" },
  { title: "Access Control", href: "/dashboard/credentials/access", icon: Shield, desc: "Zones · profiles · events" },
  { title: "Biometrics", href: "/dashboard/credentials/biometrics", icon: Fingerprint, desc: "Enrollment status (no raw data)" },
  { title: "Verify ID", href: "/dashboard/credentials/verify", icon: ScanLine, desc: "QR digital identity check" },
  { title: "Lost / Stolen", href: "/dashboard/credentials/lost", icon: AlertTriangle, desc: "Disable & replace workflow" },
  { title: "Mobile Badge", href: "/dashboard/credentials/mobile", icon: Smartphone, desc: "Digital wallet credentials" },
  { title: "Security Centre", href: "/dashboard/credentials/security", icon: ShieldAlert, desc: "Fraud · scans · alerts" },
  { title: "Reports", href: "/dashboard/credentials/reports", icon: FileBarChart, desc: "Register · audit · expiry" },
  { title: "Branding", href: "/dashboard/credentials/branding", icon: Building2, desc: "Logo · colours · seals" },
  { title: "ID Numbering", href: "/dashboard/credentials/numbering", icon: Hash, desc: "HDG-EMP-2026-000001" },
  { title: "Workflows", href: "/dashboard/credentials/workflows", icon: Workflow, desc: "Onboard · renew · terminate" },
];

export default function CredentialsHubPage() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    identities: 0,
    activeCards: 0,
    pendingPrint: 0,
    expired: 0,
    lost: 0,
    suspended: 0,
    verifications: 0,
    failedScans: 0,
  });

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const [
        ids,
        active,
        print,
        expired,
        lost,
        susp,
        verif,
        failed,
      ] = await Promise.all([
        supabase.from("wid_identities").select("*", { count: "exact", head: true }).is("deleted_at", null),
        supabase.from("wid_credentials").select("*", { count: "exact", head: true }).eq("status", "active").is("deleted_at", null),
        supabase.from("wid_print_jobs").select("*", { count: "exact", head: true }).in("status", ["pending", "queued", "approved"]),
        supabase.from("wid_credentials").select("*", { count: "exact", head: true }).eq("status", "expired"),
        supabase.from("wid_credentials").select("*", { count: "exact", head: true }).in("status", ["lost", "stolen"]),
        supabase.from("wid_credentials").select("*", { count: "exact", head: true }).eq("status", "suspended"),
        supabase.from("wid_verification_logs").select("*", { count: "exact", head: true }),
        supabase.from("wid_verification_logs").select("*", { count: "exact", head: true }).in("result", ["not_found", "revoked", "suspended", "suspicious", "invalid_token"]),
      ]);
      setStats({
        identities: ids.count ?? 0,
        activeCards: active.count ?? 0,
        pendingPrint: print.count ?? 0,
        expired: expired.count ?? 0,
        lost: lost.count ?? 0,
        suspended: susp.count ?? 0,
        verifications: verif.count ?? 0,
        failedScans: failed.count ?? 0,
      });
      setLoading(false);
    }
    load().catch(() => setLoading(false));
  }, []);

  if (loading) return <LoadingState message="Loading workforce identity platform…" />;

  return (
    <div>
      <PageHeader
        title="Workforce Identity & Credentials"
        description="Digital identity · smart badges · access control · card design · print · biometrics · security governance"
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard/credentials/verify">
                <ScanLine className="h-4 w-4 mr-1" /> Verify
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard/credentials/designer">
                <Palette className="h-4 w-4 mr-1" /> Design
              </Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/dashboard/credentials/identities">
                <IdCard className="h-4 w-4 mr-1" /> New Identity
              </Link>
            </Button>
          </div>
        }
      />

      <div className="mb-6 flex flex-wrap gap-1.5">
        {LIFECYCLE_STAGES.map((s) => (
          <Badge key={s} variant="outline" className="text-[10px] font-normal">
            {s}
          </Badge>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        <StatCard title="Identities" value={String(stats.identities)} icon={Users} />
        <StatCard title="Active Cards" value={String(stats.activeCards)} icon={CreditCard} />
        <StatCard title="Print Queue" value={String(stats.pendingPrint)} icon={Printer} />
        <StatCard title="Suspended" value={String(stats.suspended)} icon={ShieldAlert} />
        <StatCard title="Lost / Stolen" value={String(stats.lost)} icon={AlertTriangle} />
        <StatCard title="Expired" value={String(stats.expired)} icon={IdCard} />
        <StatCard title="Verifications" value={String(stats.verifications)} icon={ScanLine} />
        <StatCard title="Failed Scans" value={String(stats.failedScans)} icon={Shield} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 mb-8">
        {MODULES.map((m) => (
          <Link key={m.href} href={m.href}>
            <Card className="h-full transition hover:border-teal-600/40 hover:shadow-md">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <m.icon className="h-5 w-5 text-teal-700" />
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </div>
                <CardTitle className="text-base">{m.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{m.desc}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Platform capabilities</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2 lg:grid-cols-3">
          <p>• Multi-identity (employee, contractor, operator, visitor)</p>
          <p>• CR80 design studio with QR / RFID / NFC</p>
          <p>• Smart ID engine (HDG-EMP-YYYY-######)</p>
          <p>• Encrypted QR verification + audit logs</p>
          <p>• Access zones with auto-provisioning</p>
          <p>• Biometric enrollment status (no raw templates)</p>
          <p>• Print queue (Zebra / Evolis / browser)</p>
          <p>• Lost/stolen disable & replacement</p>
          <p>• Mobile digital badges + offline window</p>
          <p>• HR employee sync · termination offboard</p>
          <p>• Soft-delete · recycle bin · versioned templates</p>
          <p>• AI layout generation & print QA checks</p>
        </CardContent>
      </Card>
    </div>
  );
}
