"use client";

import { useEffect, useState } from "react";
import { Server, Plus, Activity } from "lucide-react";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import { StatCard } from "@/components/ui/stat-card";
import { createClient } from "@/lib/supabase/crud-compat";
import { useUser } from "@/hooks/use-user";
import { formatDateTime } from "@/lib/utils";
import { toast } from "sonner";
import { crudCreate } from "@/lib/api/crud-client";

export default function PrintServerPage() {
  const { auth } = useUser();
  const [servers, setServers] = useState<Array<Record<string, unknown>>>([]);
  const [links, setLinks] = useState<Array<Record<string, unknown>>>([]);
  const [schedules, setSchedules] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    server_code: "",
    name: "",
    host_name: "",
    ip_address: "",
    max_concurrent_jobs: "10",
    load_balance_mode: "least_queue",
  });

  const companyId = auth?.profile?.company_id as string | undefined;

  const load = async () => {
    const sb = createClient();
    const [{ data: s }, { data: l }, { data: sch }] = await Promise.all([
      sb.from("prt_servers").select("*").order("server_code"),
      sb.from("prt_server_printers").select("*, printers(name,status), prt_servers(name)").limit(100),
      sb.from("prt_schedules").select("*").order("schedule_code"),
    ]);
    setServers((s as Array<Record<string, unknown>>) || []);
    setLinks((l as Array<Record<string, unknown>>) || []);
    setSchedules((sch as Array<Record<string, unknown>>) || []);
    setLoading(false);
  };

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, []);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId) return;
    try {
      const crudRes = await crudCreate("prt_servers", {
        company_id: companyId,
        server_code: form.server_code.toUpperCase(),
        name: form.name,
        host_name: form.host_name,
        ip_address: form.ip_address,
        max_concurrent_jobs: Number(form.max_concurrent_jobs) || 10,
        load_balance_mode: form.load_balance_mode,
        status: "online",
        supports_secure_release: true,
        last_heartbeat_at: new Date().toISOString(),
        is_active: true,
      });
      if (!crudRes.ok) throw new Error(crudRes.error);
      toast.success("Print server registered");
      setOpen(false);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  };

  if (loading) return <LoadingState message="Loading print servers…" />;

  const online = servers.filter((s) => s.status === "online").length;

  return (
    <div>
      <PageHeader
        title="Enterprise Print Server"
        description="Shared printers · load balancing · scheduling · secure release · agent heartbeat"
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Add server</Button>
            </DialogTrigger>
            <DialogContent>
              <form onSubmit={create}>
                <DialogHeader><DialogTitle>Register print server</DialogTitle></DialogHeader>
                <div className="grid gap-3 py-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label>Code</Label>
                      <Input required value={form.server_code} onChange={(e) => setForm((f) => ({ ...f, server_code: e.target.value }))} />
                    </div>
                    <div>
                      <Label>Max concurrent</Label>
                      <Input value={form.max_concurrent_jobs} onChange={(e) => setForm((f) => ({ ...f, max_concurrent_jobs: e.target.value }))} />
                    </div>
                  </div>
                  <div>
                    <Label>Name</Label>
                    <Input required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label>Host</Label>
                      <Input value={form.host_name} onChange={(e) => setForm((f) => ({ ...f, host_name: e.target.value }))} />
                    </div>
                    <div>
                      <Label>IP</Label>
                      <Input value={form.ip_address} onChange={(e) => setForm((f) => ({ ...f, ip_address: e.target.value }))} />
                    </div>
                  </div>
                  <div>
                    <Label>Load balance</Label>
                    <Select value={form.load_balance_mode} onValueChange={(v) => setForm((f) => ({ ...f, load_balance_mode: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="least_queue">Least queue</SelectItem>
                        <SelectItem value="round_robin">Round robin</SelectItem>
                        <SelectItem value="priority">Priority</SelectItem>
                        <SelectItem value="branch">Branch affinity</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter><Button type="submit">Save</Button></DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3 mb-6">
        <StatCard title="Servers" value={String(servers.length)} icon={Server} />
        <StatCard title="Online" value={String(online)} icon={Activity} />
        <StatCard title="Mapped printers" value={String(links.length)} icon={Server} />
      </div>

      {servers.length === 0 ? (
        <EmptyState icon={Server} title="No print servers" description="Register HQ/warehouse print agents." />
      ) : (
        <div className="rounded-md border mb-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Server</TableHead>
                <TableHead>Host / IP</TableHead>
                <TableHead>Balance</TableHead>
                <TableHead>Concurrent</TableHead>
                <TableHead>Secure release</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Heartbeat</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {servers.map((s) => (
                <TableRow key={String(s.id)}>
                  <TableCell>
                    <div className="font-medium text-sm">{String(s.name)}</div>
                    <div className="text-[10px] font-mono text-muted-foreground">{String(s.server_code)}</div>
                  </TableCell>
                  <TableCell className="text-sm">
                    {String(s.host_name || "—")}
                    <div className="text-[10px] font-mono">{String(s.ip_address || "")}</div>
                  </TableCell>
                  <TableCell className="text-xs capitalize">{String(s.load_balance_mode).replace(/_/g, " ")}</TableCell>
                  <TableCell>{String(s.max_concurrent_jobs)}</TableCell>
                  <TableCell>
                    {Boolean(s.supports_secure_release) ? (
                      <Badge variant="outline" className="text-[10px]">PIN / release</Badge>
                    ) : "—"}
                  </TableCell>
                  <TableCell><StatusBadge status={String(s.status)} /></TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {s.last_heartbeat_at ? formatDateTime(String(s.last_heartbeat_at)) : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Server ↔ printer shares</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {links.length === 0 ? (
              <p className="text-sm text-muted-foreground">No mappings (seed after migration).</p>
            ) : (
              links.slice(0, 12).map((l) => {
                const pr = l.printers as { name?: string; status?: string } | null;
                const srv = l.prt_servers as { name?: string } | null;
                return (
                  <div key={String(l.id)} className="flex justify-between text-sm border-b pb-1">
                    <span>{srv?.name} → {pr?.name}</span>
                    <Badge variant="outline" className="text-[10px]">{pr?.status || "—"}</Badge>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Print schedules</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {schedules.length === 0 ? (
              <p className="text-sm text-muted-foreground">No schedules</p>
            ) : (
              schedules.map((s) => (
                <div key={String(s.id)} className="flex justify-between text-sm border-b pb-1">
                  <span>{String(s.name)}</span>
                  <span className="font-mono text-[10px] text-muted-foreground">{String(s.cron_expr)}</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
