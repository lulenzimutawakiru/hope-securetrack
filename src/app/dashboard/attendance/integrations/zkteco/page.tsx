"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Copy, Fingerprint } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LoadingState } from "@/components/ui/loading-state";
import { useUser } from "@/hooks/use-user";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

export default function ZktecoSetupPage() {
  const { auth } = useUser();
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState("");
  const [appUrl, setAppUrl] = useState("https://hope-securetrack.vercel.app");

  useEffect(() => {
    if (typeof window !== "undefined") setAppUrl(window.location.origin);
    async function load() {
      const cid = auth?.profile?.company_id;
      if (!cid) {
        setLoading(false);
        return;
      }
      const { data } = await createClient()
        .from("att_device_integrations")
        .select("push_token, enabled, name")
        .eq("company_id", cid)
        .eq("vendor", "zkteco")
        .maybeSingle();
      setToken(String(data?.push_token || ""));
      setLoading(false);
    }
    load();
  }, [auth]);

  if (loading) return <LoadingState />;

  const pushUrl = `${appUrl}/api/attendance/devices/zkteco/push?token=${token}`;
  const iclockUrl = `${appUrl}/api/attendance/devices/zkteco/iclock?token=${token}`;

  return (
    <div>
      <PageHeader
        title="ZKTeco integration"
        description="ADMS / BioTime push · ICLOCK ATTLOG · SpeedFace / uFace / K-series"
        actions={
          <Button size="sm" variant="outline" asChild>
            <Link href="/dashboard/attendance/integrations">All integrations</Link>
          </Button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Fingerprint className="h-4 w-4" /> Connection
              <Badge variant={token ? "default" : "destructive"}>
                {token ? "token ready" : "no token"}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div>
              <p className="text-xs text-muted-foreground mb-1">JSON push URL</p>
              <div className="flex gap-2">
                <code className="flex-1 rounded border bg-muted/40 p-2 text-[11px] break-all">
                  {pushUrl}
                </code>
                <Button size="sm" variant="outline" onClick={() => {
                  navigator.clipboard.writeText(pushUrl);
                  toast.success("Copied");
                }}>
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">ADMS / ICLOCK URL</p>
              <div className="flex gap-2">
                <code className="flex-1 rounded border bg-muted/40 p-2 text-[11px] break-all">
                  {iclockUrl}
                </code>
                <Button size="sm" variant="outline" onClick={() => {
                  navigator.clipboard.writeText(iclockUrl);
                  toast.success("Copied");
                }}>
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Push token is company-scoped. Rotate via{" "}
              <Link href="/dashboard/attendance/device-integrations" className="text-primary underline">
                integration settings
              </Link>
              .
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Terminal setup checklist</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="list-decimal pl-4 space-y-2 text-sm text-muted-foreground">
              <li>Register device under Attendance → Devices with vendor <strong>zkteco</strong>.</li>
              <li>Set device IP / serial and optional location (branch gate).</li>
              <li>On terminal: enable Cloud / ADMS / Realtime push to the ICLOCK URL above.</li>
              <li>Map each terminal user PIN to an employee (User mapping).</li>
              <li>Test a punch — check Punch queue and Live attendance.</li>
            </ol>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Sample JSON body</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="rounded-lg border bg-muted/30 p-3 text-xs overflow-x-auto">{`{
  "sn": "CKL123456",
  "device_code": "DEV-ZK-01",
  "pin": "1001",
  "punch_time": "2026-07-29T08:01:22",
  "status": 0,
  "verify": 15,
  "id": "log-99821"
}`}</pre>
            <p className="text-xs text-muted-foreground mt-2">
              status: 0=in, 1=out · verify: 1=fingerprint, 2=card, 15=face
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
