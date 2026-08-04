"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Workflow, Plus, Zap } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import { createClient } from "@/lib/supabase/crud-compat";
import { useUser } from "@/hooks/use-user";
import { toast } from "sonner";
import { crudCreate, crudUpdate } from "@/lib/api/crud-client";

export default function NotificationRulesPage() {
  const { auth } = useUser();
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [firing, setFiring] = useState<string | null>(null);
  const [form, setForm] = useState({
    rule_code: "",
    name: "",
    event_key: "",
    category: "system",
    priority: "normal",
    title_template: "",
    body_template: "",
    link_template: "",
    channels: "in_app,email",
  });

  const load = async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("notification_rules")
      .select("*")
      .order("event_key");
    setRows(data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth) return;
    const supabase = createClient();
    const crudRes2 = await crudCreate("notification_rules", {
      company_id: auth.profile.company_id,
      rule_code: form.rule_code.toUpperCase(),
      name: form.name,
      event_key: form.event_key,
      category: form.category,
      priority: form.priority,
      title_template: form.title_template,
      body_template: form.body_template || null,
      link_template: form.link_template || null,
      channels: form.channels.split(",").map((s) => s.trim()).filter(Boolean),
      audience: { roles: ["super_administrator"] },
      is_active: true,
    });
    if (!crudRes2.ok) toast.error(crudRes2.error);
    else {
      toast.success("Rule created");
      setOpen(false);
      load();
    }
  };

  const toggle = async (id: string, is_active: boolean) => {
    const supabase = createClient();
    const crudRes = await crudUpdate("notification_rules", id, { is_active: !is_active, updated_at: new Date().toISOString() });
    if (!crudRes.ok) toast.error(crudRes.error);
    else load();
  };

  const fireEvent = async (eventKey: string) => {
    setFiring(eventKey);
    try {
      const res = await fetch("/api/notifications/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event_key: eventKey,
          vars: {
            title: "Test alert",
            message: "This is a test notification from the rules engine.",
            name: auth?.profile.first_name || "User",
            number: "HDG-TEST-001",
            amount: "250,000 UGX",
            supplier: "Demo Supplier",
            product: "Security Paper A4",
            qty: "12",
            status: "approved",
            start: "2026-08-01",
            end: "2026-08-03",
            recommendation: "Review AI insight in Reports → AI.",
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) toast.error(data.error || "Fire failed");
      else
        toast.success(
          `Fired ${eventKey}: ${data.inApp} in-app, ${data.email} email`
        );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setFiring(null);
    }
  };

  if (loading) return <LoadingState />;

  return (
    <div>
      <PageHeader
        title="Notification Rules"
        description="Event-driven automation · multi-channel fan-out · templates"
        actions={
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard/notifications">Inbox</Link>
            </Button>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-1" />
                  Rule
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                <form onSubmit={create} className="space-y-3">
                  <DialogHeader>
                    <DialogTitle>New notification rule</DialogTitle>
                  </DialogHeader>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label>Code</Label>
                      <Input
                        required
                        value={form.rule_code}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, rule_code: e.target.value }))
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Event key</Label>
                      <Input
                        required
                        value={form.event_key}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, event_key: e.target.value }))
                        }
                        placeholder="stock.low"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label>Name</Label>
                    <Input
                      required
                      value={form.name}
                      onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label>Category</Label>
                      <Input
                        value={form.category}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, category: e.target.value }))
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Priority</Label>
                      <select
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        value={form.priority}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, priority: e.target.value }))
                        }
                      >
                        <option value="low">low</option>
                        <option value="normal">normal</option>
                        <option value="high">high</option>
                        <option value="urgent">urgent</option>
                      </select>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label>Title template</Label>
                    <Input
                      required
                      value={form.title_template}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, title_template: e.target.value }))
                      }
                      placeholder="Alert: {{title}}"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Body template</Label>
                    <textarea
                      className="flex min-h-[70px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={form.body_template}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, body_template: e.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Link template</Label>
                    <Input
                      value={form.link_template}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, link_template: e.target.value }))
                      }
                      placeholder="/dashboard/..."
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Channels (comma)</Label>
                    <Input
                      value={form.channels}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, channels: e.target.value }))
                      }
                    />
                  </div>
                  <DialogFooter>
                    <Button type="submit">Create</Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        }
      />

      {rows.length === 0 ? (
        <EmptyState icon={Workflow} title="No rules" description="Create event-driven rules" />
      ) : (
        <div className="rounded-lg border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Event</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Channels</TableHead>
                <TableHead>Status</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={String(r.id)}>
                  <TableCell className="font-mono text-xs">{String(r.rule_code)}</TableCell>
                  <TableCell className="font-mono text-xs">{String(r.event_key)}</TableCell>
                  <TableCell className="text-sm">{String(r.name)}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-[10px] capitalize">
                      {String(r.category)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs capitalize">{String(r.priority)}</TableCell>
                  <TableCell className="text-[10px]">
                    {Array.isArray(r.channels)
                      ? (r.channels as string[]).join(", ")
                      : "—"}
                  </TableCell>
                  <TableCell>
                    {r.is_active ? (
                      <Badge className="bg-green-100 text-green-800">Active</Badge>
                    ) : (
                      <Badge variant="secondary">Off</Badge>
                    )}
                  </TableCell>
                  <TableCell className="space-x-1">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={firing === String(r.event_key)}
                      onClick={() => fireEvent(String(r.event_key))}
                    >
                      <Zap className="h-3.5 w-3.5 mr-1" />
                      Fire
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => toggle(String(r.id), Boolean(r.is_active))}
                    >
                      {r.is_active ? "Disable" : "Enable"}
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
