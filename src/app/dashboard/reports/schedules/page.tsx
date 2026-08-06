"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CalendarClock, Plus } from "lucide-react";
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
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import { createClient } from "@/lib/supabase/crud-compat";
import { useUser } from "@/hooks/use-user";
import { toast } from "sonner";
import { crudCreate, crudUpdate } from "@/lib/api/crud-client";

export default function SchedulesPage() {
  const { auth } = useUser();
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    schedule_code: "",
    name: "",
    frequency_label: "weekly",
    cron_expression: "0 8 * * 1",
    format: "pdf",
    recipients: "md@hopedesign.ug",
    delivery_channels: "email,portal",
  });

  const load = async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("bi_report_schedules")
      .select("*")
      .order("name");
    setRows(data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth) return;
    const recipients = form.recipients
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const delivery_channels = form.delivery_channels
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const crudRes3 = await crudCreate("bi_report_schedules", {
      company_id: auth.profile.company_id,
      schedule_code: form.schedule_code.toUpperCase(),
      name: form.name,
      frequency_label: form.frequency_label,
      cron_expression: form.cron_expression,
      format: form.format,
      recipients,
      delivery_channels,
      is_active: true,
      created_by: auth.profile.id,
    });
    if (!crudRes3.ok) toast.error(crudRes3.error);
    else {
      toast.success("Schedule created");
      setOpen(false);
      load();
    }
  };

  const toggle = async (id: string, is_active: boolean) => {
    const crudRes2 = await crudUpdate("bi_report_schedules", id, { is_active: !is_active, updated_at: new Date().toISOString() });
    if (!crudRes2.ok) toast.error(crudRes2.error);
    else load();
  };

  const markRun = async (id: string) => {
    const crudRes = await crudUpdate("bi_report_schedules", id, { last_run_at: new Date().toISOString() });
    if (!crudRes.ok) toast.error(crudRes.error);
    else {
      toast.success("Marked as run");
      load();
    }
  };

  if (loading) return <LoadingState />;

  return (
    <div>
      <PageHeader
        title="Schedules & Delivery"
        description="Cron-based packs · board weekly · finance monthly · security daily"
        actions={
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard/reports">Hub</Link>
            </Button>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-1" />
                  Schedule
                </Button>
              </DialogTrigger>
              <DialogContent>
                <form onSubmit={create} className="space-y-3">
                  <DialogHeader>
                    <DialogTitle>New schedule</DialogTitle>
                  </DialogHeader>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label>Code</Label>
                      <Input
                        value={form.schedule_code}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, schedule_code: e.target.value }))
                        }
                        required
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Frequency</Label>
                      <Input
                        value={form.frequency_label}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, frequency_label: e.target.value }))
                        }
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label>Name</Label>
                    <Input
                      value={form.name}
                      onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label>Cron</Label>
                      <Input
                        value={form.cron_expression}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, cron_expression: e.target.value }))
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Format</Label>
                      <Input
                        value={form.format}
                        onChange={(e) => setForm((f) => ({ ...f, format: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label>Recipients (comma-separated)</Label>
                    <Input
                      value={form.recipients}
                      onChange={(e) => setForm((f) => ({ ...f, recipients: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Channels (email,sms,whatsapp,teams,slack,gdrive,sharepoint,ftp,sftp,portal)</Label>
                    <Input
                      value={form.delivery_channels}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, delivery_channels: e.target.value }))
                      }
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    Frequencies: hourly · daily · weekly · monthly · quarterly · annually · custom cron
                  </p>
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
        <EmptyState icon={CalendarClock} title="No schedules" description="Automate report delivery" />
      ) : (
        <div className="rounded-lg border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Frequency</TableHead>
                <TableHead>Cron</TableHead>
                <TableHead>Format</TableHead>
                <TableHead>Channels</TableHead>
                <TableHead>Last run</TableHead>
                <TableHead>Status</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={String(r.id)}>
                  <TableCell className="font-mono text-xs">{String(r.schedule_code)}</TableCell>
                  <TableCell className="text-sm">{String(r.name)}</TableCell>
                  <TableCell className="text-sm capitalize">
                    {String(r.frequency_label)}
                  </TableCell>
                  <TableCell className="font-mono text-[10px]">
                    {String(r.cron_expression)}
                  </TableCell>
                  <TableCell className="uppercase text-xs">{String(r.format)}</TableCell>
                  <TableCell className="text-[10px] max-w-[120px] truncate">
                    {Array.isArray(r.delivery_channels)
                      ? (r.delivery_channels as string[]).join(", ")
                      : "email"}
                  </TableCell>
                  <TableCell className="text-xs">
                    {r.last_run_at
                      ? new Date(String(r.last_run_at)).toLocaleString()
                      : "—"}
                  </TableCell>
                  <TableCell>
                    {r.is_active ? (
                      <Badge className="bg-green-100 text-green-800">Active</Badge>
                    ) : (
                      <Badge variant="secondary">Paused</Badge>
                    )}
                  </TableCell>
                  <TableCell className="space-x-1">
                    <Button size="sm" variant="outline" onClick={() => markRun(String(r.id))}>
                      Run now
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => toggle(String(r.id), Boolean(r.is_active))}
                    >
                      {r.is_active ? "Pause" : "Enable"}
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
