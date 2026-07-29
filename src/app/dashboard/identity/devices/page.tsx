"use client";

import { useEffect, useState } from "react";
import { Smartphone, Plus, Ban, ShieldCheck } from "lucide-react";
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
import { StatCard } from "@/components/ui/stat-card";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/hooks/use-user";
import { formatDateTime } from "@/lib/utils";
import { toast } from "sonner";
import { registerDevice, blockDevice, unblockDevice } from "@/lib/idm";

export default function DevicesPage() {
  const { auth } = useUser();
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [users, setUsers] = useState<Array<{ id: string; first_name: string; last_name: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    user_id: "",
    device_name: "",
    device_type: "laptop",
    os_name: "",
    browser_name: "",
    last_location: "",
  });

  const companyId = auth?.profile?.company_id as string | undefined;

  const load = async () => {
    const supabase = createClient();
    const [{ data }, { data: u }] = await Promise.all([
      supabase
        .from("idm_devices")
        .select("*, user_profiles(first_name,last_name,email)")
        .order("last_activity_at", { ascending: false })
        .limit(300),
      supabase.from("user_profiles").select("id,first_name,last_name").eq("is_active", true).limit(100),
    ]);
    setRows((data as Array<Record<string, unknown>>) || []);
    setUsers((u as typeof users) || []);
    setLoading(false);
  };

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, []);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId) return;
    try {
      await registerDevice({
        company_id: companyId,
        ...form,
      });
      toast.success("Device registered");
      setOpen(false);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  };

  if (loading) return <LoadingState message="Loading devices…" />;

  const blocked = rows.filter((r) => r.is_blocked).length;

  return (
    <div>
      <PageHeader
        title="Device Management"
        description="Laptops · desktops · mobiles · tablets · block · security status"
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Register device</Button>
            </DialogTrigger>
            <DialogContent>
              <form onSubmit={create}>
                <DialogHeader><DialogTitle>Register device</DialogTitle></DialogHeader>
                <div className="grid gap-3 py-3">
                  <div>
                    <Label>User</Label>
                    <Select value={form.user_id} onValueChange={(v) => setForm((f) => ({ ...f, user_id: v }))}>
                      <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>
                        {users.map((u) => (
                          <SelectItem key={u.id} value={u.id}>{u.first_name} {u.last_name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Device name</Label>
                    <Input required value={form.device_name} onChange={(e) => setForm((f) => ({ ...f, device_name: e.target.value }))} />
                  </div>
                  <div>
                    <Label>Type</Label>
                    <Select value={form.device_type} onValueChange={(v) => setForm((f) => ({ ...f, device_type: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {["laptop", "desktop", "mobile", "tablet"].map((t) => (
                          <SelectItem key={t} value={t}>{t}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label>OS</Label>
                      <Input value={form.os_name} onChange={(e) => setForm((f) => ({ ...f, os_name: e.target.value }))} />
                    </div>
                    <div>
                      <Label>Browser</Label>
                      <Input value={form.browser_name} onChange={(e) => setForm((f) => ({ ...f, browser_name: e.target.value }))} />
                    </div>
                  </div>
                  <div>
                    <Label>Location</Label>
                    <Input value={form.last_location} onChange={(e) => setForm((f) => ({ ...f, last_location: e.target.value }))} />
                  </div>
                </div>
                <DialogFooter><Button type="submit">Save</Button></DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3 mb-6">
        <StatCard title="Devices" value={String(rows.length)} icon={Smartphone} />
        <StatCard title="Blocked" value={String(blocked)} icon={Ban} />
        <StatCard title="Trusted" value={String(rows.length - blocked)} icon={ShieldCheck} />
      </div>

      {rows.length === 0 ? (
        <EmptyState title="No devices" description="Register user devices or wait for client registration." />
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Device</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>OS / Browser</TableHead>
                <TableHead>Last activity</TableHead>
                <TableHead>Security</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => {
                const u = r.user_profiles as { first_name?: string; last_name?: string } | null;
                return (
                  <TableRow key={String(r.id)}>
                    <TableCell className="font-medium text-sm">{String(r.device_name)}</TableCell>
                    <TableCell className="text-sm">{u ? `${u.first_name} ${u.last_name}` : "—"}</TableCell>
                    <TableCell className="capitalize text-sm">{String(r.device_type)}</TableCell>
                    <TableCell className="text-xs">
                      {String(r.os_name || "—")} · {String(r.browser_name || "—")}
                    </TableCell>
                    <TableCell className="text-xs">
                      {r.last_activity_at ? formatDateTime(String(r.last_activity_at)) : "—"}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={String(r.security_status || "trusted")} />
                    </TableCell>
                    <TableCell>
                      {r.is_blocked ? (
                        <Button size="sm" variant="outline" onClick={async () => {
                          await unblockDevice(String(r.id));
                          toast.success("Unblocked");
                          await load();
                        }}>
                          Unblock
                        </Button>
                      ) : (
                        <Button size="sm" variant="ghost" onClick={async () => {
                          if (!companyId) return;
                          await blockDevice({
                            device_id: String(r.id),
                            company_id: companyId,
                            user_id: r.user_id as string,
                            actor_id: auth?.user?.id,
                            reason: "Admin block",
                          });
                          toast.success("Device blocked");
                          await load();
                        }}>
                          <Ban className="h-3.5 w-3.5 mr-1" /> Block
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
