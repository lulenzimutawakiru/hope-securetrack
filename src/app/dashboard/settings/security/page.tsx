"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Shield } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingState } from "@/components/ui/loading-state";
import { useUser } from "@/hooks/use-user";
import { loadSettingsMap, upsertSettings } from "@/lib/system-settings";
import { toast } from "sonner";

const KEYS = [
  "security.session_timeout_minutes",
  "security.mfa_required_admins",
  "security.min_password_length",
  "security.password_require_special",
  "security.max_failed_logins",
  "security.lockout_minutes",
  "security.ip_whitelist_enabled",
];

const DEFAULTS: Record<string, string> = {
  "security.session_timeout_minutes": "480",
  "security.mfa_required_admins": "true",
  "security.min_password_length": "10",
  "security.password_require_special": "true",
  "security.max_failed_logins": "5",
  "security.lockout_minutes": "30",
  "security.ip_whitelist_enabled": "false",
};

export default function SecuritySettingsPage() {
  const { auth } = useUser();
  const [form, setForm] = useState(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function load() {
      if (!auth) {
        setLoading(false);
        return;
      }
      const map = await loadSettingsMap(auth.profile.company_id, KEYS);
      setForm({ ...DEFAULTS, ...map });
      setLoading(false);
    }
    load();
  }, [auth]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth) return;
    setSaving(true);
    const { error } = await upsertSettings(
      auth.profile.company_id,
      auth.profile.id,
      form,
      {
        "security.session_timeout_minutes": "Session timeout (minutes)",
        "security.mfa_required_admins": "Force MFA for admins",
        "security.min_password_length": "Minimum password length",
        "security.password_require_special": "Require special characters",
        "security.max_failed_logins": "Max failed logins before lock",
        "security.lockout_minutes": "Account lockout duration",
        "security.ip_whitelist_enabled": "Enable IP whitelist",
      }
    );
    if (error) toast.error(error);
    else toast.success("Security policy saved");
    setSaving(false);
  };

  if (loading) return <LoadingState />;

  return (
    <div>
      <PageHeader
        title="Security Center"
        description="Password policy · MFA · session timeout · lockouts · IP controls"
        actions={
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard/settings">Hub</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard/identity/security">Live alerts</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard/identity/policies">IAM policies</Link>
            </Button>
          </div>
        }
      />

      <form onSubmit={save} className="grid gap-6 lg:grid-cols-2 max-w-4xl">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Password & MFA
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1">
              <Label>Minimum password length</Label>
              <Input
                type="number"
                value={form["security.min_password_length"]}
                onChange={(e) =>
                  setForm((f) => ({ ...f, "security.min_password_length": e.target.value }))
                }
              />
            </div>
            <div className="space-y-1">
              <Label>Require special characters (true/false)</Label>
              <Input
                value={form["security.password_require_special"]}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    "security.password_require_special": e.target.value,
                  }))
                }
              />
            </div>
            <div className="space-y-1">
              <Label>MFA required for admins (true/false)</Label>
              <Input
                value={form["security.mfa_required_admins"]}
                onChange={(e) =>
                  setForm((f) => ({ ...f, "security.mfa_required_admins": e.target.value }))
                }
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Sessions & lockouts</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1">
              <Label>Session timeout (minutes)</Label>
              <Input
                type="number"
                value={form["security.session_timeout_minutes"]}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    "security.session_timeout_minutes": e.target.value,
                  }))
                }
              />
            </div>
            <div className="space-y-1">
              <Label>Max failed logins</Label>
              <Input
                type="number"
                value={form["security.max_failed_logins"]}
                onChange={(e) =>
                  setForm((f) => ({ ...f, "security.max_failed_logins": e.target.value }))
                }
              />
            </div>
            <div className="space-y-1">
              <Label>Lockout duration (minutes)</Label>
              <Input
                type="number"
                value={form["security.lockout_minutes"]}
                onChange={(e) =>
                  setForm((f) => ({ ...f, "security.lockout_minutes": e.target.value }))
                }
              />
            </div>
            <div className="space-y-1">
              <Label>IP whitelist enabled (true/false)</Label>
              <Input
                value={form["security.ip_whitelist_enabled"]}
                onChange={(e) =>
                  setForm((f) => ({ ...f, "security.ip_whitelist_enabled": e.target.value }))
                }
              />
            </div>
          </CardContent>
        </Card>

        <div className="lg:col-span-2">
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : "Save security policy"}
          </Button>
        </div>
      </form>
    </div>
  );
}
