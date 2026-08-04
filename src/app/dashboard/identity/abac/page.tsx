"use client";

import { useEffect, useState } from "react";
import { ShieldCheck, Plus } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingState } from "@/components/ui/loading-state";
import { StatCard } from "@/components/ui/stat-card";
import { createClient } from "@/lib/supabase/crud-compat";
import { useUser } from "@/hooks/use-user";
import { toast } from "sonner";
import { crudCreate } from "@/lib/api/crud-client";
import { evaluateAbac, explainAbac } from "@/lib/idm";

export default function AbacPage() {
  const { auth } = useUser();
  const [rules, setRules] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    rule_code: "",
    name: "",
    effect: "allow",
    conditions: '{"department":"Finance"}',
    permission_slugs: "billing.approve",
    action_label: "",
    priority: "50",
  });
  const [sim, setSim] = useState({
    department: "Finance",
    user_type: "employee",
    role_slug: "accountant",
    permission: "billing.approve",
  });
  const [simResult, setSimResult] = useState("");

  const companyId = auth?.profile?.company_id as string | undefined;

  const load = async () => {
    const { data } = await createClient()
      .from("idm_abac_rules")
      .select("*")
      .order("priority");
    setRules((data as Array<Record<string, unknown>>) || []);
    setLoading(false);
  };

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, []);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId) return;
    let conditions = {};
    try {
      conditions = JSON.parse(form.conditions);
    } catch {
      toast.error("Invalid conditions JSON");
      return;
    }
    const crudRes = await crudCreate("idm_abac_rules", {
      company_id: companyId,
      rule_code: form.rule_code,
      name: form.name,
      effect: form.effect,
      conditions,
      permission_slugs: form.permission_slugs.split(",").map((s) => s.trim()).filter(Boolean),
      action_label: form.action_label,
      priority: Number(form.priority) || 100,
      is_active: true,
    });
    if (!crudRes.ok) toast.error(crudRes.error);
    else {
      toast.success("ABAC rule created");
      setOpen(false);
      await load();
    }
  };

  const simulate = () => {
    const result = evaluateAbac(
      rules.map((r) => ({
        rule_code: String(r.rule_code),
        name: String(r.name),
        conditions: (r.conditions || {}) as Record<string, unknown>,
        effect: String(r.effect),
        permission_slugs: r.permission_slugs as string[],
        action_label: r.action_label as string,
        priority: Number(r.priority),
        is_active: Boolean(r.is_active),
      })),
      {
        department: sim.department,
        user_type: sim.user_type,
        role_slug: sim.role_slug,
      },
      sim.permission
    );
    setSimResult(
      `${explainAbac(result)} · allowed=${String(result.allowed)} · matched=${result.matched.length}`
    );
  };

  if (loading) return <LoadingState message="Loading ABAC rules…" />;

  return (
    <div>
      <PageHeader
        title="Attribute-Based Access Control"
        description="IF department + role THEN allow/deny permissions"
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Rule</Button>
            </DialogTrigger>
            <DialogContent>
              <form onSubmit={create}>
                <DialogHeader><DialogTitle>New ABAC rule</DialogTitle></DialogHeader>
                <div className="grid gap-3 py-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label>Code</Label>
                      <Input required value={form.rule_code} onChange={(e) => setForm((f) => ({ ...f, rule_code: e.target.value }))} />
                    </div>
                    <div>
                      <Label>Effect</Label>
                      <Select value={form.effect} onValueChange={(v) => setForm((f) => ({ ...f, effect: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="allow">Allow</SelectItem>
                          <SelectItem value="deny">Deny</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div>
                    <Label>Name</Label>
                    <Input required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
                  </div>
                  <div>
                    <Label>Conditions JSON</Label>
                    <textarea
                      className="flex min-h-[70px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
                      value={form.conditions}
                      onChange={(e) => setForm((f) => ({ ...f, conditions: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label>Permission slugs (comma)</Label>
                    <Input value={form.permission_slugs} onChange={(e) => setForm((f) => ({ ...f, permission_slugs: e.target.value }))} />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label>Action label</Label>
                      <Input value={form.action_label} onChange={(e) => setForm((f) => ({ ...f, action_label: e.target.value }))} />
                    </div>
                    <div>
                      <Label>Priority</Label>
                      <Input type="number" value={form.priority} onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))} />
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
        <StatCard title="Rules" value={String(rules.length)} icon={ShieldCheck} />
        <StatCard title="Active" value={String(rules.filter((r) => r.is_active).length)} icon={ShieldCheck} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3 mb-6">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2"><CardTitle className="text-base">Rules</CardTitle></CardHeader>
          <CardContent>
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Effect</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Permissions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rules.map((r) => (
                    <TableRow key={String(r.id)}>
                      <TableCell className="font-mono text-sm">{String(r.rule_code)}</TableCell>
                      <TableCell className="text-sm">{String(r.name)}</TableCell>
                      <TableCell>
                        <Badge variant={r.effect === "deny" ? "destructive" : "default"} className="capitalize">
                          {String(r.effect)}
                        </Badge>
                      </TableCell>
                      <TableCell>{String(r.priority)}</TableCell>
                      <TableCell className="text-xs max-w-[180px] truncate">
                        {((r.permission_slugs as string[]) || []).join(", ")}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Simulator</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <div>
              <Label className="text-xs">Department</Label>
              <Input value={sim.department} onChange={(e) => setSim((s) => ({ ...s, department: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs">Role slug</Label>
              <Input value={sim.role_slug} onChange={(e) => setSim((s) => ({ ...s, role_slug: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs">User type</Label>
              <Input value={sim.user_type} onChange={(e) => setSim((s) => ({ ...s, user_type: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs">Permission</Label>
              <Input value={sim.permission} onChange={(e) => setSim((s) => ({ ...s, permission: e.target.value }))} />
            </div>
            <Button size="sm" className="w-full" onClick={simulate}>Evaluate</Button>
            {simResult && <p className="text-xs text-muted-foreground border rounded p-2">{simResult}</p>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
