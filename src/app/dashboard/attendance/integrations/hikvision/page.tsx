"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Copy, ScanFace } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LoadingState } from "@/components/ui/loading-state";
import { useUser } from "@/hooks/use-user";
import { crudList } from "@/lib/api/crud-client";
import { toast } from "sonner";

export default function HikvisionSetupPage() {
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
      const res = await crudList<Record<string, unknown>>(
        "att_device_integrations",
        { pageSize: 1, filters: { vendor: "hikvision" } }
      );
      const data = res.ok ? res.data.data[0] : null;
      setToken(String(data?.push_token || ""));
      setLoading(false);
    }
    load();
  }, [auth]);

  if (loading) return <LoadingState />;

  const eventUrl = `${appUrl}/api/attendance/devices/hikvision/event?token=${token}`;

  return (
    <div>
      <PageHeader
        title="Hikvision integration"
        description="ISAPI AccessControllerEvent · MinMoe / DS-K1T face terminals"
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
              <ScanFace className="h-4 w-4" /> Event notification URL
              <Badge variant={token ? "default" : "destructive"}>
                {token ? "token ready" : "no token"}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex gap-2">
              <code className="flex-1 rounded border bg-muted/40 p-2 text-[11px] break-all">
                {eventUrl}
              </code>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  navigator.clipboard.writeText(eventUrl);
                  toast.success("Copied");
                }}
              >
                <Copy className="h-3.5 w-3.5" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              On the device web UI: Configuration → Event → HTTP Listening / Event Notification →
              enable attendance / access events → paste URL → POST JSON.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Setup checklist</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="list-decimal pl-4 space-y-2 text-sm text-muted-foreground">
              <li>Register device with vendor <strong>hikvision</strong> and model (e.g. DS-K1T671M).</li>
              <li>Set IP, door/gate, and link to an attendance location.</li>
              <li>Enable HTTP host notification for Access Controller events.</li>
              <li>Map <code className="text-xs">employeeNoString</code> to employees via User mapping.</li>
              <li>Test face/card punch → Live attendance + Punch queue.</li>
            </ol>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Sample ISAPI JSON</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="rounded-lg border bg-muted/30 p-3 text-xs overflow-x-auto">{`{
  "ipAddress": "192.168.1.64",
  "dateTime": "2026-07-29T08:05:11+03:00",
  "deviceID": "DS-K1T671M-ABC",
  "AccessControllerEvent": {
    "deviceName": "Staff Entrance",
    "employeeNoString": "1001",
    "cardNo": "",
    "time": "2026-07-29T08:05:11+03:00",
    "attendanceStatus": "checkIn",
    "currentVerifyMode": "face",
    "serialNo": 44291
  }
}`}</pre>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
