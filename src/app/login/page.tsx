"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Shield, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [captchaToken, setCaptchaToken] = useState("");
  const [captchaRequired, setCaptchaRequired] = useState(false);
  const [captchaSiteKey, setCaptchaSiteKey] = useState<string | null>(null);
  const [lockMessage, setLockMessage] = useState<string | null>(null);

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
      if (guard?.captchaRequired) {
        setCaptchaRequired(true);
        if (guard.siteKey) setCaptchaSiteKey(guard.siteKey);
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
          <form onSubmit={handleLogin} className="space-y-4" noValidate>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="name@hopedesign.co.ke"
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
            {captchaRequired && (
              <div className="space-y-2 rounded-md border p-3 bg-muted/40">
                <Label htmlFor="captcha">Security check</Label>
                {captchaSiteKey ? (
                  <p className="text-xs text-muted-foreground">
                    CAPTCHA provider configured (site key present). Embed widget
                    in production branding; paste token for staging:
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Multiple failed attempts detected. Wait or complete
                    verification if prompted by your administrator.
                  </p>
                )}
                <Input
                  id="captcha"
                  placeholder="CAPTCHA token (if required)"
                  value={captchaToken}
                  onChange={(e) => setCaptchaToken(e.target.value)}
                  autoComplete="off"
                />
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
              Verify a product without signing in
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
