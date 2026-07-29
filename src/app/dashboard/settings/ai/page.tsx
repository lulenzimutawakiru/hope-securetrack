"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Brain } from "lucide-react";
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
  "ai.enabled",
  "ai.confidence_threshold",
  "ai.model",
  "ai.forecasting",
  "ai.procurement_suggestions",
  "ai.sales_predictions",
  "ai.hr_analytics",
  "ai.fraud_detection",
  "ai.data_retention_days",
];

const DEFAULTS: Record<string, string> = {
  "ai.enabled": "true",
  "ai.confidence_threshold": "0.7",
  "ai.model": "default",
  "ai.forecasting": "true",
  "ai.procurement_suggestions": "true",
  "ai.sales_predictions": "true",
  "ai.hr_analytics": "true",
  "ai.fraud_detection": "true",
  "ai.data_retention_days": "90",
};

export default function AiSettingsPage() {
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
    else toast.success("AI configuration saved");
    setSaving(false);
  };

  if (loading) return <LoadingState />;

  return (
    <div>
      <PageHeader
        title="AI Configuration"
        description="Forecasting · procurement · sales · HR · fraud · confidence thresholds"
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href="/dashboard/settings">Hub</Link>
          </Button>
        }
      />

      <form onSubmit={save} className="max-w-2xl space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Brain className="h-4 w-4" />
              Global controls
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>AI enabled (true/false)</Label>
                <Input
                  value={form["ai.enabled"]}
                  onChange={(e) => setForm((f) => ({ ...f, "ai.enabled": e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label>Model</Label>
                <Input
                  value={form["ai.model"]}
                  onChange={(e) => setForm((f) => ({ ...f, "ai.model": e.target.value }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Confidence threshold (0–1)</Label>
                <Input
                  type="number"
                  step="0.05"
                  min={0}
                  max={1}
                  value={form["ai.confidence_threshold"]}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, "ai.confidence_threshold": e.target.value }))
                  }
                />
              </div>
              <div className="space-y-1">
                <Label>Data retention (days)</Label>
                <Input
                  type="number"
                  value={form["ai.data_retention_days"]}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, "ai.data_retention_days": e.target.value }))
                  }
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Feature toggles</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            {(
              [
                ["ai.forecasting", "Forecasting"],
                ["ai.procurement_suggestions", "Procurement suggestions"],
                ["ai.sales_predictions", "Sales predictions"],
                ["ai.hr_analytics", "HR analytics"],
                ["ai.fraud_detection", "Fraud detection"],
              ] as const
            ).map(([key, label]) => (
              <div key={key} className="space-y-1">
                <Label>{label} (true/false)</Label>
                <Input
                  value={form[key]}
                  onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                />
              </div>
            ))}
          </CardContent>
        </Card>

        <Button type="submit" disabled={saving}>
          {saving ? "Saving…" : "Save AI settings"}
        </Button>
      </form>
    </div>
  );
}
