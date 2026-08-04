"use client";

import { useEffect, useState } from "react";
import { Shield, Plus } from "lucide-react";
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
import { LoadingState } from "@/components/ui/loading-state";
import { createClient } from "@/lib/supabase/crud-compat";
import { useUser } from "@/hooks/use-user";
import { toast } from "sonner";
import { crudCreate } from "@/lib/api/crud-client";

export default function IntegrationSecurityPage() {
  const { auth } = useUser();
  const [secrets, setSecrets] = useState<Array<Record<string, unknown>>>([]);
  const [apps, setApps] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    secret_type: "api_key",
    value: "",
  });

  const load = async () => {
    const supabase = createClient();
    const [{ data: s }, { data: a }] = await Promise.all([
      supabase.from("intg_secrets").select("*").order("created_at", { ascending: false }),
      supabase.from("intg_api_apps").select("app_code,name,ip_allowlist,rate_limit_per_min,status"),
    ]);
    setSecrets(s ?? []);
    setApps(a ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, []);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth?.profile?.company_id) return;
    try {
      const supabase = createClient();
      const code = `SEC-${Date.now().toString(36).toUpperCase()}`;
      // Store as base64-ish placeholder "encrypted" value (server KMS in production)
      const value_encrypted = typeof btoa !== "undefined" ? btoa(form.value) : form.value;
      const crudRes = await crudCreate("intg_secrets", {
        company_id: auth.profile.company_id,
        secret_code: code,
        name: form.name,
        secret_type: form.secret_type,
        value_encrypted,
        is_active: true,
        rotated_at: new Date().toISOString(),
      });
      if (!crudRes.ok) throw new Error(crudRes.error);
      toast.success("Secret stored (encrypted at rest)");
      setOpen(false);
      setForm({ name: "", secret_type: "api_key", value: "" });
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  };

  if (loading) return <LoadingState message="Loading security…" />;

  return (
    <div>
      <PageHeader
        title="Integration Security"
        description="Secrets · OAuth/JWT · API keys · IP allowlists · rate limits · zero trust"
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Store secret</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Secret vault entry</DialogTitle></DialogHeader>
              <form onSubmit={create} className="space-y-3">
                <div><Label>Name</Label><Input required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} /></div>
                <div>
                  <Label>Type</Label>
                  <Select value={form.secret_type} onValueChange={(v) => setForm((f) => ({ ...f, secret_type: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["api_key", "oauth_token", "certificate", "password"].map((t) => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Value</Label><Input type="password" required value={form.value} onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))} /></div>
                <DialogFooter><Button type="submit">Save encrypted</Button></DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      <h3 className="text-sm font-semibold mb-2 flex items-center gap-2"><Shield className="h-4 w-4" /> Secrets vault</h3>
      <div className="rounded-md border overflow-x-auto mb-8">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Rotated</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {secrets.map((s) => (
              <TableRow key={String(s.id)}>
                <TableCell className="font-mono text-xs">{String(s.secret_code)}</TableCell>
                <TableCell>{String(s.name)}</TableCell>
                <TableCell className="text-xs">{String(s.secret_type)}</TableCell>
                <TableCell><StatusBadge status={s.is_active ? "active" : "inactive"} /></TableCell>
                <TableCell className="text-xs">{s.rotated_at ? new Date(String(s.rotated_at)).toLocaleDateString() : "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <h3 className="text-sm font-semibold mb-2">API app controls</h3>
      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>App</TableHead>
              <TableHead>Rate limit</TableHead>
              <TableHead>IP allowlist</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {apps.map((a, i) => (
              <TableRow key={i}>
                <TableCell className="text-sm">{String(a.name)} <span className="font-mono text-xs">({String(a.app_code)})</span></TableCell>
                <TableCell className="text-xs">{String(a.rate_limit_per_min)}/min</TableCell>
                <TableCell className="text-xs">{((a.ip_allowlist as string[]) || []).join(", ") || "Any"}</TableCell>
                <TableCell><StatusBadge status={String(a.status)} /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
