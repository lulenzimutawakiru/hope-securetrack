"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Palette } from "lucide-react";
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
  "brand.primary_color",
  "brand.secondary_color",
  "brand.app_name",
  "brand.dark_mode_default",
  "brand.font_family",
  "brand.login_tagline",
];

const DEFAULTS: Record<string, string> = {
  "brand.primary_color": "#0D7377",
  "brand.secondary_color": "#1B263B",
  "brand.app_name": "Hope SecureTrack",
  "brand.dark_mode_default": "false",
  "brand.font_family": "Inter",
  "brand.login_tagline": "Enterprise security printing ERP",
};

export default function BrandingSettingsPage() {
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
    else toast.success("Branding saved");
    setSaving(false);
  };

  if (loading) return <LoadingState />;

  return (
    <div>
      <PageHeader
        title="Branding"
        description="Colours · app name · fonts · login experience · report branding"
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard/settings">Hub</Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/dashboard/branding">Enterprise Branding</Link>
            </Button>
          </div>
        }
      />

      <form onSubmit={save} className="max-w-2xl space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Palette className="h-4 w-4" />
              Theme
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1">
              <Label>Application name</Label>
              <Input
                value={form["brand.app_name"]}
                onChange={(e) => setForm((f) => ({ ...f, "brand.app_name": e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Primary colour</Label>
                <div className="flex gap-2">
                  <Input
                    type="color"
                    className="w-14 p-1 h-10"
                    value={form["brand.primary_color"] || "#0D7377"}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, "brand.primary_color": e.target.value }))
                    }
                  />
                  <Input
                    value={form["brand.primary_color"]}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, "brand.primary_color": e.target.value }))
                    }
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label>Secondary colour</Label>
                <div className="flex gap-2">
                  <Input
                    type="color"
                    className="w-14 p-1 h-10"
                    value={form["brand.secondary_color"] || "#1B263B"}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, "brand.secondary_color": e.target.value }))
                    }
                  />
                  <Input
                    value={form["brand.secondary_color"]}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, "brand.secondary_color": e.target.value }))
                    }
                  />
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Font family</Label>
                <Input
                  value={form["brand.font_family"]}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, "brand.font_family": e.target.value }))
                  }
                />
              </div>
              <div className="space-y-1">
                <Label>Dark mode default (true/false)</Label>
                <Input
                  value={form["brand.dark_mode_default"]}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, "brand.dark_mode_default": e.target.value }))
                  }
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Login tagline</Label>
              <Input
                value={form["brand.login_tagline"]}
                onChange={(e) =>
                  setForm((f) => ({ ...f, "brand.login_tagline": e.target.value }))
                }
              />
            </div>
            <div
              className="rounded-lg border p-4 mt-2"
              style={{
                borderColor: form["brand.primary_color"],
                background: `linear-gradient(135deg, ${form["brand.secondary_color"]} 0%, #0a1628 100%)`,
                color: "#fff",
              }}
            >
              <p className="text-xs opacity-70">Preview</p>
              <p className="font-semibold text-lg" style={{ color: form["brand.primary_color"] }}>
                {form["brand.app_name"]}
              </p>
              <p className="text-sm opacity-80">{form["brand.login_tagline"]}</p>
            </div>
          </CardContent>
        </Card>
        <Button type="submit" disabled={saving}>
          {saving ? "Saving…" : "Save branding"}
        </Button>
      </form>
    </div>
  );
}
