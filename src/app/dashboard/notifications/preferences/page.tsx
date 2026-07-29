"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Settings2 } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { LoadingState } from "@/components/ui/loading-state";
import { toast } from "sonner";

type Prefs = {
  email_enabled: boolean;
  in_app_enabled: boolean;
  sms_enabled: boolean;
  push_enabled: boolean;
  whatsapp_enabled: boolean;
  quiet_hours_start: string | null;
  quiet_hours_end: string | null;
  digest_mode: string;
  digest_hour: number;
  muted_events: string[];
};

const DEFAULTS: Prefs = {
  email_enabled: true,
  in_app_enabled: true,
  sms_enabled: false,
  push_enabled: false,
  whatsapp_enabled: false,
  quiet_hours_start: null,
  quiet_hours_end: null,
  digest_mode: "instant",
  digest_hour: 8,
  muted_events: [],
};

export default function NotificationPreferencesPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [prefs, setPrefs] = useState<Prefs>(DEFAULTS);
  const [mutedText, setMutedText] = useState("");

  useEffect(() => {
    async function load() {
      const res = await fetch("/api/notifications/preferences");
      const data = await res.json();
      if (res.ok && data.preferences) {
        setPrefs({
          email_enabled: data.preferences.email_enabled ?? true,
          in_app_enabled: data.preferences.in_app_enabled ?? true,
          sms_enabled: data.preferences.sms_enabled ?? false,
          push_enabled: data.preferences.push_enabled ?? false,
          whatsapp_enabled: data.preferences.whatsapp_enabled ?? false,
          quiet_hours_start: data.preferences.quiet_hours_start ?? null,
          quiet_hours_end: data.preferences.quiet_hours_end ?? null,
          digest_mode: data.preferences.digest_mode ?? "instant",
          digest_hour: data.preferences.digest_hour ?? 8,
          muted_events: data.preferences.muted_events ?? [],
        });
        setMutedText((data.preferences.muted_events ?? []).join(", "));
      }
      setLoading(false);
    }
    load();
  }, []);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/notifications/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...prefs,
          muted_events: mutedText
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
        }),
      });
      const data = await res.json();
      if (!res.ok) toast.error(data.error || "Save failed");
      else toast.success("Preferences saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingState />;

  const toggle = (key: keyof Prefs) =>
    setPrefs((p) => ({ ...p, [key]: !p[key] }));

  return (
    <div>
      <PageHeader
        title="Notification Preferences"
        description="Channels · quiet hours · digests · mute events"
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href="/dashboard/notifications">Inbox</Link>
          </Button>
        }
      />

      <form onSubmit={save} className="max-w-2xl space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Settings2 className="h-4 w-4" />
              Channels
            </CardTitle>
            <CardDescription>
              In-app and email (Resend) are live. SMS / WhatsApp / push are queued for workers.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {(
              [
                ["in_app_enabled", "In-app notifications"],
                ["email_enabled", "Email (Resend)"],
                ["sms_enabled", "SMS"],
                ["whatsapp_enabled", "WhatsApp"],
                ["push_enabled", "Push notifications"],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={Boolean(prefs[key])}
                  onChange={() => toggle(key)}
                />
                {label}
              </label>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Quiet hours & digest</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Quiet start (UTC HH:MM)</Label>
                <Input
                  placeholder="22:00"
                  value={prefs.quiet_hours_start ?? ""}
                  onChange={(e) =>
                    setPrefs((p) => ({
                      ...p,
                      quiet_hours_start: e.target.value || null,
                    }))
                  }
                />
              </div>
              <div className="space-y-1">
                <Label>Quiet end (UTC HH:MM)</Label>
                <Input
                  placeholder="06:00"
                  value={prefs.quiet_hours_end ?? ""}
                  onChange={(e) =>
                    setPrefs((p) => ({
                      ...p,
                      quiet_hours_end: e.target.value || null,
                    }))
                  }
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Digest mode</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={prefs.digest_mode}
                  onChange={(e) =>
                    setPrefs((p) => ({ ...p, digest_mode: e.target.value }))
                  }
                >
                  <option value="instant">Instant</option>
                  <option value="hourly">Hourly</option>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                </select>
              </div>
              <div className="space-y-1">
                <Label>Digest hour (UTC)</Label>
                <Input
                  type="number"
                  min={0}
                  max={23}
                  value={prefs.digest_hour}
                  onChange={(e) =>
                    setPrefs((p) => ({
                      ...p,
                      digest_hour: Number(e.target.value) || 0,
                    }))
                  }
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Muted event keys (comma-separated)</Label>
              <Input
                value={mutedText}
                onChange={(e) => setMutedText(e.target.value)}
                placeholder="system.backup, marketing.promo"
              />
            </div>
          </CardContent>
        </Card>

        <Button type="submit" disabled={saving}>
          {saving ? "Saving…" : "Save preferences"}
        </Button>
      </form>
    </div>
  );
}
