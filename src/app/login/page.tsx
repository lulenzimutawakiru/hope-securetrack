"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Shield, Loader2 } from "lucide-react";
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
import { toast } from "sonner";
import { TurnstileWidget } from "@/components/security/turnstile";

type SsoProvider = {
  id: string;
  provider_code: string;
  name: string;
  protocol: string;
  mode: "oidc" | "platform_oauth";
  company_id?: string;
};

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [captchaToken, setCaptchaToken] = useState("");
  const [captchaRequired, setCaptchaRequired] = useState(false);
  const [captchaSiteKey, setCaptchaSiteKey] = useState<string | null>(null);
  const [lockMessage, setLockMessage] = useState<string | null>(null);
  const [ssoProviders, setSsoProviders] = useState<SsoProvider[]>([]);
  const [ssoLoading, setSsoLoading] = useState(false);

  useEffect(() => {
    // Surface SSO errors from callback
    const params = new URLSearchParams(window.location.search);
    const err = params.get("error");
    if (err) {
      toast.error(
        params.get("message") ||
          params.get("error_description") ||
          `SSO error: ${err}`
      );
    }

    // Load SSO options (domain from email later; initial load all platform + global)
    fetch("/api/auth/sso/providers")
      .then((r) => r.json())
      .then((json) => {
        const data = json?.data || json;
        const list: SsoProvider[] = [
          ...((data?.platform as SsoProvider[]) || []),
          ...((data?.providers as SsoProvider[]) || []),
        ];
        setSsoProviders(list);
      })
      .catch(() => undefined);
  }, []);

  // When user types email domain, try tenant-scoped providers
  useEffect(() => {
    const domain = email.includes("@") ? email.split("@")[1]?.toLowerCase() : "";
    if (!domain || domain.length < 3) return;
    const t = setTimeout(() => {
      fetch(`/api/auth/sso/providers?domain=${encodeURIComponent(domain)}`)
        .then((r) => r.json())
        .then((json) => {
          const data = json?.data || json;
          const list: SsoProvider[] = [
            ...((data?.platform as SsoProvider[]) || []),
            ...((data?.providers as SsoProvider[]) || []),
          ];
          if (list.length) setSsoProviders(list);
        })
        .catch(() => undefined);
    }, 400);
    return () => clearTimeout(t);
  }, [email]);

  const callLoginGuard = async (
    event: "check" | "fail" | "success",
    captcha?: string
  ) => {
    try {
      const res = await fetch("/api/auth/login-guard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          event,
          captcha_token: captcha || captchaToken || null,
        }),
      });
      const json = await res.json();
      return json?.data as {
        allowed?: boolean;
        reason?: string;
        captchaRequired?: boolean;
        captchaConfigured?: boolean;
        siteKey?: string | null;
        retryAfterSec?: number;
      } | null;
    } catch {
      return null;
    }
  };

  const startSso = async (p: SsoProvider) => {
    setSsoLoading(true);
    try {
      if (p.mode === "platform_oauth") {
        const supabase = createClient();
        const provider =
          p.provider_code === "azure" || p.provider_code === "entra"
            ? "azure"
            : p.provider_code === "google"
              ? "google"
              : null;
        if (!provider) {
          toast.error("Unsupported platform SSO provider");
          return;
        }
        const { error } = await supabase.auth.signInWithOAuth({
          provider,
          options: {
            redirectTo: `${window.location.origin}/dashboard`,
            scopes: provider === "azure" ? "email openid profile" : undefined,
          },
        });
        if (error) toast.error(error.message);
        return;
      }
      // Company OIDC
      const url = new URL("/api/auth/sso/start", window.location.origin);
      url.searchParams.set("provider_id", p.id);
      if (p.company_id) url.searchParams.set("company_id", p.company_id);
      url.searchParams.set("return_to", "/dashboard");
      window.location.href = url.toString();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "SSO failed");
      setSsoLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setLockMessage(null);

    try {
      const guard = await callLoginGuard("check");
      if (guard && guard.allowed === false) {
        setLockMessage(guard.reason || "Sign-in temporarily blocked");
        setCaptchaRequired(true);
        if (guard.siteKey) setCaptchaSiteKey(guard.siteKey);
        toast.error(guard.reason || "Too many attempts");
        return;
      }
      if (guard?.siteKey) setCaptchaSiteKey(guard.siteKey);
      if (guard?.captchaRequired) {
        setCaptchaRequired(true);
        if (guard.captchaConfigured && !captchaToken) {
          toast.error("Complete CAPTCHA to continue");
          return;
        }
      }

      const supabase = createClient();
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        await callLoginGuard("fail");
        try {
          await supabase.rpc("record_login_event", {
            p_user_id: null,
            p_email: email,
            p_success: false,
            p_failure_reason: error.message,
            p_ip: null,
            p_user_agent:
              typeof navigator !== "undefined" ? navigator.userAgent : null,
          });
        } catch {
          /* non-fatal */
        }
        toast.error(error.message);
        return;
      }

      await callLoginGuard("success");

      if (data.user) {
        try {
          await supabase.rpc("record_login_event", {
            p_user_id: data.user.id,
            p_email: email,
            p_success: true,
            p_failure_reason: null,
            p_ip: null,
            p_user_agent:
              typeof navigator !== "undefined" ? navigator.userAgent : null,
          });
          const { data: profile } = await supabase
            .from("user_profiles")
            .select("company_id")
            .eq("id", data.user.id)
            .maybeSingle();
          await supabase.from("user_sessions").insert({
            company_id: profile?.company_id ?? null,
            user_id: data.user.id,
            user_agent:
              typeof navigator !== "undefined" ? navigator.userAgent : null,
            device_label:
              typeof navigator !== "undefined"
                ? navigator.platform || "Web"
                : "Web",
            is_active: true,
            last_seen_at: new Date().toISOString(),
          });
        } catch {
          /* non-fatal if IAM tables not ready */
        }
      }

      toast.success("Welcome back!");
      const next = new URLSearchParams(window.location.search).get("next");
      const safe =
        next &&
        next.startsWith("/") &&
        !next.startsWith("//") &&
        !next.includes("://") &&
        !next.includes("\\") &&
        /^\/[a-zA-Z0-9/_\-?=&%.]*$/.test(next)
          ? next
          : "/dashboard";
      router.push(safe);
      router.refresh();
    } catch {
      toast.error("An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-hope-navy to-hope-teal p-6">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <Shield className="h-12 w-12 text-hope-gold" aria-hidden />
          </div>
          <CardTitle className="text-2xl">SecureTrack ERP</CardTitle>
          <CardDescription>Secure · Intelligent · Connected</CardDescription>
        </CardHeader>
        <CardContent>
          {ssoProviders.length > 0 && (
            <div className="mb-6 space-y-2">
              {ssoProviders.map((p) => (
                <Button
                  key={p.id}
                  type="button"
                  variant="outline"
                  className="w-full"
                  disabled={ssoLoading || loading}
                  onClick={() => startSso(p)}
                >
                  Continue with {p.name}
                </Button>
              ))}
              <div className="relative py-2 text-center text-xs text-muted-foreground">
                <span className="bg-card px-2 relative z-10">or email</span>
                <div className="absolute inset-x-0 top-1/2 border-t" />
              </div>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4" noValidate>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="name@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>
            <div className="text-right">
              <Link
                href="/forgot-password"
                className="text-sm text-primary hover:underline"
              >
                Forgot password?
              </Link>
            </div>
            {captchaRequired && (
              <div className="space-y-2 rounded-md border p-3 bg-muted/40">
                <Label>Security check</Label>
                {captchaSiteKey ? (
                  <TurnstileWidget
                    siteKey={captchaSiteKey}
                    onToken={setCaptchaToken}
                  />
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Multiple failed attempts detected. Wait or contact your
                    administrator.
                  </p>
                )}
                {/* Fallback for staging without widget */}
                {!captchaSiteKey && (
                  <Input
                    id="captcha"
                    placeholder="CAPTCHA token (if required)"
                    value={captchaToken}
                    onChange={(e) => setCaptchaToken(e.target.value)}
                    autoComplete="off"
                  />
                )}
              </div>
            )}
            {lockMessage && (
              <p className="text-sm text-destructive" role="alert">
                {lockMessage}
              </p>
            )}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                  Signing in...
                </>
              ) : (
                "Sign In"
              )}
            </Button>
          </form>
          <div className="mt-6 space-y-2 text-center">
            <Link
              href="/register"
              className="block text-sm text-primary hover:underline"
            >
              Register a new organization
            </Link>
            <Link
              href="/verify"
              className="block text-sm text-muted-foreground hover:text-primary"
            >
              Product verification
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
