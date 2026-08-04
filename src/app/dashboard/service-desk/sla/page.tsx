"use client";

import { useEffect, useState } from "react";
import { Clock, Plus, AlertTriangle } from "lucide-react";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingState } from "@/components/ui/loading-state";
import { StatCard } from "@/components/ui/stat-card";
import { createClient } from "@/lib/supabase/crud-compat";
import { useUser } from "@/hooks/use-user";
import { toast } from "sonner";
import { crudCreate } from "@/lib/api/crud-client";

export default function SlaPage() {
  const { auth } = useUser();
  const [policies, setPolicies] = useState<Array<Record<string, unknown>>>([]);
  const [rules, setRules] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    policy_code: "",
    name: "",
    priority: "medium",
    response_minutes: "60",
    resolve_minutes: "480",
  });

  const companyId = auth?.profile?.company_id as string | undefined;

  const load = async () => {
    const supabase = createClient();
    const [{ data: p }, { data: r }] = await Promise.all([
      supabase.from("sd_sla_policies").select("*").order("response_minutes"),
      supabase.from("sd_escalation_rules").select("*").order("created_at", { ascending: false }),
    ]);
    setPolicies((p as Array<Record<string, unknown>>) || []);
    setRules((r as Array<Record<string, unknown>>) || []);
    setLoading(false);
  };

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, []);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId) return;
    const crudRes = await crudCreate("sd_sla_policies", {
      company_id: companyId,
      policy_code: form.policy_code,
      name: form.name,
      priority: form.priority,
      response_minutes: Number(form.response_minutes),
      resolve_minutes: Number(form.resolve_minutes),
      is_active: true,
    });
    if (!crudRes.ok) toast.error(crudRes.error);
    else {
      toast.success("SLA policy created");
      setOpen(false);
      await load();
    }
  };

  if (loading) return <LoadingState message="Loading SLA engine…" />;

  return (
    <div>
      <PageHeader
        title="SLA & Escalation"
        description="Response · resolution · business hours · escalation ladder"
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 mr-1" /> SLA policy</Button>
            </DialogTrigger>
            <DialogContent>
              <form onSubmit={create}>
                <DialogHeader><DialogTitle>New SLA policy</DialogTitle></DialogHeader>
                <div className="grid gap-3 py-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label>Code</Label>
                      <Input required value={form.policy_code} onChange={(e) => setForm((f) => ({ ...f, policy_code: e.target.value }))} />
                    </div>
                    <div>
                      <Label>Priority</Label>
                      <Input value={form.priority} onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))} />
                    </div>
                  </div>
                  <div>
                    <Label>Name</Label>
                    <Input required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label>Response (min)</Label>
                      <Input type="number" value={form.response_minutes} onChange={(e) => setForm((f) => ({ ...f, response_minutes: e.target.value }))} />
                    </div>
                    <div>
                      <Label>Resolve (min)</Label>
                      <Input type="number" value={form.resolve_minutes} onChange={(e) => setForm((f) => ({ ...f, resolve_minutes: e.target.value }))} />
                    </div>
                  </div>
                </div>
                <DialogFooter><Button type="submit">Save</Button></DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 mb-6">
        <StatCard title="SLA policies" value={String(policies.length)} icon={Clock} />
        <StatCard title="Escalation rules" value={String(rules.length)} icon={AlertTriangle} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Policies</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead className="text-right">Response</TableHead>
                  <TableHead className="text-right">Resolve</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {policies.map((p) => (
                  <TableRow key={String(p.id)}>
                    <TableCell className="font-mono text-sm">{String(p.policy_code)}</TableCell>
                    <TableCell className="capitalize">{String(p.priority)}</TableCell>
                    <TableCell className="text-right">{String(p.response_minutes)}m</TableCell>
                    <TableCell className="text-right">{String(p.resolve_minutes)}m</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Escalation ladder</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="text-sm space-y-2">
              {["L1 Agent", "Team Leader", "IT Manager", "Director", "Executive"].map((l, i) => (
                <div key={l} className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium">{i + 1}</div>
                  <span>{l}</span>
                  {i < 4 && <span className="text-muted-foreground text-xs">↓</span>}
                </div>
              ))}
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Rule</TableHead>
                  <TableHead>Trigger</TableHead>
                  <TableHead>Level</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rules.map((r) => (
                  <TableRow key={String(r.id)}>
                    <TableCell className="text-sm">{String(r.name)}</TableCell>
                    <TableCell className="text-xs capitalize">{String(r.trigger_type).replace(/_/g, " ")}</TableCell>
                    <TableCell>L{String(r.escalate_to_level)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
