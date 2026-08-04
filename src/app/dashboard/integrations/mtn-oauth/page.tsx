"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Key, Loader2, RefreshCw } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

type HistoryRow = {
  id: string;
  transaction_id: string | null;
  http_status: number | null;
  status_code: string | null;
  success: boolean;
  token_hash: string | null;
  expires_at: string | null;
  issued_at: string | null;
  client_id: string | null;
  error_message: string | null;
  created_at: string;
};

type Status = {
  configured: boolean;
  sandbox: boolean;
  base_url: string;
  grant_type: string;
  token_endpoint: string;
  history: HistoryRow[];
};

export default function MtnOauthPage() {
  return (
    <PermissionGate
      anyOf={[
        "intg.view",
        "intg.manage",
        "crm.view",
        "crm.manage",
        "settings.integrations",
      ]}
    >
      <MtnOauthInner />
    </PermissionGate>
  );
}

function MtnOauthInner() {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<Status | null>(null);
  const [transactionId, setTransactionId] = useState("");
  const [resultJson, setResultJson] = useState<string>("");

  const load = useCallback(async () => {
    setLoading(true);
    const res = await apiGet<Status>("/api/v2/integrations/mtn-oauth");
    if (res.ok) {
      setStatus(res.data);
    } else toast.error(res.error);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function requestToken() {
    setBusy(true);
    setResultJson("");
    const res = await apiPost<Record<string, unknown>>(
      "/api/v2/integrations/mtn-oauth",
      { mode: "token", transaction_id: transactionId.trim() || undefined }
    );
    if (res.ok) {
      setResultJson(JSON.stringify(res.data, null, 2));
      toast.success("Access token requested");
      void load();
    } else {
      toast.error(res.error);
    }
    setBusy(false);
  }

  if (loading) return <LoadingState message="Loading MTN MADAPI OAuth…" />;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Link href="/dashboard/integrations" className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <PageHeader
          title="MTN MADAPI OAuth2"
          description="Access token (client_credentials) for MADAPI products · never stores the raw token"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Credentials</span>
              {status?.configured ? (
                <Badge variant="default">Configured</Badge>
              ) : (
                <Badge variant="destructive">Missing</Badge>
              )}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Mode</span>
              {status?.sandbox ? (
                <Badge variant="secondary">Sandbox</Badge>
              ) : (
                <Badge variant="default">Live</Badge>
              )}
            </div>
            <div>
              <span className="text-muted-foreground">Base URL</span>
              <p className="font-mono text-[11px] break-all">{status?.base_url}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Grant</span>
              <p className="font-mono text-[11px]">{status?.grant_type}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Token endpoint</span>
              <p className="font-mono text-[11px] break-all">{status?.token_endpoint}</p>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Env: <code>MTN_OAUTH_CLIENT_ID</code> · <code>MTN_OAUTH_CLIENT_SECRET</code> ·
              <code>MTN_OAUTH_SANDBOX</code>
            </p>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Request access token</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="txn">transactionId (optional)</Label>
              <Input
                id="txn"
                value={transactionId}
                onChange={(e) => setTransactionId(e.target.value)}
                placeholder="Auto-generated when empty"
              />
            </div>
            <Button size="sm" disabled={busy} onClick={() => void requestToken()}>
              {busy ? (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-1 h-4 w-4" />
              )}
              Request / refresh token
            </Button>
            <p className="text-[11px] text-muted-foreground">
              POST <code>{status?.token_endpoint}</code> with grant_type=
              <code>client_credentials</code>. The bearer token is cached in memory and shared
              with MADAPI products (e.g. MTN KYC) — the raw token is never returned or stored.
            </p>
            {resultJson && (
              <pre className="max-h-60 overflow-auto rounded-md border bg-muted/40 p-3 text-[11px]">
                {resultJson}
              </pre>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Token request history</CardTitle>
        </CardHeader>
        <CardContent>
          {!status?.history?.length ? (
            <p className="text-sm text-muted-foreground">
              No token requests yet — run a request to populate the audit trail.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Txn</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead>Client ID</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {status.history.map((h) => (
                  <TableRow key={h.id}>
                    <TableCell className="text-xs whitespace-nowrap">
                      {new Date(h.created_at).toLocaleString()}
                    </TableCell>
                    <TableCell className="font-mono text-[10px] max-w-[120px] truncate">
                      {h.transaction_id || "—"}
                    </TableCell>
                    <TableCell>
                      {h.success ? (
                        <Badge variant="default">OK</Badge>
                      ) : (
                        <Badge variant="destructive">Fail</Badge>
                      )}
                      <span className="ml-1 text-[10px] text-muted-foreground">
                        {h.status_code || h.http_status || ""}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs whitespace-nowrap">
                      {h.expires_at ? new Date(h.expires_at).toLocaleString() : "—"}
                    </TableCell>
                    <TableCell className="font-mono text-[10px] max-w-[160px] truncate">
                      {h.client_id || "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}