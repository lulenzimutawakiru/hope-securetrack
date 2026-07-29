"use client";

import { useEffect, useState } from "react";
import { Settings, Save } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { LoadingState } from "@/components/ui/loading-state";
import { useUser } from "@/hooks/use-user";
import {
  listCompanySettings, upsertCompanySetting, getCompanyBranding,
} from "@/lib/enterprise-company";
import { toast } from "sonner";

export default function EnterpriseSettingsPage() {
  const { auth } = useUser();
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<Array<Record<string, unknown>>>([]);
  const [branding, setBranding] = useState<Record<string, unknown> | null>(null);
  const [editKey, setEditKey] = useState<string | null>(null);
  const [editVal, setEditVal] = useState("");

  const load = async () => {
    if (!auth?.profile?.company_id) { setLoading(false); return; }
    try {
      const [s, b] = await Promise.all([
        listCompanySettings(auth.profile.company_id),
        getCompanyBranding(auth.profile.company_id),
      ]);
      setSettings(s as Array<Record<string, unknown>>);
      setBranding(b as Record<string, unknown> | null);
    } catch { /* */ } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [auth]);

  const save = async (row: Record<string, unknown>) => {
    if (!auth) return;
    try {
      let value: unknown = editVal;
      try { value = JSON.parse(editVal); } catch { /* keep string */ }
      await upsertCompanySetting({
        company_id: auth.profile.company_id,
        domain: String(row.domain),
        setting_key: String(row.setting_key),
        setting_value: value,
        description: String(row.description || ""),
        updated_by: auth.user.id,
      });
      toast.success("Setting saved");
      setEditKey(null);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    }
  };

  if (loading) return <LoadingState message="Loading company settings…" />;

  const byDomain = settings.reduce<Record<string, Array<Record<string, unknown>>>>((acc, s) => {
    const d = String(s.domain);
    (acc[d] ||= []).push(s);
    return acc;
  }, {});

  return (
    <div>
      <PageHeader
        title="Company Settings"
        description="Financial · HR · manufacturing · procurement · sales policies"
      />

      {branding && (
        <Card className="mb-6">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Settings className="h-4 w-4" /> Branding defaults
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3 text-xs">
            <Badge style={{ background: String(branding.primary_color || "#0B1F3A"), color: "#fff" }}>
              Primary {String(branding.primary_color)}
            </Badge>
            <Badge style={{ background: String(branding.secondary_color || "#C9A227"), color: "#000" }}>
              Secondary {String(branding.secondary_color)}
            </Badge>
            <span className="text-muted-foreground">Font: {String(branding.font_family || "Inter")}</span>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {Object.entries(byDomain).map(([domain, rows]) => (
          <Card key={domain}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm capitalize">{domain}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {rows.map((r) => {
                const key = `${r.domain}:${r.setting_key}`;
                const isEdit = editKey === key;
                return (
                  <div key={key} className="rounded border p-2 text-xs space-y-1">
                    <div className="flex justify-between gap-2">
                      <span className="font-mono font-medium">{String(r.setting_key)}</span>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 text-[10px]"
                        onClick={() => {
                          if (isEdit) save(r);
                          else {
                            setEditKey(key);
                            setEditVal(
                              typeof r.setting_value === "string"
                                ? r.setting_value
                                : JSON.stringify(r.setting_value, null, 2)
                            );
                          }
                        }}
                      >
                        {isEdit ? <><Save className="h-3 w-3 mr-1" /> Save</> : "Edit"}
                      </Button>
                    </div>
                    {r.description != null && String(r.description) !== "" && (
                      <p className="text-muted-foreground">{String(r.description)}</p>
                    )}
                    {isEdit ? (
                      <Textarea value={editVal} onChange={(e) => setEditVal(e.target.value)} className="text-xs min-h-[60px]" />
                    ) : (
                      <pre className="bg-muted/40 p-1.5 rounded overflow-x-auto max-h-20">
                        {typeof r.setting_value === "string"
                          ? r.setting_value
                          : JSON.stringify(r.setting_value)}
                      </pre>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
