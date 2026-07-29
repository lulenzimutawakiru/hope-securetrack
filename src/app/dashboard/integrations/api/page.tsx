"use client";

import { useEffect, useState } from "react";
import { Key, Plus, Copy } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { LoadingState } from "@/components/ui/loading-state";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/hooks/use-user";
import { toast } from "sonner";
import { generateApiKey } from "@/lib/integration";

export default function ApiGatewayPage() {
  const { auth } = useUser();
  const [apps, setApps] = useState<Array<Record<string, unknown>>>([]);
  const [keys, setKeys] = useState<Array<Record<string, unknown>>>([]);
  const [routes, setRoutes] = useState<Array<Record<string, unknown>>>([]);
  const [logs, setLogs] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [appName, setAppName] = useState("");
  const [newKey, setNewKey] = useState<string | null>(null);

  const load = async () => {
    const supabase = createClient();
    const [a, k, r, l] = await Promise.all([
      supabase.from("intg_api_apps").select("*").order("created_at", { ascending: false }),
      supabase.from("intg_api_keys").select("*, intg_api_apps(name)").order("created_at", { ascending: false }),
      supabase.from("intg_api_routes").select("*").order("path_pattern"),
      supabase.from("intg_api_logs").select("*").order("created_at", { ascending: false }).limit(30),
    ]);
    setApps(a.data ?? []);
    setKeys(k.data ?? []);
    setRoutes(r.data ?? []);
    setLogs(l.data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, []);

  const createApp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth?.profile?.company_id) return;
    try {
      const supabase = createClient();
      const code = `APP-${Date.now().toString(36).toUpperCase()}`;
      const { data: app, error } = await supabase
        .from("intg_api_apps")
        .insert({
          company_id: auth.profile.company_id,
          app_code: code,
          name: appName,
          environment: "sandbox",
          status: "active",
          allowed_scopes: ["read", "write"],
        })
        .select()
        .single();
      if (error) throw error;

      const gen = generateApiKey();
      await supabase.from("intg_api_keys").insert({
        company_id: auth.profile.company_id,
        app_id: app.id,
        key_prefix: gen.prefix,
        key_hash: gen.hash,
        key_hint: gen.hint,
        name: "Default key",
        scopes: ["read", "write"],
        is_active: true,
        created_by: auth.profile.id,
      });
      setNewKey(gen.raw);
      toast.success("App + API key created — copy key now");
      setOpen(false);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  };

  if (loading) return <LoadingState message="Loading API gateway…" />;

  return (
    <div>
      <PageHeader
        title="API Gateway"
        description="REST routes · API keys · OAuth-ready apps · rate limits · request logs"
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Register app</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>API application</DialogTitle></DialogHeader>
              <form onSubmit={createApp} className="space-y-3">
                <div><Label>Name</Label><Input required value={appName} onChange={(e) => setAppName(e.target.value)} placeholder="Partner integration" /></div>
                <DialogFooter><Button type="submit">Create + issue key</Button></DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      {newKey && (
        <div className="mb-4 rounded-lg border border-teal-600 bg-teal-50 p-3 text-sm flex flex-wrap items-center gap-2">
          <Key className="h-4 w-4" />
          <code className="font-mono text-xs break-all">{newKey}</code>
          <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(newKey); toast.success("Copied"); }}>
            <Copy className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}

      <h3 className="text-sm font-semibold mb-2">Applications</h3>
      <div className="rounded-md border overflow-x-auto mb-6">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Env</TableHead>
              <TableHead>Rate / min</TableHead>
              <TableHead>Scopes</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {apps.map((a) => (
              <TableRow key={String(a.id)}>
                <TableCell className="font-mono text-xs">{String(a.app_code)}</TableCell>
                <TableCell>{String(a.name)}</TableCell>
                <TableCell className="text-xs">{String(a.environment)}</TableCell>
                <TableCell className="text-xs">{String(a.rate_limit_per_min)}</TableCell>
                <TableCell className="text-xs">{((a.allowed_scopes as string[]) || []).join(", ")}</TableCell>
                <TableCell><StatusBadge status={String(a.status)} /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <h3 className="text-sm font-semibold mb-2">API keys</h3>
      <div className="rounded-md border overflow-x-auto mb-6">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Prefix</TableHead>
              <TableHead>App</TableHead>
              <TableHead>Hint</TableHead>
              <TableHead>Requests</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {keys.map((k) => (
              <TableRow key={String(k.id)}>
                <TableCell className="font-mono text-xs">{String(k.key_prefix)}…</TableCell>
                <TableCell className="text-xs">{(k.intg_api_apps as { name?: string } | null)?.name}</TableCell>
                <TableCell className="font-mono text-xs">…{String(k.key_hint)}</TableCell>
                <TableCell className="text-xs">{String(k.request_count)}</TableCell>
                <TableCell><StatusBadge status={k.is_active ? "active" : "inactive"} /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <h3 className="text-sm font-semibold mb-2">Routes (v1)</h3>
      <div className="rounded-md border overflow-x-auto mb-6">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Method</TableHead>
              <TableHead>Path</TableHead>
              <TableHead>Module</TableHead>
              <TableHead>Public</TableHead>
              <TableHead>Rate</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {routes.map((r) => (
              <TableRow key={String(r.id)}>
                <TableCell><Badge variant="outline">{String(r.method)}</Badge></TableCell>
                <TableCell className="font-mono text-xs">{String(r.path_pattern)}</TableCell>
                <TableCell className="text-xs">{String(r.target_module)}</TableCell>
                <TableCell className="text-xs">{r.is_public ? "Yes" : "No"}</TableCell>
                <TableCell className="text-xs">{String(r.rate_limit_per_min)}/min</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <h3 className="text-sm font-semibold mb-2">Recent request logs</h3>
      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Method</TableHead>
              <TableHead>Path</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>ms</TableHead>
              <TableHead>When</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logs.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-sm text-muted-foreground">No API traffic logged yet</TableCell></TableRow>
            ) : logs.map((l) => (
              <TableRow key={String(l.id)}>
                <TableCell className="text-xs">{String(l.method)}</TableCell>
                <TableCell className="font-mono text-xs">{String(l.path)}</TableCell>
                <TableCell className="text-xs">{String(l.status_code)}</TableCell>
                <TableCell className="text-xs">{String(l.duration_ms)}</TableCell>
                <TableCell className="text-xs">{new Date(String(l.created_at)).toLocaleString()}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
