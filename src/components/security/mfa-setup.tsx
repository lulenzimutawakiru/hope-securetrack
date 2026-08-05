"use client";

/**
 * TOTP MFA enrollment + management UI (Supabase Auth factors).
 */

import { useCallback, useEffect, useState } from "react";
import {
  Fingerprint,
  Loader2,
  ShieldCheck,
  ShieldOff,
  Smartphone,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LoadingState } from "@/components/ui/loading-state";

type Factor = {
  id: string;
  friendly_name: string | null;
  factor_type: string;
  status: string;
};

type MfaStatus = {
  aal: { currentLevel: string | null; nextLevel: string | null };
  factors: Factor[];
  hasVerifiedFactor: boolean;
  aal2: boolean;
  profile: {
    mfa_enabled: boolean;
    require_mfa: boolean;
    mfa_enforced: boolean;
  };
  privilegedRole: boolean;
  enforcementEnabled: boolean;
};

type EnrollData = {
  factor_id: string;
  totp: { qr_code: string | null; secret: string | null; uri: string | null };
};

export function MfaSetupPanel() {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<MfaStatus | null>(null);
  const [enroll, setEnroll] = useState<EnrollData | null>(null);
  const [code, setCode] = useState("");
  const [requireOnAccount, setRequireOnAccount] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/mfa/status");
      const json = await res.json();
      if (!res.ok || json?.ok === false) {
        throw new Error(json?.error?.message || "Failed to load MFA status");
      }
      setStatus(json.data ?? json);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "MFA status failed");
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const startEnroll = async () => {
    setBusy(true);
    setCode("");
    try {
      const res = await fetch("/api/auth/mfa/enroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ friendly_name: "Authenticator app" }),
      });
      const json = await res.json();
      if (!res.ok || json?.ok === false) {
        throw new Error(json?.error?.message || "Enrollment failed");
      }
      setEnroll(json.data);
      toast.message("Scan the QR code, then enter a 6-digit code");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Enrollment failed");
    } finally {
      setBusy(false);
    }
  };

  const confirmEnroll = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!enroll?.factor_id) return;
    setBusy(true);
    try {
      const res = await fetch("/api/auth/mfa/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "enroll",
          factor_id: enroll.factor_id,
          code: code.trim(),
          require_mfa: requireOnAccount,
        }),
      });
      const json = await res.json();
      if (!res.ok || json?.ok === false) {
        throw new Error(json?.error?.message || "Invalid code");
      }
      toast.success("MFA enabled");
      setEnroll(null);
      setCode("");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Verification failed");
    } finally {
      setBusy(false);
    }
  };

  const removeFactor = async (factorId: string) => {
    const c = window.prompt(
      "Enter a current authenticator code to remove this factor (or leave blank if already AAL2):"
    );
    setBusy(true);
    try {
      const res = await fetch("/api/auth/mfa/unenroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          factor_id: factorId,
          code: c?.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok || json?.ok === false) {
        throw new Error(json?.error?.message || "Could not remove factor");
      }
      toast.success("Authenticator removed");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Remove failed");
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <LoadingState message="Loading MFA…" />;

  const qr = enroll?.totp?.qr_code;
  const secret = enroll?.totp?.secret;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Fingerprint className="h-4 w-4" />
            Multi-factor authentication
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex flex-wrap gap-2">
            <Badge variant={status?.aal2 ? "secondary" : "outline"}>
              Session: {status?.aal.currentLevel || "aal1"}
              {status?.aal2 ? " (verified)" : ""}
            </Badge>
            <Badge variant={status?.hasVerifiedFactor ? "secondary" : "outline"}>
              {status?.hasVerifiedFactor
                ? `${status.factors.length} authenticator(s)`
                : "Not enrolled"}
            </Badge>
            {status?.privilegedRole && (
              <Badge variant="outline" className="border-amber-500/50 text-amber-800 dark:text-amber-200">
                Privileged role
                {status.enforcementEnabled ? " · MFA required" : ""}
              </Badge>
            )}
          </div>
          <p className="text-muted-foreground text-xs">
            Use an authenticator app (Google Authenticator, Authy, 1Password,
            Microsoft Authenticator). After enrollment, every sign-in asks for a
            6-digit code.
          </p>

          {status?.factors?.length ? (
            <ul className="space-y-2">
              {status.factors.map((f) => (
                <li
                  key={f.id}
                  className="flex items-center justify-between gap-2 rounded-md border px-3 py-2"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Smartphone className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0">
                      <p className="font-medium truncate">
                        {f.friendly_name || "Authenticator"}
                      </p>
                      <p className="text-[11px] text-muted-foreground font-mono truncate">
                        {f.factor_type} · {f.status}
                      </p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={busy}
                    onClick={() => removeFactor(f.id)}
                    aria-label="Remove authenticator"
                  >
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <ShieldOff className="h-3.5 w-3.5" /> No authenticators enrolled
            </p>
          )}

          {!enroll && (
            <Button size="sm" onClick={startEnroll} disabled={busy}>
              {busy ? (
                <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
              ) : (
                <ShieldCheck className="h-3.5 w-3.5 mr-1" />
              )}
              {status?.hasVerifiedFactor
                ? "Add another authenticator"
                : "Set up authenticator"}
            </Button>
          )}
        </CardContent>
      </Card>

      {enroll && (
        <Card className="border-primary/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Complete enrollment</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={confirmEnroll} className="space-y-4">
              {qr ? (
                <div className="flex flex-col sm:flex-row gap-4 items-start">
                  <div className="rounded-lg border bg-white p-2 shrink-0">
                    {/* Supabase returns data:image/svg+xml;utf-8,... */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={qr}
                      alt="MFA QR code"
                      className="h-40 w-40 object-contain"
                    />
                  </div>
                  <div className="text-xs text-muted-foreground space-y-2">
                    <p>
                      1. Open your authenticator app and scan this QR code.
                    </p>
                    <p>2. Enter the 6-digit code below to confirm.</p>
                    {secret ? (
                      <p className="font-mono break-all text-[11px]">
                        Manual key: <strong>{secret}</strong>
                      </p>
                    ) : null}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-destructive">
                  QR code unavailable. Use the secret if shown, or retry enrollment.
                </p>
              )}

              <div>
                <Label htmlFor="mfa-enroll-code">Authentication code</Label>
                <Input
                  id="mfa-enroll-code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="123456"
                  maxLength={12}
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  required
                  className="max-w-xs font-mono tracking-widest"
                />
              </div>

              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  checked={requireOnAccount}
                  onChange={(e) => setRequireOnAccount(e.target.checked)}
                />
                Require MFA for this account (recommended for privileged roles)
              </label>

              <div className="flex gap-2">
                <Button type="submit" disabled={busy || code.trim().length < 6}>
                  {busy ? (
                    <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                  ) : null}
                  Verify & enable
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy}
                  onClick={() => {
                    setEnroll(null);
                    setCode("");
                  }}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
