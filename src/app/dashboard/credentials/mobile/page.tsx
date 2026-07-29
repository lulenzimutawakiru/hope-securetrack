"use client";

import { useEffect, useState } from "react";
import { Smartphone, Plus, Ban } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
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
import { createQrPublicId } from "@/lib/workforce-id";

type Badge = {
  id: string;
  badge_token: string;
  device_label: string | null;
  wallet_type: string | null;
  status: string;
  offline_until: string | null;
  share_enabled: boolean;
  last_used_at: string | null;
  wid_identities?: { full_name: string; identity_number: string } | null;
};

export default function MobileBadgePage() {
  const { auth } = useUser();
  const [rows, setRows] = useState<Badge[]>([]);
  const [identities, setIdentities] = useState<Array<{ id: string; full_name: string; identity_number: string }>>([]);
  const [credentials, setCredentials] = useState<Array<{ id: string; credential_number: string; identity_id: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    identity_id: "",
    credential_id: "",
    device_label: "Primary phone",
    wallet_type: "in_app",
    offline_days: "7",
    share_enabled: false,
  });

  const load = async () => {
    const supabase = createClient();
    const [{ data }, { data: ids }, { data: creds }] = await Promise.all([
      supabase
        .from("wid_mobile_badges")
        .select("*, wid_identities(full_name,identity_number)")
        .order("created_at", { ascending: false }),
      supabase.from("wid_identities").select("id,full_name,identity_number").eq("status", "active").limit(200),
      supabase.from("wid_credentials").select("id,credential_number,identity_id").in("status", ["active", "issued", "printed"]).limit(200),
    ]);
    setRows((data as Badge[]) ?? []);
    setIdentities(ids ?? []);
    setCredentials(creds ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, []);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth?.profile?.company_id || !form.identity_id) return;
    try {
      const days = Number(form.offline_days) || 7;
      const offline = new Date();
      offline.setDate(offline.getDate() + days);
      const supabase = createClient();
      const { error } = await supabase.from("wid_mobile_badges").insert({
        company_id: auth.profile.company_id,
        identity_id: form.identity_id,
        credential_id: form.credential_id || null,
        badge_token: `MB-${createQrPublicId().replace("WID-", "")}`,
        device_label: form.device_label || null,
        wallet_type: form.wallet_type,
        status: "active",
        offline_until: offline.toISOString(),
        share_enabled: form.share_enabled,
      });
      if (error) throw error;
      toast.success("Mobile digital badge issued");
      setOpen(false);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  };

  const revoke = async (id: string) => {
    const supabase = createClient();
    await supabase
      .from("wid_mobile_badges")
      .update({ status: "revoked", revoked_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("id", id);
    toast.success("Mobile badge revoked");
    await load();
  };

  if (loading) return <LoadingState message="Loading mobile badges…" />;

  return (
    <div>
      <PageHeader
        title="Mobile Digital ID"
        description="In-app badge · wallet-ready · offline validation window · share control"
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Issue mobile badge</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Issue mobile digital ID</DialogTitle></DialogHeader>
              <form onSubmit={create} className="space-y-3">
                <div>
                  <Label>Identity</Label>
                  <Select value={form.identity_id} onValueChange={(v) => setForm((f) => ({ ...f, identity_id: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      {identities.map((i) => (
                        <SelectItem key={i.id} value={i.id}>{i.identity_number} · {i.full_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Linked credential (optional)</Label>
                  <Select value={form.credential_id || "_none"} onValueChange={(v) => setForm((f) => ({ ...f, credential_id: v === "_none" ? "" : v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">— None —</SelectItem>
                      {credentials
                        .filter((c) => !form.identity_id || c.identity_id === form.identity_id)
                        .map((c) => (
                          <SelectItem key={c.id} value={c.id}>{c.credential_number}</SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Device label</Label>
                  <Input value={form.device_label} onChange={(e) => setForm((f) => ({ ...f, device_label: e.target.value }))} />
                </div>
                <div>
                  <Label>Wallet type</Label>
                  <Select value={form.wallet_type} onValueChange={(v) => setForm((f) => ({ ...f, wallet_type: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["in_app", "apple_wallet", "google_wallet"].map((w) => (
                        <SelectItem key={w} value={w}>{w}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Offline valid (days)</Label>
                  <Input type="number" value={form.offline_days} onChange={(e) => setForm((f) => ({ ...f, offline_days: e.target.value }))} />
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={form.share_enabled} onChange={(e) => setForm((f) => ({ ...f, share_enabled: e.target.checked }))} />
                  Allow identity sharing (controlled)
                </label>
                <DialogFooter><Button type="submit">Issue</Button></DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      {rows.length === 0 ? (
        <EmptyState title="No mobile badges" description="Issue a digital badge for the employee app / wallet." icon={Smartphone} />
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Token</TableHead>
                <TableHead>Holder</TableHead>
                <TableHead>Device</TableHead>
                <TableHead>Wallet</TableHead>
                <TableHead>Offline until</TableHead>
                <TableHead>Status</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-xs">{r.badge_token}</TableCell>
                  <TableCell>
                    <div>{r.wid_identities?.full_name}</div>
                    <div className="text-xs font-mono text-muted-foreground">{r.wid_identities?.identity_number}</div>
                  </TableCell>
                  <TableCell className="text-xs">{r.device_label || "—"}</TableCell>
                  <TableCell className="text-xs">{r.wallet_type || "—"}</TableCell>
                  <TableCell className="text-xs">{r.offline_until ? new Date(r.offline_until).toLocaleDateString() : "—"}</TableCell>
                  <TableCell><StatusBadge status={r.status} /></TableCell>
                  <TableCell>
                    {r.status === "active" && (
                      <Button size="sm" variant="outline" onClick={() => revoke(r.id)}>
                        <Ban className="h-3.5 w-3.5 mr-1" /> Revoke
                      </Button>
                    )}
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
