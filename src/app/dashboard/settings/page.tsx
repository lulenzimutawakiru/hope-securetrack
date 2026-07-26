"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/ui/loading-state";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/hooks/use-user";
import { toast } from "sonner";
import { APP_NAME, COMPANY_NAME } from "@/lib/constants";

export default function SettingsPage() {
  const { auth, loading: authLoading } = useUser();
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState({
    first_name: "",
    last_name: "",
    phone: "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function load() {
      if (!auth) {
        setLoading(false);
        return;
      }

      setProfile({
        first_name: auth.profile.first_name,
        last_name: auth.profile.last_name,
        phone: auth.profile.phone ?? "",
      });

      const supabase = createClient();
      const { data } = await supabase
        .from("system_settings")
        .select("key, value")
        .eq("company_id", auth.profile.company_id);

      const map: Record<string, string> = {};
      data?.forEach((s) => {
        map[s.key] = typeof s.value === "string" ? s.value : JSON.stringify(s.value);
      });
      setSettings(map);
      setLoading(false);
    }
    if (!authLoading) load();
  }, [auth, authLoading]);

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth) return;
    setSaving(true);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("user_profiles")
        .update({
          first_name: profile.first_name,
          last_name: profile.last_name,
          phone: profile.phone || null,
        })
        .eq("id", auth.profile.id);
      if (error) throw error;
      toast.success("Profile updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed");
    } finally {
      setSaving(false);
    }
  };

  if (authLoading || loading) return <LoadingState />;

  return (
    <div>
      <PageHeader
        title="Settings"
        description="Profile and system configuration"
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Your Profile</CardTitle>
            <CardDescription>Update your personal information</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={saveProfile} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>First Name</Label>
                  <Input
                    value={profile.first_name}
                    onChange={(e) =>
                      setProfile({ ...profile, first_name: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Last Name</Label>
                  <Input
                    value={profile.last_name}
                    onChange={(e) =>
                      setProfile({ ...profile, last_name: e.target.value })
                    }
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input value={auth?.profile.email ?? ""} disabled />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input
                  value={profile.phone}
                  onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Role</Label>
                <Input value={auth?.profile.roles?.name ?? ""} disabled />
              </div>
              <Button type="submit" disabled={saving}>
                {saving ? "Saving..." : "Save Profile"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>System</CardTitle>
            <CardDescription>Application and company configuration</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Application</Label>
              <Input value={APP_NAME} disabled />
            </div>
            <div className="space-y-2">
              <Label>Company</Label>
              <Input value={COMPANY_NAME} disabled />
            </div>
            <div className="space-y-2">
              <Label>Reams per Carton</Label>
              <Input
                value={settings["carton.reams_per_carton"] ?? "5"}
                disabled
              />
            </div>
            <div className="space-y-2">
              <Label>QR Version</Label>
              <Input value={settings["qr.version"] ?? "1"} disabled />
            </div>
            <div className="space-y-2">
              <Label>Verification Rate Limit</Label>
              <Input
                value={settings["verification.rate_limit"] ?? "60"}
                disabled
              />
            </div>
            <p className="text-xs text-muted-foreground">
              System settings are managed via Supabase. Contact your administrator
              to change company-wide configuration.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
