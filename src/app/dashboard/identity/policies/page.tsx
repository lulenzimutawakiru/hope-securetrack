"use client";

import { useEffect, useState } from "react";
import { Lock } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingState } from "@/components/ui/loading-state";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

export default function IdentityPoliciesPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [id, setId] = useState<string | null>(null);
  const [form, setForm] = useState({
    min_password_length: "10",
    password_expiry_days: "90",
    max_failed_logins: "5",
    lockout_minutes: "30",
    session_timeout_minutes: "480",
    max_concurrent_sessions: "5",
  });

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data } = await supabase
        .from("security_policies")
        .select("*")
        .limit(1)
        .maybeSingle();
      if (data) {
        setId(data.id);
        setForm({
          min_password_length: String(data.min_password_length ?? 10),
          password_expiry_days: String(data.password_expiry_days ?? 90),
          max_failed_logins: String(data.max_failed_logins ?? 5),
          lockout_minutes: String(data.lockout_minutes ?? 30),
          session_timeout_minutes: String(data.session_timeout_minutes ?? 480),
          max_concurrent_sessions: String(data.max_concurrent_sessions ?? 5),
        });
      }
      setLoading(false);
    }
    load();
  }, []);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) {
      toast.error("No policy row found");
      return;
    }
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("security_policies")
      .update({
        min_password_length: parseInt(form.min_password_length, 10),
        password_expiry_days: parseInt(form.password_expiry_days, 10),
        max_failed_logins: parseInt(form.max_failed_logins, 10),
        lockout_minutes: parseInt(form.lockout_minutes, 10),
        session_timeout_minutes: parseInt(form.session_timeout_minutes, 10),
        max_concurrent_sessions: parseInt(form.max_concurrent_sessions, 10),
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);
    setSaving(false);
    if (error) toast.error(error.message);
    else toast.success("Security policy saved");
  };

  if (loading) return <LoadingState />;

  return (
    <div>
      <PageHeader
        title="Security Policies"
        description="Password complexity · expiry · lockout · session timeout · MFA enforcement flags"
      />

      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Lock className="h-4 w-4" /> Company password & session policy
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={save} className="grid gap-4">
            {(
              [
                ["min_password_length", "Min password length"],
                ["password_expiry_days", "Password expiry (days)"],
                ["max_failed_logins", "Max failed logins"],
                ["lockout_minutes", "Lockout duration (minutes)"],
                ["session_timeout_minutes", "Session timeout (minutes)"],
                ["max_concurrent_sessions", "Max concurrent sessions"],
              ] as const
            ).map(([key, label]) => (
              <div key={key} className="space-y-2">
                <Label>{label}</Label>
                <Input
                  type="number"
                  value={form[key]}
                  onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                />
              </div>
            ))}
            <p className="text-xs text-muted-foreground">
              MFA is supported via Supabase Auth (TOTP). Enforce for admins in
              Auth settings and user profile flags.
            </p>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : "Save policy"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
