"use client";

import { useEffect, useState } from "react";
import { Plug, Plus, RefreshCw, Power } from "lucide-react";
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
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/hooks/use-user";
import { toast } from "sonner";
import { crudCreate, crudUpdate } from "@/lib/api/crud-client";
import { testConnection } from "@/lib/integration";

export default function ConnectionsPage() {
  const { auth } = useUser();
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [connectors, setConnectors] = useState<Array<{ id: string; name: string; connector_code: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    connector_id: "",
    name: "",
    base_url: "",
    environment: "sandbox",
  });

  const load = async () => {
    const supabase = createClient();
    const [{ data }, { data: c }] = await Promise.all([
      supabase
        .from("intg_connections")
        .select("*, intg_connectors(name,connector_code,category)")
        .is("deleted_at", null)
        .order("created_at", { ascending: false }),
      supabase.from("intg_connectors").select("id,name,connector_code").eq("is_active", true).order("name"),
    ]);
    setRows(data ?? []);
    setConnectors(c ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, []);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth?.profile?.company_id || !form.connector_id) return;
    try {
      const supabase = createClient();
      const code = `CONN-${Date.now().toString(36).toUpperCase()}`;
      const crudRes2 = await crudCreate("intg_connections", {
        company_id: auth.profile.company_id,
        connector_id: form.connector_id,
        connection_code: code,
        name: form.name,
        base_url: form.base_url || null,
        environment: form.environment,
        status: "draft",
        is_enabled: true,
        created_by: auth.profile.id,
      });
      if (!crudRes2.ok) throw new Error(crudRes2.error);
      toast.success("Connection created");
      setOpen(false);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  };

  const test = async (id: string) => {
    try {
      const supabase = createClient();
      const res = await testConnection(supabase, id);
      toast[res.success ? "success" : "error"](res.message);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Test failed");
    }
  };

  const toggle = async (row: Record<string, unknown>) => {
    const supabase = createClient();
    const crudRes = await crudUpdate("intg_connections", String(row.id), {
        is_enabled: !row.is_enabled,
        status: row.is_enabled ? "disabled" : row.status === "disabled" ? "draft" : row.status,
        updated_at: new Date().toISOString(),
      });
    toast.success(row.is_enabled ? "Disabled" : "Enabled");
    await load();
  };

  if (loading) return <LoadingState message="Loading connections…" />;

  return (
    <div>
      <PageHeader
        title="Connections"
        description="Configure connectors · test · enable/disable · health scores"
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 mr-1" /> New connection</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Create connection</DialogTitle></DialogHeader>
              <form onSubmit={create} className="space-y-3">
                <div>
                  <Label>Connector</Label>
                  <Select value={form.connector_id} onValueChange={(v) => setForm((f) => ({ ...f, connector_id: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      {connectors.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.connector_code} · {c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Name</Label><Input required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} /></div>
                <div><Label>Base URL</Label><Input value={form.base_url} onChange={(e) => setForm((f) => ({ ...f, base_url: e.target.value }))} placeholder="https://api.example.com" /></div>
                <div>
                  <Label>Environment</Label>
                  <Select value={form.environment} onValueChange={(v) => setForm((f) => ({ ...f, environment: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["sandbox", "staging", "production"].map((e) => (
                        <SelectItem key={e} value={e}>{e}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <DialogFooter><Button type="submit">Create</Button></DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      {rows.length === 0 ? (
        <EmptyState title="No connections" description="Install a connector from the marketplace." icon={Plug} />
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Connector</TableHead>
                <TableHead>Env</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Health</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={String(r.id)}>
                  <TableCell className="font-mono text-xs">{String(r.connection_code)}</TableCell>
                  <TableCell>{String(r.name)}</TableCell>
                  <TableCell className="text-xs">
                    {(r.intg_connectors as { name?: string } | null)?.name || "—"}
                  </TableCell>
                  <TableCell className="text-xs">{String(r.environment)}</TableCell>
                  <TableCell><StatusBadge status={String(r.status)} /></TableCell>
                  <TableCell className="text-xs">{String(r.health_score ?? "—")}</TableCell>
                  <TableCell className="space-x-1">
                    <Button size="sm" variant="outline" onClick={() => test(String(r.id))}>
                      <RefreshCw className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => toggle(r)}>
                      <Power className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
