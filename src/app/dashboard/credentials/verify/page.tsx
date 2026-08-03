"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { ScanLine, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LoadingState } from "@/components/ui/loading-state";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/hooks/use-user";
import { toast } from "sonner";
import { verifyByPublicId, decodeIdentityQrToken } from "@/lib/workforce-id";

function VerifyInner() {
  const { auth } = useUser();
  const sp = useSearchParams();
  const [pid, setPid] = useState(sp.get("pid") || "");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    result: string;
    credential: Record<string, unknown> | null;
  } | null>(null);

  const run = async (publicId?: string) => {
    const raw = (publicId || pid).trim();
    if (!raw) {
      toast.error("Enter QR public ID or paste token");
      return;
    }
    setLoading(true);
    try {
      let lookup = raw;
      // Accept full verify URL
      try {
        if (raw.includes("pid=")) {
          const u = new URL(raw, window.location.origin);
          lookup = u.searchParams.get("pid") || raw;
        }
      } catch {
        /* ignore */
      }
      // Accept encoded token
      if (lookup.length > 40 && !lookup.startsWith("WID-")) {
        const decoded = decodeIdentityQrToken(lookup);
        if (decoded?.pid) lookup = decoded.pid;
      }

      const supabase = createClient();
      const res = await verifyByPublicId(supabase, lookup, {
        company_id: auth?.profile?.company_id,
        scanned_by: auth?.profile?.id,
        scanner_context: "credentials_verify",
        location_name: "Dashboard",
      });
      setResult(res as typeof result);
      setPid(lookup);
      if (res.result === "valid") toast.success("Identity verified");
      else toast.error(`Verification: ${res.result}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Verify failed");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const initial = sp.get("pid");
    if (initial) run(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cred = result?.credential as {
    status?: string;
    credential_number?: string;
    qr_public_id?: string;
    access_profile_code?: string;
    expiry_date?: string;
    rfid_uid?: string;
    wid_identities?: {
      full_name?: string;
      identity_number?: string;
      department?: string;
      job_title?: string;
      status?: string;
      security_clearance?: string;
    };
  } | null;

  const identity = cred?.wid_identities;
  const ok = result?.result === "valid";

  return (
    <div>
      <PageHeader
        title="QR Digital Identity Verification"
        description="Encrypted token · expiry · status · anti-copy · real-time audit"
      />

      <Card className="max-w-xl mb-6">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ScanLine className="h-4 w-4" /> Scan or enter ID
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label>QR public ID, verify URL, or token</Label>
            <Input
              value={pid}
              onChange={(e) => setPid(e.target.value)}
              placeholder="WID-XXXXXXXX or paste scanned content"
              onKeyDown={(e) => e.key === "Enter" && run()}
            />
          </div>
          <Button onClick={() => run()} disabled={loading}>
            {loading ? "Verifying…" : "Verify identity"}
          </Button>
        </CardContent>
      </Card>

      {result && (
        <Card className={`max-w-xl border-2 ${ok ? "border-teal-600" : "border-red-400"}`}>
          <CardHeader>
            <div className="flex items-center gap-2">
              {ok ? (
                <CheckCircle2 className="h-6 w-6 text-teal-600" />
              ) : result.result === "expired" || result.result === "suspended" ? (
                <AlertTriangle className="h-6 w-6 text-amber-500" />
              ) : (
                <XCircle className="h-6 w-6 text-red-500" />
              )}
              <CardTitle>SECURETRACK GROUP LTD</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="text-xs text-muted-foreground">Employee</p>
                <p className="font-semibold text-lg">{identity?.full_name || "—"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Verified</p>
                <Badge className={ok ? "bg-teal-600" : "bg-red-600"}>{ok ? "YES" : "NO"}</Badge>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">ID</p>
                <p className="font-mono">{identity?.identity_number || "—"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Credential</p>
                <p className="font-mono text-xs">{cred?.credential_number || "—"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Department</p>
                <p>{identity?.department || "—"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Position</p>
                <p>{identity?.job_title || "—"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Status</p>
                <p className="uppercase font-semibold">{cred?.status || result.result}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Access</p>
                <p>{cred?.access_profile_code || "—"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Expiry</p>
                <p>{cred?.expiry_date || "—"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">RFID</p>
                <p className="font-mono text-xs">{cred?.rfid_uid || "—"}</p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground pt-2">
              Result code: <span className="font-mono">{result.result}</span> · logged to verification audit
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function VerifyPage() {
  return (
    <Suspense fallback={<LoadingState message="Loading verifier…" />}>
      <VerifyInner />
    </Suspense>
  );
}
