"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Cpu, Fingerprint, ScanFace, ArrowRight, Copy, Radio, Server, Users,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LoadingState } from "@/components/ui/loading-state";
import { useUser } from "@/hooks/use-user";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

export default function AttendanceIntegrationsHub() {
  const { auth } = useUser();
  const [loading, setLoading] = useState(true);
  const [integrations, setIntegrations] = useState<Array<Record<string, unknown>>>([]);
  const [devices, setDevices] = useState<Array<Record<string, unknown>>>([]);
  const [pending, setPending] = useState(0);
  const [appUrl, setAppUrl] = useState("https://hope-securetrack.vercel.app");

  useEffect(() => {
    if (typeof window !== "undefined") {
      setAppUrl(window.location.origin);
    }
    async function load() {
      const cid = auth?.profile?.company_id;
      if (!cid) {
        setLoading(false);
        return;
      }
      const sb = createClient();
      const [integ, dev, punches] = await Promise.all([
        sb
          .from("att_device_integrations")
          .select("*")
          .eq("company_id", cid)
          .is("deleted_at", null),
        sb
          .from("att_devices")
          .select("id,device_code,name,vendor,status,last_heartbeat_at,ip_address")
          .eq("company_id", cid)
          .in("vendor", ["zkteco", "hikvision"])
          .is("deleted_at", null),
        sb
          .from("att_device_punches")
          .select("*", { count: "exact", head: true })
          .eq("company_id", cid)
          .eq("process_status", "pending"),
      ]);
      setIntegrations((integ.data as Array<Record<string, unknown>>) || []);
      setDevices((dev.data as Array<Record<string, unknown>>) || []);
      setPending(punches.count ?? 0);
      setLoading(false);
    }
    load();
  }, [auth]);

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Copied");
    } catch {
      toast.error("Copy failed");
    }
  };

  if (loading) return <LoadingState message="Loading device integrations…" />;

  const zk = integrations.find((i) => i.vendor === "zkteco");
  const hk = integrations.find((i) => i.vendor === "hikvision");

  return (
    <div>
      <PageHeader
        title="Attendance machine integrations"
        description="ZKTeco (ADMS / Push) · Hikvision (ISAPI events) · user mapping · punch queue"
        actions={
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" asChild>
              <Link href="/dashboard/attendance/devices">Devices</Link>
            </Button>
            <Button size="sm" variant="outline" asChild>
              <Link href="/dashboard/attendance/device-users">
                <Users className="h-4 w-4 mr-1" /> User mapping
              </Link>
            </Button>
            <Button size="sm" variant="outline" asChild>
              <Link href="/dashboard/attendance/device-punches">
                Punch queue ({pending})
              </Link>
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-2 mb-6">
        <Card className="border-primary/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Fingerprint className="h-5 w-5 text-primary" />
              ZKTeco
              <Badge variant={zk?.enabled ? "default" : "secondary"}>
                {zk?.enabled ? "enabled" : "disabled"}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p className="text-muted-foreground">
              SpeedFace, uFace, K-series, BioTime cloud push, and ADMS/ICLOCK terminals.
            </p>
            <div className="rounded-lg border bg-muted/30 p-3 space-y-2 font-mono text-[11px] break-all">
              <div className="flex items-start justify-between gap-2">
                <span>
                  JSON push: {appUrl}/api/attendance/devices/zkteco/push?token=
                  {String(zk?.push_token || "…")}
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    copy(
                      `${appUrl}/api/attendance/devices/zkteco/push?token=${zk?.push_token || ""}`
                    )
                  }
                >
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </div>
              <div className="flex items-start justify-between gap-2">
                <span>
                  ADMS/ICLOCK: {appUrl}/api/attendance/devices/zkteco/iclock?token=
                  {String(zk?.push_token || "…")}
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    copy(
                      `${appUrl}/api/attendance/devices/zkteco/iclock?token=${zk?.push_token || ""}`
                    )
                  }
                >
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
            <Button size="sm" asChild>
              <Link href="/dashboard/attendance/integrations/zkteco">
                Setup guide <ArrowRight className="h-4 w-4 ml-1" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="border-primary/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <ScanFace className="h-5 w-5 text-primary" />
              Hikvision
              <Badge variant={hk?.enabled ? "default" : "secondary"}>
                {hk?.enabled ? "enabled" : "disabled"}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p className="text-muted-foreground">
              MinMoe / DS-K1T face terminals and access controllers via ISAPI event notifications.
            </p>
            <div className="rounded-lg border bg-muted/30 p-3 space-y-2 font-mono text-[11px] break-all">
              <div className="flex items-start justify-between gap-2">
                <span>
                  Event URL: {appUrl}/api/attendance/devices/hikvision/event?token=
                  {String(hk?.push_token || "…")}
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    copy(
                      `${appUrl}/api/attendance/devices/hikvision/event?token=${hk?.push_token || ""}`
                    )
                  }
                >
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
            <Button size="sm" asChild>
              <Link href="/dashboard/attendance/integrations/hikvision">
                Setup guide <ArrowRight className="h-4 w-4 ml-1" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Server className="h-4 w-4" /> Registered terminals
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {devices.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No ZKTeco/Hikvision devices yet.{" "}
              <Link href="/dashboard/attendance/devices" className="text-primary underline">
                Register a device
              </Link>
            </p>
          ) : (
            devices.map((d) => (
              <div
                key={String(d.id)}
                className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm"
              >
                <div className="min-w-0">
                  <p className="font-medium truncate">{String(d.name)}</p>
                  <p className="text-[11px] text-muted-foreground font-mono">
                    {String(d.device_code)} · {String(d.vendor)} · {String(d.ip_address || "no IP")}
                  </p>
                </div>
                <Badge
                  variant={d.status === "online" ? "default" : "secondary"}
                  className="inline-flex items-center gap-1"
                >
                  <Radio className="h-3 w-3" />
                  {String(d.status)}
                </Badge>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <div className="mt-6 grid gap-2 sm:grid-cols-3">
        {[
          {
            href: "/dashboard/attendance/device-users",
            title: "Map device users",
            desc: "Link terminal PIN / card to employees",
            icon: Users,
          },
          {
            href: "/dashboard/attendance/device-punches",
            title: "Punch queue",
            desc: "Raw machine punches & processing status",
            icon: Cpu,
          },
          {
            href: "/dashboard/attendance/device-monitor",
            title: "Device monitor",
            desc: "Online status & sync logs",
            icon: Radio,
          },
        ].map((x) => (
          <Link key={x.href} href={x.href}>
            <Card className="h-full hover:border-primary/40 transition-colors">
              <CardContent className="p-4 flex gap-3">
                <x.icon className="h-5 w-5 text-primary shrink-0" />
                <div>
                  <p className="text-sm font-medium">{x.title}</p>
                  <p className="text-xs text-muted-foreground">{x.desc}</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
