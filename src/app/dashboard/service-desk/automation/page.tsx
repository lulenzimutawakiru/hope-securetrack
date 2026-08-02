"use client";

import { useEffect, useState } from "react";
import { Settings, Plus } from "lucide-react";
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
import { LoadingState } from "@/components/ui/loading-state";
import { StatCard } from "@/components/ui/stat-card";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/hooks/use-user";
import { toast } from "sonner";
import { crudCreate, crudUpdate } from "@/lib/api/crud-client";

export default function AutomationPage() {
  const { auth } = useUser();
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    trigger_event: "ticket_created",
    conditions: '{"category":"network"}',
    actions: '[{"type":"assign_team","team_code":"IT-NET"}]',
  });

  const companyId = auth?.profile?.company_id as string | undefined;

  const load = async () => {
    const { data } = await createClient()
      .from("sd_automations")
      .select("*")
      .order("created_at", { ascending: false });
    setRows((data as Array<Record<string, unknown>>) || []);
    setLoading(false);
  };

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, []);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId) return;
    let conditions = {};
    let actions: unknown[] = [];
    try {
      conditions = JSON.parse(form.conditions);
      actions = JSON.parse(form.actions);
    } catch {
      toast.error("Invalid JSON in conditions or actions");
      return;
    }
    const crudRes2 = await crudCreate("sd_automations", {
      company_id: companyId,
      name: form.name,
      trigger_event: form.trigger_event,
      conditions,
      actions,
      is_active: true,
    });
    if (!crudRes2.ok) toast.error(crudRes2.error);
    else {
      toast.success("Automation created");
      setOpen(false);
      await load();
    }
  };

  const toggle = async (id: string, active: boolean) => {
    const crudRes = await crudUpdate("sd_automations", id, { is_active: !active });
    toast.success(active ? "Disabled" : "Enabled");
    await load();
  };

  if (loading) return <LoadingState message="Loading automations…" />;

  const active = rows.filter((r) => r.is_active).length;

  return (
    <div>
      <PageHeader
        title="Automation Engine"
        description="No-code rules · auto-route · notify · escalate · catalog flows"
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Rule</Button>
            </DialogTrigger>
            <DialogContent>
              <form onSubmit={create}>
                <DialogHeader><DialogTitle>New automation</DialogTitle></DialogHeader>
                <div className="grid gap-3 py-3">
                  <div>
                    <Label>Name</Label>
                    <Input required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
                  </div>
                  <div>
                    <Label>Trigger</Label>
                    <Input value={form.trigger_event} onChange={(e) => setForm((f) => ({ ...f, trigger_event: e.target.value }))} />
                  </div>
                  <div>
                    <Label>Conditions (JSON)</Label>
                    <textarea
                      className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
                      value={form.conditions}
                      onChange={(e) => setForm((f) => ({ ...f, conditions: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label>Actions (JSON)</Label>
                    <textarea
                      className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
                      value={form.actions}
                      onChange={(e) => setForm((f) => ({ ...f, actions: e.target.value }))}
                    />
                  </div>
                </div>
                <DialogFooter><Button type="submit">Save</Button></DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 mb-6">
        <StatCard title="Rules" value={String(rows.length)} icon={Settings} />
        <StatCard title="Active" value={String(active)} icon={Settings} />
      </div>

      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Trigger</TableHead>
              <TableHead>Runs</TableHead>
              <TableHead>Status</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={String(r.id)}>
                <TableCell className="text-sm font-medium">{String(r.name)}</TableCell>
                <TableCell className="font-mono text-xs">{String(r.trigger_event)}</TableCell>
                <TableCell>{String(r.run_count || 0)}</TableCell>
                <TableCell>
                  <Badge variant={r.is_active ? "default" : "outline"}>
                    {r.is_active ? "Active" : "Off"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Button size="sm" variant="outline" onClick={() => toggle(String(r.id), Boolean(r.is_active))}>
                    Toggle
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
