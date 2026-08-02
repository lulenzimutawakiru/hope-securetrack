"use client";

import { useEffect, useState } from "react";
import { Monitor, Plus, RefreshCw } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/hooks/use-user";
import { crudCreate, crudUpdate } from "@/lib/api/crud-client";
import { toast } from "sonner";
import { syncUiThemeToSettings } from "@/lib/branding";

export default function BrandThemesPage() {
  const { auth } = useUser();
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    theme_name: "Hope SecureTrack",
    primary_color: "#0D7377",
    secondary_color: "#1B263B",
    accent_color: "#00AEEF",
    font_family: "Inter",
    login_tagline: "Secure. Traceable. Enterprise.",
    logo_url: "",
    favicon_url: "",
  });

  const companyId = auth?.profile?.company_id as string | undefined;

  const load = async () => {
    const { data } = await createClient()
      .from("brand_ui_themes")
      .select("*")
      .order("created_at", { ascending: false });
    setRows((data as Array<Record<string, unknown>>) || []);
    setLoading(false);
  };

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, []);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await crudCreate("brand_ui_themes", {
      ...form,
      is_active: true,
    });
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("UI theme created");
    setOpen(false);
    await load();
  };

  const activate = async (id: string) => {
    if (!companyId) return;
    // Deactivate other active themes first so only one theme stays active.
    for (const row of rows) {
      if (String(row.id) === id || !Boolean(row.is_active)) continue;
      const res = await crudUpdate("brand_ui_themes", String(row.id), { is_active: false });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
    }
    const res = await crudUpdate("brand_ui_themes", id, { is_active: true });
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    try {
      await syncUiThemeToSettings(companyId, auth?.user?.id);
      toast.success("Theme activated and synced to settings");
    } catch {
      toast.success("Theme activated");
    }
    await load();
  };

  if (loading) return <LoadingState message="Loading UI themes…" />;

  return (
    <div>
      <PageHeader
        title="UI Themes"
        description="Login · dashboard logo · menu colors · favicon · ERP appearance"
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 mr-1" /> New theme</Button>
            </DialogTrigger>
            <DialogContent>
              <form onSubmit={create}>
                <DialogHeader><DialogTitle>Create UI theme</DialogTitle></DialogHeader>
                <div className="grid gap-3 py-3">
                  <div>
                    <Label>Theme name</Label>
                    <Input required value={form.theme_name} onChange={(e) => setForm((f) => ({ ...f, theme_name: e.target.value }))} />
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <Label>Primary</Label>
                      <Input type="color" className="h-9 p-1" value={form.primary_color} onChange={(e) => setForm((f) => ({ ...f, primary_color: e.target.value }))} />
                    </div>
                    <div>
                      <Label>Secondary</Label>
                      <Input type="color" className="h-9 p-1" value={form.secondary_color} onChange={(e) => setForm((f) => ({ ...f, secondary_color: e.target.value }))} />
                    </div>
                    <div>
                      <Label>Accent</Label>
                      <Input type="color" className="h-9 p-1" value={form.accent_color} onChange={(e) => setForm((f) => ({ ...f, accent_color: e.target.value }))} />
                    </div>
                  </div>
                  <div>
                    <Label>Font family</Label>
                    <Input value={form.font_family} onChange={(e) => setForm((f) => ({ ...f, font_family: e.target.value }))} />
                  </div>
                  <div>
                    <Label>Login tagline</Label>
                    <Input value={form.login_tagline} onChange={(e) => setForm((f) => ({ ...f, login_tagline: e.target.value }))} />
                  </div>
                  <div>
                    <Label>Logo URL</Label>
                    <Input value={form.logo_url} onChange={(e) => setForm((f) => ({ ...f, logo_url: e.target.value }))} />
                  </div>
                  <div>
                    <Label>Favicon URL</Label>
                    <Input value={form.favicon_url} onChange={(e) => setForm((f) => ({ ...f, favicon_url: e.target.value }))} />
                  </div>
                </div>
                <DialogFooter><Button type="submit">Save</Button></DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      {rows.length === 0 ? (
        <EmptyState icon={Monitor} title="No themes" description="Define company-specific ERP look and login branding." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((t) => (
            <Card key={String(t.id)} className={Boolean(t.is_active) ? "border-primary" : ""}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{String(t.theme_name)}</CardTitle>
                  {Boolean(t.is_active) && <Badge>Active</Badge>}
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2 mb-3">
                  {[t.primary_color, t.secondary_color, t.accent_color].map((c, i) => (
                    <div key={i} className="h-8 w-8 rounded border" style={{ backgroundColor: String(c) }} title={String(c)} />
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mb-1">{String(t.font_family)}</p>
                <p className="text-sm mb-3">{String(t.login_tagline || "")}</p>
                {!Boolean(t.is_active) && (
                  <Button size="sm" variant="outline" onClick={() => activate(String(t.id))}>
                    <RefreshCw className="h-3 w-3 mr-1" /> Activate & sync
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
