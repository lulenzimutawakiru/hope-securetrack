"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ShieldCheck,
  ArrowLeft,
  RefreshCw,
  Search,
  Loader2,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  transaction_id: string;
  target_system: string | null;
  identifier_kind: string;
  identifiers: string[];
  success: boolean;
  status_code: string | null;
  http_status: number | null;
  error_message: string | null;
  created_at: string;
};

type Status = {
  configured: boolean;
  sandbox: boolean;
  base_url: string;
  default_target_system: string;
  history: HistoryRow[];
};

export default function MtnKycPage() {
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
      <MtnKycInner />
    </PermissionGate>
  );
}

function MtnKycInner() {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<Status | null>(null);
  const [bvnList, setBvnList] = useState("");
  const [msisdnList, setMsisdnList] = useState("");
  const [targetSystem, setTargetSystem] = useState("NIBSS");
  const [resultJson, setResultJson] = useState<string>("");

  const load = useCallback(async () => {
    setLoading(true);
    const res = await apiGet<Status>("/api/v2/integrations/mtn-kyc");
    if (res.ok) {
      setStatus(res.data);
      if (res.data.default_target_system) {
        setTargetSystem(res.data.default_target_system);
      }
    } else toast.error(res.error);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const verify = async () => {
    setBusy(true);
    setResultJson("");
    try {
      const res = await apiPost<{
        transaction_id: string;
        sandbox?: boolean;
        data: unknown;
      }>("/api/v2/integrations/mtn-kyc", {
        bvn_list: bvnList,
        msisdn_list: msisdnList,
        target_system: targetSystem,
      });
      if (!res.ok) {
        toast.error(res.error);
        setResultJson(JSON.stringify(res.details || { error: res.error }, null, 2));
      } else {
        toast.success(
          res.data.sandbox
            ? "Sandbox verification OK"
            : "KYC verification completed"
        );
        setResultJson(JSON.stringify(res.data, null, 2));
        void load();
      }
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <LoadingState message="Loading MTN KYC…" />;

  return (
    <div>
      <PageHeader
        title="MTN Customer KYC Verification"
        description="Validate customer KYC against MTN MADAPI (MSISDN / BVN). API v1.0.2 · api.mtn.com"
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm" variant="outline">
              <Link href="/dashboard/integrations">
                <ArrowLeft className="mr-1 h-4 w-4" /> Integrations
              </Link>
            </Button>
            <Button size="sm" variant="outline" onClick={() => void load()}>
              <RefreshCw className="mr-1 h-4 w-4" /> Refresh
            </Button>
          </div>
        }
      />

      <div className="mb-4 flex flex-wrap gap-2 text-sm">
        {status?.configured ? (
          <Badge>Live credentials configured</Badge>
        ) : status?.sandbox ? (
          <Badge variant="secondary">Sandbox mode (no live MTN call)</Badge>
        ) : (
          <Badge variant="destructive">Not configured</Badge>
        )}
        <span className="text-xs text-muted-foreground font-mono">
          {status?.base_url}/customers
        </span>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="h-4 w-4" /> Verify customers
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="bvns">BVNs (comma or newline separated)</Label>
              <Textarea
                id="bvns"
                rows={3}
                placeholder="BVN123455, BVN3409394"
                value={bvnList}
                onChange={(e) => setBvnList(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="msisdns">MSISDNs (optional)</Label>
              <Textarea
                id="msisdns"
                rows={2}
                placeholder="2348012345678"
                value={msisdnList}
                onChange={(e) => setMsisdnList(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="target">targetSystem header</Label>
              <Input
                id="target"
                value={targetSystem}
                onChange={(e) => setTargetSystem(e.target.value)}
                placeholder="NIBSS"
              />
            </div>
            <Button
              size="sm"
              disabled={busy || (!bvnList.trim() && !msisdnList.trim())}
              onClick={() => void verify()}
            >
              {busy ? (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              ) : (
                <Search className="mr-1 h-4 w-4" />
              )}
              Run verification
            </Button>
            <p className="text-[11px] text-muted-foreground">
              Auth: <code>X-API-Key</code> + HTTP Basic (server env). Headers:{" "}
              <code>transactionId</code>, <code>targetSystem</code>,{" "}
              <code>bvns</code>.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Response</CardTitle>
          </CardHeader>
          <CardContent>
            {resultJson ? (
              <pre className="max-h-80 overflow-auto rounded-md border bg-muted/40 p-3 text-[11px]">
                {resultJson}
              </pre>
            ) : (
              <p className="text-sm text-muted-foreground">
                Run a verification to see the MADAPI JSON payload.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="text-base">Recent verifications</CardTitle>
        </CardHeader>
        <CardContent>
          {!status?.history?.length ? (
            <p className="text-sm text-muted-foreground">No history yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Txn</TableHead>
                  <TableHead>Kind</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>IDs</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {status.history.map((h) => (
                  <TableRow key={h.id}>
                    <TableCell className="text-xs whitespace-nowrap">
                      {new Date(h.created_at).toLocaleString()}
                    </TableCell>
                    <TableCell className="font-mono text-[10px] max-w-[120px] truncate">
                      {h.transaction_id}
                    </TableCell>
                    <TableCell className="text-xs">{h.identifier_kind}</TableCell>
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
                    <TableCell className="text-[10px] max-w-[200px] truncate">
                      {(h.identifiers || []).join(", ")}
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
