"use client";

import { useEffect, useState } from "react";
import { KeyRound } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LoadingState } from "@/components/ui/loading-state";
import { StatCard } from "@/components/ui/stat-card";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

export default function SsoPage() {
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [editId, setEditId] = useState<string | null>(null);
  const [issuer, setIssuer] = useState("");
  const [clientId, setClientId] = useState("");

  const load = async () => {
    const { data } = await createClient()
      .from("idm_sso_providers")
      .select("*")
      .order("name");
    setRows((data as Array<Record<string, unknown>>) || []);
    setLoading(false);
  };

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, []);

  const toggle = async (id: string, active: boolean) => {
    const { error } = await createClient()
      .from("idm_sso_providers")
      .update({ is_active: !active })
      .eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success(active ? "SSO provider disabled" : "SSO provider enabled");
      await load();
    }
  };

  const saveConfig = async (id: string) => {
    const { error } = await createClient()
      .from("idm_sso_providers")
      .update({
        issuer_url: issuer || null,
        client_id: clientId || null,
      })
      .eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("SSO config saved");
      setEditId(null);
      await load();
    }
  };

  if (loading) return <LoadingState message="Loading SSO providers…" />;

  const active = rows.filter((r) => r.is_active).length;

  return (
    <div>
      <PageHeader
        title="Single Sign-On (SSO)"
        description="Microsoft Entra · Google Workspace · AD · LDAP · OAuth 2.0 · SAML"
      />

      <div className="grid gap-4 sm:grid-cols-2 mb-6">
        <StatCard title="Providers" value={String(rows.length)} icon={KeyRound} />
        <StatCard title="Active" value={String(active)} icon={KeyRound} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((r) => (
          <Card key={String(r.id)}>
            <CardHeader className="pb-2">
              <div className="flex justify-between gap-2">
                <CardTitle className="text-base">{String(r.name)}</CardTitle>
                <Badge variant={r.is_active ? "default" : "outline"} className="text-[10px] uppercase">
                  {String(r.protocol)}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="text-xs text-muted-foreground font-mono">{String(r.provider_code)}</div>
              <div className="text-xs">
                Auto-provision: {r.auto_provision ? "Yes" : "No"} ·{" "}
                {r.is_active ? "Live" : "Configured (off)"}
              </div>
              {editId === r.id ? (
                <div className="space-y-2">
                  <div>
                    <Label className="text-xs">Issuer / Metadata URL</Label>
                    <Input value={issuer} onChange={(e) => setIssuer(e.target.value)} placeholder="https://..." />
                  </div>
                  <div>
                    <Label className="text-xs">Client ID</Label>
                    <Input value={clientId} onChange={(e) => setClientId(e.target.value)} />
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => saveConfig(String(r.id))}>Save</Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditId(null)}>Cancel</Button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setEditId(String(r.id));
                      setIssuer(String(r.issuer_url || r.metadata_url || ""));
                      setClientId(String(r.client_id || ""));
                    }}
                  >
                    Configure
                  </Button>
                  <Button size="sm" variant={r.is_active ? "secondary" : "default"} onClick={() => toggle(String(r.id), Boolean(r.is_active))}>
                    {r.is_active ? "Disable" : "Enable"}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="mt-6">
        <CardHeader className="pb-2"><CardTitle className="text-base">SSO integration notes</CardTitle></CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p><strong>Entra / Google / OAuth:</strong> Store client ID + issuer; connect secrets via Integration Hub or env vars (never store raw secrets in browser).</p>
          <p><strong>SAML:</strong> Paste IdP metadata URL; map NameID → email for auto-provision.</p>
          <p><strong>AD / LDAP:</strong> Configure host + base DN; schedule sync jobs from Integration Hub.</p>
          <p>Login page can route to enabled providers when callback URLs are registered with the IdP.</p>
        </CardContent>
      </Card>
    </div>
  );
}
