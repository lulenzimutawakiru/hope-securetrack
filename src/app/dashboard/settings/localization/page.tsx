"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Globe } from "lucide-react";
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
  "locale.language",
  "locale.timezone",
  "locale.date_format",
  "locale.time_format",
  "locale.currency",
  "locale.country",
  "locale.number_format",
  "locale.fiscal_year_start",
];

const DEFAULTS: Record<string, string> = {
  "locale.language": "en",
  "locale.timezone": "Africa/Kampala",
  "locale.date_format": "DD MMM YYYY",
  "locale.time_format": "HH:mm",
  "locale.currency": "UGX",
  "locale.country": "Uganda",
  "locale.number_format": "1,234.56",
  "locale.fiscal_year_start": "1",
};

export default function LocalizationSettingsPage() {
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
    else toast.success("Localization saved");
    setSaving(false);
  };

  if (loading) return <LoadingState />;

  return (
    <div>
      <PageHeader
        title="Localization"
        description="Language · timezone · date/time · currency · country · fiscal calendar"
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href="/dashboard/settings">Hub</Link>
          </Button>
        }
      />

      <form onSubmit={save} className="max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Globe className="h-4 w-4" />
              Regional defaults
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Language</Label>
                <Input
                  value={form["locale.language"]}
                  onChange={(e) => setForm((f) => ({ ...f, "locale.language": e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label>Country</Label>
                <Input
                  value={form["locale.country"]}
                  onChange={(e) => setForm((f) => ({ ...f, "locale.country": e.target.value }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Timezone</Label>
                <Input
                  value={form["locale.timezone"]}
                  onChange={(e) => setForm((f) => ({ ...f, "locale.timezone": e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label>Currency</Label>
                <Input
                  value={form["locale.currency"]}
                  onChange={(e) => setForm((f) => ({ ...f, "locale.currency": e.target.value }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Date format</Label>
                <Input
                  value={form["locale.date_format"]}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, "locale.date_format": e.target.value }))
                  }
                />
              </div>
              <div className="space-y-1">
                <Label>Time format</Label>
                <Input
                  value={form["locale.time_format"]}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, "locale.time_format": e.target.value }))
                  }
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Number format sample</Label>
                <Input
                  value={form["locale.number_format"]}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, "locale.number_format": e.target.value }))
                  }
                />
              </div>
              <div className="space-y-1">
                <Label>Fiscal year start month</Label>
                <Input
                  type="number"
                  min={1}
                  max={12}
                  value={form["locale.fiscal_year_start"]}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, "locale.fiscal_year_start": e.target.value }))
                  }
                />
              </div>
            </div>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : "Save localization"}
            </Button>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
