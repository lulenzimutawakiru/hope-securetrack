"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Plug, Network, Webhook, Workflow, Key, Radio, Printer, MapPin,
  Activity, Shield, BookOpen, ArrowRight, Cloud, Cpu, MessageSquare,
  RefreshCw, AlertTriangle, Store,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/ui/loading-state";
import { createClient } from "@/lib/supabase/crud-compat";
import { ARCHITECTURE_LAYERS } from "@/lib/integration";

const MODULES = [
  { title: "Connectors", href: "/dashboard/integrations/connectors", icon: Store, desc: "Marketplace · 40+ connectors" },
  { title: "Connections", href: "/dashboard/integrations/connections", icon: Plug, desc: "Configure · test · health" },
  { title: "API Gateway", href: "/dashboard/integrations/api", icon: Network, desc: "Routes · keys · rate limits" },
  { title: "Developer Portal", href: "/dashboard/integrations/developers", icon: BookOpen, desc: "Docs · sandbox · SDKs" },
  { title: "Webhooks", href: "/dashboard/integrations/webhooks", icon: Webhook, desc: "Events · deliveries · retries" },
  { title: "Workflows", href: "/dashboard/integrations/workflows", icon: Workflow, desc: "No-code automation builder" },
  { title: "Data Sync", href: "/dashboard/integrations/sync", icon: RefreshCw, desc: "Realtime · batch · maps" },
  { title: "Message Queue", href: "/dashboard/integrations/queue", icon: Activity, desc: "Queue · DLQ · retries" },
  { title: "IoT / Industry 4.0", href: "/dashboard/integrations/iot", icon: Cpu, desc: "MQTT · OPC-UA · Modbus" },
  { title: "Hardware", href: "/dashboard/integrations/hardware", icon: Printer, desc: "Printers · RFID · scanners" },
  { title: "GPS & Fleet", href: "/dashboard/integrations/gps", icon: MapPin, desc: "Trackers · routes · fuel" },
  { title: "Payments", href: "/dashboard/integrations/payments", icon: MessageSquare, desc: "MoMo · Stripe · banks" },
  { title: "Slack · SecureChat", href: "/dashboard/integrations/slack", icon: MessageSquare, desc: "Workspace · tickets · alerts" },
  { title: "MTN KYC", href: "/dashboard/integrations/mtn-kyc", icon: Shield, desc: "BVN · MSISDN · MADAPI verify" },
  { title: "Module Links", href: "/dashboard/integrations/modules", icon: Network, desc: "Internal ERP event mesh" },
  { title: "Monitoring", href: "/dashboard/integrations/monitor", icon: Activity, desc: "Health · latency · alerts" },
  { title: "Security", href: "/dashboard/integrations/security", icon: Shield, desc: "Secrets · IP allow · audit" },
  { title: "Event Bus", href: "/dashboard/integrations/events", icon: Radio, desc: "Publish · pipeline · logs" },
];

export default function IntegrationsHubPage() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    connectors: 0,
    connections: 0,
    connected: 0,
    webhooks: 0,
    workflows: 0,
    apiApps: 0,
    events: 0,
    failed: 0,
    iot: 0,
    alerts: 0,
  });

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const [
        connectors, connections, connected, webhooks, workflows,
        apps, events, failed, iot, alerts,
      ] = await Promise.all([
        supabase.from("intg_connectors").select("*", { count: "exact", head: true }),
        supabase.from("intg_connections").select("*", { count: "exact", head: true }).is("deleted_at", null),
        supabase.from("intg_connections").select("*", { count: "exact", head: true }).eq("status", "connected"),
        supabase.from("intg_webhook_subscriptions").select("*", { count: "exact", head: true }).eq("is_active", true),
        supabase.from("intg_workflows").select("*", { count: "exact", head: true }).eq("is_active", true),
        supabase.from("intg_api_apps").select("*", { count: "exact", head: true }),
        supabase.from("intg_events").select("*", { count: "exact", head: true }),
        supabase.from("intg_webhook_deliveries").select("*", { count: "exact", head: true }).eq("success", false),
        supabase.from("intg_iot_devices").select("*", { count: "exact", head: true }).eq("is_active", true),
        supabase.from("intg_alerts").select("*", { count: "exact", head: true }).eq("status", "open"),
      ]);
      setStats({
        connectors: connectors.count ?? 0,
        connections: connections.count ?? 0,
        connected: connected.count ?? 0,
        webhooks: webhooks.count ?? 0,
        workflows: workflows.count ?? 0,
        apiApps: apps.count ?? 0,
        events: events.count ?? 0,
        failed: failed.count ?? 0,
        iot: iot.count ?? 0,
        alerts: alerts.count ?? 0,
      });
      setLoading(false);
    }
    load().catch(() => setLoading(false));
  }, []);

  if (loading) return <LoadingState message="Loading enterprise integration hub…" />;

  return (
    <div>
      <PageHeader
        title="Enterprise Integration Hub"
        description="iPaaS · API management · automation · IoT · payments · zero-trust connectivity"
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard/integrations/monitor"><Activity className="h-4 w-4 mr-1" /> Monitor</Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/dashboard/integrations/connections"><Plug className="h-4 w-4 mr-1" /> Connections</Link>
            </Button>
          </div>
        }
      />

      <div className="mb-6 flex flex-wrap gap-1.5">
        {ARCHITECTURE_LAYERS.map((l) => (
          <Badge key={l} variant="outline" className="text-[10px] font-normal">{l}</Badge>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5 mb-8">
        <StatCard title="Connectors" value={String(stats.connectors)} icon={Store} />
        <StatCard title="Connected" value={`${stats.connected}/${stats.connections}`} icon={Plug} />
        <StatCard title="Webhooks" value={String(stats.webhooks)} icon={Webhook} />
        <StatCard title="Workflows" value={String(stats.workflows)} icon={Workflow} />
        <StatCard title="API apps" value={String(stats.apiApps)} icon={Key} />
        <StatCard title="Events" value={String(stats.events)} icon={Radio} />
        <StatCard title="Failed deliveries" value={String(stats.failed)} icon={AlertTriangle} />
        <StatCard title="IoT devices" value={String(stats.iot)} icon={Cpu} />
        <StatCard title="Open alerts" value={String(stats.alerts)} icon={Activity} />
        <StatCard title="Cloud ready" value="HA" icon={Cloud} />
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
        <CardHeader><CardTitle className="text-base">Platform capabilities</CardTitle></CardHeader>
        <CardContent className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2 lg:grid-cols-3">
          <p>• REST / GraphQL / WebSocket / SOAP-ready routes</p>
          <p>• OAuth2 · JWT · API keys · rate limiting</p>
          <p>• Webhook engine with retries & delivery log</p>
          <p>• No-code workflows (event / schedule / manual)</p>
          <p>• Bi-directional data sync & field maps</p>
          <p>• Payment: MTN, Airtel, Pesapal, Stripe, FLW, PayPal</p>
          <p>• IoT: MQTT, OPC-UA, Modbus telemetry</p>
          <p>• Hardware: Zebra, Niimbot, RFID, biometrics</p>
          <p>• GPS fleet positions & courier hooks</p>
          <p>• Identity: Entra, Okta, Keycloak, Google</p>
          <p>• Internal ERP event mesh (HR↔IAM↔Billing…)</p>
          <p>• Developer portal, SDKs, sandbox apps</p>
        </CardContent>
      </Card>
    </div>
  );
}
