"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Server } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LoadingState } from "@/components/ui/loading-state";
import { createClient } from "@/lib/supabase/client";

const SECURITY = [
  "MFA for restricted reports",
  "RBAC + ABAC permissions",
  "PostgreSQL RLS (company isolation)",
  "Column-level masking flags on definitions",
  "Immutable audit / config / run logs",
  "Digital signatures & document hashes",
  "Watermarked exports",
  "Classification: Public · Internal · Confidential · Restricted",
  "Report approval workflows",
  "Encryption in transit (TLS) / at rest (Supabase)",
];

const SCALE = [
  "100+ ERP module integrations (federated)",
  "5,000+ predefined report capacity (catalog-driven)",
  "Unlimited custom reports & dashboards",
  "Materialized views & Redis cache targets",
  "Queue workers + event streaming hooks",
  "Horizontal scale via serverless + CDN",
  "99.9% availability target (platform SLAs)",
  "Multi-company · multi-branch · multi-country",
];

export default function ArchitecturePage() {
  const [loading, setLoading] = useState(true);
  const [services, setServices] = useState<Array<Record<string, unknown>>>([]);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data } = await supabase
        .from("bi_service_registry")
        .select("*")
        .order("tier")
        .order("service_name");
      setServices(data ?? []);
      setLoading(false);
    }
    load();
  }, []);

  if (loading) return <LoadingState />;

  return (
    <div>
      <PageHeader
        title="Production Architecture & Security"
        description="Service mesh view · enterprise security controls · scale targets (SAP/Power BI class design)"
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href="/dashboard/reports">Hub</Link>
          </Button>
        }
      />

      <div className="rounded-lg border bg-gradient-to-r from-hope-navy to-[#0d2847] text-white p-4 mb-6 text-sm">
        <p className="text-hope-gold text-xs font-semibold uppercase tracking-wide flex items-center gap-2">
          <Server className="h-3.5 w-3.5" />
          Technical architecture
        </p>
        <p className="text-white/70 text-xs mt-2">
          Reporting · Scheduler · Notification · Dashboard · BI · AI Engine · Document Render ·
          Export · Search · Audit · API Gateway · Event Stream · Queue Workers · Materialized Views ·
          Redis · CDN · HA / DR
        </p>
      </div>

      <h3 className="text-sm font-semibold mb-3">Service registry</h3>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 mb-8">
        {services.map((s) => (
          <Card key={String(s.id)}>
            <CardHeader className="pb-1">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-sm">{String(s.service_name)}</CardTitle>
                <Badge
                  className={
                    s.status === "healthy"
                      ? "bg-green-100 text-green-800 text-[10px]"
                      : "text-[10px]"
                  }
                >
                  {String(s.status)}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="text-xs space-y-1">
              <Badge variant="outline" className="text-[10px]">
                {String(s.tier)}
              </Badge>
              <p className="font-mono text-[10px] text-muted-foreground">
                {String(s.service_key)} · {String(s.endpoint_hint ?? "")}
              </p>
              <p className="text-muted-foreground">{String(s.description ?? "")}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Enterprise security</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="text-sm space-y-2">
              {SECURITY.map((item) => (
                <li key={item} className="flex gap-2">
                  <span className="text-hope-teal">✓</span>
                  {item}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Scale targets</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="text-sm space-y-2">
              {SCALE.map((item) => (
                <li key={item} className="flex gap-2">
                  <span className="text-hope-gold">●</span>
                  {item}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
