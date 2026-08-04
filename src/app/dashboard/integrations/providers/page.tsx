"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Plug,
  RefreshCw,
  Loader2,
  CheckCircle2,
  AlertCircle,
  FlaskConical,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LoadingState } from "@/components/ui/loading-state";
import { PermissionGate } from "@/components/security/permission-gate";
import { apiGet, apiPost } from "@/lib/api-client";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type ProviderStatus = {
  code: string;
  label: string;
  category: string;
  configured: boolean;
  sandbox: boolean;
  notes?: string;
};

type Summary = {
  total: number;
  configured: number;
  sandbox_mode: boolean;
  providers: ProviderStatus[];
  recent_calls?: Array<{
    id: string;
    provider: string;
    operation: string;
    success: boolean;
    sandbox: boolean;
    error_message: string | null;
    created_at: string;
  }>;
  webhook_paths?: Record<string, string>;
};

const CATEGORIES = [
  "payments",
  "comms",
  "maps",
  "jobs",
  "security",
  "docs",
  "siem",
] as const;

export default function ProvidersHubPage() {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [testAction, setTestAction] = useState("sms");
  const [testTo, setTestTo] = useState("");
  const [testMessage, setTestMessage] = useState("SecureTrack integration test");
  const [testGateway, setTestGateway] = useState("MTN");
  const [testing, setTesting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiGet<Summary>("/api/v2/integrations/providers");
      if (res.ok && res.data) {
        setSummary(res.data as Summary);
      } else if (!res.ok) {
        toast.error(res.error || "Failed to load providers");
      } else {
        toast.error("Failed to load providers");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Load failed");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function runTest() {
    setTesting(true);
    try {
      const body: Record<string, unknown> = {
        action: testAction,
        to: testTo || undefined,
        message: testMessage || undefined,
        gateway: testGateway,
        amount: 1000,
        currency: "UGX",
        query: "Kampala Uganda",
      };
      const res = await apiPost("/api/v2/integrations/providers", body);
      if (res.ok) {
        toast.success("Provider test succeeded (sandbox or live)");
        await load();
      } else {
        toast.error(res.error || "Test failed");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Test failed");
    } finally {
      setTesting(false);
    }
  }

  if (loading && !summary) {
    return <LoadingState message="Loading external providers…" />;
  }

  return (
    <PermissionGate
      anyOf={["intg.view", "intg.manage", "settings.integrations"]}
      fallback={
        <div className="p-6 text-sm text-muted-foreground">
          You need integration permissions to view providers.
        </div>
      }
    >
      <div className="space-y-6">
        <PageHeader
          title="External Providers"
          description="Payments · SMS · WhatsApp · Push · Maps · CAPTCHA · OCR · QStash — live config from environment"
          actions={
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="outline" size="sm">
                <Link href="/dashboard/integrations">
                  <ArrowLeft className="mr-1 h-4 w-4" />
                  Hub
                </Link>
              </Button>
              <Button variant="outline" size="sm" onClick={load} disabled={loading}>
                <RefreshCw className={`mr-1 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                Refresh
              </Button>
            </div>
          }
        />

        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Providers
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold">{summary?.total ?? 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Configured
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold text-emerald-600">
                {summary?.configured ?? 0}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Mode
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Badge variant={summary?.sandbox_mode ? "secondary" : "default"}>
                {summary?.sandbox_mode ? "Sandbox preferred" : "Production"}
              </Badge>
            </CardContent>
          </Card>
        </div>

        {CATEGORIES.map((cat) => {
          const items = (summary?.providers || []).filter((p) => p.category === cat);
          if (!items.length) return null;
          return (
            <Card key={cat}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 capitalize">
                  <Plug className="h-4 w-4" />
                  {cat}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {items.map((p) => (
                    <div
                      key={p.code}
                      className="flex items-start justify-between rounded-lg border p-3"
                    >
                      <div>
                        <div className="font-medium">{p.label}</div>
                        <div className="text-xs text-muted-foreground">{p.code}</div>
                        {p.notes ? (
                          <div className="mt-1 text-xs text-muted-foreground">{p.notes}</div>
                        ) : null}
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        {p.configured ? (
                          <Badge className="bg-emerald-600 hover:bg-emerald-600">
                            <CheckCircle2 className="mr-1 h-3 w-3" />
                            Live keys
                          </Badge>
                        ) : (
                          <Badge variant="outline">
                            <AlertCircle className="mr-1 h-3 w-3" />
                            Env missing
                          </Badge>
                        )}
                        {p.sandbox ? (
                          <Badge variant="secondary">Sandbox</Badge>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        })}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FlaskConical className="h-4 w-4" />
              Run test
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <Label>Action</Label>
              <Select value={testAction} onValueChange={setTestAction}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sms">SMS (Africa&apos;s Talking)</SelectItem>
                  <SelectItem value="whatsapp">WhatsApp</SelectItem>
                  <SelectItem value="push">Push</SelectItem>
                  <SelectItem value="payment">Payment collect</SelectItem>
                  <SelectItem value="geocode">Mapbox geocode</SelectItem>
                  <SelectItem value="directions">Mapbox directions</SelectItem>
                  <SelectItem value="ocr">Document OCR</SelectItem>
                  <SelectItem value="qstash">QStash worker ping</SelectItem>
                  <SelectItem value="captcha">CAPTCHA verify</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Phone / recipient</Label>
              <Input
                placeholder="+2567…"
                value={testTo}
                onChange={(e) => setTestTo(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Message / gateway</Label>
              <Input
                value={testMessage}
                onChange={(e) => setTestMessage(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Payment gateway</Label>
              <Select value={testGateway} onValueChange={setTestGateway}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MTN">MTN MoMo</SelectItem>
                  <SelectItem value="AIRTEL">Airtel Money</SelectItem>
                  <SelectItem value="FLW">Flutterwave</SelectItem>
                  <SelectItem value="PESAPAL">Pesapal</SelectItem>
                  <SelectItem value="STRIPE">Stripe</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-2 lg:col-span-4">
              <Button onClick={runTest} disabled={testing}>
                {testing ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <FlaskConical className="mr-2 h-4 w-4" />
                )}
                Execute test
              </Button>
            </div>
          </CardContent>
        </Card>

        {summary?.webhook_paths ? (
          <Card>
            <CardHeader>
              <CardTitle>Webhook endpoints</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Provider</TableHead>
                    <TableHead>Path</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Object.entries(summary.webhook_paths).map(([k, v]) => (
                    <TableRow key={k}>
                      <TableCell className="font-mono text-sm">{k}</TableCell>
                      <TableCell className="font-mono text-xs">{v}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ) : null}

        {(summary?.recent_calls || []).length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>Recent provider calls</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>When</TableHead>
                    <TableHead>Provider</TableHead>
                    <TableHead>Op</TableHead>
                    <TableHead>Result</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(summary?.recent_calls || []).map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="text-xs">
                        {new Date(r.created_at).toLocaleString()}
                      </TableCell>
                      <TableCell>{r.provider}</TableCell>
                      <TableCell>{r.operation}</TableCell>
                      <TableCell>
                        {r.success ? (
                          <Badge className="bg-emerald-600">
                            {r.sandbox ? "ok (sandbox)" : "ok"}
                          </Badge>
                        ) : (
                          <Badge variant="destructive">
                            {r.error_message || "failed"}
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </PermissionGate>
  );
}
