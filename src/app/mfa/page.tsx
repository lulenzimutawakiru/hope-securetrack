"use client";

/**
 * Login step-up MFA challenge (AAL1 → AAL2).
 * Session cookie already exists after password auth; user must verify TOTP.
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, Shield, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";
import { safeInternalPath } from "@/lib/security/shared";

type Factor = { id: string; friendly_name: string | null };

export default function MfaChallengePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [factors, setFactors] = useState<Factor[]>([]);
  const [factorId, setFactorId] = useState<string>("");
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [nextPath, setNextPath] = useState("/dashboard");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setNextPath(safeInternalPath(params.get("next"), "/dashboard"));

    async function init() {
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          router.replace("/login");
          return;
        }

        // Already AAL2 — continue
        const { data: aal } =
          await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
        if (aal?.currentLevel === "aal2") {
          router.replace(safeInternalPath(params.get("next"), "/dashboard"));
          return;
        }

        const res = await fetch("/api/auth/mfa/status");
        const json = await res.json();
        const data = json?.data ?? json;
        const list: Factor[] = (data?.factors || []).map(
          (f: { id: string; friendly_name: string | null }) => ({
            id: f.id,
            friendly_name: f.friendly_name,
          })
        );

        if (!list.length) {
          // No factors — privileged users should enroll; others go through
          toast.message("No authenticator enrolled. You can set one up next.");
          router.replace("/dashboard/identity/self-service");
          return;
        }

        setFactors(list);
        setFactorId(list[0].id);

        const ch = await fetch("/api/auth/mfa/challenge", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ factor_id: list[0].id }),
        });
        const chJson = await ch.json();
        if (ch.ok && chJson?.data?.challenge_id) {
          setChallengeId(chJson.data.challenge_id);
        }
      } catch {
        toast.error("Could not start MFA challenge");
      } finally {
        setLoading(false);
      }
    }
    init();
  }, [router]);

  const verify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!factorId || code.trim().length < 6) return;
    setBusy(true);
    try {
      const res = await fetch("/api/auth/mfa/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "login",
          factor_id: factorId,
          challenge_id: challengeId || undefined,
          code: code.trim(),
        }),
      });
      const json = await res.json();
      if (!res.ok || json?.ok === false) {
        // Refresh challenge for next attempt
        try {
          const ch = await fetch("/api/auth/mfa/challenge", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ factor_id: factorId }),
          });
          const chJson = await ch.json();
          if (ch.ok) setChallengeId(chJson?.data?.challenge_id || null);
        } catch {
          /* ignore */
        }
        throw new Error(json?.error?.message || "Invalid code");
      }
      toast.success("Verified");
      router.replace(nextPath);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Verification failed");
    } finally {
      setBusy(false);
    }
  };

  const signOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/login");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-hope-navy to-hope-teal p-6">
        <Loader2 className="h-8 w-8 animate-spin text-hope-gold" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-hope-navy to-hope-teal p-6">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-3">
            <Shield className="h-10 w-10 text-hope-gold" />
          </div>
          <CardTitle className="text-2xl">Two-step verification</CardTitle>
          <CardDescription>
            Enter the code from your authenticator app to continue
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={verify} className="space-y-4">
            {factors.length > 1 && (
              <div>
                <Label>Authenticator</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={factorId}
                  onChange={async (e) => {
                    const id = e.target.value;
                    setFactorId(id);
                    setCode("");
                    try {
                      const ch = await fetch("/api/auth/mfa/challenge", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ factor_id: id }),
                      });
                      const chJson = await ch.json();
                      if (ch.ok) {
                        setChallengeId(chJson?.data?.challenge_id || null);
                      }
                    } catch {
                      /* ignore */
                    }
                  }}
                >
                  {factors.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.friendly_name || "Authenticator"}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <Label htmlFor="mfa-code" className="flex items-center gap-1">
                <Smartphone className="h-3.5 w-3.5" />
                Authentication code
              </Label>
              <Input
                id="mfa-code"
                inputMode="numeric"
                autoComplete="one-time-code"
                autoFocus
                placeholder="123456"
                maxLength={12}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                required
                className="font-mono tracking-widest text-lg"
              />
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={busy || code.trim().length < 6}
            >
              {busy ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Verifying…
                </>
              ) : (
                "Verify and continue"
              )}
            </Button>

            <div className="flex justify-between text-xs text-muted-foreground">
              <button
                type="button"
                className="underline"
                onClick={signOut}
              >
                Sign out
              </button>
              <Link href="/dashboard/identity/self-service" className="underline">
                Lost authenticator?
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
