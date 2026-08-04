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
  endpoints: Record<string, string>;
  history: HistoryRow[];
};

type Mode =
  | "get"
  | "post"
  | "check"
  | "verify"
  | "score"
  | "name_score"
  | "address_score"
  | "biometric"
  | "identity";

const MODES: { value: Mode; label: string; hint: string }[] = [
  { value: "get", label: "BVN / MSISDN lookup", hint: "GET /customers" },
  { value: "check", label: "MSISDN active check", hint: "GET /customers/{id}" },
  { value: "verify", label: "Verify single customer", hint: "POST /customers/{id}" },
  { value: "post", label: "Customers (POST)", hint: "POST /customers" },
  { value: "score", label: "KYC score", hint: "POST /customers/{id}/kycScore" },
  { value: "name_score", label: "Name score", hint: "POST /customers/{id}/nameScore" },
  { value: "address_score", label: "Address score", hint: "POST /customers/{id}/addressScore" },
  { value: "biometric", label: "Biometric verify", hint: "POST /customers/{id}/biometric/verify" },
  { value: "identity", label: "Identity status", hint: "POST /biometric-roc/customers/identityStatus" },
];

const VERIFY_TYPES = ["", "BANK", "HASHCODE", "EVALIDATOR", "WinBack", "VALENTINE_PROMO"];
const REQUEST_TYPES = ["", "FACE_MATCH", "FINGERPRINT", "BVN", "MSISDN"];

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

  const [mode, setMode] = useState<Mode>("get");
  const [targetSystem, setTargetSystem] = useState("NIBSS");
  const [bvnList, setBvnList] = useState("");
  const [msisdnList, setMsisdnList] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [verificationType, setVerificationType] = useState("");
  const [requestType, setRequestType] = useState("");
  const [isConsent, setIsConsent] = useState(true);
  const [jsonPayload, setJsonPayload] = useState("");
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

  useEffect(() => {
    setResultJson("");
    if (mode === "verify") {
      setJsonPayload(
        JSON.stringify(
          { firstName: "Joe", lastName: "Doe", otherNames: "", dateOfBirth: "1980-02-14", gender: "M" },
          null,
          2
        )
      );
    } else if (mode === "post") {
      setJsonPayload(
        JSON.stringify(
          [{ msisdn: "2348012345678", firstName: "Joe", lastName: "Doe" }],
          null,
          2
        )
      );
    } else if (mode === "score" || mode === "name_score" || mode === "address_score") {
      setJsonPayload(
        JSON.stringify(
          mode === "name_score"
            ? { firstName: "Joe", lastName: "Doe", phoneNumber: "2348012345678" }
            : mode === "address_score"
              ? { phoneNumber: "2348012345678", streetAddress: "1st Park Avenue", city: "Johannesburg", country: "South Africa" }
              : { firstName: "Joe", lastName: "Doe", phoneNumber: "2348012345678", emailAddress: "joe@example.com" },
          null,
          2
        )
      );
    } else if (mode === "biometric") {
      setJsonPayload(
        JSON.stringify(
          { binaryAttachment: [{ id: "nist_impression_type_10", attachmentType: "picture", content: "<base64>", mimeType: "image/jpeg", name: "face_image" }] },
          null,
          2
        )
      );
    } else {
      setJsonPayload("");
    }
  }, [mode]);

  const verify = async () => {
    setBusy(true);
    setResultJson("");
    try {
      let body: Record<string, unknown> = {
        mode,
        target_system: targetSystem,
      };
      try {
        if (jsonPayload.trim()) body = { ...body, ...JSON.parse(jsonPayload) };
      } catch {
        toast.error("Payload is not valid JSON");
        setBusy(false);
        return;
      }

      switch (mode) {
        case "get":
          body = { ...body, bvn_list: bvnList, msisdn_list: msisdnList };
          break;
        case "post":
          body = {
            ...body,
            customers: JSON.parse(jsonPayload || "[]"),
            request_type: requestType || undefined,
            verification_type: verificationType || undefined,
          };
          break;
        case "check":
          body = {
            ...body,
            customer_id: customerId,
            verification_type: verificationType || undefined,
          };
          break;
        case "verify":
          body = {
            ...body,
            customer_id: customerId,
            is_consent_verified: isConsent,
            customer: JSON.parse(jsonPayload || "{}"),
          };
          break;
        case "score":
        case "name_score":
        case "address_score":
          body = { ...body, customer_id: customerId, score_body: JSON.parse(jsonPayload || "{}") };
          break;
        case "biometric":
          body = {
            ...body,
            customer_id: customerId,
            request_type: requestType || undefined,
            verification_type: verificationType || undefined,
            biometric_body: JSON.parse(jsonPayload || "{}"),
          };
          break;
        case "identity":
          body = {
            ...body,
            identity_body: {
              customer_id: customerId,
              agent_id: (JSON.parse(jsonPayload || "{}") as { agent_id?: string }).agent_id,
              channel_id: (JSON.parse(jsonPayload || "{}") as { channel_id?: string }).channel_id,
            },
          };
          break;
      }

      const res = await apiPost<{
        transaction_id: string;
        audit_id?: string | null;
        sandbox?: boolean;
        method?: string;
        http_status?: number;
        madapi_code?: string;
        data: unknown;
      }>("/api/v2/integrations/mtn-kyc", body);
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
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Verification failed");
      setResultJson(JSON.stringify({ error: String(e) }, null, 2));
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <LoadingState message="Loading MTN KYC..." />;

  const current = MODES.find((m) => m.value === mode);

  return (
    <div>
      <PageHeader
        title="MTN Customer KYC Verification"
        description="Validate customer KYC against MTN MADAPI. API v1.0.2 - api.mtn.com"
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
          {current?.hint}
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
              <Label htmlFor="mode">Endpoint</Label>
              <Select value={mode} onValueChange={(v) => setMode(v as Mode)}>
                <SelectTrigger id="mode" className="w-full">
                  <SelectValue placeholder="Select endpoint" />
                </SelectTrigger>
                <SelectContent>
                  {MODES.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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

            {(mode === "get") && (
              <>
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
              </>
            )}

            {(mode === "check" || mode === "verify" || mode === "score" || mode === "name_score" || mode === "address_score" || mode === "biometric") && (
              <div className="space-y-1.5">
                <Label htmlFor="customerId">Customer ID (MSISDN / email)</Label>
                <Input
                  id="customerId"
                  value={customerId}
                  onChange={(e) => setCustomerId(e.target.value)}
                  placeholder="2348064816499"
                />
              </div>
            )}

            {(mode === "check" || mode === "post" || mode === "biometric") && (
              <div className="space-y-1.5">
                <Label htmlFor="verificationType">verificationType (optional)</Label>
                <Select value={verificationType} onValueChange={setVerificationType}>
                  <SelectTrigger id="verificationType" className="w-full">
                    <SelectValue placeholder="Select verification type" />
                  </SelectTrigger>
                  <SelectContent>
                    {VERIFY_TYPES.map((v) => (
                      <SelectItem key={v || "none"} value={v}>
                        {v || "Default"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {(mode === "post" || mode === "biometric") && (
              <div className="space-y-1.5">
                <Label htmlFor="requestType">requestType (NIBSS, optional)</Label>
                <Select value={requestType} onValueChange={setRequestType}>
                  <SelectTrigger id="requestType" className="w-full">
                    <SelectValue placeholder="Select request type" />
                  </SelectTrigger>
                  <SelectContent>
                    {REQUEST_TYPES.map((v) => (
                      <SelectItem key={v || "none"} value={v}>
                        {v || "Default"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {mode === "verify" && (
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={isConsent}
                  onChange={(e) => setIsConsent(e.target.checked)}
                  className="h-4 w-4"
                />
                isConsentVerified = true (partner has acquired consent)
              </label>
            )}

            {(mode === "post" || mode === "verify" || mode === "score" || mode === "name_score" || mode === "address_score" || mode === "biometric") && (
              <div className="space-y-1.5">
                <Label htmlFor="payload">JSON payload</Label>
                <Textarea
                  id="payload"
                  rows={6}
                  className="font-mono text-[11px]"
                  value={jsonPayload}
                  onChange={(e) => setJsonPayload(e.target.value)}
                />
              </div>
            )}

            <Button
              size="sm"
              disabled={busy}
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
              <code>transactionId</code>, <code>targetSystem</code>.
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