"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, Loader2, Shield } from "lucide-react";
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

function ResetPasswordInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [state, setState] = useState<
    "resolving" | "ready" | "invalid"
  >("resolving");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [updated, setUpdated] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const supabase = createClient();
        const code = searchParams.get("code");
        const tokenHash = searchParams.get("token_hash");
        const type = searchParams.get("type") || "recovery";

        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (cancelled) return;
          if (error) {
            console.error("Reset code exchange failed:", error.message);
            setState("invalid");
            return;
          }
          setState("ready");
          return;
        }

        if (tokenHash) {
          const { error } = await supabase.auth.verifyOtp({
            type: type === "email" ? "email" : "recovery",
            token_hash: tokenHash,
          });
          if (cancelled) return;
          if (error) {
            console.error("Reset token verification failed:", error.message);
            setState("invalid");
            return;
          }
          setState("ready");
          return;
        }

        setState("invalid");
      } catch {
        if (!cancelled) setState("invalid");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    if (password !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    setLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        toast.error(error.message);
        return;
      }
      setUpdated(true);
      toast.success("Password updated. Please sign in.");
      setTimeout(() => {
        router.push("/login");
        router.refresh();
      }, 1200);
    } catch {
      toast.error("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (state === "resolving") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-hope-navy to-hope-teal p-6">
        <Loader2 className="h-8 w-8 animate-spin text-hope-gold" aria-hidden />
        <span className="sr-only">Validating reset link?</span>
      </div>
    );
  }

  if (state === "invalid") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-hope-navy to-hope-teal p-6">
        <Card className="w-full max-w-md">
          <CardContent className="py-8 text-center space-y-4">
            <AlertTriangle
              className="mx-auto h-10 w-10 text-destructive"
              aria-hidden
            />
            <CardTitle>Invalid or expired reset link</CardTitle>
            <p className="text-sm text-muted-foreground">
              This password reset link is invalid, expired, or has already been
              used. Request a new one to continue.
            </p>
            <Button asChild className="w-full">
              <Link href="/forgot-password">Request a new link</Link>
            </Button>
            <Link
              href="/login"
              className="block text-sm text-primary hover:underline"
            >
              Back to sign in
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (updated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-hope-navy to-hope-teal p-6">
        <Card className="w-full max-w-md">
          <CardContent className="py-8 text-center space-y-4">
            <CheckCircle2
              className="mx-auto h-10 w-10 text-green-500"
              aria-hidden
            />
            <CardTitle>Password updated</CardTitle>
            <p className="text-sm text-muted-foreground">
              Your password has been changed. Redirecting you to sign in?
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-hope-navy to-hope-teal p-6">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <Shield className="h-12 w-12 text-hope-gold" aria-hidden />
          </div>
          <CardTitle className="text-2xl">Choose a new password</CardTitle>
          <CardDescription>
            Enter a new password for your SecureTrack account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div className="space-y-2">
              <Label htmlFor="password">New password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
                placeholder="At least 8 characters"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm new password</Label>
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <>
                  <Loader2
                    className="mr-2 h-4 w-4 animate-spin"
                    aria-hidden
                  />
                  Updating...
                </>
              ) : (
                "Update password"
              )}
            </Button>
            <Link
              href="/login"
              className="block text-center text-sm text-primary hover:underline"
            >
              Back to sign in
            </Link>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-hope-navy to-hope-teal p-6">
          <Loader2 className="h-8 w-8 animate-spin text-hope-gold" aria-hidden />
        </div>
      }
    >
      <ResetPasswordInner />
    </Suspense>
  );
}
