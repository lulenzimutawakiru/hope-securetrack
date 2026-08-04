"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Cable, Globe, MessageSquare, MonitorCheck, Plus, RefreshCw, Settings, Trash2, Zap,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LoadingState } from "@/components/ui/loading-state";
import { EmptyState } from "@/components/ui/empty-state";
import { StatCard } from "@/components/ui/stat-card";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { createClient } from "@/lib/supabase/crud-compat";
import { useUser } from "@/hooks/use-user";
import { toast } from "sonner";
import { crudCreate, crudDelete, crudUpdate } from "@/lib/api/crud-client";

const INTEGRATION_CATEGORIES = ["identity", "communication", "monitoring", "erp", "automation"] as const;
const CATEGORY_ICONS: Record<string, typeof Cable> = {
  identity: Globe,
  communication: MessageSquare,
  monitoring: MonitorCheck,
  erp: Settings,
  automation: Zap,
};

export default function IntegrationsPage() {
  const { auth } = useUser();
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<string>("all");
  const [form, setForm] = useState({
    name: "",
    integration_type: "",
    category: "identity",
    description: "",
    endpoint: "",
    config: "",
  });

  const companyId = auth?.profile?.company_id as string | undefined;

  const load = async () => {
    const { data } = await createClient()
      .from("sd_integrations")
      .select("*")
      .order("category")
      .order("name");
    setRows((data as Array<Record<string, unknown>>) || []);
    setLoading(false);
  };

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, []);

  const filtered = useMemo(
    () => (tab === "all" ? rows : rows.filter((r) => r.category === tab)),
    [rows, tab]
  );

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId) return;
    let config: Record<string, unknown> = {};
    try {
      config = form.config.trim() ? (JSON.parse(form.config) as Record<string, unknown>) : {};
    } catch {
      toast.error("Config must be valid JSON");
      return;
    }
    const res = await crudCreate("sd_integrations", {
      company_id: companyId,
      name: form.name,
      integration_type: form.integration_type.trim().toLowerCase().replace(/\s+/g, "_"),
      category: form.category,
      description: form.description,
      endpoint: form.endpoint || null,
      config,
      is_connected: false,
      is_active: true,
    });
    if (!res.ok) toast.error(res.error);
    else {
      toast.success("Integration added");
      setOpen(false);
      setForm({ name: "", integration_type: "", category: "identity", description: "", endpoint: "", config: "" });
      await load();
    }
  };

  const toggle = async (id: string, field: "is_connected" | "is_active", value: boolean) => {
    const res = await crudUpdate("sd_integrations", id, { [field]: !value });
    if (!res.ok) toast.error(res.error);
    else {
      toast.success(field === "is_connected" ? (value ? "Disconnected" : "Connected") : value ? "Disabled" : "Enabled");
      await load();
    }
  };

  const remove = async (id: string) => {
    const res = await crudDelete("sd_integrations", id);
    if (!res.ok) toast.error(res.error);
    else {
      toast.success("Integration removed");
      await load();
    }
  };

  if (loading) return <LoadingState message="Loading integrations..." />;

  const connected = rows.filter((r) => r.is_connected).length;
  const active = rows.filter((r) => r.is_active).length;

  return (
    <div>
      <PageHeader
        title="Enterprise Integrations"
        description="Identity · communication · monitoring · ERP · automation"
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Add integration</Button>
            </DialogTrigger>
            <DialogContent>
              <form onSubmit={create}>
                <DialogHeader><DialogTitle>Add integration</DialogTitle></DialogHeader>
                <div className="grid gap-3 py-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label>Category</Label>
                      <SearchableSelect
                        value={form.category}
                        onValueChange={(v) => setForm((f) => ({ ...f, category: v }))}
                        options={INTEGRATION_CATEGORIES}
                        placeholder="Category"
                      />
                    </div>
                    <div>
                      <Label>Type (slug)</Label>
                      <Input
                        required
                        placeholder="e.g. entra_id, smtp"
                        value={form.integration_type}
                        onChange={(e) => setForm((f) => ({ ...f, integration_type: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div>
                    <Label>Name</Label>
                    <Input required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
                  </div>
                  <div>
                    <Label>Description</Label>
                    <Textarea
                      rows={2}
                      value={form.description}
                      onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label>Endpoint</Label>
                    <Input value={form.endpoint} onChange={(e) => setForm((f) => ({ ...f, endpoint: e.target.value }))} />
                  </div>
                  <div>
                    <Label>Config (JSON)</Label>
                    <Textarea
                      rows={3}
                      className="font-mono text-xs"
                      placeholder='{"api_key_env": "SD_SMTP_KEY"}'
                      value={form.config}
                      onChange={(e) => setForm((f) => ({ ...f, config: e.target.value }))}
                    />
                  </div>
                </div>
                <DialogFooter><Button type="submit">Save</Button></DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3 mb-6">
        <StatCard title="Integrations" value={String(rows.length)} icon={Cable} />
        <StatCard title="Connected" value={String(connected)} icon={RefreshCw} />
        <StatCard title="Active" value={String(active)} icon={Zap} />
      </div>

      <Tabs value={tab} onValueChange={setTab} className="mb-6">
        <TabsList>
          <TabsTrigger value="all">All ({rows.length})</TabsTrigger>
          {INTEGRATION_CATEGORIES.map((c) => {
            const count = rows.filter((r) => r.category === c).length;
            return (
              <TabsTrigger key={c} value={c} className="capitalize">
                {c} ({count})
              </TabsTrigger>
            );
          })}
        </TabsList>
      </Tabs>

      {filtered.length === 0 ? (
        <EmptyState title="No integrations" description="Add an integration to connect external systems to the service desk." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((r) => {
            const Icon = CATEGORY_ICONS[String(r.category)] ?? Cable;
            return (
              <Card key={String(r.id)}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="rounded-md bg-primary/10 p-1.5">
                        <Icon className="h-4 w-4 text-primary" />
                      </span>
                      <div>
                        <CardTitle className="text-sm">{String(r.name)}</CardTitle>
                        <p className="text-[10px] font-mono text-muted-foreground">{String(r.integration_type)}</p>
                      </div>
                    </div>
                    <Badge variant={r.is_connected ? "default" : "outline"} className="text-[10px]">
                      {r.is_connected ? "Connected" : "Not connected"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p className="text-xs text-muted-foreground min-h-[2.5rem]">{String(r.description || "")}</p>
                  {r.endpoint ? (
                    <p className="text-[10px] font-mono text-muted-foreground truncate">{String(r.endpoint)}</p>
                  ) : null}
                  <div className="flex items-center gap-2 pt-1">
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1"
                      onClick={() => toggle(String(r.id), "is_connected", Boolean(r.is_connected))}
                    >
                      <RefreshCw className="h-3.5 w-3.5 mr-1" />
                      {r.is_connected ? "Disconnect" : "Connect"}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => toggle(String(r.id), "is_active", Boolean(r.is_active))}
                    >
                      {r.is_active ? "Disable" : "Enable"}
                    </Button>
                    <Button size="sm" variant="ghost" className="text-destructive" onClick={() => remove(String(r.id))}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}