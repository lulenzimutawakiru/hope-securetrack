"use client";

import { useEffect, useState } from "react";
import { Settings2, Plus } from "lucide-react";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/hooks/use-user";
import { toast } from "sonner";
import { upsertLoggingPolicy, setPolicyEnabled, ROLE_MATRIX } from "@/lib/audit";
import { formatDateTime } from "@/lib/utils";

export default function AuditConfigPage() {
  const { auth } = useUser();
  const [policies, setPolicies] = useState<Array<Record<string, unknown>>>([]);
  const [history, setHistory] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    policy_code: "",
    name: "",
    module_scope: "*",
    min_severity: "info",
    description: "",
  });

  const companyId = auth?.profile?.company_id as string | undefined;
  const userId = auth?.profile?.id as string | undefined;
  const email = (auth?.profile as { email?: string } | undefined)?.email;

  const load = async () => {
    const sb = createClient();
    const [{ data: p }, { data: h }] = await Promise.all([
      sb.from("eal_logging_policies").select("*").order("policy_code"),
      sb.from("eal_config_history").select("*").order("created_at", { ascending: false }).limit(40),
    ]);
    setPolicies((p as Array<Record<string, unknown>>) || []);
    setHistory((h as Array<Record<string, unknown>>) || []);
    setLoading(false);
  };

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, []);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId) return;
    try {
      await upsertLoggingPolicy({
        company_id: companyId,
        policy_code: form.policy_code,
        name: form.name,
        module_scope: form.module_scope,
        min_severity: form.min_severity,
        description: form.description,
        actor_id: userId,
        actor_email: email,
      });
      toast.success("Policy created");
      setOpen(false);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  };

  const toggle = async (id: string, enabled: boolean) => {
    if (!companyId) return;
    try {
      await setPolicyEnabled({
        company_id: companyId,
        id,
        enabled: !enabled,
        actor_id: userId,
        actor_email: email,
      });
      toast.success(enabled ? "Disabled" : "Enabled");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  };

  if (loading) return <LoadingState message="Loading audit configuration…" />;

  return (
    <div>
      <PageHeader
        title="Audit Configuration"
        description="Logging policies · retention links · alerts · integrations · config history. Events remain immutable."
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Policy</Button>
            </DialogTrigger>
            <DialogContent>
              <form onSubmit={create}>
                <DialogHeader><DialogTitle>Logging policy</DialogTitle></DialogHeader>
                <div className="grid gap-3 py-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label>Code</Label>
                      <Input required value={form.policy_code} onChange={(e) => setForm((f) => ({ ...f, policy_code: e.target.value }))} />
                    </div>
                    <div>
                      <Label>Module scope</Label>
                      <Input value={form.module_scope} onChange={(e) => setForm((f) => ({ ...f, module_scope: e.target.value }))} />
                    </div>
                  </div>
                  <div>
                    <Label>Name</Label>
                    <Input required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
                  </div>
                  <div>
                    <Label>Min severity</Label>
                    <Input value={form.min_severity} onChange={(e) => setForm((f) => ({ ...f, min_severity: e.target.value }))} />
                  </div>
                  <div>
                    <Label>Description</Label>
                    <Input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
                  </div>
                </div>
                <DialogFooter><Button type="submit">Create</Button></DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      <Card className="mb-6 border-amber-500/30 bg-amber-500/5">
        <CardContent className="pt-4 text-sm">
          <strong>Immutable guarantee:</strong> no role—including Super Administrator—can edit or delete
          individual audit events. Only configuration objects (policies, retention, SIEM) are mutable,
          and every config change is itself audited.
        </CardContent>
      </Card>

      <h3 className="text-sm font-medium mb-2 flex items-center gap-2"><Settings2 className="h-4 w-4" /> Logging policies</h3>
      {policies.length === 0 ? (
        <EmptyState title="No policies" description="Apply migration 00040 for seed policies." />
      ) : (
        <div className="rounded-md border overflow-x-auto mb-8">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Scope</TableHead>
                <TableHead>Enabled</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {policies.map((p) => (
                <TableRow key={String(p.id)}>
                  <TableCell className="font-mono text-xs">{String(p.policy_code)}</TableCell>
                  <TableCell className="text-sm">{String(p.name)}</TableCell>
                  <TableCell className="text-xs">{String(p.module_scope)}</TableCell>
                  <TableCell>
                    <Badge variant={p.enabled ? "default" : "outline"} className="text-[10px]">
                      {p.enabled ? "On" : "Off"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="outline" onClick={() => toggle(String(p.id), !!p.enabled)}>
                      {p.enabled ? "Disable" : "Enable"}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <h3 className="text-sm font-medium mb-2">Role matrix (§22)</h3>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 mb-8">
        {ROLE_MATRIX.map((r) => (
          <Card key={r.role}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">{r.role}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-1 mb-2">
                {r.permissions.map((p) => (
                  <Badge key={p} variant="secondary" className="text-[9px] font-mono">{p}</Badge>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">{r.notes}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <h3 className="text-sm font-medium mb-2">Configuration history</h3>
      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>When</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Actor</TableHead>
              <TableHead>Details</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {history.map((h) => (
              <TableRow key={String(h.id)}>
                <TableCell className="text-xs whitespace-nowrap">{formatDateTime(String(h.created_at))}</TableCell>
                <TableCell className="text-xs">{String(h.config_type)}</TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-[10px]">{String(h.action)}</Badge>
                </TableCell>
                <TableCell className="text-xs">{String(h.actor_email || "—")}</TableCell>
                <TableCell className="text-xs max-w-[200px] truncate">{String(h.details || "")}</TableCell>
              </TableRow>
            ))}
            {history.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-sm text-muted-foreground">No config changes yet</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
