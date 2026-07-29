"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { DatabaseBackup } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LoadingState } from "@/components/ui/loading-state";
import { useUser } from "@/hooks/use-user";
import { loadSettingsMap, upsertSettings } from "@/lib/system-settings";
import { toast } from "sonner";

const KEYS = [
  "backup.frequency",
  "backup.retention_days",
  "backup.geo_replication",
  "backup.auto_verify",
  "backup.window_utc",
];

const DEFAULTS: Record<string, string> = {
  "backup.frequency": "daily",
  "backup.retention_days": "30",
  "backup.geo_replication": "false",
  "backup.auto_verify": "true",
  "backup.window_utc": "02:00",
};

export default function BackupSettingsPage() {
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
    const { error } = await upsertSettings(auth.profile.company_id, auth.profile.id, form);
    if (error) toast.error(error);
    else toast.success("Backup policy saved");
    setSaving(false);
  };

  if (loading) return <LoadingState />;

  return (
    <div>
      <PageHeader
        title="Backup & Disaster Recovery"
        description="Schedule · retention · geo-replication · restore policy (managed by platform ops)"
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href="/dashboard/settings">Hub</Link>
          </Button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-2 max-w-4xl">
        <form onSubmit={save}>
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <DatabaseBackup className="h-4 w-4" />
                Backup policy
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1">
                <Label>Frequency</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={form["backup.frequency"]}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, "backup.frequency": e.target.value }))
                  }
                >
                  <option value="hourly">Hourly</option>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                </select>
              </div>
              <div className="space-y-1">
                <Label>Retention (days)</Label>
                <Input
                  type="number"
                  value={form["backup.retention_days"]}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, "backup.retention_days": e.target.value }))
                  }
                />
              </div>
              <div className="space-y-1">
                <Label>Window (UTC HH:mm)</Label>
                <Input
                  value={form["backup.window_utc"]}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, "backup.window_utc": e.target.value }))
                  }
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Geo-replication (true/false)</Label>
                  <Input
                    value={form["backup.geo_replication"]}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, "backup.geo_replication": e.target.value }))
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label>Auto-verify (true/false)</Label>
                  <Input
                    value={form["backup.auto_verify"]}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, "backup.auto_verify": e.target.value }))
                    }
                  />
                </div>
              </div>
              <Button type="submit" disabled={saving}>
                {saving ? "Saving…" : "Save policy"}
              </Button>
            </CardContent>
          </Card>
        </form>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Platform status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span>Supabase continuous backups</span>
              <Badge className="bg-green-100 text-green-800">Managed</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span>Point-in-time recovery</span>
              <Badge variant="outline">Available (plan)</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span>Last policy update</span>
              <span className="text-muted-foreground">Via Settings</span>
            </div>
            <p className="text-xs text-muted-foreground pt-2 border-t">
              Physical restore and PITR are executed by platform administrators through
              Supabase Dashboard / ops runbooks. This screen records business policy only.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
